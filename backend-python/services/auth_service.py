"""
Authentication and user management service
"""

from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from datetime import datetime, timedelta

from core.security import verify_password, get_password_hash, create_access_token, create_refresh_token
from core.config import settings
from models.user import User, UserRole
from .base import BaseService


class AuthService(BaseService[User]):
    """Authentication service"""
    
    def __init__(self, db: Session):
        super().__init__(User, db)
    
    def authenticate_user(self, email: str, password: str) -> Optional[User]:
        """Authenticate user with email and password"""
        user = self.db.query(User).filter(User.email == email.lower()).first()
        
        if not user:
            return None
            
        if not verify_password(password, user.password_hash):
            return None
            
        if not user.is_active:
            return None
            
        return user
    
    def create_user(
        self,
        email: str,
        password: str,
        first_name: str,
        last_name: str,
        username: str = None,
        role: UserRole = UserRole.USER,
        **kwargs
    ) -> User:
        """Create a new user"""
        # Check if email already exists
        if self.db.query(User).filter(User.email == email.lower()).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Generate username if not provided
        if not username:
            username = email.split('@')[0]
            # Ensure username is unique
            counter = 1
            base_username = username
            while self.db.query(User).filter(User.username == username).first():
                username = f"{base_username}{counter}"
                counter += 1
        
        # Check if username already exists
        if self.db.query(User).filter(User.username == username).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
        
        # Create user
        user_data = {
            "email": email.lower(),
            "username": username,
            "password_hash": get_password_hash(password),
            "first_name": first_name,
            "last_name": last_name,
            "role": role,
            "tokens": settings.DEFAULT_TOKENS,
            **kwargs
        }
        
        return self.create(user_data)
    
    def login_user(self, email: str, password: str) -> dict:
        """Login user and return tokens"""
        user = self.authenticate_user(email, password)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Update last login
        self.update(user, {
            "last_login": datetime.utcnow(),
            "last_activity": datetime.utcnow()
        })
        
        # Create tokens
        access_token = create_access_token(subject=user.id)
        refresh_token = create_refresh_token(subject=user.id)
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": self._user_to_dict(user)
        }
    
    def refresh_token(self, refresh_token: str) -> dict:
        """Refresh access token"""
        from core.security import verify_token
        
        user_id = verify_token(refresh_token, "refresh")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        user = self.get(int(user_id))
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )
        
        # Update activity
        self.update(user, {"last_activity": datetime.utcnow()})
        
        # Create new tokens
        access_token = create_access_token(subject=user.id)
        new_refresh_token = create_refresh_token(subject=user.id)
        
        return {
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
            "user": self._user_to_dict(user)
        }
    
    def change_password(self, user: User, current_password: str, new_password: str) -> User:
        """Change user password"""
        if not verify_password(current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )
        
        return self.update(user, {
            "password_hash": get_password_hash(new_password)
        })
    
    def verify_email(self, user: User) -> User:
        """Mark user email as verified"""
        return self.update(user, {"is_email_verified": True})
    
    def update_activity(self, user: User) -> User:
        """Update user last activity"""
        return self.update(user, {"last_activity": datetime.utcnow()})
    
    def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email"""
        return self.db.query(User).filter(User.email == email.lower()).first()
    
    def get_user_by_username(self, username: str) -> Optional[User]:
        """Get user by username"""
        return self.db.query(User).filter(User.username == username).first()
    
    def _user_to_dict(self, user: User) -> dict:
        """Convert user to dictionary (without sensitive data)"""
        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "full_name": user.full_name,
            "role": user.role,
            "tokens": user.tokens,
            "mail_tokens": user.mail_tokens,
            "is_active": user.is_active,
            "is_email_verified": user.is_email_verified,
            "onboarding_completed": user.onboarding_completed,
            "created_at": user.created_at,
            "last_login": user.last_login
        }