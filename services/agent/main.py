import asyncio
import json
import os
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel
import requests
from langgraph.types import Command
from langgraph.errors import GraphRecursionError
from langchain_core.messages import AIMessage
from redis.asyncio import Redis
from agent import RouterAgent
from contextlib import asynccontextmanager
# Import message emitter (package-relative)
from emitters.message_emitter import MessageEmitter, set_global_message_emitter
from observability import init_telemetry, instrument_fastapi, instrument_clients



# Backend API configuration
BACKEND_API_URL = "http://app:8080"  # Using HTTP instead of HTTPS
REQUEST_TIMEOUT = 10.0  # seconds

# Store active WebSocket connections
active_connections: Dict[str, WebSocket] = {}


telemetry_shutdown = init_telemetry()
instrument_clients()

agent = RouterAgent()  # <-- define before lifespan


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting GraphLang Agent...", flush=True)

    # Initialize Redis client for session persistence and inject into agent
    redis_client: Optional[Redis] = None
    redis_url = os.getenv("REDIS_URL")
    redis_password = os.getenv("REDIS_PASSWORD") or None

    if redis_url:
        try:
            redis_client = Redis.from_url(
                redis_url,
                password=redis_password,
                decode_responses=True,
            )
            agent.redis_client = redis_client
            print(
                f"[DEBUG] Connected to Redis at {redis_url} for session persistence",
                flush=True,
            )
        except Exception as e:
            print(
                f"[DEBUG] Failed to initialize Redis client: {e}. Session persistence disabled.",
                flush=True,
            )
    else:
        print(
            "[DEBUG] REDIS_URL not set. Redis-backed session persistence is disabled.",
            flush=True,
        )

    await agent.startup()  # opens AsyncSqliteSaver and compiles graph
    try:
        yield
    finally:
        # Close Redis client if it was created
        if redis_client is not None:
            try:
                await redis_client.close()
            except Exception as e:
                print(f"[DEBUG] Error while closing Redis client: {e}", flush=True)

        await agent.shutdown()  # closes saver cleanly
        # Best-effort flush of telemetry on shutdown.
        try:
            telemetry_shutdown()
        except Exception:
            pass


app = FastAPI(title="GraphLang Agent", version="1.0.0", lifespan=lifespan)
instrument_fastapi(app)

def fetch_user_info(jwt_token: str) -> Optional[Dict[str, Any]]:
    """Fetch user information from backend API"""
    try:
        headers = {"Authorization": f"Bearer {jwt_token}"}
        response = requests.get(
            f"{BACKEND_API_URL}/api/v1/users/me",
            headers=headers,
            timeout=REQUEST_TIMEOUT
        )

        if response.status_code == 200:
            return response.json()
        elif response.status_code == 401:
            print(f"❌ Authentication failed: Invalid JWT token or unauthorized access", flush=True)
            return None
        else:
            print(f"❌ Failed to fetch user info: HTTP {response.status_code} - {response.text}", flush=True)
            return None

    except requests.exceptions.Timeout as e:
        print(f"❌ Timeout fetching user info from {BACKEND_API_URL}: {e}", flush=True)
        return None
    except requests.exceptions.ConnectionError as e:
        print(f"❌ Connection error to backend API {BACKEND_API_URL}: {e}", flush=True)
        return None
    except Exception as e:
        print(f"❌ Unexpected error fetching user info: {e}", flush=True)
        return None

def fetch_org_info(jwt_token: str, org_id: str) -> Optional[Dict[str, Any]]:
    """Fetch organization information from backend API"""
    try:
        headers = {
            "Authorization": f"Bearer {jwt_token}",
            "Content-Type": "application/json"
        }
        response = requests.get(
            f"{BACKEND_API_URL}/api/v1/org/{org_id}",
            headers=headers,
            timeout=REQUEST_TIMEOUT
        )

        if response.status_code == 200:
            return response.json()
        elif response.status_code == 401:
            print(f"❌ Unauthorized to fetch org {org_id}: Invalid JWT token", flush=True)
            return None
        elif response.status_code == 404:
            print(f"❌ Organization {org_id} not found", flush=True)
            return None
        else:
            print(f"❌ Failed to fetch org info: HTTP {response.status_code} - {response.text}", flush=True)
            return None

    except requests.exceptions.Timeout as e:
        print(f"❌ Timeout fetching org info: {e}", flush=True)
        return None
    except requests.exceptions.ConnectionError as e:
        print(f"❌ Connection error fetching org info: {e}", flush=True)
        return None
    except Exception as e:
        print(f"❌ Unexpected error fetching org info: {e}", flush=True)
        return None

