"""Authentication pages implementation."""

from typing import Dict, Any, Optional
from pydantic import BaseModel, EmailStr, validator
from sqlalchemy.orm import Session
from fastapi import Request
import re

from .base import BasePage, PageResponse
from models.user import User
from services.auth_service import AuthService


class LoginForm(BaseModel):
    """Login form validation."""
    email: EmailStr
    password: str
    remember_me: Optional[bool] = False
    
    @validator('password')
    def password_must_not_be_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Password is required')
        return v


class SignupForm(BaseModel):
    """Signup form validation."""
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str
    confirm_password: str
    company: Optional[str] = None
    agree_terms: bool = False
    
    @validator('first_name', 'last_name')
    def name_must_not_be_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('This field is required')
        return v.strip()
    
    @validator('phone')
    def validate_phone(cls, v):
        if v and not re.match(r'^\+?1?\d{9,15}$', v):
            raise ValueError('Invalid phone number format')
        return v
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not re.search(r'[A-Za-z]', v):
            raise ValueError('Password must contain at least one letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one number')
        return v
    
    @validator('confirm_password')
    def passwords_match(cls, v, values):
        if 'password' in values and v != values['password']:
            raise ValueError('Passwords do not match')
        return v
    
    @validator('agree_terms')
    def terms_must_be_agreed(cls, v):
        if not v:
            raise ValueError('You must agree to the terms and conditions')
        return v


class PasswordRecoveryForm(BaseModel):
    """Password recovery form validation."""
    email: EmailStr


class ResetPasswordForm(BaseModel):
    """Reset password form validation."""
    token: str
    password: str
    confirm_password: str
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not re.search(r'[A-Za-z]', v):
            raise ValueError('Password must contain at least one letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one number')
        return v
    
    @validator('confirm_password')
    def passwords_match(cls, v, values):
        if 'password' in values and v != values['password']:
            raise ValueError('Passwords do not match')
        return v


class LoginPage(BasePage):
    """Login page implementation."""
    
    def get_page_data(self) -> PageResponse:
        """Get login page data."""
        return self.create_response(data={
            'title': 'Login - DroneStrike',
            'form_fields': {
                'email': '',
                'password': '',
                'remember_me': False
            }
        })
    
    def handle_form_submission(self, form_data: Dict[str, Any]) -> PageResponse:
        """Handle login form submission"""
        # Validate form data
        login_form = self.validate_form_data(LoginForm, form_data)
        if not login_form:
            return self.create_response(success=False)
        
        try:
            # Attempt authentication
            auth_result = self.auth_service.authenticate_user(
                login_form.email, 
                login_form.password
            )
            
            if auth_result['success']:
                # Log successful login
                self.log_activity('user_login', {
                    'email': login_form.email,
                    'remember_me': login_form.remember_me
                })
                
                return self.create_response(
                    success=True,
                    data={
                        'user': auth_result['user'],
                        'token': auth_result['token']
                    },
                    redirect='/dashboard',
                    message='Login successful'
                )
            else:
                self.add_error('Invalid email or password')
                return self.create_response(success=False)
                
        except Exception as e:
            self.add_error('An error occurred during login. Please try again.')
            return self.create_response(success=False)


class SignupPage(BasePage):
    """Signup page implementation."""
    
    def get_page_data(self) -> PageResponse:
        """Get signup page data."""
        return self.create_response(data={
            'title': 'Sign Up - DroneStrike',
            'form_fields': {
                'first_name': '',
                'last_name': '',
                'email': '',
                'phone': '',
                'password': '',
                'confirm_password': '',
                'company': '',
                'agree_terms': False
            }
        })
    
    def handle_form_submission(self, form_data: Dict[str, Any]) -> PageResponse:
        """Handle signup form submission"""
        signup_form = self.validate_form_data(SignupForm, form_data)
        if not signup_form:
            return self.create_response(success=False)
        
        try:
            # Check if user already exists
            existing_user = self.db.query(User).filter(
                User.email == signup_form.email
            ).first()
            
            if existing_user:
                self.add_error('An account with this email already exists')
                return self.create_response(success=False)
            
            # Create new user
            user_data = {
                'first_name': signup_form.first_name,
                'last_name': signup_form.last_name,
                'email': signup_form.email,
                'phone': signup_form.phone,
                'company': signup_form.company,
                'password': signup_form.password
            }
            
            new_user = self.auth_service.create_user(user_data)
            
            if new_user:
                # Send welcome email
                self.send_email(
                    to=new_user.email,
                    subject='Welcome to DroneStrike',
                    body=f'Hello {new_user.first_name}, welcome to DroneStrike!',
                    html=True
                )
                
                # Log account creation
                self.log_activity('user_signup', {
                    'user_id': new_user.id,
                    'email': new_user.email
                })
                
                return self.create_response(
                    success=True,
                    redirect='/login',
                    message='Account created successfully. Please log in.'
                )
            else:
                self.add_error('Failed to create account. Please try again.')
                return self.create_response(success=False)
                
        except Exception as e:
            self.add_error('An error occurred during signup. Please try again.')
            return self.create_response(success=False)


class PasswordRecoveryPage(BasePage):    
    def get_page_data(self) -> PageResponse:
        """Get password recovery page data"""
        return self.create_response(data={
            'title': 'Password Recovery - DroneStrike',
            'form_fields': {
                'email': ''
            }
        })
    
    def handle_form_submission(self, form_data: Dict[str, Any]) -> PageResponse:
        """Handle password recovery form submission"""
        recovery_form = self.validate_form_data(PasswordRecoveryForm, form_data)
        if not recovery_form:
            return self.create_response(success=False)
        
        try:
            # Check if user exists
            user = self.db.query(User).filter(
                User.email == recovery_form.email
            ).first()
            
            if user:
                # Generate reset token
                reset_token = self.auth_service.generate_password_reset_token(user.id)
                
                # Send reset email
                reset_link = f"{self.request.base_url}reset-password?token={reset_token}"
                self.send_email(
                    to=user.email,
                    subject='Password Reset - DroneStrike',
                    body=f'Click here to reset your password: {reset_link}',
                    html=True
                )
                
                # Log password reset request
                self.log_activity('password_reset_request', {
                    'user_id': user.id,
                    'email': user.email
                })
            
            # Always show success message for security
            return self.create_response(
                success=True,
                message='If an account with that email exists, a reset link has been sent.'
            )
            
        except Exception as e:
            self.add_error('An error occurred. Please try again.')
            return self.create_response(success=False)
    
    def handle_password_reset(self, form_data: Dict[str, Any]) -> PageResponse:
        """Handle password reset with token."""
        reset_form = self.validate_form_data(ResetPasswordForm, form_data)
        if not reset_form:
            return self.create_response(success=False)
        
        try:
            # Verify reset token
            user_id = self.auth_service.verify_password_reset_token(reset_form.token)
            
            if not user_id:
                self.add_error('Invalid or expired reset token')
                return self.create_response(success=False)
            
            # Update password
            success = self.auth_service.update_password(user_id, reset_form.password)
            
            if success:
                # Log password reset
                self.log_activity('password_reset_completed', {
                    'user_id': user_id
                })
                
                return self.create_response(
                    success=True,
                    redirect='/login',
                    message='Password reset successfully. Please log in with your new password.'
                )
            else:
                self.add_error('Failed to reset password. Please try again.')
                return self.create_response(success=False)
                
        except Exception as e:
            self.add_error('An error occurred. Please try again.')
            return self.create_response(success=False)