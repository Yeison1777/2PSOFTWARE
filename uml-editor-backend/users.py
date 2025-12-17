from typing import Optional
from datetime import datetime
import uuid
from models import UserCreate, UserInDB, User
from auth import get_password_hash, verify_and_maybe_upgrade_password
from database import database

async def get_user_by_email(email: str) -> Optional[UserInDB]:
    """Get user by email."""
    query = "SELECT id, email, username, hashed_password, is_active, created_at FROM users WHERE email = :email"
    result = await database.fetch_one(query=query, values={"email": email})
    
    if result:
        return UserInDB(
            id=str(result["id"]),
            email=result["email"],
            username=result["username"],
            hashed_password=result["hashed_password"],
            is_active=result["is_active"],
            created_at=result["created_at"]
        )
    return None

async def get_user_by_username(username: str) -> Optional[UserInDB]:
    """Get user by username."""
    query = "SELECT id, email, username, hashed_password, is_active, created_at FROM users WHERE username = :username"
    result = await database.fetch_one(query=query, values={"username": username})
    
    if result:
        return UserInDB(
            id=str(result["id"]),
            email=result["email"],
            username=result["username"],
            hashed_password=result["hashed_password"],
            is_active=result["is_active"],
            created_at=result["created_at"]
        )
    return None

async def create_user(user_create: UserCreate) -> UserInDB:
    """Create a new user."""
    # Check if user already exists
    existing_user = await get_user_by_email(user_create.email)
    if existing_user:
        raise ValueError("Email already registered")
    
    existing_user = await get_user_by_username(user_create.username)
    if existing_user:
        raise ValueError("Username already taken")
    
    # Create new user
    user_id = uuid.uuid4()
    hashed_password = get_password_hash(user_create.password)
    created_at = datetime.utcnow()
    
    query = """
        INSERT INTO users (id, email, username, hashed_password, is_active, created_at)
        VALUES (:id, :email, :username, :hashed_password, :is_active, :created_at)
        RETURNING id, email, username, hashed_password, is_active, created_at
    """
    
    result = await database.fetch_one(
        query=query,
        values={
            "id": user_id,
            "email": user_create.email,
            "username": user_create.username,
            "hashed_password": hashed_password,
            "is_active": True,
            "created_at": created_at
        }
    )
    
    return UserInDB(
        id=str(result["id"]),
        email=result["email"],
        username=result["username"],
        hashed_password=result["hashed_password"],
        is_active=result["is_active"],
        created_at=result["created_at"]
    )

async def authenticate_user(email: str, password: str) -> Optional[UserInDB]:
    """Authenticate a user with email and password."""
    try:
        # Single database query with password verification
        query = "SELECT id, email, username, hashed_password, is_active, created_at FROM users WHERE email = :email AND is_active = true"
        result = await database.fetch_one(query=query, values={"email": email})
        
        if not result:
            return None
        
        # Verify password immediately
        valid, upgraded_hash = verify_and_maybe_upgrade_password(password, result["hashed_password"])
        if not valid:
            return None

        # If legacy hash was used, upgrade to bcrypt transparently
        if upgraded_hash:
            try:
                await database.execute(
                    query="UPDATE users SET hashed_password = :hashed_password WHERE id = :id",
                    values={"hashed_password": upgraded_hash, "id": result["id"]},
                )
                result = dict(result)
                result["hashed_password"] = upgraded_hash
            except Exception:
                # Don't fail login if upgrade fails
                pass
        
        # Return user object
        return UserInDB(
            id=str(result["id"]),
            email=result["email"],
            username=result["username"],
            hashed_password=result["hashed_password"],
            is_active=result["is_active"],
            created_at=result["created_at"]
        )
    except Exception:
        return None

def user_to_dict(user: UserInDB) -> User:
    """Convert UserInDB to User (without password)."""
    return User(
        id=user.id,
        email=user.email,
        username=user.username,
        created_at=user.created_at,
        is_active=user.is_active
    )