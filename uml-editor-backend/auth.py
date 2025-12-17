import os
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Union
from jose import JWTError, jwt
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Request
from models import TokenData, UserInDB
from dotenv import load_dotenv
from passlib.context import CryptContext

# Load environment variables
load_dotenv()

# Configuration from environment variables
ENVIRONMENT = os.getenv("ENVIRONMENT", os.getenv("NODE_ENV", "development")).lower()
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY:
    # In production this MUST be set.
    if ENVIRONMENT in ("production", "prod"):
        raise RuntimeError("JWT_SECRET_KEY is required in production")
    # Dev fallback only
    SECRET_KEY = "dev-only-secret-key"
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# Token security
security = HTTPBearer()
# Optional token security for endpoints that may allow anonymous access (share links)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password. Supports bcrypt (preferred) and legacy SHA-256 hashes."""
    try:
        if not hashed_password:
            return False
        # bcrypt hashes start with $2 (common prefixes: $2a$, $2b$, $2y$)
        if hashed_password.startswith("$2"):
            return pwd_context.verify(plain_password, hashed_password)
        # legacy SHA-256 hex
        return hashlib.sha256(plain_password.encode("utf-8")).hexdigest() == hashed_password
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt."""
    try:
        return pwd_context.hash(password)
    except Exception:
        # Fallback for environments where bcrypt native deps are unavailable.
        # We support verifying legacy SHA-256 hashes in `verify_password`.
        return hashlib.sha256(password.encode("utf-8")).hexdigest()

def needs_password_rehash(stored_hash: str) -> bool:
    """Return True if stored hash is legacy or needs upgrading."""
    try:
        if not stored_hash:
            return True
        if stored_hash.startswith("$2"):
            return pwd_context.needs_update(stored_hash)
        # Anything else we treat as legacy
        return True
    except Exception:
        return True

def verify_and_maybe_upgrade_password(plain_password: str, stored_hash: str) -> tuple[bool, Optional[str]]:
    """Verify password and return (valid, upgraded_hash_if_needed)."""
    valid = verify_password(plain_password, stored_hash)
    if not valid:
        return False, None
    if needs_password_rehash(stored_hash):
        return True, get_password_hash(plain_password)
    return True, None

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Optional[str]:
    """Verify a JWT token and return the email if valid."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            return None
        return email
    except JWTError:
        return None

async def get_current_user_email(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Get current user email from JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    email = verify_token(credentials.credentials)
    if email is None:
        raise credentials_exception
    
    return email


async def get_current_user_email_optional(request: Request) -> Optional[str]:
    """Optional variant: returns email string if Authorization: Bearer <token> present and valid; otherwise None.
    Returns None if no token is sent, but raises 401 if token is invalid/expired."""
    auth_header = request.headers.get('authorization') or request.headers.get('Authorization')
    if not auth_header:
        return None
    parts = auth_header.split()
    if len(parts) != 2:
        return None
    scheme, token = parts
    if scheme.lower() != 'bearer':
        return None
    email = verify_token(token)
    # If token was sent but is invalid, return None (let endpoint decide if 401 is appropriate)
    # This allows endpoints to check for share tokens before returning 401
    return email