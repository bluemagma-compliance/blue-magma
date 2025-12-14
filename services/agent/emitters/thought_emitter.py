"""
Thought Process Emission System for LangGraph Agent

Provides real-time insight into agent decision-making through WebSocket messages.
Thoughts are displayed as grey, smaller text to distinguish from regular responses.
"""

import asyncio
from datetime import datetime
from typing import Optional, Dict, Any, List
import json
import contextvars


class ThoughtEmitter:
    """Utility class for emitting agent thought processes via WebSocket"""

    def __init__(self, websocket=None, session_id: str = None):
        self.websocket = websocket
        self.session_id = session_id
        self.enabled = True
        self.rate_limit_delay = 0.1  # Minimum delay between thoughts (seconds)
        self.last_emission_time = 0

    def set_websocket(self, websocket):
        """Update the WebSocket connection"""
        self.websocket = websocket

    def set_session_id(self, session_id: str):
        """Update the session ID"""
        self.session_id = session_id

    def enable(self):
        """Enable thought emission"""
        self.enabled = True

    def disable(self):
        """Disable thought emission"""
        self.enabled = False

    async def emit_thought(self,
                          content: str,
                          node: str = None,
                          phase: str = None,
                          category: str = "general") -> None:
        """
        Emit a thought process message via WebSocket

        Args:
            content: The thought content to display
            node: Which agent node generated this thought
            phase: Current workflow phase (routing, analysis, etc.)
            category: Thought category (routing, workflow, data, error)
        """

        if not self.enabled or not self.websocket:
            return

        # Rate limiting to prevent spam
        current_time = asyncio.get_event_loop().time()
        if current_time - self.last_emission_time < self.rate_limit_delay:
            await asyncio.sleep(self.rate_limit_delay)

        try:
            thought_message = {
                "event": "thought",
                "data": {
                    "content": content,
                    "node": node,
                    "phase": phase,
                    "category": category,
                    "timestamp": datetime.now().isoformat(),
                    "session_id": self.session_id
                }
            }

            await self.websocket.send_text(json.dumps(thought_message))
            self.last_emission_time = current_time

            # Also print to console for debugging
            print(f"💭 [{node or 'unknown'}] {content}")

        except Exception as e:
            # Graceful degradation - don't break agent if WebSocket fails
            print(f"Failed to emit thought: {e}")

    async def emit_routing_thought(self, content: str, node: str = None) -> None:
        """Emit a routing-related thought"""
        await self.emit_thought(content, node=node, phase="routing", category="routing")

    async def emit_workflow_thought(self, content: str, node: str = None) -> None:
        """Emit a workflow-related thought"""
        await self.emit_thought(content, node=node, phase="workflow", category="workflow")

    async def emit_data_thought(self, content: str, node: str = None) -> None:
        """Emit a data processing thought"""
        await self.emit_thought(content, node=node, phase="processing", category="data")

    async def emit_error_thought(self, content: str, node: str = None) -> None:
        """Emit an error or warning thought"""
        await self.emit_thought(content, node=node, phase="error", category="error")

    async def emit_llm_thought(self, content: str, node: str = None) -> None:
        """Emit a thought about LLM processing"""
        await self.emit_thought(content, node=node, phase="llm", category="llm")

    async def emit_update_signal(self, update_type: str = None, ui_actions: Optional[List[Dict[str, Any]]] = None) -> None:
        """Emit an 'update' signal to tell the frontend to refresh data or perform UI actions.

        This is a lightweight notification without rate limiting.

        Args:
            update_type: Optional type of update (e.g., "documentation_template", "auditors", "scf_filters").
            ui_actions: Optional list of UI actions for the frontend to apply (e.g., SCF filter updates).
        """
        if not self.enabled or not self.websocket:
            return

        try:
            data: Dict[str, Any] = {
                "message": "update",
                "timestamp": datetime.now().isoformat(),
                "session_id": self.session_id,
            }

            # Add update type if provided
            if update_type:
                data["update_type"] = update_type

            # Attach UI actions if provided (used by SCF configurator and other UI flows)
            if ui_actions:
                data["ui_actions"] = ui_actions

            update_message = {
                "event": "update",
                "data": data,
            }

            await self.websocket.send_text(json.dumps(update_message))
            type_str = f" ({update_type})" if update_type else ""
            print(f"🔄 [UPDATE] Signal sent to frontend{type_str}")

        except Exception as e:
            # Graceful degradation - don't break agent if WebSocket fails
            print(f"Failed to emit update signal: {e}")

    async def emit_redirect_signal(self, destination: str, resume_session_id: str) -> None:
        """Emit a redirect signal so the frontend can navigate and reconnect.

        Args:
            destination: Logical redirect destination (e.g., "scf").
            resume_session_id: The session ID whose state should be resumed on reconnect.
        """
        if not self.enabled or not self.websocket:
            return

        try:
            redirect_message = {
                "event": "redirect",
                "data": {
                    "destination": destination,
                    "session_id": resume_session_id,
                    "timestamp": datetime.now().isoformat(),
                },
            }

            await self.websocket.send_text(json.dumps(redirect_message))
            print(f"➡️ [REDIRECT] destination={destination}, session_id={resume_session_id}")
        except Exception as e:
            # Graceful degradation - don't break agent if WebSocket fails
            print(f"Failed to emit redirect signal: {e}")