def fetch_codebases(jwt_token: str, org_id: str) -> Optional[List[Dict[str, Any]]]:
    """Fetch codebases list from backend API"""
    try:
        headers = {
            "Authorization": f"Bearer {jwt_token}",
            "Content-Type": "application/json"
        }
        response = requests.get(
            f"{BACKEND_API_URL}/api/v1/org/{org_id}/codebase",
            headers=headers,
            timeout=REQUEST_TIMEOUT
        )

        if response.status_code == 200:
            return response.json()
        elif response.status_code == 404:
            print(f"⚠️  No codebases found for org {org_id}", flush=True)
            return []  # Return empty list for 404 as it's not an error
        elif response.status_code == 401:
            print(f"❌ Unauthorized to fetch codebases: Invalid JWT token", flush=True)
            return None
        else:
            print(f"❌ Failed to fetch codebases: HTTP {response.status_code} - {response.text}", flush=True)
            return None

    except requests.exceptions.Timeout as e:
        print(f"❌ Timeout fetching codebases: {e}", flush=True)
        return None
    except requests.exceptions.ConnectionError as e:
        print(f"❌ Connection error fetching codebases: {e}", flush=True)
        return None
    except Exception as e:
        print(f"❌ Unexpected error fetching codebases: {e}", flush=True)
        return None

def fetch_project_info(jwt_token: str, org_id: str, project_id: str) -> Optional[Dict[str, Any]]:
    """Fetch project information from backend API"""
    try:
        headers = {
            "Authorization": f"Bearer {jwt_token}",
            "Content-Type": "application/json"
        }
        response = requests.get(
            f"{BACKEND_API_URL}/api/v1/org/{org_id}/project/{project_id}",
            headers=headers,
            timeout=REQUEST_TIMEOUT
        )

        if response.status_code == 200:
            data = response.json()
            print(f"✅ Fetched project info: type={type(data).__name__}, content={str(data)[:200]}", flush=True)
            return data
        elif response.status_code == 401:
            print(f"❌ Unauthorized to fetch project: Invalid JWT token", flush=True)
            return None
        elif response.status_code == 404:
            print(f"❌ Project {project_id} not found", flush=True)
            return None
        else:
            print(f"❌ Failed to fetch project info: HTTP {response.status_code} - {response.text}", flush=True)
            return None

    except requests.exceptions.Timeout as e:
        print(f"❌ Timeout fetching project info: {e}", flush=True)
        return None
    except requests.exceptions.ConnectionError as e:
        print(f"❌ Connection error fetching project info: {e}", flush=True)
        return None
    except Exception as e:
        print(f"❌ Unexpected error fetching project info: {e}", flush=True)
        return None

def fetch_documentation_template(jwt_token: str, org_id: str, project_id: str) -> Optional[Dict[str, Any]]:
    """Fetch documentation template structure (pages only, no content)"""
    try:
        headers = {
            "Authorization": f"Bearer {jwt_token}",
            "Content-Type": "application/json"
        }
        response = requests.get(
            f"{BACKEND_API_URL}/api/v1/org/{org_id}/project/{project_id}/documentation-template",
            headers=headers,
            timeout=REQUEST_TIMEOUT
        )

        if response.status_code == 200:
            data = response.json()
            print(f"✅ Fetched documentation template: type={type(data).__name__}, content={str(data)[:200]}", flush=True)
            return data
        elif response.status_code == 401:
            print(f"❌ Unauthorized to fetch documentation: Invalid JWT token", flush=True)
            return None
        elif response.status_code == 404:
            print(f"⚠️  No documentation template found for project {project_id}", flush=True)
            return {"pages": []}
        else:
            print(f"❌ Failed to fetch documentation template: HTTP {response.status_code} - {response.text}", flush=True)
            return None

    except requests.exceptions.Timeout as e:
        print(f"❌ Timeout fetching documentation template: {e}", flush=True)
        return None
    except requests.exceptions.ConnectionError as e:
        print(f"❌ Connection error fetching documentation template: {e}", flush=True)
        return None
    except Exception as e:
        print(f"❌ Unexpected error fetching documentation template: {e}", flush=True)
        return None

