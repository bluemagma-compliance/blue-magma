"""ProjectTaskTool - project-level tasks read/create with writer step."""

from typing import Any, Dict, List, Optional

import json
import requests
from langchain_core.messages import HumanMessage


TOOL_NAME_READ_PROJECT_TASKS: str = "read_project_tasks"
TOOL_NAME_CREATE_PROJECT_TASK: str = "create_project_task"

_ALLOWED_STATUS_FILTERS = {"todo", "in_progress", "completed", "all"}

READ_PROJECT_TASKS_TOOL_PROMPT: str = f"""
        - {TOOL_NAME_READ_PROJECT_TASKS}: list project tasks for the current project.
            arguments: [status?] (optional)
            - If you omit the status argument, the assistant will show tasks of any status.
            - Allowed statuses: todo, in_progress, completed, all.
            - The tool will always summarize at most the 10 most recent tasks in its reply.
    """

CREATE_PROJECT_TASK_TOOL_PROMPT: str = f"""
        - {TOOL_NAME_CREATE_PROJECT_TASK}: create a new project task from a plain-English description.
            arguments: [task_description]
            - Provide ONE argument: a short natural language description of the task you want.
            - A writer step will infer fields like title, status, priority, and due date.
            - The tool will return a summary of the created task.
    """


class ProjectTaskTool:
    """HTTP client + writer step helpers for project tasks."""

    def __init__(self, backend_url: str = "http://app:8080", llm_client: Optional[Any] = None):
        self.backend_url = backend_url
        self.request_timeout = 30
        self.llm_client = llm_client

    def read_tasks(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        status_filter: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Fetch project tasks from backend with optional status filter."""
        try:
            if not project_id or not str(project_id).strip():
                return {"success": False, "error": "Project ID cannot be empty.", "tasks": []}

            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json",
            }
            params: Dict[str, Any] = {}

            key = (status_filter or "").strip().lower()
            if key and key in _ALLOWED_STATUS_FILTERS and key != "all":
                params["status"] = key

            # Ask backend for a reasonable number; we'll truncate to 10 in the agent.
            params["limit"] = 50

            response = requests.get(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/task",
                headers=headers,
                params=params or None,
                timeout=self.request_timeout,
            )

            if response.status_code == 401:
                return {
                    "success": False,
                    "error": "Unauthorized: Invalid JWT token",
                    "status_code": 401,
                    "tasks": [],
                }
            if response.status_code == 404:
                # No tasks yet is not an error.
                return {"success": True, "tasks": [], "message": "No tasks found"}
            if response.status_code != 200:
                return {
                    "success": False,
                    "error": f"Failed to fetch tasks: HTTP {response.status_code}",
                    "status_code": response.status_code,
                    "tasks": [],
                }

            data = response.json()
            if isinstance(data, dict):
                tasks = data.get("tasks") or data.get("items") or []
            elif isinstance(data, list):
                tasks = data
            else:
                return {
                    "success": False,
                    "error": f"Unexpected response format: {type(data)}",
                    "tasks": [],
                }

            return {
                "success": True,
                "tasks": tasks,
                "message": f"Retrieved {len(tasks)} tasks",
            }
        except requests.exceptions.Timeout:
            return {
                "success": False,
                "error": "Timeout fetching project tasks",
                "tasks": [],
            }
        except requests.exceptions.ConnectionError:
            return {
                "success": False,
                "error": "Connection error fetching project tasks",
                "tasks": [],
            }
        except Exception as e:  # pragma: no cover - defensive
            return {
                "success": False,
                "error": f"Unexpected error fetching project tasks: {str(e)}",
                "tasks": [],
            }

    async def _generate_task_fields(
        self,
        task_description: str,
        last_messages: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Use LLM writer step to turn description into structured task fields."""
        if not self.llm_client:
            return {"success": False, "error": "LLM client not available for writer step"}

        prompt = f"""Generate a project task as JSON. Return ONLY the JSON object, no markdown.

Task description: {task_description}

Use this JSON schema:
- title: short human-readable title for the task
- description: longer explanation of the task
- status: one of \"todo\", \"in_progress\", \"completed\" (default \"todo\")
- priority: one of \"low\", \"medium\", \"high\", \"critical\" (default \"medium\")
- due_date: ISO 8601 date or null if no clear due date
- document_id: null unless the description clearly refers to a specific document id
- evidence_request_id: null unless the description clearly refers to a specific evidence request id

Return valid JSON only. Do not wrap in markdown code blocks."""

        # We ignore last_messages content for now but keep the signature similar to other writer helpers.
        try:
            from llm_parsing_utils import clean_json_markdown

            response = await self.llm_client.ainvoke([HumanMessage(content=prompt)])
            raw_text = response.content.strip()
            response_text = clean_json_markdown(raw_text)
            fields = json.loads(response_text)
            return {"success": True, "fields": fields}
        except Exception as e:
            return {"success": False, "error": f"Error in writer step: {str(e)}"}

    async def create_task_with_writer(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        task_description: str,
        last_messages: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Run writer step then create a task via backend API."""
        if not task_description or not task_description.strip():
            return {"success": False, "error": "Task description cannot be empty"}

        writer_result = await self._generate_task_fields(task_description, last_messages)
        if not writer_result.get("success"):
            return writer_result

        fields = writer_result.get("fields") or {}
        title = (fields.get("title") or task_description).strip()
        description = (fields.get("description") or task_description).strip()
        status = str(fields.get("status") or "todo").strip().lower()
        if status not in {"todo", "in_progress", "completed"}:
            status = "todo"
        priority = str(fields.get("priority") or "medium").strip().lower()
        if priority not in {"low", "medium", "high", "critical"}:
            priority = "medium"

        payload: Dict[str, Any] = {
            "title": title,
            "description": description,
            "status": status,
            "priority": priority,
            "due_date": fields.get("due_date"),
            "document_id": fields.get("document_id"),
            "evidence_request_id": fields.get("evidence_request_id"),
        }

        try:
            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json",
            }
            response = requests.post(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/task",
                headers=headers,
                json=payload,
                timeout=self.request_timeout,
            )
            if response.status_code == 401:
                return {"success": False, "error": "Unauthorized: Invalid JWT token"}
            if response.status_code not in (200, 201):
                return {
                    "success": False,
                    "error": f"Failed to create task: HTTP {response.status_code}",
                    "status_code": response.status_code,
                }
            data = response.json()
            return {
                "success": True,
                "task": data,
                "object_id": data.get("object_id") or data.get("id"),
            }
        except Exception as e:  # pragma: no cover - defensive
            return {"success": False, "error": f"Unexpected error creating task: {str(e)}"}

