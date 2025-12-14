"""SCF coverage helper tools for SCF config context.

These tools wrap public, no-auth SCF coverage endpoints so the agent can
ask about overlap between frameworks/core levels and about risk/threat
coverage for a single subject.
"""

from typing import Tuple, Dict, Any, Optional, List
import os
import json

import requests

BACKEND_URL = os.getenv("BACKEND_API_URL", "http://app:8080")
REQUEST_TIMEOUT = 10.0

TOOL_NAME_OVERLAP = "scf_coverage_overlap"
TOOL_NAME_RISKS_THREATS = "scf_risks_threats_coverage"

TOOL_NAME_LIST_RISKS = "scf_list_risks"
TOOL_NAME_LIST_THREATS = "scf_list_threats"

_ALLOWED_SUBJECTS_TEXT = (
    "Frameworks: SOC2, ISO27001, HIPAA, GDPR, ISO42001, NIST CSF, NIST AI RMF; "
    "Core levels: L0, L1, L2, AI_OPS, MCR, DSR"
)

SCF_COVERAGE_OVERLAP_TOOL_PROMPT: str = f"""
        - {TOOL_NAME_OVERLAP}: compare coverage overlap between two SCF frameworks or core levels
            arguments: [subject_a, subject_b]
            - subject_a and subject_b can be one of:
              - Frameworks: SOC2, ISO27001, HIPAA, GDPR, ISO42001, NIST CSF, NIST AI RMF
              - Core levels: L0, L1, L2, AI_OPS, MCR, DSR
            - Examples:
              - {TOOL_NAME_OVERLAP}, SOC2, ISO27001
              - {TOOL_NAME_OVERLAP}, L0, L1
"""

SCF_RISKS_THREATS_TOOL_PROMPT: str = f"""
        - {TOOL_NAME_RISKS_THREATS}: fetch SCF control, risk, and threat coverage for one framework or core level
            arguments: [subject]
            - subject can be one of:
              - Frameworks: SOC2, ISO27001, HIPAA, GDPR, ISO42001, NIST CSF, NIST AI RMF
              - Core levels: L0, L1, L2, AI_OPS, MCR, DSR
            - Example:
              - {TOOL_NAME_RISKS_THREATS}, SOC2
"""

SCF_LIST_RISKS_TOOL_PROMPT: str = f"""
        - {TOOL_NAME_LIST_RISKS}: get the catalog of all SCF risks (IDs and titles)
            arguments: []
            - Call the tool as: {TOOL_NAME_LIST_RISKS}
"""

SCF_LIST_THREATS_TOOL_PROMPT: str = f"""
        - {TOOL_NAME_LIST_THREATS}: get the catalog of all SCF threats (IDs and titles)
            arguments: []
            - Call the tool as: {TOOL_NAME_LIST_THREATS}
"""

_SUBJECT_MAP: Dict[str, Tuple[str, str]] = {
    # Frameworks
    "soc2": ("framework", "soc2"),
    "iso27001": ("framework", "iso27001"),
    "hipaa": ("framework", "hipaa"),
    "gdpr": ("framework", "gdpr"),
    "iso42001": ("framework", "iso42001"),
    "nist csf": ("framework", "nist_csf"),
    "nist ai rmf": ("framework", "nist_ai_rmf"),
    # Core levels
    "l0": ("core_level", "core_lvl0"),
    "core lvl0": ("core_level", "core_lvl0"),
    "l1": ("core_level", "core_lvl1"),
    "core lvl1": ("core_level", "core_lvl1"),
    "l2": ("core_level", "core_lvl2"),
    "core lvl2": ("core_level", "core_lvl2"),
    "ai_ops": ("core_level", "core_ai_ops"),
    "ai ops": ("core_level", "core_ai_ops"),
    "core ai ops": ("core_level", "core_ai_ops"),
    "mcr": ("core_level", "mcr"),
    "dsr": ("core_level", "dsr"),
}


