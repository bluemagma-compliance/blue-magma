"""
select_scf_controls tool definition.

This module centralizes:
- Tool name and description (for prompts)
- Argument parsing and validation
- Execution logic (what gets stored in context)
- Output / exit behavior (loopback flag)
"""

from typing import List, Tuple, Optional, Dict, Any

from langchain_core.messages import AIMessage

# Canonical frameworks this tool accepts (case-insensitive)
ALLOWED_FRAMEWORKS: List[str] = [
    "SOC2",
    "HIPAA",
    "ISO27001",
    "ISO42001",
    "GDPR",
    "NIST AI RMF",
    "NIST CSF",
    "L0",
    "L1",
    "L2",
    "AI_OPS",
]

# Public tool name used in prompts and tool_call parsing
TOOL_NAME: str = "select_scf_controls"

# Pre-computed helpers for validation / prompt text
_ALLOWED_KEY_MAP = {name.lower(): name for name in ALLOWED_FRAMEWORKS}
_ALLOWED_FRAMEWORKS_STR = ", ".join(ALLOWED_FRAMEWORKS)

# Text snippet inserted into the SCF config prompt so the LLM knows how to call this tool.
SCF_CONTROLS_TOOL_PROMPT: str = f"""
        - {TOOL_NAME}: select which compliance frameworks SCF should target for this organization
            arguments: [framework1, framework2, ...]
            - Call the tool as: {TOOL_NAME}, framework1, framework2, framework3
            - You may pass frameworks as separate arguments or as a single comma-separated argument.
            - Allowed frameworks (case-insensitive): {_ALLOWED_FRAMEWORKS_STR}
"""


def _parse_framework_args(args: List[str]) -> List[str]:
    """Flatten and clean the raw arg list into individual framework tokens.

    Supports:
    - select_scf_controls, SOC2, HIPAA
    - select_scf_controls, SOC2, HIPAA, ISO27001
    - select_scf_controls, SOC2, HIPAA ISO27001
    - select_scf_controls, "SOC2, ISO27001"
    """
    items: List[str] = []

    for raw in args:
        if not raw:
            continue
        # Split on comma to support CSV-style arguments
        parts = raw.split(",")
        for part in parts:
            cleaned = part.strip().strip(" '\"")
            if cleaned:
                items.append(cleaned)

    # Deduplicate while preserving order (so LLM's order is respected)
    seen: set[str] = set()
    deduped: List[str] = []
    for item in items:
        key = item.lower()
        if key not in seen:
            seen.add(key)
            deduped.append(item)

    return deduped


def validate_args(args: List[str]) -> Tuple[bool, Optional[str], List[str]]:
    """Validate and normalize framework arguments.

    Returns:
        (ok, error_message, normalized_frameworks)
        - ok: True if args are valid
        - error_message: message suitable for tool_validation_error
        - normalized_frameworks: canonical framework names to store in context
    """
    raw_items = _parse_framework_args(args)

    if not raw_items:
        return (
            False,
            f"{TOOL_NAME} requires at least one framework. "
            f"Call it like: {TOOL_NAME}, framework1, framework2. "
            f"Allowed frameworks (case-insensitive): {_ALLOWED_FRAMEWORKS_STR}",
            [],
        )

    normalized: List[str] = []
    invalid: List[str] = []

    for raw in raw_items:
        key = raw.lower()
        if key in _ALLOWED_KEY_MAP:
            canonical = _ALLOWED_KEY_MAP[key]
            if canonical not in normalized:
                normalized.append(canonical)
        else:
            invalid.append(raw)

    if invalid:
        invalid_str = ", ".join(invalid)
        return (
            False,
            f"Invalid frameworks for {TOOL_NAME}: {invalid_str}. "
            f"Allowed frameworks (case-insensitive): {_ALLOWED_FRAMEWORKS_STR}.",
            [],
        )

    return True, None, normalized


def apply_selection(state: Dict[str, Any], frameworks: List[str]) -> Dict[str, Any]:
    """Apply the validated framework selection to the agent state.

    - Stores the selection in context["scf_selected_frameworks"]
    - Returns a partial AgentState update dict with:
        - messages: [internal tool-status AIMessage]  (non-loopback, no user-facing message)
        - has_tool_call: False
        - requested_tool: None
        - context: updated context
        - tool_should_loopback: False
    """
    context = state.get("context")
    if not isinstance(context, dict):
        context = {}

    # Copy to avoid mutating any shared references unexpectedly
    updated_context = dict(context)
    updated_context["scf_selected_frameworks"] = frameworks

    # Reflect back into state for downstream nodes
    state["context"] = updated_context

    # Internal tool-status message for the LLM (not user-visible)
    frameworks_str = ", ".join(frameworks) if frameworks else "none"
    internal_tool_message = AIMessage(
        content=f"[TOOL_STATUS] {TOOL_NAME} applied: scf_selected_frameworks=[{frameworks_str}].",
        additional_kwargs={"internal_tool_status": True, "tool_name": TOOL_NAME},
    )

    return {
        "messages": [internal_tool_message],
        "has_tool_call": False,
        "requested_tool": None,
        "context": updated_context,
        "tool_should_loopback": False,
    }




# Additional SCF tools: set minimum weight, reset filters/selection, and signal completion

TOOL_NAME_SET_MIN_WEIGHT: str = "scf_set_min_weight"
TOOL_NAME_RESET_FILTERS: str = "scf_reset_filters"
TOOL_NAME_ALL_DONE: str = "scf_all_done"

SCF_SET_MIN_WEIGHT_TOOL_PROMPT: str = f"""
        - {TOOL_NAME_SET_MIN_WEIGHT}: set the minimum weight threshold for SCF controls between 0 and 10
            arguments: [min_weight]
            - Call the tool as: {TOOL_NAME_SET_MIN_WEIGHT}, 7
            - min_weight must be a number between 0 and 10 inclusive.
"""

