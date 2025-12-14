"""
ContextTool - Tool for updating session context values in GraphLang Agent

Provides methods to:
- Update entry_point (where chat was opened from)
- Update user knowledge level
- Update organization goals
- Update any other context values used in prompts
- Uses LLM writer step to generate updates from natural language instructions
"""

import json
import os
from typing import Dict, Any, Optional, List, Tuple
from langchain_core.messages import HumanMessage, AIMessage
import requests

# Thought emitters
try:
    from ..emitters.thought_emitter import emit_data_thought, emit_error_thought
except ImportError:
    from emitters.thought_emitter import emit_data_thought, emit_error_thought

# Backend API configuration for persisting org profile updates
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://app:8080")
REQUEST_TIMEOUT = float(os.getenv("BACKEND_REQUEST_TIMEOUT", "10.0"))

# Public update_context tool name and prompt snippet (single source of truth for description)
TOOL_NAME: str = "update_context"

UPDATE_CONTEXT_TOOL_PROMPT: str = """
        - update_context: updates session context values to personalize the chat experience, be as descriptive as reasonable, and you can include multiple things to updatein a single call.
            arguments: [content_instructions]
            IMPORTANT:
            - content_instructions: natural language description of what context to update
            - Can update: entry_point, user_knowledge, user_title, user_role, org_what, org_size, org_industry, org_location, org_goals, org_security_frameworks, org_relevant_laws
            - Also: past_issues, previous_work (free-text descriptions of past issues and previous work, be as wordy as needed)
            - The system will automatically generate only the necessary updates
            - Example: "User is a CTO at a healthcare startup, very experienced with compliance, wants to get HIPAA certified"
            - Use this when you learn new information about the user or organization that should affect the chat experience"""


def validate_update_context_args(args: List[str]) -> Tuple[bool, Optional[str], Optional[str]]:
    """Validate arguments for the update_context tool.

    Returns:
        (ok, error_message, content_instructions)
    """
    content_instructions = args[0].strip() if args and args[0] else ""
    if not content_instructions:
        return False, "update_context requires content_instructions", None
    return True, None, content_instructions