def fetch_policy_templates(jwt_token: str, org_id: str, project_id: str) -> Optional[Dict[str, Any]]:
    """Fetch policy templates (names and metadata only, no content)"""
    try:
        headers = {
            "Authorization": f"Bearer {jwt_token}",
            "Content-Type": "application/json"
        }
        response = requests.get(
            f"{BACKEND_API_URL}/api/v1/org/{org_id}/project/{project_id}/policy-template",
            headers=headers,
            timeout=REQUEST_TIMEOUT
        )

        if response.status_code == 200:
            data = response.json()
            print(f"✅ Fetched policy templates: type={type(data).__name__}, content={str(data)[:200]}", flush=True)
            return data
        elif response.status_code == 401:
            print(f"❌ Unauthorized to fetch policies: Invalid JWT token", flush=True)
            return None
        elif response.status_code == 404:
            print(f"⚠️  No policy templates found for project {project_id}", flush=True)
            return {"policy_templates": []}
        else:
            print(f"❌ Failed to fetch policy templates: HTTP {response.status_code} - {response.text}", flush=True)
            return None

    except requests.exceptions.Timeout as e:
        print(f"❌ Timeout fetching policy templates: {e}", flush=True)
        return None
    except requests.exceptions.ConnectionError as e:
        print(f"❌ Connection error fetching policy templates: {e}", flush=True)
        return None
    except Exception as e:
        print(f"❌ Unexpected error fetching policy templates: {e}", flush=True)
        return None

def fetch_auditors(jwt_token: str, org_id: str, project_id: str) -> Optional[List[Dict[str, Any]]]:
    """Fetch auditors list from backend API"""
    try:
        headers = {
            "Authorization": f"Bearer {jwt_token}",
            "Content-Type": "application/json"
        }
        response = requests.get(
            f"{BACKEND_API_URL}/api/v1/org/{org_id}/project/{project_id}/auditor",
            headers=headers,
            timeout=REQUEST_TIMEOUT
        )

        if response.status_code == 200:
            data = response.json()
            # Handle both dict response with "auditors" key and direct list response
            if isinstance(data, dict):
                auditors = data.get("auditors", [])
            elif isinstance(data, list):
                auditors = data
            else:
                print(f"❌ Unexpected response format for auditors: {type(data)}", flush=True)
                return None

            # Extract summary info for context
            auditors_summary = []
            for auditor in auditors:
                auditors_summary.append({
                    "object_id": auditor.get("object_id"),
                    "name": auditor.get("name"),
                    "title": auditor.get("name"),  # For quick reference
                    "description": auditor.get("description"),
                    "is_active": auditor.get("is_active"),
                    "schedule": auditor.get("schedule")
                })
            print(f"✅ Fetched {len(auditors_summary)} auditors", flush=True)
            return auditors_summary
        elif response.status_code == 401:
            print(f"❌ Unauthorized to fetch auditors: Invalid JWT token", flush=True)
            return None
        elif response.status_code == 404:
            print(f"⚠️  No auditors found for project {project_id}", flush=True)
            return []
        else:
            print(f"❌ Failed to fetch auditors: HTTP {response.status_code} - {response.text}", flush=True)
            return None

    except requests.exceptions.Timeout as e:
        print(f"❌ Timeout fetching auditors: {e}", flush=True)
        return None
    except requests.exceptions.ConnectionError as e:
        print(f"❌ Connection error fetching auditors: {e}", flush=True)
        return None
    except Exception as e:
        print(f"❌ Unexpected error fetching auditors: {e}", flush=True)
        return None