def _normalize_subject(name: str) -> Tuple[bool, Optional[str], Optional[str], Optional[str]]:
    """Normalize a user-facing subject name to (type, key) for the API.

    Returns (ok, error_message, subject_type, subject_key).
    """

    if not name or not str(name).strip():
        return False, "subject name cannot be empty", None, None

    key = " ".join(str(name).strip().lower().replace("-", " ").replace("_", " ").split())
    mapping = _SUBJECT_MAP.get(key)
    if not mapping:
        return False, (
            f"Unknown SCF subject '{name}'. Allowed subjects: {_ALLOWED_SUBJECTS_TEXT}."
        ), None, None

    subject_type, subject_key = mapping
    return True, None, subject_type, subject_key


def validate_overlap_args(args: List[str]) -> Tuple[bool, Optional[str], Dict[str, str]]:
    """Validate arguments for scf_coverage_overlap.

    Expected format: [subject_a, subject_b].
    """

    if len(args) < 2:
        return False, (
            f"{TOOL_NAME_OVERLAP} requires two subjects. Example: {TOOL_NAME_OVERLAP}, SOC2, ISO27001"
        ), {}

    ok_a, err_a, a_type, a_key = _normalize_subject(args[0])
    ok_b, err_b, b_type, b_key = _normalize_subject(args[1])

    if not ok_a or not ok_b:
        parts = [e for e in [err_a, err_b] if e]
        return False, " ".join(parts) or "Invalid subjects.", {}

    payload = {
        "subject_a_type": a_type,
        "subject_a_key": a_key,
        "subject_b_type": b_type,
        "subject_b_key": b_key,
    }
    return True, None, payload


def validate_risks_threats_args(args: List[str]) -> Tuple[bool, Optional[str], Dict[str, str]]:
    """Validate arguments for scf_risks_threats_coverage.

    Expected format: [subject].
    """

    if not args:
        return False, (
            f"{TOOL_NAME_RISKS_THREATS} requires one subject. Example: "
            f"{TOOL_NAME_RISKS_THREATS}, SOC2"
        ), {}

    ok, err, subject_type, subject_key = _normalize_subject(args[0])
    if not ok:
        return False, err, {}

    payload = {
        "subject_type": subject_type,
        "subject_key": subject_key,
    }
    return True, None, payload



def validate_list_risks_args(args: List[str]) -> Tuple[bool, Optional[str], Dict[str, Any]]:
    """Validate arguments for scf_list_risks (no arguments expected)."""
    if args:
        return (
            False,
            f"{TOOL_NAME_LIST_RISKS} does not take any arguments. "
            f"Call it as: {TOOL_NAME_LIST_RISKS}",
            {},
        )
    return True, None, {}


def validate_list_threats_args(args: List[str]) -> Tuple[bool, Optional[str], Dict[str, Any]]:
    """Validate arguments for scf_list_threats (no arguments expected)."""
    if args:
        return (
            False,
            f"{TOOL_NAME_LIST_THREATS} does not take any arguments. "
            f"Call it as: {TOOL_NAME_LIST_THREATS}",
            {},
        )
    return True, None, {}



def _extract_summary_text(llm_summary: Any) -> str:
    """Return a compact text representation from llm_summary."""

    if isinstance(llm_summary, str):
        return llm_summary
    if isinstance(llm_summary, dict):
        text = llm_summary.get("summary_text")
        return text or json.dumps(llm_summary)
    return json.dumps(llm_summary) if llm_summary is not None else ""


