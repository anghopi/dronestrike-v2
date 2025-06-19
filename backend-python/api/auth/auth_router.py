# Authentication endpoints

from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, validator
import re

from core.database import get_db
from models.user import User, UserRole
from services.auth_service import AuthService
from api.dependencies import get_current_user, get_optional_current_user
from pages.auth import LoginPage, SignupPage, PasswordRecoveryPage

router = APIRouter()

# Pydantic models for request/response
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    username: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    role: UserRole = UserRole.USER
    referral_code: Optional[str] = None
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one digit')
        return v
    
    @validator('phone')
    def validate_phone(cls, v):
        if v and not re.match(r'^\+?1?\d{9,15}$', v):
            raise ValueError('Invalid phone number format')
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str
    remember_me: Optional[bool] = False


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int
    user: dict


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    
    @validator('new_password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one digit')
        return v


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
    
    @validator('new_password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        return v


class EmailVerificationRequest(BaseModel):
    token: str


class TwoFactorSetupResponse(BaseModel):
    qr_code: str
    secret: str
    recovery_codes: list[str]


class TwoFactorVerifyRequest(BaseModel):
    code: str


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
    is_2fa_enabled: bool
    last_login: Optional[str] = None
    created_at: str


# Authentication endpoints
@router.post("/register", response_model=TokenResponse)
async def register(
    user_data: UserCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
) -> Any:
    """Register a new user"""
    auth_page = AuthPage(db, request)
    
    try:
        form_data = user_data.dict()
        response = await auth_page.handle_signup(form_data, background_tasks)
        
        if not response.success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=response.errors[0] if response.errors else "Registration failed"
            )
        
        return response.data
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )


@router.post("/login", response_model=TokenResponse)
async def login(
    user_data: UserLogin,
    request: Request,
    db: Session = Depends(get_db)
) -> Any:
    """Login user with email and password"""
    auth_page = AuthPage(db, request)
    
    try:
        form_data = user_data.dict()
        response = await auth_page.handle_login(form_data)
        
        if not response.success:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=response.errors[0] if response.errors else "Invalid credentials"
            )
        
        return response.data
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )


@router.post("/login/token", response_model=TokenResponse)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
) -> Any:
    """Login using OAuth2 password flow (for compatibility)"""
    auth_service = AuthService(db)
    return auth_service.login_user(form_data.username, form_data.password)


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    token_data: RefreshTokenRequest,
    db: Session = Depends(get_db)
) -> Any:
    """Refresh access token"""
    auth_service = AuthService(db)
    return auth_service.refresh_token(token_data.refresh_token)


@router.post("/forgot-password")
async def forgot_password(
    request_data: ForgotPasswordRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
) -> Any:
    """Send password reset email"""
    auth_page = AuthPage(db, request)
    
    try:
        response = await auth_page.handle_forgot_password(
            {"email": request_data.email}, 
            background_tasks
        )
        
        # Always return success to prevent email enumeration
        return {"message": "If email exists, password reset instructions have been sent"}
        
    except Exception:
        # Always return success to prevent email enumeration
        return {"message": "If email exists, password reset instructions have been sent"}


@router.post("/reset-password")
async def reset_password(
    reset_data: ResetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db)
) -> Any:
    """Reset password with token"""
    auth_page = AuthPage(db, request)
    
    try:
        form_data = reset_data.dict()
        response = await auth_page.handle_reset_password(form_data)
        
        if not response.success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=response.errors[0] if response.errors else "Invalid or expired token"
            )
        
        return {"message": "Password reset successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Password reset failed: {str(e)}"
        )


@router.post("/verify-email")
def verify_email_with_token(
    verification_data: EmailVerificationRequest,
    db: Session = Depends(get_db)
) -> Any:
    """Verify email with token"""
    auth_service = AuthService(db)
    
    try:
        auth_service.verify_email_with_token(verification_data.token)
        return {"message": "Email verified successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )


@router.post("/resend-verification")
async def resend_verification_email(
    current_user: User = Depends(get_current_user),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db)
) -> Any:
    """Resend email verification"""
    if current_user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already verified"
        )
    
    auth_service = AuthService(db)
    auth_service.send_verification_email(current_user, background_tasks)
    return {"message": "Verification email sent"}


# User profile endpoints
@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get current user information"""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "tokens": current_user.tokens,
        "mail_tokens": current_user.mail_tokens,
        "is_active": current_user.is_active,
        "is_email_verified": current_user.is_email_verified,
        "is_2fa_enabled": getattr(current_user, 'is_2fa_enabled', False),
        "last_login": current_user.last_login.isoformat() if hasattr(current_user, 'last_login') and current_user.last_login else None,
        "created_at": current_user.created_at.isoformat() if hasattr(current_user, 'created_at') else None
    }


@router.post("/change-password")
def change_password(
    password_data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Change current user password"""
    auth_service = AuthService(db)
    
    try:
        auth_service.change_password(
            current_user,
            password_data.current_password,
            password_data.new_password
        )
        return {"message": "Password changed successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# Two-Factor Authentication endpoints
@router.post("/2fa/setup", response_model=TwoFactorSetupResponse)
def setup_2fa(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Setup two-factor authentication"""
    auth_service = AuthService(db)
    
    try:
        setup_data = auth_service.setup_2fa(current_user)
        return setup_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to setup 2FA: {str(e)}"
        )


@router.post("/2fa/verify")
def verify_2fa(
    verify_data: TwoFactorVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Verify and enable two-factor authentication"""
    auth_service = AuthService(db)
    
    try:
        if auth_service.verify_2fa_code(current_user, verify_data.code):
            auth_service.enable_2fa(current_user)
            return {"message": "Two-factor authentication enabled successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify 2FA: {str(e)}"
        )


@router.post("/2fa/disable")
def disable_2fa(
    verify_data: TwoFactorVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Disable two-factor authentication"""
    auth_service = AuthService(db)
    
    try:
        if auth_service.verify_2fa_code(current_user, verify_data.code):
            auth_service.disable_2fa(current_user)
            return {"message": "Two-factor authentication disabled successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to disable 2FA: {str(e)}"
        )


@router.post("/logout")
def logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Logout user"""
    auth_service = AuthService(db)
    auth_service.logout_user(current_user)
    return {"message": "Logged out successfully"}


@router.post("/logout-all")
def logout_all_devices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Logout user from all devices"""
    auth_service = AuthService(db)
    auth_service.logout_all_devices(current_user)
    return {"message": "Logged out from all devices successfully"}