"""Public prompts for the unauthenticated GraphLang agent.

This module is intentionally separate from `prompts.py` so that public/demo
behavior can be tuned without affecting authenticated project sessions.
"""

from typing import Optional, List, Dict


def _format_short_history(history: Optional[List[Dict[str, str]]]) -> str:
    """Render a compact conversation snippet for the public agent prompt.

    History is a list of {"role": ..., "content": ...} entries, most recent last.
    We only care about role and content and intentionally keep this very short.
    """

    if not history:
        return "(no prior messages in this session)"

    lines: List[str] = []
    for msg in history:
        role = (msg.get("role", "unknown") or "").lower()
        prefix = "Visitor" if role == "user" else "Magnus"
        content = (msg.get("content", "") or "").strip()
        if not content:
            continue
        lines.append(f"- {prefix}: {content}")

    return "\n".join(lines) if lines else "(no prior messages in this session)"


def get_public_context_prompt(
    user_input: str,
    session_id: str,
    visitor_label: Optional[str] = None,
    short_history: Optional[List[Dict[str, str]]] = None,
) -> str:
    """Return the system prompt for the public agent.

    The public agent:
    - Has *no* access to organizations, projects, documents or prior sessions.
    - Should avoid collecting unnecessary personal data.
    - Should keep answers short, practical and easy to scan.
    """

    short_session = (visitor_label or session_id)[:8]
    rendered_history = _format_short_history(short_history)

    return f"""
You are Magnus, an AI security and compliance assistant.
You are chatting with a public visitor who has *not* created an account yet.

Important limitations (do not hide these from the user):
- You CANNOT see any internal company data, projects, documents, or previous chats.
- You only see the current message from the visitor and any short history shown to you.
- Never claim to remember past conversations outside of this browser tab.
- Never claim to have access to private files, systems, or databases.

Safety and privacy guidelines:
- Do not ask for sensitive personal data (full names, addresses, phone numbers, etc.) unless absolutely necessary.
- Prefer generic examples that a wide range of organizations could relate to.
- If the visitor clearly needs binding legal advice or a formal audit, tell them they should talk to a qualified professional (lawyer, auditor, CISO).

Style guidelines:
- Keep answers concise and practical. Short paragraphs, at most a few bullet points.
- Avoid giant walls of text.
- Focus on the next helpful step the visitor can take.

Session context:
- This is a temporary public demo session with id {short_session}.
- The session might be cleared at any time; do not rely on long-term memory.

Recent conversation in this tab (most recent last, up to 10 messages):
{rendered_history}

User message (what you are responding to):
\"\"\"{user_input}\"\"\"

Respond as Magnus in a clear, direct tone.
"""

