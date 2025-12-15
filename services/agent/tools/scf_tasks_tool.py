"""scf_tasks tool definition for SCF configuration.

This tool manages small internal tasks related to the SCF config
experience and controls loopback behavior (when a task is done
or retried).

Implemented only for the SCF context for now.
"""

from typing import List, Tuple, Optional, Dict, Any
import uuid

from langchain_core.messages import AIMessage

TOOL_NAME: str = "scf_tasks"

ALLOWED_ACTIONS: List[str] = [
    "create_task",
    "mark_done",
    "mark_error",
    "retry_task",
    "skip_task",
]

_ALLOWED_ACTIONS_STR = ", ".join(ALLOWED_ACTIONS)

SCF_TASKS_TOOL_PROMPT: str = f"""
        - {TOOL_NAME}: manage internal tasks related to configuring the SCF page
            arguments: [action, ...]
            - Call the tool as: {TOOL_NAME}, action, arg1, arg2
            - Allowed actions: {_ALLOWED_ACTIONS_STR}
            - create_task: {TOOL_NAME}, create_task, short task title
            - mark_done: {TOOL_NAME}, mark_done, task_id
            - mark_error: {TOOL_NAME}, mark_error, task_id
            - retry_task: {TOOL_NAME}, retry_task, task_id
            - skip_task: {TOOL_NAME}, skip_task, task_id
            IMPORTANT:
            - You may only create a new task if there are no active tasks
              (PENDING or IN_PROGRESS).
"""

DEFAULT_MAX_ATTEMPTS = 3


def _normalize_action(raw: str) -> Optional[str]:
    key = (raw or "").strip().lower()
    if key in {"create", "create_task"}:
        return "create_task"
    if key in {"done", "complete", "mark_done"}:
        return "mark_done"
    if key in {"error", "fail", "mark_error"}:
        return "mark_error"
    if key in {"retry", "retry_task"}:
        return "retry_task"
    if key in {"skip", "skip_task"}:
        return "skip_task"
    return None


def validate_args(args: List[str]) -> Tuple[bool, Optional[str], Dict[str, Any]]:
    """Validate and normalize arguments for the scf_tasks tool.

    Returns (ok, error_message, payload_dict).
    """
    if not args:
        return False, (
            f"{TOOL_NAME} requires an action. "
            f"Call it like: {TOOL_NAME}, create_task, short title"
        ), {}

    action = _normalize_action(args[0])
    if not action:
        return False, (
            f"Invalid action for {TOOL_NAME}: {args[0]}. "
            f"Allowed actions: {_ALLOWED_ACTIONS_STR}"
        ), {}

    if action == "create_task":
        if len(args) < 2 or not args[1].strip():
            return False, (
                f"{TOOL_NAME} create_task requires a short task title. "
                f"Example: {TOOL_NAME}, create_task, Configure SOC2 L1 filters"
            ), {}
        title = args[1].strip()
        description = " ".join(a.strip() for a in args[2:] if a.strip())
        return True, None, {
            "action": action,
            "title": title,
            "description": description,
        }

    # All other actions expect at least a task_id
    if len(args) < 2 or not args[1].strip():
        return False, (
            f"{TOOL_NAME} {action} requires a task_id. "
            f"Call it like: {TOOL_NAME}, {action}, <task_id>"
        ), {}

    task_id = args[1].strip()
    comment = " ".join(a.strip() for a in args[2:] if a.strip())
    return True, None, {
        "action": action,
        "task_id": task_id,
        "comment": comment,
    }