def parse_chat_memory(chat_memory_str: Optional[str]) -> Dict[str, Any]:
    """Parse chat_memory JSON string and format it for agent context"""
    default_memory = {
        "summary": "",
        "last_messages": [],
        "current_tasks": []
    }

    if not chat_memory_str:
        return default_memory

    try:
        chat_memory = json.loads(chat_memory_str)

        # Extract and format the required fields
        formatted_memory = {
            "summary": chat_memory.get("summary", ""),
            "last_messages": chat_memory.get("last_messages", []),
            "current_tasks": chat_memory.get("current_tasks", [])
        }

        # Ensure all fields are the correct type
        if not isinstance(formatted_memory["summary"], str):
            formatted_memory["summary"] = str(formatted_memory["summary"]) if formatted_memory["summary"] else ""

        if not isinstance(formatted_memory["last_messages"], list):
            formatted_memory["last_messages"] = []
        else:
            # Ensure all messages are strings
            formatted_memory["last_messages"] = [str(msg) for msg in formatted_memory["last_messages"]]

        if not isinstance(formatted_memory["current_tasks"], list):
            formatted_memory["current_tasks"] = []
        else:
            # Ensure all tasks are strings
            formatted_memory["current_tasks"] = [str(task) for task in formatted_memory["current_tasks"]]

        return formatted_memory

    except (json.JSONDecodeError, TypeError, AttributeError):
        return default_memory

