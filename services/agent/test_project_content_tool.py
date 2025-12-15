import sys
import types
import unittest
from typing import Any, Dict, List, Optional


# Lightweight stubs so tests can import project_content_tool without the
# real langchain_core package being installed in this environment.
fake_tools = types.ModuleType("langchain_core.tools")


def tool(*args: Any, **kwargs: Any):  # type: ignore[override]
    """No-op decorator used in tests.

    The production code uses @tool from langchain_core.tools; for unit tests we
    only need the decorator to return the original function unchanged.
    """

    def decorator(fn: Any) -> Any:
        return fn

    return decorator


fake_tools.tool = tool
sys.modules["langchain_core.tools"] = fake_tools

fake_messages = types.ModuleType("langchain_core.messages")


class HumanMessage:  # Minimal stub used by writer steps
    def __init__(self, content: str):
        self.content = content


fake_messages.HumanMessage = HumanMessage
sys.modules["langchain_core.messages"] = fake_messages

from tools.project_content_tool import ProjectContentTool


class FakeProjectContentTool(ProjectContentTool):
    """Test double that avoids real HTTP and LLM calls."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.read_full_document_calls: List[Dict[str, Any]] = []
        self.update_document_calls: List[Dict[str, Any]] = []
        self.read_full_document_result: Dict[str, Any] = {}
        self.update_document_result: Dict[str, Any] = {"success": True}
        self.writer_result: Dict[str, Any] = {}
        self.writer_call: Optional[Dict[str, Any]] = None
        self.evidence_calls: List[Dict[str, Any]] = []
        self.evidence_result: Dict[str, Any] = {
            "processed": True,
            "success": True,
            "total_existing": 0,
            "updated": 0,
            "marked_low": 0,
            "created": 0,
            "errors": None,
            "writer_summary": None,
        }

    def read_full_document(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        document_id: str,
    ) -> Dict[str, Any]:
        self.read_full_document_calls.append(
            {
                "jwt_token": jwt_token,
                "org_id": org_id,
                "project_id": project_id,
                "document_id": document_id,
            }
        )
        return self.read_full_document_result

    def update_document(
        self,
        jwt_token: str,
        org_id: str,
        project_id: str,
        document_id: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        self.update_document_calls.append(
            {
                "jwt_token": jwt_token,
                "org_id": org_id,
                "project_id": project_id,
                "document_id": document_id,
                "payload": payload,
            }
        )
        return self.update_document_result

    async def _evaluate_single_document_with_writer(
        self,
        document: Dict[str, Any],
        project_context: str,
        last_messages: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        self.writer_call = {
            "document": document,
            "project_context": project_context,
            "last_messages": last_messages,
        }
        return self.writer_result

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
        """Stub that records calls instead of performing real HTTP operations."""

        self.evidence_calls.append(
            {
                "jwt_token": jwt_token,
                "org_id": org_id,
                "project_id": project_id,
                "document": document,
                "full_document_payload": full_document_payload,
                "project_context": project_context,
                "evaluation": evaluation,
                "last_messages": last_messages,
            }
        )
        return self.evidence_result


class EvaluateSingleProjectDocumentTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.tool = FakeProjectContentTool(
            backend_url="http://fake", request_timeout=5, llm_client=object()
        )

    async def test_missing_document_id_fails_fast(self) -> None:
        result = await self.tool.evaluate_single_project_document(
            jwt_token="token",
            org_id="org",
            project_id="proj",
            document_id="",
            last_messages=[],
        )
        self.assertFalse(result["success"])
        self.assertIn("Missing document_id", result["error"])
        self.assertEqual(self.tool.read_full_document_calls, [])
        self.assertIsNone(self.tool.writer_call)

    async def test_read_full_document_failure_is_propagated(self) -> None:
        self.tool.read_full_document_result = {
            "success": False,
            "error": "Not found",
            "status_code": 404,
        }

        result = await self.tool.evaluate_single_project_document(
            jwt_token="token",
            org_id="org",
            project_id="proj",
            document_id="doc-1",
            last_messages=[],
        )

        self.assertFalse(result["success"])
        self.assertIn("Not found", result["error"])
        self.assertEqual(result.get("status_code"), 404)
        self.assertEqual(len(self.tool.update_document_calls), 0)

    async def test_happy_path_updates_document_and_returns_metadata(self) -> None:
        document = {
            "object_id": "doc-1",
            "title": "Access control",
            "content": "# Heading\nExisting body\n",
            "status": "draft",
            "order": 3,
        }
        self.tool.read_full_document_result = {
            "success": True,
            "data": {"document": document},
        }
        self.tool.writer_result = {
            "success": True,
            "evaluation": {
                "relevance_score": 85,
                "relevance_category": "high",
                "rationale": "Very important for this project.",
                "relevance_section_markdown": "## Relevance to this project\nHigh relevance.\n",
                "org_relevance_section_markdown": "## Relevance to our organization\nOrg-level summary.\n",
                "implementation_summary_section_markdown": "## Implementation summary\nImplementation summary.\n",
            },
        }
        self.tool.update_document_result = {"success": True}

        result = await self.tool.evaluate_single_project_document(
            jwt_token="token",
            org_id="org",
            project_id="proj",
            document_id="doc-1",
            last_messages=[{"role": "user", "content": "How important is this?"}],
        )

        self.assertTrue(result["success"])
        doc_info = result["document"]
        self.assertEqual(doc_info["document_id"], "doc-1")
        self.assertEqual(doc_info["title"], "Access control")
        self.assertEqual(doc_info["relevance_score"], 85)
        self.assertEqual(doc_info["relevance_category"], "high")
        self.assertTrue(doc_info["updated"])

        # Ensure update_document was called once with the expected payload
        self.assertEqual(len(self.tool.update_document_calls), 1)
        call = self.tool.update_document_calls[0]
        self.assertEqual(call["document_id"], "doc-1")
        payload = call["payload"]
        self.assertEqual(payload["relevance_score"], 85)
        self.assertIn("## Relevance to this project", payload["content"])
        self.assertIn("## Relevance to our organization", payload["content"])
        self.assertIn("## Implementation summary", payload["content"])

        # Evidence evaluation should run because score >= 15
        self.assertEqual(len(self.tool.evidence_calls), 1)
        evidence = doc_info.get("evidence") or {}
        self.assertTrue(evidence.get("processed"))
        self.assertTrue(evidence.get("success"))
        self.assertEqual(evidence.get("created"), 0)

    async def test_low_relevance_skips_evidence_evaluation(self) -> None:
        document = {
            "object_id": "doc-low",
            "title": "Low relevance control",
            "content": "# Heading\nExisting body\n",
            "status": "draft",
            "order": 1,
        }
        self.tool.read_full_document_result = {
            "success": True,
            "data": {"document": document},
        }
        self.tool.writer_result = {
            "success": True,
            "evaluation": {
                "relevance_score": 10,
                "relevance_category": "not_immediately_relevant",
                "rationale": "Not very important.",
                "relevance_section_markdown": "## Relevance to this project\nLow relevance.\n",
                "org_relevance_section_markdown": "## Relevance to our organization\nOrg-level summary.\n",
                "implementation_summary_section_markdown": "## Implementation summary\nImplementation summary.\n",
            },
        }
        self.tool.update_document_result = {"success": True}

        result = await self.tool.evaluate_single_project_document(
            jwt_token="token",
            org_id="org",
            project_id="proj",
            document_id="doc-low",
            last_messages=[{"role": "user", "content": "How important is this?"}],
        )

        self.assertTrue(result["success"])
        doc_info = result["document"]
        self.assertEqual(doc_info["relevance_score"], 10)
        # Evidence helper must not be called for low scores
        self.assertEqual(len(self.tool.evidence_calls), 0)
        evidence = doc_info.get("evidence") or {}
        self.assertFalse(evidence.get("processed"))
        self.assertIn("relevance_score < 15", evidence.get("reason", ""))


class ApplyInsertOperationsTests(unittest.TestCase):
    def setUp(self) -> None:
        # Use the real ProjectContentTool for pure string-manipulation helpers.
        self.tool = ProjectContentTool(
            backend_url="http://fake", request_timeout=5, llm_client=object()
        )

    def test_apply_insert_operations_inserts_after_anchor(self) -> None:
        original = "Line A\nAnchor line.\nLine C\n"
        ops = [
            {
                "anchor_text": "Anchor line.",
                "position": "after",
                "markdown_to_insert": "## Inserted heading\nBody text.",
            }
        ]

        updated = self.tool._apply_insert_operations(original, ops)
        expected = (
            "Line A\n"
            "Anchor line.\n\n"
            "## Inserted heading\nBody text.\n\n"
            "Line C\n"
        )
        self.assertEqual(updated, expected)

    def test_apply_insert_operations_is_idempotent_for_same_snippet(self) -> None:
        original = "Only one line.\n"
        ops = [
            {
                "anchor_text": "Only one line.",
                "position": "after",
                "markdown_to_insert": "## Extra section\nDetails.",
            }
        ]

        first = self.tool._apply_insert_operations(original, ops)
        second = self.tool._apply_insert_operations(first, ops)
        self.assertEqual(first, second)


if __name__ == "__main__":
    unittest.main()
