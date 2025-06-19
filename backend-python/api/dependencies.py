"""
FastAPI dependencies for authentication and database access
"""

from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import verify_token, credentials_exception
from models.user import User
from services.auth_service import AuthService

# Security scheme
security = HTTPBearer()

def get_current_user(
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> User:
    """Get current authenticated user"""
    token = credentials.credentials
    user_id = verify_token(token, "access")
    
    if user_id is None:
        raise credentials_exception
    
    auth_service = AuthService(db)
    user = auth_service.get(int(user_id))
    
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    # Update user activity
    auth_service.update_activity(user)
    
    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current active user (alias for compatibility)"""
    return current_user


def get_current_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current user - must be admin"""
    if current_user.role not in ["admin", "five_star_general"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


def get_current_officer_or_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current user - must be officer or admin"""
    if current_user.role not in ["admin", "officer", "five_star_general"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


def get_optional_current_user(
    db: Session = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
) -> Optional[User]:
    """Get current user if authenticated, otherwise None"""
    if not credentials:
        return None
    
    try:
        token = credentials.credentials
        user_id = verify_token(token, "access")
        
        if user_id is None:
            return None
        
        auth_service = AuthService(db)
        user = auth_service.get(int(user_id))
        
        if user and user.is_active:
            auth_service.update_activity(user)
            return user
        
    except Exception:
        pass
    
    return None