async def handle_initialization(websocket: WebSocket, init_data: dict, session_id: str):
    """Handle session initialization with user context and project data fetching

    Args:
        websocket: WebSocket connection
        init_data: Initialization data with user_id, org_id, jwt_token, and optional project_id, entry_point
        session_id: Unique session identifier
    """
    try:
        user_id = init_data.get("user_id")
        org_id = init_data.get("org_id")
        project_id = init_data.get("project_id")
        jwt_token = init_data.get("jwt_token")
        entry_point = init_data.get("entry_point", "project_view")  # Default to project_view for backwards compatibility
        resume_session_id = init_data.get("resume_session_id")

        print(f"🔐 Initializing session {session_id}", flush=True)
        print(f"   user_id: {user_id}", flush=True)
        print(f"   org_id: {org_id}", flush=True)
        print(f"   project_id: {project_id}", flush=True)
        print(f"   entry_point: {entry_point}", flush=True)
        print(f"   resume_session_id: {resume_session_id}", flush=True)
        print(f"   jwt_token: {'***' if jwt_token else 'MISSING'}", flush=True)
        print(f"   backend_api_url: {BACKEND_API_URL}", flush=True)

        # For project_view, project_id is required. For other entry points, it's optional
        if not user_id or not org_id or not jwt_token:
            print(f"❌ Missing required initialization data", flush=True)
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Missing required initialization data (user_id, org_id, jwt_token)"
            }))
            return

        if entry_point == "project_view" and not project_id:
            print(f"❌ Missing project_id for project_view entry point", flush=True)
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Missing project_id for project_view entry point"
            }))
            return

        # Fetch user information
        user_info = fetch_user_info(jwt_token)
        if user_info is None:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Authentication failed - please refresh your session"
            }))
            return

        # Fetch organization information
        org_info = fetch_org_info(jwt_token, org_id)
        if org_info is None:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Failed to fetch organization information - please try again"
            }))
            return

        # Enforce credit gate: do not start a new session if org has no credits left
        try:
            credits_value = float((org_info or {}).get("credits", 0) or 0)
        except (TypeError, ValueError):
            credits_value = 0.0

        if credits_value <= 0:
            print(
                f"[INIT] Org {org_id} has non-positive credits ({credits_value}); refusing to start session",
                flush=True,
            )
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "You have no remaining credits. Please add more credits to start a new session."
            }))
            return

        # Fetch project information (only for project_view entry point)
        # NOTE: We intentionally only preload basic project metadata here.
        # Documentation templates, policy templates, and auditors are now
        # fetched lazily by the respective tools when needed to simplify
        # project_view initialization and avoid hard failures if those
        # resources are unavailable.
        project_info = None

        if entry_point == "project_view" and project_id:
            project_info = fetch_project_info(jwt_token, org_id, project_id)
            if project_info is None:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Failed to fetch project information - please try again"
                }))
                return

            print(f"✅ Fetched basic project data for project_view entry point", flush=True)
        else:
            print(f"⏭️  Skipping project data fetch for entry_point: {entry_point}", flush=True)

        # Parse and format chat memory from user info (DB-backed)
        chat_memory_raw = user_info.get("chat_memory", "")
        chat_memory = parse_chat_memory(chat_memory_raw)

        try:
            last_messages = chat_memory.get("last_messages", []) if isinstance(chat_memory, dict) else []
            current_tasks = chat_memory.get("current_tasks", []) if isinstance(chat_memory, dict) else []
            print(
                f"[INIT][CHAT_MEMORY] user_id={user_id} org_id={org_id} "
                f"last_messages_count={len(last_messages)} current_tasks_count={len(current_tasks)}",
                flush=True,
            )
        except Exception as cm_err:
            # Do not break init if chat_memory logging fails.
            print(f"[INIT][CHAT_MEMORY] Failed to inspect chat_memory for user_id={user_id}: {cm_err}", flush=True)

        # Store comprehensive session context in the agent
        session_context = {
            # Basic session info
            "user_id": user_id,
            "org_id": org_id,
            "project_id": project_id,
            "jwt_token": jwt_token,
            "entry_point": entry_point,
            "initialized_at": datetime.now().isoformat(),
            "authenticated": True,

            # Backend data
            "user_info": user_info,
            "org_info": org_info,
            "project_info": project_info,

            # Organization profile fields for agent context
            "org_what": (org_info or {}).get("organization_what", ""),
            "org_size": (org_info or {}).get("organization_size", ""),
            "org_industry": (org_info or {}).get("organization_industry", ""),
            "org_location": (org_info or {}).get("organization_location", ""),
            "org_goals": (org_info or {}).get("organization_goals", ""),
            "org_security_frameworks": (org_info or {}).get("organization_security_frameworks", ""),
            "org_relevant_laws": (org_info or {}).get("organization_relevant_laws", ""),
            "past_issues": (org_info or {}).get("past_issues", ""),
            "previous_work": (org_info or {}).get("previous_work", ""),
            # New extended organization profile fields
            "org_customer_profile": (org_info or {}).get("organization_customer_profile", ""),
            "org_security_motivations": (org_info or {}).get("organization_security_motivations", ""),
            "org_structure_ownership": (org_info or {}).get("organization_structure_ownership", ""),
            "org_technical_stack": (org_info or {}).get("organization_technical_stack", ""),
            "data_to_worry_about": (org_info or {}).get("organization_important_data_types", ""),

            # Formatted chat memory for agent use
            "chat_memory": chat_memory
        }

        await agent.initialize_session(
            session_id,
            session_context,
            entry_point=entry_point,
            resume_session_id=resume_session_id,
        )

        # Initialize message emitter for this session
        message_emitter = MessageEmitter(websocket=websocket, session_id=session_id)
        set_global_message_emitter(message_emitter)

        # Send acknowledgment
        await websocket.send_text(json.dumps({
            "type": "system",
            "message": "Session initialized successfully",
            "session_id": session_id,
            "timestamp": datetime.now().isoformat()
        }))

        # After session initialization, send the managed message history once so the
        # frontend can pre-populate the chat UI. This uses exactly the same message
        # subset that will be included in the LLM context prompt (via
        # manage_conversation_context) and does not modify any later routing or
        # message logic.
        try:
            history_messages = agent.get_managed_history_for_session(session_id)
        except Exception as hist_err:
            # Do not fail initialization if history export has an issue.
            print(f"[DEBUG] Failed to build init history for session {session_id}: {hist_err}", flush=True)
            history_messages = []

        if history_messages:
            await websocket.send_text(json.dumps({
                "type": "history",
                "session_id": session_id,
                "messages": history_messages,
                "timestamp": datetime.now().isoformat(),
            }))

        # For onboarding, send two welcome messages with delay
        if entry_point == "onboarding":
            from langchain_core.messages import AIMessage
            import asyncio

            username = user_info.get("username", "there") if user_info else "there"

            # First message
            message_1 = f"Hey {username}! Let's get you onboard! You are gonna need to lock in just for a few minutes so that we understand eachother, and make sure we get the project started on the right track."
            await websocket.send_text(json.dumps({
                "type": "response",
                "message": message_1,
                "session_id": session_id,
                "timestamp": datetime.now().isoformat()
            }))
            agent.sessions[session_id]["messages"].append(AIMessage(content=message_1))

            # 0.3 second delay
            await asyncio.sleep(0.3)

            # Second message
            message_2 = "Ok so first thing first, tell me about you, and what you are trying to do, then I'll walk you through options and what we can do for you."
            await websocket.send_text(json.dumps({
                "type": "response",
                "message": message_2,
                "session_id": session_id,
                "timestamp": datetime.now().isoformat()
            }))
            agent.sessions[session_id]["messages"].append(AIMessage(content=message_2))

            # Mark that we've sent the onboarding messages to prevent duplicates
            agent.sessions[session_id]["onboarding_message_sent"] = True

        # For SCF configuration sessions, trigger an automatic LLM turn so the model
        # can send either a redirect recap (when scf_redirected is True) or a generic
        # SCF welcome message (when we have limited prior context).
        if (
            entry_point == "scf_config"
            and resume_session_id
            and session_id in agent.sessions
        ):
            ctx = agent.sessions[session_id].get("context", {})
            was_redirected = bool(ctx.get("scf_redirected"))
            try:
                auto_response = await agent.auto_start_scf_session(session_id)
                if auto_response:
                    await websocket.send_text(json.dumps({
                        "type": "response",
                        "message": auto_response,
                        "session_id": session_id,
                        "timestamp": datetime.now().isoformat()
                    }))
                print(
                    "[DEBUG] SCF auto-start completed:",
                    f"session_id={session_id}",
                    f"resume_session_id={resume_session_id}",
                    f"was_redirected={was_redirected}",
                    flush=True,
                )
            except Exception as auto_err:
                # Don't fail session initialization if the auto-start leg has an issue.
                print(f"[DEBUG] Failed to auto-start SCF session: {auto_err}", flush=True)

        # NOTE: SCF redirect recap:
        # Previously we sent a hard-coded recap message here when entry_point == "scf_config"
        # and resume_session_id was provided. This recap is now generated by the LLM itself
        # using the SCF configuration prompt and the `scf_redirected` flag in session context.

    except Exception as e:
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": f"Failed to initialize session: {str(e)}"
        }))