def apply_action(state: Dict[str, Any], payload: Dict[str, Any]) -> Dict[str, Any]:
    """Apply a validated scf_tasks action to the agent state.

    Tasks are stored under context['scf_tasks'] and
    context['scf_current_task_id'].
    """
    context = state.get("context")
    if not isinstance(context, dict):
        context = {}

    tasks = context.get("scf_tasks") or []
    if not isinstance(tasks, list):
        tasks = []

    action = payload.get("action")
    updated_tasks = list(tasks)
    tool_should_loopback: Optional[bool] = None

    if action == "create_task":
        new_id = str(uuid.uuid4())
        new_task = {
            "id": new_id,
            "title": payload.get("title") or "SCF task",
            "description": payload.get("description") or "",
            "status": "PENDING",
            "attempts": 0,
            "max_attempts": DEFAULT_MAX_ATTEMPTS,
            "history": [],
        }
        updated_tasks.append(new_task)
        context = dict(context)
        context["scf_tasks"] = updated_tasks
        context["scf_current_task_id"] = new_id
        state["context"] = context

        internal_tool_message = AIMessage(
            content=(
                f"[TOOL_STATUS] {TOOL_NAME} action=create_task: created task_id={new_id}, "
                f"title='{new_task['title']}'."
            ),
            additional_kwargs={"internal_tool_status": True, "tool_name": TOOL_NAME},
        )
        # Creating a task should continue the loop.
        return {
            "messages": [internal_tool_message],
            "has_tool_call": False,
            "requested_tool": None,
            "context": context,
        }

    # For actions that target an existing task
    task_id = payload.get("task_id")
    comment = payload.get("comment") or ""
    new_tasks: List[Dict[str, Any]] = []
    for t in updated_tasks:
        if str(t.get("id")) != str(task_id):
            new_tasks.append(t)
            continue

        t_copy = dict(t)
        history = list(t_copy.get("history") or [])
        if comment:
            history.append({"type": "note", "comment": comment})
        t_copy["history"] = history

        if action == "mark_done":
            t_copy["status"] = "DONE"
            tool_should_loopback = False
            context = dict(context)
            context["scf_current_task_id"] = None
        elif action == "mark_error":
            t_copy["status"] = "ERROR"
            tool_should_loopback = False
            context = dict(context)
            context["scf_current_task_id"] = None
        elif action == "skip_task":
            t_copy["status"] = "SKIPPED"
            tool_should_loopback = False
            context = dict(context)
            context["scf_current_task_id"] = None
        elif action == "retry_task":
            attempts = int(t_copy.get("attempts", 0))
            max_attempts = int(t_copy.get("max_attempts", DEFAULT_MAX_ATTEMPTS))
            if attempts >= max_attempts:
                t_copy["status"] = "ERROR"
                tool_should_loopback = False
                context = dict(context)
                context["scf_current_task_id"] = None
            else:
                t_copy["status"] = "IN_PROGRESS"
                t_copy["attempts"] = attempts + 1
                tool_should_loopback = True
                context = dict(context)
                context["scf_current_task_id"] = t_copy["id"]

        new_tasks.append(t_copy)

    context = dict(context)
    context["scf_tasks"] = new_tasks
    state["context"] = context

    # Internal tool-status message for the LLM (not user-visible)
    target_task = None
    for t in new_tasks:
        if str(t.get("id")) == str(task_id):
            target_task = t
            break

    if target_task is not None:
        status = str(target_task.get("status", "UNKNOWN"))
        attempts = int(target_task.get("attempts", 0))
        max_attempts = int(target_task.get("max_attempts", DEFAULT_MAX_ATTEMPTS))
        content = (
            f"[TOOL_STATUS] {TOOL_NAME} action={action} on task_id={task_id}: "
            f"status={status}, attempts={attempts}/{max_attempts}."
        )
    else:
        content = f"[TOOL_STATUS] {TOOL_NAME} action={action}: no task found with id={task_id}."

    internal_tool_message = AIMessage(
        content=content,
        additional_kwargs={"internal_tool_status": True, "tool_name": TOOL_NAME},
    )

    result: Dict[str, Any] = {
        "messages": [internal_tool_message],
        "has_tool_call": False,
        "requested_tool": None,
        "context": context,
    }
    if tool_should_loopback is not None:
        result["tool_should_loopback"] = tool_should_loopback
    return result

