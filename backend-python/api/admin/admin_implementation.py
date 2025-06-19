# Admin API endpoints

from typing import Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, validator
from datetime import datetime, date
from enum import Enum

from core.database import get_db
from models.user import User, UserRole
from api.dependencies import get_current_admin_user

router = APIRouter()


# Enums
class SystemStatus(str, Enum):
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"


# Pydantic models
class UserCreateAdmin(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    role: UserRole
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        return v


# User management endpoints
@router.post("/users")
async def create_user_admin(
    user_data: UserCreateAdmin,
    request: Request,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
) -> Any:
    """Create a new user (admin only)"""
    try:
        # Mock implementation
        return {
            "id": 1,
            "email": user_data.email,
            "first_name": user_data.first_name,
            "last_name": user_data.last_name,
            "role": user_data.role,
            "is_active": True,
            "created_by_admin": current_admin.id,
            "created_at": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {str(e)}"
        )


@router.get("/users")
async def get_all_users(
    request: Request,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200)
) -> Any:
    """Get all users (admin only)"""
    try:
        # Mock implementation
        return {
            "users": [
                {
                    "id": 1,
                    "email": "user@example.com",
                    "first_name": "John",
                    "last_name": "Doe",
                    "role": UserRole.USER,
                    "is_active": True,
                    "created_at": datetime.now().isoformat()
                }
            ],
            "total": 1,
            "page": page,
            "limit": limit
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch users: {str(e)}"
        )


@router.get("/stats/overview")
async def get_system_stats(
    request: Request,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
) -> Any:
    """Get system overview statistics (admin only)"""
    try:
        # Mock implementation
        return {
            "total_users": 100,
            "active_users": 85,
            "new_users_today": 5,
            "new_users_week": 20,
            "total_missions": 50,
            "active_missions": 25,
            "total_opportunities": 75,
            "total_revenue": 500000.0,
            "system_status": SystemStatus.HEALTHY,
            "uptime": "99.9%"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch system stats: {str(e)}"
        )