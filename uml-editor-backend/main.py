from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from datetime import timedelta
import json
import uuid
import asyncio

# Import our models and functions
from models import UserCreate, UserLogin, Token, User, ProjectCreate, Project, DiagramCreate, DiagramUpdate, Diagram
from auth import create_access_token, get_current_user_email, get_current_user_email_optional, ACCESS_TOKEN_EXPIRE_MINUTES
from users import create_user, authenticate_user, get_user_by_email, user_to_dict
from projects import create_project, get_projects_by_owner, get_project_by_id, verify_project_owner, create_project_with_default_diagram, delete_project
from diagrams import create_diagram, get_diagrams_by_project, get_diagram_by_id, update_diagram, delete_diagram
from database import connect_db, disconnect_db
from shares import create_share, get_share_by_token
from realtime_manager import add_listener, remove_listener, broadcast_update, get_last_update_time

# Lifespan event handler
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_db()
    yield
    # Shutdown
    await disconnect_db()

# Create FastAPI instance with lifespan
app = FastAPI(
    title="UML Editor Backend",
    description="Backend API for UML Editor application",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS (production-safe)
# Set CORS_ORIGINS as a comma-separated list, e.g.:
#   CORS_ORIGINS=https://your-frontend.com,https://www.your-frontend.com
import os
cors_origins_raw = os.getenv("CORS_ORIGINS", "http://localhost:3000")
cors_origins = [o.strip() for o in cors_origins_raw.split(",") if o.strip()]

# NOTE: allow_credentials cannot be used with wildcard origins.
allow_credentials = True
if "*" in cors_origins:
    allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root endpoint
@app.get("/")
async def read_root():
    return {"message": "Welcome to UML Editor Backend API"}

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "API is running successfully"}

# API info endpoint
@app.get("/info")
async def get_info():
    return {
        "title": "UML Editor Backend",
        "version": "1.0.0",
        "description": "Backend API for UML Editor application"
    }

# Authentication endpoints
@app.post("/register", response_model=dict)
async def register_user(user: UserCreate):
    """Register a new user."""
    try:
        new_user = await create_user(user)
        return {
            "message": "User registered successfully",
            "user": user_to_dict(new_user)
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@app.post("/login", response_model=Token)
async def login_user(user_credentials: UserLogin):
    """Login user and return access token."""
    try:
        user = await authenticate_user(user_credentials.email, user_credentials.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Create token immediately without additional database calls
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.email}, expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during login"
        )

