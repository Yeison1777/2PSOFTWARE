from typing import List, Optional
from datetime import datetime
import uuid
from models import ProjectCreate, Project
from database import database

async def create_project(project_create: ProjectCreate, owner_id: str) -> Project:
    """Create a new project."""
    project_id = uuid.uuid4()
    created_at = datetime.utcnow()
    
    query = """
        INSERT INTO projects (id, name, owner_id, created_at, updated_at)
        VALUES (:id, :name, :owner_id, :created_at, :updated_at)
        RETURNING id, name, owner_id, created_at, updated_at
    """
    
    result = await database.fetch_one(
        query=query,
        values={
            "id": project_id,
            "name": project_create.name,
            "owner_id": owner_id,
            "created_at": created_at,
            "updated_at": created_at
        }
    )
    
    return Project(
        id=str(result["id"]),
        name=result["name"],
        owner_id=str(result["owner_id"]),
        created_at=result["created_at"],
        updated_at=result["updated_at"]
    )

async def get_project_by_id(project_id: str) -> Optional[Project]:
    """Get project by ID."""
    query = "SELECT id, name, owner_id, created_at, updated_at FROM projects WHERE id = :project_id"
    result = await database.fetch_one(query=query, values={"project_id": project_id})
    
    if result:
        return Project(
            id=str(result["id"]),
            name=result["name"],
            owner_id=str(result["owner_id"]),
            created_at=result["created_at"],
            updated_at=result["updated_at"]
        )
    return None

async def get_projects_by_owner(owner_id: str) -> List[Project]:
    """Get all projects owned by a user."""
    query = "SELECT id, name, owner_id, created_at, updated_at FROM projects WHERE owner_id = :owner_id ORDER BY created_at DESC"
    results = await database.fetch_all(query=query, values={"owner_id": owner_id})
    
    return [
        Project(
            id=str(row["id"]),
            name=row["name"],
            owner_id=str(row["owner_id"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"]
        )
        for row in results
    ]

async def verify_project_owner(project_id: str, user_id: str) -> bool:
    """Verify if a user owns a project."""
    project = await get_project_by_id(project_id)
    return project is not None and project.owner_id == user_id

async def delete_project(project_id: str, user_id: str) -> bool:
    """Delete a project and all its diagrams."""
    # First verify ownership
    if not await verify_project_owner(project_id, user_id):
        return False
    
    # Delete all diagrams first (cascade delete)
    from diagrams import delete_diagrams_by_project
    await delete_diagrams_by_project(project_id)
    
    # Delete the project
    query = "DELETE FROM projects WHERE id = :project_id"
    result = await database.execute(query=query, values={"project_id": project_id})
    
    return result > 0

async def create_project_with_default_diagram(project_create: ProjectCreate, owner_id: str) -> Project:
    """Create a new project with a default diagram."""
    # Create the project first
    project = await create_project(project_create, owner_id)
    
    # Create a default diagram for the project
    from diagrams import create_diagram
    from models import DiagramCreate
    
    default_diagram_data = {
        "classes": [],
        "associations": [],
        "metadata": {
            "created": "auto",
            "description": "Default diagram for project"
        }
    }
    
    default_diagram = DiagramCreate(
        project_id=project.id,
        diagram_data=default_diagram_data
    )
    
    await create_diagram(default_diagram)
    
    return project