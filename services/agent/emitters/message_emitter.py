"""
Message Emitter System for GraphLang Agent

Sends messages that appear as normal chat messages in the frontend,
not as thoughts. These messages are displayed like regular assistant responses.
"""

import asyncio
import json
from datetime import datetime
from typing import Optional, Dict, Any
import contextvars

try:
    from fastapi import WebSocket
except ImportError:
    # For testing without FastAPI
    WebSocket = None


class MessageEmitter:
    """Utility class for emitting normal chat messages via WebSocket during graph execution"""
    
    def __init__(self, websocket: Optional[Any] = None, session_id: str = None):
        self.websocket = websocket
        self.session_id = session_id
        self.enabled = True
        self.rate_limit_delay = 0.5  # Minimum delay between messages (seconds) - slower than thoughts
        self.last_emission_time = 0
        
    def set_websocket(self, websocket: Any):
        """Update the WebSocket connection"""
        self.websocket = websocket
        
    def set_session_id(self, session_id: str):
        """Update the session ID"""
        self.session_id = session_id
        
    def enable(self):
        """Enable message emission"""
        self.enabled = True
        
    def disable(self):
        """Disable message emission"""
        self.enabled = False
        
    async def emit_message(self, content: str, message_type: str = "intermediate") -> None:
        """
        Emit a normal chat message via WebSocket that appears as an assistant message
        
        Args:
            content: The message content to display
            message_type: Type of message for internal tracking (not shown to user)
        """
        
        if not self.enabled or not self.websocket:
            return
            
        # Rate limiting to prevent spam
        current_time = asyncio.get_event_loop().time()
        if current_time - self.last_emission_time < self.rate_limit_delay:
            await asyncio.sleep(self.rate_limit_delay)
            
        try:
            # Format as a normal response message that frontend will display as assistant message
            response_message = {
                "type": "response",
                "message": content,
                "session_id": self.session_id,
                "timestamp": datetime.now().isoformat(),
                "intermediate": True,  # Flag to indicate this is an intermediate message
                "message_type": message_type  # For internal tracking
            }
            
            await self.websocket.send_text(json.dumps(response_message))
            self.last_emission_time = current_time
            
            # Also print to console for debugging
            print(f"[MESSAGE] [{message_type}] {content}")
            
        except Exception as e:
            # Graceful degradation - don't break agent if WebSocket fails
            print(f"Failed to emit message: {e}")
            
    async def emit_status_update(self, content: str) -> None:
        """Emit a status update message"""
        await self.emit_message(content, "status_update")
        
    async def emit_progress_update(self, content: str) -> None:
        """Emit a progress update message"""
        await self.emit_message(content, "progress_update")
        
    async def emit_decision_message(self, content: str) -> None:
        """Emit a decision or next step message"""
        await self.emit_message(content, "decision")
        
    async def emit_task_update(self, content: str) -> None:
        """Emit a task-related update message"""
        await self.emit_message(content, "task_update")


# Global message emitter registry, scoped by session.
# NOTE: This used to be a single global emitter; it is now session-scoped via
# contextvars to avoid cross-session leakage when multiple WebSocket sessions
# are active in one process.
_message_emitters_by_session: Dict[str, MessageEmitter] = {}
_current_msg_session_id_var = contextvars.ContextVar("message_emitter_session_id", default=None)


def set_global_message_emitter(emitter: MessageEmitter):
    """Register the message emitter for the current session context.

    We keep this function name for backwards compatibility, but under the hood
    we now track emitters per session_id instead of a single global instance.
    """
    sid = getattr(emitter, "session_id", None)
    if not sid:
        sid = "__default__"
    _message_emitters_by_session[sid] = emitter
    _current_msg_session_id_var.set(sid)


def get_global_message_emitter() -> Optional[MessageEmitter]:
    """Get the message emitter instance for the current session context."""
    sid = _current_msg_session_id_var.get()
    if not sid:
        return None
    return _message_emitters_by_session.get(sid)


async def emit_message(content: str, message_type: str = "intermediate") -> None:
    """Convenience function to emit messages using the session-scoped emitter"""
    emitter = get_global_message_emitter()
    if emitter:
        await emitter.emit_message(content, message_type)


# Convenience functions for different message types
async def emit_status_update(content: str) -> None:
    """Emit a status update message"""
    emitter = get_global_message_emitter()
    if emitter:
        await emitter.emit_status_update(content)


async def emit_progress_update(content: str) -> None:
    """Emit a progress update message"""
    emitter = get_global_message_emitter()
    if emitter:
        await emitter.emit_progress_update(content)


async def emit_decision_message(content: str) -> None:
    """Emit a decision or next step message"""
    emitter = get_global_message_emitter()
    if emitter:
        await emitter.emit_decision_message(content)


async def emit_task_update(content: str) -> None:
    """Emit a task-related update message"""
    emitter = get_global_message_emitter()
    if emitter:
        await emitter.emit_task_update(content)


class MessageContext:
    """Context manager for grouped messages with automatic status updates"""
    
    def __init__(self, emitter: MessageEmitter, operation: str):
        self.emitter = emitter
        self.operation = operation
        self.start_time = None
        
    async def __aenter__(self):
        self.start_time = datetime.now()
        await self.emitter.emit_status_update(f"Starting {self.operation}...")
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        duration = (datetime.now() - self.start_time).total_seconds()
        
        if exc_type:
            await self.emitter.emit_status_update(f"{self.operation} failed: {str(exc_val)}")
        else:
            await self.emitter.emit_status_update(f"{self.operation} completed ({duration:.1f}s)")


def message_context(operation: str) -> MessageContext:
    """Create a message context for grouped operations"""
    if _global_message_emitter:
        return MessageContext(_global_message_emitter, operation)
    else:
        # Return a no-op context manager if no emitter available
        class NoOpContext:
            async def __aenter__(self): return self
            async def __aexit__(self, *args): pass
        return NoOpContext()
