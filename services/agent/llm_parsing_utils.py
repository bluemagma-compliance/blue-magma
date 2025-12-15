import json
from typing import Any, List, Optional


def clean_json_markdown(text: str) -> str:
    """Normalize LLM responses that may wrap JSON in markdown code fences.

    - Strips surrounding ``` ``` blocks
    - Removes optional language tag like 'json' on the first line
    - Returns trimmed inner text
    """
    cleaned = text.strip()

    # Strip surrounding code fences like ```json ... ``` or ``` ... ```
    if cleaned.startswith("```"):
        parts = cleaned.split("```")
        if len(parts) >= 2:
            # Typical pattern: ```json\n{...}\n```
            cleaned = parts[1]
        cleaned = cleaned.lstrip()
        lower = cleaned.lower()
        if lower.startswith("json"):
            # Drop the language tag and any immediate whitespace/newline
            cleaned = cleaned[4:].lstrip()

    return cleaned.strip()


def extract_json_object(text: str) -> Optional[str]:
    """Try to extract a JSON object substring from text.

    - First runs clean_json_markdown
    - Then looks for first '{' and last '}' and returns that slice
    """
    cleaned = clean_json_markdown(text)
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        return cleaned[start : end + 1]
    return None


def extract_field_from_jsonish(text: str, keys: List[str]) -> Optional[Any]:
    """Given text that may contain JSON (optionally wrapped in markdown),
    try to parse it and return the first non-null value for the given keys.

    This is useful for cases where the model ignores a sectioned format and
    instead returns something like ```json {"text-to-user": "..."}```.
    """
    # Start from cleaned text
    cleaned = clean_json_markdown(text)

    candidates = []  # type: List[str]
    obj_slice = extract_json_object(cleaned)
    if obj_slice:
        candidates.append(obj_slice)
    candidates.append(cleaned)

    for candidate in candidates:
        try:
            obj = json.loads(candidate)
        except Exception:
            continue
        if isinstance(obj, dict):
            for key in keys:
                if key in obj and obj[key] is not None:
                    return obj[key]
    return None