async def apply_update_context(state: Dict[str, Any], content_instructions: str, context_tool) -> Dict[str, Any]:
    """Execute the update_context tool behavior.

    This centralizes:
    - Fetching current context and recent messages
    - Calling ContextTool.update_context_with_writer
    - Applying updates into state and shaping the AgentState patch
    """
    toold_id = "ae3f4521283"

    # Get current context
    current_context = state.get("context", {}) or {}

    # Get last 15 messages for context
    messages = state.get("messages", []) or []
    last_messages = [
        {"role": getattr(msg, "type", ""), "content": getattr(msg, "content", "")}
        for msg in messages[-15:]
    ]

    try:
        print(f"{toold_id} 🔄 Updating session context...")
        await emit_data_thought("🔄 Updating session context...", "tool_execution")
    except Exception:
        pass

    # Generate updates using LLM writer step
    result = await context_tool.update_context_with_writer(
        content_instructions=content_instructions,
        current_context=current_context,
        last_messages=last_messages,
    )

    if result.get("success"):
        updates = result.get("updates", {}) or {}
        print(f"{toold_id} 🔄 Generated context updates: {updates}")

        # Ensure context dict exists and apply updates
        context = state.get("context")
        if not isinstance(context, dict):
            context = {}
            state["context"] = context

        if updates:
            context.update(updates)

            # Emit detailed thought about what was updated
            try:
                update_details = "\n".join([f"  • {key}: {value}" for key, value in updates.items()])
                print(f"{toold_id} 🔄 Context updates:\n{update_details}")
                await emit_data_thought(f"✅ Context updated:\n{update_details}", "tool_execution")
            except Exception:
                pass
        else:
            try:
                print(f"{toold_id} 🔄 No context updates needed")
                await emit_data_thought("ℹ️ No context updates needed", "tool_execution")
            except Exception:
                pass

        # Persist organization profile updates back to backend, if any org fields changed
        org_field_keys = {
            "org_what",
            "org_size",
            "org_industry",
            "org_location",
            "org_goals",
            "org_security_frameworks",
            "org_relevant_laws",
            "past_issues",
            "previous_work",
            # Extended organization profile fields
            "org_customer_profile",
            "org_security_motivations",
            "org_structure_ownership",
            "org_technical_stack",
            # Important data types / data to worry about
            "data_to_worry_about",
        }
        org_updates = {k: v for k, v in updates.items() if k in org_field_keys}

        if org_updates:
            try:
                org_id = context.get("org_id") or state.get("context", {}).get("org_id")
                jwt_token = context.get("jwt_token") or state.get("context", {}).get("jwt_token")

                if org_id and jwt_token:
                    payload: Dict[str, Any] = {}

                    if "org_what" in org_updates:
                        payload["organization_what"] = org_updates["org_what"]
                    if "org_size" in org_updates:
                        payload["organization_size"] = org_updates["org_size"]
                    if "org_industry" in org_updates:
                        payload["organization_industry"] = org_updates["org_industry"]
                    if "org_location" in org_updates:
                        payload["organization_location"] = org_updates["org_location"]
                    if "org_goals" in org_updates:
                        payload["organization_goals"] = org_updates["org_goals"]
                    if "org_security_frameworks" in org_updates:
                        payload["organization_security_frameworks"] = org_updates["org_security_frameworks"]
                    if "org_relevant_laws" in org_updates:
                        payload["organization_relevant_laws"] = org_updates["org_relevant_laws"]
                    if "past_issues" in org_updates:
                        payload["past_issues"] = org_updates["past_issues"]
                    if "previous_work" in org_updates:
                        payload["previous_work"] = org_updates["previous_work"]
                    if "org_customer_profile" in org_updates:
                        payload["organization_customer_profile"] = org_updates["org_customer_profile"]
                    if "org_security_motivations" in org_updates:
                        payload["organization_security_motivations"] = org_updates["org_security_motivations"]
                    if "org_structure_ownership" in org_updates:
                        payload["organization_structure_ownership"] = org_updates["org_structure_ownership"]
                    if "org_technical_stack" in org_updates:
                        payload["organization_technical_stack"] = org_updates["org_technical_stack"]
                    if "data_to_worry_about" in org_updates:
                        payload["organization_important_data_types"] = org_updates["data_to_worry_about"]

                    if payload:
                        url = f"{BACKEND_API_URL}/api/v1/org/{org_id}"
                        headers = {
                            "Authorization": f"Bearer {jwt_token}",
                            "Content-Type": "application/json",
                        }
                        try:
                            print(f"{toold_id} 🔄 Patching org profile at {url} with payload keys: {list(payload.keys())}")
                            response = requests.patch(url, headers=headers, json=payload, timeout=REQUEST_TIMEOUT)
                            if 200 <= response.status_code < 300:
                                try:
                                    await emit_data_thought("✅ Saved organization profile changes to backend", "tool_execution")
                                except Exception:
                                    pass
                            else:
                                msg = f"{toold_id} ❌ Failed to patch org profile: HTTP {response.status_code} - {response.text}"
                                print(msg)
                                try:
                                    await emit_error_thought(msg, "tool_execution")
                                except Exception:
                                    pass
                        except Exception as e:
                            msg = f"{toold_id} ❌ Error while calling org PATCH endpoint: {e}"
                            print(msg)
                            try:
                                await emit_error_thought(msg, "tool_execution")
                            except Exception:
                                pass
            except Exception as e:
                msg = f"{toold_id} ❌ Error while preparing org profile PATCH: {e}"
                print(msg)
                try:
                    await emit_error_thought(msg, "tool_execution")
                except Exception:
                    pass

        # Build return state with all updated fields
        print(f"{toold_id} 🔄 Context update complete")
        message = (
            "✅ Context updated successfully\n"
            f"- Updated {len(updates)} field(s)\n\n"
            "[Task could be complete - check if you just need to respond to user instead of calling other tools]"
        )
        try:
            await emit_data_thought(message, "tool_execution")
        except Exception:
            pass

        # Internal tool-status message for the LLM (not user-visible)
        updated_keys = ", ".join(sorted(updates.keys())) if updates else "no fields changed"
        internal_tool_message = AIMessage(
            content=f"[TOOL_STATUS] update_context applied: updated {len(updates)} field(s): {updated_keys}.",
            additional_kwargs={"internal_tool_status": True, "tool_name": TOOL_NAME},
        )

        # After a successful context update, we do NOT loop back to LLM_chat.
        # Instead, we end this leg silently so the next user message can benefit
        # from the updated context without an extra acknowledgement turn.
        return_state: Dict[str, Any] = {
            "messages": [internal_tool_message],
            "has_tool_call": False,
            "requested_tool": None,
            "context": state["context"],
            "tool_should_loopback": False,
        }

        # Update all user and org fields in state if they were changed
        if "user_title" in updates:
            return_state["user_title"] = updates["user_title"]
        if "user_role" in updates:
            return_state["user_role"] = updates["user_role"]
        if "user_knowledge" in updates:
            return_state["user_knowledge"] = updates["user_knowledge"]
        if "org_what" in updates:
            return_state["org_what"] = updates["org_what"]
        if "org_size" in updates:
            return_state["org_size"] = updates["org_size"]
        if "org_industry" in updates:
            return_state["org_industry"] = updates["org_industry"]
        if "org_location" in updates:
            return_state["org_location"] = updates["org_location"]
        if "org_goals" in updates:
            return_state["org_goals"] = updates["org_goals"]
        if "org_security_frameworks" in updates:
            return_state["org_security_frameworks"] = updates["org_security_frameworks"]
        if "org_relevant_laws" in updates:
            return_state["org_relevant_laws"] = updates["org_relevant_laws"]
        if "past_issues" in updates:
            return_state["past_issues"] = updates["past_issues"]
        if "previous_work" in updates:
            return_state["previous_work"] = updates["previous_work"]

        return return_state

    # Failure branch - log and return a non-loopback state without user message
    error_text = result.get("error", "Unknown error")
    print(f"{toold_id} ❌ Failed to update context: {error_text}")

    internal_tool_message = AIMessage(
        content=f"[TOOL_STATUS] update_context failed: {error_text}",
        additional_kwargs={"internal_tool_status": True, "tool_name": TOOL_NAME},
    )

    return {
        "messages": [internal_tool_message],  # Internal-only; don't send message to user
        "has_tool_call": False,
        "requested_tool": None,
        "tool_should_loopback": False,  # Don't loop back after context update
    }


