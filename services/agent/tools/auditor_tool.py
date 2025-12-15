"""
AuditorTool - Tool for managing auditors in GraphLang Agent

Provides methods to:
- List all auditors for a project
- View full details of a specific auditor
- Create new auditors with custom requirements (with writer step)
- Edit existing auditors (with writer step)
"""

import requests
import json
from typing import Dict, Any, Optional, List
from langchain_core.messages import HumanMessage, AIMessage


class AuditorTool:
    """Tool for managing auditors via backend API with LLM-based writer step"""

    def __init__(self, backend_url: str = "http://app:8080", llm_client: Optional[Any] = None):
        """
        Initialize AuditorTool with backend URL and optional LLM client

        Args:
            backend_url: Backend API base URL
            llm_client: LangChain LLM client for writer step
        """
        self.backend_url = backend_url
        self.request_timeout = 30
        self.llm_client = llm_client

    def list_auditors(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str
    ) -> Dict[str, Any]:
        """
        List all auditors for a project
        
        Args:
            jwt_token: JWT authentication token
            org_id: Organization ID
            project_id: Project ID
            
        Returns:
            Dict with success status and auditors list
        """
        try:
            if not project_id or not project_id.strip():
                return {"success": False, "error": "Project ID cannot be empty"}

            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json"
            }

            response = requests.get(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/auditor",
                headers=headers,
                timeout=self.request_timeout
            )

            if response.status_code == 401:
                return {"success": False, "error": "Unauthorized: Invalid JWT token"}
            elif response.status_code == 404:
                return {"success": True, "auditors": []}
            elif response.status_code == 200:
                data = response.json()
                # Handle both dict response with "auditors" key and direct list response
                if isinstance(data, dict):
                    auditors = data.get("auditors", [])
                elif isinstance(data, list):
                    auditors = data
                else:
                    return {"success": False, "error": f"Unexpected response format: {type(data)}"}
                return {
                    "success": True,
                    "auditors": auditors,
                    "message": f"Retrieved {len(auditors)} auditors"
                }
            else:
                return {"success": False, "error": f"Failed to fetch auditors: HTTP {response.status_code}"}

        except Exception as e:
            return {"success": False, "error": f"Unexpected error: {str(e)}"}

    def view_auditor(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        auditor_id: str
    ) -> Dict[str, Any]:
        """
        View full details of a specific auditor
        
        Args:
            jwt_token: JWT authentication token
            org_id: Organization ID
            project_id: Project ID
            auditor_id: Auditor ID
            
        Returns:
            Dict with success status and auditor details
        """
        try:
            if not auditor_id or not auditor_id.strip():
                return {"success": False, "error": "Auditor ID cannot be empty"}

            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json"
            }

            response = requests.get(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/auditor/{auditor_id}",
                headers=headers,
                timeout=self.request_timeout
            )

            if response.status_code == 401:
                return {"success": False, "error": "Unauthorized: Invalid JWT token"}
            elif response.status_code == 404:
                return {"success": False, "error": f"Auditor with ID '{auditor_id}' not found"}
            elif response.status_code == 200:
                auditor = response.json()
                return {
                    "success": True,
                    "auditor": auditor,
                    "message": f"Retrieved auditor: {auditor.get('name', 'Unknown')}"
                }
            else:
                return {"success": False, "error": f"Failed to fetch auditor: HTTP {response.status_code}"}

        except Exception as e:
            return {"success": False, "error": f"Unexpected error: {str(e)}"}

    async def _generate_auditor_fields(
        self,
        auditor_name: str,
        content_instructions: str,
        last_messages: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Use LLM to generate auditor fields from content instructions (Writer Step)
        Includes retry mechanism for JSON parsing failures and title generation.

        Args:
            auditor_name: Name of the auditor
            content_instructions: Natural language description of what the auditor should check
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
                prompt = f"""Generate auditor configuration as JSON. Return ONLY the JSON object, no markdown.

Auditor: {auditor_name}
Instructions: {content_instructions}

JSON fields required:
- title: A concise title for this auditor (e.g., "MFA Compliance Auditor")
- auditor_description: 1-2 sentence description
- schedule: cron format (e.g., "0 0 1 * *")
- is_active: true or false
- instructions:
  - requirements: array of objects with id, title, description, context, success_criteria (array), failure_criteria (array), weight (1-100)
  - passing_score: 0-100
  - evaluation_instructions: how to evaluate

Example requirement:
{{"id": "mfa-1", "title": "MFA Enabled", "description": "All users have MFA", "context": "Check user settings", "success_criteria": ["100% enrollment"], "failure_criteria": ["Any user without MFA"], "weight": 90}}

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
                retry_count += 1
                if retry_count <= max_retries:
                    print(f"⚠️ Writer step error (attempt {retry_count}/{max_retries}): {str(e)[:100]}", flush=True)
                    continue
                else:
                    print(f"❌ Writer step failed after {max_retries} retries: {str(e)}", flush=True)
                    return {"success": False, "error": f"Writer step failed after {max_retries} retries: {str(e)}"}

    async def _generate_update_fields(
        self,
        content_instructions: str,
        current_auditor: Dict[str, Any],
        last_messages: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Use LLM to generate update fields from content instructions (Writer Step for edit)
        Includes retry mechanism for JSON parsing failures.

        Args:
            content_instructions: Natural language description of changes
            current_auditor: Current auditor configuration
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
                current_name = current_auditor.get("name", "")
                current_desc = current_auditor.get("description", "")

                prompt = f"""Generate auditor updates as JSON. Return ONLY the JSON object, no markdown.

Current: {current_name} - {current_desc}
Update: {content_instructions}

Return JSON with ONLY fields to change (omit unchanged fields):
- title: new title (if changing)
- name: new name (if changing)
- description: new description (if changing)
- schedule: cron format (if changing)
- is_active: true/false (if changing)
- instructions: updated instructions object (if changing)

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
                retry_count += 1
                if retry_count <= max_retries:
                    print(f"⚠️ Writer step error (attempt {retry_count}/{max_retries}): {str(e)[:100]}", flush=True)
                    continue
                else:
                    print(f"❌ Writer step failed after {max_retries} retries: {str(e)}", flush=True)
                    return {"success": False, "error": f"Writer step failed after {max_retries} retries: {str(e)}"}

    def create_auditor(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        auditor_name: str,
        auditor_description: str,
        schedule: str,
        is_active: bool,
        instructions: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Create a new auditor with custom requirements
        
        Args:
            jwt_token: JWT authentication token
            org_id: Organization ID
            project_id: Project ID
            auditor_name: Name of the auditor
            auditor_description: Description of the auditor
            schedule: Cron schedule (e.g., "0 0 1 * *")
            is_active: Whether auditor is active
            instructions: Instructions object with requirements
            
        Returns:
            Dict with success status and auditor ID
        """
        try:
            if not auditor_name or not auditor_name.strip():
                return {"success": False, "error": "Auditor name cannot be empty"}
            if not auditor_description or not auditor_description.strip():
                return {"success": False, "error": "Auditor description cannot be empty"}
            if not schedule or not schedule.strip():
                return {"success": False, "error": "Schedule cannot be empty"}

            # Validate instructions structure
            validation_error = self._validate_instructions(instructions)
            if validation_error:
                return {"success": False, "error": validation_error}

            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json"
            }

            payload = {
                "name": auditor_name.strip(),
                "description": auditor_description.strip(),
                "schedule": schedule.strip(),
                "is_active": is_active,
                "instructions": instructions
            }

            response = requests.post(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/auditor",
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
                    "message": "Auditor created successfully"
                }
            else:
                return {"success": False, "error": f"Failed to create auditor: HTTP {response.status_code}"}

        except Exception as e:
            return {"success": False, "error": f"Unexpected error: {str(e)}"}

    def edit_auditor(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        auditor_id: str,
        updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Edit an existing auditor (partial update)
        
        Args:
            jwt_token: JWT authentication token
            org_id: Organization ID
            project_id: Project ID
            auditor_id: Auditor ID to update
            updates: Dict with fields to update
            
        Returns:
            Dict with success status
        """
        try:
            if not auditor_id or not auditor_id.strip():
                return {"success": False, "error": "Auditor ID cannot be empty"}
            if not updates:
                return {"success": False, "error": "No updates provided"}

            # Validate instructions if provided
            if "instructions" in updates:
                validation_error = self._validate_instructions(updates["instructions"])
                if validation_error:
                    return {"success": False, "error": validation_error}

            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json"
            }

            response = requests.put(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/auditor/{auditor_id}",
                headers=headers,
                json=updates,
                timeout=self.request_timeout
            )

            if response.status_code == 401:
                return {"success": False, "error": "Unauthorized: Invalid JWT token"}
            elif response.status_code == 404:
                return {"success": False, "error": f"Auditor with ID '{auditor_id}' not found"}
            elif response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "object_id": data.get("object_id"),
                    "name": data.get("name"),
                    "message": "Auditor updated successfully"
                }
            else:
                return {"success": False, "error": f"Failed to update auditor: HTTP {response.status_code}"}

        except Exception as e:
            return {"success": False, "error": f"Unexpected error: {str(e)}"}

    def _validate_instructions(self, instructions: Dict[str, Any]) -> Optional[str]:
        """
        Validate instructions object structure
        
        Args:
            instructions: Instructions object to validate
            
        Returns:
            Error message if invalid, None if valid
        """
        if not isinstance(instructions, dict):
            return "instructions must be a dictionary"

        # Check requirements
        if "requirements" not in instructions:
            return "instructions.requirements is required"
        if not isinstance(instructions["requirements"], list):
            return "instructions.requirements must be an array"
        if not instructions["requirements"]:
            return "instructions.requirements must be non-empty"

        # Validate each requirement
        for i, req in enumerate(instructions["requirements"]):
            if not isinstance(req, dict):
                return f"requirement {i} must be a dictionary"
            
            required_fields = ["id", "title", "description", "context", "success_criteria", "failure_criteria", "weight"]
            for field in required_fields:
                if field not in req:
                    return f"requirement {i} missing required field: {field}"
            
            if not isinstance(req["success_criteria"], list) or not req["success_criteria"]:
                return f"requirement {i} success_criteria must be non-empty array"
            if not isinstance(req["failure_criteria"], list) or not req["failure_criteria"]:
                return f"requirement {i} failure_criteria must be non-empty array"

        # Check passing_score
        if "passing_score" not in instructions:
            return "instructions.passing_score is required"
        if not isinstance(instructions["passing_score"], (int, float)):
            return "instructions.passing_score must be a number"
        if not (0 <= instructions["passing_score"] <= 100):
            return "instructions.passing_score must be between 0 and 100"

        # Check evaluation_instructions
        if "evaluation_instructions" not in instructions:
            return "instructions.evaluation_instructions is required"
        if not instructions["evaluation_instructions"] or not str(instructions["evaluation_instructions"]).strip():
            return "instructions.evaluation_instructions cannot be empty"

        return None

    async def create_auditor_with_writer(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        auditor_name: str,
        content_instructions: str,
        last_messages: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Create auditor using writer step to generate fields from content instructions

        Args:
            jwt_token: JWT authentication token
            org_id: Organization ID
            project_id: Project ID
            auditor_name: Name of the auditor
            content_instructions: Natural language description of auditor requirements
            last_messages: Last 15 messages for context

        Returns:
            Dict with success status and auditor ID
        """
        try:
            if not auditor_name or not auditor_name.strip():
                return {"success": False, "error": "Auditor name cannot be empty"}
            if not content_instructions or not content_instructions.strip():
                return {"success": False, "error": "Content instructions cannot be empty"}

            # Step 1: Generate fields using writer step
            writer_result = await self._generate_auditor_fields(
                auditor_name=auditor_name,
                content_instructions=content_instructions,
                last_messages=last_messages
            )

            if not writer_result.get("success"):
                return writer_result

            generated_fields = writer_result.get("fields", {})

            # Step 2: Validate generated fields
            title = generated_fields.get("title", auditor_name)  # Use generated title or fallback to auditor_name
            auditor_description = generated_fields.get("auditor_description", "")
            schedule = generated_fields.get("schedule", "0 0 1 * *")
            is_active = generated_fields.get("is_active", True)
            instructions = generated_fields.get("instructions", {})

            if not title:
                return {"success": False, "error": "Generated title is empty"}
            if not auditor_description:
                return {"success": False, "error": "Generated auditor_description is empty"}
            if not schedule:
                return {"success": False, "error": "Generated schedule is empty"}
            if not instructions:
                return {"success": False, "error": "Generated instructions is empty"}

            # Validate instructions structure
            validation_error = self._validate_instructions(instructions)
            if validation_error:
                return {"success": False, "error": f"Generated instructions validation failed: {validation_error}"}

            # Step 3: Call backend API with generated fields (use title as auditor_name if different)
            return self.create_auditor(
                jwt_token=jwt_token,
                org_id=org_id,
                project_id=project_id,
                auditor_name=title,  # Use the generated title as the auditor name
                auditor_description=auditor_description,
                schedule=schedule,
                is_active=is_active,
                instructions=instructions
            )

        except Exception as e:
            return {"success": False, "error": f"Unexpected error in create_auditor_with_writer: {str(e)}"}

    async def edit_auditor_with_writer(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        auditor_id: str,
        content_instructions: str,
        current_auditor: Dict[str, Any],
        last_messages: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Edit auditor using writer step to generate update fields from content instructions

        Args:
            jwt_token: JWT authentication token
            org_id: Organization ID
            project_id: Project ID
            auditor_id: ID of auditor to edit
            content_instructions: Natural language description of changes
            current_auditor: Current auditor configuration
            last_messages: Last 15 messages for context

        Returns:
            Dict with success status
        """
        try:
            if not auditor_id or not auditor_id.strip():
                return {"success": False, "error": "Auditor ID cannot be empty"}
            if not content_instructions or not content_instructions.strip():
                return {"success": False, "error": "Content instructions cannot be empty"}

            # Step 1: Generate update fields using writer step
            writer_result = await self._generate_update_fields(
                content_instructions=content_instructions,
                current_auditor=current_auditor,
                last_messages=last_messages
            )

            if not writer_result.get("success"):
                return writer_result

            update_fields = writer_result.get("fields", {})

            if not update_fields:
                return {"success": False, "error": "No fields to update generated"}

            # Step 2: Validate instructions if provided
            if "instructions" in update_fields:
                validation_error = self._validate_instructions(update_fields["instructions"])
                if validation_error:
                    return {"success": False, "error": f"Generated instructions validation failed: {validation_error}"}

            # Step 3: Call backend API with update fields
            return self.edit_auditor(
                jwt_token=jwt_token,
                org_id=org_id,
                project_id=project_id,
                auditor_id=auditor_id,
                updates=update_fields
            )

        except Exception as e:
            return {"success": False, "error": f"Unexpected error in edit_auditor_with_writer: {str(e)}"}

