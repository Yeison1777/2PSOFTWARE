from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
import json
from models import DiagramCreate, DiagramUpdate, Diagram
from database import database

async def create_diagram(diagram_create: DiagramCreate) -> Diagram:
    """Create a new diagram."""
    diagram_id = uuid.uuid4()
    created_at = datetime.utcnow()
    
    query = """
        INSERT INTO diagrams (id, project_id, diagram_data, version, created_at, updated_at)
        VALUES (:id, :project_id, :diagram_data, :version, :created_at, :updated_at)
        RETURNING id, project_id, diagram_data, version, created_at, updated_at
    """
    
    result = await database.fetch_one(
        query=query,
        values={
            "id": diagram_id,
            "project_id": diagram_create.project_id,
            "diagram_data": json.dumps(diagram_create.diagram_data) if diagram_create.diagram_data else None,
            "version": 1,
            "created_at": created_at,
            "updated_at": created_at
        }
    )
    
    # Parse diagram_data from JSON string if it exists
    diagram_data = None
    if result["diagram_data"]:
        if isinstance(result["diagram_data"], str):
            diagram_data = json.loads(result["diagram_data"])
        else:
            diagram_data = result["diagram_data"]
    
    return Diagram(
        id=str(result["id"]),
        project_id=str(result["project_id"]),
        diagram_data=diagram_data,
        version=result["version"],
        created_at=result["created_at"],
        updated_at=result["updated_at"]
    )

async def get_diagram_by_id(diagram_id: str) -> Optional[Diagram]:
    """Get diagram by ID."""
    query = "SELECT id, project_id, diagram_data, version, created_at, updated_at FROM diagrams WHERE id = :diagram_id"
    result = await database.fetch_one(query=query, values={"diagram_id": diagram_id})
    
    if result:
        # Parse diagram_data from JSON string if it exists
        diagram_data = None
        if result["diagram_data"]:
            if isinstance(result["diagram_data"], str):
                diagram_data = json.loads(result["diagram_data"])
            else:
                diagram_data = result["diagram_data"]
        
        return Diagram(
            id=str(result["id"]),
            project_id=str(result["project_id"]),
            diagram_data=diagram_data,
            version=result["version"],
            created_at=result["created_at"],
            updated_at=result["updated_at"]
        )
    return None

async def get_diagrams_by_project(project_id: str) -> List[Diagram]:
    """Get all diagrams for a project."""
    query = "SELECT id, project_id, diagram_data, version, created_at, updated_at FROM diagrams WHERE project_id = :project_id ORDER BY created_at DESC"
    results = await database.fetch_all(query=query, values={"project_id": project_id})
    
    diagrams = []
    for row in results:
        # Parse diagram_data from JSON string if it exists
        diagram_data = None
        if row["diagram_data"]:
            if isinstance(row["diagram_data"], str):
                diagram_data = json.loads(row["diagram_data"])
            else:
                diagram_data = row["diagram_data"]
        
        diagrams.append(Diagram(
            id=str(row["id"]),
            project_id=str(row["project_id"]),
            diagram_data=diagram_data,
            version=row["version"],
            created_at=row["created_at"],
            updated_at=row["updated_at"]
        ))
    
    return diagrams

async def delete_diagram(diagram_id: str, user_id: str) -> bool:
    """Delete a specific diagram."""
    # First get the diagram to verify ownership
    diagram = await get_diagram_by_id(diagram_id)
    if not diagram:
        return False
    
    # Verify user owns the project
    from projects import verify_project_owner
    if not await verify_project_owner(diagram.project_id, user_id):
        return False
    
    # Delete the diagram
    query = "DELETE FROM diagrams WHERE id = :diagram_id"
    result = await database.execute(query=query, values={"diagram_id": diagram_id})
    
    return result > 0

async def delete_diagrams_by_project(project_id: str) -> int:
    """Delete all diagrams for a project."""
    query = "DELETE FROM diagrams WHERE project_id = :project_id"
    result = await database.execute(query=query, values={"project_id": project_id})
    return result

async def update_diagram(diagram_id: str, diagram_update: DiagramUpdate) -> Optional[Diagram]:
    """Update a diagram."""
    # First get the current version
    current = await get_diagram_by_id(diagram_id)
    if not current:
        return None
    
    new_version = current.version + 1
    updated_at = datetime.utcnow()
    
    query = """
        UPDATE diagrams 
        SET diagram_data = :diagram_data, version = :version, updated_at = :updated_at
        WHERE id = :diagram_id
        RETURNING id, project_id, diagram_data, version, created_at, updated_at
    """
    
    result = await database.fetch_one(
        query=query,
        values={
            "diagram_id": diagram_id,
            "diagram_data": json.dumps(diagram_update.diagram_data) if diagram_update.diagram_data else json.dumps(current.diagram_data),
            "version": new_version,
            "updated_at": updated_at
        }
    )
    
    if result:
        # Parse diagram_data from JSON string if it exists
        diagram_data = None
        if result["diagram_data"]:
            if isinstance(result["diagram_data"], str):
                diagram_data = json.loads(result["diagram_data"])
            else:
                diagram_data = result["diagram_data"]
        
        return Diagram(
            id=str(result["id"]),
            project_id=str(result["project_id"]),
            diagram_data=diagram_data,
            version=result["version"],
            created_at=result["created_at"],
            updated_at=result["updated_at"]
        )
    return None