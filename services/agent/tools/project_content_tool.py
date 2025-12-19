"""
Tools for fetching project documentation and policy content on-demand
"""

import requests
import json
import re
from typing import Dict, Any, Optional, List

from pydantic import BaseModel, Field
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from workflows.document_relevance_workflow import run_document_relevance_workflow


TOOL_NAME_READ_DOCUMENT = "read_document"
TOOL_NAME_EVALUATE_PROJECT = "evaluate_project"
TOOL_NAME_EVALUATE_DOCUMENT = "evaluate_document"

READ_DOCUMENT_TOOL_PROMPT: str = f"""
	        - {TOOL_NAME_READ_DOCUMENT}: read the full details of a project document or control.
	            arguments: [document_id?] (optional)
	            - If you omit document_id, the system will use the ID of the document currently open in the UI (see "Current document ID" above).
	            - Use this when the user asks about "this control" or "this document" while looking at a specific page.
	            - The tool returns the document metadata, main content, evidence, evidence requests, and children. It intentionally does NOT include related documents.
	    	"""

EVALUATE_PROJECT_TOOL_PROMPT: str = f"""
		        - {TOOL_NAME_EVALUATE_PROJECT}: bulk-evaluate how relevant project control documents are for this specific project and annotate them.
		            arguments: none
		            - This tool always evaluates documents across the entire project (it automatically discovers all control documents for the current project).
		            - For each evaluated document the tool:
		                - assigns a relevance_score between 0 and 100
		                - classifies priority based on score:
		                    - < 15: not immediately relevant to the project
		                    - 15–49: low priority
		                    - 50–79: medium priority
		                    - 80–100: high priority
			                - writes or refreshes a markdown section titled "## Relevance to this project" explaining why this control is (or is not) relevant to the project, including the numeric score and category.
			    	"""

EVALUATE_DOCUMENT_TOOL_PROMPT: str = f"""
		        - {TOOL_NAME_EVALUATE_DOCUMENT}: evaluate how relevant a single project control document is for this specific project and annotate it.
		            arguments: [document_id?] (optional)
		            - If you omit document_id, the system will use the ID of the document currently open in the UI (see "Current document ID" above).
		            - Use this when the user asks about the relevance of one specific control or document.
		            - The tool assigns a relevance_score between 0 and 100, classifies it into a priority category, and updates the document by:
			          - writing or refreshing a markdown section titled "## Relevance to this project";
			          - adding a section "## Relevance to our organization" that explains why this control matters (or does not) at the org level;
			          - adding a section "## Implementation summary" that briefly summarizes how this control is or should be implemented.
		            - When the document is at least moderately relevant (relevance_score >= 15), the tool also reviews existing evidence requests linked to this document and may adjust their relevance scores or propose a few new, better-aligned evidence requests. It never deletes evidence requests; misaligned ones are marked with low relevance instead.
			    	"""


class DocumentInsertOperation(BaseModel):
    """Single insert operation for updating a document's markdown content.

    This mirrors the insert-based editing semantics we want the writer to plan,
    so the LLM returns a fully-typed list of concrete edits that can be applied
    deterministically to the current document content.
    """

    anchor_text: str = Field(
        default="",
        description=(
            "Exact text copied from the CURRENT document content where the edit "
            "should be placed. If empty or not found, the snippet will be "
            "appended to the end of the document."
        ),
    )
    position: str = Field(
        default="after",
        description=(
            'Where to insert relative to anchor_text. Use "after" (default) or '
            '"before". Any other value will be treated as "after". '
        ),
    )
    markdown_to_insert: str = Field(
        ...,
        description=(
            "The markdown snippet to insert (for example a full section starting "
            "with a heading). Must be valid markdown in plain English."
        ),
    )


class DocumentEvaluationResponse(BaseModel):
    """Structured writer response for a single document/control.

    Used with `llm_client.with_structured_output`, similar to ResponseWithTools in
    agent.py. This provides a typed envelope for both the relevance scoring and
    the concrete insert-based edit plan.
    """

    relevance_score: int = Field(
        ..., description="Relevance score between 0 and 100 (inclusive) for this document.",
    )
    relevance_category: str = Field(
        ...,
        description=(
            'Priority category for this control, one of '
            '"not_immediately_relevant", "low", "medium", "high".'
        ),
    )
    rationale: str = Field(
        ..., description="1-3 sentence explanation of why the score/category makes sense.",
    )
    relevance_section_markdown: str = Field(
        ..., description='Markdown section titled "## Relevance to this project".',
    )
    org_relevance_section_markdown: str = Field(
        ..., description='Markdown section titled "## Relevance to our organization".',
    )
    implementation_summary_section_markdown: str = Field(
        ..., description='Markdown section titled "## Implementation summary".',
    )
    insert_operations: List[DocumentInsertOperation] = Field(
        default_factory=list,
        description=(
            "Concrete insert operations that, when applied to the current "
            "document content, produce the updated markdown."
        ),
    )


class EvidenceRequestUpdate(BaseModel):
    """Structured update for an existing evidence request.

    Mirrors the JSON shape previously returned by the evidence writer, but as a
    typed model suitable for with_structured_output.
    """

    id: str = Field(
        ...,
        description=(
            "Identifier of an existing evidence request to update. This should "
            "match the id/object_id of an existing request."
        ),
    )
    relevance_score: int = Field(
        ...,
        description=(
            "Updated relevance score from 0 to 100. Scores 0-14 mean 'not "
            "immediately relevant'."
        ),
    )
    title: Optional[str] = Field(
        default=None,
        description="Optional improved title for the existing evidence request.",
    )
    description: Optional[str] = Field(
        default=None,
        description=(
            "Optional improved description (1-3 sentences) for the existing "
            "evidence request."
        ),
    )


class EvidenceRequestCreate(BaseModel):
    """Structured definition for a new evidence request to create."""

    title: str = Field(
        ..., description="Short title for the new evidence request.",
    )
    description: str = Field(
        ...,
        description=(
            "1-3 sentences describing what evidence is needed and why it "
            "matters for this project and organization."
        ),
    )
    relevance_score: int = Field(
        ...,
        description=(
            "Relevance score from 0 to 100 for this new evidence request. "
            "Scores 0-14 mean 'not immediately relevant'."
        ),
    )


class EvidencePlanResponse(BaseModel):
    """Structured writer response for evidence requests for one document.

    Used with `llm_client.with_structured_output`, mirroring the pattern used
    for DocumentEvaluationResponse and ResponseWithTools.
    """

    updates: List[EvidenceRequestUpdate] = Field(
        default_factory=list,
        description=(
            "Updates to apply to existing evidence requests (id, "
            "relevance_score, and optional title/description)."
        ),
    )
    creates: List[EvidenceRequestCreate] = Field(
        default_factory=list,
        description=(
            "New, better-aligned evidence requests to create for this "
            "document. Keep this list small and targeted."
        ),
    )
    summary: Optional[str] = Field(
        default=None,
        description=(
            "Optional short natural-language summary of the changes you "
            "proposed to the evidence requests."
        ),
    )


TOOL_NAME_READ_DOCUMENT = "read_document"

READ_DOCUMENT_TOOL_PROMPT: str = f"""
        - {TOOL_NAME_READ_DOCUMENT}: read the full details of a project document or control.
            arguments: [document_id?] (optional)
            - If you omit document_id, the system will use the ID of the document currently open in the UI (see "Current document ID" above).
            - Use this when the user asks about "this control" or "this document" while looking at a specific page.
            - The tool returns the document metadata, main content, evidence, evidence requests, and children. It intentionally does NOT include related documents.
    """


TOOL_NAME_READ_DOCUMENT = "read_document"

READ_DOCUMENT_TOOL_PROMPT: str = f"""
        - {TOOL_NAME_READ_DOCUMENT}: read the full details of a project document or control.
            arguments: [document_id?] (optional)
            - If you omit document_id, the system will use the ID of the document currently open in the UI (see "Current document ID" above).
            - Use this when the user asks about "this control" or "this document" while looking at a specific page.
            - The tool returns the document metadata, main content, evidence, evidence requests, and children. It intentionally does NOT include related documents.
    """