@app.get("/me", response_model=User)
async def get_current_user(current_user_email: str = Depends(get_current_user_email)):
    """Get current user information."""
    user = await get_user_by_email(current_user_email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user_to_dict(user)

# Project endpoints
@app.post("/projects", response_model=Project)
async def create_new_project(
    project: ProjectCreate,
    current_user_email: str = Depends(get_current_user_email)
):
    """Create a new project with a default diagram."""
    try:
        user = await get_user_by_email(current_user_email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        result = await create_project_with_default_diagram(project, user.id)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating project: {str(e)}"
        )

@app.get("/projects", response_model=list[Project])
async def get_user_projects(current_user_email: str = Depends(get_current_user_email)):
    """Get all projects for the current user."""
    user = await get_user_by_email(current_user_email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return await get_projects_by_owner(user.id)

@app.get("/projects/{project_id}", response_model=Project)
async def get_project(
    project_id: str,
    current_user_email: str = Depends(get_current_user_email)
):
    """Get a specific project - users can only access their own projects."""
    user = await get_user_by_email(current_user_email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    project = await get_project_by_id(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Verificar que el usuario es propietario del proyecto
    is_owner = await verify_project_owner(project_id, user.id)
    if not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You don't own this project"
        )
    
    return project

@app.delete("/projects/{project_id}")
async def delete_project_endpoint(
    project_id: str,
    current_user_email: str = Depends(get_current_user_email)
):
    """Delete a project and all its diagrams."""
    user = await get_user_by_email(current_user_email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    success = await delete_project(project_id, user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied"
        )
    
    return {"message": "Project deleted successfully"}

# Diagram endpoints
@app.post("/diagrams", response_model=Diagram)
async def create_new_diagram(
    diagram: DiagramCreate,
    current_user_email: str = Depends(get_current_user_email)
):
    """Create a new diagram - users can only create diagrams in their own projects."""
    user = await get_user_by_email(current_user_email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # CRITICAL: Verify that the user owns the project before creating diagram
    is_owner = await verify_project_owner(diagram.project_id, user.id)
    if not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You don't own this project"
        )

    result = await create_diagram(diagram)
    return result


# Shares endpoints
@app.post("/shares")
async def create_new_share(
    payload: dict,
    current_user_email: str = Depends(get_current_user_email)
):
    """Create a persistent share token for a diagram.
    payload: { token?: string, diagram_id: string, expires_hours?: int }
    """
    user = await get_user_by_email(current_user_email)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    token = payload.get('token') or (str(uuid.uuid4()).replace('-', '')[:8].upper())
    diagram_id = payload.get('diagram_id')
    expires_hours = payload.get('expires_hours')

    if not diagram_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="diagram_id is required")

    # Get current diagram data to snapshot
    diagram = await get_diagram_by_id(diagram_id)
    diagram_data = diagram.diagram_data if diagram else None

    share = await create_share(token, diagram_id, user.id, diagram_data, expires_hours or 24)
    if not share:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create share")

    return share


@app.get("/shares/{token}")
async def get_share(token: str):
    share = await get_share_by_token(token)
    if not share:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share token not found or expired")
    return share

@app.get("/projects/{project_id}/diagrams", response_model=list[Diagram])
async def get_project_diagrams(
    project_id: str,
    current_user_email: str = Depends(get_current_user_email)
):
    """Get all diagrams for a project - users can access their own projects."""
    user = await get_user_by_email(current_user_email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Verificar si el usuario es propietario del proyecto
    is_owner = await verify_project_owner(project_id, user.id)
    
    if not is_owner:
        # Si no es propietario, devolver lista vacía (no error 403)
        return []
    
    return await get_diagrams_by_project(project_id)

@app.get("/diagrams/{diagram_id}", response_model=Diagram)
async def get_diagram(
    diagram_id: str,
    request: Request,
    current_user_email: str | None = Depends(get_current_user_email_optional)
):
    """Get a specific diagram - users can access their own diagrams or shared ones."""
    # Check if token was sent but is invalid
    auth_header = request.headers.get('authorization') or request.headers.get('Authorization')
    token_was_sent = bool(auth_header)
    token_is_valid = bool(current_user_email)
    
    user = None
    if current_user_email:
        user = await get_user_by_email(current_user_email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
    
    # Resolve possible share token (clients may send "shared-<token>" or just the token)
    async def _resolve_diagram_id(maybe_id: str) -> str | None:
        import uuid as _uuid
        # If it's a valid UUID, return as-is
        try:
            _uuid.UUID(maybe_id)
            return maybe_id
        except Exception:
            # Strip common prefix if present and try to load a share
            token = maybe_id
            if token.startswith("shared-"):
                token = token[len("shared-"):]
            share = await get_share_by_token(token)
            if not share:
                return None
            return share.get("diagram_id")

    resolved_id = await _resolve_diagram_id(diagram_id)
    if not resolved_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diagram not found")

    diagram = await get_diagram_by_id(resolved_id)
    if not diagram:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diagram not found"
        )
    
    # CRITICAL: Verify ownership or valid share token
    if user:
        is_owner = await verify_project_owner(diagram.project_id, user.id)
        
        # Si no es propietario, verificar si hay un share token válido
        if not is_owner:
            # Check if this is a share token access (diagram_id starts with "shared-")
            token_candidate = diagram_id
            if token_candidate.startswith("shared-"):
                token_candidate = token_candidate[len("shared-"):]
                share = await get_share_by_token(token_candidate)
                if share and share.get('diagram_id') == resolved_id:
                    # Valid share token for this diagram, allow access
                    return diagram
            # No valid share token and not owner -> deny access
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You don't own this diagram and no valid share token found"
            )
    else:
        # No authenticated user: check if token was sent but invalid
        if token_was_sent and not token_is_valid:
            # Token was sent but is invalid/expired - return 401 immediately
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # No token sent: must have valid share token
        token_candidate = diagram_id
        if token_candidate.startswith("shared-"):
            token_candidate = token_candidate[len("shared-"):]
        share = await get_share_by_token(token_candidate)
        if not share or share.get('diagram_id') != resolved_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized: Authentication required or valid share token"
            )
    
    return diagram

@app.put("/diagrams/{diagram_id}", response_model=Diagram)
async def update_existing_diagram(
    diagram_id: str,
    diagram_update: DiagramUpdate,
    current_user_email: str | None = Depends(get_current_user_email_optional)
):
    """Update a diagram - users can edit their own diagrams or shared ones."""
    user = None
    if current_user_email:
        user = await get_user_by_email(current_user_email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
    
    # Resolve possible share token to a real diagram UUID
    async def _resolve_diagram_id(maybe_id: str) -> str | None:
        import uuid as _uuid
        try:
            _uuid.UUID(maybe_id)
            return maybe_id
        except Exception:
            token = maybe_id
            if token.startswith("shared-"):
                token = token[len("shared-"):]
            share = await get_share_by_token(token)
            if not share:
                return None
            return share.get("diagram_id")

    resolved_id = await _resolve_diagram_id(diagram_id)
    if not resolved_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diagram not found")

    # Get the diagram to verify ownership
    diagram = await get_diagram_by_id(resolved_id)
    if not diagram:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diagram not found"
        )
    
    # CRITICAL: Verify ownership or valid share token before allowing update
    if user:
        is_owner = await verify_project_owner(diagram.project_id, user.id)
        if not is_owner:
            # Not owner: check if there's a valid share token
            token_candidate = diagram_id
            if token_candidate.startswith('shared-'):
                token_candidate = token_candidate[len('shared-'):]
            share = await get_share_by_token(token_candidate)
            if not share:
                # No share token and not owner -> deny
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You don't own this diagram and no valid share token"
                )
    else:
        # No authenticated user: must have valid share token
        token_candidate = diagram_id
        if token_candidate.startswith('shared-'):
            token_candidate = token_candidate[len('shared-'):]
        share = await get_share_by_token(token_candidate)
        if not share:
            # No auth and not a valid share -> unauthorized
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized: no valid token or share")
    
    updated_diagram = await update_diagram(resolved_id, diagram_update)
    if not updated_diagram:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update diagram"
        )
    
    # Broadcast update to all listeners
    user_id = str(user.id) if user else None
    await broadcast_update(resolved_id, updated_diagram.diagram_data, user_id)
    
    return updated_diagram

