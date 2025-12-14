import asyncio
import os
import math
from typing import Dict, Any, List, Optional
from datetime import datetime
from collections import defaultdict
import time
import json

from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.graph import StateGraph, END
from langgraph.errors import GraphRecursionError
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.types import interrupt
from typing import Optional, Union
from langgraph.types import Command
from typing_extensions import Annotated, TypedDict
from operator import add
import tiktoken
import requests
from redis.asyncio import Redis
from pydantic import BaseModel, Field

import contextvars

# Context vars for associating async LLM calls with a session/turn.
_CURRENT_SESSION_ID = contextvars.ContextVar("router_agent_session_id", default=None)
_CURRENT_TURN_ID = contextvars.ContextVar("router_agent_turn_id", default=None)


class ResponseWithTools(BaseModel):
    """Structured LLM response: user text plus optional multi-tool calls.

    Used with `ChatOpenAI.with_structured_output`, which configures the OpenAI
    client to return a JSON object matching this schema.
    """

    text_to_user: str = Field(
        ..., description="Natural language message shown to the user.",
    )
    tool_calls: List[str] = Field(
        default_factory=list,
        description=(
            "List of tool invocations as CSV strings. Each item should look like "
            "'tool_name, arg1, arg2, ...'."
        ),
    )

    @staticmethod
    def extract_first_json_object(text: str) -> Optional[str]:
        """Best-effort: return the first top-level JSON object from a string.

        This is only used as a fallback when the model returns valid JSON
        followed by extra trailing characters (e.g., explanations).
        """
        import json

        if not isinstance(text, str):
            return None

        # NOTE: Previously we sliced from the first '{' to the last '}', which
        # broke when the model returned multiple JSON objects concatenated.
        # This implementation walks brace depth to return only the first
        # complete top-level JSON object.
        start = text.find("{")
        if start == -1:
            return None

        depth = 0
        in_string = False
        escape = False

        for i, ch in enumerate(text[start:], start=start):
            if escape:
                escape = False
                continue
            if ch == "\\":
                escape = True
                continue
            if ch == '"':
                in_string = not in_string
                continue
            if in_string:
                continue

            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    candidate = text[start : i + 1]
                    try:
                        json.loads(candidate)
                        return candidate
                    except Exception:
                        return None

        return None


class MeteredChatOpenAI(ChatOpenAI):
    """ChatOpenAI wrapper that meters tokens and reports them back to RouterAgent.

    This ensures all llm_client usage (main chat + writer tools) is tracked
    in a single place for credit calculation.
    """

    def __init__(self, agent: "RouterAgent", **kwargs):
        # Capture model before parent init (may not expose `.model` attribute)
        model_name = kwargs.get("model")
        super().__init__(**kwargs)
        self._agent = agent

        # Prefer explicit model argument, then underlying client attributes, then default
        if model_name is None:
            model_name = getattr(self, "model_name", None) or getattr(self, "model", None)
        self._model_for_tokens = model_name or os.getenv("DEFAULT_LLM_MODEL", "gpt-5.1")

    async def ainvoke(self, messages, *args, **kwargs):
        """Call the underlying model and record prompt + completion tokens."""
        # If the associated WebSocket session has been closed, abort early to avoid
        # unnecessary LLM calls and token usage.
        session_id = _CURRENT_SESSION_ID.get()
        if session_id is not None:
            try:
                if self._agent.is_session_closed(session_id):
                    print(f"[DEBUG] Skipping LLM call for closed session {session_id}", flush=True)
                    raise asyncio.CancelledError(f"Session {session_id} is closed")
            except AttributeError:
                # RouterAgent may not implement is_session_closed in some contexts;
                # in that case, fail open and proceed with the call.
                pass

        # Flatten messages to text for token estimation
        parts: List[str] = []
        try:
            for m in messages or []:
                content = getattr(m, "content", "")
                if isinstance(content, str):
                    parts.append(content)
                elif isinstance(content, list):
                    for c in content:
                        if isinstance(c, dict) and "text" in c:
                            parts.append(str(c["text"]))
                        else:
                            parts.append(str(c))
                else:
                    parts.append(str(content))
        except Exception:
            # If anything goes wrong while flattening, fall back to empty prompt
            pass

        prompt_text = "\n".join(parts)
        prompt_tokens = self._agent.estimate_tokens(
            prompt_text, model_name=self._model_for_tokens
        )

        response = await super().ainvoke(messages, *args, **kwargs)

        try:
            response_content = getattr(response, "content", "")
            if not isinstance(response_content, str):
                response_content = str(response_content)
        except Exception:
            response_content = ""

        completion_tokens = self._agent.estimate_tokens(
            response_content, model_name=self._model_for_tokens
        )
        total_tokens = prompt_tokens + completion_tokens
        self._agent._record_llm_tokens(total_tokens)

        return response

# Import prompts
from prompts import get_initial_prompt, get_context_prompt, get_scf_config_prompt
# Emitters
try:
    # When running as a package (e.g., `graphlang_agent.agent` style)
    from .emitters.thought_emitter import (
        ThoughtEmitter, set_global_emitter,
        emit_thought, emit_workflow_thought, emit_data_thought, emit_error_thought, emit_llm_thought,
        emit_update_signal, emit_redirect_signal,
    )
    from .emitters.message_emitter import (
        MessageEmitter, set_global_message_emitter,
        emit_message, emit_status_update, emit_progress_update, emit_decision_message, emit_task_update,
    )
except ImportError:
    # When running as top-level modules (e.g., `python main.py`), use absolute imports
    from emitters.thought_emitter import (
        ThoughtEmitter, set_global_emitter,
        emit_thought, emit_workflow_thought, emit_data_thought, emit_error_thought, emit_llm_thought,
        emit_update_signal, emit_redirect_signal,
    )
    from emitters.message_emitter import (
        MessageEmitter, set_global_message_emitter,
        emit_message, emit_status_update, emit_progress_update, emit_decision_message, emit_task_update,
	    )

# Tools
try:
    from .tools.graph_crawl_tool import NativeCrawlTool
    from .tools.query_names_RAG_tool import RAGQueryNamesTool
    from .tools.query_code_RAG_tool import RAGQueryCodeTool
    from .tools.project_content_tool import (
        ProjectContentTool,
        TOOL_NAME_READ_DOCUMENT as READ_DOCUMENT_TOOL_NAME,
        TOOL_NAME_EVALUATE_PROJECT as EVALUATE_PROJECT_TOOL_NAME,
        TOOL_NAME_EVALUATE_DOCUMENT as EVALUATE_DOCUMENT_TOOL_NAME,
    )
    from .tools.project_task_tool import (
        ProjectTaskTool,
        TOOL_NAME_READ_PROJECT_TASKS,
        TOOL_NAME_CREATE_PROJECT_TASK,
    )
    from .tools.auditor_tool import AuditorTool
    from .tools.agent_tool import AgentTool
    from .tools.context_tool import (
        ContextTool,
        validate_update_context_args,
        apply_update_context,
        TOOL_NAME as UPDATE_CONTEXT_TOOL_NAME,
    )
    from .tools.scf_select_controls_tool import (
        TOOL_NAME as SCF_CONTROLS_TOOL_NAME,
        TOOL_NAME_SET_MIN_WEIGHT as SCF_SET_MIN_WEIGHT_TOOL_NAME,
        TOOL_NAME_RESET_FILTERS as SCF_RESET_FILTERS_TOOL_NAME,
        TOOL_NAME_ALL_DONE as SCF_ALL_DONE_TOOL_NAME,
        validate_args as validate_scf_controls_args,
        validate_min_weight_args as validate_scf_min_weight_args,
        validate_reset_filters_args as validate_scf_reset_filters_args,
        validate_all_done_args as validate_scf_all_done_args,
        apply_selection as apply_scf_controls_selection,
        apply_min_weight as apply_scf_min_weight,
        apply_reset_filters as apply_scf_reset_filters,
        apply_all_done as apply_scf_all_done,
    )
    from .tools.scf_tasks_tool import (
        TOOL_NAME as SCF_TASKS_TOOL_NAME,
        validate_args as validate_scf_tasks_args,
        apply_action as apply_scf_tasks_action,
    )
    from .tools.scf_coverage_tools import (
        TOOL_NAME_OVERLAP as SCF_COVERAGE_OVERLAP_TOOL_NAME,
        TOOL_NAME_RISKS_THREATS as SCF_RISKS_THREATS_TOOL_NAME,
        TOOL_NAME_LIST_RISKS as SCF_LIST_RISKS_TOOL_NAME,
        TOOL_NAME_LIST_THREATS as SCF_LIST_THREATS_TOOL_NAME,
        validate_overlap_args as validate_scf_coverage_overlap_args,
        validate_risks_threats_args as validate_scf_risks_threats_args,
        validate_list_risks_args as validate_scf_list_risks_args,
        validate_list_threats_args as validate_scf_list_threats_args,
        fetch_overlap_summary,
        fetch_all_risks,
        fetch_all_threats,
        fetch_risks_threats_summary,
    )
    from .tools.scf_timeline_tools import (
        TOOL_NAME_SET_TIMELINE_WINDOWS as SCF_SET_TIMELINE_WINDOWS_TOOL_NAME,
        TOOL_NAME_SET_TIMELINE_ORDER as SCF_SET_TIMELINE_ORDER_TOOL_NAME,
        TOOL_NAME_RESET_TIMELINE as SCF_RESET_TIMELINE_TOOL_NAME,
        validate_set_timeline_windows_args,
        apply_set_timeline_windows,
        validate_set_timeline_order_args,
        apply_set_timeline_order,
        validate_reset_timeline_args,
        apply_reset_timeline,
    )
except ImportError:
    # Fallback for top-level run (no package context)
    from tools.graph_crawl_tool import NativeCrawlTool
    from tools.query_names_RAG_tool import RAGQueryNamesTool
    from tools.query_code_RAG_tool import RAGQueryCodeTool
    from tools.project_content_tool import (
        ProjectContentTool,
        TOOL_NAME_READ_DOCUMENT as READ_DOCUMENT_TOOL_NAME,
        TOOL_NAME_EVALUATE_PROJECT as EVALUATE_PROJECT_TOOL_NAME,
        TOOL_NAME_EVALUATE_DOCUMENT as EVALUATE_DOCUMENT_TOOL_NAME,
    )
    from tools.project_task_tool import (
        ProjectTaskTool,
        TOOL_NAME_READ_PROJECT_TASKS,
        TOOL_NAME_CREATE_PROJECT_TASK,
    )
    from tools.auditor_tool import AuditorTool
    from tools.agent_tool import AgentTool
    from tools.context_tool import (
        ContextTool,
        validate_update_context_args,
        apply_update_context,
        TOOL_NAME as UPDATE_CONTEXT_TOOL_NAME,
    )
    from tools.scf_select_controls_tool import (
        TOOL_NAME as SCF_CONTROLS_TOOL_NAME,
        TOOL_NAME_SET_MIN_WEIGHT as SCF_SET_MIN_WEIGHT_TOOL_NAME,
        TOOL_NAME_RESET_FILTERS as SCF_RESET_FILTERS_TOOL_NAME,
        TOOL_NAME_ALL_DONE as SCF_ALL_DONE_TOOL_NAME,
        validate_args as validate_scf_controls_args,
        validate_min_weight_args as validate_scf_min_weight_args,
        validate_reset_filters_args as validate_scf_reset_filters_args,
        validate_all_done_args as validate_scf_all_done_args,
        apply_selection as apply_scf_controls_selection,
        apply_min_weight as apply_scf_min_weight,
        apply_reset_filters as apply_scf_reset_filters,
        apply_all_done as apply_scf_all_done,
    )
    from tools.scf_tasks_tool import (
        TOOL_NAME as SCF_TASKS_TOOL_NAME,
        validate_args as validate_scf_tasks_args,
        apply_action as apply_scf_tasks_action,
    )
    from tools.scf_coverage_tools import (
        TOOL_NAME_OVERLAP as SCF_COVERAGE_OVERLAP_TOOL_NAME,
        TOOL_NAME_RISKS_THREATS as SCF_RISKS_THREATS_TOOL_NAME,
        TOOL_NAME_LIST_RISKS as SCF_LIST_RISKS_TOOL_NAME,
        TOOL_NAME_LIST_THREATS as SCF_LIST_THREATS_TOOL_NAME,
        validate_overlap_args as validate_scf_coverage_overlap_args,
        validate_risks_threats_args as validate_scf_risks_threats_args,
        validate_list_risks_args as validate_scf_list_risks_args,
        validate_list_threats_args as validate_scf_list_threats_args,
        fetch_overlap_summary,
        fetch_all_risks,
        fetch_all_threats,
        fetch_risks_threats_summary,
    )
    from tools.scf_timeline_tools import (
        TOOL_NAME_SET_TIMELINE_WINDOWS as SCF_SET_TIMELINE_WINDOWS_TOOL_NAME,
        TOOL_NAME_SET_TIMELINE_ORDER as SCF_SET_TIMELINE_ORDER_TOOL_NAME,
        TOOL_NAME_RESET_TIMELINE as SCF_RESET_TIMELINE_TOOL_NAME,
        validate_set_timeline_windows_args,
        apply_set_timeline_windows,
        validate_set_timeline_order_args,
        apply_set_timeline_order,
        validate_reset_timeline_args,
        apply_reset_timeline,
    )

# Optional Neo4j import with graceful fallback
try:
    from neo4j import GraphDatabase
    NEO4J_AVAILABLE = True
except ImportError:
    print("⚠️ Neo4j driver not available. Native crawl functionality will be disabled.")
    GraphDatabase = None
    NEO4J_AVAILABLE = False


# Internal sentinel used to trigger auto-start of SCF redirect sessions
AUTO_SCF_TRIGGER = "__SCF_REDIRECT_AUTO_START__"


# Enhanced state for router-based agent with credit tracking and compliance analysis
class AgentState(TypedDict):
    messages: Annotated[List[Any], add]
    session_id: str
    context: Dict[str, Any]
    entry_point: str  # Where chat was opened from (onboarding, project_view, dashboard, etc.)
    intent: str  # Router decision
    routing_confidence: float  # Classification confidence
    tokens_used: int  # Token usage tracking
    credits_consumed: float  # Credits consumed this session

    # Observability: per-turn tracking identifier (not persisted in checkpoints)
    turn_id: Optional[str]

    # User profile fields (updated via update_context tool)
    user_title: Optional[str]  # User's job title (e.g., "CTO", "Founder")
    user_role: Optional[str]  # User's role in organization
    user_knowledge: Optional[str]  # User's compliance knowledge level

    # Organization profile fields (updated via update_context tool)
    org_what: Optional[str]  # What the organization does
    org_size: Optional[str]  # Organization size (e.g., "10-50", "50-200")
    org_industry: Optional[str]  # Industry (e.g., "healthcare", "fintech")
    org_location: Optional[str]  # Geographic location
    org_goals: Optional[str]  # Organization's compliance goals
    org_security_frameworks: Optional[str]  # Active/wanted security frameworks
    org_relevant_laws: Optional[str]  # Regulations they need to follow
    past_issues: Optional[str]  # Past issues or problems, be as wordy as needed
    previous_work: Optional[str]  # Previous compliance/security work, be as wordy as needed

    # Project context fields
    project_info: Optional[Dict[str, Any]]  # Project metadata (name, status, compliance_score)
    documentation_structure: Optional[Dict[str, Any]]  # Documentation pages structure (no content)
    policy_names: Optional[List[Dict[str, Any]]]  # Policy names and metadata (no content)
    fetched_documentation_pages: Optional[Dict[str, str]]  # Cache: page_id → content
    fetched_policies: Optional[Dict[str, str]]  # Cache: policy_id → content

    # Iterative task-driven evaluation pipeline
    original_question: Optional[str]  # Store user's original question
    current_task_number: Optional[int]  # Current task being executed (1-4)
    max_tasks: Optional[int]  # Maximum tasks allowed (default 4)
    can_answer_question: Optional[bool]  # Whether we can answer with current findings
    accumulated_findings: Optional[List[Dict[str, Any]]]  # All task results so far
    current_task: Optional[Dict[str, Any]]  # Current task being executed

    # Comprehensive trace system for tool call information
    tool_call_traces: Optional[List[Dict[str, Any]]]  # Trace of all relevant information found
    current_task_traces: Optional[List[Dict[str, Any]]]  # Traces for current task only

    # Transient routing flags for tool/workflow calls
    has_tool_call: Optional[bool]
    requested_tool: Optional[List[str]]
    requested_tools: Optional[List[List[str]]]
    has_workflow: Optional[bool]
    requested_workflow: Optional[List[str]]
    tool_should_loopback: Optional[bool]  # Whether tool should loop back to LLM_chat (default: True)

    # Legacy fields (kept for backward compatibility during transition)
    plan_created: Optional[bool]  # Removed: awaiting_codebase_selection, selected_codebases, detailed_codebase_context

# Removed codebase context functions - now using project-based context instead
# Previously: get_lightweight_codebase_context(), get_detailed_codebase_context(), format_detailed_codebase_options()

