"""Base page class for all DroneStrike pages"""

import os
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from fastapi import HTTPException, Request, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel, ValidationError

from core.database import get_db
from services.auth_service import AuthService


class PageResponse(BaseModel):
    """Standard page response model."""
    success: bool
    data: Optional[Dict[str, Any]] = None
    errors: Optional[List[str]] = None
    redirect: Optional[str] = None
    message: Optional[str] = None


class BasePage(ABC):
    """Base class for all page implementations."""
    
    def __init__(self, db: Session, request: Request, current_user: Optional[Dict] = None):
        self.db = db
        self.request = request
        self.current_user = current_user
        self.auth_service = AuthService(db)
        self.errors: List[str] = []
        self.messages: List[str] = []
    
    def add_error(self, error: str):
        """Add an error message"""
        self.errors.append(error)
    
    def add_message(self, message: str):
        """Add a success message"""
        self.messages.append(message)
    
    def validate_form_data(self, model_class: BaseModel, form_data: Dict[str, Any]) -> Optional[BaseModel]:
        """Validate form data against a Pydantic model"""
        try:
            return model_class(**form_data)
        except ValidationError as e:
            for error in e.errors():
                field = error.get('loc', [''])[0]
                msg = error.get('msg', 'Invalid value')
                self.add_error(f"{field}: {msg}")
            return None
    
    def require_authentication(self):
        """Ensure user is authenticated"""
        if not self.current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
    
    def require_permission(self, permission: str):
        """Check if user has required permission"""
        self.require_authentication()
        # Add permission checking logic here
        pass
    
    def create_response(self, 
                       success: bool = True, 
                       data: Optional[Dict[str, Any]] = None,
                       redirect: Optional[str] = None,
                       message: Optional[str] = None) -> PageResponse:
        """Create a standard page response."""
        return PageResponse(
            success=success,
            data=data,
            errors=self.errors if self.errors else None,
            redirect=redirect,
            message=message or (self.messages[0] if self.messages else None)
        )
    
    def handle_file_upload(self, file_field: str) -> Optional[str]:
        """Handle file upload and return file path."""
        import os
        import uuid
        from pathlib import Path
        
        try:
            if file_field not in self.request.files:
                return None
            
            file = self.request.files[file_field]
            if not file or file.filename == '':
                return None
            
            # Create upload directory
            upload_dir = Path("uploads") / "documents"
            upload_dir.mkdir(parents=True, exist_ok=True)
            
            # Generate unique filename
            file_extension = os.path.splitext(file.filename)[1]
            unique_filename = f"{uuid.uuid4()}{file_extension}"
            file_path = upload_dir / unique_filename
            
            # Save file
            file.save(str(file_path))
            
            self.log_activity("file_uploaded", {
                "original_filename": file.filename,
                "stored_filename": unique_filename,
                "file_size": file.content_length
            })
            
            return str(file_path)
            
        except Exception as e:
            self.add_error(f"File upload failed: {str(e)}")
            return None
    
    def send_email(self, to: str, subject: str, body: str, html: bool = False):
        """Send email notification using communication integration."""
        try:
            from integrations.communication import SendGridIntegration, EmailMessage, CommunicationConfig
            
            # Get email configuration from environment
            config = CommunicationConfig(
                api_key=os.getenv('SENDGRID_API_KEY'),
                sender_email=os.getenv('SENDER_EMAIL', 'noreply@dronestrike.com'),
                sender_name=os.getenv('SENDER_NAME', 'DroneStrike')
            )
            
            if not config.api_key:
                self.add_error("Email service not configured")
                return False
            
            # Create email message
            email = EmailMessage(
                to=to,
                subject=subject,
                content=body,
                html_content=body if html else None
            )
            
            # Send email
            email_service = SendGridIntegration(config)
            result = email_service.send_email(email)
            
            if result.success:
                self.log_activity("email_sent", {
                    "to": to,
                    "subject": subject,
                    "message_id": result.message_id
                })
                return True
            else:
                self.add_error(f"Email sending failed: {result.error_message}")
                return False
                
        except Exception as e:
            self.add_error(f"Email error: {str(e)}")
            return False
    
    def send_sms(self, phone: str, message: str):
        """Send SMS notification using Twilio integration."""
        try:
            from integrations.communication import TwilioIntegration, SMSMessage, CommunicationConfig
            
            # Get SMS configuration from environment
            config = CommunicationConfig(
                api_key=os.getenv('TWILIO_ACCOUNT_SID'),
                api_secret=os.getenv('TWILIO_AUTH_TOKEN'),
                phone_number=os.getenv('TWILIO_PHONE_NUMBER')
            )
            
            if not all([config.api_key, config.api_secret, config.phone_number]):
                self.add_error("SMS service not configured")
                return False
            
            # Create SMS message
            sms = SMSMessage(
                to=phone,
                content=message
            )
            
            # Send SMS
            sms_service = TwilioIntegration(config)
            result = sms_service.send_sms(sms)
            
            if result.success:
                self.log_activity("sms_sent", {
                    "to": phone,
                    "message_id": result.message_id,
                    "status": result.status
                })
                return True
            else:
                self.add_error(f"SMS sending failed: {result.error_message}")
                return False
                
        except Exception as e:
            self.add_error(f"SMS error: {str(e)}")
            return False
    
    def log_activity(self, action: str, details: Dict[str, Any] = None):
        """Log user activity to database."""
        try:
            from datetime import datetime
            from sqlalchemy import text
            
            # Create activity log entry
            activity_data = {
                'user_id': self.current_user['id'] if self.current_user else None,
                'action': action,
                'details': details or {},
                'ip_address': self.request.client.host if hasattr(self.request, 'client') else None,
                'user_agent': self.request.headers.get('user-agent', ''),
                'created_at': datetime.utcnow()
            }
            
            # Insert into activity log table
            query = text("""
                INSERT INTO activity_logs (user_id, action, details, ip_address, user_agent, created_at)
                VALUES (:user_id, :action, :details, :ip_address, :user_agent, :created_at)
            """)
            
            self.db.execute(query, {
                'user_id': activity_data['user_id'],
                'action': activity_data['action'],
                'details': str(activity_data['details']),
                'ip_address': activity_data['ip_address'],
                'user_agent': activity_data['user_agent'],
                'created_at': activity_data['created_at']
            })
            self.db.commit()
            
        except Exception as e:
            # Don't fail the main operation if logging fails
            print(f"Activity logging error: {str(e)}")
            pass
    
    @abstractmethod
    def get_page_data(self) -> PageResponse:
        """Get initial page data."""
        pass
    
    @abstractmethod
    def handle_form_submission(self, form_data: Dict[str, Any]) -> PageResponse:
        """Handle form submission."""
        pass