@app.delete("/diagrams/{diagram_id}")
async def delete_diagram_endpoint(
    diagram_id: str,
    current_user_email: str | None = Depends(get_current_user_email_optional)
):
    """Delete a diagram."""
    user = None
    if current_user_email:
        user = await get_user_by_email(current_user_email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
    
    # Resolve share tokens to the underlying diagram id if necessary
    async def _resolve_diagram_id(maybe_id: str) -> str | None:
        import uuid as _uuid
        try:
            _uuid.UUID(maybe_id)
            return maybe_id
        except Exception:
            token = maybe_id
            if token.startswith("shared-"):
                token = token[len("shared-"):]
            share = await get_share_by_token(token)
            if not share:
                return None
            return share.get("diagram_id")

    resolved_id = await _resolve_diagram_id(diagram_id)
    if not resolved_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diagram not found")

    if user:
        success = await delete_diagram(resolved_id, user.id)
    else:
        # If no user, only allow delete if share exists and owner matches (or we disallow delete via share)
        token_candidate = diagram_id
        if token_candidate.startswith('shared-'):
            token_candidate = token_candidate[len('shared-'):]
        share = await get_share_by_token(token_candidate)
        # For safety, disallow deletions through share links
        if share:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete diagram via share link")
        # No share and no user -> unauthorized
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diagram not found or access denied"
        )
    
    return {"message": "Diagram deleted successfully"}

# Server-Sent Events endpoint for real-time updates
@app.get("/diagrams/{diagram_id}/stream")
async def stream_diagram_updates(
    diagram_id: str,
    request: Request
):
    """
    Stream real-time updates for a diagram using Server-Sent Events (SSE).
    Clients connect to this endpoint to receive updates when the diagram changes.
    """
    # Resolve share token if needed
    async def _resolve_diagram_id(maybe_id: str) -> str | None:
        import uuid as _uuid
        try:
            _uuid.UUID(maybe_id)
            return maybe_id
        except Exception:
            token = maybe_id
            if token.startswith("shared-"):
                token = token[len("shared-"):]
            share = await get_share_by_token(token)
            if not share:
                return None
            return share.get("diagram_id")
    
    # First try to resolve the diagram ID
    resolved_id = await _resolve_diagram_id(diagram_id)
    
    # If resolution failed, check if it's a valid UUID (might be a real diagram ID)
    if not resolved_id:
        import uuid as _uuid
        try:
            # Try to validate as UUID
            _uuid.UUID(diagram_id)
            resolved_id = diagram_id
        except Exception:
            # Not a valid UUID and not a share token - return 404
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diagram not found")
    
    # Verify diagram exists
    diagram = await get_diagram_by_id(resolved_id)
    if not diagram:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diagram not found")
    
    # Try to get token from query param (EventSource doesn't support custom headers)
    token = request.query_params.get("token")
    if token:
        # Verify token if provided
        from auth import verify_token
        email = verify_token(token)
        if email:
            user = await get_user_by_email(email)
            # User is authenticated, allow access
        # If token is invalid, still allow (for share tokens)
    
    # Create a queue for this connection
    queue = asyncio.Queue()
    
    async def event_generator():
        try:
            # Add this connection to listeners using the RESOLVED diagram_id (real UUID)
            # This ensures all users (whether using share token or direct ID) connect to the same stream
            await add_listener(resolved_id, queue)
            
            # Send initial connection message with resolved ID
            yield f"data: {json.dumps({'type': 'connected', 'diagram_id': resolved_id, 'original_id': diagram_id})}\n\n"
            
            # Keep connection alive and send updates
            while True:
                try:
                    # Wait for update with timeout to send keepalive
                    try:
                        message = await asyncio.wait_for(queue.get(), timeout=30.0)
                        yield f"data: {message}\n\n"
                    except asyncio.TimeoutError:
                        # Send keepalive ping
                        yield f": keepalive\n\n"
                        continue
                        
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    # Send error and break
                    yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                    break
                    
        finally:
            # Remove listener when connection closes
            await remove_listener(resolved_id, queue)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable buffering in nginx
        }
    )

if __name__ == "__main__":
    import uvicorn
    import os

    # Use PORT from environment (Railway provides this) or default to 8000
    port = int(os.getenv("PORT", 8000))

    # Run FastAPI app
    uvicorn.run(app, host="0.0.0.0", port=port)

# Backwards-compatible export for platforms/configs that expect `asgi_app`
asgi_app = app