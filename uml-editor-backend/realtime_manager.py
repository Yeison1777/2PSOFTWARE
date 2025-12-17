"""
Real-time collaboration manager using Server-Sent Events (SSE)
Simple in-memory implementation for real-time updates
"""
from typing import Dict, Set, Callable, Any
import asyncio
import json
from datetime import datetime

# Store active SSE connections per diagram
# Format: {diagram_id: Set[queue]}
diagram_listeners: Dict[str, Set[asyncio.Queue]] = {}

# Store last update timestamp per diagram
diagram_last_update: Dict[str, datetime] = {}


async def add_listener(diagram_id: str, queue: asyncio.Queue):
    """Add a listener queue for a diagram."""
    if diagram_id not in diagram_listeners:
        diagram_listeners[diagram_id] = set()
    diagram_listeners[diagram_id].add(queue)


async def remove_listener(diagram_id: str, queue: asyncio.Queue):
    """Remove a listener queue for a diagram."""
    if diagram_id in diagram_listeners:
        diagram_listeners[diagram_id].discard(queue)
        if not diagram_listeners[diagram_id]:
            del diagram_listeners[diagram_id]


async def broadcast_update(diagram_id: str, diagram_data: Dict[str, Any], user_id: str = None):
    """Broadcast an update to all listeners of a diagram."""
    if diagram_id not in diagram_listeners:
        return
    
    # Update timestamp
    diagram_last_update[diagram_id] = datetime.utcnow()
    
    # Prepare update message
    message = {
        "type": "update",
        "diagram_id": diagram_id,
        "diagram_data": diagram_data,
        "timestamp": diagram_last_update[diagram_id].isoformat(),
        "user_id": user_id
    }
    
    # Send to all listeners
    message_json = json.dumps(message)
    disconnected = set()
    
    for queue in diagram_listeners[diagram_id]:
        try:
            await queue.put(message_json)
        except Exception:
            # Queue is closed or disconnected
            disconnected.add(queue)
    
    # Clean up disconnected listeners
    for queue in disconnected:
        await remove_listener(diagram_id, queue)


async def get_last_update_time(diagram_id: str) -> datetime | None:
    """Get the last update time for a diagram."""
    return diagram_last_update.get(diagram_id)

