"""Public (unauthenticated) GraphLang agent.

This agent is deliberately small and self-contained:
- Single-node LangGraph workflow.
- GPT-5.1 with structured Pydantic output.
- Separate prompt from the main authenticated agent.
"""

import os
from typing import Any, Dict, Optional, List

from langgraph.graph import StateGraph, END
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_openai import ChatOpenAI
from pydantic import BaseModel
from typing_extensions import TypedDict

from prompts_public import get_public_context_prompt


class PublicResponse(BaseModel):
    """Structured response returned by the public agent.

    This is what the WebSocket handler will serialize and send back to clients.
    """

    answer: str
    topic: Optional[str] = None
    should_end: bool = False


class PublicAgentState(TypedDict, total=False):
    """Minimal state for the public agent LangGraph workflow."""

    user_input: str
    response: Dict[str, Any]
    history: List[Dict[str, str]]


class PublicAgent:
    """Simple public agent with a single LangGraph node.

    The graph just:
    - Builds a public-context prompt.
    - Calls GPT-5.1 with structured output (PublicResponse).
    - Stores the structured response back into the state.

    The agent can optionally be constructed with a custom LLM for testing.
    """

    def __init__(self, llm_client: Optional[BaseChatModel] = None) -> None:
        """Initialize the public agent.

        If no custom LLM client is provided, we mirror the configuration used by
        RouterAgent: read the base model and API key from environment
        variables. This avoids depending on OPENAI_API_KEY being set, since the
        existing codebase uses OPENAI_KEY.
        """

        if llm_client is not None:
            self.llm = llm_client
        else:
            base_llm_model = os.getenv("DEFAULT_LLM_MODEL", "gpt-5.1")
            self.llm = ChatOpenAI(
                model=base_llm_model,
                temperature=0.5,
                api_key=os.getenv("OPENAI_KEY"),
            )
        self.graph = self._build_graph()

    def _build_graph(self):
        workflow = StateGraph(PublicAgentState)

        async def public_chat(state: PublicAgentState) -> PublicAgentState:
            """Single graph node that calls GPT-5.1 with structured output."""

            user_input = state.get("user_input", "")
            history = state.get("history")  # Optional[List[Dict[str, str]]]
            prompt_text = get_public_context_prompt(
                user_input=user_input,
                session_id="public",
                short_history=history,
            )

            messages = [
                SystemMessage(content=prompt_text),
                # Redundant but keeps a clear separation between system instructions
                # and the raw user message for future tuning.
                HumanMessage(content=user_input),
            ]

            structured_llm = self.llm.with_structured_output(PublicResponse)

            try:
                structured_response: PublicResponse = await structured_llm.ainvoke(messages)
            except Exception:
                # Best-effort fallback if the structured call fails.
                structured_response = PublicResponse(
                    answer="Sorry, I had trouble responding just now. Please try again.",
                    topic=None,
                    should_end=False,
                )

            new_state: PublicAgentState = dict(state)
            new_state["response"] = structured_response.model_dump()
            return new_state

        workflow.add_node("public_chat", public_chat)
        workflow.set_entry_point("public_chat")
        workflow.add_edge("public_chat", END)

        return workflow.compile()

    async def run_turn(
        self,
        user_message: str,
        session_id: str,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> PublicResponse:
        """Run a single turn of the public agent and return a structured response.

        `history` is an optional list of the last few messages in this tab,
        used only to provide a bit more context to the public prompt. It is not
        persisted across browser sessions.
        """

        initial_state: PublicAgentState = {"user_input": user_message}
        if history:
            initial_state["history"] = history
        final_state = await self.graph.ainvoke(
            initial_state,
            config={"configurable": {"thread_id": session_id}},
        )
        raw = final_state.get("response", {}) or {}
        return PublicResponse(**raw)