class RouterAgent:
    """Router-based LangGraph agent with intelligent routing and credit tracking"""

    def __init__(self):
        self.sessions: Dict[str, Dict[str, Any]] = {}

        # Track sessions whose WebSocket connections have been closed. This lets
        # us abort in-flight LLM calls when a client disconnects.
        self.closed_sessions = set()

        # Concurrency safety: per-session locks
        self.session_locks = defaultdict(asyncio.Lock)

        # Per-turn token accounting (keyed by session_id)
        self._turn_tokens: Dict[str, int] = {}

        # Initialize OpenAI clients
        self.router_client = ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0.1,
            api_key=os.getenv("OPENAI_KEY"),
        )

        base_llm_model = os.getenv("DEFAULT_LLM_MODEL", "gpt-5.1")
        self.llm_client = MeteredChatOpenAI(
            agent=self,
            model=base_llm_model,
            temperature=0.5,
            api_key=os.getenv("OPENAI_KEY"),
        )

        # Initialize tools
        self.native_crawl_tool = NativeCrawlTool(self.llm_client)
        self.rag_names_tool = RAGQueryNamesTool(self.llm_client)
        self.rag_code_tool = RAGQueryCodeTool(self.llm_client)
        self.project_content_tool = ProjectContentTool(
            backend_url=os.getenv("BACKEND_API_URL", "http://app:8080"),
            llm_client=self.llm_client,
        )
        self.project_task_tool = ProjectTaskTool(
            backend_url=os.getenv("BACKEND_API_URL", "http://app:8080"),
            llm_client=self.llm_client,
        )
        self.auditor_tool = AuditorTool(
            backend_url=os.getenv("BACKEND_API_URL", "http://app:8080"),
            llm_client=self.llm_client,
        )
        self.agent_tool = AgentTool(
            backend_url=os.getenv("BACKEND_API_URL", "http://app:8080"),
            llm_client=self.llm_client,
        )
        self.context_tool = ContextTool(llm_client=self.llm_client)

        # Token encoders for accurate token counting (per model)
        self._encoders: Dict[str, Any] = {}
        # Default encoder aligned with the main LLM model (GPT-5.1 or configured DEFAULT_LLM_MODEL)
        try:
            self._encoders[base_llm_model] = tiktoken.encoding_for_model(base_llm_model)
        except Exception:
            # Fallback to a generic encoding if the specific model isn't known.
            self._encoders[base_llm_model] = tiktoken.get_encoding("cl100k_base")

        # Configuration
        self.memory_window_size = int(os.getenv("MEMORY_WINDOW_SIZE", "15"))
        self.max_tokens_per_request = 6000  # Conservative safety limit for GPT-5.1
        self.tokens_per_credit = 1000  # 1000 tokens = 1 credit

        # Backend API configuration
        self.backend_api_url = os.getenv("BACKEND_API_URL", "http://app:8080")
        # IMPORTANT: INTERNAL_API_KEY should ONLY be used for the
        # /api/v1/org/{org_id}/credits/subtract endpoint. All other endpoints
        # must continue to use the user's JWT from the frontend.
        self.internal_api_key = os.getenv("INTERNAL_API_KEY")

        # Redis session persistence (client is injected from main.py)
        self.redis_client: Optional[Redis] = None
        # 35 minutes default TTL; can be overridden via env if needed
        self.redis_ttl_seconds = int(os.getenv("REDIS_SESSION_TTL_SECONDS", "2100"))

        # Thought emission system
        self.thought_emitter = None  # Will be set when WebSocket is available

        self.workflow = None

    async def startup(self):
        print("Starting up router agent...", flush=True)
        # Build once
        if self.workflow is None:
            self.workflow = self._build_graph()

        # Open async SQLite saver for the app lifetime
        self._saver_cm = AsyncSqliteSaver.from_conn_string(
            "file:graph_checkpoints.sqlite?mode=rwc"
        )
        checkpointer = await self._saver_cm.__aenter__()

        # Compile graph with the opened checkpointer and increased recursion limit
        # Default is 25, we increase to 100 to handle complex multi-step workflows
        self.graph = self.workflow.compile(checkpointer=checkpointer)
        self.recursion_limit = int(os.getenv("GRAPH_RECURSION_LIMIT", "100"))

    async def shutdown(self):
        if self._saver_cm:
            await self._saver_cm.__aexit__(None, None, None)
            self._saver_cm = None

    def _to_text(self, c):
        if isinstance(c, str):
            return c
        if isinstance(c, list):
            # e.g., [{"type":"text","text":"..."}]
            return " ".join(p.get("text", "") for p in c if isinstance(p, dict))
        return str(c)

    def _log_structured(self, kind: str, **fields: Any) -> None:
        """Emit a single-line, JSON-encoded log for observability."""
        # Attach session/turn identifiers if available and not explicitly provided
        if "session_id" not in fields:
            sid = _CURRENT_SESSION_ID.get()
            if sid is not None:
                fields["session_id"] = sid
        if "turn_id" not in fields:
            tid = _CURRENT_TURN_ID.get()
            if tid is not None:
                fields["turn_id"] = tid
        try:
            payload = json.dumps(fields, ensure_ascii=False, default=str)
        except Exception:
            payload = str(fields)
        print(f"[{kind}] {payload}", flush=True)

    def _log_scf_task_change(
        self,
        session_id: Optional[str],
        action: Optional[str],
        payload: Dict[str, Any],
        old_tasks: List[Dict[str, Any]],
        new_tasks: List[Dict[str, Any]],
    ) -> None:
        """Log a structured TASK event when SCF tasks change."""
        task_id = payload.get("task_id")
        event: Dict[str, Any] = {
            "session_id": session_id,
            "turn_id": _CURRENT_TURN_ID.get(),
            "action": action,
        }
        if action == "create_task":
            old_ids = {str(t.get("id")) for t in old_tasks}
            created = [t for t in new_tasks if str(t.get("id")) not in old_ids]
            if created:
                t = created[0]
                event.update(
                    {
                        "task_id": t.get("id"),
                        "title": t.get("title"),
                        "status": t.get("status"),
                    }
                )
        elif task_id:
            event["task_id"] = task_id
            old = next((t for t in old_tasks if str(t.get("id")) == str(task_id)), None)
            new = next((t for t in new_tasks if str(t.get("id")) == str(task_id)), None)
            if old is not None:
                event["old_status"] = old.get("status")
                event["old_attempts"] = old.get("attempts")
            if new is not None:
                event["new_status"] = new.get("status")
                event["new_attempts"] = new.get("attempts")

        self._log_structured("TASK", **event)


    # MESSAGE AND SESSION MANAGEMENT #
    async def process_message(self, message: str, session_id: str) -> Optional[str]:
        """Process a message; returns None if an interrupt was emitted."""
        print(f"Processing message: {message} for session {session_id}", flush=True)

        # Generate a per-turn tracking id for observability
        turn_id = f"t-{int(time.time() * 1000):x}"
        entry_point_for_turn: str = ""
        pending_interrupt_before: bool = False

        # ---- Decide path under lock (don't stream while holding the lock) ----
        async with self.session_locks[session_id]:
            # Reset per-turn token counter at the start of each message
            self._turn_tokens[session_id] = 0

            if session_id not in self.sessions:
                return "Session not initialized. Please refresh your connection."

            session = self.sessions[session_id]

            # If the WebSocket for this session has been closed, do not start new work.
            if self.is_session_closed(session_id):
                print(f"[DEBUG] Skipping message processing for closed session {session_id}", flush=True)
                return None

            # If we're paused, treat this chat as the answer and resume
            if session.get("pending_interrupt"):
                resume_value = message
                # release lock before streaming
                pass_state = None
                pending_interrupt_before = True
                entry_point_for_turn = (session.get("context") or {}).get("entry_point", "project_view")
                print("leg start (resume)", flush=True)
                print(
                    f"resume flags before clear: pending_interrupt={session.get('pending_interrupt')}, awaiting={session.get('awaiting_codebase_selection')}, selected_len={len(session.get('selected_codebases') or [])}",
                    flush=True,
                )

                session["pending_interrupt"] = False
                print(f"resume flags after clear: pending_interrupt={session.get('pending_interrupt')}", flush=True)

            else:
                context = session.get("context", {})
                entry_point_for_turn = context.get("entry_point", "project_view")
                pass_state = AgentState(
                    # Only send the new user message into the graph; the checkpointer will
                    # merge it with prior messages. Full history is still kept in self.sessions.
                    messages = [HumanMessage(content=message)],
                    session_id = session_id,
                    context = context,
                    entry_point = entry_point_for_turn,
                    turn_id = turn_id,
                    # User profile fields
                    user_title = context.get("user_title", ""),
                    user_role = context.get("user_role", ""),
                    user_knowledge = context.get("user_knowledge", ""),
                    # Organization profile fields
                    org_what = context.get("org_what", ""),
                    org_size = context.get("org_size", ""),
                    org_industry = context.get("org_industry", ""),
                    org_location = context.get("org_location", ""),
                    org_goals = context.get("org_goals", ""),
                    past_issues = context.get("past_issues", ""),
                    previous_work = context.get("previous_work", ""),
                    org_security_frameworks = context.get("org_security_frameworks", ""),
                    org_relevant_laws = context.get("org_relevant_laws", ""),
                    # Other fields
                    intent = "",
                    routing_confidence = 0.0,
                    tokens_used = session.get("tokens_used", 0),
                    credits_consumed = session.get("credits_consumed", 0.0),
                    awaiting_codebase_selection = session.get("awaiting_codebase_selection", False),
                    selected_codebases = session.get("selected_codebases", []),
                    plan_created = session.get("plan_created", False),
                    focused_tasks = session.get("focused_tasks", []),
                    detailed_codebase_context = session.get("detailed_codebase_context", {}),
                    original_question = session.get("original_question", ""),
                    current_task = session.get("current_task", {}),
                    current_task_number = session.get("current_task_number", 1),
                    accumulated_findings = session.get("accumulated_findings", []),
                    can_answer_question = session.get("can_answer_question", False),
                    tool_call_traces = session.get("tool_call_traces", []),
                    current_task_traces = session.get("current_task_traces", []),
                )
                print(f"leg start (normal): prior={len(session['messages'])}, pass={len(pass_state['messages'])}", flush=True)

                print(f"pre-classify flags: awaiting={session.get('awaiting_codebase_selection')}, selected_len={len(session.get('selected_codebases') or [])}, plan_created={session.get('plan_created')}, focused_tasks_len={len(session.get('focused_tasks') or [])}", flush=True)

                resume_value = None

        # Structured turn-start log for observability
        self._log_structured(
            "TURN",
            stage="start",
            session_id=session_id,
            turn_id=turn_id,
            entry_point=entry_point_for_turn or "project_view",
            mode="resume" if resume_value is not None else "normal",
            user_message_preview=message[:120],
            pending_interrupt_before=pending_interrupt_before,
        )


        # ---- Stream (outside the lock) ----
        config = {
            "configurable": {"thread_id": session_id},
            "recursion_limit": self.recursion_limit
        }
        last_ai: Optional[str] = None

        if resume_value is not None:
            stream_input = Command(resume=resume_value)
            print(f"Resuming with value: {resume_value}\n", flush=True)
        else:
            stream_input = pass_state
            # Commented out: print(f"Passing state: {pass_state}\n", flush=True)
            # Instead, print only key info
            last_user_msg = pass_state["messages"][-1].content if pass_state["messages"] else "No message"
            print(f"\n{'='*60}", flush=True)
            print(f"📨 Last User Message: {last_user_msg[:100]}...", flush=True)
            print(f"{'='*60}\n", flush=True)

        suppress_non_loopback = False
        turn_credits: float = 0.0
        ctx_for_credits: Dict[str, Any] = {}

        # Associate this turn's async LLM calls with this session for token metering.
        ctx_token = _CURRENT_SESSION_ID.set(session_id)
        turn_token = _CURRENT_TURN_ID.set(turn_id)
        try:
            async for event in self.graph.astream(stream_input, config=config, stream_mode="updates"):
                # Interrupt → ask client and stop
                if "__interrupt__" in event:
                    payload = event["__interrupt__"][0].value
                    print(f"interrupt emitted: type={payload.get('type')}, setting pending_interrupt=True", flush=True)
                    await emit_decision_message(json.dumps({
                        "type": payload.get("type", "ask"),
                        "payload": payload,
                        "session_id": session_id
                    }))
                    async with self.session_locks[session_id]:
                        self.sessions[session_id]["pending_interrupt"] = True

                    # Ensure we clear the session context var when interrupting
                    _CURRENT_SESSION_ID.reset(ctx_token)
                    return None

                # Per-node updates (e.g., {"llm_answer": {...}})
                for node_name, node_update in event.items():
                    if node_name == "__interrupt__":
                        continue
                    if isinstance(node_update, dict):
                        # Detect non-loopback tool execution to suppress outgoing user message
                        if node_name == "tool_call" and node_update.get("tool_should_loopback") is False:
                            suppress_non_loopback = True
                        if "messages" in node_update:
                            # Log all new messages emitted by this node for observability
                            msgs = node_update["messages"] or []
                            for m in msgs:
                                role = "unknown"
                                content_text = ""
                                if isinstance(m, AIMessage):
                                    role = "ai"
                                    content_text = self._to_text(m.content)
                                elif isinstance(m, HumanMessage):
                                    role = "human"
                                    content_text = self._to_text(m.content)
                                elif isinstance(m, SystemMessage):
                                    role = "system"
                                    content_text = self._to_text(m.content)
                                else:
                                    content_text = str(getattr(m, "content", m))

                                self._log_structured(
                                    "MSG",
                                    source_node=node_name,
                                    role=role,
                                    preview=(content_text or "")[:200],
                                )

                            # Only capture AI messages if there are actually messages to capture
                            # Skip if tool_call returns empty messages (tool_should_loopback=False)
                            if msgs:
                                for m in reversed(msgs):
                                    if isinstance(m, AIMessage) and m.content:
                                        last_ai = self._to_text(m.content)
                                        break
                            elif node_name == "tool_call":
                                # Tool returned empty messages - clear last_ai so we don't send the previous response
                                last_ai = None

        except GraphRecursionError as e:
            # Handle recursion limit gracefully
            error_message = f"""⚠️ **Recursion Limit Reached**

I've hit the maximum number of processing steps ({self.recursion_limit}) for this conversation. This usually happens when:

1. **Complex multi-step workflows** - The task required too many sequential operations
2. **Circular logic** - The agent got stuck in a loop trying to solve the problem
3. **Insufficient information** - Unable to complete the task with available data

**What you can do:**
- Try breaking down your request into smaller, more specific tasks
- Provide more specific instructions or constraints
- Restart the conversation with a fresh session

**Technical details:** {str(e)}"""

            print(f"❌ GraphRecursionError: {e}", flush=True)
            self._log_structured(
                "TURN",
                stage="error",
                error_type="GraphRecursionError",
                message=str(e),
            )

            try:
                await emit_error_thought(error_message, "recursion_limit")
            except Exception:
                pass

            # Ensure we always clear the session/turn context vars on recursion errors
            _CURRENT_SESSION_ID.reset(ctx_token)
            _CURRENT_TURN_ID.reset(turn_token)
            return error_message

        except asyncio.CancelledError:
            # Session was closed while this turn was in progress; skip any further work.
            print(f"[DEBUG] Graph execution cancelled for session {session_id} (likely due to closed WebSocket)", flush=True)
            self._log_structured(
                "TURN",
                stage="cancelled",
                message="Graph execution cancelled (likely due to closed WebSocket)",
            )
            _CURRENT_SESSION_ID.reset(ctx_token)
            _CURRENT_TURN_ID.reset(turn_token)
            return None

        # ---- Backfill from persisted snapshot (in case last_ai wasn't in-stream) ----
        snap = await self.graph.aget_state(config=config)
        vals = snap.values or {}

        # If stream didn't surface the non-loopback flag, infer from final state
        if not suppress_non_loopback and vals.get("tool_should_loopback") is False:
            suppress_non_loopback = True

        # If a non-loopback tool executed in this leg, suppress user-visible response
        if suppress_non_loopback:
            last_ai = None
        else:
            if last_ai is None:
                for m in reversed(vals.get("messages", [])):
                    if isinstance(m, AIMessage) and m.content:
                        last_ai = self._to_text(m.content)
                        break

            # Fallback: for non-suppressed legs, always return at least an empty
            # string so the caller can emit a "response" message, even if no
            # AIMessage was captured in the graph state for this turn.
            if last_ai is None:
                last_ai = ""

        # Structured log of the final response for this turn
        self._log_structured(
            "TURN",
            stage="final_response",
            response_preview=(last_ai or "")[:200],
            suppressed=suppress_non_loopback,
        )

        # Print response in clean format
        print(f"\n{'='*60}", flush=True)
        print(f"🤖 Agent Response: {last_ai[:150] if last_ai else 'No response'}...", flush=True)
        print(f"{'='*60}\n", flush=True)

        # ---- Update session from snapshot under lock ----
        async with self.session_locks[session_id]:
            s = self.sessions[session_id]
            s["messages"] = vals.get("messages", s.get("messages", []))
            ctx = vals.get("context", s.get("context", {}))
            # One-shot flag: ensure SCF redirect instructions are only applied
            # for the very first SCF welcome message.
            if ctx.get("entry_point") == "scf_config" and ctx.get("scf_redirected"):
                ctx["scf_redirected"] = False
            s["context"] = ctx
            s["awaiting_codebase_selection"] = vals.get(
                "awaiting_codebase_selection",
                s.get("awaiting_codebase_selection", False),
            )
            s["selected_codebases"] = vals.get(
                "selected_codebases",
                s.get("selected_codebases", []),
            )
            s["plan_created"] = vals.get("plan_created", s.get("plan_created", False))
            s["focused_tasks"] = vals.get("focused_tasks", s.get("focused_tasks", []))
            s["detailed_codebase_context"] = vals.get(
                "detailed_codebase_context",
                s.get("detailed_codebase_context", {}),
            )
            s["original_question"] = vals.get(
                "original_question",
                s.get("original_question", ""),
            )
            s["current_task"] = vals.get("current_task", s.get("current_task", {}))
            s["current_task_number"] = vals.get(
                "current_task_number",
                s.get("current_task_number", 1),
            )
            s["accumulated_findings"] = vals.get(
                "accumulated_findings",
                s.get("accumulated_findings", []),
            )
            s["can_answer_question"] = vals.get(
                "can_answer_question",
                s.get("can_answer_question", False),
            )
            s["tool_call_traces"] = vals.get(
                "tool_call_traces",
                s.get("tool_call_traces", []),
            )
            s["current_task_traces"] = vals.get(
                "current_task_traces",
                s.get("current_task_traces", []),
            )
            s["pending_interrupt"] = False

            # Apply token/credit accounting for this turn from metered client
            turn_tokens = self._turn_tokens.get(session_id, 0)
            if turn_tokens:
                turn_credits = self.calculate_credits_consumed(turn_tokens)
                s["tokens_used"] = s.get("tokens_used", 0) + turn_tokens
                s["credits_consumed"] = s.get("credits_consumed", 0.0) + turn_credits
            else:
                turn_credits = 0.0

            ctx_for_credits = ctx
            # Reset turn tokens after accounting
            self._turn_tokens[session_id] = 0

            print(
                f"leg end: snap messages={len(vals.get('messages', []))}",
                flush=True,
            )
            print(
                f"leg end flags: awaiting={s.get('awaiting_codebase_selection')}, selected_len={len(s.get('selected_codebases') or [])}, pending_interrupt={s.get('pending_interrupt')}",
                flush=True,
            )

        _CURRENT_SESSION_ID.reset(ctx_token)
        _CURRENT_TURN_ID.reset(turn_token)

        # Structured turn-end log for observability
        self._log_structured(
            "TURN",
            stage="end",
            session_id=session_id,
            turn_id=turn_id,
            suppress_non_loopback=suppress_non_loopback,
            last_ai_preview=(last_ai or "")[:150],
        )

        if turn_credits > 0 and ctx_for_credits:
            await self.update_user_credits(ctx_for_credits, turn_credits, session_id)

        return None if suppress_non_loopback else last_ai


    async def auto_start_scf_session(self, session_id: str) -> Optional[str]:
        """Trigger an automatic LLM turn for a session (used for SCF redirects).

        This uses an internal sentinel message so the normal routing pipeline
        can run unchanged while the LLM prompt logic ignores the sentinel.
        """
        return await self.process_message(AUTO_SCF_TRIGGER, session_id)

    def _get_encoder(self, model_name: Optional[str] = None):
        """Return a tiktoken encoder for the given model (or default main model)."""
        if not model_name:
            model_name = getattr(self.llm_client, "model", os.getenv("DEFAULT_LLM_MODEL", "gpt-5.1"))
        encoder = self._encoders.get(model_name)
        if encoder is None:
            try:
                encoder = tiktoken.encoding_for_model(model_name)
            except Exception:
                encoder = tiktoken.get_encoding("cl100k_base")
            self._encoders[model_name] = encoder
        return encoder

    def estimate_tokens(self, text: str, model_name: Optional[str] = None) -> int:
        """Accurately estimate token count using tiktoken for the specified model."""
        if not text:
            return 0
        try:
            encoder = self._get_encoder(model_name)
            return len(encoder.encode(text))
        except Exception:
            # Fallback to character-based estimation
            return len(text) // 4

    def _record_llm_tokens(self, tokens_used: int) -> None:
        """Record tokens used for the current session/turn for credit accounting."""
        if tokens_used <= 0:
            return
        session_id = _CURRENT_SESSION_ID.get()
        if not session_id:
            return
        previous = self._turn_tokens.get(session_id, 0)
        self._turn_tokens[session_id] = previous + tokens_used

    def manage_conversation_context(self, messages: List[Any]) -> List[Any]:
        """Manage conversation length using sliding window"""
        if len(messages) <= self.memory_window_size:
            return messages

        # Keep system messages and recent messages within window
        system_messages = [msg for msg in messages if getattr(msg, 'type', None) == 'system']
        recent_messages = messages[-self.memory_window_size:]

        # Combine, avoiding duplicates
        managed_messages = system_messages + [msg for msg in recent_messages if msg not in system_messages]
        return managed_messages

    def format_managed_messages_for_prompt(self, messages: List[Any]) -> str:
        """Format managed_messages into a readable, ordered text block for the LLM.

        The goal is to make it very clear which messages are from the user vs the
        assistant vs system, while preserving chronological order.
        """
        if not messages:
            return "(no prior messages)"

        lines: List[str] = []
        for i, msg in enumerate(messages, 1):
            raw_type = getattr(msg, "type", "").lower()
            if raw_type in ("human", "user"):
                role = "USER"
            elif raw_type in ("ai", "assistant"):
                role = "ASSISTANT"
            elif raw_type == "system":
                role = "SYSTEM"
            else:
                role = raw_type.upper() or msg.__class__.__name__.upper()

            content = getattr(msg, "content", "")
            if not isinstance(content, str):
                try:
                    content = str(content)
                except Exception:
                    content = ""

            lines.append(f"{i:02d}. [{role}] {content}")

        return "Message History (oldest → newest):\n" + "\n".join(lines)

    def get_managed_history_for_session(self, session_id: str) -> List[Dict[str, Any]]:
        """Return the same managed messages used in the context prompt, serialized
        for the frontend.

        This is read-only and does not mutate any session or graph state. It is
        intended to be called once on session initialization so the frontend can
        pre-populate the chat UI with exactly the messages that would appear in
        the LLM's `managed_messages` history block.
        """
        session = self.sessions.get(session_id)
        if not session:
            return []

        full_messages = session.get("messages", []) or []

        # Mirror the filtering in LLM_chat where we exclude the AUTO_SCF_TRIGGER
        # sentinel from the history that is shown to the model.
        filtered = [
            m
            for m in full_messages
            if not (
                hasattr(m, "content")
                and getattr(m, "content", None) == AUTO_SCF_TRIGGER
            )
        ]

        managed = self.manage_conversation_context(filtered)

        history: List[Dict[str, Any]] = []
        for msg in managed:
            raw_type = (getattr(msg, "type", None) or msg.__class__.__name__).lower()
            if raw_type in ("human", "user"):
                role = "user"
            elif raw_type in ("ai", "assistant"):
                role = "assistant"
            elif raw_type == "system":
                role = "system"
            else:
                # Default to system for unknown/other message types.
                role = "system"

            content = getattr(msg, "content", "")
            if not isinstance(content, str):
                try:
                    content = str(content)
                except Exception:
                    content = ""

            history.append({"role": role, "content": content})

        return history

    def _serialize_message(self, msg: Any) -> Dict[str, Any]:
        """Convert a LangChain message into a JSON-serializable dict for snapshots."""
        msg_type = getattr(msg, "type", None) or msg.__class__.__name__.lower()
        content = getattr(msg, "content", "")
        return {
            "type": msg_type,
            "content": content,
        }

    def _deserialize_message(self, data: Dict[str, Any]) -> Any:
        """Reconstruct a LangChain message from a snapshot dict."""
        if not isinstance(data, dict):
            return data

        msg_type = (data.get("type") or "").lower()
        content = data.get("content", "")

        if msg_type in ("human", "user"):
            return HumanMessage(content=content)
        if msg_type in ("ai", "assistant"):
            return AIMessage(content=content)
        if msg_type == "system":
            return SystemMessage(content=content)

        # Fallback: default to human-style message for unknown types
        return HumanMessage(content=content)


    def calculate_credits_consumed(self, tokens_used: int) -> float:
        """Convert tokens to credits (1000 tokens = 1 credit)."""
        return tokens_used / self.tokens_per_credit

    async def update_user_credits(
        self,
        session_context: Dict[str, Any],
        credits_consumed: float,
        session_id: Optional[str] = None,
    ) -> None:
        """Update user credits in backend using INTERNAL_API_KEY and subtract endpoint.

        IMPORTANT: This method must be the *only* place where INTERNAL_API_KEY is
        used to call the backend. All other endpoints must continue to use the
        user's JWT provided by the frontend.
        """
        try:
            if not self.internal_api_key:
                print("[CREDITS] INTERNAL_API_KEY not configured; skipping credit update", flush=True)
                return

            org_id = session_context.get("org_id")
            if not org_id:
                print("[CREDITS] No org_id in session context; skipping credit update", flush=True)
                return

            # Backend expects an integer `credits` field (min=1). We convert our
            # fractional credits to an int here. Using ceil ensures we never
            # under-charge relative to the computed usage.
            credits_float = max(credits_consumed, 0.0)
            credits_to_subtract = int(math.ceil(credits_float))
            if credits_to_subtract <= 0:
                return

            url = f"{self.backend_api_url}/api/v1/org/{org_id}/credits/subtract"
            headers = {
                # IMPORTANT: This internal key must not be used for any other endpoint.
                "Authorization": f"Bearer {self.internal_api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                # NOTE: Endpoint requires an integer `credits` field.
                "credits": credits_to_subtract,
                "session_id": session_id,
            }
            response = requests.patch(url, headers=headers, json=payload, timeout=10)
            if response.status_code >= 400:
                print(
                    f"[CREDITS] Failed to subtract credits (status={response.status_code}): {response.text}",
                    flush=True,
                )
            else:
                print(
                    f"[CREDITS] Subtracted {credits_to_subtract} credits for org {org_id} (session={session_id}); raw={credits_consumed}",
                    flush=True,
                )
        except Exception as e:
            print(f"[CREDITS] Error updating credits: {e}", flush=True)


    def _build_chat_memory(self, messages: List[Any], context: Dict[str, Any]) -> Optional[str]:
        """Build chat memory JSON string from the last N messages.

        Returns a JSON string or None if there is nothing to persist.
        """
        try:
            if not messages:
                return None

            # Persist only a bounded window of recent messages to keep payload small.
            window_size = 15
            recent_messages = messages[-window_size:] if len(messages) > window_size else messages

            last_messages: List[str] = []
            for msg in recent_messages:
                msg_type = getattr(msg, "type", "") or msg.__class__.__name__
                msg_type_lower = str(msg_type).lower()

                if msg_type_lower in ("human", "user"):
                    role = "USER"
                elif msg_type_lower in ("ai", "assistant"):
                    role = "ASSISTANT"
                elif msg_type_lower == "system":
                    role = "SYSTEM"
                else:
                    role = str(msg_type).upper() if msg_type else "UNKNOWN"

                content = getattr(msg, "content", "")
                if not isinstance(content, str):
                    try:
                        content = str(content)
                    except Exception:
                        content = ""

                # Truncate long messages so we don't blow up the chat_memory field.
                if len(content) > 500:
                    content = content[:497] + "..."

                last_messages.append(f"[{role}] {content}")

            memory_obj = {
                "summary": "",  # Empty for now; can add an LLM-generated summary later.
                "last_messages": last_messages,
                "current_tasks": [],  # Empty for now; can be populated later if needed.
            }
            return json.dumps(memory_obj, ensure_ascii=False)
        except Exception as e:
            print(f"[CHAT_MEMORY] Failed to build chat memory: {e}", flush=True)
            return None

    async def save_chat_memory_from_session(self, session_id: str) -> None:
        """Best-effort: persist chat_memory for a session on WebSocket close."""
        try:
            if session_id not in self.sessions:
                return

            # Take a snapshot of messages/context under the session lock, then perform
            # network I/O without holding the lock.
            async with self.session_locks[session_id]:
                session = self.sessions.get(session_id)
                if not session:
                    return

                context = session.get("context") or {}
                jwt_token = context.get("jwt_token")
                messages = session.get("messages", [])

            if not jwt_token:
                print("[CHAT_MEMORY] No jwt_token in session context; skipping save", flush=True)
                return

            chat_memory_str = self._build_chat_memory(messages, context)
            if not chat_memory_str:
                return

            url = f"{self.backend_api_url}/api/v1/users/me/chat-memory"
            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json",
            }
            payload = {"chat_memory": chat_memory_str}

            response = requests.patch(url, headers=headers, json=payload, timeout=10)
            if response.status_code >= 400:
                print(
                    f"[CHAT_MEMORY] Failed to update chat_memory (status={response.status_code}): {response.text}",
                    flush=True,
                )
            else:
                print("[CHAT_MEMORY] Updated chat_memory for user via /users/me/chat-memory", flush=True)
        except Exception as e:
            print(f"[CHAT_MEMORY] Error saving chat memory from session: {e}", flush=True)

    async def save_chat_memory_from_state(self, state: AgentState) -> None:
        """Best-effort: persist chat_memory for the user from an AgentState snapshot."""
        try:
            context = state.get("context") or {}
            jwt_token = context.get("jwt_token")
            if not jwt_token:
                print("[CHAT_MEMORY] No jwt_token in state context; skipping save", flush=True)
                return

            messages = state.get("messages", [])
            chat_memory_str = self._build_chat_memory(messages, context)
            if not chat_memory_str:
                return

            url = f"{self.backend_api_url}/api/v1/users/me/chat-memory"
            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json",
            }
            payload = {"chat_memory": chat_memory_str}

            response = requests.patch(url, headers=headers, json=payload, timeout=10)
            if response.status_code >= 400:
                print(
                    f"[CHAT_MEMORY] Failed to update chat_memory (status={response.status_code}): {response.text}",
                    flush=True,
                )
            else:
                print("[CHAT_MEMORY] Updated chat_memory for user via /users/me/chat-memory", flush=True)
        except Exception as e:
            print(f"[CHAT_MEMORY] Error saving chat memory from state: {e}", flush=True)


    async def _save_session_snapshot_from_session(self, session_id: str) -> None:
        """Serialize and save a thick snapshot of a session to Redis."""
        if self.redis_client is None:
            return

        async with self.session_locks[session_id]:
            session = self.sessions.get(session_id)
            if not session:
                return

            context = session.get("context") or {}
            user_info = context.get("user_info") or {}
            user_id = (
                context.get("user_id")
                or user_info.get("id")
                or user_info.get("user_id")
                or user_info.get("sub")
            )

            snapshot = {
                "session_id": session_id,
                "user_id": user_id,
                "created_at": session.get("created_at") or datetime.now().isoformat(),
                "messages": [self._serialize_message(m) for m in session.get("messages", [])],
                "context": context,
                "tokens_used": session.get("tokens_used", 0),
                "credits_consumed": session.get("credits_consumed", 0.0),
                "awaiting_codebase_selection": session.get("awaiting_codebase_selection", False),
                "selected_codebases": session.get("selected_codebases", []),
                "plan_created": session.get("plan_created", False),
                "focused_tasks": session.get("focused_tasks", []),
                "original_question": session.get("original_question", ""),
                "current_task": session.get("current_task", {}),
                "current_task_number": session.get("current_task_number", 1),
                "accumulated_findings": session.get("accumulated_findings", []),
                "can_answer_question": session.get("can_answer_question", False),
                "tool_call_traces": session.get("tool_call_traces", []),
                "current_task_traces": session.get("current_task_traces", []),
                "detailed_codebase_context": session.get("detailed_codebase_context", {}),
            }

        key = f"agent_session:{session_id}"
        try:
            await self.redis_client.set(key, json.dumps(snapshot, default=str), ex=self.redis_ttl_seconds)
            print(f"[DEBUG] Saved session snapshot to Redis (session_id={session_id})", flush=True)
        except Exception as e:
            print(f"[DEBUG] Failed to save session snapshot to Redis for {session_id}: {e}", flush=True)

    async def _save_session_snapshot_from_state(self, state: AgentState) -> None:
        """Serialize and save a thick snapshot of the current AgentState to Redis."""
        if self.redis_client is None:
            return

        session_id = state.get("session_id")
        if not session_id:
            return

        context = state.get("context") or {}
        user_info = context.get("user_info") or {}
        user_id = (
            context.get("user_id")
            or user_info.get("id")
            or user_info.get("user_id")
            or user_info.get("sub")
        )

        snapshot = {
            "session_id": session_id,
            "user_id": user_id,
            "created_at": datetime.now().isoformat(),
            "messages": [self._serialize_message(m) for m in state.get("messages", [])],
            "context": context,
            "tokens_used": state.get("tokens_used", 0),
            "credits_consumed": state.get("credits_consumed", 0.0),
            "awaiting_codebase_selection": state.get("awaiting_codebase_selection", False),
            "selected_codebases": state.get("selected_codebases", []),
            "plan_created": state.get("plan_created", False),
            "focused_tasks": state.get("focused_tasks", []),
            "original_question": state.get("original_question", ""),
            "current_task": state.get("current_task", {}),
            "current_task_number": state.get("current_task_number", 1),
            "accumulated_findings": state.get("accumulated_findings", []),
            "can_answer_question": state.get("can_answer_question", False),
            "tool_call_traces": state.get("tool_call_traces", []),
            "current_task_traces": state.get("current_task_traces", []),
            "detailed_codebase_context": state.get("detailed_codebase_context", {}),
        }

        key = f"agent_session:{session_id}"
        try:
            await self.redis_client.set(key, json.dumps(snapshot, default=str), ex=self.redis_ttl_seconds)
            print(f"[DEBUG] Saved session snapshot to Redis from state (session_id={session_id})", flush=True)
        except Exception as e:
            print(f"[DEBUG] Failed to save session snapshot from state for {session_id}: {e}", flush=True)

    async def _load_session_snapshot(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Load and deserialize a session snapshot from Redis."""
        if self.redis_client is None:
            return None

        key = f"agent_session:{session_id}"
        try:
            data = await self.redis_client.get(key)
            if not data:
                print(f"[INIT][REDIS] No snapshot found for session_id={session_id}", flush=True)
                return None

            snapshot = json.loads(data)
        except Exception as e:
            print(f"[DEBUG] Failed to load session snapshot from Redis for {session_id}: {e}", flush=True)
            return None

        # Rebuild messages and session dict
        raw_messages = snapshot.get("messages", [])
        messages = [self._deserialize_message(m) for m in raw_messages]
        print(
            f"[INIT][REDIS] Loaded snapshot for session_id={session_id} "
            f"with messages_count={len(messages)}",
            flush=True,
        )

        session = {
            "messages": messages,
            "tokens_used": snapshot.get("tokens_used", 0),
            "credits_consumed": snapshot.get("credits_consumed", 0.0),
            "created_at": snapshot.get("created_at") or datetime.now().isoformat(),
            "context": snapshot.get("context") or {},
            "awaiting_codebase_selection": snapshot.get("awaiting_codebase_selection", False),
            "selected_codebases": snapshot.get("selected_codebases", []),
            "plan_created": snapshot.get("plan_created", False),
            "focused_tasks": snapshot.get("focused_tasks", []),
            "original_question": snapshot.get("original_question", ""),
            "current_task": snapshot.get("current_task", {}),
            "current_task_number": snapshot.get("current_task_number", 1),
            "accumulated_findings": snapshot.get("accumulated_findings", []),
            "can_answer_question": snapshot.get("can_answer_question", False),
            "tool_call_traces": snapshot.get("tool_call_traces", []),
            "current_task_traces": snapshot.get("current_task_traces", []),
            "detailed_codebase_context": snapshot.get("detailed_codebase_context", {}),
        }

        return {
            "session": session,
            "user_id": snapshot.get("user_id"),
        }

    async def _delete_session_snapshot(self, session_id: str) -> None:
        """Remove a session snapshot from Redis (used on user mismatch or errors)."""
        if self.redis_client is None:
            return

        key = f"agent_session:{session_id}"
        try:
            await self.redis_client.delete(key)
            print(f"[DEBUG] Deleted session snapshot from Redis (session_id={session_id})", flush=True)
        except Exception as e:
            print(f"[DEBUG] Failed to delete session snapshot from Redis for {session_id}: {e}", flush=True)

    async def cleanup_session(self, session_id: str):
        """Clean up a session when the WebSocket disconnects.

        Saves a snapshot to Redis (if configured) before removing it from memory.
        """
        if session_id not in self.sessions:
            return

        try:
            await self._save_session_snapshot_from_session(session_id)
        except Exception as e:
            print(f"[DEBUG] Failed to save session snapshot during cleanup for {session_id}: {e}", flush=True)

        # Finally remove in-memory session
        if session_id in self.sessions:
            del self.sessions[session_id]

    def get_session_info(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get information about a session"""
        return self.sessions.get(session_id)

    def get_active_sessions(self) -> List[str]:
        """Get list of active session IDs"""
        return list(self.sessions.keys())

    def mark_session_closed(self, session_id: str) -> None:
        """Mark a session as closed (e.g., WebSocket disconnected)."""
        self.closed_sessions.add(session_id)

    def mark_session_active(self, session_id: str) -> None:
        """Mark a session as active/open, clearing any closed flag."""
        if session_id in self.closed_sessions:
            self.closed_sessions.discard(session_id)

    def is_session_closed(self, session_id: str) -> bool:
        """Return True if this session has been marked as closed."""
        return session_id in self.closed_sessions

    def set_thought_emitter(self, websocket, session_id: str):
        """Set up thought emission for this session"""
        self.thought_emitter = ThoughtEmitter(websocket, session_id)
        set_global_emitter(self.thought_emitter)

    async def refresh_documentation_structure(self, jwt_token: str, org_id: str, project_id: str, session_id: str):
        """Refresh documentation structure in session context after template changes"""
        try:
            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json"
            }
            response = requests.get(
                f"{self.backend_api_url}/api/v1/org/{org_id}/project/{project_id}/documentation-template",
                headers=headers,
                timeout=30
            )
            if response.status_code == 200:
                updated_template = response.json()
                # Update the persistent session storage
                async with self.session_locks[session_id]:
                    if session_id in self.sessions:
                        self.sessions[session_id]["context"]["documentation_structure"] = updated_template
                print(f"[DEBUG] ✅ Documentation structure refreshed in session context", flush=True)
            else:
                print(f"[DEBUG] ⚠️ Failed to refresh documentation structure: HTTP {response.status_code}", flush=True)
        except Exception as e:
            print(f"[DEBUG] ⚠️ Error refreshing documentation structure: {str(e)}", flush=True)