SCF_RESET_FILTERS_TOOL_PROMPT: str = f"""
        - {TOOL_NAME_RESET_FILTERS}: reset SCF filters and clear any selected controls
            arguments: []
            - Call the tool as: {TOOL_NAME_RESET_FILTERS}
            - This clears framework/core-level filters and unselects all controls in the SCF UI.
"""

SCF_ALL_DONE_TOOL_PROMPT: str = f"""
        - {TOOL_NAME_ALL_DONE}: pause / end the current SCF chat turn when there is nothing more useful to do
            arguments: []
            - Call the tool as: {TOOL_NAME_ALL_DONE}
            - Use this when you are done sending messages for now: for example, after giving
              your final answer or after too many tool errors / retries where you cannot
              make further progress.
            - This is the fallback tool to call when there are no other appropriate tools left.
"""


def validate_min_weight_args(args: List[str]) -> Tuple[bool, Optional[str], Optional[float]]:
    """Validate min_weight argument for scf_set_min_weight.

    Returns:
        (ok, error_message, min_weight)
    """
    if not args:
        return (
            False,
            f"{TOOL_NAME_SET_MIN_WEIGHT} requires a numeric min_weight between 0 and 10. "
            f"Call it like: {TOOL_NAME_SET_MIN_WEIGHT}, 7",
            None,
        )

    raw = str(args[0]).strip()
    try:
        value = float(raw)
    except Exception:
        return (
            False,
            f"min_weight must be a number between 0 and 10, got: {raw!r}",
            None,
        )

    if not (0.0 <= value <= 10.0):
        return (
            False,
            f"min_weight must be between 0 and 10 inclusive, got: {value}",
            None,
        )

    return True, None, value


def apply_min_weight(state: Dict[str, Any], min_weight: float) -> Dict[str, Any]:
    """Apply the validated min_weight to the agent state.

    - Stores the value in context["scf_min_weight"]
    - Returns a partial AgentState update dict with no loopback.
    """
    context = state.get("context")
    if not isinstance(context, dict):
        context = {}

    updated_context = dict(context)
    updated_context["scf_min_weight"] = min_weight
    state["context"] = updated_context

    internal_tool_message = AIMessage(
        content=f"[TOOL_STATUS] {TOOL_NAME_SET_MIN_WEIGHT} applied: min_weight={min_weight}.",
        additional_kwargs={"internal_tool_status": True, "tool_name": TOOL_NAME_SET_MIN_WEIGHT},
    )

    return {
        "messages": [internal_tool_message],
        "has_tool_call": False,
        "requested_tool": None,
        "context": updated_context,
        "tool_should_loopback": False,
    }


def validate_reset_filters_args(args: List[str]) -> Tuple[bool, Optional[str], Dict[str, Any]]:
    """Validate arguments for scf_reset_filters (no args allowed)."""
    if args:
        return (
            False,
            f"{TOOL_NAME_RESET_FILTERS} does not take any arguments. "
            f"Call it like: {TOOL_NAME_RESET_FILTERS}",
            {},
        )

    # Payload reserved for future options; currently just a reset flag.
    return True, None, {"reset": True}


def apply_reset_filters(state: Dict[str, Any], payload: Dict[str, Any]) -> Dict[str, Any]:
    """Apply a reset of SCF filters/selection to the agent state.

    - Clears context["scf_selected_frameworks"] so the LLM sees no active framework filters.
    - Does not touch min_weight here; UI reset is handled via WebSocket actions in agent.py.
    """
    context = state.get("context")
    if not isinstance(context, dict):
        context = {}

    updated_context = dict(context)
    updated_context["scf_selected_frameworks"] = []

    state["context"] = updated_context

    internal_tool_message = AIMessage(
        content=f"[TOOL_STATUS] {TOOL_NAME_RESET_FILTERS} applied: filters and selection reset.",
        additional_kwargs={"internal_tool_status": True, "tool_name": TOOL_NAME_RESET_FILTERS},
    )

    return {
        "messages": [internal_tool_message],
        "has_tool_call": False,
        "requested_tool": None,
        "context": updated_context,
        "tool_should_loopback": True,
    }


def validate_all_done_args(args: List[str]) -> Tuple[bool, Optional[str], Dict[str, Any]]:
    """Validate arguments for scf_all_done (no args allowed)."""
    if args:
        return (
            False,
            f"{TOOL_NAME_ALL_DONE} does not take any arguments. "
            f"Call it like: {TOOL_NAME_ALL_DONE}",
            {},
        )

    # Simple payload indicating completion.
    return True, None, {"all_done": True}


def apply_all_done(state: Dict[str, Any], payload: Dict[str, Any]) -> Dict[str, Any]:
    """Signal that the SCF chat turn should be paused/ended.

    - Marks context["scf_all_done"] = True for downstream consumers.
    - Intended to be called when the assistant is done sending messages for now
      (either after a final answer or after too many tool errors / retries).
    - Returns an AgentState update dict that does not loop back to LLM_chat.
    """
    context = state.get("context")
    if not isinstance(context, dict):
        context = {}

    updated_context = dict(context)
    updated_context["scf_all_done"] = True
    state["context"] = updated_context

    internal_tool_message = AIMessage(
        content=f"[TOOL_STATUS] {TOOL_NAME_ALL_DONE} called: SCF chat turn marked as done/paused.",
        additional_kwargs={"internal_tool_status": True, "tool_name": TOOL_NAME_ALL_DONE},
    )

    return {
        "messages": [internal_tool_message],
        "has_tool_call": False,
        "requested_tool": None,
        "context": updated_context,
        "tool_should_loopback": False,
    }