class ProjectContentTool:
    """Tool for fetching project documentation and policy content"""

    def __init__(self, backend_url: str = "http://app:8080", request_timeout: int = 30, llm_client: Optional[Any] = None):
        self.backend_url = backend_url
        self.request_timeout = request_timeout
        self.llm_client = llm_client

    def _debug(self, message: str) -> None:
        """Lightweight debug logging helper for this tool.

        Uses print() so that debug traces appear in the same logs as other
        tool messages. Avoids logging any authentication secrets.
        """
        try:
            print(f"[DEBUG ProjectContentTool] {message}", flush=True)
        except Exception:
            # Debug logging should never break tool execution.
            pass

    def fetch_documentation_page(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        page_id: str
    ) -> Optional[Dict[str, Any]]:
        """Fetch a specific documentation page content"""
        try:
            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json"
            }
            response = requests.get(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/documentation/{page_id}",
                headers=headers,
                timeout=self.request_timeout
            )

            if response.status_code == 200:
                return response.json()
            elif response.status_code == 401:
                print(f"❌ Unauthorized to fetch documentation page: Invalid JWT token", flush=True)
                return None
            elif response.status_code == 404:
                print(f"❌ Documentation page {page_id} not found", flush=True)
                return None
            else:
                print(f"❌ Failed to fetch documentation page: HTTP {response.status_code}", flush=True)
                return None

        except requests.exceptions.Timeout:
            print(f"❌ Timeout fetching documentation page", flush=True)
            return None
        except requests.exceptions.ConnectionError:
            print(f"❌ Connection error fetching documentation page", flush=True)
            return None
        except Exception as e:
            print(f"❌ Unexpected error fetching documentation page: {e}", flush=True)
            return None

    def fetch_policy_content(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        policy_id: str
    ) -> Optional[Dict[str, Any]]:
        """Fetch a specific policy content"""
        try:
            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json"
            }
            response = requests.get(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/policy/{policy_id}",
                headers=headers,
                timeout=self.request_timeout
            )

            if response.status_code == 200:
                return response.json()
            elif response.status_code == 401:
                print(f"❌ Unauthorized to fetch policy: Invalid JWT token", flush=True)
                return None
            elif response.status_code == 404:
                print(f"❌ Policy {policy_id} not found", flush=True)
                return None
            else:
                print(f"❌ Failed to fetch policy: HTTP {response.status_code}", flush=True)
                return None

        except requests.exceptions.Timeout:
            print(f"❌ Timeout fetching policy", flush=True)
            return None
        except requests.exceptions.ConnectionError:
            print(f"❌ Connection error fetching policy", flush=True)
            return None
        except Exception as e:
            print(f"❌ Unexpected error fetching policy: {e}", flush=True)
            return None

    def search_documentation(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        query: str
    ) -> Optional[List[Dict[str, Any]]]:
        """Search documentation pages by query"""
        try:
            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json"
            }
            response = requests.get(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/documentation/search",
                headers=headers,
                params={"q": query},
                timeout=self.request_timeout
            )

            if response.status_code == 200:
                return response.json()
            elif response.status_code == 401:
                print(f"❌ Unauthorized to search documentation: Invalid JWT token", flush=True)
                return None
            else:
                print(f"❌ Failed to search documentation: HTTP {response.status_code}", flush=True)
                return None

        except requests.exceptions.Timeout:
            print(f"❌ Timeout searching documentation", flush=True)
            return None
        except requests.exceptions.ConnectionError:
            print(f"❌ Connection error searching documentation", flush=True)
            return None
        except Exception as e:
            print(f"❌ Unexpected error searching documentation: {e}", flush=True)
            return None

    def search_policies(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        query: str
    ) -> Optional[List[Dict[str, Any]]]:
        """Search policies by query"""
        try:
            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json"
            }
            response = requests.get(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/policy/search",
                headers=headers,
                params={"q": query},
                timeout=self.request_timeout
            )

            if response.status_code == 200:
                return response.json()
            elif response.status_code == 401:
                print(f"❌ Unauthorized to search policies: Invalid JWT token", flush=True)
                return None
            else:
                print(f"❌ Failed to search policies: HTTP {response.status_code}", flush=True)
                return None

        except requests.exceptions.Timeout:
            print(f"❌ Timeout searching policies", flush=True)
            return None
        except requests.exceptions.ConnectionError:
            print(f"❌ Connection error searching policies", flush=True)
            return None
        except Exception as e:
            print(f"❌ Unexpected error searching policies: {e}", flush=True)
            return None

    def read_full_document(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        document_id: str,
    ) -> Dict[str, Any]:
        """Read a full project document by ID, including evidence, requests, and children.

        Returns a dict with:
          - success: bool
          - data: response JSON on success
          - error: message on failure
        """
        try:
            if not document_id or not str(document_id).strip():
                return {
                    "success": False,
                    "error": "Document ID cannot be empty. Provide a document ID to read.",
                    "data": None,
                }

            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json",
            }
            response = requests.get(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/document/{document_id}/full",
                headers=headers,
                timeout=self.request_timeout,
            )

            if response.status_code == 200:
                return {
                    "success": True,
                    "data": response.json(),
                }
            elif response.status_code == 401:
                return {
                    "success": False,
                    "error": "Unauthorized: Invalid JWT token",
                    "data": None,
                    "status_code": response.status_code,
                }
            elif response.status_code == 404:
                return {
                    "success": False,
                    "error": f"Document '{document_id}' not found",
                    "data": None,
                    "status_code": response.status_code,
                }
            else:
                return {
                    "success": False,
                    "error": f"Failed to fetch document: HTTP {response.status_code}",
                    "data": None,
                    "status_code": response.status_code,
                }

        except requests.exceptions.Timeout:
            return {
                "success": False,
                "error": "Timeout fetching full document",
                "data": None,
            }
        except requests.exceptions.ConnectionError:
            return {
                "success": False,
                "error": "Connection error fetching full document",
                "data": None,
            }
        except Exception as e:  # pragma: no cover - defensive
            return {
                "success": False,
                "error": f"Unexpected error: {str(e)}",
                "data": None,
            }

    def list_project_documents(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
    ) -> Dict[str, Any]:
        """List project documents for a given project.

        This is a thin wrapper around the backend's project document listing endpoint.
        It normalizes a few potential response shapes into a list under ``documents``.
        """
        try:
            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json",
            }
            response = requests.get(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/document",
                headers=headers,
                timeout=self.request_timeout,
            )

            if response.status_code == 200:
                raw = response.json()
                documents: List[Dict[str, Any]] = []
                if isinstance(raw, list):
                    documents = raw
                elif isinstance(raw, dict):
                    if isinstance(raw.get("documents"), list):
                        documents = raw.get("documents", [])
                    elif isinstance(raw.get("items"), list):
                        documents = raw.get("items", [])
                    else:
                        # Best-effort: treat dict as a single document descriptor
                        documents = [raw]
                return {"success": True, "documents": documents}
            elif response.status_code == 401:
                return {
                    "success": False,
                    "error": "Unauthorized: Invalid JWT token",
                    "status_code": response.status_code,
                }
            else:
                return {
                    "success": False,
                    "error": f"Failed to list project documents: HTTP {response.status_code}",
                    "status_code": response.status_code,
                }

        except requests.exceptions.Timeout:
            return {
                "success": False,
                "error": "Timeout listing project documents",
            }
        except requests.exceptions.ConnectionError:
            return {
                "success": False,
                "error": "Connection error listing project documents",
            }
        except Exception as e:  # pragma: no cover - defensive
            return {
                "success": False,
                "error": f"Unexpected error while listing project documents: {str(e)}",
            }

    def update_document(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        document_id: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Update a single project document by ID.

        The payload should contain the fields expected by the backend such as
        title, content, status, order, last_edited_by, relevance_score, etc.
        """
        try:
            if not document_id or not str(document_id).strip():
                return {
                    "success": False,
                    "error": "Document ID cannot be empty.",
                    "data": None,
                }

            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json",
            }
            response = requests.put(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/document/{document_id}",
                headers=headers,
                json=payload,
                timeout=self.request_timeout,
            )

            if response.status_code in (200, 201, 204):
                data: Optional[Dict[str, Any]] = None
                try:
                    if response.content:
                        data = response.json()
                except Exception:
                    data = None
                return {"success": True, "data": data}
            elif response.status_code == 401:
                return {
                    "success": False,
                    "error": "Unauthorized: Invalid JWT token",
                    "data": None,
                    "status_code": response.status_code,
                }
            elif response.status_code == 404:
                return {
                    "success": False,
                    "error": f"Document '{document_id}' not found",
                    "data": None,
                    "status_code": response.status_code,
                }
            else:
                return {
                    "success": False,
                    "error": f"Failed to update document: HTTP {response.status_code}",
                    "data": None,
                    "status_code": response.status_code,
                }

        except requests.exceptions.Timeout:
            return {
                "success": False,
                "error": "Timeout updating document",
                "data": None,
            }
        except requests.exceptions.ConnectionError:
            return {
                "success": False,
                "error": "Connection error updating document",
                "data": None,
            }
        except Exception as e:  # pragma: no cover - defensive
            return {
                "success": False,
                "error": f"Unexpected error updating document: {str(e)}",
                "data": None,
            }

    def update_evidence_request(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        evidence_request_id: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Update a single evidence request by ID.

        The payload is typically a partial update (e.g., just relevance_score),
        but is forwarded as-is to the backend.
        """
        try:
            if not evidence_request_id or not str(evidence_request_id).strip():
                return {
                    "success": False,
                    "error": "Evidence request ID cannot be empty.",
                    "data": None,
                }

            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json",
            }
            response = requests.put(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/evidence-request/{evidence_request_id}",
                headers=headers,
                json=payload,
                timeout=self.request_timeout,
            )

            if response.status_code in (200, 201, 204):
                data: Optional[Dict[str, Any]] = None
                try:
                    if response.content:
                        data = response.json()
                except Exception:
                    data = None
                return {"success": True, "data": data}
            elif response.status_code == 401:
                return {
                    "success": False,
                    "error": "Unauthorized: Invalid JWT token",
                    "data": None,
                    "status_code": response.status_code,
                }
            elif response.status_code == 404:
                return {
                    "success": False,
                    "error": f"Evidence request '{evidence_request_id}' not found",
                    "data": None,
                    "status_code": response.status_code,
                }
            else:
                return {
                    "success": False,
                    "error": f"Failed to update evidence request: HTTP {response.status_code}",
                    "data": None,
                    "status_code": response.status_code,
                }

        except requests.exceptions.Timeout:
            return {
                "success": False,
                "error": "Timeout updating evidence request",
                "data": None,
            }
        except requests.exceptions.ConnectionError:
            return {
                "success": False,
                "error": "Connection error updating evidence request",
                "data": None,
            }
        except Exception as e:  # pragma: no cover - defensive
            return {
                "success": False,
                "error": f"Unexpected error updating evidence request: {str(e)}",
                "data": None,
            }

    def create_evidence_request(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Create a new evidence request for the given project.

        The payload should include the fields expected by the backend such as
        document_id, title, description, relevance_score, etc.
        """
        try:
            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json",
            }
            response = requests.post(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/evidence-request",
                headers=headers,
                json=payload,
                timeout=self.request_timeout,
            )

            if response.status_code in (200, 201):
                try:
                    data = response.json()
                except Exception:
                    data = None
                return {"success": True, "data": data}
            elif response.status_code == 401:
                return {
                    "success": False,
                    "error": "Unauthorized: Invalid JWT token",
                    "data": None,
                    "status_code": response.status_code,
                }
            else:
                return {
                    "success": False,
                    "error": f"Failed to create evidence request: HTTP {response.status_code}",
                    "data": None,
                    "status_code": response.status_code,
                }

        except requests.exceptions.Timeout:
            return {
                "success": False,
                "error": "Timeout creating evidence request",
                "data": None,
            }
        except requests.exceptions.ConnectionError:
            return {
                "success": False,
                "error": "Connection error creating evidence request",
                "data": None,
            }
        except Exception as e:  # pragma: no cover - defensive
            return {
                "success": False,
                "error": f"Unexpected error creating evidence request: {str(e)}",
                "data": None,
            }

    def _upsert_named_section(
        self,
        existing_content: str,
        heading_text: str,
        new_section: str,
    ) -> str:
        """Insert or replace a level-2 markdown section with a specific heading.

        This is a generalized helper used to keep sections like
        "## Relevance to this project", "## Relevance to our organization", and
        "## Implementation summary" idempotent. If the heading already exists,
        the entire section block is replaced; otherwise the section is
        appended to the end of the document.
        """
        if not new_section:
            return existing_content or ""

        content = existing_content or ""
        new_block = new_section.strip() + "\n"

        # Level-2 heading matching the given text (case-insensitive)
        escaped = re.escape(heading_text)
        heading_regex = re.compile(rf"(?im)^##\s+{escaped}\s*$")
        match = heading_regex.search(content)

        if not match:
            separator = "\n" if content.endswith("\n") else "\n\n"
            return content + separator + new_block

        start = match.start()
        after_heading = match.end()

        # Find the next level-1 or level-2 heading after this section to know where it ends
        next_heading_regex = re.compile(r"(?m)^(##|#)\s+.+$")
        remainder = content[after_heading:]
        next_match = next_heading_regex.search(remainder)
        if next_match:
            end = after_heading + next_match.start()
            return content[:start] + new_block + content[end:]
        else:
            # Section goes to the end of the document
            return content[:start] + new_block

    def _upsert_relevance_section(self, existing_content: str, new_section: str) -> str:
        """Insert or replace a '## Relevance to this project' markdown section.

        If the section already exists, its entire block is replaced. Otherwise, the
        section is appended to the end of the document.
        """
        # NOTE: This helper is kept for backwards compatibility and simply
        # delegates to the generalized section upsert logic.
        return self._upsert_named_section(
            existing_content=existing_content,
            heading_text="Relevance to this project",
            new_section=new_section,
        )

    def _apply_insert_operations(
        self,
        existing_content: str,
        insert_operations: List[Dict[str, Any]],
    ) -> str:
        """Apply a list of insert operations to the given markdown content.

        Each operation is expected to have the shape::

            {
                "anchor_text": "exact text from the current document",
                "position": "before" | "after",
                "markdown_to_insert": "## Heading..."
            }

        The helper is intentionally conservative:
        - If markdown_to_insert is empty, the operation is skipped.
        - If the snippet already appears in the content, it is not inserted again
          (idempotency on re-runs).
        - If anchor_text is missing or not found, the snippet is appended to the
          end of the document.
        - Operations are applied in the order given.
        """

        content = existing_content or ""
        if not insert_operations:
            return content

        for op in insert_operations:
            if not isinstance(op, dict):
                continue

            anchor = str(op.get("anchor_text") or "").strip()
            snippet = str(op.get("markdown_to_insert") or "").strip()
            if not snippet:
                continue

            # Avoid duplicating the exact same snippet if it is already present
            if snippet in content:
                continue

            position = str(op.get("position") or "after").strip().lower()
            if position not in {"before", "after"}:
                position = "after"

            insertion_text = "\n\n" + snippet + "\n"

            inserted = False
            if anchor:
                idx = content.find(anchor)
                if idx != -1:
                    insertion_point = idx if position == "before" else idx + len(anchor)
                    content = (
                        content[:insertion_point]
                        + insertion_text
                        + content[insertion_point:]
                    )
                    inserted = True

            if not inserted:
                # Fallback: append to end of document
                if not content.endswith("\n"):
                    content = content + "\n"
                # insertion_text already begins with a blank line; trim one
                content = content + insertion_text.lstrip("\n")

        return content

    async def _evaluate_single_document_with_writer(
        self,
        document: Dict[str, Any],
        project_context: str,
        last_messages: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Use the LLM to evaluate how relevant a document/control is to the project.

        Returns a dict with:
          - success: bool
          - evaluation: {relevance_score, relevance_category, rationale, relevance_section_markdown,
                        org_relevance_section_markdown, implementation_summary_section_markdown}
          - error: message on failure
        """
        if not self.llm_client:
            return {"success": False, "error": "LLM client not available for writer step"}

        # NOTE: This writer step previously parsed free-form JSON using
        # clean_json_markdown. It now uses the same structured-output pattern as
        # agent.py (with a Pydantic model) so we get a strongly-typed response
        # and clearer, more reliable logging of how the document is edited.
        title = document.get("title") or "(untitled document)"
        doc_id = (
            document.get("object_id")
            or document.get("id")
            or document.get("document_id")
            or ""
        )
        is_control = bool(document.get("is_control"))
        raw_content = document.get("content") or document.get("body") or ""

        self._debug(
            f"writer: evaluating document '{title}' (ID: {doc_id}) with content_length={len(raw_content)}"
        )
        self._debug(
            "writer: current document content preview=" f"{raw_content[:400]!r}"
        )

        project_context_text = project_context or (
            "Org/project context not provided explicitly. Org ID and Project ID are available in the system."
        )

        prompt = f"""You are evaluating how relevant a compliance control document is for a specific project and
        planning concrete edits to that document.

        Project context (from the system):
        {project_context_text}

        Control document:
        - Title: {title}
        - ID: {doc_id}
        - Marked as control: {"yes" if is_control else "no"}

        Current document content (full markdown):
        {raw_content}

        Your job is to:
        1) Decide how relevant this control is to the specific project and write short, explicit rationales.
        2) Propose one or more concrete edit operations that can be applied to this existing markdown to
           produce the updated document. Think about how the *entire* document should read after your edits.


        Editing rules:
        - You may propose multiple insert_operations; they will be applied IN ORDER to the current document content.
        - All anchor_text values MUST come from the original content shown above. Do NOT invent anchor text that does
          not exist in the document, and do not use text you are adding as an anchor for later operations.
        - Prefer distinct anchor_text values for different operations so edits do not conflict.
        - The markdown_to_insert must be valid markdown in plain English.
        - After applying all insert_operations, the document MUST contain exactly these sections (once each, refreshed
          if they already exist):
            - "## Relevance to this project"
            - "## Relevance to our organization"
            - "## Implementation summary"

        Scoring rules:
        - 0-14  => category "not_immediately_relevant" (the control is clearly not immediately relevant)
        - 15-49 => category "low" (some relevance but not urgent)
        - 50-79 => category "medium" (meaningful relevance, should be addressed)
        - 80-100 => category "high" (strongly relevant / critical for this project)

        The relevance_section_markdown MUST:
        - Start with the header line: "## Relevance to this project"
        - Briefly explain why this control is or is not relevant to this specific project
        - Explicitly mention the numeric relevance_score and the priority category.

        The org_relevance_section_markdown MUST:
        - Start with the header line: "## Relevance to our organization"
        - Summarize how this control affects the organization overall (who cares, why it matters, or why it is low
          priority for now).

        The implementation_summary_section_markdown MUST:
        - Start with the header line: "## Implementation summary"
        - Briefly describe how this control is or should be implemented in this org/project context.

        REMEBER TO COMMUNICATE IN A WAY THAT A FOUNDER CAN UNDERSTAND, INclude info about their organization and how it might fit to their needs, and maybe why it does not fit to their needs.
        """

        # Configure a structured-output LLM using our Pydantic schema.
        structured_llm = self.llm_client.with_structured_output(
            DocumentEvaluationResponse
        )
        max_retries = 2
        last_error: Optional[str] = None

        for attempt in range(max_retries + 1):
            try:
                structured_response: DocumentEvaluationResponse = await structured_llm.ainvoke(
                    [HumanMessage(content=prompt)]
                )
                data = structured_response.dict()

                # Normalize and validate fields
                score_raw = data.get("relevance_score", 0)
                try:
                    score = int(score_raw)
                except Exception:
                    score = 0
                score = max(0, min(100, score))

                category = (data.get("relevance_category") or "").strip()
                if category not in {"not_immediately_relevant", "low", "medium", "high"}:
                    if score < 15:
                        category = "not_immediately_relevant"
                    elif score < 50:
                        category = "low"
                    elif score < 80:
                        category = "medium"
                    else:
                        category = "high"

                section_md = (data.get("relevance_section_markdown") or "").strip()
                if not section_md:
                    # Fallback simple section if model omitted it
                    rationale_text = data.get("rationale") or "Relevance rationale not provided by the model."
                    section_md = (
                        "## Relevance to this project\n\n"
                        f"Relevance score: {score} ({category}).\n\n"
                        f"Rationale: {rationale_text}"
                    )
                elif "Relevance to this project" not in section_md:
                    # Ensure section has the correct heading
                    section_md = "## Relevance to this project\n\n" + section_md

                org_section_md = (data.get("org_relevance_section_markdown") or "").strip()
                if not org_section_md:
                    org_section_md = (
                        "## Relevance to our organization\n\n"
                        f"This section summarizes how this control impacts the organization overall. "
                        f"Project relevance score for this control is {score} ({category})."
                    )
                elif "Relevance to our organization" not in org_section_md:
                    org_section_md = "## Relevance to our organization\n\n" + org_section_md

                impl_section_md = (data.get("implementation_summary_section_markdown") or "").strip()
                if not impl_section_md:
                    impl_section_md = (
                        "## Implementation summary\n\n"
                        "Summarize at a high level how this control is or should be implemented "
                        "for this organization and project."
                    )
                elif "Implementation summary" not in impl_section_md:
                    impl_section_md = "## Implementation summary\n\n" + impl_section_md

                # Optional structured edit operations describing how to update the
                # document content using anchor-based inserts.
                raw_ops = data.get("insert_operations") or []
                insert_operations: List[Dict[str, Any]] = []
                if isinstance(raw_ops, list):
                    for op in raw_ops:
                        if not isinstance(op, dict):
                            continue
                        anchor = str(op.get("anchor_text") or "").strip()
                        snippet = str(op.get("markdown_to_insert") or "").strip()
                        if not snippet:
                            continue
                        position = str(op.get("position") or "after").strip().lower()
                        if position not in {"before", "after"}:
                            position = "after"
                        insert_operations.append(
                            {
                                "anchor_text": anchor,
                                "position": position,
                                "markdown_to_insert": snippet,
                            }
                        )

                # Log a concise view of the planned insert operations so the
                # logs make it clear how the document will be edited.
                if insert_operations:
                    ops_preview = [
                        {
                            "anchor_text": op.get("anchor_text", "")[:120],
                            "position": op.get("position"),
                            "markdown_preview": op.get("markdown_to_insert", "")[:200],
                        }
                        for op in insert_operations[:3]
                    ]
                    self._debug(
                        "writer: insert_operations preview=" f"{ops_preview!r}"
                    )

                evaluation = {
                    "relevance_score": score,
                    "relevance_category": category,
                    "rationale": data.get("rationale"),
                    "relevance_section_markdown": section_md,
                    "org_relevance_section_markdown": org_section_md,
                    "implementation_summary_section_markdown": impl_section_md,
                    "insert_operations": insert_operations,
                }
                self._debug(
                    "writer: evaluation result "
                    f"score={score}, category={category}, "
                    f"relevance_section_preview={section_md[:200]!r}, "
                    f"org_section_preview={org_section_md[:200]!r}, "
                    f"impl_section_preview={impl_section_md[:200]!r}, "
                    f"insert_operations_count={len(insert_operations)}"
                )
                return {"success": True, "evaluation": evaluation}
            except Exception as e:  # pragma: no cover - defensive
                last_error = str(e)
                continue

        return {
            "success": False,
            "error": f"Writer step failed to produce valid structured output: {last_error}",
        }

    async def _evaluate_evidence_requests_for_document_with_writer(
        self,
        document: Dict[str, Any],
        project_context: str,
        evidence_requests: List[Dict[str, Any]],
        evidence_items: List[Dict[str, Any]],
        evaluation: Dict[str, Any],
        last_messages: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Use the LLM to propose evidence-request updates/creations for a document.

        This helper does **not** call the backend. It only returns a structured
        plan which is then applied by
        `_evaluate_and_apply_evidence_requests_for_document`.
        """
        if not self.llm_client:
            return {
                "success": False,
                "error": "LLM client not available for evidence writer step",
            }

        title = document.get("title") or "(untitled document)"
        doc_id = (
            document.get("object_id")
            or document.get("id")
            or document.get("document_id")
            or ""
        )
        score = evaluation.get("relevance_score")
        category = evaluation.get("relevance_category") or "unknown"
        rationale = evaluation.get("rationale") or ""
        relevance_section = evaluation.get("relevance_section_markdown") or ""
        org_section = evaluation.get("org_relevance_section_markdown") or ""
        impl_section = evaluation.get("implementation_summary_section_markdown") or ""

        simplified_requests: List[Dict[str, Any]] = []
        for er in evidence_requests or []:
            er_id = er.get("object_id") or er.get("id") or ""
            simplified_requests.append(
                {
                    "id": er_id,
                    "title": er.get("title") or "",
                    "description": er.get("description")
                    or er.get("body")
                    or "",
                    "relevance_score": er.get("relevance_score"),
                    "status": er.get("status") or "",
                }
            )

        evidence_count = len(evidence_items or [])
        self._debug(
            "evidence writer: "
            f"doc_id={doc_id}, title={title!r}, "
            f"existing_requests={len(simplified_requests)}, "
            f"evidence_items={evidence_count}"
        )
        if simplified_requests:
            self._debug(
                "evidence writer: first 3 simplified_requests="
                f"{simplified_requests[:3]!r}"
            )
        project_context_text = project_context or (
            "Org/project context not provided explicitly. Org ID and Project ID are available in the system."
        )

        prompt = f"""You are helping refine evidence requests for a single compliance control document.

        Project context (from the system):
        {project_context_text}

        Document being evaluated:
        - Title: {title}
        - ID: {doc_id}
        - Current relevance score: {score} ({category})
        - Rationale: {rationale}

        Key sections written for this document:
        {relevance_section}

        {org_section}

        {impl_section}

        Existing evidence requests linked to this document (simplified JSON):
        {json.dumps(simplified_requests, indent=2)}

        There are {evidence_count} linked evidence items (documents, screenshots, etc.).

        Your job:
        - Assess which existing evidence requests are well aligned with this control and project.
        - Down-rank misaligned or low-priority requests by giving them a low relevance_score.
        - Propose a **small number** of new evidence requests only where clearly needed to cover gaps.
        - Never delete existing evidence requests; you can only change their relevance_score and, if
          obviously helpful, lightly adjust their title/description.


            REMEBER TO COMMUNICATE IN A WAY THAT A FOUNDER CAN UNDERSTAND, INclude info about their organization and how it might fit to their needs, and maybe why it does not fit to their needs.
            this step is not about creating as much work as possible but about creating the right amount of work for the organization, and very specific amounts of work.

        """

        structured_llm = self.llm_client.with_structured_output(EvidencePlanResponse)  # type: ignore[union-attr]

        max_retries = 2
        last_error: Optional[str] = None

        for attempt in range(max_retries + 1):
            try:
                response: EvidencePlanResponse = await structured_llm.ainvoke(
                    [HumanMessage(content=prompt)]
                )  # type: ignore[assignment]
                data = response.dict()

                updates = data.get("updates") or []
                creates = data.get("creates") or []
                summary = data.get("summary") or None

                plan = {
                    "updates": updates,
                    "creates": creates,
                    "summary": summary,
                }
                self._debug(
                    "evidence writer: plan produced "
                    f"updates={len(updates)}, creates={len(creates)}, summary={summary!r}"
                )
                return {"success": True, "plan": plan}
            except Exception as e:  # pragma: no cover - defensive
                last_error = str(e)
                continue

        return {
            "success": False,
            "error": (
                "Evidence writer step failed to produce valid structured output: "
                f"{last_error}"
            ),
        }

    async def _evaluate_and_apply_evidence_requests_for_document(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        document: Dict[str, Any],
        full_document_payload: Dict[str, Any],
        project_context: str,
        evaluation: Dict[str, Any],
        last_messages: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Evaluate and apply evidence-request updates/creations for a document.

        This uses the writer helper above to propose a plan, then applies it via
        the backend evidence-request endpoints. It returns a compact summary
        that can be surfaced to the user.
        """
        evidence_requests = full_document_payload.get("evidence_requests") or []
        evidence_items = full_document_payload.get("evidence") or []

        self._debug(
            "evidence apply: starting for document "
            f"{document.get('object_id') or document.get('id') or document.get('document_id')!r} "
            f"with {len(evidence_requests)} existing evidence_requests and "
            f"{len(evidence_items)} evidence items"
        )

        writer_result = await self._evaluate_evidence_requests_for_document_with_writer(
            document=document,
            project_context=project_context,
            evidence_requests=evidence_requests,
            evidence_items=evidence_items,
            evaluation=evaluation,
            last_messages=last_messages,
        )

        if not writer_result.get("success"):
            self._debug(
                "evidence apply: writer_result was not successful: "
                f"{writer_result.get('error')!r}"
            )
            return {
                "processed": False,
                "success": False,
                "error": writer_result.get("error", "Evidence writer step failed"),
                "total_existing": len(evidence_requests),
                "updated": 0,
                "marked_low": 0,
                "created": 0,
            }

        plan = writer_result.get("plan") or {}
        updates = plan.get("updates") or []
        creates = plan.get("creates") or []

        updated_count = 0
        marked_low_count = 0
        created_count = 0
        errors: List[str] = []

        # Apply updates to existing evidence requests
        for upd in updates:
            er_id_raw = upd.get("id") or upd.get("evidence_request_id") or ""
            er_id = str(er_id_raw).strip()
            if not er_id:
                continue

            payload: Dict[str, Any] = {}
            if "relevance_score" in upd:
                try:
                    payload["relevance_score"] = int(upd.get("relevance_score"))
                except Exception:
                    # Ignore invalid scores for this update
                    pass
            if upd.get("title"):
                payload["title"] = str(upd["title"]).strip()
            if upd.get("description"):
                payload["description"] = str(upd["description"]).strip()

            if not payload:
                # Nothing meaningful to update
                continue

            self._debug(
                f"evidence apply: updating evidence_request {er_id} "
                f"with payload={payload!r}"
            )

            res = self.update_evidence_request(
                jwt_token=jwt_token,
                org_id=org_id,
                project_id=project_id,
                evidence_request_id=er_id,
                payload=payload,
            )
            if not res.get("success"):
                err_text = res.get("error") or "unknown error"
                errors.append(
                    f"Failed to update evidence request {er_id}: " f"{err_text}"
                )
                self._debug(
                    f"evidence apply: FAILED to update evidence_request {er_id}: {err_text}"
                )
                continue

            updated_count += 1
            self._debug(f"evidence apply: successfully updated evidence_request {er_id}")
            try:
                rs = payload.get("relevance_score")
                if rs is not None and int(rs) < 15:
                    marked_low_count += 1
            except Exception:
                pass

        # Derive a numeric document_id for evidence creation. The backend
        # expects the internal numeric ID, which is exposed on existing
        # evidence requests as `document_id`. If we cannot determine a
        # numeric ID, we will skip creating new evidence requests but still
        # apply updates.
        numeric_doc_id: Optional[int] = None
        for er in evidence_requests:
            er_doc_id = er.get("document_id")
            if isinstance(er_doc_id, int):
                numeric_doc_id = er_doc_id
                break
            try:
                if er_doc_id is not None:
                    numeric_doc_id = int(er_doc_id)
                    break
            except Exception:
                continue

        for new_req in creates:
            title = str(new_req.get("title") or "").strip()
            description = str(new_req.get("description") or "").strip()
            if not title and not description:
                continue

            payload: Dict[str, Any] = {
                "title": title or "Evidence request",
                "description": description,
            }
            if numeric_doc_id is not None:
                payload["document_id"] = numeric_doc_id
            if "relevance_score" in new_req:
                try:
                    payload["relevance_score"] = int(new_req.get("relevance_score"))
                except Exception:
                    pass

            self._debug(
                "evidence apply: creating new evidence_request "
                f"title={payload.get('title')!r}, relevance_score="
                f"{payload.get('relevance_score')!r}"
            )

            if numeric_doc_id is None:
                reason = (
                    "Skipping creation of new evidence request because a numeric "
                    "document_id is not available from existing evidence_requests."
                )
                errors.append(reason)
                self._debug(
                    "evidence apply: "
                    f"skipped creating evidence_request {title or '[no title]'}: {reason}"
                )
                continue

            res = self.create_evidence_request(
                jwt_token=jwt_token,
                org_id=org_id,
                project_id=project_id,
                payload=payload,
            )
            if not res.get("success"):
                err_text = res.get("error") or "unknown error"
                errors.append(
                    f"Failed to create evidence request '{title or '[no title]'}': "
                    f"{err_text}"
                )
                self._debug(
                    "evidence apply: FAILED to create evidence_request "
                    f"{title or '[no title]'}: {err_text}"
                )
                continue
            created_count += 1
            self._debug(
                "evidence apply: successfully created evidence_request "
                f"{title or '[no title]'}"
            )

        success = not errors
        self._debug(
            "evidence apply summary: "
            f"total_existing={len(evidence_requests)}, updated={updated_count}, "
            f"marked_low={marked_low_count}, created={created_count}, errors_count={len(errors)}"
        )
        return {
            "processed": True,
            "success": success,
            "total_existing": len(evidence_requests),
            "updated": updated_count,
            "marked_low": marked_low_count,
            "created": created_count,
            "errors": errors or None,
            "writer_summary": plan.get("summary"),
        }

    async def evaluate_project_with_writer(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        max_documents: Optional[int] = None,
        last_messages: Optional[List[Dict[str, Any]]] = None,
        project_context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Evaluate all project documents for relevance and update them.

        Args:
        jwt_token: JWT for auth
        org_id: organisation ID
        project_id: project ID
        max_documents: optional cap on number of documents to process.
        last_messages: recent conversation snippets for extra context.

    Returns:
        Dict with keys: success, total_documents, documents (per-doc results).
    """
        if not jwt_token or not org_id or not project_id:
            return {
                "success": False,
                "error": "Missing authentication or project context for evaluate_project",
            }

        target_doc_ids: List[str] = []
        list_result = self.list_project_documents(
            jwt_token=jwt_token,
            org_id=org_id,
            project_id=project_id,
        )
        if not list_result.get("success"):
            return {
                "success": False,
                "error": list_result.get("error", "Failed to list project documents"),
                "status_code": list_result.get("status_code"),
            }
        for doc in list_result.get("documents", []) or []:
            did = (
                doc.get("object_id")
                or doc.get("id")
                or doc.get("document_id")
            )
            if did and str(did).strip():
                target_doc_ids.append(str(did).strip())

        # Deduplicate while preserving order
        seen: set[str] = set()
        ordered_ids: List[str] = []
        for did in target_doc_ids:
            if did not in seen:
                seen.add(did)
                ordered_ids.append(did)

        if max_documents is not None and max_documents >= 0:
            ordered_ids = ordered_ids[: max_documents]

        if not ordered_ids:
            return {
                "success": False,
                "error": "No documents to evaluate for this project.",
            }

        # If the caller did not provide a richer project context string, fall
        # back to a minimal one using only IDs.
        if project_context is None:
            project_context = f"Org ID: {org_id}\nProject ID: {project_id}"
        last_messages = last_messages or []

        results: List[Dict[str, Any]] = []
        for doc_id in ordered_ids:
            # 1) Read full document
            full_result = self.read_full_document(
                jwt_token=jwt_token,
                org_id=org_id,
                project_id=project_id,
                document_id=doc_id,
            )

            if not full_result.get("success"):
                results.append(
                    {
                        "document_id": doc_id,
                        "title": None,
                        "success": False,
                        "error": full_result.get("error", "Failed to read document"),
                    }
                )
                continue

            data = full_result.get("data") or {}
            document = data.get("document") or data
            title = document.get("title") or "(untitled document)"
            # Prefer whichever field actually holds the body text so that updates
            # affect what the UI renders (some controls use `body`, others
            # `content`).
            raw_content_val = document.get("content")
            if raw_content_val:
                content = raw_content_val
                content_field = "content"
            else:
                body_val = document.get("body") or ""
                content = body_val
                content_field = "body" if body_val else "content"

            # 2) Evaluate using the document relevance workflow. This wraps the
            # existing writer behavior in a LangGraph workflow.
            eval_result = await run_document_relevance_workflow(
                project_content_tool=self,
                document=document,
                project_context=project_context,
                last_messages=last_messages,
            )

            if not eval_result.get("success"):
                results.append(
                    {
                        "document_id": doc_id,
                        "title": title,
                        "success": False,
                        "error": eval_result.get("error", "Writer step failed"),
                    }
                )
                continue

            evaluation = eval_result.get("evaluation", {})
            score = evaluation.get("relevance_score", 0)
            category = evaluation.get("relevance_category", "low")
            rationale = evaluation.get("rationale")
            section_md = evaluation.get("relevance_section_markdown", "")
            org_section_md = evaluation.get("org_relevance_section_markdown", "")
            impl_section_md = evaluation.get("implementation_summary_section_markdown", "")

            # Normalize score to an int for consistent downstream use
            try:
                score_int = int(score)
            except Exception:
                score_int = 0

            insert_operations = evaluation.get("insert_operations") or []
            if insert_operations:
                # Primary path: structured insert operations planned by the writer
                # to update the document content.
                updated_content = self._apply_insert_operations(content, insert_operations)
            else:
                # Backwards-compatible path: fall back to heading-based upsert of
                # the three standard sections when no structured edits were
                # provided.
                updated_content = self._upsert_relevance_section(content, section_md)
                updated_content = self._upsert_named_section(
                    existing_content=updated_content,
                    heading_text="Relevance to our organization",
                    new_section=org_section_md,
                )
                updated_content = self._upsert_named_section(
                    existing_content=updated_content,
                    heading_text="Implementation summary",
                    new_section=impl_section_md,
                )

            updated = False
            update_error: Optional[str] = None
            # NOTE: The backend's DocumentRequest expects the markdown body in
            # the `content` field. We may have read from `body` for legacy
            # documents, but we always write the updated markdown back to
            # `content` so the handler can persist it correctly.
            payload = {
                "title": title,
                "status": document.get("status") or document.get("page_status") or "draft",
                "order": document.get("order", 0),
                "last_edited_by": "agent-bot",
                "relevance_score": score,
                "content": updated_content,
            }
            update_result = self.update_document(
                jwt_token=jwt_token,
                org_id=org_id,
                project_id=project_id,
                document_id=doc_id,
                payload=payload,
            )
            if not update_result.get("success"):
                update_error = update_result.get("error", "Failed to update document")
            else:
                updated = True

            per_doc = {
                "document_id": doc_id,
                "title": title,
                "relevance_score": score,
                "relevance_category": category,
                "rationale": rationale,
                "updated": updated,
                "error": update_error,
            }
            # Attach any workflow metadata so the LLM can see what the
            # document relevance workflow did internally (plan, actions,
            # routing decision, summary). This is additive and
            # backwards-compatible.
            workflow_meta = eval_result.get("workflow") if isinstance(eval_result, dict) else None
            if isinstance(workflow_meta, dict):
                per_doc["workflow"] = workflow_meta
            per_doc["success"] = update_error is None
            results.append(per_doc)

        any_success = any(r.get("success") for r in results)
        return {
            "success": any_success,
            "total_documents": len(ordered_ids),
            "documents": results,
        }

    async def evaluate_single_project_document(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        document_id: str,
	        last_messages: Optional[List[Dict[str, Any]]] = None,
	        project_context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Evaluate a single project document and update it plus its evidence.

        This is the single-document counterpart to evaluate_project_with_writer. It
        updates three markdown sections in the document and, when the document is at
        least moderately relevant, also evaluates and adjusts evidence requests
        linked to the document.
        """
        if not jwt_token or not org_id or not project_id:
            return {
                "success": False,
                "error": "Missing authentication or project context for evaluate_document",
            }

        doc_id = (document_id or "").strip()
        if not doc_id:
            return {"success": False, "error": "Missing document_id for evaluate_document"}

        # If the caller did not provide a richer project context string, fall
        # back to a minimal one using only IDs.
        if project_context is None:
            project_context = f"Org ID: {org_id}\nProject ID: {project_id}"
        last_messages = last_messages or []

        # 1) Read full document
        self._debug(
            "evaluate_single_project_document: starting for "
            f"document_id={doc_id!r}, org_id={org_id!r}, project_id={project_id!r}"
        )
        full_result = self.read_full_document(
            jwt_token=jwt_token,
            org_id=org_id,
            project_id=project_id,
            document_id=doc_id,
        )

        if not full_result.get("success"):
            error_msg = full_result.get("error", "Failed to read document")
            return {
                "success": False,
                "error": error_msg,
                "status_code": full_result.get("status_code"),
                "document": {
                    "document_id": doc_id,
                    "title": None,
                    "success": False,
                    "error": error_msg,
                },
            }

        data = full_result.get("data") or {}
        document = data.get("document") or data
        title = document.get("title") or "(untitled document)"
        # Prefer whichever field actually holds the body text so that updates
        # affect what the UI renders (some controls use `body`, others
        # `content`).
        raw_content_val = document.get("content")
        if raw_content_val:
            content = raw_content_val
            content_field = "content"
        else:
            body_val = document.get("body") or ""
            content = body_val
            content_field = "body" if body_val else "content"

        self._debug(
            "evaluate_single_project_document: loaded document "
            f"'{title}' (ID: {document.get('object_id') or document.get('id') or document.get('document_id') or doc_id}), "
            f"source_field={content_field}, content_length={len(content)}"
        )
        self._debug(
            "evaluate_single_project_document: original content preview="
            f"{content[:400]!r}"
        )

        # 2) Evaluate using the document relevance workflow. This wraps the
        # existing writer behavior in a LangGraph workflow.
        eval_result = await run_document_relevance_workflow(
            project_content_tool=self,
            document=document,
            project_context=project_context,
            last_messages=last_messages,
        )

        if not eval_result.get("success"):
            error_msg = eval_result.get("error", "Writer step failed")
            final_doc_id = (
                document.get("object_id")
                or document.get("id")
                or document.get("document_id")
                or doc_id
            )
            return {
                "success": False,
                "error": error_msg,
                "document": {
                    "document_id": final_doc_id,
                    "title": title,
                    "success": False,
                    "error": error_msg,
                },
            }

        evaluation = eval_result.get("evaluation", {})
        score_raw = evaluation.get("relevance_score", 0)
        try:
            score_int = int(score_raw)
        except Exception:
            score_int = 0
        category = evaluation.get("relevance_category", "low")
        rationale = evaluation.get("rationale")
        section_md = evaluation.get("relevance_section_markdown", "")
        org_section_md = evaluation.get("org_relevance_section_markdown", "")
        impl_section_md = evaluation.get("implementation_summary_section_markdown", "")

        self._debug(
            "evaluate_single_project_document: writer evaluation "
            f"score={score_int}, category={category}, rationale={rationale!r}"
        )
        # 3) Upsert the three sections into the document content
        insert_operations = evaluation.get("insert_operations") or []
        if insert_operations:
            # Primary path: use structured insert operations planned by the
            # writer to update the document content.
            updated_content = self._apply_insert_operations(content, insert_operations)
        else:
            # Backwards-compatible path: fall back to heading-based upsert of
            # the three standard sections when no structured edits were
            # provided (e.g., older writer behavior or partial failures).
            updated_content = self._upsert_relevance_section(content, section_md)
            updated_content = self._upsert_named_section(
                existing_content=updated_content,
                heading_text="Relevance to our organization",
                new_section=org_section_md,
            )
            updated_content = self._upsert_named_section(
                existing_content=updated_content,
                heading_text="Implementation summary",
                new_section=impl_section_md,
            )

        self._debug(
            "evaluate_single_project_document: updated content preview="
            f"{updated_content[:400]!r}"
        )

        # 4) Persist the updated document with the relevance score
        updated = False
        update_error: Optional[str] = None
        final_doc_id = (
            document.get("object_id")
            or document.get("id")
            or document.get("document_id")
            or doc_id
        )
        # NOTE: As with the bulk writer, always write the updated markdown to
        # the `content` field expected by the backend, regardless of whether
        # the original text was stored in `content` or `body`.
        payload = {
            "title": title,
            "status": document.get("status") or document.get("page_status") or "draft",
            "order": document.get("order", 0),
            "last_edited_by": "agent-bot",
            "relevance_score": score_int,
            "content": updated_content,
        }
        self._debug(
            "evaluate_single_project_document: sending update_document payload "
            f"for document_id={final_doc_id!r} with relevance_score={score_int}"
        )
        update_result = self.update_document(
            jwt_token=jwt_token,
            org_id=org_id,
            project_id=project_id,
            document_id=final_doc_id,
            payload=payload,
        )
        if not update_result.get("success"):
            update_error = update_result.get("error", "Failed to update document")
            self._debug(
                "evaluate_single_project_document: update_document FAILED for "
                f"document_id={final_doc_id!r}: {update_error}"
            )
        else:
            updated = True
            self._debug(
                "evaluate_single_project_document: update_document SUCCEEDED for "
                f"document_id={final_doc_id!r}"
            )

        # 5) Evaluate and adjust evidence requests, subject to relevance threshold
        if update_error is not None:
            evidence_result: Dict[str, Any] = {
                "processed": False,
                "error": "Document update failed; evidence requests were left unchanged.",
            }
        elif score_int < 15:
            self._debug(
                "evaluate_single_project_document: relevance_score < 15; "
                "skipping evidence evaluation."
            )
            evidence_result = {
                "processed": False,
                "reason": "Document relevance_score < 15; evidence requests were left unchanged.",
            }
        else:
            try:
                self._debug(
                    "evaluate_single_project_document: relevance_score >= 15; "
                    "evaluating evidence requests."
                )
                evidence_result = await self._evaluate_and_apply_evidence_requests_for_document(
                    jwt_token=jwt_token,
                    org_id=org_id,
                    project_id=project_id,
                    document=document,
                    full_document_payload=data,
                    project_context=project_context,
                    evaluation=evaluation,
                    last_messages=last_messages,
                )
            except Exception as e:  # pragma: no cover - defensive
                evidence_result = {
                    "processed": False,
                    "error": f"Error while evaluating evidence requests: {str(e)}",
                }

        self._debug(
            "evaluate_single_project_document: evidence_result summary="
            f" processed={evidence_result.get('processed')}, "
            f"updated={evidence_result.get('updated')}, "
            f"marked_low={evidence_result.get('marked_low')}, "
            f"created={evidence_result.get('created')}, "
            f"error={evidence_result.get('error')}, "
            f"reason={evidence_result.get('reason')}"
        )

        per_doc = {
            "document_id": final_doc_id,
            "title": title,
            "relevance_score": score_int,
            "relevance_category": category,
            "rationale": rationale,
            "updated": updated,
            "error": update_error,
            "evidence": evidence_result,
        }
        # Attach workflow metadata (if present) so the LLM can see a concise
        # summary of what the workflow planned and executed.
        workflow_meta = eval_result.get("workflow") if isinstance(eval_result, dict) else None
        if isinstance(workflow_meta, dict):
            per_doc["workflow"] = workflow_meta
        per_doc["success"] = update_error is None

        return {
            "success": per_doc["success"],
            "document": per_doc,
        }

    def read_documentation_template(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        page_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Read a documentation template page by ID.
        Searches recursively through the template hierarchy (pages and children).
        Returns the matching page with its content, or feedback if not found.
        """
        try:
            if not page_id or not page_id.strip():
                return {
                    "success": False,
                    "error": "Page ID cannot be empty. Provide a page ID to search for.",
                    "page": None
                }

            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json"
            }

            # Fetch the documentation template
            response = requests.get(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/documentation-template",
                headers=headers,
                timeout=self.request_timeout
            )

            if response.status_code == 401:
                return {
                    "success": False,
                    "error": "Unauthorized: Invalid JWT token",
                    "page": None
                }
            elif response.status_code == 404:
                return {
                    "success": False,
                    "error": "Documentation template not found for this project",
                    "page": None
                }
            elif response.status_code != 200:
                return {
                    "success": False,
                    "error": f"Failed to fetch documentation template: HTTP {response.status_code}",
                    "page": None
                }

            template_data = response.json()
            pages = template_data.get("pages", [])

            # Search recursively through the template hierarchy by ID
            match = self._find_page_by_id(pages, page_id.strip())

            if not match:
                return {
                    "success": False,
                    "error": f"Page with ID '{page_id}' not found in documentation template",
                    "page": None,
                    "hint": "Check the page ID and try again"
                }
            else:
                # Page found - return the page content
                return {
                    "success": True,
                    "id": match.get("id"),
                    "title": match.get("title"),
                    "content": match.get("content", ""),
                    "depth": match.get("_depth", 0),
                    "page": match,
                    "message": f"Found page: {match.get('title')}"
                }

        except requests.exceptions.Timeout:
            return {
                "success": False,
                "error": "Timeout fetching documentation template",
                "page": None
            }
        except requests.exceptions.ConnectionError:
            return {
                "success": False,
                "error": "Connection error fetching documentation template",
                "page": None
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Unexpected error: {str(e)}",
                "page": None
            }

    def _find_page_by_id(
        self,
        pages: List[Dict[str, Any]],
        page_id: str,
        depth: int = 0
    ) -> Optional[Dict[str, Any]]:
        """
        Recursively search through pages and their children by ID.
        Returns the matching page with depth information, or None if not found.
        """
        for page in pages:
            current_id = page.get("id", "")

            # Exact ID match
            if current_id == page_id:
                # Add depth info for context
                page_copy = dict(page)
                page_copy["_depth"] = depth
                return page_copy

            # Recursively search children
            if page.get("children"):
                child_match = self._find_page_by_id(
                    page["children"],
                    page_id,
                    depth + 1
                )
                if child_match:
                    return child_match

        return None

    def edit_documentation_page(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        page_id: str,
        new_content: str
    ) -> Dict[str, Any]:
        """
        Edit the content of a specific documentation page.
        Fetches the entire template, updates the specific page, and saves it back.
        """
        try:
            if not page_id or not page_id.strip():
                return {
                    "success": False,
                    "error": "Page ID cannot be empty"
                }

            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json"
            }

            # Fetch the current documentation template
            response = requests.get(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/documentation-template",
                headers=headers,
                timeout=self.request_timeout
            )

            if response.status_code == 401:
                return {"success": False, "error": "Unauthorized: Invalid JWT token"}
            elif response.status_code == 404:
                return {"success": False, "error": "Documentation template not found"}
            elif response.status_code != 200:
                return {"success": False, "error": f"Failed to fetch template: HTTP {response.status_code}"}

            template_data = response.json()
            pages = template_data.get("pages", [])

            # Find and update the page content
            updated = self._update_page_content(pages, page_id.strip(), new_content)

            if not updated:
                return {
                    "success": False,
                    "error": f"Page with ID '{page_id}' not found in documentation template"
                }

            # Save the updated template
            save_response = requests.put(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/documentation-template",
                headers=headers,
                json={"pages": pages},
                timeout=self.request_timeout
            )

            if save_response.status_code == 200:
                return {
                    "success": True,
                    "message": f"Successfully updated page '{page_id}'",
                    "page_id": page_id
                }
            else:
                return {
                    "success": False,
                    "error": f"Failed to save template: HTTP {save_response.status_code}"
                }

        except requests.exceptions.Timeout:
            return {"success": False, "error": "Timeout during operation"}
        except requests.exceptions.ConnectionError:
            return {"success": False, "error": "Connection error"}
        except Exception as e:
            return {"success": False, "error": f"Unexpected error: {str(e)}"}

    def _update_page_content(
        self,
        pages: List[Dict[str, Any]],
        page_id: str,
        new_content: str
    ) -> bool:
        """
        Recursively find and update a page's content.
        Returns True if page was found and updated, False otherwise.
        """
        for page in pages:
            if page.get("id") == page_id:
                page["content"] = new_content
                # Update timestamp
                from datetime import datetime
                page["updatedAt"] = datetime.utcnow().isoformat() + "Z"
                return True

            # Recursively search children
            if page.get("children"):
                if self._update_page_content(page["children"], page_id, new_content):
                    return True

        return False

    def _find_and_remove_page(
        self,
        pages: List[Dict[str, Any]],
        page_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Recursively find and remove a page from the tree.
        Returns the removed page object, or None if not found.
        """
        for i, page in enumerate(pages):
            if page.get("id") == page_id:
                print(f"[DEBUG] Found page to remove: {page_id} at root level", flush=True)
                return pages.pop(i)

            # Recursively search children
            if page.get("children"):
                result = self._find_and_remove_page(page["children"], page_id)
                if result:
                    return result

        return None

    def _find_page_by_id(
        self,
        pages: List[Dict[str, Any]],
        page_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Recursively find a page by ID.
        Returns the page object, or None if not found.
        """
        for page in pages:
            if page.get("id") == page_id:
                print(f"[DEBUG] Found page: {page_id} (title: {page.get('title', 'N/A')})", flush=True)
                return page

            # Recursively search children
            if page.get("children"):
                result = self._find_page_by_id(page["children"], page_id)
                if result:
                    return result

        return None

    def _update_page_parent(
        self,
        pages: List[Dict[str, Any]],
        page_id: str,
        new_parent_id: Optional[str] = None
    ) -> bool:
        """
        Move a page to a different parent in the tree structure.
        Removes page from current location and adds it to new parent's children.
        Returns True if page was found and moved, False otherwise.
        """
        # Debug: Print all available page IDs
        def collect_all_page_ids(pages_list, prefix=""):
            ids = []
            for page in pages_list:
                page_id_val = page.get("id", "unknown")
                page_title = page.get("title", "N/A")
                ids.append(f"{prefix}{page_id_val} (title: {page_title})")
                if page.get("children"):
                    ids.extend(collect_all_page_ids(page["children"], prefix + "  "))
            return ids

        all_ids = collect_all_page_ids(pages)
        print(f"[DEBUG] Available page IDs in system:", flush=True)
        for id_info in all_ids:
            print(f"[DEBUG]   {id_info}", flush=True)
        print(f"[DEBUG] Looking for page_id: '{page_id}' to move under parent: '{new_parent_id}'", flush=True)

        # Step 1: Find and remove the page from its current location
        page_to_move = self._find_and_remove_page(pages, page_id)

        if not page_to_move:
            print(f"[DEBUG] ❌ Page '{page_id}' NOT FOUND in system", flush=True)
            return False

        print(f"[DEBUG] ✅ Page '{page_id}' found and removed from current location", flush=True)

        # Step 2: Update the page's parent_id
        page_to_move["parent_id"] = new_parent_id
        from datetime import datetime
        page_to_move["updatedAt"] = datetime.utcnow().isoformat() + "Z"

        # Step 3: Add page to new parent's children or to root
        if new_parent_id is None:
            # Add to root level
            print(f"[DEBUG] Moving page '{page_id}' to root level", flush=True)
            pages.append(page_to_move)
        else:
            # Find the new parent and add to its children
            print(f"[DEBUG] Looking for parent page: '{new_parent_id}'", flush=True)
            new_parent = self._find_page_by_id(pages, new_parent_id)
            if new_parent:
                print(f"[DEBUG] ✅ Parent found: '{new_parent_id}', adding page as child", flush=True)
                if "children" not in new_parent:
                    new_parent["children"] = []
                new_parent["children"].append(page_to_move)
                return True
            else:
                # Parent not found, add back to root as fallback
                print(f"[DEBUG] ❌ Parent '{new_parent_id}' NOT FOUND, moving page to root as fallback", flush=True)
                pages.append(page_to_move)
                return False

        return True

    def create_documentation_page(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        page_title: str,
        page_id: str,
        page_content: str,
        parent_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a new documentation page.
        If parent_id is provided, adds as a child of that page.
        Otherwise, adds to the root level.
        """
        try:
            print(f"[DEBUG] create_documentation_page called: title='{page_title}', id='{page_id}', parent_id='{parent_id}'", flush=True)

            if not page_id or not page_id.strip():
                return {"success": False, "error": "Page ID cannot be empty"}
            if not page_title or not page_title.strip():
                return {"success": False, "error": "Page title cannot be empty"}

            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json"
            }

            # Fetch the current documentation template
            print(f"[DEBUG] Fetching documentation template...", flush=True)
            response = requests.get(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/documentation-template",
                headers=headers,
                timeout=self.request_timeout
            )

            if response.status_code == 401:
                return {"success": False, "error": "Unauthorized: Invalid JWT token"}
            elif response.status_code == 404:
                # No template exists, create a new one
                print(f"[DEBUG] No template exists, creating new one", flush=True)
                pages = []
            elif response.status_code == 200:
                template_data = response.json()
                pages = template_data.get("pages", [])
                print(f"[DEBUG] Template fetched with {len(pages)} root pages", flush=True)
            else:
                return {"success": False, "error": f"Failed to fetch template: HTTP {response.status_code}"}

            # Check if page ID already exists
            if self._find_page_by_id(pages, page_id.strip()):
                return {
                    "success": False,
                    "error": f"Page with ID '{page_id}' already exists"
                }

            # Create the new page
            from datetime import datetime
            now = datetime.utcnow().isoformat() + "Z"
            new_page = {
                "id": page_id.strip(),
                "title": page_title.strip(),
                "content": page_content,
                "order": 0,
                "children": [],
                "createdAt": now,
                "updatedAt": now
            }

            # Add the page to the appropriate location
            if parent_id:
                print(f"[DEBUG] Adding page '{page_id}' as child of parent '{parent_id}'", flush=True)
                added = self._add_child_page(pages, parent_id.strip(), new_page)
                if not added:
                    print(f"[DEBUG] ❌ Parent page '{parent_id}' not found", flush=True)
                    return {
                        "success": False,
                        "error": f"Parent page with ID '{parent_id}' not found"
                    }
                print(f"[DEBUG] ✅ Page added as child of parent '{parent_id}'", flush=True)
            else:
                # Add to root level
                print(f"[DEBUG] Adding page '{page_id}' to root level", flush=True)
                # Calculate order as max + 1
                max_order = max([p.get("order", 0) for p in pages], default=-1)
                new_page["order"] = max_order + 1
                pages.append(new_page)
                print(f"[DEBUG] ✅ Page added to root level", flush=True)

            # Save the updated template
            save_response = requests.put(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/documentation-template",
                headers=headers,
                json={"pages": pages},
                timeout=self.request_timeout
            )

            if save_response.status_code == 200:
                return {
                    "success": True,
                    "message": f"Successfully created page '{page_title}' with ID '{page_id}'",
                    "page_id": page_id,
                    "title": page_title
                }
            else:
                return {
                    "success": False,
                    "error": f"Failed to save template: HTTP {save_response.status_code}"
                }

        except requests.exceptions.Timeout:
            return {"success": False, "error": "Timeout during operation"}
        except requests.exceptions.ConnectionError:
            return {"success": False, "error": "Connection error"}
        except Exception as e:
            return {"success": False, "error": f"Unexpected error: {str(e)}"}

    def _add_child_page(
        self,
        pages: List[Dict[str, Any]],
        parent_id: str,
        new_page: Dict[str, Any]
    ) -> bool:
        """
        Recursively find parent page and add new page as a child.
        Returns True if parent was found and child added, False otherwise.
        """
        for page in pages:
            if page.get("id") == parent_id:
                if "children" not in page:
                    page["children"] = []
                # Calculate order as max + 1
                max_order = max([p.get("order", 0) for p in page["children"]], default=-1)
                new_page["order"] = max_order + 1
                page["children"].append(new_page)
                return True

            # Recursively search children
            if page.get("children"):
                if self._add_child_page(page["children"], parent_id, new_page):
                    return True

        return False

    def delete_documentation_page(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        page_id: str
    ) -> Dict[str, Any]:
        """
        Delete a documentation page by ID.
        If the page has children, they will also be deleted.
        """
        try:
            if not page_id or not page_id.strip():
                return {"success": False, "error": "Page ID cannot be empty"}

            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json"
            }

            # Fetch the current documentation template
            response = requests.get(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/documentation-template",
                headers=headers,
                timeout=self.request_timeout
            )

            if response.status_code == 401:
                return {"success": False, "error": "Unauthorized: Invalid JWT token"}
            elif response.status_code == 404:
                return {"success": False, "error": "Documentation template not found"}
            elif response.status_code != 200:
                return {"success": False, "error": f"Failed to fetch template: HTTP {response.status_code}"}

            template_data = response.json()
            pages = template_data.get("pages", [])

            # Find and delete the page
            deleted_page = self._delete_page_by_id(pages, page_id.strip())

            if not deleted_page:
                return {
                    "success": False,
                    "error": f"Page with ID '{page_id}' not found in documentation template"
                }

            # Save the updated template
            save_response = requests.put(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/documentation-template",
                headers=headers,
                json={"pages": pages},
                timeout=self.request_timeout
            )

            if save_response.status_code == 200:
                return {
                    "success": True,
                    "message": f"Successfully deleted page '{deleted_page.get('title', page_id)}'",
                    "page_id": page_id,
                    "deleted_page_title": deleted_page.get("title", "Unknown")
                }
            else:
                return {
                    "success": False,
                    "error": f"Failed to save template: HTTP {save_response.status_code}"
                }

        except requests.exceptions.Timeout:
            return {"success": False, "error": "Timeout during operation"}
        except requests.exceptions.ConnectionError:
            return {"success": False, "error": "Connection error"}
        except Exception as e:
            return {"success": False, "error": f"Unexpected error: {str(e)}"}

    def _delete_page_by_id(
        self,
        pages: List[Dict[str, Any]],
        page_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Recursively find and delete a page by ID.
        Returns the deleted page if found, None otherwise.
        """
        for i, page in enumerate(pages):
            if page.get("id") == page_id:
                # Found the page, remove it
                return pages.pop(i)

            # Recursively search children
            if page.get("children"):
                deleted = self._delete_page_by_id(page["children"], page_id)
                if deleted:
                    return deleted

        return None

    async def _generate_page_structure(
        self,
        content_instructions: str,
        last_messages: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Use LLM to generate page structure (page_title, page_id) from content instructions (Writer Step)
        Content will be markdown but structure needs to be JSON.
        Parent ID is determined by the main LLM and passed separately.

        Args:
            content_instructions: Natural language description of page content and title
            last_messages: Last 15 messages for context

        Returns:
            Dict with generated page_title and page_id or error
        """
        if not self.llm_client:
            return {"success": False, "error": "LLM client not available for writer step"}

        max_retries = 2
        retry_count = 0

        while retry_count <= max_retries:
            try:
                prompt = f"""Generate page structure as JSON. Return ONLY the JSON object, no markdown.

Instructions: {content_instructions}

JSON fields required:
- page_title: The title for this page (e.g., "PR Review Compliance Template")
- page_id: A unique identifier for this page (e.g., "pr-review-compliance", "api-reference"). Use lowercase with hyphens.

Return valid JSON only. Do not wrap in markdown code blocks."""

                response = await self.llm_client.ainvoke([HumanMessage(content=prompt)])
                response_text = response.content.strip()

                # Remove markdown code blocks if present
                if response_text.startswith("```"):
                    response_text = response_text.split("```")[1]
                    if response_text.startswith("json"):
                        response_text = response_text[4:]
                    response_text = response_text.strip()

                # Parse JSON response
                try:
                    generated_structure = json.loads(response_text)
                    return {"success": True, "structure": generated_structure}
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

    async def _generate_page_content(
        self,
        page_title: str,
        content_instructions: str,
        last_messages: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Use LLM to generate markdown content from content instructions (Writer Step).

        Args:
            page_title: Title of the page
            content_instructions: Natural language description of page content
            last_messages: Last 15 messages for context

        Returns:
            Dict with generated markdown content or error
        """
        if not self.llm_client:
            return {"success": False, "error": "LLM client not available for writer step"}

        max_retries = 2
        retry_count = 0

        while retry_count <= max_retries:
            try:
                prompt = f"""Generate markdown content for a documentation page. Return ONLY the markdown content, no code blocks or extra formatting.

Page Title: {page_title}
Content Instructions: {content_instructions}

Generate well-structured markdown content that follows the instructions. Include appropriate headers, sections, and formatting."""

                response = await self.llm_client.ainvoke([HumanMessage(content=prompt)])
                markdown_content = response.content.strip()

                # Remove markdown code blocks if present
                if markdown_content.startswith("```"):
                    markdown_content = markdown_content.split("```")[1]
                    if markdown_content.startswith("markdown"):
                        markdown_content = markdown_content[8:]
                    markdown_content = markdown_content.strip()

                if not markdown_content:
                    retry_count += 1
                    if retry_count <= max_retries:
                        print(f"⚠️ Writer step content generation empty (attempt {retry_count}/{max_retries})", flush=True)
                        continue
                    else:
                        print(f"❌ Writer step content generation failed after {max_retries} retries: Empty content", flush=True)
                        return {"success": False, "error": "Generated content is empty"}

                return {"success": True, "content": markdown_content}

            except Exception as e:
                retry_count += 1
                if retry_count <= max_retries:
                    print(f"⚠️ Writer step content error (attempt {retry_count}/{max_retries}): {str(e)[:100]}", flush=True)
                    continue
                else:
                    print(f"❌ Writer step content generation failed after {max_retries} retries: {str(e)}", flush=True)
                    return {"success": False, "error": f"Content generation failed after {max_retries} retries: {str(e)}"}

    async def create_documentation_page_with_writer(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        content_instructions: str,
        last_messages: List[Dict[str, Any]],
        parent_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create documentation page using writer step to generate page_title, page_id, and markdown content.
        Parent ID is determined by the main LLM and passed as a parameter.

        Args:
            jwt_token: JWT authentication token
            org_id: Organization ID
            project_id: Project ID
            content_instructions: Natural language description of page (title and content)
            last_messages: Last 15 messages for context
            parent_id: Optional parent page ID (determined by main LLM). Defaults to root if not provided.

        Returns:
            Dict with success status and page ID
        """
        try:
            print(f"[DEBUG] create_documentation_page_with_writer called with parent_id='{parent_id}'", flush=True)

            if not content_instructions or not content_instructions.strip():
                return {"success": False, "error": "Content instructions cannot be empty"}

            # Step 1: Generate page structure using writer step
            writer_result = await self._generate_page_structure(
                content_instructions=content_instructions,
                last_messages=last_messages
            )

            if not writer_result.get("success"):
                return writer_result

            generated_structure = writer_result.get("structure", {})
            page_title = generated_structure.get("page_title", "")
            page_id = generated_structure.get("page_id", "")

            print(f"[DEBUG] Generated page structure: title='{page_title}', id='{page_id}'", flush=True)

            if not page_title:
                return {"success": False, "error": "Generated page_title is empty"}
            if not page_id:
                return {"success": False, "error": "Generated page_id is empty"}

            # Step 2: Generate markdown content using writer step
            content_result = await self._generate_page_content(
                page_title=page_title,
                content_instructions=content_instructions,
                last_messages=last_messages
            )

            if not content_result.get("success"):
                return content_result

            page_content = content_result.get("content", "")

            # Step 3: Call backend API with generated fields and content
            return self.create_documentation_page(
                jwt_token=jwt_token,
                org_id=org_id,
                project_id=project_id,
                page_title=page_title,
                page_id=page_id,
                page_content=page_content,  # Use generated markdown content
                parent_id=parent_id  # Use parent_id determined by main LLM
            )

        except Exception as e:
            return {"success": False, "error": f"Unexpected error in create_documentation_page_with_writer: {str(e)}"}

    async def edit_documentation_page_with_writer(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        page_id: str,
        content_instructions: str,
        last_messages: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Edit documentation page using writer step to generate updated content from instructions.

        Args:
            jwt_token: JWT authentication token
            org_id: Organization ID
            project_id: Project ID
            page_id: ID of page to edit
            content_instructions: Natural language description of new content
            last_messages: Last 15 messages for context

        Returns:
            Dict with success status
        """
        try:
            if not page_id or not page_id.strip():
                return {"success": False, "error": "Page ID cannot be empty"}
            if not content_instructions or not content_instructions.strip():
                return {"success": False, "error": "Content instructions cannot be empty"}

            # Step 1: Generate markdown content using writer step
            content_result = await self._generate_page_content(
                page_title=page_id,  # Use page_id as context for content generation
                content_instructions=content_instructions,
                last_messages=last_messages
            )

            if not content_result.get("success"):
                return content_result

            new_content = content_result.get("content", "")

            # Step 2: Call backend API with generated content
            return self.edit_documentation_page(
                jwt_token=jwt_token,
                org_id=org_id,
                project_id=project_id,
                page_id=page_id,
                new_content=new_content
            )

        except Exception as e:
            return {"success": False, "error": f"Unexpected error in edit_documentation_page_with_writer: {str(e)}"}

    def reassign_page_parent(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        page_id: str,
        new_parent_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Reassign a page to a different parent.
        Fetches the entire template, updates the page's parent, and saves it back.

        Args:
            jwt_token: JWT authentication token
            org_id: Organization ID
            project_id: Project ID
            page_id: ID of page to reassign
            new_parent_id: New parent page ID. If None, moves to root.

        Returns:
            Dict with success status
        """
        try:
            print(f"[DEBUG] reassign_page_parent called with page_id='{page_id}', new_parent_id='{new_parent_id}'", flush=True)

            if not page_id or not page_id.strip():
                return {
                    "success": False,
                    "error": "Page ID cannot be empty"
                }

            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json"
            }

            # Fetch the current documentation template
            print(f"[DEBUG] Fetching documentation template for org={org_id}, project={project_id}", flush=True)
            response = requests.get(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/documentation-template",
                headers=headers,
                timeout=self.request_timeout
            )

            if response.status_code == 401:
                return {"success": False, "error": "Unauthorized: Invalid JWT token"}
            elif response.status_code == 404:
                return {"success": False, "error": "Documentation template not found"}
            elif response.status_code != 200:
                return {"success": False, "error": f"Failed to fetch template: HTTP {response.status_code}"}

            template_data = response.json()
            pages = template_data.get("pages", [])
            print(f"[DEBUG] Template fetched successfully with {len(pages)} root pages", flush=True)

            # Find and update the page parent
            updated = self._update_page_parent(pages, page_id.strip(), new_parent_id)

            if not updated:
                print(f"[DEBUG] ❌ Update failed - page not found or parent not found", flush=True)
                return {
                    "success": False,
                    "error": f"Page with ID '{page_id}' not found in documentation template"
                }

            print(f"[DEBUG] ✅ Page parent updated successfully", flush=True)

            # Save the updated template
            print(f"[DEBUG] Saving updated template...", flush=True)
            save_response = requests.put(
                f"{self.backend_url}/api/v1/org/{org_id}/project/{project_id}/documentation-template",
                headers=headers,
                json={"pages": pages},
                timeout=self.request_timeout
            )

            if save_response.status_code == 200:
                parent_info = f"under '{new_parent_id}'" if new_parent_id else "at root level"
                print(f"[DEBUG] ✅ Template saved successfully", flush=True)
                return {
                    "success": True,
                    "message": f"Successfully moved page '{page_id}' {parent_info}",
                    "page_id": page_id
                }
            else:
                print(f"[DEBUG] ❌ Failed to save template: HTTP {save_response.status_code}", flush=True)
                return {
                    "success": False,
                    "error": f"Failed to save template: HTTP {save_response.status_code}"
                }

        except requests.exceptions.Timeout:
            print(f"[DEBUG] ❌ Timeout during operation", flush=True)
            return {"success": False, "error": "Timeout during operation"}
        except requests.exceptions.ConnectionError:
            print(f"[DEBUG] ❌ Connection error", flush=True)
            return {"success": False, "error": "Connection error"}
        except Exception as e:
            print(f"[DEBUG] ❌ Unexpected error: {str(e)}", flush=True)
            return {"success": False, "error": f"Unexpected error: {str(e)}"}

