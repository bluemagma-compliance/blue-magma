"""Tests for the public (unauthenticated) agent.

These tests avoid calling the real OpenAI API by injecting a fake LLM that
implements the minimal interface used by PublicAgent.
"""

from typing import Any, List

import pytest

from public_agent import PublicAgent, PublicResponse


class _FakeStructuredLLM:
    def __init__(self, response: PublicResponse) -> None:
        self._response = response

    async def ainvoke(self, messages: List[Any], *args: Any, **kwargs: Any) -> PublicResponse:
        # Echo back the configured response regardless of input.
        return self._response


class _FakeLLM:
    """Minimal stand-in for a LangChain Chat model.

    It only needs to support `.with_structured_output()` returning an object
    with an `ainvoke(...)` coroutine.
    """

    def __init__(self, response: PublicResponse) -> None:
        self._response = response

    def with_structured_output(self, model_cls):  # type: ignore[override]
        # Ignore `model_cls` and always return the same structured response.
        return _FakeStructuredLLM(self._response)


@pytest.mark.asyncio
async def test_public_agent_run_turn_returns_structured_response() -> None:
    expected = PublicResponse(answer="Hi there", topic="greeting", should_end=False)
    agent = PublicAgent(llm_client=_FakeLLM(expected))

    result = await agent.run_turn("hello", "session-123")

    assert isinstance(result, PublicResponse)
    assert result.answer == expected.answer
    assert result.topic == expected.topic
    assert result.should_end is expected.should_end

