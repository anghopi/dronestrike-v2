"""
User management endpoints
"""

from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from core.database import get_db
from models.user import User, UserRole
from services.base import BaseService
from api.dependencies import get_current_user, get_current_admin_user

router = APIRouter()


# Pydantic models
class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    first_name: str
    last_name: str
    full_name: str
    role: UserRole
    tokens: int
    mail_tokens: int
    is_active: bool
    is_email_verified: bool
    onboarding_completed: bool


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    preferences: Optional[dict] = None


class UserListResponse(BaseModel):
    users: List[UserResponse]
    total: int
    page: int
    size: int


@router.get("/", response_model=UserListResponse)
def get_users(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    role: Optional[UserRole] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
) -> Any:
    """Get users (admin only)"""
    
    user_service = BaseService(User, db)
    
    # Build filters
    filters = {}
    if role:
        filters["role"] = role
    if is_active is not None:
        filters["is_active"] = is_active
    
    # Get users with pagination
    skip = (page - 1) * size
    users = user_service.get_multi(skip=skip, limit=size, filters=filters)
    total = user_service.count(filters=filters)
    
    # Apply search filter
    if search:
        search_lower = search.lower()
        users = [
            user for user in users 
            if (search_lower in f"{user.first_name} {user.last_name}".lower() or
                search_lower in user.email.lower() or
                search_lower in user.username.lower())
        ]
    
    # Convert to response format
    user_responses = []
    for user in users:
        user_responses.append(UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            full_name=user.full_name,
            role=user.role,
            tokens=user.tokens,
            mail_tokens=user.mail_tokens,
            is_active=user.is_active,
            is_email_verified=user.is_email_verified,
            onboarding_completed=user.onboarding_completed
        ))
    
    return UserListResponse(
        users=user_responses,
        total=total,
        page=page,
        size=size
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get current user profile"""
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        full_name=current_user.full_name,
        role=current_user.role,
        tokens=current_user.tokens,
        mail_tokens=current_user.mail_tokens,
        is_active=current_user.is_active,
        is_email_verified=current_user.is_email_verified,
        onboarding_completed=current_user.onboarding_completed
    )


@router.put("/me", response_model=UserResponse)
def update_current_user(
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Update current user profile"""
    
    user_service = BaseService(User, db)
    
    # Update user
    update_data = user_data.dict(exclude_unset=True)
    if update_data:
        current_user = user_service.update(current_user, update_data)
    
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        full_name=current_user.full_name,
        role=current_user.role,
        tokens=current_user.tokens,
        mail_tokens=current_user.mail_tokens,
        is_active=current_user.is_active,
        is_email_verified=current_user.is_email_verified,
        onboarding_completed=current_user.onboarding_completed
    )


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
) -> Any:
    """Get specific user (admin only)"""
    
    user_service = BaseService(User, db)
    user = user_service.get_or_404(user_id)
    
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        full_name=user.full_name,
        role=user.role,
        tokens=user.tokens,
        mail_tokens=user.mail_tokens,
        is_active=user.is_active,
        is_email_verified=user.is_email_verified,
        onboarding_completed=user.onboarding_completed
    )