class ThoughtContext:
    """Context manager for grouped thoughts"""

    def __init__(self, emitter: ThoughtEmitter, operation: str, node: str = None):
        self.emitter = emitter
        self.operation = operation
        self.node = node
        self.start_time = None

    async def __aenter__(self):
        self.start_time = datetime.now()
        await self.emitter.emit_workflow_thought(
            f"🏗️ Starting {self.operation}...",
            node=self.node
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        duration = (datetime.now() - self.start_time).total_seconds()

        if exc_type:
            await self.emitter.emit_error_thought(
                f"❌ {self.operation} failed: {str(exc_val)}",
                node=self.node
            )
        else:
            await self.emitter.emit_workflow_thought(
                f"✅ {self.operation} completed ({duration:.1f}s)",
                node=self.node
            )


# Global thought emitter registry, scoped by session.
# NOTE: This used to be a single global emitter; it is now session-scoped via
# contextvars to avoid cross-session leakage when multiple WebSocket sessions
# are active in one process.
_emitters_by_session: Dict[str, ThoughtEmitter] = {}
_current_session_id_var = contextvars.ContextVar("thought_emitter_session_id", default=None)


def set_global_emitter(emitter: ThoughtEmitter):
    """Register the thought emitter for the current session context.

    We keep this function name for backwards compatibility, but under the hood
    we now track emitters per session_id instead of a single global instance.
    """
    # We rely on the emitter carrying its session_id; this is set in
    # RouterAgent.set_thought_emitter. If for some reason it's missing, we
    # store it under a special "__default__" key so that legacy single-session
    # usage continues to work, but we avoid cross-session reuse.
    sid = getattr(emitter, "session_id", None)
    if not sid:
        sid = "__default__"
    _emitters_by_session[sid] = emitter
    # Bind this emitter to the current async context so helper functions
    # (emit_thought, emit_update_signal, etc.) can look up the right emitter.
    _current_session_id_var.set(sid)


def get_global_emitter() -> Optional[ThoughtEmitter]:
    """Get the thought emitter instance for the current session context."""
    sid = _current_session_id_var.get()
    if not sid:
        return None
    return _emitters_by_session.get(sid)


async def emit_thought(content: str, node: str = None, **kwargs) -> None:
    """Convenience function to emit thoughts using the session-scoped emitter"""
    emitter = get_global_emitter()
    if emitter:
        await emitter.emit_thought(content, node=node, **kwargs)


# Convenience functions for different thought types
async def emit_routing_thought(content: str, node: str = None) -> None:
    """Emit a routing-related thought"""
    emitter = get_global_emitter()
    if emitter:
        await emitter.emit_routing_thought(content=content, node=node)


async def emit_workflow_thought(content: str, node: str = None) -> None:
    """Emit a workflow-related thought"""
    emitter = get_global_emitter()
    if emitter:
        await emitter.emit_workflow_thought(content=content, node=node)


async def emit_redirect_signal(destination: str, resume_session_id: str) -> None:
    """Emit a redirect signal via the session-scoped emitter.

    Args:
        destination: Logical redirect destination (e.g., "scf").
        resume_session_id: The session ID whose state should be resumed on reconnect.
    """
    emitter = get_global_emitter()
    if emitter:
        await emitter.emit_redirect_signal(destination, resume_session_id)


async def emit_data_thought(content: str, node: str = None) -> None:
    """Emit a data processing thought"""
    emitter = get_global_emitter()
    if emitter:
        await emitter.emit_data_thought(content=content, node=node)


async def emit_error_thought(content: str, node: str = None) -> None:
    """Emit an error or warning thought"""
    emitter = get_global_emitter()
    if emitter:
        await emitter.emit_error_thought(content=content, node=node)


async def emit_llm_thought(content: str, node: str = None) -> None:
    """Emit a thought about LLM processing"""
    emitter = get_global_emitter()
    if emitter:
        await emitter.emit_llm_thought(content=content, node=node)


async def emit_update_signal(update_type: str = None, ui_actions: Any | None = None) -> None:
    """Emit an update signal to tell the frontend to refresh data or perform UI actions

    Args:
        update_type: Optional type of update (e.g., "documentation_template", "auditors", "scf_filters").
        ui_actions: Optional list of UI actions for the frontend to apply.
    """
    emitter = get_global_emitter()
    if emitter:
        await emitter.emit_update_signal(update_type, ui_actions=ui_actions)


def thought_context(operation: str, node: str = None) -> ThoughtContext:
    """Create a thought context for grouped operations"""
    emitter = get_global_emitter()
    if emitter:
        return ThoughtContext(emitter, operation, node)
    else:
        # Return a no-op context manager if no emitter available
        class NoOpContext:
            async def __aenter__(self): return self
            async def __aexit__(self, *args): pass
        return NoOpContext()
