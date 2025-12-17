from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any
from datetime import datetime

# User models
class UserBase(BaseModel):
    email: str
    username: str

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class User(UserBase):
    id: str
    created_at: datetime
    is_active: bool = True

class UserInDB(User):
    hashed_password: str

# Token models
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    email: Optional[str] = None

# Project models
class ProjectBase(BaseModel):
    name: str

class ProjectCreate(ProjectBase):
    pass

class Project(ProjectBase):
    id: str
    owner_id: str
    created_at: datetime
    updated_at: datetime

# Diagram models
class DiagramBase(BaseModel):
    diagram_data: Optional[Dict[str, Any]] = None

class DiagramCreate(DiagramBase):
    project_id: str

class DiagramUpdate(DiagramBase):
    pass

class Diagram(DiagramBase):
    id: str
    project_id: str
    version: int
    created_at: datetime
    updated_at: datetime