class ContextTool:
    """Tool for updating session context with LLM-based writer step"""

    def __init__(self, llm_client: Optional[Any] = None):
        """
        Initialize ContextTool with optional LLM client

        Args:
            llm_client: LangChain LLM client for writer step
        """
        self.llm_client = llm_client

    def _validate_context_fields(self, updates: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate and sanitize context field updates

        Args:
            updates: Dictionary of fields to update

        Returns:
            Validated updates dictionary
        """
        # Allowed fields that can be updated via this tool
        allowed_fields = {
            "entry_point",
            "user_knowledge",
            "user_title",
            "user_role",
            "org_what",
            "org_size",
            "org_industry",
            "org_location",
            "org_goals",
            "org_security_frameworks",
            "org_relevant_laws",
            "past_issues",
            "previous_work",
            # Extended organization profile fields
            "org_customer_profile",
            "org_security_motivations",
            "org_structure_ownership",
            "org_technical_stack",
            # Important data types / data to worry about
            "data_to_worry_about",
        }

        validated = {}
        for key, value in updates.items():
            if key in allowed_fields:
                # Ensure value is a string
                validated[key] = str(value).strip() if value else ""
            else:
                # Silently ignore disallowed fields for security
                pass

        return validated

    async def _generate_context_updates(
        self,
        content_instructions: str,
        current_context: Dict[str, Any],
        last_messages: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Use LLM to generate context field updates from natural language instructions

        Args:
            content_instructions: Natural language description of what to update
            current_context: Current context values
            last_messages: Recent message history for context

        Returns:
            Dictionary of fields to update
        """
        if not self.llm_client:
            return {}

        # Build context info
        context_info = "\n".join([
            f"- {key}: {value}"
            for key, value in current_context.items()
            if key in {
                "entry_point", "user_knowledge", "user_title", "user_role",
                "org_what", "org_size", "org_industry", "org_location",
                "org_goals", "org_security_frameworks", "org_relevant_laws",
                "past_issues", "previous_work",
                "org_customer_profile", "org_security_motivations",
                "org_structure_ownership", "org_technical_stack",
                "data_to_worry_about",
            }
        ])

        message_context = ""
        if last_messages:
            message_context = "\n\nRecent conversation:\n" + "\n".join([
                f"- {msg.get('role', 'unknown')}: {msg.get('content', '')[:100]}"
                for msg in last_messages[-5:]
            ])

        prompt = f"""You are helping update session context values based on user instructions.

Current context values:
{context_info}

User instructions for updates:
{content_instructions}
{message_context}

Generate ONLY the fields that need to be updated. Return as pure JSON with no markdown.

    Allowed fields to update:
    - user_knowledge: User's compliance knowledge level, be as wordy as needed
    - user_title: User's job title
    - user_role: User's role in organization be as wordy as needed
    - org_what: What the organization does,be as wordy as needed
    - org_size: Organization size (startup, small, medium, large, enterprise)
    - org_industry: Industry/sector, be as wordy as needed
    - org_location: Geographic location
    - org_goals: Organization's compliance goals, be as wordy as needed
    - org_security_frameworks: Active security frameworks (CCF, SCF, Adobe, SOC2, ISO, HIPAA, GDPR, etc.)
    - org_relevant_laws: Relevant regulations/laws
    - past_issues: Past compliance or security issues/problems, be as wordy as needed
    - previous_work: Previous compliance or security work they've already done, be as wordy as needed
    - org_customer_profile: Who their end customers are and how they use the product
    - org_security_motivations: Why they care about security/compliance
    - org_structure_ownership: How security/compliance is owned internally (roles / structure)
    - org_technical_stack: High-level view of their technical stack
    - data_to_worry_about: Important data types / "data to worry about"

Return ONLY the fields that changed, as a JSON object. Example:
{{"user_knowledge": "intermediate", "org_goals": "Get SOC2 certified for enterprise customers"}}

If no updates are needed, return an empty object: {{}}
"""

        try:
            response = await self.llm_client.ainvoke([HumanMessage(content=prompt)])
            raw_text = response.content.strip()

            print(f"[DEBUG] LLM raw response: {raw_text[:200]}...", flush=True)

            # NOTE: previously we had inline markdown/JSON stripping here. This was
            # moved into shared helpers in llm_parsing_utils.py so that all writer
            # steps handle weirdly formatted JSON responses consistently.
            from llm_parsing_utils import clean_json_markdown, extract_json_object

            cleaned = clean_json_markdown(raw_text)
            json_str = extract_json_object(cleaned) or cleaned

            print(f"[DEBUG] Extracted JSON: {json_str}", flush=True)

            # Parse JSON
            text = json_str

            # Parse JSON
            updates = json.loads(text)

            print(f"[DEBUG] Parsed updates: {updates}", flush=True)

            # Validate fields
            validated = self._validate_context_fields(updates)

            print(f"[DEBUG] Validated updates: {validated}", flush=True)

            try:
                if validated:
                    await emit_data_thought(f"📝 Context fields extracted: {', '.join(validated.keys())}", "context_tool")
                else:
                    await emit_data_thought(f"ℹ️ No context fields to update", "context_tool")
            except Exception:
                pass

            return validated

        except json.JSONDecodeError as e:
            print(f"Failed to parse LLM response as JSON: {e}", flush=True)
            try:
                await emit_error_thought(f"❌ JSON parsing failed: {str(e)}", "context_tool")
            except Exception:
                pass
            return {}
        except Exception as e:
            print(f"Error generating context updates: {e}", flush=True)
            try:
                await emit_error_thought(f"❌ Context update error: {str(e)}", "context_tool")
            except Exception:
                pass
            return {}

    async def update_context_with_writer(
        self,
        content_instructions: str,
        current_context: Dict[str, Any],
        last_messages: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Update context using LLM writer step

        Args:
            content_instructions: Natural language description of updates
            current_context: Current context values
            last_messages: Recent message history for context

        Returns:
            Dict with success status and updated fields
        """
        try:
            # Generate updates using LLM
            updates = await self._generate_context_updates(
                content_instructions,
                current_context,
                last_messages
            )

            if not updates:
                return {
                    "success": True,
                    "updates": {},
                    "message": "No context updates needed"
                }

            return {
                "success": True,
                "updates": updates,
                "message": f"Generated {len(updates)} context update(s)"
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to update context: {str(e)}",
                "updates": {}
            }

    def update_context_direct(
        self,
        updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Directly update context with validated fields (no LLM)

        Args:
            updates: Dictionary of fields to update

        Returns:
            Dict with success status and validated updates
        """
        try:
            validated = self._validate_context_fields(updates)

            if not validated:
                return {
                    "success": True,
                    "updates": {},
                    "message": "No valid fields to update"
                }

            return {
                "success": True,
                "updates": validated,
                "message": f"Validated {len(validated)} context update(s)"
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to validate context updates: {str(e)}",
                "updates": {}
            }

