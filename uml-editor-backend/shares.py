from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import uuid
import json
from database import database


async def create_share(token: str, diagram_id: str, owner_id: Optional[str], diagram_data: Dict[str, Any], expires_hours: Optional[int] = 24) -> dict:
    created_at = datetime.utcnow()
    expires_at = (created_at + timedelta(hours=expires_hours)) if expires_hours else None

    query = """
        INSERT INTO shares (token, diagram_id, owner_id, diagram_data, created_at, expires_at, is_active)
        VALUES (:token, :diagram_id, :owner_id, :diagram_data, :created_at, :expires_at, :is_active)
        RETURNING token, diagram_id, owner_id, diagram_data, created_at, expires_at, is_active
    """

    result = await database.fetch_one(
        query=query,
        values={
            'token': token,
            'diagram_id': diagram_id,
            'owner_id': owner_id,
            'diagram_data': json.dumps(diagram_data) if diagram_data is not None else None,
            'created_at': created_at,
            'expires_at': expires_at,
            'is_active': True
        }
    )

    if not result:
        return None

    data = dict(result)
    if data.get('diagram_data') and isinstance(data['diagram_data'], str):
        try:
            data['diagram_data'] = json.loads(data['diagram_data'])
        except Exception:
            pass
    return data


async def get_share_by_token(token: str) -> Optional[dict]:
    query = "SELECT token, diagram_id, owner_id, diagram_data, created_at, expires_at, is_active FROM shares WHERE token = :token"
    result = await database.fetch_one(query=query, values={'token': token})

    if not result:
        return None

    data = dict(result)
    if data.get('diagram_data') and isinstance(data['diagram_data'], str):
        try:
            data['diagram_data'] = json.loads(data['diagram_data'])
        except Exception:
            pass

    # Expiration check
    if data.get('expires_at'):
        from datetime import datetime
        if data['expires_at'] < datetime.utcnow():
            return None

    if not data.get('is_active'):
        return None

    return data


async def get_shares_by_diagram_id(diagram_id: str) -> list[dict]:
    """Get all active shares for a diagram."""
    query = "SELECT token, diagram_id, owner_id, diagram_data, created_at, expires_at, is_active FROM shares WHERE diagram_id = :diagram_id AND is_active = TRUE"
    results = await database.fetch_all(query=query, values={'diagram_id': diagram_id})

    shares = []
    for result in results:
        data = dict(result)
        if data.get('diagram_data') and isinstance(data['diagram_data'], str):
            try:
                data['diagram_data'] = json.loads(data['diagram_data'])
            except Exception:
                pass

        # Expiration check
        if data.get('expires_at'):
            from datetime import datetime
            if data['expires_at'] < datetime.utcnow():
                continue

        shares.append(data)

    return shares