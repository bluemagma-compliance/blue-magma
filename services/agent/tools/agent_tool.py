"""
AgentTool - Tool for managing agents in GraphLang Agent

Provides methods to:
- List all agents for a project
- View full details of a specific agent
- Create new agents with custom data sources and instructions (with writer step)
- Edit existing agents (with writer step)
- Delete agents
"""

import requests
import json
from typing import Dict, Any, Optional, List
from langchain_core.messages import HumanMessage, AIMessage


class AgentTool:
    """Tool for managing agents via backend API with LLM-based writer step"""

    def __init__(self, backend_url: str = "http://app:8080", llm_client: Optional[Any] = None):
        """
        Initialize AgentTool with backend URL and optional LLM client

        Args:
            backend_url: Backend API base URL
            llm_client: LangChain LLM client for writer step
        """
        self.backend_url = backend_url
        self.request_timeout = 30
        self.llm_client = llm_client

    def list_agents(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str
    ) -> Dict[str, Any]:
        """
        List all agents for a project

        Args:
            jwt_token: JWT authentication token
            org_id: Organization ID
            project_id: Project ID

        Returns:
            Dict with success status and agents list
        """
        try:
            if not project_id or not project_id.strip():
                return {"success": False, "error": "Project ID cannot be empty"}

            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json"
            }

            response = requests.get(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/agent",
                headers=headers,
                timeout=self.request_timeout
            )

            if response.status_code == 401:
                return {"success": False, "error": "Unauthorized: Invalid JWT token"}
            elif response.status_code == 404:
                return {"success": True, "agents": []}
            elif response.status_code == 200:
                data = response.json()
                # Handle both dict response with "agents" key and direct list response
                if isinstance(data, dict):
                    agents = data.get("agents", [])
                elif isinstance(data, list):
                    agents = data
                else:
                    return {"success": False, "error": f"Unexpected response format: {type(data)}"}
                return {
                    "success": True,
                    "agents": agents,
                    "message": f"Retrieved {len(agents)} agents"
                }
            else:
                return {"success": False, "error": f"Failed to fetch agents: HTTP {response.status_code}"}

        except Exception as e:
            return {"success": False, "error": f"Unexpected error: {str(e)}"}

    def view_agent(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        agent_id: str
    ) -> Dict[str, Any]:
        """
        View full details of a specific agent

        Args:
            jwt_token: JWT authentication token
            org_id: Organization ID
            project_id: Project ID
            agent_id: Agent ID

        Returns:
            Dict with success status and agent details
        """
        try:
            if not agent_id or not agent_id.strip():
                return {"success": False, "error": "Agent ID cannot be empty"}

            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json"
            }

            response = requests.get(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/agent/{agent_id}",
                headers=headers,
                timeout=self.request_timeout
            )

            if response.status_code == 401:
                return {"success": False, "error": "Unauthorized: Invalid JWT token"}
            elif response.status_code == 404:
                return {"success": False, "error": "Agent not found"}
            elif response.status_code == 200:
                agent = response.json()
                return {
                    "success": True,
                    "agent": agent
                }
            else:
                return {"success": False, "error": f"Failed to fetch agent: HTTP {response.status_code}"}

        except Exception as e:
            return {"success": False, "error": f"Unexpected error: {str(e)}"}

    def delete_agent(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        agent_id: str
    ) -> Dict[str, Any]:
        """
        Delete an agent

        Args:
            jwt_token: JWT authentication token
            org_id: Organization ID
            project_id: Project ID
            agent_id: Agent ID to delete

        Returns:
            Dict with success status
        """
        try:
            if not agent_id or not agent_id.strip():
                return {"success": False, "error": "Agent ID cannot be empty"}

            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json"
            }

            response = requests.delete(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/agent/{agent_id}",
                headers=headers,
                timeout=self.request_timeout
            )

            if response.status_code == 401:
                return {"success": False, "error": "Unauthorized: Invalid JWT token"}
            elif response.status_code == 204 or response.status_code == 200:
                return {
                    "success": True,
                    "message": "Agent deleted successfully"
                }
            else:
                return {"success": False, "error": f"Failed to delete agent: HTTP {response.status_code}"}

        except Exception as e:
            return {"success": False, "error": f"Unexpected error: {str(e)}"}

    def create_agent(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        agent_name: str,
        agent_description: str,
        data_sources: List[str],
        instructions: str,
        output_format: str,
        schedule: str,
        is_active: bool
    ) -> Dict[str, Any]:
        """
        Create a new agent with custom configuration

        Args:
            jwt_token: JWT authentication token
            org_id: Organization ID
            project_id: Project ID
            agent_name: Name of the agent
            agent_description: Description of the agent
            data_sources: List of data sources
            instructions: Agent instructions
            output_format: Desired output format
            schedule: Cron schedule
            is_active: Whether agent is active

        Returns:
            Dict with success status and agent ID
        """
        try:
            if not agent_name or not agent_name.strip():
                return {"success": False, "error": "Agent name cannot be empty"}
            if not agent_description or not agent_description.strip():
                return {"success": False, "error": "Agent description cannot be empty"}
            if not schedule or not schedule.strip():
                return {"success": False, "error": "Schedule cannot be empty"}

            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json"
            }

            payload = {
                "name": agent_name.strip(),
                "description": agent_description.strip(),
                "data_sources": data_sources,
                "instructions": instructions.strip(),
                "output_format": output_format.strip(),
                "schedule": schedule.strip(),
                "is_active": is_active
            }

            response = requests.post(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/agent",
                headers=headers,
                json=payload,
                timeout=self.request_timeout
            )

            if response.status_code == 401:
                return {"success": False, "error": "Unauthorized: Invalid JWT token"}
            elif response.status_code == 201:
                data = response.json()
                return {
                    "success": True,
                    "object_id": data.get("object_id"),
                    "name": data.get("name"),
                    "message": "Agent created successfully"
                }
            else:
                return {"success": False, "error": f"Failed to create agent: HTTP {response.status_code}"}

        except Exception as e:
            return {"success": False, "error": f"Unexpected error: {str(e)}"}

    def edit_agent(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        agent_id: str,
        updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Edit an existing agent

        Args:
            jwt_token: JWT authentication token
            org_id: Organization ID
            project_id: Project ID
            agent_id: ID of agent to edit
            updates: Dict of fields to update

        Returns:
            Dict with success status
        """
        try:
            if not agent_id or not agent_id.strip():
                return {"success": False, "error": "Agent ID cannot be empty"}
            if not updates:
                return {"success": False, "error": "No updates provided"}

            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json"
            }

            response = requests.put(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/agent/{agent_id}",
                headers=headers,
                json=updates,
                timeout=self.request_timeout
            )

            if response.status_code == 401:
                return {"success": False, "error": "Unauthorized: Invalid JWT token"}
            elif response.status_code == 200:
                return {
                    "success": True,
                    "message": "Agent updated successfully"
                }
            else:
                return {"success": False, "error": f"Failed to update agent: HTTP {response.status_code}"}

        except Exception as e:
            return {"success": False, "error": f"Unexpected error: {str(e)}"}


    async def _generate_agent_fields(
        self,
        agent_name: str,
        content_instructions: str,
        last_messages: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Use LLM to generate agent fields from content instructions (Writer Step)
        Includes retry mechanism for JSON parsing failures.

        Args:
            agent_name: Name of the agent
            content_instructions: Natural language description of what the agent should do
            last_messages: Last 15 messages for context

        Returns:
            Dict with generated fields or error
        """
        if not self.llm_client:
            return {"success": False, "error": "LLM client not available for writer step"}

        max_retries = 2
        retry_count = 0

        while retry_count <= max_retries:
            try:
                prompt = f"""Generate agent configuration as JSON. Return ONLY the JSON object, no markdown.

Agent: {agent_name}
Instructions: {content_instructions}

JSON fields required:
- title: A concise title for this agent (e.g., "Code Quality Analyzer")
- agent_description: 1-2 sentence description of what the agent does
- data_sources: array of strings (e.g., ["github-repo-1", "confluence-docs"])
- instructions: detailed text instructions for the agent
- output_format: desired output format (e.g., "JSON report with metrics and recommendations")
- schedule: cron format (e.g., "0 0 1 * *")
- is_active: true or false

Example:
{{"title": "Security Scanner", "agent_description": "Scans code for security vulnerabilities", "data_sources": ["github-repo"], "instructions": "Check for...", "output_format": "JSON with severity levels", "schedule": "0 0 * * 1", "is_active": true}}

Return valid JSON only. Do not wrap in markdown code blocks."""

                response = await self.llm_client.ainvoke([HumanMessage(content=prompt)])
                raw_text = response.content.strip()

                # NOTE: previously we had inline markdown/JSON stripping here. This was
                # moved into shared helpers in llm_parsing_utils.py so that all writer
                # steps handle weirdly formatted JSON responses consistently.
                from llm_parsing_utils import clean_json_markdown

                response_text = clean_json_markdown(raw_text)

                # Parse JSON response
                try:
                    generated_fields = json.loads(response_text)
                    return {"success": True, "fields": generated_fields}
                except json.JSONDecodeError as json_err:
                    retry_count += 1
                    if retry_count <= max_retries:
                        print(f"⚠️ Writer step JSON parse failed (attempt {retry_count}/{max_retries}): {str(json_err)[:100]}", flush=True)
                        print(f"   Response was: {response_text[:150]}...", flush=True)
                        continue
                    else:
                        print(f"❌ Writer step failed after {max_retries} retries: Invalid JSON", flush=True)
                        return {"success": False, "error": f"LLM response is not valid JSON after {max_retries} retries: {response_text[:200]}"}

            except Exception as e:
                return {"success": False, "error": f"Error in writer step: {str(e)}"}

        return {"success": False, "error": "Writer step failed"}

    async def _generate_update_fields(
        self,
        content_instructions: str,
        current_agent: Dict[str, Any],
        last_messages: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Use LLM to generate update fields from content instructions (Writer Step for edit)
        Includes retry mechanism for JSON parsing failures.

        Args:
            content_instructions: Natural language description of changes
            current_agent: Current agent configuration
            last_messages: Last 15 messages for context

        Returns:
            Dict with generated update fields or error
        """
        if not self.llm_client:
            return {"success": False, "error": "LLM client not available for writer step"}

        max_retries = 2
        retry_count = 0

        while retry_count <= max_retries:
            try:
                current_name = current_agent.get("name", "")
                current_desc = current_agent.get("description", "")

                prompt = f"""Generate agent updates as JSON. Return ONLY the JSON object, no markdown.

Current: {current_name} - {current_desc}
Update: {content_instructions}

Return JSON with ONLY fields to change (omit unchanged fields):
- title: new title (if changing)
- name: new name (if changing)
- description: new description (if changing)
- data_sources: updated data sources array (if changing)
- instructions: updated instructions (if changing)
- output_format: updated output format (if changing)
- schedule: cron format (if changing)
- is_active: true/false (if changing)

Return valid JSON only. Do not wrap in markdown code blocks."""

                response = await self.llm_client.ainvoke([HumanMessage(content=prompt)])
                raw_text = response.content.strip()

                # NOTE: previously we had inline markdown/JSON stripping here. This was
                # moved into shared helpers in llm_parsing_utils.py so that all writer
                # steps handle weirdly formatted JSON responses consistently.
                from llm_parsing_utils import clean_json_markdown

                response_text = clean_json_markdown(raw_text)

                # Parse JSON response
                try:
                    update_fields = json.loads(response_text)
                    return {"success": True, "fields": update_fields}
                except json.JSONDecodeError as json_err:
                    retry_count += 1
                    if retry_count <= max_retries:
                        print(f"⚠️ Writer step JSON parse failed (attempt {retry_count}/{max_retries}): {str(json_err)[:100]}", flush=True)
                        print(f"   Response was: {response_text[:150]}...", flush=True)
                        continue
                    else:
                        print(f"❌ Writer step failed after {max_retries} retries: Invalid JSON", flush=True)
                        return {"success": False, "error": f"LLM response is not valid JSON after {max_retries} retries: {response_text[:200]}"}

            except Exception as e:
                return {"success": False, "error": f"Error in writer step: {str(e)}"}

        return {"success": False, "error": "Writer step failed"}

    async def create_agent_with_writer(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        agent_name: str,
        content_instructions: str,
        last_messages: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Create agent using writer step to generate fields from content instructions

        Args:
            jwt_token: JWT authentication token
            org_id: Organization ID
            project_id: Project ID
            agent_name: Name of the agent
            content_instructions: Natural language description of agent requirements
            last_messages: Last 15 messages for context

        Returns:
            Dict with success status and agent ID
        """
        try:
            if not agent_name or not agent_name.strip():
                return {"success": False, "error": "Agent name cannot be empty"}
            if not content_instructions or not content_instructions.strip():
                return {"success": False, "error": "Content instructions cannot be empty"}

            # Step 1: Generate fields using writer step
            writer_result = await self._generate_agent_fields(
                agent_name=agent_name,
                content_instructions=content_instructions,
                last_messages=last_messages
            )

            if not writer_result.get("success"):
                return writer_result

            generated_fields = writer_result.get("fields", {})

            # Step 2: Extract generated fields
            title = generated_fields.get("title", agent_name)
            agent_description = generated_fields.get("agent_description", "")
            data_sources = generated_fields.get("data_sources", [])
            instructions = generated_fields.get("instructions", "")
            output_format = generated_fields.get("output_format", "")
            schedule = generated_fields.get("schedule", "0 0 1 * *")
            is_active = generated_fields.get("is_active", True)

            # Step 3: Call backend API with generated fields
            return self.create_agent(
                jwt_token=jwt_token,
                org_id=org_id,
                project_id=project_id,
                agent_name=title,
                agent_description=agent_description,
                data_sources=data_sources,
                instructions=instructions,
                output_format=output_format,
                schedule=schedule,
                is_active=is_active
            )

        except Exception as e:
            return {"success": False, "error": f"Unexpected error in create_agent_with_writer: {str(e)}"}

    async def edit_agent_with_writer(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        agent_id: str,
        content_instructions: str,
        current_agent: Dict[str, Any],
        last_messages: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Edit agent using writer step to generate update fields from content instructions

        Args:
            jwt_token: JWT authentication token
            org_id: Organization ID
            project_id: Project ID
            agent_id: ID of agent to edit
            content_instructions: Natural language description of changes
            current_agent: Current agent configuration
            last_messages: Last 15 messages for context

        Returns:
            Dict with success status
        """
        try:
            if not agent_id or not agent_id.strip():
                return {"success": False, "error": "Agent ID cannot be empty"}
            if not content_instructions or not content_instructions.strip():
                return {"success": False, "error": "Content instructions cannot be empty"}

            # Step 1: Generate update fields using writer step
            writer_result = await self._generate_update_fields(
                content_instructions=content_instructions,
                current_agent=current_agent,
                last_messages=last_messages
            )

            if not writer_result.get("success"):
                return writer_result

            update_fields = writer_result.get("fields", {})

            if not update_fields:
                return {"success": False, "error": "No fields to update generated"}

            # Step 2: Call backend API with update fields
            return self.edit_agent(
                jwt_token=jwt_token,
                org_id=org_id,
                project_id=project_id,
                agent_id=agent_id,
                updates=update_fields
            )

        except Exception as e:
            return {"success": False, "error": f"Unexpected error in edit_agent_with_writer: {str(e)}"}

