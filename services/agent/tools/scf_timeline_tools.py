"""SCF timeline tools for configuring implementation windows and row ordering.

These tools are called from the SCF configuration chat to control the
implementation timeline UI for frameworks/core levels.
"""

from typing import List, Tuple, Optional, Dict, Any

from langchain_core.messages import AIMessage


TOOL_NAME_SET_TIMELINE_WINDOWS: str = "scf_set_timeline_windows"
TOOL_NAME_SET_TIMELINE_ORDER: str = "scf_set_timeline_order"
TOOL_NAME_RESET_TIMELINE: str = "scf_reset_timeline"

# Canonical goals (frameworks + core levels) that can appear in the timeline.
_ALLOWED_GOALS: List[str] = [
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

# Synonyms for timeline goals; these are normalized to the canonical values
# above. Keep in sync with frontend resolveTimelineGoalId behavior and
# select_scf_controls validation.
_GOAL_SYNONYMS: Dict[str, List[str]] = {
    "SOC2": ["soc2", "soc 2", "soc-2"],
    "HIPAA": ["hipaa"],
    "ISO27001": ["iso27001", "iso 27001", "iso-27001"],
    "ISO42001": ["iso42001", "iso 42001", "iso-42001"],
    "GDPR": ["gdpr"],
    "NIST AI RMF": ["nist ai rmf", "ai rmf", "nist-ai-rmf"],
    "NIST CSF": ["nist csf", "csf", "nist-csf"],
    "L0": ["l0", "core lvl0", "core level 0", "level 0"],
    "L1": ["l1", "core lvl1", "core level 1", "level 1"],
    "L2": ["l2", "core lvl2", "core level 2", "level 2"],
    "AI_OPS": ["ai_ops", "ai ops", "core ai ops"],
}

_GOAL_NORMALIZATION_MAP: Dict[str, str] = {}
for canonical, synonyms in _GOAL_SYNONYMS.items():
    for s in synonyms:
        key = " ".join(str(s).strip().lower().replace("-", " ").replace("_", " ").split())
        _GOAL_NORMALIZATION_MAP[key] = canonical

_ALLOWED_GOALS_STR = ", ".join(_ALLOWED_GOALS)


def _normalize_goal(name: str) -> Optional[str]:
    """Normalize a raw goal name to a canonical timeline goal string."""

    if not name or not str(name).strip():
        return None

    key = " ".join(str(name).strip().lower().replace("-", " ").replace("_", " ").split())
    # Direct canonical match
    for g in _ALLOWED_GOALS:
        if key == " ".join(g.lower().split()):
            return g
    # Synonym match
    return _GOAL_NORMALIZATION_MAP.get(key)


SCF_TIMELINE_WINDOWS_TOOL_PROMPT: str = f"""
        - {TOOL_NAME_SET_TIMELINE_WINDOWS}: set implementation windows (start/end months) for SCF timeline goals
            arguments: [mode?, goal1, start_month1, end_month1, goal2, start_month2, end_month2, ...]
            - Optional first argument mode can be "merge" (default) or "replace".
            - Example (merge): {TOOL_NAME_SET_TIMELINE_WINDOWS}, SOC2, 4, 10, L0, 0, 4
            - Example (replace): {TOOL_NAME_SET_TIMELINE_WINDOWS}, replace, SOC2, 0, 6
            - Goals must be one of (case-insensitive): {_ALLOWED_GOALS_STR}
"""


SCF_TIMELINE_ORDER_TOOL_PROMPT: str = f"""
        - {TOOL_NAME_SET_TIMELINE_ORDER}: reorder SCF timeline rows by goal
            arguments: [goal1, goal2, goal3, ...]
            - Example: {TOOL_NAME_SET_TIMELINE_ORDER}, SOC2, L0, ISO27001
            - Goals must be one of (case-insensitive): {_ALLOWED_GOALS_STR}
"""


SCF_RESET_TIMELINE_TOOL_PROMPT: str = f"""
        - {TOOL_NAME_RESET_TIMELINE}: reset the SCF implementation timeline to default windows and ordering
            arguments: []
            - Call the tool as: {TOOL_NAME_RESET_TIMELINE}
            - This clears custom timeline windows and row ordering; the UI will restore default windows.
"""


def validate_set_timeline_windows_args(args: List[str]) -> Tuple[bool, Optional[str], Dict[str, Any]]:
    """Validate arguments for scf_set_timeline_windows.

    Expected formats:
        - scf_set_timeline_windows, goal1, start1, end1, goal2, start2, end2
        - scf_set_timeline_windows, merge, goal1, start1, end1, ...
        - scf_set_timeline_windows, replace, goal1, start1, end1, ...
    """

    if not args:
        return (
            False,
            f"{TOOL_NAME_SET_TIMELINE_WINDOWS} requires at least one goal window. "
            f"Example: {TOOL_NAME_SET_TIMELINE_WINDOWS}, SOC2, 0, 6",
            {},
        )

    mode = "merge"
    idx = 0
    first = str(args[0]).strip().lower()
    if first in {"merge", "replace"}:
        mode = first
        idx = 1

    remaining = args[idx:]
    if len(remaining) == 0 or len(remaining) % 3 != 0:
        return (
            False,
            f"{TOOL_NAME_SET_TIMELINE_WINDOWS} expects goal,start,end triples after the optional mode. "
            f"Example: {TOOL_NAME_SET_TIMELINE_WINDOWS}, SOC2, 0, 6, L0, 0, 4",
            {},
        )

    windows = []
    for i in range(0, len(remaining), 3):
        raw_goal, raw_start, raw_end = remaining[i : i + 3]
        goal = _normalize_goal(raw_goal)
        if not goal:
            return (
                False,
                f"Unknown timeline goal '{raw_goal}'. Allowed goals: {_ALLOWED_GOALS_STR}.",
                {},
            )
        try:
            start = float(str(raw_start).strip())
            end = float(str(raw_end).strip())
        except Exception:
            return (
                False,
                f"Invalid start/end months for goal '{raw_goal}': '{raw_start}', '{raw_end}'. "
                "They must be numbers.",
                {},
            )

        windows.append({"goal": goal, "start_month": start, "end_month": end})

    payload: Dict[str, Any] = {"mode": mode, "windows": windows}
    return True, None, payload


def apply_set_timeline_windows(state: Dict[str, Any], payload: Dict[str, Any]) -> Dict[str, Any]:
    """Apply validated timeline windows payload to agent state.

    - Stores payload in context["scf_timeline_windows"].
    - Returns an AgentState update dict with loopback so the LLM can explain.
    """

    context = state.get("context")
    if not isinstance(context, dict):
        context = {}

    updated_context = dict(context)
    updated_context["scf_timeline_windows"] = payload
    state["context"] = updated_context

    mode = payload.get("mode") or "merge"
    windows = payload.get("windows") or []
    goals = [w.get("goal", "?") for w in windows]
    goals_str = ", ".join(goals) if goals else "none"

    internal_tool_message = AIMessage(
        content=(
            f"[TOOL_STATUS] {TOOL_NAME_SET_TIMELINE_WINDOWS} success: "
            f"mode={mode}, goals=[{goals_str}]."
        ),
        additional_kwargs={
            "internal_tool_status": True,
            "tool_name": TOOL_NAME_SET_TIMELINE_WINDOWS,
            "mode": mode,
            "window_count": len(windows),
        },
    )

    return {
        "messages": [internal_tool_message],
        "has_tool_call": False,
        "requested_tool": None,
        "context": updated_context,
        "tool_should_loopback": True,
    }


def validate_set_timeline_order_args(args: List[str]) -> Tuple[bool, Optional[str], List[str]]:
    """Validate arguments for scf_set_timeline_order.

    Expected format: [goal1, goal2, goal3, ...].
    """

    if not args:
        return (
            False,
            f"{TOOL_NAME_SET_TIMELINE_ORDER} requires at least one goal. "
            f"Example: {TOOL_NAME_SET_TIMELINE_ORDER}, SOC2, L0, ISO27001",
            [],
        )

    normalized: List[str] = []
    seen: set[str] = set()
    for raw in args:
        goal = _normalize_goal(raw)
        if not goal:
            return (
                False,
                f"Unknown timeline goal '{raw}'. Allowed goals: {_ALLOWED_GOALS_STR}.",
                [],
            )
        if goal not in seen:
            seen.add(goal)
            normalized.append(goal)

    return True, None, normalized


def apply_set_timeline_order(state: Dict[str, Any], order: List[str]) -> Dict[str, Any]:
    """Apply validated timeline row ordering to agent state."""

    context = state.get("context")
    if not isinstance(context, dict):
        context = {}

    updated_context = dict(context)
    updated_context["scf_timeline_order"] = order
    state["context"] = updated_context

    order_str = ", ".join(order) if order else "none"
    internal_tool_message = AIMessage(
        content=(
            f"[TOOL_STATUS] {TOOL_NAME_SET_TIMELINE_ORDER} success: order=[{order_str}]."
        ),
        additional_kwargs={
            "internal_tool_status": True,
            "tool_name": TOOL_NAME_SET_TIMELINE_ORDER,
            "order": order,
        },
    )

    return {
        "messages": [internal_tool_message],
        "has_tool_call": False,
        "requested_tool": None,
        "context": updated_context,
        "tool_should_loopback": True,
    }


def validate_reset_timeline_args(args: List[str]) -> Tuple[bool, Optional[str], Dict[str, Any]]:
    """Validate arguments for scf_reset_timeline (no args allowed)."""

    if args:
        return (
            False,
            f"{TOOL_NAME_RESET_TIMELINE} does not take any arguments. "
            f"Call it like: {TOOL_NAME_RESET_TIMELINE}",
            {},
        )

    return True, None, {"reset": True}


def apply_reset_timeline(state: Dict[str, Any], payload: Dict[str, Any]) -> Dict[str, Any]:
    """Reset SCF timeline windows and ordering in the agent state."""

    context = state.get("context")
    if not isinstance(context, dict):
        context = {}

    updated_context = dict(context)
    updated_context["scf_timeline_windows"] = {}
    updated_context["scf_timeline_order"] = []
    state["context"] = updated_context

    internal_tool_message = AIMessage(
        content=(
            f"[TOOL_STATUS] {TOOL_NAME_RESET_TIMELINE} success: timeline reset to defaults."
        ),
        additional_kwargs={
            "internal_tool_status": True,
            "tool_name": TOOL_NAME_RESET_TIMELINE,
        },
    )

    return {
        "messages": [internal_tool_message],
        "has_tool_call": False,
        "requested_tool": None,
        "context": updated_context,
        "tool_should_loopback": True,
    }