def fetch_overlap_summary(payload: Dict[str, str]) -> Tuple[bool, Optional[str], Optional[str]]:
    """Call the public SCF overlap endpoint and return (ok, error, summary_text)."""

    try:
        params = {
            "subject_a_type": payload["subject_a_type"],
            "subject_a_key": payload["subject_a_key"],
            "subject_b_type": payload["subject_b_type"],
            "subject_b_key": payload["subject_b_key"],
        }
        resp = requests.get(
            f"{BACKEND_URL}/api/v1/public/frameworks/scf/coverage/overlap",
            params=params,
            timeout=REQUEST_TIMEOUT,
        )
        if resp.status_code != 200:
            return False, f"SCF coverage overlap failed: HTTP {resp.status_code}", None

        body = resp.json()
        summary = _extract_summary_text(body.get("llm_summary"))
        if not summary:
            summary = "SCF coverage overlap did not return a summary."
        return True, None, summary
    except Exception as e:  # pragma: no cover - network/HTTP errors
        return False, f"SCF coverage overlap error: {e}", None


def fetch_all_risks(limit: int = 500) -> Tuple[bool, Optional[str], Optional[str]]:
    """Fetch the SCF risks catalog and return (ok, error, summary_text)."""
    try:
        params = {"limit": limit}
        resp = requests.get(
            f"{BACKEND_URL}/api/v1/public/frameworks/scf/risks",
            params=params,
            timeout=REQUEST_TIMEOUT,
        )
        if resp.status_code != 200:
            return False, f"SCF risks list failed: HTTP {resp.status_code}", None

        body = resp.json()
        items = body.get("items", []) or []
        total = body.get("total", len(items))

        lines = [f"SCF risks catalog: total={total}, returned={len(items)}."]
        for r in items:
            rid = r.get("object_id") or r.get("id") or ""
            title = r.get("title") or ""
            grouping = r.get("grouping") or r.get("function") or ""
            if grouping:
                lines.append(f"- {rid}: {title} [{grouping}]")
            else:
                lines.append(f"- {rid}: {title}")
        return True, None, "\n".join(lines)
    except Exception as e:  # pragma: no cover - network/HTTP errors
        return False, f"SCF risks list error: {e}", None


def fetch_all_threats(limit: int = 500) -> Tuple[bool, Optional[str], Optional[str]]:
    """Fetch the SCF threats catalog and return (ok, error, summary_text)."""
    try:
        params = {"limit": limit}
        resp = requests.get(
            f"{BACKEND_URL}/api/v1/public/frameworks/scf/threats",
            params=params,
            timeout=REQUEST_TIMEOUT,
        )
        if resp.status_code != 200:
            return False, f"SCF threats list failed: HTTP {resp.status_code}", None

        body = resp.json()
        items = body.get("items", []) or []
        total = body.get("total", len(items))

        lines = [f"SCF threats catalog: total={total}, returned={len(items)}."]
        for t in items:
            tid = t.get("object_id") or t.get("id") or ""
            title = t.get("title") or ""
            grouping = t.get("grouping") or ""
            if grouping:
                lines.append(f"- {tid}: {title} [{grouping}]")
            else:
                lines.append(f"- {tid}: {title}")
        return True, None, "\n".join(lines)
    except Exception as e:  # pragma: no cover - network/HTTP errors
        return False, f"SCF threats list error: {e}", None



def fetch_risks_threats_summary(payload: Dict[str, str]) -> Tuple[bool, Optional[str], Optional[str]]:
    """Call the public SCF risks/threats endpoint and return (ok, error, summary_text)."""

    try:
        params = {
            "subject_type": payload["subject_type"],
            "subject_key": payload["subject_key"],
        }
        resp = requests.get(
            f"{BACKEND_URL}/api/v1/public/frameworks/scf/coverage/risks-threats",
            params=params,
            timeout=REQUEST_TIMEOUT,
        )
        if resp.status_code != 200:
            return False, f"SCF risks/threats coverage failed: HTTP {resp.status_code}", None

        body = resp.json()
        summary = _extract_summary_text(body.get("llm_summary"))
        if not summary:
            summary = "SCF risks/threats coverage did not return a summary."
        return True, None, summary
    except Exception as e:  # pragma: no cover - network/HTTP errors
        return False, f"SCF risks/threats coverage error: {e}", None