# GRAPH #
    def _build_graph(self) -> StateGraph:
        """Build the router-based LangGraph workflow"""

        #### nodes
        async def LLM_chat(state: AgentState) -> AgentState:
            """LLM chat node - processes user input and determines next action (tool, workflow, or response)"""
            print("LLM_chat", flush=True)

            # Reset tool_should_loopback to True at the start of each LLM_chat cycle.
            # This ensures tools default to loopback unless explicitly set otherwise.
            # NOTE: We also persist this via the node's return value so that the
            # graph state does not accidentally carry over a False value from a
            # previous non-loopback tool call.
            state["tool_should_loopback"] = True

            print(
                f"LLM_chat flags: awaiting={state.get('awaiting_codebase_selection')}, "
                f"selected_len={len(state.get('selected_codebases') or [])}, "
                f"plan_created={state.get('plan_created')}, "
                f"focused_tasks_len={len(state.get('focused_tasks') or [])}",
                flush=True,
            )

            messages = state["messages"]
            print(f"llm_answer: in={len(messages)}", flush=True)
            last_message = messages[-1] if messages else None

            def _is_human(msg):
                t = getattr(msg, "type", "").lower() if hasattr(msg, "type") else ""
                return t in ("human", "user") or msg.__class__.__name__ == "HumanMessage"

            last_human = next((m for m in reversed(messages) if _is_human(m)), None)
            user_input = last_human.content.strip() if last_human and hasattr(last_human, "content") else ""
            last_message_text = last_message.content.strip() if last_message and hasattr(last_message, "content") else ""

            # Internal auto-start trigger should not be treated as real user input
            if user_input == AUTO_SCF_TRIGGER:
                user_input = ""
            if last_message_text == AUTO_SCF_TRIGGER:
                last_message_text = ""

            # Manage conversation context to prevent token overflow
            filtered_messages_for_prompt = [
                m for m in messages
                if not (hasattr(m, "content") and getattr(m, "content", None) == AUTO_SCF_TRIGGER)
            ]
            managed_messages_list = self.manage_conversation_context(filtered_messages_for_prompt)

            # Format managed messages into a readable text block for the LLM prompt
            managed_messages = self.format_managed_messages_for_prompt(managed_messages_list)

            # Get comprehensive context
            session_context = state.get("context", {})
            user_info = session_context.get("user_info", {}) or {}
            org_info = session_context.get("org_info", {}) or {}
            project_info = session_context.get("project_info", {}) or {}
            documentation_structure = session_context.get("documentation_structure", {}) or {}
            policy_names = session_context.get("policy_names", []) or []
            chat_memory = session_context.get("chat_memory", {}) or {}
            latest_frontend_event = session_context.get("latest_frontend_event")
            # Project view UI telemetry (current tab and document), populated via frontend_event messages
            current_tab = session_context.get("project_current_tab") or ""
            current_document_raw = session_context.get("project_current_document")

            username = user_info.get("username", "unknown")
            org_name = org_info.get("organization_name", "unknown")
            credits = org_info.get("credits", 0)
            project_id = session_context.get("project_id", "unknown")
            project_name = project_info.get("name", "unknown")
            project_status = project_info.get("status", "unknown")
            compliance_score = project_info.get("compliance_score", 0)
            memory_summary = chat_memory.get("summary", "")
            current_tasks = chat_memory.get("current_tasks", [])

            # Derive active project tasks (todo + in_progress) from backend so the
            # prompt's "Current tasks" count reflects real project tasks rather
            # than a hard-coded or stale value from chat_memory.
            active_task_summaries: List[str] = []
            try:
                jwt_token_ctx = session_context.get("jwt_token", "")
                # Prefer org_id from session_context; fall back to org_info id fields.
                org_id_ctx = (
                    session_context.get("org_id")
                    or org_info.get("id")
                    or org_info.get("org_id")
                    or ""
                )
                project_id_ctx = session_context.get("project_id") or project_id

                if (
                    jwt_token_ctx
                    and org_id_ctx
                    and project_id_ctx
                    and str(project_id_ctx) != "unknown"
                ):
                    # Fetch TODO and IN_PROGRESS tasks separately using the same
                    # backend helper as the read_project_tasks tool.
                    todo_result = self.project_task_tool.read_tasks(
                        jwt_token=jwt_token_ctx,
                        org_id=str(org_id_ctx),
                        project_id=str(project_id_ctx),
                        status_filter="todo",
                    )
                    in_progress_result = self.project_task_tool.read_tasks(
                        jwt_token=jwt_token_ctx,
                        org_id=str(org_id_ctx),
                        project_id=str(project_id_ctx),
                        status_filter="in_progress",
                    )

                    tasks: List[Dict[str, Any]] = []
                    if todo_result.get("success") and isinstance(todo_result.get("tasks"), list):
                        tasks.extend(todo_result.get("tasks") or [])
                    if in_progress_result.get("success") and isinstance(in_progress_result.get("tasks"), list):
                        tasks.extend(in_progress_result.get("tasks") or [])

                    # De-duplicate tasks by id/object_id and build simple summaries.
                    seen_ids = set()
                    for t in tasks:
                        tid = t.get("object_id") or t.get("id")
                        key = str(tid) if tid is not None else None
                        if key and key in seen_ids:
                            continue
                        if key:
                            seen_ids.add(key)

                        title = (t.get("title") or "(untitled task)").strip()
                        status_val = str(t.get("status") or "unknown").lower()
                        active_task_summaries.append(f"[{status_val}] {title}")

                # If we successfully loaded active tasks, override current_tasks so
                # get_context_prompt sees the real number of TODO+in_progress tasks.
                if active_task_summaries:
                    current_tasks = active_task_summaries
            except Exception as e:
                # Best-effort only: if anything goes wrong, fall back to the
                # chat_memory-derived value and do not break the turn.
                self._log_structured(
                    "TASKS",
                    stage="active_task_count_error",
                    message=str(e),
                )

            # Previous session history from persisted chat_memory (DB-backed)
            previous_session_messages = chat_memory.get("last_messages", [])
            if isinstance(previous_session_messages, list) and previous_session_messages:
                previous_session_history = "\n".join(str(m) for m in previous_session_messages)
            else:
                previous_session_history = ""

            # Summarize SCF tasks (for SCF config prompt)
            scf_tasks = session_context.get("scf_tasks", []) or []
            scf_current_task_id = session_context.get("scf_current_task_id")
            scf_current_task_summary = "None"
            scf_previous_tasks_summary = "None"

            if isinstance(scf_tasks, list) and scf_tasks:
                current_line = None
                previous_lines: List[str] = []
                for t in scf_tasks:
                    tid = t.get("id", "")
                    status = str(t.get("status", "")).upper() or "UNKNOWN"
                    title = t.get("title", "(no title)")
                    line = f"- [{status}] {title} (id: {tid})"
                    if scf_current_task_id and str(tid) == str(scf_current_task_id):
                        current_line = line
                    else:
                        previous_lines.append(line)

                if current_line:
                    scf_current_task_summary = current_line
                else:
                    # Fallback: treat the first non-terminal task as current
                    for t in scf_tasks:
                        status = str(t.get("status", "")).upper()
                        if status in {"PENDING", "IN_PROGRESS"}:
                            tid = t.get("id", "")
                            title = t.get("title", "(no title)")
                            scf_current_task_summary = f"- [{status}] {title} (id: {tid})"
                            break

                if previous_lines:
                    scf_previous_tasks_summary = "\n".join(previous_lines)



            # Extract user and org profile fields (from state or context)
            user_title = state.get("user_title", session_context.get("user_title", ""))
            user_role = state.get("user_role", session_context.get("user_role", ""))
            user_knowledge = state.get("user_knowledge", session_context.get("user_knowledge", ""))
            org_what = state.get("org_what", session_context.get("org_what", ""))
            org_size = state.get("org_size", session_context.get("org_size", ""))
            org_industry = state.get("org_industry", session_context.get("org_industry", ""))
            org_location = state.get("org_location", session_context.get("org_location", ""))
            org_goals = state.get("org_goals", session_context.get("org_goals", ""))
            past_issues = state.get("past_issues", session_context.get("past_issues", ""))
            previous_work = state.get("previous_work", session_context.get("previous_work", ""))
            org_security_frameworks = state.get("org_security_frameworks", session_context.get("org_security_frameworks", ""))
            org_relevant_laws = state.get("org_relevant_laws", session_context.get("org_relevant_laws", ""))
            data_to_worry_about = state.get("data_to_worry_about", session_context.get("data_to_worry_about", ""))
            # Extended org profile fields used in prompts
            org_customer_profile = state.get(
                "org_customer_profile", session_context.get("org_customer_profile", "")
            )
            org_security_motivations = state.get(
                "org_security_motivations", session_context.get("org_security_motivations", "")
            )
            org_structure_ownership = state.get(
                "org_structure_ownership", session_context.get("org_structure_ownership", "")
            )
            org_technical_stack = state.get(
                "org_technical_stack", session_context.get("org_technical_stack", "")
            )

            # Normalize current tab and current document for prompts (project_view)
            current_document = ""
            current_document_id = ""
            is_control_doc = False
            if isinstance(current_document_raw, dict):
                title = current_document_raw.get("title") or ""
                doc_id = current_document_raw.get("id") or current_document_raw.get("object_id") or ""
                is_control_doc = bool(current_document_raw.get("is_control"))
                base_label = title or doc_id
                if base_label:
                    current_document = f"{base_label} (control)" if is_control_doc else base_label
                current_document_id = doc_id
            elif current_document_raw:
                # Fallback: treat raw value as both label and ID if it's not a dict
                current_document = str(current_document_raw)
                current_document_id = str(current_document_raw)

            if not current_document:
                current_document = "None"
            if not current_document_id:
                current_document_id = "None"

            current_tab_display = current_tab or "unknown"

            frontend_event_text = ""
            if latest_frontend_event:
                try:
                    evt_name = latest_frontend_event.get("event", "")
                    evt_payload = latest_frontend_event.get("payload", {})
                    payload_str = json.dumps(evt_payload, ensure_ascii=False)
                    frontend_event_text = f"{evt_name} with payload: {payload_str}"
                except Exception:
                    frontend_event_text = str(latest_frontend_event)

            # Format project documentation structure for context (recursive, including children)
            def extract_page_hierarchy(pages: List[Dict[str, Any]], indent: int = 0) -> List[str]:
                """Recursively extract page titles and IDs, including nested children"""
                result = []
                for page in pages:
                    page_id = page.get("id", "unknown")
                    page_title = page.get("title", "Untitled")
                    result.append(f"{'  ' * indent}• {page_title} (id: {page_id})")

                    # Recursively add children
                    if page.get("children"):
                        result.extend(extract_page_hierarchy(page["children"], indent + 1))

                return result

            doc_pages_info = ""
            if documentation_structure.get("pages"):
                page_hierarchy = extract_page_hierarchy(documentation_structure["pages"])
                if page_hierarchy:
                    doc_pages_info = f"\n                - Documentation Pages:\n                  " + "\n                  ".join(page_hierarchy)

            # print(f"doc_pages_info: {doc_pages_info}", flush=True)

            # Format policy names for context
            policy_info = ""
            if policy_names:
                policy_titles = [p.get("title", "Untitled") for p in policy_names]
                policy_info = f"\n                - Available Policies: {', '.join(policy_titles)}"




            # Get initial prompt from prompts.py (onboarding entry point)
            initial_prompt = get_initial_prompt(
                username=username,
                org_name=org_name,
                user_title=user_title,
                user_role=user_role,
                user_knowledge=user_knowledge,
                org_what=org_what,
                org_size=org_size,
                org_industry=org_industry,
                org_location=org_location,
                org_goals=org_goals,
                past_issues=past_issues,
                previous_work=previous_work,
                org_security_frameworks=org_security_frameworks,
                org_relevant_laws=org_relevant_laws,
                data_to_worry_about=data_to_worry_about,
                org_customer_profile=org_customer_profile,
                org_security_motivations=org_security_motivations,
                org_structure_ownership=org_structure_ownership,
                org_technical_stack=org_technical_stack,
                managed_messages=managed_messages,
                previous_session_history=previous_session_history,
                user_input=user_input,
                last_message_text=last_message_text,
            )

            # Get context prompt from prompts.py (includes full tool list)
            # Note: This is a simplified version - the full context_prompt with all tools
            # is still defined inline below for now to avoid breaking changes
            # TODO: Move full tool list to prompts.py
            context_prompt_base = get_context_prompt(
                username=username,
                org_name=org_name,
                project_name=project_name,
                project_status=project_status,
                project_id=project_id,
                compliance_score=compliance_score,
                credits=credits,
                data_to_worry_about=data_to_worry_about,
                org_customer_profile=org_customer_profile,
                org_security_motivations=org_security_motivations,
                org_structure_ownership=org_structure_ownership,
                org_technical_stack=org_technical_stack,
                doc_pages_info=doc_pages_info,
                policy_info=policy_info,
                memory_summary=memory_summary,
                current_tasks=current_tasks,
                previous_session_history=previous_session_history,
                managed_messages=managed_messages,
                user_input=user_input,
                last_message_text=last_message_text,
                current_tab=current_tab_display,
                current_document=current_document,
                current_document_id=current_document_id,
            )
            
            context_prompt = context_prompt_base



            # Get SCF config prompt from prompts.py (SCF config entry point)
            scf_config_prompt = get_scf_config_prompt(
                username=username,
                org_name=org_name,
                org_what=org_what,
                org_size=org_size,
                org_industry=org_industry,
                org_goals=org_goals,
                org_security_frameworks=org_security_frameworks,
                org_relevant_laws=org_relevant_laws,
                data_to_worry_about=data_to_worry_about,
                org_customer_profile=org_customer_profile,
                org_security_motivations=org_security_motivations,
                org_structure_ownership=org_structure_ownership,
                org_technical_stack=org_technical_stack,
                previous_session_history=previous_session_history,
                managed_messages=managed_messages,
                scf_current_task_summary=scf_current_task_summary,
                scf_previous_tasks_summary=scf_previous_tasks_summary,
                user_input=user_input,
                last_message_text=last_message_text,
                was_redirected=session_context.get("scf_redirected", False),
                frontend_event=frontend_event_text,
            )

            try:
                # Select appropriate prompt based on entry_point
                entry_point = state.get("context", {}).get("entry_point", "project_view")
                selected_prompt = context_prompt  # Default to context_prompt

                print("\n\n\n\n\n\n\n\n\n\n\n\n=================================================")
                print("=================================================\n")

                # Select prompt based on entry_point
                if entry_point == "onboarding":
                    selected_prompt = initial_prompt
                    print(f"Using initial_prompt for entry_point: {entry_point}", flush=True)
                elif entry_point == "scf_config":
                    selected_prompt = scf_config_prompt
                    print(f"Using scf_config_prompt for entry_point: {entry_point}", flush=True)
                else:
                    print(f"Using context_prompt for entry_point: {entry_point}", flush=True)

                # Estimate tokens for this call
                classification_tokens = self.estimate_tokens(selected_prompt)


                print(f"\n\nselected_prompt: {selected_prompt} \n", flush=True)

                # Defaults that we will populate from the structured response.
                response_text: str = ""
                tool_name = None
                workflow_name = None
                effective_tool_cmds: List[List[str]] = []
                task_update: Optional[Dict[str, str]] = None
                total_tokens = 0

                # Use LangChain's structured output support with a Pydantic model.
                # This configures the OpenAI client with a JSON schema and returns
                # a parsed `ResponseWithTools` instance.
                structured_llm = self.llm_client.with_structured_output(ResponseWithTools)
                max_retries = 2
                structured_response: Optional[ResponseWithTools] = None
                last_error: Optional[Exception] = None

                # Retry a few times if the model returns invalid JSON or otherwise
                # fails structured parsing. This primarily guards against transient
                # "Invalid JSON" / Pydantic validation errors from the model.
                for attempt in range(max_retries + 1):
                    try:
                        structured_response = await structured_llm.ainvoke(
                            [HumanMessage(content=selected_prompt)]
                        )
                        break
                    except Exception as e:
                        last_error = e

                        # Try to log the raw model output that failed validation (Pydantic v2).
                        try:
                            if hasattr(e, "errors"):
                                errors = e.errors()
                                if errors:
                                    raw_input = errors[0].get("input")
                                    if isinstance(raw_input, str):
                                        snippet = raw_input[:1000]
                                        print(
                                            f"[DEBUG][CLASSIFY_RAW_OUTPUT] attempt={attempt + 1} "
                                            f"raw_model_output={snippet!r}",
                                            flush=True,
                                        )
                        except Exception as log_err:
                            print(
                                f"[DEBUG][CLASSIFY_RAW_OUTPUT] Failed to log raw output: {log_err}",
                                flush=True,
                            )

                        # If this is a JSON parse issue with trailing characters, try to
                        # salvage the first complete JSON object from the model output.
                        recovered: Optional[ResponseWithTools] = None
                        try:
                            if hasattr(e, "errors"):
                                errors = e.errors()
                                if errors:
                                    err0 = errors[0]
                                    raw_input = err0.get("input")
                                    err_type = err0.get("type")
                                    if isinstance(raw_input, str) and err_type == "json_invalid":
                                        cleaned = ResponseWithTools.extract_first_json_object(raw_input)
                                        if cleaned is not None:
                                            recovered = ResponseWithTools.model_validate_json(cleaned)
                                            print(
                                                "[DEBUG][CLASSIFY_RECOVERED] Successfully parsed first JSON "
                                                "object from malformed output",
                                                flush=True,
                                            )
                        except Exception as recover_err:
                            print(
                                f"[DEBUG][CLASSIFY_RECOVERED] Failed to recover from malformed "
                                f"structured output: {recover_err}",
                                flush=True,
                            )
                            recovered = None

                        if recovered is not None:
                            structured_response = recovered
                            break

                        print(
                            f"Error in classify_intent LLM call (attempt {attempt + 1}): {e}",
                            flush=True,
                        )
                        if attempt == max_retries:
                            # Let the outer except handler convert this into a small
                            # user-facing error message.
                            raise

                # Extract user-visible text and optional tool calls.
                response_text = (structured_response.text_to_user or "").strip()  # type: ignore[union-attr]
                raw_tool_calls = getattr(structured_response, "tool_calls", []) or []  # type: ignore[arg-type]

                parsed_tools: List[List[str]] = []
                for raw_call in raw_tool_calls:
                    if not isinstance(raw_call, str):
                        continue
                    parts = [p.strip() for p in raw_call.split(",") if p.strip()]
                    if parts:
                        parsed_tools.append(parts)

                effective_tool_cmds = parsed_tools
                tool_name = effective_tool_cmds[0] if effective_tool_cmds else None
                workflow_name = None  # Workflows are not modeled in this schema.
                task_update = None

                print(f"structured tool_calls: {raw_tool_calls}", flush=True)

                # Track tokens used (approximate completion tokens based on parsed content).
                completion_text_for_tokens = response_text
                if raw_tool_calls:
                    completion_text_for_tokens += "\n" + "\n".join(raw_tool_calls)
                response_tokens = self.estimate_tokens(completion_text_for_tokens)
                total_tokens = classification_tokens + response_tokens

                print(f"response: {response_text}", flush=True)

            except Exception as e:
                print(f"Error in classify_intent LLM call: {e}")
                response_text = "Sorry, I ran into an issue processing that. Please try again."
                tool_name = None
                workflow_name = None
                task_update = None
                effective_tool_cmds = []
                total_tokens = 0

            print(f"classify_intent decision: tool={tool_name}, workflow={workflow_name}", flush=True)

            # Always send the assistant response first (delta-only)
            out: Dict[str, Any] = {
                "messages": [AIMessage(content=response_text)],
                "tokens_used": state.get("tokens_used", 0) + total_tokens,
                "task_update": task_update,
                # Persist the reset so the final snapshot for this leg does not
                # incorrectly show tool_should_loopback=False from a previous
                # non-loopback tool call.
                "tool_should_loopback": True,
            }

            if workflow_name:
                # Notify UI of the decision text before executing workflow
                try:
                    await emit_decision_message(response_text)
                except Exception:
                    pass
                out.update({"has_workflow": True, "requested_workflow": workflow_name})
            elif tool_name:
                # Notify UI of the decision text before executing tool
                try:
                    await emit_decision_message(response_text)
                except Exception:
                    pass
                tool_payload: Dict[str, Any] = {"has_tool_call": True, "requested_tool": tool_name}
                if effective_tool_cmds:
                    tool_payload["requested_tools"] = effective_tool_cmds
                out.update(tool_payload)
            else:
                # Nothing else to do; router will end the leg after this message
                pass

            print("\n=================================================")
            print("=================================================\n\n\n\n\n\n\n\n\n\n\n\n\n\n")
            return out


        async def tool_call(state: AgentState) -> AgentState:
            """Execute one or more tools in sequence.

            - If no valid batch is provided, falls back to single-tool behavior.
            - If exactly one tool is provided, behaves exactly like the original
              single-tool implementation.
            - If multiple tools are provided, executes them in order, threading
              state locally and aggregating the resulting updates. The final
              update is returned to the graph as the node delta.
            """

            # Normalize requested_tools to a list of List[str]
            raw_batch = state.get("requested_tools") or []
            normalized_batch: List[List[str]] = []
            if isinstance(raw_batch, list):
                for item in raw_batch:
                    if isinstance(item, list) and item:
                        normalized_batch.append(item)
                    elif isinstance(item, str) and item.strip():
                        normalized_batch.append([item.strip()])

            # No batch or invalid structure -> fall back to single-tool behavior
            if not normalized_batch:
                return await _single_tool_call(state)

            # Single-tool batch: keep behavior identical to original flow
            if len(normalized_batch) == 1:
                single_state: Dict[str, Any] = dict(state)
                single_state["requested_tool"] = normalized_batch[0]
                single_state["requested_tools"] = None
                return await _single_tool_call(single_state)  # type: ignore[arg-type]

            # Local helper: merge two AgentState-like dicts.
            def _merge_states(base: Dict[str, Any], delta: Dict[str, Any]) -> Dict[str, Any]:
                merged: Dict[str, Any] = dict(base)
                for k, v in (delta or {}).items():
                    if k == "messages":
                        existing = list(merged.get("messages") or [])
                        existing.extend(v or [])
                        merged["messages"] = existing
                    elif k == "tool_call_traces":
                        existing_traces = list(merged.get("tool_call_traces") or [])
                        existing_traces.extend(v or [])
                        if len(existing_traces) > 100:
                            existing_traces = existing_traces[-100:]
                        merged["tool_call_traces"] = existing_traces
                    else:
                        merged[k] = v
                return merged

            # Multi-tool batch: execute sequentially, threading state and
            # aggregating updates. Last writer wins for scalar fields; message
            # lists and traces are extended.
            working_state: Dict[str, Any] = dict(state)
            aggregated_update: Dict[str, Any] = {}

            for idx, cmd in enumerate(normalized_batch):
                if not cmd:
                    continue
                cmd_name = str(cmd[0]) if cmd and isinstance(cmd[0], str) else None

                # Prepare per-tool state
                working_state["requested_tool"] = cmd
                # Do not recurse batch processing inside single calls
                working_state["requested_tools"] = None

                single_update = await _single_tool_call(working_state)
                if not isinstance(single_update, dict):
                    continue

                # Thread new state for subsequent tools
                working_state = _merge_states(working_state, single_update)
                # Accumulate into final node delta
                aggregated_update = _merge_states(aggregated_update, single_update)

                # If a validation error occurred, stop executing further tools
                if single_update.get("tool_error"):
                    break

                # configure_scf is terminal by design: it redirects the UI and
                # should not be followed by further tool executions in the same leg.
                if cmd_name == "configure_scf":
                    break

            # After a batch, clear tool flags so tools are not re-run
            if "has_tool_call" not in aggregated_update:
                aggregated_update["has_tool_call"] = False
            if "requested_tool" not in aggregated_update:
                aggregated_update["requested_tool"] = None
            aggregated_update["requested_tools"] = None

            return aggregated_update


        async def _single_tool_call(state: AgentState) -> AgentState:
            """Execute a single tool call and optionally loop back to LLM_chat.

            This preserves the original single-tool behavior for backward compatibility.
            """
            tool = state.get("requested_tool")
            try:
                if tool:
                    await emit_data_thought(f"Validating tool call: {tool}", "tool_call")
            except Exception:
                pass

            # Normalize requested_tool -> (name, args)
            name: Optional[str] = None
            args: List[str] = []
            if isinstance(tool, list) and tool:
                name, *args = tool
            elif isinstance(tool, str):
                name = tool

            # Normalize tool names (LLM sometimes uses different names)
            tool_name_mapping = {
                "update_info": "update_context",
                "update_context_info": "update_context",
            }
            if name and name in tool_name_mapping:
                name = tool_name_mapping[name]

            # Helper: find version by id from detailed context
            def _find_version(version_id: str) -> Optional[Dict[str, Any]]:
                detailed = state.get("detailed_codebase_context", {}) or {}
                for cb in detailed.get("codebases", []) or []:
                    for ver in cb.get("versions", []) or []:
                        if ver.get("object_id") == version_id:
                            out = dict(ver)
                            out["__codebase_name"] = cb.get("codebase_name")
                            return out
                return None

            def _sample_version_ids(limit: int = 5) -> List[str]:
                detailed = state.get("detailed_codebase_context", {}) or {}
                ids: List[str] = []
                for cb in detailed.get("codebases", []) or []:
                    for ver in cb.get("versions", []) or []:
                        if len(ids) >= limit:
                            return ids
                        vid = ver.get("object_id")
                        if vid:
                            ids.append(vid)
                return ids

            def _build_project_context_for_writer(current_state: AgentState) -> str:
                """Build a rich project_context string for document/evidence writers.

                Mirrors the get_context_prompt fields used in LLM_chat so that
                writer/evidence prompts see the same org+project+tasks view even
                when invoked via tools.
                """
                try:
                    session_context = current_state.get("context", {}) or {}
                    user_info = session_context.get("user_info", {}) or {}
                    org_info = session_context.get("org_info", {}) or {}
                    project_info = session_context.get("project_info", {}) or {}
                    documentation_structure = session_context.get("documentation_structure", {}) or {}
                    policy_names = session_context.get("policy_names", []) or []
                    chat_memory = session_context.get("chat_memory", {}) or {}

                    # Basic org/project fields
                    username = user_info.get("username", "unknown")
                    org_name = org_info.get("organization_name", "unknown")
                    credits = org_info.get("credits", 0)
                    project_id_ctx = session_context.get("project_id", "unknown")
                    project_name = project_info.get("name", "unknown")
                    project_status = project_info.get("status", "unknown")
                    compliance_score = project_info.get("compliance_score", 0)

                    memory_summary = chat_memory.get("summary", "")
                    current_tasks = chat_memory.get("current_tasks", [])

                    # Best-effort: refresh active task summaries from backend so the
                    # "Current tasks" count reflects real TODO+IN_PROGRESS tasks.
                    active_task_summaries: List[str] = []
                    try:
                        jwt_token_ctx = session_context.get("jwt_token", "")
                        org_id_ctx = (
                            session_context.get("org_id")
                            or org_info.get("id")
                            or org_info.get("org_id")
                            or ""
                        )
                        project_id_for_tasks = session_context.get("project_id") or project_id_ctx

                        if (
                            jwt_token_ctx
                            and org_id_ctx
                            and project_id_for_tasks
                            and str(project_id_for_tasks) != "unknown"
                        ):
                            todo_result = self.project_task_tool.read_tasks(
                                jwt_token=jwt_token_ctx,
                                org_id=str(org_id_ctx),
                                project_id=str(project_id_for_tasks),
                                status_filter="todo",
                            )
                            in_progress_result = self.project_task_tool.read_tasks(
                                jwt_token=jwt_token_ctx,
                                org_id=str(org_id_ctx),
                                project_id=str(project_id_for_tasks),
                                status_filter="in_progress",
                            )

                            tasks: List[Dict[str, Any]] = []
                            if todo_result.get("success") and isinstance(todo_result.get("tasks"), list):
                                tasks.extend(todo_result.get("tasks") or [])
                            if in_progress_result.get("success") and isinstance(in_progress_result.get("tasks"), list):
                                tasks.extend(in_progress_result.get("tasks") or [])

                            seen_ids: set = set()
                            for t in tasks:
                                tid = t.get("object_id") or t.get("id")
                                key = str(tid) if tid is not None else None
                                if key and key in seen_ids:
                                    continue
                                if key:
                                    seen_ids.add(key)

                                title = (t.get("title") or "(untitled task)").strip()
                                status_val = str(t.get("status") or "unknown").lower()
                                active_task_summaries.append(f"[{status_val}] {title}")

                        if active_task_summaries:
                            current_tasks = active_task_summaries
                    except Exception as e:
                        # Best-effort only; do not break tool execution on task errors.
                        self._log_structured(
                            "TASKS",
                            stage="active_task_count_error_tools",
                            message=str(e),
                        )

                    # Previous session history from persisted chat_memory (DB-backed)
                    previous_session_messages = chat_memory.get("last_messages", [])
                    if isinstance(previous_session_messages, list) and previous_session_messages:
                        previous_session_history = "\n".join(str(m) for m in previous_session_messages)
                    else:
                        previous_session_history = ""

                    # Extended org profile fields used in prompts
                    data_to_worry_about = current_state.get(
                        "data_to_worry_about",
                        session_context.get("data_to_worry_about", ""),
                    )
                    org_customer_profile = current_state.get(
                        "org_customer_profile",
                        session_context.get("org_customer_profile", ""),
                    )
                    org_security_motivations = current_state.get(
                        "org_security_motivations",
                        session_context.get("org_security_motivations", ""),
                    )
                    org_structure_ownership = current_state.get(
                        "org_structure_ownership",
                        session_context.get("org_structure_ownership", ""),
                    )
                    org_technical_stack = current_state.get(
                        "org_technical_stack",
                        session_context.get("org_technical_stack", ""),
                    )

                    # Normalize current tab and current document for prompts (project_view)
                    current_tab = session_context.get("project_current_tab") or ""
                    current_document_raw = session_context.get("project_current_document")
                    current_document = ""
                    current_document_id = ""
                    if isinstance(current_document_raw, dict):
                        title = current_document_raw.get("title") or ""
                        doc_id = current_document_raw.get("id") or current_document_raw.get("object_id") or ""
                        is_control_doc = bool(current_document_raw.get("is_control"))
                        base_label = title or doc_id
                        if base_label:
                            current_document = f"{base_label} (control)" if is_control_doc else base_label
                        current_document_id = doc_id
                    elif current_document_raw:
                        current_document = str(current_document_raw)
                        current_document_id = str(current_document_raw)

                    if not current_document:
                        current_document = "None"
                    if not current_document_id:
                        current_document_id = "None"
                    current_tab_display = current_tab or "unknown"

                    # Format project documentation structure for context (recursive)
                    def extract_page_hierarchy(pages: List[Dict[str, Any]], indent: int = 0) -> List[str]:
                        out: List[str] = []
                        for page in pages:
                            page_id = page.get("id", "unknown")
                            page_title = page.get("title", "Untitled")
                            out.append(f"{'  ' * indent}• {page_title} (id: {page_id})")
                            if page.get("children"):
                                out.extend(extract_page_hierarchy(page["children"], indent + 1))
                        return out

                    doc_pages_info = ""
                    if documentation_structure.get("pages"):
                        page_hierarchy = extract_page_hierarchy(documentation_structure["pages"])
                        if page_hierarchy:
                            doc_pages_info = (
                                "\n                - Documentation Pages:\n                  "
                                + "\n                  ".join(page_hierarchy)
                            )

                    policy_info = ""
                    if policy_names:
                        policy_titles = [p.get("title", "Untitled") for p in policy_names]
                        policy_info = (
                            "\n                - Available Policies: " + ", ".join(policy_titles)
                        )

                    # Managed message history (for completeness, though writers rely
                    # more on the org/project bullets above).
                    messages_for_prompt = current_state.get("messages", []) or []
                    managed_messages_list = self.manage_conversation_context(messages_for_prompt)
                    managed_messages = self.format_managed_messages_for_prompt(managed_messages_list)

                    # Simple view of the latest user input / last message text
                    user_input = ""
                    last_message_text = ""
                    if messages_for_prompt:
                        last_msg = messages_for_prompt[-1]
                        try:
                            last_message_text = (getattr(last_msg, "content", "") or "").strip()
                        except Exception:
                            last_message_text = ""

                    return get_context_prompt(
                        username=username,
                        org_name=org_name,
                        project_name=project_name,
                        project_status=project_status,
                        project_id=str(project_id_ctx),
                        compliance_score=compliance_score,
                        credits=credits,
                        data_to_worry_about=data_to_worry_about,
                        org_customer_profile=org_customer_profile,
                        org_security_motivations=org_security_motivations,
                        org_structure_ownership=org_structure_ownership,
                        org_technical_stack=org_technical_stack,
                        doc_pages_info=doc_pages_info,
                        policy_info=policy_info,
                        memory_summary=memory_summary,
                        current_tasks=current_tasks,
                        previous_session_history=previous_session_history,
                        managed_messages=managed_messages,
                        user_input=user_input,
                        last_message_text=last_message_text,
                        current_tab=current_tab_display,
                        current_document=current_document,
                        current_document_id=current_document_id,
                    )
                except Exception as e:
                    # If anything goes wrong, fall back to a minimal but valid context
                    ctx = current_state.get("context", {}) or {}
                    org_id_ctx = ctx.get("org_id", "")
                    project_id_ctx = ctx.get("project_id", "")
                    self._log_structured(
                        "TOOL",
                        stage="writer_context_error",
                        message=str(e),
                    )
                    return f"Org ID: {org_id_ctx}\nProject ID: {project_id_ctx}"

            # Known tool groups and expectations
            codebase_tools_with_question = {"query_code_base", "query_definition_names", "deep_search_codebase", "rag_code"}
            law_tools_with_question = {"query_law", "deep_search_law"}
            org_tools_single_arg = {"get_policies", "get_documentation", "get_employee_information"}
            project_content_tools = {"fetch_documentation_page", "fetch_policy_content", "search_documentation", "search_policies"}
            document_detail_tools = {READ_DOCUMENT_TOOL_NAME}
            project_task_read_tools = {TOOL_NAME_READ_PROJECT_TASKS}
            project_task_writer_tools = {TOOL_NAME_CREATE_PROJECT_TASK}
            project_evaluation_tools = {EVALUATE_PROJECT_TOOL_NAME}
            document_evaluation_tools = {EVALUATE_DOCUMENT_TOOL_NAME}
            template_search_tools = {"read_documentation_template"}
            template_edit_tools = {"edit_documentation_page"}
            template_create_tools = {"create_documentation_page"}
            template_delete_tools = {"delete_documentation_page"}
            template_reassign_tools = {"reassign_documentation_page"}
            auditor_list_tools = {"list_auditors"}
            auditor_view_tools = {"view_auditor"}
            auditor_create_tools = {"create_auditor"}
            auditor_edit_tools = {"edit_auditor"}
            agent_list_tools = {"list_agents"}
            agent_view_tools = {"view_agent"}
            agent_create_tools = {"create_agent"}
            agent_edit_tools = {"edit_agent"}
            agent_delete_tools = {"delete_agent"}
            context_update_tools = {UPDATE_CONTEXT_TOOL_NAME}
            onboarding_tools = {"configure_scf"}
            scf_controls_tools = {
                SCF_CONTROLS_TOOL_NAME,
                SCF_SET_MIN_WEIGHT_TOOL_NAME,
                SCF_RESET_FILTERS_TOOL_NAME,
                SCF_ALL_DONE_TOOL_NAME,
            }
            scf_task_tools = {SCF_TASKS_TOOL_NAME}
            scf_coverage_tools = {SCF_COVERAGE_OVERLAP_TOOL_NAME, SCF_RISKS_THREATS_TOOL_NAME}
            scf_catalog_tools = {SCF_LIST_RISKS_TOOL_NAME, SCF_LIST_THREATS_TOOL_NAME}
            scf_timeline_tools = {
                SCF_SET_TIMELINE_WINDOWS_TOOL_NAME,
                SCF_SET_TIMELINE_ORDER_TOOL_NAME,
                SCF_RESET_TIMELINE_TOOL_NAME,
            }
            scf_config_tools = (
                scf_controls_tools
                | scf_task_tools
                | scf_coverage_tools
                | scf_catalog_tools
                | scf_timeline_tools
            )

            # Determine available tools based on entry_point
            entry_point = state.get("context", {}).get("entry_point", "project_view")

            if entry_point == "onboarding":
                # Onboarding: allow context updates and SCF configuration
                supported_tools = sorted(list(context_update_tools | onboarding_tools))
            elif entry_point == "project_view":
                # Project view: all tools available
                supported_tools = sorted(list(
                    codebase_tools_with_question | law_tools_with_question | org_tools_single_arg |
                    project_content_tools | document_detail_tools | template_search_tools | template_edit_tools |
                    template_create_tools | template_delete_tools | template_reassign_tools |
                    auditor_list_tools | auditor_view_tools | auditor_create_tools | auditor_edit_tools |
                    agent_list_tools | agent_view_tools | agent_create_tools | agent_edit_tools | agent_delete_tools |
                    project_task_read_tools | project_task_writer_tools | project_evaluation_tools | document_evaluation_tools | context_update_tools
                ))
            elif entry_point == "scf_config":
                # SCF configuration: allow SCF-specific tools and org/context updates
                supported_tools = sorted(list(
                    scf_config_tools | org_tools_single_arg | context_update_tools
                ))
            else:
                # Other entry points (dashboard, audit_mode, documentation): limited tools
                supported_tools = sorted(list(
                    org_tools_single_arg | context_update_tools
                ))

            print(f"[DEBUG tool_call] entry_point={entry_point} name={name} args={args} supported={supported_tools}", flush=True)

            # Structured TOOL log for call start
            self._log_structured(
                "TOOL",
                stage="call_start",
                name=name,
                args_preview=[str(a)[:80] for a in (args or [])],
                entry_point=entry_point,
            )

            # === Tool-call trace + loop detection =====================================
            existing_traces = state.get("tool_call_traces") or []
            tracked_tools = context_update_tools | scf_config_tools

            loop_detected = False
            loop_count = 1
            if name and name in tracked_tools and existing_traces:
                # Look at the most recent traces for this tool with the same arguments.
                recent = [t for t in existing_traces[-5:] if t.get("tool") == name]
                if recent:
                    same_args_count = 0
                    for t in reversed(recent):
                        if t.get("tool") != name:
                            break
                        prev_args = t.get("args") or []
                        if prev_args != args:
                            break
                        same_args_count += 1
                    loop_count = same_args_count + 1
                    loop_detected = loop_count >= 3

            def _attach_traces_and_loop_hint(
                update: Dict[str, Any],
                status: str,
                error_text: Optional[str] = None,
            ) -> AgentState:
                """Attach tool_call_traces metadata and, if needed, a loop warning message."""
                if name and name in tracked_tools:
                    trace_entry: Dict[str, Any] = {
                        "time": datetime.utcnow().isoformat(),
                        "turn_id": state.get("turn_id"),
                        "tool": name,
                        "args": args,
                        "status": status,
                    }
                    if error_text:
                        trace_entry["error"] = error_text
                    new_traces = (existing_traces or []) + [trace_entry]
                    # Keep only the most recent 100 traces to avoid unbounded growth.
                    if len(new_traces) > 100:
                        new_traces = new_traces[-100:]
                    update["tool_call_traces"] = new_traces

                    # If we detected a loop, surface a synthetic internal TOOL_STATUS message
                    # so the LLM can see that it is stuck and should stop calling this tool.
                    if loop_detected:
                        loop_warning_text = (
                            f"[TOOL_STATUS][LOOP_WARNING] Tool '{name}' has been called "
                            f"{loop_count} times in a row with the same arguments. You are "
                            "likely stuck in a loop. Stop calling this tool; instead either "
                            "respond directly to the user or, if you are in SCF configuration, "
                            "call 'scf_all_done' to pause this SCF chat turn."
                        )
                        loop_msg = AIMessage(
                            content=loop_warning_text,
                            additional_kwargs={
                                "internal_tool_status": True,
                                "tool_name": name,
                                "loop_warning": True,
                                "loop_count": loop_count,
                            },
                        )
                        msgs = list(update.get("messages") or [])
                        msgs.append(loop_msg)
                        update["messages"] = msgs
                return update  # type: ignore[return-value]

            def error(msg: str) -> AgentState:
                # Validation errors should end the current tool_call leg and not loop
                # back into LLM_chat. We surface the error to the user and set
                # tool_should_loopback=False so the router transitions to ack_end.
                self._log_structured(
                    "TOOL",
                    stage="validation_error",
                    name=name,
                    entry_point=entry_point,
                    message=msg,
                )
                update: Dict[str, Any] = {
                    "messages": [AIMessage(content=f"tool_validation_error: {msg}")],
                    "has_tool_call": False,
                    "requested_tool": None,
                    "tool_should_loopback": False,
                    "tool_error": True,
                }
                return _attach_traces_and_loop_hint(update, status="error", error_text=msg)

            # Basic validations
            if not name:
                return error("no tool name provided. Use: --tool_call-- then a line like: tool_name, arg1, arg2 ...")

            if name not in supported_tools:
                return error(f"unknown tool '{name}'. Supported tools: {', '.join(supported_tools)}")

            # Per-tool validations (POC: presence and simple lookups only)
            if name in codebase_tools_with_question:
                if len(args) < 1 or not (args[0] or '').strip():
                    samples = _sample_version_ids()
                    hint = f" Provide a codebase_version_id. e.g., one of: {', '.join(samples)}" if samples else " Provide a valid codebase_version_id."
                    return error(f"missing arg1=codebase_version_id for '{name}'.{hint}")
                version_id = args[0].strip()
                ver = _find_version(version_id)
                if not ver:
                    samples = _sample_version_ids()
                    hint = f" Unknown codebase_version_id '{version_id}'. Known ids include: {', '.join(samples)}" if samples else f" Unknown codebase_version_id '{version_id}'."
                    return error(hint)
                if len(args) < 2 or not (args[1] or '').strip():
                    return error(f"missing arg2=question for '{name}'. Provide the specific question or target.")
                # Success (no execution)
                cb_name = ver.get("__codebase_name", "unknown")
                version_hash = ver.get("commit_hash", "unknown")
                q = args[1].strip()
                return {
                    "messages": [AIMessage(content=(
                        f"tool_validation_ok: {name} args accepted. "
                        f"codebase_version_id={version_id} (cb={cb_name}, commit={version_hash[:7]}), question='{q[:120]}'"
                    ))],
                    "has_tool_call": False,
                    "requested_tool": None,
                }

            if name in law_tools_with_question:
                if len(args) < 1 or not (args[0] or '').strip():
                    return error(f"missing arg1=law_id for '{name}'.")
                if len(args) < 2 or not (args[1] or '').strip():
                    return error(f"missing arg2=question for '{name}'.")
                return {
                    "messages": [AIMessage(content=f"tool_validation_ok: {name} args accepted. law_id={args[0].strip()}, question provided.")],
                    "has_tool_call": False,
                    "requested_tool": None,
                }

            if name in org_tools_single_arg:
                if len(args) < 1 or not (args[0] or '').strip():
                    return error(f"missing arg1 for '{name}'. Provide the required name (e.g., policy_name/documentation_name/employee_name).")
                return {
                    "messages": [AIMessage(content=f"tool_validation_ok: {name} args accepted. arg1='{args[0].strip()}'.")],
                    "has_tool_call": False,
                    "requested_tool": None,
                }

            if name in project_content_tools:
                # Project content tools require at least one argument (page_id, policy_id, or query)
                if len(args) < 1 or not (args[0] or '').strip():
                    return error(f"missing arg1 for '{name}'. Provide the required identifier or search query.")
                return {
                    "messages": [AIMessage(content=f"tool_validation_ok: {name} args accepted. arg1='{args[0].strip()}'.")],
                    "has_tool_call": False,
                    "requested_tool": None,
                }

            if name in document_detail_tools:
                # READ document tool: document_id is optional, default to the currently viewed document
                context = state.get("context", {}) or {}
                jwt_token = context.get("jwt_token", "")
                org_id = context.get("org_id", "")
                project_id = context.get("project_id", "")

                if not jwt_token or not org_id or not project_id:
                    msg = "Missing authentication or project context for 'read_document'."
                    self._log_structured(
                        "TOOL",
                        stage="exec_error",
                        name=name,
                        entry_point=entry_point,
                        message=msg,
                    )
                    update: AgentState = {
                        "messages": [AIMessage(content=f"❌ {msg}")],
                        "has_tool_call": False,
                        "requested_tool": None,
                        "tool_should_loopback": True,
                    }
                    return _attach_traces_and_loop_hint(update, status="error", error_text=msg)

                document_id: str = ""
                if len(args) >= 1 and (args[0] or "").strip():
                    document_id = args[0].strip()
                else:
                    current_doc = context.get("project_current_document")
                    if isinstance(current_doc, dict):
                        document_id = (
                            current_doc.get("id")
                            or current_doc.get("object_id")
                            or ""
                        )
                    elif current_doc:
                        document_id = str(current_doc)

                if not document_id:
                    msg = (
                        "Cannot read a document because no document_id was provided and there is "
                        "no currently selected document in the UI. Either open a document in the "
                        "project view or call the tool as: read_document, <document_id>."
                    )
                    self._log_structured(
                        "TOOL",
                        stage="exec_error",
                        name=name,
                        entry_point=entry_point,
                        message=msg,
                    )
                    update = {
                        "messages": [AIMessage(content=f"❌ {msg}")],
                        "has_tool_call": False,
                        "requested_tool": None,
                        "tool_should_loopback": True,
                    }
                    return _attach_traces_and_loop_hint(update, status="error", error_text=msg)

                try:
                    await emit_data_thought(
                        f"Reading full document details for document_id='{document_id}'",
                        "tool_execution",
                    )
                except Exception:
                    pass

                try:
                    result = self.project_content_tool.read_full_document(
                        jwt_token=jwt_token,
                        org_id=org_id,
                        project_id=project_id,
                        document_id=document_id,
                    )
                except Exception as e:  # pragma: no cover - defensive
                    msg = f"Unexpected error while reading document '{document_id}': {str(e)}"
                    self._log_structured(
                        "TOOL",
                        stage="exec_error",
                        name=name,
                        entry_point=entry_point,
                        message=msg,
                    )
                    update = {
                        "messages": [AIMessage(content=f"❌ {msg}")],
                        "has_tool_call": False,
                        "requested_tool": None,
                        "tool_should_loopback": True,
                    }
                    return _attach_traces_and_loop_hint(update, status="error", error_text=msg)

                if not result or not result.get("success"):
                    error_msg = (result or {}).get("error", "Unknown error")
                    status_code = (result or {}).get("status_code")
                    msg = f"Failed to read document '{document_id}': {error_msg}"
                    self._log_structured(
                        "TOOL",
                        stage="exec_error",
                        name=name,
                        entry_point=entry_point,
                        message=msg,
                        status_code=status_code,
                    )
                    update = {
                        "messages": [AIMessage(content=f"❌ {msg}")],
                        "has_tool_call": False,
                        "requested_tool": None,
                        "tool_should_loopback": True,
                    }
                    return _attach_traces_and_loop_hint(update, status="error", error_text=msg)

                data = result.get("data") or {}
                document = data.get("document") or {}
                evidence = data.get("evidence") or []
                evidence_requests = data.get("evidence_requests") or []
                children = data.get("children") or []
                # NOTE: related_pages are intentionally ignored here

                doc_id = document.get("object_id") or document.get("id") or document_id
                title = document.get("title") or "(untitled document)"
                status_val = document.get("status") or document.get("page_status") or "unknown"
                page_kind = document.get("page_kind") or document.get("type") or ""
                is_control_flag = bool(document.get("is_control"))
                created_at = document.get("createdAt") or document.get("created_at")
                updated_at = document.get("updatedAt") or document.get("updated_at")

                content = document.get("content") or document.get("body") or ""
                content_snippet = content.strip()
                max_len = 4000
                truncated = False
                if len(content_snippet) > max_len:
                    content_snippet = content_snippet[:max_len] + "\n\n[Content truncated]"
                    truncated = True

                lines: List[str] = []
                lines.append(f"✅ Full document details loaded for '{title}' (ID: {doc_id}).")
                lines.append("\n**Metadata**")
                lines.append(f"- Status: {status_val}")
                if page_kind:
                    lines.append(f"- Kind: {page_kind}")
                lines.append(f"- Is control: {'yes' if is_control_flag else 'no'}")
                if created_at:
                    lines.append(f"- Created at: {created_at}")
                if updated_at:
                    lines.append(f"- Last updated at: {updated_at}")

                lines.append("\n**Content**")
                if content_snippet:
                    lines.append(content_snippet)
                else:
                    lines.append("No content available in this document.")

                # Evidence summary
                lines.append("\n**Evidence linked to this document**")
                if evidence:
                    for ev in evidence:
                        ev_id = ev.get("object_id") or ev.get("id") or ""
                        ev_title = ev.get("title") or ev.get("name") or "Untitled evidence"
                        coll = ev.get("collection") or {}
                        coll_name = coll.get("name") or coll.get("title") or ""
                        line = f"- {ev_title}"
                        if ev_id:
                            line += f" (ID: {ev_id})"
                        if coll_name:
                            line += f" [collection: {coll_name}]"
                        lines.append(line)
                else:
                    lines.append("No evidence is linked to this document yet.")

                # Evidence requests
                lines.append("\n**Evidence requests related to this document**")
                if evidence_requests:
                    for er in evidence_requests:
                        er_id = er.get("object_id") or er.get("id") or ""
                        er_title = er.get("title") or "Untitled request"
                        status_er = er.get("status") or "unknown"
                        line = f"- {er_title} (status: {status_er}"
                        if er_id:
                            line += f", ID: {er_id}"
                        line += ")"
                        lines.append(line)
                else:
                    lines.append("No evidence requests are associated with this document.")

                # Children
                lines.append("\n**Child pages / sub-controls**")
                if children:
                    for child in children:
                        child_id = child.get("object_id") or child.get("id") or ""
                        child_title = child.get("title") or "Untitled"
                        child_kind = child.get("page_kind") or child.get("type") or ""
                        line = f"- {child_title}"
                        if child_id:
                            line += f" (ID: {child_id})"
                        if child_kind:
                            line += f" [{child_kind}]"
                        lines.append(line)
                else:
                    lines.append("No child pages are defined under this document.")

                lines.append(
                    "\nNote: Related documents are intentionally not included in this summary."
                )

                summary_text = "\n".join(lines)

                self._log_structured(
                    "TOOL",
                    stage="call_success",
                    name=name,
                    entry_point=entry_point,
                    document_id=document_id,
                    is_control=is_control_flag,
                    truncated_content=truncated,
                )

                update = {
                    "messages": [AIMessage(content=summary_text)],
                    "has_tool_call": False,
                    "requested_tool": None,
                    "tool_should_loopback": True,
                }
                return _attach_traces_and_loop_hint(update, status="success")

            if name in project_task_read_tools:
                # READ project tasks: optional status filter, always loop back
                context = state.get("context", {}) or {}
                jwt_token = context.get("jwt_token", "")
                org_id = context.get("org_id", "")
                project_id = context.get("project_id", "")

                if not jwt_token or not org_id or not project_id:
                    msg = "Missing authentication or project context for 'read_project_tasks'."
                    self._log_structured(
                        "TOOL",
                        stage="exec_error",
                        name=name,
                        entry_point=entry_point,
                        message=msg,
                    )
                    update = {
	                        "messages": [AIMessage(content=msg)],
	                        "has_tool_call": False,
	                        "requested_tool": None,
	                        "tool_should_loopback": True,
	                    }
                    return _attach_traces_and_loop_hint(update, status="error", error_text=msg)

                status_filter: Optional[str] = None
                if len(args) >= 1 and (args[0] or "").strip():
                    status_filter = args[0].strip().lower()
                    if status_filter not in {"todo", "in_progress", "completed", "all"}:
                        status_filter = "all"

                try:
                    await emit_data_thought(
                        f"Fetching project tasks (status={status_filter or 'all'})",
                        "tool_execution",
                    )
                except Exception:
                    pass

                try:
                    result = self.project_task_tool.read_tasks(
                        jwt_token=jwt_token,
                        org_id=org_id,
                        project_id=project_id,
                        status_filter=status_filter,
                    )
                except Exception as e:  # pragma: no cover - defensive
                    msg = f"Unexpected error while reading project tasks: {str(e)}"
                    self._log_structured(
                        "TOOL",
                        stage="exec_error",
                        name=name,
                        entry_point=entry_point,
                        message=msg,
                    )
                    update = {
                        "messages": [AIMessage(content=msg)],
                        "has_tool_call": False,
                        "requested_tool": None,
                        "tool_should_loopback": True,
                    }
                    return _attach_traces_and_loop_hint(update, status="error", error_text=msg)

                if not result or not result.get("success"):
                    error_msg = (result or {}).get("error", "Unknown error")
                    status_code = (result or {}).get("status_code")
                    msg = f"Failed to read project tasks: {error_msg}"
                    self._log_structured(
                        "TOOL",
                        stage="exec_error",
                        name=name,
                        entry_point=entry_point,
                        message=msg,
                        status_code=status_code,
                    )
                    update = {
	                        "messages": [AIMessage(content=msg)],
                        "has_tool_call": False,
                        "requested_tool": None,
                        "tool_should_loopback": True,
                    }
                    return _attach_traces_and_loop_hint(update, status="error", error_text=msg)

                tasks = result.get("tasks") or []

                def _created_key(t: Dict[str, Any]) -> str:
                    return (
                        str(t.get("created_at")
                            or t.get("CreatedAt")
                            or t.get("createdAt")
                            or "")
                    )

                try:
                    tasks_sorted = sorted(tasks, key=_created_key, reverse=True)
                except Exception:
                    tasks_sorted = tasks

                display_tasks = tasks_sorted[:10]
                total = len(tasks)

                lines: List[str] = []
                if not display_tasks:
                    lines.append("No project tasks found.")
                else:
                    lines.append(
                        f"Loaded {len(display_tasks)} project task(s) "
                        f"(showing up to 10 most recent out of {total})."
                )
                lines.append("")
                for t in display_tasks:
                    tid = t.get("object_id") or t.get("id") or ""
                    title = t.get("title") or "(untitled task)"
                    status_val = t.get("status") or "unknown"
                    priority = t.get("priority") or "medium"
                    due = t.get("due_date") or ""
                    line = f"- **{title}**"
                    if tid:
                        line += f" (ID: `{tid}`)"
                        line += f"; status: {status_val}, priority: {priority}"
                    if due:
                        line += f", due: {due}"
                    lines.append(line)

                summary_text = "\n".join(lines)

                self._log_structured(
                    "TOOL",
                    stage="call_success",
                    name=name,
                    entry_point=entry_point,
                    total_tasks=total,
                    shown_tasks=len(display_tasks),
                    status_filter=status_filter,
                )

                update = {
                    "messages": [AIMessage(content=summary_text)],
                    "has_tool_call": False,
                    "requested_tool": None,
                    "tool_should_loopback": True,
                }
                return _attach_traces_and_loop_hint(update, status="success")

            if name in project_task_writer_tools:
                # CREATE project task with writer step: single plain-English description
                if len(args) < 1 or not (args[0] or "").strip():
                    return error(
                        f"missing arg1=task_description for '{name}'. Provide a plain-English description of the task to create."
                    )

                task_description = args[0].strip()

                context = state.get("context", {}) or {}
                jwt_token = context.get("jwt_token", "")
                org_id = context.get("org_id", "")
                project_id = context.get("project_id", "")

                if not jwt_token or not org_id or not project_id:
                    msg = "Missing authentication or project context for 'create_project_task'."
                    self._log_structured(
                        "TOOL",
                        stage="exec_error",
                        name=name,
                        entry_point=entry_point,
                        message=msg,
                    )
                    update = {
                        "messages": [AIMessage(content=msg)],
                        "has_tool_call": False,
                        "requested_tool": None,
                        "tool_should_loopback": True,
                    }
                    return _attach_traces_and_loop_hint(update, status="error", error_text=msg)

                last_messages = [
                    {"role": m.type, "content": getattr(m, "content", "")}
                    for m in state.get("messages", [])[-15:]
                ]

                try:
                    await emit_data_thought(
                        "Generating project task fields from description via writer step",
                        "tool_execution",
                    )
                except Exception:
                    pass

                try:
                    result = await self.project_task_tool.create_task_with_writer(
                        jwt_token=jwt_token,
                        org_id=org_id,
                        project_id=project_id,
                        task_description=task_description,
                        last_messages=last_messages,
                    )
                except Exception as e:  # pragma: no cover - defensive
                    msg = f"Unexpected error while creating project task: {str(e)}"
                    self._log_structured(
                        "TOOL",
                        stage="exec_error",
                        name=name,
                        entry_point=entry_point,
                        message=msg,
                    )
                    update = {
                        "messages": [AIMessage(content=msg)],
                        "has_tool_call": False,
                        "requested_tool": None,
                        "tool_should_loopback": True,
                    }
                    return _attach_traces_and_loop_hint(update, status="error", error_text=msg)

                if not result or not result.get("success"):
                    error_msg = (result or {}).get("error", "Unknown error")
                    msg = f"Failed to create project task: {error_msg}"
                    self._log_structured(
                        "TOOL",
                        stage="exec_error",
                        name=name,
                        entry_point=entry_point,
                        message=msg,
                    )
                    update = {
                        "messages": [AIMessage(content=msg)],
                        "has_tool_call": False,
                        "requested_tool": None,
                        "tool_should_loopback": True,
                    }
                    return _attach_traces_and_loop_hint(update, status="error", error_text=msg)

                task = result.get("task") or {}
                task_id = (
                    task.get("object_id")
                    or task.get("id")
                    or result.get("object_id")
                    or ""
                )
                title = task.get("title") or "(untitled task)"
                status_val = task.get("status") or "todo"
                priority = task.get("priority") or "medium"
                due = task.get("due_date") or ""

                lines = [
                    "Project task created successfully.",
                    f"- Title: {title}",
                ]
                if task_id:
                    lines.append(f"- ID: {task_id}")
                lines.append(f"- Status: {status_val}")
                lines.append(f"- Priority: {priority}")
                if due:
                    lines.append(f"- Due date: {due}")

                summary_text = "\n".join(lines)

                self._log_structured(
                    "TOOL",
                    stage="call_success",
                    name=name,
                    entry_point=entry_point,
                    task_id=task_id,
                )

                try:
                    await emit_update_signal("project_tasks")
                except Exception:
                    pass

                update = {
                    "messages": [AIMessage(content=summary_text)],
                    "has_tool_call": False,
                    "requested_tool": None,
                    "tool_should_loopback": True,
                }
                return _attach_traces_and_loop_hint(update, status="success")

            if name in document_evaluation_tools:
                # EVALUATE a single project control with writer step: optional document_id
                context = state.get("context", {}) or {}
                jwt_token = context.get("jwt_token", "")
                org_id = context.get("org_id", "")
                project_id = context.get("project_id", "")

                if not jwt_token or not org_id or not project_id:
                    msg = "Missing authentication or project context for 'evaluate_document'."
                    self._log_structured(
                        "TOOL",
                        stage="exec_error",
                        name=name,
                        entry_point=entry_point,
                        message=msg,
                    )
                    update = {
                        "messages": [AIMessage(content=f"❌ {msg}")],
                        "has_tool_call": False,
                        "requested_tool": None,
                        "tool_should_loopback": True,
                    }
                    return _attach_traces_and_loop_hint(update, status="error", error_text=msg)

                document_id: str = ""
                if len(args) >= 1 and (args[0] or "").strip():
                    document_id = args[0].strip()
                else:
                    current_doc = context.get("project_current_document")
                    if isinstance(current_doc, dict):
                        document_id = (
                            current_doc.get("id")
                            or current_doc.get("object_id")
                            or ""
                        )
                    elif current_doc:
                        document_id = str(current_doc)

                if not document_id:
                    msg = (
                        "Cannot evaluate a document because no document_id was provided and there is "
                        "no currently selected document in the UI. Either open a document in the "
                        "project view or call the tool as: evaluate_document, <document_id>."
                    )
                    self._log_structured(
                        "TOOL",
                        stage="exec_error",
                        name=name,
                        entry_point=entry_point,
                        message=msg,
                    )
                    update = {
                        "messages": [AIMessage(content=f"❌ {msg}")],
                        "has_tool_call": False,
                        "requested_tool": None,
                        "tool_should_loopback": True,
                    }
                    return _attach_traces_and_loop_hint(update, status="error", error_text=msg)

                last_messages = [
                    {"role": m.type, "content": getattr(m, "content", "")}
                    for m in state.get("messages", [])[-15:]
                ]

                try:
                    await emit_data_thought(
                        f"Evaluating single project document via writer step (document_id='{document_id}')",
                        "tool_execution",
                    )
                except Exception:
                    pass

                try:
                    project_context_for_writer = _build_project_context_for_writer(state)
                    result = await self.project_content_tool.evaluate_single_project_document(
                        jwt_token=jwt_token,
                        org_id=org_id,
                        project_id=project_id,
                        document_id=document_id,
                        last_messages=last_messages,
                        project_context=project_context_for_writer,
                    )
                except Exception as e:  # pragma: no cover - defensive
                    msg = f"Unexpected error while evaluating project document '{document_id}': {str(e)}"
                    self._log_structured(
                        "TOOL",
                        stage="exec_error",
                        name=name,
                        entry_point=entry_point,
                        message=msg,
                    )
                    update = {
                        "messages": [AIMessage(content=f"❌ {msg}")],
                        "has_tool_call": False,
                        "requested_tool": None,
                        "tool_should_loopback": True,
                    }
                    return _attach_traces_and_loop_hint(update, status="error", error_text=msg)

                if not result or not result.get("success"):
                    error_msg = (result or {}).get("error", "Unknown error")
                    status_code = (result or {}).get("status_code")
                    msg = f"Failed to evaluate project document '{document_id}': {error_msg}"
                    self._log_structured(
                        "TOOL",
                        stage="exec_error",
                        name=name,
                        entry_point=entry_point,
                        message=msg,
                        status_code=status_code,
                    )
                    update = {
                        "messages": [AIMessage(content=f"❌ {msg}")],
                        "has_tool_call": False,
                        "requested_tool": None,
                        "tool_should_loopback": True,
                    }
                    return _attach_traces_and_loop_hint(update, status="error", error_text=msg)

                doc = result.get("document") or {}
                doc_id = doc.get("document_id") or document_id
                title = doc.get("title") or "(untitled document)"
                score = doc.get("relevance_score")
                category = doc.get("relevance_category") or "unknown"
                rationale = doc.get("rationale") or "No rationale provided by the model."
                updated_flag = bool(doc.get("updated"))
                evidence_info = doc.get("evidence") or {}

                lines: List[str] = []
                lines.append(f"Relevance evaluation completed for '{title}' (ID: {doc_id}).")
                lines.append(f"- Relevance score: {score} ({category})")
                lines.append(f"- Updated document content: {'yes' if updated_flag else 'no'}")
                lines.append("- Rationale: " + rationale)
                lines.append(
                    "\nThe sections \"Relevance to this project\", \"Relevance to our organization\", "
                    "and \"Implementation summary\" in this document have been written or refreshed. "
                    "Re-running this tool is safe; it refreshes these sections instead of duplicating them."
                )

                # Summarize evidence handling
                if evidence_info:
                    if evidence_info.get("processed"):
                        lines.append("")
                        lines.append("Evidence requests:")
                        lines.append(
                            f"- Existing requests updated: {evidence_info.get('updated', 0)} "
                            f"(marked low relevance: {evidence_info.get('marked_low', 0)})"
                        )
                        lines.append(
                            f"- New evidence requests created: {evidence_info.get('created', 0)}"
                        )
                        writer_summary = evidence_info.get("writer_summary")
                        if writer_summary:
                            lines.append("- Evidence summary: " + writer_summary)
                    else:
                        reason = evidence_info.get("reason") or evidence_info.get("error")
                        if reason:
                            lines.append("")
                            lines.append(
                                "Evidence requests were left unchanged: "
                                + str(reason)
                            )

                summary_text = "\n".join(lines)
	            	
                # Emit a thought describing how the document content was evaluated
                # and whether it was updated so the thought stream reflects the
                # document editing behavior, not just evidence changes.
                try:
                    doc_thought_parts: List[str] = []
                    doc_thought_parts.append(
                        f"Document relevance evaluation: '{title}' (ID: {doc_id})"
                    )
                    doc_thought_parts.append(
                        f"relevance_score={score} ({category})"
                    )
                    doc_thought_parts.append(
                        f"updated_document_content={'yes' if updated_flag else 'no'}"
                    )
                    if updated_flag:
                        doc_thought_parts.append(
                            'refreshed sections: "Relevance to this project", '
                            '"Relevance to our organization", "Implementation summary"'
                        )
                    await emit_data_thought(
                        "; ".join(doc_thought_parts), "tool_execution"
                    )
                except Exception:
                    # Thought emission must never break tool handling.
                    pass
        
                # Emit an additional thought describing how evidence was judged and
                # adjusted so the thought stream reflects more than just the raw
                # tool invocation.
                try:
                    evidence_thought: Optional[str] = None
                    if evidence_info:
                        if evidence_info.get("processed"):
                            updated_count = evidence_info.get("updated", 0)
                            marked_low = evidence_info.get("marked_low", 0)
                            created_count = evidence_info.get("created", 0)
                            parts: List[str] = []
                            parts.append(
                                f"updated {updated_count} existing evidence request(s)"
                            )
                            if marked_low:
                                parts.append(
                                    f"marked {marked_low} request(s) as low relevance"
                                )
                            if created_count:
                                parts.append(
                                    f"created {created_count} new evidence request(s)"
                                )
                            else:
                                parts.append("no new evidence requests were created")
                            writer_summary = evidence_info.get("writer_summary")
                            if writer_summary:
                                parts.append(f"writer assessment: {writer_summary}")
                            evidence_thought = (
                                "Evidence evaluation: " + "; ".join(parts)
                            )
                        else:
                            skip_reason = evidence_info.get("reason") or evidence_info.get(
                                "error"
                            )
                            if skip_reason:
                                evidence_thought = (
                                    "Evidence evaluation was skipped or left unchanged: "
                                    + str(skip_reason)
                                )
                    if evidence_thought:
                        await emit_data_thought(evidence_thought, "tool_execution")
                except Exception:
                    # Thought emission must never break tool handling.
                    pass

                self._log_structured(
                    "TOOL",
                    stage="call_success",
                    name=name,
                    entry_point=entry_point,
                    document_id=doc_id,
                    relevance_score=score,
                    relevance_category=category,
                )

                update = {
                    "messages": [AIMessage(content=summary_text)],
                    "has_tool_call": False,
                    "requested_tool": None,
                    "tool_should_loopback": True,
                }
                return _attach_traces_and_loop_hint(update, status="success")

            if name in project_evaluation_tools:
                # EVALUATE project controls with writer step: optional max_documents limit
                context = state.get("context", {}) or {}
                jwt_token = context.get("jwt_token", "")
                org_id = context.get("org_id", "")
                project_id = context.get("project_id", "")

                if not jwt_token or not org_id or not project_id:
                    msg = "Missing authentication or project context for 'evaluate_project'."
                    self._log_structured(
                        "TOOL",
                        stage="exec_error",
                        name=name,
                        entry_point=entry_point,
                        message=msg,
                    )
                    update = {
                        "messages": [AIMessage(content=f" {msg}")],
                        "has_tool_call": False,
                        "requested_tool": None,
                        "tool_should_loopback": True,
                    }
                    return _attach_traces_and_loop_hint(update, status="error", error_text=msg)

                # Parse optional arguments (only max_documents)
                max_documents: Optional[int] = None

                if len(args) >= 1 and (args[0] or "").strip():
                    try:
                        max_documents_val = int((args[0] or "").strip())
                        if max_documents_val > 0:
                            max_documents = max_documents_val
                    except Exception:
                        max_documents = None

                last_messages = [
                    {"role": m.type, "content": getattr(m, "content", "")}
                    for m in state.get("messages", [])[-15:]
                ]

                try:
                    await emit_data_thought(
                        "Evaluating project control documents via writer step",
                        "tool_execution",
                    )
                except Exception:
                    pass

                try:
                    project_context_for_writer = _build_project_context_for_writer(state)
                    result = await self.project_content_tool.evaluate_project_with_writer(
                        jwt_token=jwt_token,
                        org_id=org_id,
                        project_id=project_id,
                        max_documents=max_documents,
                        last_messages=last_messages,
                        project_context=project_context_for_writer,
                    )
                except Exception as e:  # pragma: no cover - defensive
                    msg = f"Unexpected error while evaluating project controls: {str(e)}"
                    self._log_structured(
                        "TOOL",
                        stage="exec_error",
                        name=name,
                        entry_point=entry_point,
                        message=msg,
                    )
                    update = {
                        "messages": [AIMessage(content=f" {msg}")],
                        "has_tool_call": False,
                        "requested_tool": None,
                        "tool_should_loopback": True,
                    }
                    return _attach_traces_and_loop_hint(update, status="error", error_text=msg)

                if not result or not result.get("success"):
                    error_msg = (result or {}).get("error", "Unknown error")
                    status_code = (result or {}).get("status_code")
                    msg = f"Failed to evaluate project controls: {error_msg}"
                    self._log_structured(
                        "TOOL",
                        stage="exec_error",
                        name=name,
                        entry_point=entry_point,
                        message=msg,
                        status_code=status_code,
                    )
                    update = {
                        "messages": [AIMessage(content=f" {msg}")],
                        "has_tool_call": False,
                        "requested_tool": None,
                        "tool_should_loopback": True,
                    }
                    return _attach_traces_and_loop_hint(update, status="error", error_text=msg)

                docs = result.get("documents") or []
                total = result.get("total_documents") or len(docs)

                # Build a concise human summary
                lines: List[str] = []
                lines.append(
                    f"Project control evaluation completed for {total} document(s)."
                )

                # Category breakdown
                if docs:
                    counts: Dict[str, int] = {}
                    for d in docs:
                        cat = d.get("relevance_category") or "unknown"
                        counts[cat] = counts.get(cat, 0) + 1

                    pretty_labels = {
                        "not_immediately_relevant": "Not immediately relevant (<15)",
                        "low": "Low priority (15-49)",
                        "medium": "Medium priority (50-79)",
                        "high": "High priority (80-100)",
                        "unknown": "Unknown",
                    }

                    lines.append("\n**Relevance breakdown**")
                    for key in [
                        "not_immediately_relevant",
                        "low",
                        "medium",
                        "high",
                        "unknown",
                    ]:
                        if counts.get(key):
                            lines.append(f"- {pretty_labels[key]}: {counts[key]} document(s)")

                    # Top and bottom documents by score
                    scored = [
                        d for d in docs
                        if isinstance(d.get("relevance_score"), (int, float))
                    ]
                    if scored:
                        scored_sorted = sorted(
                            scored,
                            key=lambda d: float(d.get("relevance_score") or 0.0),
                            reverse=True,
                        )
                        top_n = scored_sorted[:5]
                        bottom_n = list(reversed(scored_sorted[-5:]))

                        lines.append("\n**Most relevant controls (top up to 5)**")
                        for d in top_n:
                            did = d.get("document_id") or "?"
                            title = d.get("title") or "(untitled)"
                            score = d.get("relevance_score")
                            cat = d.get("relevance_category") or "unknown"
                            lines.append(
                                f"- {title} (ID: {did}, score: {score}, category: {cat})"
                            )

                        lines.append("\n**Least relevant controls (bottom up to 5)**")
                        for d in bottom_n:
                            did = d.get("document_id") or "?"
                            title = d.get("title") or "(untitled)"
                            score = d.get("relevance_score")
                            cat = d.get("relevance_category") or "unknown"
                            lines.append(
                                f"- {title} (ID: {did}, score: {score}, category: {cat})"
                            )

                lines.append(
                    "\nRelevance sections have been written/updated in the evaluated documents. "
                    "Re-running this tool is safe; it refreshes the existing 'Relevance to this project' section instead of duplicating it."
                )

                summary_text = "\n".join(lines)

                self._log_structured(
                    "TOOL",
                    stage="call_success",
                    name=name,
                    entry_point=entry_point,
                    total_documents=total,
                    max_documents=max_documents,
                )

                update = {
                    "messages": [AIMessage(content=summary_text)],
                    "has_tool_call": False,
                    "requested_tool": None,
                    "tool_should_loopback": True,
                }
                return _attach_traces_and_loop_hint(update, status="success")
            if name in template_search_tools:
                # Template search tools require 2 arguments: project_id and page_id
                if len(args) < 1 or not (args[0] or '').strip():
                    return error(f"missing arg1=project_id for '{name}'. Provide the project ID.")
                if len(args) < 2 or not (args[1] or '').strip():
                    return error(f"missing arg2=page_id for '{name}'. Provide the page ID to search for.")
                project_id = args[0].strip()
                page_id = args[1].strip()

                # Execute the tool
                try:
                    await emit_data_thought(f"Executing tool: {name} with page_id='{page_id}'", "tool_execution")
                except Exception:
                    pass

                # Get context for tool execution
                context = state.get("context", {})
                jwt_token = context.get("jwt_token", "")
                org_id = context.get("org_id", "")

                if not jwt_token or not org_id:
                    return error(f"Missing authentication context for tool execution")

                # Execute read_documentation_template tool
                if name == "read_documentation_template":
                    try:
                        result = self.project_content_tool.read_documentation_template(
                            jwt_token=jwt_token,
                            org_id=org_id,
                            project_id=project_id,
                            page_id=page_id
                        )

                        if result.get("success"):
                            # Tool succeeded - return the page content
                            page_title = result.get("title", "Unknown Page")
                            page_content = result.get("content", "")
                            page_id_result = result.get("id", "")

                            tool_result_message = f"""✅ Documentation Page Retrieved: {page_title}

                                **Page ID:** {page_id_result}

                                **Content:**
                                {page_content}"""

                            try:
                                await emit_data_thought(f"Tool executed successfully: {page_title}", "tool_execution")
                            except Exception:
                                pass

                            return {
                                "messages": [AIMessage(content=tool_result_message)],
                                "has_tool_call": False,
                                "requested_tool": None,
                            }
                        else:
                            # Tool failed - return error message
                            error_msg = result.get("error", "Unknown error")
                            hint = result.get("hint", "")

                            tool_error_message = f"""❌ Failed to retrieve documentation page

**Error:** {error_msg}
{f'**Hint:** {hint}' if hint else ''}"""

                            try:
                                await emit_error_thought(f"Tool execution failed: {error_msg}", "tool_execution")
                            except Exception:
                                pass

                            return {
                                "messages": [AIMessage(content=tool_error_message)],
                                "has_tool_call": False,
                                "requested_tool": None,
                            }
                    except Exception as e:
                        error_msg = f"Exception executing tool: {str(e)}"
                        try:
                            await emit_error_thought(error_msg, "tool_execution")
                        except Exception:
                            pass
                        return error(error_msg)

            if name in template_edit_tools:
                # edit_documentation_page: [project_id, page_id, content_instructions]
                # Uses writer step to generate markdown content from instructions
                if len(args) < 1 or not (args[0] or '').strip():
                    return error(f"missing arg1=project_id for '{name}'. Provide the project ID.")
                if len(args) < 2 or not (args[1] or '').strip():
                    return error(f"missing arg2=page_id for '{name}'. Provide the page ID to edit.")
                if len(args) < 3 or not (args[2] or '').strip():
                    return error(f"missing arg3=content_instructions for '{name}'. Provide content instructions.")

                project_id = args[0].strip()
                page_id = args[1].strip()
                content_instructions = args[2].replace('\\n', '\n').replace('\\t', '\t').replace('\\r', '\r')

                # Get context for tool execution
                context = state.get("context", {})
                jwt_token = context.get("jwt_token", "")
                org_id = context.get("org_id", "")

                if not jwt_token or not org_id:
                    return error(f"Missing authentication context for tool execution")

                try:
                    await emit_data_thought(f"🔄 Generating page content from instructions...", "tool_execution")
                except Exception:
                    pass

                try:
                    # Get last 15 messages for context
                    messages = state.get("messages", [])
                    last_messages = [
                        {"role": "user" if isinstance(msg, HumanMessage) else "assistant", "content": msg.content}
                        for msg in messages[-15:]
                    ]

                    # Call writer step
                    result = await self.project_content_tool.edit_documentation_page_with_writer(
                        jwt_token=jwt_token,
                        org_id=org_id,
                        project_id=project_id,
                        page_id=page_id,
                        content_instructions=content_instructions,
                        last_messages=last_messages
                    )

                    if result.get("success"):
                        try:
                            await emit_data_thought(f"✅ Page updated successfully", "tool_execution")
                            await emit_update_signal("documentation_template")  # Signal frontend to refresh
                            # Refresh documentation structure in session context
                            sid = state.get("session_id", "")
                            await self.refresh_documentation_structure(jwt_token, org_id, project_id, sid)
                        except Exception:
                            pass
                        return {
                            "messages": [AIMessage(content=f"✅ Page updated\n\n[Task could be complete - check if you just need to respond to user instead of calling other tools]")],
                            "has_tool_call": False,
                            "requested_tool": None,
                        }
                    else:
                        error_msg = result.get("error", "Unknown error")
                        try:
                            await emit_error_thought(f"❌ {error_msg}", "tool_execution")
                        except Exception:
                            pass
                        return {
                            "messages": [AIMessage(content=f"❌ Failed to edit page: {error_msg}")],
                            "has_tool_call": False,
                            "requested_tool": None,
                        }
                except Exception as e:
                    error_msg = f"Exception executing tool: {str(e)}"
                    try:
                        await emit_error_thought(error_msg, "tool_execution")
                    except Exception:
                        pass
                    return error(error_msg)

            if name in template_create_tools:
                # create_documentation_page: [project_id, page_instructions]
                # Uses writer step to generate page_title, page_id, and markdown content from instructions
                if len(args) < 1 or not (args[0] or '').strip():
                    return error(f"missing arg1=project_id for '{name}'. Provide the project ID.")
                if len(args) < 2 or not (args[1] or '').strip():
                    return error(f"missing arg2=page_instructions for '{name}'. Provide page instructions.")

                project_id = args[0].strip()
                page_instructions = args[1].replace('\\n', '\n').replace('\\t', '\t').replace('\\r', '\r')

                # Get context for tool execution
                context = state.get("context", {})
                jwt_token = context.get("jwt_token", "")
                org_id = context.get("org_id", "")

                if not jwt_token or not org_id:
                    return error(f"Missing authentication context for tool execution")

                try:
                    await emit_data_thought(f"🔄 Generating page structure and content from instructions...", "tool_execution")
                except Exception:
                    pass

                try:
                    # Get last 15 messages for context
                    messages = state.get("messages", [])
                    last_messages = [
                        {"role": "user" if isinstance(msg, HumanMessage) else "assistant", "content": msg.content}
                        for msg in messages[-15:]
                    ]

                    # Extract parent_id from instructions if provided (format: "parent_id: <id>")
                    parent_id = None
                    if "parent_id:" in page_instructions.lower():
                        try:
                            # Extract parent_id value
                            parts = page_instructions.lower().split("parent_id:")
                            if len(parts) > 1:
                                parent_part = parts[1].strip().split()[0]
                                # Remove any trailing punctuation (quotes, periods, etc.)
                                parent_part = parent_part.rstrip('"\'.,-;:')
                                print(f"[DEBUG] Extracted parent_id from instructions: '{parent_part}'", flush=True)
                                if parent_part and parent_part.lower() != "root":
                                    parent_id = parent_part
                                    print(f"[DEBUG] Using parent_id: '{parent_id}'", flush=True)
                        except Exception as e:
                            print(f"[DEBUG] Error extracting parent_id: {str(e)}", flush=True)
                            pass

                    # Call writer step - pass instructions for LLM to parse title and content
                    result = await self.project_content_tool.create_documentation_page_with_writer(
                        jwt_token=jwt_token,
                        org_id=org_id,
                        project_id=project_id,
                        content_instructions=page_instructions,
                        last_messages=last_messages,
                        parent_id=parent_id
                    )

                    if result.get("success"):
                        try:
                            await emit_data_thought(f"✅ Page created successfully", "tool_execution")
                            await emit_update_signal("documentation_template")  # Signal frontend to refresh
                            # Refresh documentation structure in session context
                            sid = state.get("session_id", "")
                            await self.refresh_documentation_structure(jwt_token, org_id, project_id, sid)
                        except Exception:
                            pass
                        return {
                            "messages": [AIMessage(content=f"✅ Page created\n\n[Task could be complete - check if you just need to respond to user instead of calling other tools]")],
                            "has_tool_call": False,
                            "requested_tool": None,
                        }
                    else:
                        error_msg = result.get("error", "Unknown error")
                        try:
                            await emit_error_thought(f"❌ {error_msg}", "tool_execution")
                        except Exception:
                            pass
                        return {
                            "messages": [AIMessage(content=f"❌ Failed to create page: {error_msg}")],
                            "has_tool_call": False,
                            "requested_tool": None,
                        }
                except Exception as e:
                    error_msg = f"Exception executing tool: {str(e)}"
                    try:
                        await emit_error_thought(error_msg, "tool_execution")
                    except Exception:
                        pass
                    return error(error_msg)

            if name in template_delete_tools:
                # delete_documentation_page: [project_id, page_id]
                if len(args) < 1 or not (args[0] or '').strip():
                    return error(f"missing arg1=project_id for '{name}'. Provide the project ID.")
                if len(args) < 2 or not (args[1] or '').strip():
                    return error(f"missing arg2=page_id for '{name}'. Provide the page ID to delete.")

                project_id = args[0].strip()
                page_id = args[1].strip()

                # Get context for tool execution
                context = state.get("context", {})
                jwt_token = context.get("jwt_token", "")
                org_id = context.get("org_id", "")

                if not jwt_token or not org_id:
                    return error(f"Missing authentication context for tool execution")

                try:
                    await emit_data_thought(f"Deleting documentation page: {page_id}", "tool_execution")
                except Exception:
                    pass

                try:
                    result = self.project_content_tool.delete_documentation_page(
                        jwt_token=jwt_token,
                        org_id=org_id,
                        project_id=project_id,
                        page_id=page_id
                    )

                    if result.get("success"):
                        message = result.get("message", "Page deleted successfully")
                        deleted_title = result.get("deleted_page_title", "Unknown")
                        try:
                            await emit_data_thought(f"✅ {message}", "tool_execution")
                            await emit_update_signal("documentation_template")  # Signal frontend to refresh
                            # Refresh documentation structure in session context
                            sid = state.get("session_id", "")
                            await self.refresh_documentation_structure(jwt_token, org_id, project_id, sid)
                        except Exception:
                            pass
                        return {
                            "messages": [AIMessage(content=f"✅ {message} (Title: {deleted_title})\n\n[Task could be complete - check if you just need to respond to user instead of calling other tools]")],
                            "has_tool_call": False,
                            "requested_tool": None,
                        }
                    else:
                        error_msg = result.get("error", "Unknown error")
                        try:
                            await emit_error_thought(f"❌ {error_msg}", "tool_execution")
                        except Exception:
                            pass
                        return {
                            "messages": [AIMessage(content=f"❌ Failed to delete page: {error_msg}")],
                            "has_tool_call": False,
                            "requested_tool": None,
                        }
                except Exception as e:
                    error_msg = f"Exception executing tool: {str(e)}"
                    try:
                        await emit_error_thought(error_msg, "tool_execution")
                    except Exception:
                        pass
                    return error(error_msg)

            if name in template_reassign_tools:
                # reassign_documentation_page: [project_id, page_id, new_parent_id]
                if len(args) < 1 or not (args[0] or '').strip():
                    return error(f"missing arg1=project_id for '{name}'. Provide the project ID.")
                if len(args) < 2 or not (args[1] or '').strip():
                    return error(f"missing arg2=page_id for '{name}'. Provide the page ID to reassign.")
                if len(args) < 3 or not (args[2] or '').strip():
                    return error(f"missing arg3=new_parent_id for '{name}'. Provide the new parent page ID (or 'root' for root level).")

                project_id = args[0].strip()
                page_id = args[1].strip()
                new_parent_id_arg = args[2].strip()

                # Convert "root" or empty to None
                new_parent_id = None if new_parent_id_arg.lower() == "root" else new_parent_id_arg

                # Get context for tool execution
                context = state.get("context", {})
                jwt_token = context.get("jwt_token", "")
                org_id = context.get("org_id", "")

                if not jwt_token or not org_id:
                    return error(f"Missing authentication context for tool execution")

                try:
                    parent_info = f"under '{new_parent_id}'" if new_parent_id else "at root level"
                    await emit_data_thought(f"Moving page {page_id} {parent_info}...", "tool_execution")
                except Exception:
                    pass

                try:
                    result = self.project_content_tool.reassign_page_parent(
                        jwt_token=jwt_token,
                        org_id=org_id,
                        project_id=project_id,
                        page_id=page_id,
                        new_parent_id=new_parent_id
                    )

                    if result.get("success"):
                        message = result.get("message", "Page reassigned successfully")
                        try:
                            await emit_data_thought(f"✅ {message}", "tool_execution")
                            await emit_update_signal("documentation_template")  # Signal frontend to refresh
                            # Refresh documentation structure in session context
                            sid = state.get("session_id", "")
                            await self.refresh_documentation_structure(jwt_token, org_id, project_id, sid)
                        except Exception:
                            pass
                        return {
                            "messages": [AIMessage(content=f"✅ {message}\n\n[Task could be complete - check if you just need to respond to user instead of calling other tools]")],
                            "has_tool_call": False,
                            "requested_tool": None,
                        }
                    else:
                        error_msg = result.get("error", "Unknown error")
                        try:
                            await emit_error_thought(f"❌ {error_msg}", "tool_execution")
                        except Exception:
                            pass
                        return {
                            "messages": [AIMessage(content=f"❌ Failed to reassign page: {error_msg}")],
                            "has_tool_call": False,
                            "requested_tool": None,
                        }
                except Exception as e:
                    error_msg = f"Exception executing tool: {str(e)}"
                    try:
                        await emit_error_thought(error_msg, "tool_execution")
                    except Exception:
                        pass
                    return error(error_msg)

            if name in auditor_list_tools:
                # list_auditors: [project_id]
                if len(args) < 1 or not (args[0] or '').strip():
                    return error(f"missing arg1=project_id for '{name}'. Provide the project ID.")

                project_id = args[0].strip()

                # Get context for tool execution
                context = state.get("context", {})
                jwt_token = context.get("jwt_token", "")
                org_id = context.get("org_id", "")

                if not jwt_token or not org_id:
                    return error(f"Missing authentication context for tool execution")

                try:
                    await emit_data_thought(f"Fetching auditors for project: {project_id}", "tool_execution")
                except Exception:
                    pass

                try:
                    result = self.auditor_tool.list_auditors(
                        jwt_token=jwt_token,
                        org_id=org_id,
                        project_id=project_id
                    )

                    if result.get("success"):
                        auditors = result.get("auditors", [])
                        if not auditors:
                            return {
                                "messages": [AIMessage(content="No auditors found for this project.")],
                                "has_tool_call": False,
                                "requested_tool": None,
                            }

                        auditors_text = "**Auditors for this project:**\n\n"
                        for auditor in auditors:
                            auditors_text += f"- **{auditor['name']}** (ID: `{auditor['object_id']}`)\n"
                            auditors_text += f"  Description: {auditor['description']}\n"
                            auditors_text += f"  Status: {'✅ Active' if auditor['is_active'] else '⏸️ Inactive'}\n"
                            auditors_text += f"  Schedule: {auditor['schedule']}\n"
                            auditors_text += f"  Last Run: {auditor.get('last_run_at', 'Never')}\n\n"

                        try:
                            await emit_data_thought(f"✅ Retrieved {len(auditors)} auditors", "tool_execution")
                        except Exception:
                            pass

                        return {
                            "messages": [AIMessage(content=auditors_text)],
                            "has_tool_call": False,
                            "requested_tool": None,
                        }
                    else:
                        error_msg = result.get("error", "Unknown error")
                        try:
                            await emit_error_thought(f"❌ {error_msg}", "tool_execution")
                        except Exception:
                            pass
                        return {
                            "messages": [AIMessage(content=f"❌ Failed to fetch auditors: {error_msg}")],
                            "has_tool_call": False,
                            "requested_tool": None,
                        }
                except Exception as e:
                    error_msg = f"Exception executing tool: {str(e)}"
                    try:
                        await emit_error_thought(error_msg, "tool_execution")
                    except Exception:
                        pass
                    return error(error_msg)

            if name in auditor_view_tools:
                # view_auditor: [project_id, auditor_id]
                if len(args) < 1 or not (args[0] or '').strip():
                    return error(f"missing arg1=project_id for '{name}'. Provide the project ID.")
                if len(args) < 2 or not (args[1] or '').strip():
                    return error(f"missing arg2=auditor_id for '{name}'. Provide the auditor ID.")

                project_id = args[0].strip()
                auditor_id = args[1].strip()

                context = state.get("context", {})
                jwt_token = context.get("jwt_token", "")
                org_id = context.get("org_id", "")

                if not jwt_token or not org_id:
                    return error(f"Missing authentication context for tool execution")

                try:
                    await emit_data_thought(f"Fetching auditor: {auditor_id}", "tool_execution")
                except Exception:
                    pass

                try:
                    result = self.auditor_tool.view_auditor(
                        jwt_token=jwt_token,
                        org_id=org_id,
                        project_id=project_id,
                        auditor_id=auditor_id
                    )

                    if result.get("success"):
                        auditor = result.get("auditor", {})
                        instructions = auditor.get("instructions", {})
                        requirements = instructions.get("requirements", [])

                        auditor_text = f"**Auditor: {auditor['name']}**\n\n"
                        auditor_text += f"**Description:** {auditor['description']}\n\n"
                        auditor_text += f"**Status:** {'✅ Active' if auditor['is_active'] else '⏸️ Inactive'}\n"
                        auditor_text += f"**Schedule:** {auditor['schedule']}\n"
                        auditor_text += f"**Passing Score:** {instructions.get('passing_score', 'N/A')}%\n\n"

                        auditor_text += f"**Requirements ({len(requirements)}):**\n\n"
                        for req in requirements:
                            auditor_text += f"- **{req['title']}** (ID: `{req['id']}`)\n"
                            auditor_text += f"  Weight: {req['weight']}%\n"
                            auditor_text += f"  Description: {req['description']}\n\n"

                        return {
                            "messages": [AIMessage(content=auditor_text)],
                            "has_tool_call": False,
                            "requested_tool": None,
                        }
                    else:
                        error_msg = result.get("error", "Unknown error")
                        return {
                            "messages": [AIMessage(content=f"❌ Failed to fetch auditor: {error_msg}")],
                            "has_tool_call": False,
                            "requested_tool": None,
                        }
                except Exception as e:
                    return error(f"Exception executing tool: {str(e)}")

            if name in auditor_create_tools:
                # create_auditor: [project_id, auditor_name, content_instructions]
                # Uses writer step to generate fields from content instructions
                if len(args) < 1 or not (args[0] or '').strip():
                    return error(f"missing arg1=project_id for '{name}'.")
                if len(args) < 2 or not (args[1] or '').strip():
                    return error(f"missing arg2=auditor_name for '{name}'.")
                if len(args) < 3 or not (args[2] or '').strip():
                    return error(f"missing arg3=content_instructions for '{name}'.")
                print(f"args: {args}", flush=True)
                project_id = args[0].strip()
                auditor_name = args[1].strip()
                content_instructions = args[2].strip()

                context = state.get("context", {})
                jwt_token = context.get("jwt_token", "")
                org_id = context.get("org_id", "")

                if not jwt_token or not org_id:
                    print(f"Missing authentication context for tool execution", flush=True)
                    return error(f"Missing authentication context for tool execution")


                try:
                    await emit_data_thought(f"🔄 Generating auditor fields from content instructions...", "tool_execution")
                except Exception:
                    pass

                try:
                    # Get last 15 messages for context
                    messages = state.get("messages", [])
                    last_messages = [
                        {"role": "user" if isinstance(msg, HumanMessage) else "assistant", "content": msg.content}
                        for msg in messages[-15:]
                    ]

                    # Call writer step
                    result = await self.auditor_tool.create_auditor_with_writer(
                        jwt_token=jwt_token,
                        org_id=org_id,
                        project_id=project_id,
                        auditor_name=auditor_name,
                        content_instructions=content_instructions,
                        last_messages=last_messages
                    )

                    if result.get("success"):
                        try:
                            await emit_data_thought(f"✅ Generated auditor fields successfully", "tool_execution")
                        except Exception:
                            pass

                        # Include auditor ID in message so LLM knows what was created
                        auditor_id = result.get("object_id", "unknown")
                        message = f"✅ Auditor created successfully\n- Name: {auditor_name}\n- ID: {auditor_id}\n\n[Task could be complete - check if you just need to respond to user instead of calling other tools]"
                        try:
                            await emit_data_thought(message, "tool_execution")
                            await emit_update_signal("auditors")
                        except Exception:
                            pass
                        return {
                            "messages": [AIMessage(content=message)],
                            "has_tool_call": False,
                            "requested_tool": None,
                        }
                    else:
                        error_msg = result.get("error", "Unknown error")
                        # Short error response (< 20 words)
                        message = f"❌ Failed to create auditor"
                        return {
                            "messages": [AIMessage(content=message)],
                            "has_tool_call": False,
                            "requested_tool": None,
                        }
                except Exception as e:
                    return error(f"Exception executing tool: {str(e)}")

            if name in auditor_edit_tools:
                # edit_auditor: [project_id, auditor_id, content_instructions]
                # Uses writer step to generate update fields from content instructions
                if len(args) < 1 or not (args[0] or '').strip():
                    return error(f"missing arg1=project_id for '{name}'.")
                if len(args) < 2 or not (args[1] or '').strip():
                    return error(f"missing arg2=auditor_id for '{name}'.")
                if len(args) < 3 or not (args[2] or '').strip():
                    return error(f"missing arg3=content_instructions for '{name}'.")


                project_id = args[0].strip()
                auditor_id = args[1].strip()
                content_instructions = args[2].strip()

                context = state.get("context", {})
                jwt_token = context.get("jwt_token", "")
                org_id = context.get("org_id", "")

                if not jwt_token or not org_id:
                    return error(f"Missing authentication context for tool execution")

                try:
                    await emit_data_thought(f"📋 Fetching current auditor details...", "tool_execution")
                except Exception:
                    pass

                try:
                    # First, fetch current auditor
                    current_result = self.auditor_tool.view_auditor(
                        jwt_token=jwt_token,
                        org_id=org_id,
                        project_id=project_id,
                        auditor_id=auditor_id
                    )

                    if not current_result.get("success"):
                        return {
                            "messages": [AIMessage(content=f"❌ Failed to fetch auditor: {current_result.get('error')}")],
                            "has_tool_call": False,
                            "requested_tool": None,
                        }

                    current_auditor = current_result.get("auditor", {})

                    try:
                        await emit_data_thought(f"🔄 Generating update fields from content instructions...", "tool_execution")
                    except Exception:
                        pass

                    # Get last 15 messages for context
                    messages = state.get("messages", [])
                    last_messages = [
                        {"role": "user" if isinstance(msg, HumanMessage) else "assistant", "content": msg.content}
                        for msg in messages[-15:]
                    ]

                    # Call writer step
                    result = await self.auditor_tool.edit_auditor_with_writer(
                        jwt_token=jwt_token,
                        org_id=org_id,
                        project_id=project_id,
                        auditor_id=auditor_id,
                        content_instructions=content_instructions,
                        current_auditor=current_auditor,
                        last_messages=last_messages
                    )

                    if result.get("success"):
                        try:
                            await emit_data_thought(f"✅ Generated update fields successfully", "tool_execution")
                        except Exception:
                            pass

                        # Include auditor ID in message so LLM knows what was updated
                        message = f"✅ Auditor updated successfully\n- ID: {auditor_id}\n\n[Task could be complete - check if you just need to respond to user instead of calling other tools]"
                        try:
                            await emit_data_thought(message, "tool_execution")
                            await emit_update_signal("auditors")
                        except Exception:
                            pass
                        return {
                            "messages": [AIMessage(content=message)],
                            "has_tool_call": False,
                            "requested_tool": None,
                        }
                    else:
                        # Short error response (< 20 words)
                        message = f"❌ Failed to update auditor"
                        return {
                            "messages": [AIMessage(content=message)],
                            "has_tool_call": False,
                            "requested_tool": None,
                        }
                except Exception as e:
                    return error(f"Exception executing tool: {str(e)}")

            # ============ AGENT TOOLS ============
            if name in agent_list_tools:
                try:
                    project_id = args[0] if len(args) > 0 else None
                    if not project_id:
                        return error("list_agents requires project_id")

                    context = state.get("context", {})
                    jwt_token = context.get("jwt_token", "")
                    org_id = context.get("org_id", "")

                    if not jwt_token or not org_id:
                        return error(f"Missing authentication context for tool execution")

                    result = self.agent_tool.list_agents(
                        jwt_token=jwt_token,
                        org_id=org_id,
                        project_id=project_id
                    )

                    if result.get("success"):
                        agents = result.get("agents", [])
                        if not agents:
                            message = "No agents found for this project."
                        else:
                            message = f"Found {len(agents)} agent(s):\n\n"
                            for agent in agents:
                                message += f"- **{agent['name']}** (ID: `{agent['id']}`)\n"
                                message += f"  Description: {agent.get('description', 'N/A')}\n"
                                message += f"  Status: {'✅ Active' if agent.get('is_active') else '⏸️ Inactive'}\n\n"
                        return {
                            "messages": [AIMessage(content=message)],
                            "has_tool_call": False,
                            "requested_tool": None,
                        }
                    else:
                        message = f"❌ Failed to list agents: {result.get('error', 'Unknown error')}"
                        return {
                            "messages": [AIMessage(content=message)],
                            "has_tool_call": False,
                            "requested_tool": None,
                        }
                except Exception as e:
                    return error(f"Exception executing tool: {str(e)}")

            if name in agent_view_tools:
                try:
                    project_id = args[0] if len(args) > 0 else None
                    agent_id = args[1] if len(args) > 1 else None
                    if not project_id or not agent_id:
                        return error("view_agent requires project_id and agent_id")

                    context = state.get("context", {})
                    jwt_token = context.get("jwt_token", "")
                    org_id = context.get("org_id", "")

                    if not jwt_token or not org_id:
                        return error(f"Missing authentication context for tool execution")

                    result = self.agent_tool.view_agent(
                        jwt_token=jwt_token,
                        org_id=org_id,
                        project_id=project_id,
                        agent_id=agent_id
                    )

                    if result.get("success"):
                        agent = result.get("agent", {})
                        message = f"**Agent: {agent['name']}**\n\n"
                        message += f"**Description:** {agent.get('description', 'N/A')}\n\n"
                        message += f"**Status:** {'✅ Active' if agent.get('is_active') else '⏸️ Inactive'}\n"
                        message += f"**Schedule:** {agent.get('schedule', 'N/A')}\n\n"
                        message += f"**Data Sources:** {', '.join(agent.get('data_sources', []))}\n\n"
                        message += f"**Instructions:** {agent.get('instructions', 'N/A')}\n\n"
                        message += f"**Output Format:** {agent.get('output_format', 'N/A')}\n"
                        return {
                            "messages": [AIMessage(content=message)],
                            "has_tool_call": False,
                            "requested_tool": None,
                        }
                    else:
                        message = f"❌ Failed to view agent: {result.get('error', 'Unknown error')}"
                        return {
                            "messages": [AIMessage(content=message)],
                            "has_tool_call": False,
                            "requested_tool": None,
                        }
                except Exception as e:
                    return error(f"Exception executing tool: {str(e)}")

            if name in agent_create_tools:
                try:
                    project_id = args[0] if len(args) > 0 else None
                    agent_name = args[1] if len(args) > 1 else None
                    content_instructions = args[2] if len(args) > 2 else None

                    if not project_id or not agent_name or not content_instructions:
                        return error("create_agent requires project_id, agent_name, and content_instructions")

                    context = state.get("context", {})
                    jwt_token = context.get("jwt_token", "")
                    org_id = context.get("org_id", "")

                    if not jwt_token or not org_id:
                        return error(f"Missing authentication context for tool execution")

                    # Get last 15 messages for context
                    last_messages = [
                        {"role": msg.type, "content": msg.content}
                        for msg in state.get("messages", [])[-15:]
                    ]

                    try:
                        await emit_data_thought(f"🤖 Creating agent: {agent_name}", "tool_execution")
                    except Exception:
                        pass

                    result = await self.agent_tool.create_agent_with_writer(
                        jwt_token=jwt_token,
                        org_id=org_id,
                        project_id=project_id,
                        agent_name=agent_name,
                        content_instructions=content_instructions,
                        last_messages=last_messages
                    )

                    if result.get("success"):
                        agent_id = result.get("object_id")
                        message = f"✅ Agent created successfully\n- Name: {agent_name}\n- ID: {agent_id}\n\n[Task could be complete - check if you just need to respond to user instead of calling other tools]"
                        try:
                            await emit_data_thought(message, "tool_execution")
                            await emit_update_signal("agents")
                        except Exception:
                            pass
                        return {
                            "messages": [AIMessage(content=message)],
                            "has_tool_call": False,
                            "requested_tool": None,
                        }
                    else:
                        message = f"❌ Failed to create agent: {result.get('error', 'Unknown error')}"
                        return {
                            "messages": [AIMessage(content=message)],
                            "has_tool_call": False,
                            "requested_tool": None,
                        }
                except Exception as e:
                    return error(f"Exception executing tool: {str(e)}")

            if name in agent_edit_tools:
                try:
                    project_id = args[0] if len(args) > 0 else None
                    agent_id = args[1] if len(args) > 1 else None
                    content_instructions = args[2] if len(args) > 2 else None

                    if not project_id or not agent_id or not content_instructions:
                        return error("edit_agent requires project_id, agent_id, and content_instructions")

                    context = state.get("context", {})
                    jwt_token = context.get("jwt_token", "")
                    org_id = context.get("org_id", "")

                    if not jwt_token or not org_id:
                        return error(f"Missing authentication context for tool execution")

                    # Fetch current agent
                    current_result = self.agent_tool.view_agent(
                        jwt_token=jwt_token,
                        org_id=org_id,
                        project_id=project_id,
                        agent_id=agent_id
                    )

                    if not current_result.get("success"):
                        return error(f"Failed to fetch current agent: {current_result.get('error')}")

                    current_agent = current_result.get("agent", {})

                    # Get last 15 messages for context
                    last_messages = [
                        {"role": msg.type, "content": msg.content}
                        for msg in state.get("messages", [])[-15:]
                    ]

                    try:
                        await emit_data_thought(f"🤖 Updating agent: {agent_id}", "tool_execution")
                    except Exception:
                        pass

                    result = await self.agent_tool.edit_agent_with_writer(
                        jwt_token=jwt_token,
                        org_id=org_id,
                        project_id=project_id,
                        agent_id=agent_id,
                        content_instructions=content_instructions,
                        current_agent=current_agent,
                        last_messages=last_messages
                    )

                    if result.get("success"):
                        try:
                            await emit_data_thought(f"✅ Generated update fields successfully", "tool_execution")
                        except Exception:
                            pass

                        message = f"✅ Agent updated successfully\n- ID: {agent_id}\n\n[Task could be complete - check if you just need to respond to user instead of calling other tools]"
                        try:
                            await emit_data_thought(message, "tool_execution")
                            await emit_update_signal("agents")
                        except Exception:
                            pass
                        return {
                            "messages": [AIMessage(content=message)],
                            "has_tool_call": False,
                            "requested_tool": None,
                        }
                    else:
                        message = f"❌ Failed to update agent"
                        return {
                            "messages": [AIMessage(content=message)],
                            "has_tool_call": False,
                            "requested_tool": None,
                        }
                except Exception as e:
                    return error(f"Exception executing tool: {str(e)}")

            if name in agent_delete_tools:
                try:
                    project_id = args[0] if len(args) > 0 else None
                    agent_id = args[1] if len(args) > 1 else None

                    if not project_id or not agent_id:
                        return error("delete_agent requires project_id and agent_id")

                    context = state.get("context", {})
                    jwt_token = context.get("jwt_token", "")
                    org_id = context.get("org_id", "")

                    if not jwt_token or not org_id:
                        return error(f"Missing authentication context for tool execution")

                    result = self.agent_tool.delete_agent(
                        jwt_token=jwt_token,
                        org_id=org_id,
                        project_id=project_id,
                        agent_id=agent_id
                    )

                    if result.get("success"):
                        message = f"✅ Agent deleted successfully\n- ID: {agent_id}\n\n[Task could be complete - check if you just need to respond to user instead of calling other tools]"
                        try:
                            await emit_data_thought(message, "tool_execution")
                            await emit_update_signal("agents")
                        except Exception:
                            pass
                        return {
                            "messages": [AIMessage(content=message)],
                            "has_tool_call": False,
                            "requested_tool": None,
                        }
                    else:
                        message = f"❌ Failed to delete agent: {result.get('error', 'Unknown error')}"
                        return {
                            "messages": [AIMessage(content=message)],
                            "has_tool_call": False,
                            "requested_tool": None,
                        }
                except Exception as e:
                    return error(f"Exception executing tool: {str(e)}")

            # ============ CONTEXT UPDATE TOOLS ============
            if name in context_update_tools:
                # Logic moved into tools.context_tool.apply_update_context to centralize update_context behavior
                try:
                    ok, err_msg, content_instructions = validate_update_context_args(args)
                    if not ok:
                        if err_msg:
                            print(f"ae3f4521283 ❌ {err_msg}")
                        return error(err_msg or "update_context requires content_instructions")

                    result_state = await apply_update_context(state, content_instructions, self.context_tool)
                    return _attach_traces_and_loop_hint(result_state, status="success")
                except Exception as e:
                    return error(f"Exception executing tool: {str(e)}")

            # ============ SCF CONFIG TOOLS ============
            if name in scf_config_tools:
                try:
                    context = state.get("context", {}) or {}

                    # SCF task management tool (controls loopback and task lifecycle)
                    if name == SCF_TASKS_TOOL_NAME:
                        ok, err_msg, payload = validate_scf_tasks_args(args)
                        if not ok:
                            return error(err_msg or f"Invalid arguments for '{name}'.")

                        # Enforce: no new tasks while an active task exists
                        action = payload.get("action")
                        if action == "create_task":
                            tasks = context.get("scf_tasks") or []
                            if isinstance(tasks, list):
                                active = [
                                    t for t in tasks
                                    if str(t.get("status", "")).upper() in {"PENDING", "IN_PROGRESS"}
                                ]
                                if active:
                                    return error(
                                        "cannot create a new SCF task while another task is still "
                                        "PENDING or IN_PROGRESS."
                                    )

                        # Execute task action and log TASK changes
                        old_tasks = context.get("scf_tasks") or []
                        result_state = apply_scf_tasks_action(state, payload)
                        new_context = result_state.get("context", context) or {}
                        new_tasks = new_context.get("scf_tasks") or []
                        self._log_scf_task_change(
                            session_id=state.get("session_id"),
                            action=action,
                            payload=payload,
                            old_tasks=old_tasks,
                            new_tasks=new_tasks,
                        )
                        self._log_structured(
                            "TOOL",
                            stage="call_success",
                            name=name,
                            entry_point=entry_point,
                            action=action,
                        )
                        return _attach_traces_and_loop_hint(result_state, status="success")

                    # SCF coverage overlap tool (framework/core-level overlap metrics)
                    if name == SCF_COVERAGE_OVERLAP_TOOL_NAME:
                        ok, err_msg, cov_payload = validate_scf_coverage_overlap_args(args)
                        if not ok:
                            return error(err_msg or f"Invalid arguments for '{name}'.")

                        ok2, err2, summary = fetch_overlap_summary(cov_payload)
                        if not ok2:
                            msg = err2 or "Failed to fetch SCF coverage overlap."
                            self._log_structured(
                                "TOOL",
                                stage="exec_error",
                                name=name,
                                entry_point=entry_point,
                                message=msg,
                            )
                            return error(msg)

                        self._log_structured(
                            "TOOL",
                            stage="call_success",
                            name=name,
                            entry_point=entry_point,
                            summary_preview=(summary or "")[:200],
                        )

                        internal_tool_message = AIMessage(
                            content=f"[TOOL_STATUS] {name} result: {summary}",
                            additional_kwargs={"internal_tool_status": True, "tool_name": name},
                        )

                        update = {
                            "messages": [internal_tool_message, AIMessage(content=summary)],
                            "has_tool_call": False,
                            "requested_tool": None,
                            "tool_should_loopback": True,
                        }
                        return _attach_traces_and_loop_hint(update, status="success")

                    # SCF risks/threats coverage tool (single subject coverage metrics)
                    if name == SCF_RISKS_THREATS_TOOL_NAME:
                        ok, err_msg, cov_payload = validate_scf_risks_threats_args(args)
                        if not ok:
                            return error(err_msg or f"Invalid arguments for '{name}'.")

                        ok2, err2, summary = fetch_risks_threats_summary(cov_payload)
                        if not ok2:
                            msg = err2 or "Failed to fetch SCF risks/threats coverage."
                            self._log_structured(
                                "TOOL",
                                stage="exec_error",
                                name=name,
                                entry_point=entry_point,
                                message=msg,
                            )
                            return error(msg)


                        self._log_structured(
                            "TOOL",
                            stage="call_success",
                            name=name,
                            entry_point=entry_point,
                            summary_preview=(summary or "")[:200],
                        )

                        internal_tool_message = AIMessage(
                            content=f"[TOOL_STATUS] {name} result: {summary}",
                            additional_kwargs={"internal_tool_status": True, "tool_name": name},
                        )

                        update = {
                            "messages": [internal_tool_message, AIMessage(content=summary)],
                            "has_tool_call": False,
                            "requested_tool": None,
                            "tool_should_loopback": True,
                        }
                        return _attach_traces_and_loop_hint(update, status="success")


                    # SCF risks catalog tool (list all SCF risks)
                    if name == SCF_LIST_RISKS_TOOL_NAME:
                        ok, err_msg, _payload = validate_scf_list_risks_args(args)
                        if not ok:
                            return error(err_msg or f"Invalid arguments for '{name}'.")

                        ok2, err2, summary = fetch_all_risks()
                        if not ok2:
                            msg = err2 or "Failed to fetch SCF risks catalog."
                            self._log_structured(
                                "TOOL",
                                stage="exec_error",
                                name=name,
                                entry_point=entry_point,
                                message=msg,
                            )
                            return error(msg)

                        self._log_structured(
                            "TOOL",
                            stage="call_success",
                            name=name,
                            entry_point=entry_point,
                            summary_preview=(summary or "")[:200],
                        )

                        update = {
                            "messages": [AIMessage(content=summary)],
                            "has_tool_call": False,
                            "requested_tool": None,
                            "tool_should_loopback": True,
                        }
                        return _attach_traces_and_loop_hint(update, status="success")

                    # SCF threats catalog tool (list all SCF threats)
                    if name == SCF_LIST_THREATS_TOOL_NAME:
                        ok, err_msg, _payload = validate_scf_list_threats_args(args)
                        if not ok:
                            return error(err_msg or f"Invalid arguments for '{name}'.")

                        ok2, err2, summary = fetch_all_threats()
                        if not ok2:
                            msg = err2 or "Failed to fetch SCF threats catalog."
                            self._log_structured(
                                "TOOL",
                                stage="exec_error",
                                name=name,
                                entry_point=entry_point,
                                message=msg,
                            )
                            return error(msg)

                        self._log_structured(
                            "TOOL",
                            stage="call_success",
                            name=name,
                            entry_point=entry_point,
                            summary_preview=(summary or "")[:200],
                        )

                        update = {
                            "messages": [AIMessage(content=summary)],
                            "has_tool_call": False,
                            "requested_tool": None,
                            "tool_should_loopback": True,
                        }
                        return _attach_traces_and_loop_hint(update, status="success")


                    # SCF minimum weight tool (set min_weight threshold 0-10)
                    if name == SCF_SET_MIN_WEIGHT_TOOL_NAME:
                        ok, err_msg, min_weight = validate_scf_min_weight_args(args)
                        if not ok:
                            return error(err_msg or f"Invalid arguments for '{name}'.")

                        try:
                            # Only adjust the minimum weight threshold; do not modify existing
                            # framework/core-level filters so the user's current view is preserved.
                            ui_actions = [
                                {
                                    "scope": "scf",
                                    "target": "scf_config",
                                    "type": "ui.set_filters",
                                    "params": {
                                        "min_weight": min_weight,
                                    },
                                },
                            ]
                            await emit_update_signal("scf_filters", ui_actions=ui_actions)
                        except Exception:
                            # Never fail the tool execution just because UI signalling failed.
                            pass

                        self._log_structured(
                            "TOOL",
                            stage="call_success",
                            name=name,
                            entry_point=entry_point,
                            min_weight=min_weight,
                        )

                        result_state = apply_scf_min_weight(state, min_weight)
                        return _attach_traces_and_loop_hint(result_state, status="success")

                    # SCF reset filters and selection tool
                    if name == SCF_RESET_FILTERS_TOOL_NAME:
                        ok, err_msg, reset_payload = validate_scf_reset_filters_args(args)
                        if not ok:
                            return error(err_msg or f"Invalid arguments for '{name}'.")

                        try:
                            # Frontend now exposes a single canonical UI action to completely
                            # reset filters and selection in the SCF page. This replaces the
                            # previous approach where we sent ui.set_filters + ui.select_controls.
                            ui_actions = [
                                {
                                    "scope": "scf",
                                    "target": "scf_config",
                                    "type": "ui.reset_filters_and_selection",
                                    # No params expected by the frontend for this action.
                                },
                            ]
                            await emit_update_signal("scf_filters", ui_actions=ui_actions)
                        except Exception:
                            # Never fail the tool execution just because UI signalling failed.
                            pass

                        self._log_structured(
                            "TOOL",
                            stage="call_success",
                            name=name,
                            entry_point=entry_point,
                            reset_filters=True,
                        )

                        result_state = apply_scf_reset_filters(state, reset_payload)
                        return _attach_traces_and_loop_hint(result_state, status="success")

                    # SCF "all done" tool (stop loopback and end the turn)
                    if name == SCF_ALL_DONE_TOOL_NAME:
                        ok, err_msg, done_payload = validate_scf_all_done_args(args)
                        if not ok:
                            return error(err_msg or f"Invalid arguments for '{name}'.")

                        self._log_structured(
                            "TOOL",
                            stage="call_success",
                            name=name,
                            entry_point=entry_point,
                            all_done=True,
                        )

                        result_state = apply_scf_all_done(state, done_payload)
                        return _attach_traces_and_loop_hint(result_state, status="success")

                    # SCF controls selection / filter tool
                    if name == SCF_CONTROLS_TOOL_NAME:
                        ok, err_msg, normalized_frameworks = validate_scf_controls_args(args)
                        if not ok:
                            return error(err_msg or f"Invalid arguments for '{name}'.")

                        # Tell the frontend SCF configurator to apply these filters via UI actions.
                        # This uses the generic 'update' event with a scoped ui_actions payload as
                        # described by the frontend dev:
                        #   - First action: ui.set_filters with coverage_frameworks
                        try:
                            # Build SCF filter params for the frontend. Validation of the LLM
                            # output (normalized_frameworks) is handled in the tool module; here
                            # we only shape the UI message.
                            #
                            # normalized_frameworks may now contain a mix of coverage frameworks
                            # (e.g. SOC2, ISO27001) and SCF core levels (L0, L1, L2, AI_OPS).
                            # We need to split them so the frontend receives the right fields.
                            core_level_keys = {"L0", "L1", "L2", "AI_OPS"}

                            selected_core_levels = [
                                f for f in normalized_frameworks
                                if f in core_level_keys
                            ]
                            coverage_frameworks = [
                                f for f in normalized_frameworks
                                if f not in core_level_keys
                            ]


                            # Only set filters; do not auto-select controls and do not
                            # override min_weight from the backend/frontend defaults.
                            filter_params = {
                                "coverage_frameworks": coverage_frameworks,
                                "core_levels": selected_core_levels,
                            }

                            ui_actions = [
                                {
                                    "scope": "scf",
                                    "target": "scf_config",
                                    "type": "ui.set_filters",
                                    "params": filter_params,
                                },
                            ]
                            await emit_update_signal("scf_filters", ui_actions=ui_actions)
                        except Exception:

                            # Never fail the tool execution just because UI signalling failed.
                            pass

                        # Log successful SCF controls selection
                        self._log_structured(
                            "TOOL",
                            stage="call_success",
                            name=name,
                            entry_point=entry_point,
                            normalized_frameworks=normalized_frameworks,
                            coverage_frameworks=coverage_frameworks,
                            core_levels=selected_core_levels,
                        )

                        # Execution is delegated to the tool module so behavior is centralized there
                        result_state = apply_scf_controls_selection(state, normalized_frameworks)
                        return _attach_traces_and_loop_hint(result_state, status="success")

                    # SCF timeline windows tool
                    if name == SCF_SET_TIMELINE_WINDOWS_TOOL_NAME:
                        ok, err_msg, payload = validate_set_timeline_windows_args(args)
                        if not ok:
                            return error(err_msg or f"Invalid arguments for '{name}'.")

                        try:
                            # Tell the SCF frontend to apply these implementation windows. The
                            # payload from the tool module already has the shape expected by the
                            # UI: {"mode": "merge"|"replace", "windows": [{"goal", "start_month", "end_month"}, ...]}.
                            ui_actions = [
                                {
                                    "scope": "scf",
                                    "target": "scf_config",
                                    "type": "ui.set_timeline_windows",
                                    "params": {
                                        "mode": payload.get("mode"),
                                        "windows": payload.get("windows", []),
                                    },
                                },
                            ]
                            # Frontend docs expect update_type "scf" for timeline updates.
                            await emit_update_signal("scf", ui_actions=ui_actions)
                        except Exception:
                            # Never fail the tool execution just because UI signalling failed.
                            pass

                        self._log_structured(
                            "TOOL",
                            stage="call_success",
                            name=name,
                            entry_point=entry_point,
                            mode=payload.get("mode"),
                            window_count=len(payload.get("windows", [])),
                        )

                        result_state = apply_set_timeline_windows(state, payload)
                        return _attach_traces_and_loop_hint(result_state, status="success")

                    # SCF timeline order tool
                    if name == SCF_SET_TIMELINE_ORDER_TOOL_NAME:
                        ok, err_msg, order = validate_set_timeline_order_args(args)
                        if not ok:
                            return error(err_msg or f"Invalid arguments for '{name}'.")

                        try:
                            ui_actions = [
                                {
                                    "scope": "scf",
                                    "target": "scf_config",
                                    "type": "ui.set_timeline_order",
                                    "params": {"order": order},
                                },
                            ]
                            await emit_update_signal("scf", ui_actions=ui_actions)
                        except Exception:
                            # Never fail the tool execution just because UI signalling failed.
                            pass

                        self._log_structured(
                            "TOOL",
                            stage="call_success",
                            name=name,
                            entry_point=entry_point,
                            order=order,
                        )

                        result_state = apply_set_timeline_order(state, order)
                        return _attach_traces_and_loop_hint(result_state, status="success")

                    # SCF reset timeline tool
                    if name == SCF_RESET_TIMELINE_TOOL_NAME:
                        ok, err_msg, payload = validate_reset_timeline_args(args)
                        if not ok:
                            return error(err_msg or f"Invalid arguments for '{name}'.")

                        try:
                            ui_actions = [
                                {
                                    "scope": "scf",
                                    "target": "scf_config",
                                    "type": "ui.reset_timeline",
                                    # No params expected by the frontend for this action.
                                },
                            ]
                            await emit_update_signal("scf", ui_actions=ui_actions)
                        except Exception:
                            # Never fail the tool execution just because UI signalling failed.
                            pass

                        self._log_structured(
                            "TOOL",
                            stage="call_success",
                            name=name,
                            entry_point=entry_point,
                            reset_timeline=True,
                        )

                        result_state = apply_reset_timeline(state, payload)
                        return _attach_traces_and_loop_hint(result_state, status="success")

                except Exception as e:
                    msg = f"Exception executing {name}: {str(e)}"
                    self._log_structured(
                        "TOOL",
                        stage="exec_error",
                        name=name,
                        entry_point=entry_point,
                        message=msg,
                    )
                    return error(msg)


            # ============ ONBOARDING TOOLS ============
            if name in onboarding_tools:
                if name == "configure_scf":
                    try:
                        try:
                            await emit_data_thought(f"🔧 Configuring Security Controls Framework (SCF)...", "tool_execution")
                        except Exception:
                            pass

                        # Best-effort: persist chat memory for this user from the current state
                        try:
                            await self.save_chat_memory_from_state(state)
                        except Exception as mem_err:
                            print(f"[CHAT_MEMORY] Failed to save chat memory on configure_scf: {mem_err}", flush=True)

                        # When configure_scf is called, persist the current state to Redis
                        # and emit a redirect event so the frontend can open the SCF config view
                        try:
                            await self._save_session_snapshot_from_state(state)
                            sid = state.get("session_id", "")
                            if sid:
                                await emit_redirect_signal("scf", sid)
                        except Exception as snapshot_err:
                            # Log but don't surface to user; worst case, redirect happens without snapshot
                            print(f"[DEBUG] Failed to snapshot/redirect on configure_scf: {snapshot_err}", flush=True)

                        return {
                            "messages": [],  # Empty - don't send message to user
                            "has_tool_call": False,
                            "requested_tool": None,
                            "tool_should_loopback": False,  # Don't loop back to LLM_chat after configure_scf
                        }
                    except Exception as e:
                        return error(f"Exception executing configure_scf: {str(e)}")

            # Fallback (shouldn't hit due to supported_tools check)
            return error(f"no validator implemented for '{name}'.")

        async def workflow_node(state: AgentState) -> AgentState:
            """Minimal workflow node: emit a thought, add a dummy message, clear flags."""
            wf = state.get("requested_workflow")
            try:
                if wf:
                    await emit_workflow_thought(f"Starting workflow: {wf}", "workflow")
            except Exception:
                pass
            # requested_workflow is List[str] like [name, arg1, ...]
            wf_name = None
            wf_args: List[str] = []
            if isinstance(wf, list) and wf:
                wf_name, *wf_args = wf
            elif isinstance(wf, str):
                wf_name = wf
            args_str = (', '.join(wf_args)) if wf_args else ''

            return {
                "messages": [AIMessage(content=f"dummy workflow called, this is a normal dummy response, user knows what to do. {(' (' + wf_name + (' ' + args_str if args_str else '') + ')') if wf_name else ''}")],
                "has_workflow": False,
                "requested_workflow": None,
            }

        async def llm_answer(state: AgentState) -> AgentState:
            """Pass-through LLM node after tool/workflow. Actual reply already sent."""
            print("llm_answer: pass-through after tool/workflow", flush=True)
            return {}


        async def compliance_analysis(state: AgentState) -> AgentState:
            """Task-driven compliance analysis with individual task evaluation"""

            return await self.process_codebase_selection(state)

        async def ack_end(state: AgentState) -> AgentState:
            print("ack_end: ending leg after no-codebases hint", flush=True)
            # Return empty dict to avoid re-emitting previous messages
            return {}

        async def ask_codebase(state: AgentState) -> AgentState:
            # Build the options however you like
            options = state["context"].get("lightweight_codebase_context", {}) or {}
            total = options.get("total_codebases")
            if total is None:
                total = len(options.get("codebases", []) or [])

            print(f"ask_codebase: {options}\n")

            # Safeguard: if no codebases exist, add a friendly AI hint and end the leg
            if total == 0:
                hint = "Hmmm, I don't see any code to look at, did you already add your codebases?"
                print("ask_codebase: no codebases available, sending hint instead of interrupt", flush=True)
                return {"messages": [AIMessage(content=hint)], "no_codebases_ack": True}

            # Send a *structured* payload to the client
            selection = interrupt({
                "type": "ask_codebase",
                "message": "Select one or more codebases to analyze.",
                "options": options
            })
            # On resume, `selection` is whatever the client sent back (e.g. ["api"]) or a raw string
            # Store it in a transient field so routing is interrupt-first and leg-scoped
            return {"selection_raw": selection}

        ### router
        def route_from_classify(s: AgentState) -> str:
            has_wf = bool(s.get("has_workflow"))
            has_tool = bool(s.get("has_tool_call"))
            route = "workflow" if has_wf else ("tool_call" if has_tool else "ack_end")
            print(f"route_from_classify: route={route} (has_workflow={has_wf}, has_tool_call={has_tool})", flush=True)
            self._log_structured(
                "ROUTE",
                stage="from_classify",
                route=route,
                has_workflow=has_wf,
                has_tool_call=has_tool,
            )
            return route

        def route_from_tool_call(s: AgentState) -> str:
            """Route after tool execution: loop back to LLM_chat or end based on tool_should_loopback flag"""
            should_loopback = s.get("tool_should_loopback", True)  # Default to loopback
            route = "LLM_chat" if should_loopback else "ack_end"
            print(f"route_from_tool_call: route={route} (tool_should_loopback={should_loopback})", flush=True)
            self._log_structured(
                "ROUTE",
                stage="from_tool_call",
                route=route,
                tool_should_loopback=should_loopback,
            )
            return route

        workflow = StateGraph(AgentState)
        workflow.add_node("LLM_chat", LLM_chat)
        workflow.add_node("tool_call", tool_call)
        workflow.add_node("workflow", workflow_node)
        workflow.add_node("llm_answer", llm_answer)
        workflow.add_node("ack_end", ack_end)
        # legacy nodes kept but unused in this path
        workflow.add_node("ask_codebase", ask_codebase)
        workflow.add_node("compliance_analysis", compliance_analysis)

        workflow.set_entry_point("LLM_chat")

        workflow.add_conditional_edges(
            "LLM_chat", route_from_classify,
            {
                "workflow": "workflow",
                "tool_call": "tool_call",
                "ack_end": "ack_end",
            },
        )

        # Optional: keep a loop if selection is invalid/missing
        workflow.add_conditional_edges(
            "ask_codebase",
            # Route decisions:
            # - If transient selection provided this leg -> compliance_analysis
            # - Else if no_codebases_ack was emitted -> ack_end (end leg)
            # - Else -> stay on ask_codebase (loop)
            (lambda s: (
                "compliance_analysis" if (s.get("selection_raw") or s.get("selected_codebases_delta")) else (
                    "ack_end" if s.get("no_codebases_ack") else "ask_codebase"
                )
            )),
            {"ask_codebase": "ask_codebase", "compliance_analysis": "compliance_analysis", "ack_end": "ack_end"},
        )

        # After executing a tool, conditionally loop back to LLM_chat based on tool_should_loopback flag
        workflow.add_conditional_edges(
            "tool_call", route_from_tool_call,
            {
                "LLM_chat": "LLM_chat",
                "ack_end": "ack_end",
            },
        )

        # After executing a workflow, always loop back to LLM_chat
        workflow.add_edge("workflow", "LLM_chat")

        workflow.add_edge("llm_answer", END)
        workflow.add_edge("ack_end", END)
        workflow.add_edge("compliance_analysis", END)

        return workflow





    async def initialize_session(
        self,
        session_id: str,
        context: Dict[str, Any],
        entry_point: str = "project_view",
        resume_session_id: Optional[str] = None,
    ) -> None:
        """Initialize session with user context, with optional resume from Redis.

        Args:
            session_id: Unique identifier for this WebSocket session.
            context: Context dict with user/org/project info from the backend.
            entry_point: Where chat was opened from (onboarding, project_view, dashboard, etc.).
            resume_session_id: Optional ID of a previous session to resume from Redis.
        """

        print(
            f"[INIT] initialize_session: session_id={session_id}, entry_point={entry_point}, "
            f"resume_session_id={resume_session_id}",
            flush=True,
        )

        # If a resume_session_id is provided, try to load a snapshot from Redis first.
        if resume_session_id and self.redis_client is not None:
            print(
                f"[INIT] Attempting to load Redis snapshot for resume_session_id={resume_session_id}",
                flush=True,
            )
            snapshot = await self._load_session_snapshot(resume_session_id)
            if snapshot:
                # Backwards-compatible: existing snapshots store session fields at the top level.
                snapshot_session = snapshot.get("session") or snapshot
                snapshot_user_id = snapshot.get("user_id")

                # Derive the current user_id from fresh backend context
                user_info = context.get("user_info") or {}
                fresh_user_id = (
                    context.get("user_id")
                    or user_info.get("id")
                    or user_info.get("user_id")
                    or user_info.get("sub")
                )

                if not snapshot_user_id or not fresh_user_id or str(snapshot_user_id) != str(fresh_user_id):
                    # User mismatch or missing IDs – delete the snapshot and fail
                    await self._delete_session_snapshot(resume_session_id)
                    raise ValueError(
                        "Unable to resume session: user mismatch or missing user information. "
                        "Please start a new chat."
                    )

                # User matches – adopt the stored session as-is, but update entry_point
                restored_context = snapshot_session.get("context") or {}
                restored_context["entry_point"] = entry_point

                # Mark that this SCF session was reached via redirect so the LLM
                # can send a recap instead of us hard-coding that message here.
                if entry_point == "scf_config":
                    restored_context["scf_redirected"] = True

                snapshot_session["context"] = restored_context

                self.sessions[session_id] = snapshot_session
                # Mark this session as active/open now that it has an attached WebSocket.
                self.mark_session_active(session_id)
                print(
                    f"[DEBUG] Restored session from Redis: resume_session_id={resume_session_id}, "
                    f"new_session_id={session_id}, user_id={fresh_user_id}",
                    flush=True,
                )
                return

            print(
                f"[INIT] No Redis snapshot found for resume_session_id={resume_session_id}; "
                f"will fall back to in-memory session handling for session_id={session_id}",
                flush=True,
            )

        # No resume requested or no snapshot found – create a fresh session or reuse existing in-memory
        if session_id not in self.sessions:
            print(
                f"[INIT] Creating new in-memory session: session_id={session_id}, "
                f"entry_point={entry_point}",
                flush=True,
            )
            self.sessions[session_id] = {
                "messages": [],
                "tokens_used": 0,
                "credits_consumed": 0.0,
                "created_at": datetime.now().isoformat(),
            }
        else:
            print(
                f"[INIT] Reusing existing in-memory session: session_id={session_id}, "
                f"entry_point={entry_point}",
                flush=True,
            )

        # Store project context (already fetched in main.py during initialization)
        # Context now includes: project_info, documentation_structure, policy_names
        session_context = {
            **context,
            # Project context is already in the context dict from main.py
            # Initialize content caches for on-demand fetching
            "fetched_documentation_pages": {},
            "fetched_policies": {},
            "entry_point": entry_point,  # Store entry point for prompt selection
        }

        self.sessions[session_id]["context"] = session_context
        # Mark this session as active/open now that initialization is complete.
        self.mark_session_active(session_id)