class ChatMessage(BaseModel):
    message: str
    session_id: str = None


class CrawlRequest(BaseModel):
    """Request model for crawler endpoint"""
    start_node_id: str
    question: str
    response_type: str = "markdown"  # "markdown" or "json"
    response_structure: str = ""  # Template (markdown) or schema (json)
    max_depth: Optional[int] = None
    max_visits: Optional[int] = None


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "active_connections": len(active_connections)
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    session_id = str(uuid.uuid4())
    active_connections[session_id] = websocket

    agent.set_thought_emitter(websocket, session_id)
    message_emitter = MessageEmitter(websocket=websocket, session_id=session_id)
    set_global_message_emitter(message_emitter)

    try:
        await websocket.send_text(json.dumps({
            "type": "system",
            "message": "Connected to GraphLang Agent",
            "session_id": session_id
        }))

        while True:
            data = await websocket.receive_text()
            try:
                message_data = json.loads(data)
                message_type = message_data.get("type", "chat")

                if message_type == "init":
                    await handle_initialization(websocket, message_data, session_id)
                    continue

                elif message_type == "resume":
                    value = message_data.get("value")  # e.g. ["api"]
                    config = {"configurable": {"thread_id": session_id}}
                    agent.sessions[session_id]["pending_interrupt"] = False

                    last_ai = None
                    async for event in agent.graph.astream(
                        Command(resume=value), config=config, stream_mode="updates"
                    ):
                        if "__interrupt__" in event:
                            payload = event["__interrupt__"][0].value
                            await websocket.send_text(json.dumps({
                                "type": payload.get("type", "ask"),
                                "payload": payload,
                                "session_id": session_id
                            }))
                            agent.sessions[session_id]["pending_interrupt"] = True
                            # wait for next client "resume" message
                            break

                        if "messages" in event:
                            msgs = [m for m in event["messages"] if isinstance(m, AIMessage)]
                            if msgs:
                                last_ai = msgs[-1].content

                    # If we didn’t just interrupt again, mirror checkpointed state back to session and respond
                    if not agent.sessions[session_id].get("pending_interrupt", False):
                        # Sync session from persisted snapshot
                        snap = await agent.graph.aget_state(config=config)
                        vals = snap.values or {}
                        s = agent.sessions[session_id]
                        s["messages"] = vals.get("messages", s.get("messages", []))
                        s["context"] = vals.get("context", s.get("context", {}))
                        s["tokens_used"] = vals.get("tokens_used", s.get("tokens_used", 0))
                        s["credits_consumed"] = vals.get("credits_consumed", s.get("credits_consumed", 0.0))
                        s["awaiting_codebase_selection"] = vals.get("awaiting_codebase_selection", s.get("awaiting_codebase_selection", False))
                        s["selected_codebases"] = vals.get("selected_codebases", s.get("selected_codebases", []))
                        s["plan_created"] = vals.get("plan_created", s.get("plan_created", False))
                        s["focused_tasks"] = vals.get("focused_tasks", s.get("focused_tasks", []))
                        s["detailed_codebase_context"] = vals.get("detailed_codebase_context", s.get("detailed_codebase_context", {}))
                        s["original_question"] = vals.get("original_question", s.get("original_question", ""))
                        s["current_task"] = vals.get("current_task", s.get("current_task", {}))
                        s["current_task_number"] = vals.get("current_task_number", s.get("current_task_number", 1))
                        s["accumulated_findings"] = vals.get("accumulated_findings", s.get("accumulated_findings", []))
                        s["can_answer_question"] = vals.get("can_answer_question", s.get("can_answer_question", False))
                        s["tool_call_traces"] = vals.get("tool_call_traces", s.get("tool_call_traces", []))
                        s["current_task_traces"] = vals.get("current_task_traces", s.get("current_task_traces", []))
                        s["pending_interrupt"] = False

                        await websocket.send_text(json.dumps({
                            "type": "response",
                            "message": last_ai or "Done.",
                            "session_id": session_id
                        }))
                    continue

                elif message_type == "frontend_event":
                    # Frontend telemetry/UX events that should enrich context but not trigger an LLM turn.
                    event_name = message_data.get("event")
                    payload = message_data.get("payload", {})

                    # Debug: log exactly what frontend_event was received
                    try:
                        payload_str = json.dumps(payload, ensure_ascii=False)
                    except Exception:
                        payload_str = str(payload)
                    print(
                        f"[DEBUG frontend_event][received] session_id={session_id} "
                        f"event={event_name} payload={payload_str}",
                        flush=True,
                    )

                    session = agent.sessions.get(session_id)
                    if session is not None:
                        ctx = session.setdefault("context", {})
                        ctx["latest_frontend_event"] = {
                            "event": event_name,
                            "payload": payload,
                            "timestamp": datetime.now().isoformat(),
                        }

                    # Project view: track current tab and currently viewed document
                    # This is similar to SCF frontend events but scoped to the project UI.
                    # Accept both the original name and the current frontend name for robustness.
                    if event_name in ("project_view_state", "project_view_state_changed"):
                        ctx["project_current_tab"] = payload.get("current_tab")
                        ctx["project_current_document"] = payload.get("current_document")

                    await websocket.send_text(json.dumps({
                        "type": "ack",
                        "ack_type": "frontend_event",
                        "event": event_name,
                        "session_id": session_id,
                        "timestamp": datetime.now().isoformat(),
                    }))
                    continue

                # regular chat
                user_message = message_data.get("message", "")
                if not user_message:
                    # Skip empty messages silently (common after onboarding init)
                    continue

                response = await agent.process_message(user_message, session_id)

                # Only send if we didn’t hit an interrupt (process_message returns None on interrupt)
                if response is not None:
                    await websocket.send_text(json.dumps({
                        "type": "response",
                        "message": response,
                        "session_id": session_id,
                        "timestamp": datetime.now().isoformat()
                    }))

            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"type": "error","message": "Invalid JSON format"}))
            except GraphRecursionError as e:
                # Handle recursion limit errors with a user-friendly message
                error_msg = f"⚠️ The agent hit the maximum processing steps limit. This usually means the task was too complex or got stuck in a loop. Try breaking down your request into smaller steps or starting a new conversation. Technical details: {str(e)}"
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": error_msg,
                    "error_type": "recursion_limit"
                }))
                print(f"❌ GraphRecursionError in WebSocket: {e}", flush=True)
            except Exception as e:
                await websocket.send_text(json.dumps({"type": "error","message": f"Error processing message: {str(e)}"}))

                
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        # Mark the session as closed so any in-flight LLM calls can bail out early.
        try:
            agent.mark_session_closed(session_id)
        except Exception:
            pass

        # Clean up connection
        if session_id in active_connections:
            del active_connections[session_id]

        # Best-effort: persist chat memory for this user before tearing down the session
        try:
            await agent.save_chat_memory_from_session(session_id)
        except Exception as e:
            print(f"[CHAT_MEMORY] Failed to save chat memory on disconnect: {e}", flush=True)

        # Clean up agent session
        await agent.cleanup_session(session_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
