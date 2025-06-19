"""
Communication integrations for DroneStrike (SMS, Email, etc.).
"""

import smtplib
import boto3
from twilio.rest import Client as TwilioClient
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import Dict, Any, Optional, List, Union
from pydantic import BaseModel, EmailStr
from .base import BaseIntegration, IntegrationConfig, IntegrationError


class CommunicationConfig(IntegrationConfig):
    """Configuration for communication integrations."""
    sender_email: Optional[str] = None
    sender_name: Optional[str] = None
    phone_number: Optional[str] = None
    region: Optional[str] = "us-east-1"


class MessageResult(BaseModel):
    """Communication message result."""
    success: bool
    message_id: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = {}


class EmailMessage(BaseModel):
    """Email message model."""
    to: Union[EmailStr, List[EmailStr]]
    subject: str
    content: str
    html_content: Optional[str] = None
    cc: Optional[List[EmailStr]] = None
    bcc: Optional[List[EmailStr]] = None
    attachments: Optional[List[Dict[str, Any]]] = None
    template_id: Optional[str] = None
    template_data: Optional[Dict[str, Any]] = None


class SMSMessage(BaseModel):
    """SMS message model."""
    to: str
    content: str
    media_urls: Optional[List[str]] = None


class TwilioIntegration(BaseIntegration):
    """Twilio SMS and voice integration."""
    
    def __init__(self, config: CommunicationConfig):
        super().__init__(config)
        self.config: CommunicationConfig = config
    
    def _initialize_client(self) -> None:
        """Initialize Twilio client."""
        try:
            self.client = TwilioClient(self.config.api_key, self.config.api_secret)
            # Test the connection
            self.client.api.accounts(self.config.api_key).fetch()
            self.logger.info("Twilio integration initialized successfully")
        except Exception as e:
            self.logger.error(f"Failed to initialize Twilio: {e}")
            raise IntegrationError(f"Twilio initialization failed: {e}")
    
    async def send_sms(self, message: SMSMessage) -> MessageResult:
        """Send SMS via Twilio."""
        try:
            twilio_message = self.client.messages.create(
                body=message.content,
                from_=self.config.phone_number,
                to=message.to,
                media_url=message.media_urls
            )
            
            return MessageResult(
                success=True,
                message_id=twilio_message.sid,
                status=twilio_message.status,
                metadata={
                    "price": twilio_message.price,
                    "price_unit": twilio_message.price_unit,
                    "direction": twilio_message.direction
                }
            )
            
        except Exception as e:
            self.logger.error(f"Twilio SMS sending failed: {e}")
            return MessageResult(
                success=False,
                status="failed",
                error_message=str(e)
            )
    
    async def make_call(
        self,
        to: str,
        twiml_url: str = None,
        twiml: str = None
    ) -> MessageResult:
        """Make a voice call via Twilio."""
        try:
            call = self.client.calls.create(
                to=to,
                from_=self.config.phone_number,
                url=twiml_url,
                twiml=twiml
            )
            
            return MessageResult(
                success=True,
                message_id=call.sid,
                status=call.status,
                metadata={
                    "price": call.price,
                    "price_unit": call.price_unit,
                    "direction": call.direction
                }
            )
            
        except Exception as e:
            self.logger.error(f"Twilio call failed: {e}")
            return MessageResult(
                success=False,
                status="failed",
                error_message=str(e)
            )
    
    async def get_message_status(self, message_id: str) -> MessageResult:
        """Get SMS message status."""
        try:
            message = self.client.messages(message_id).fetch()
            
            return MessageResult(
                success=message.status != "failed",
                message_id=message.sid,
                status=message.status,
                metadata={
                    "date_sent": message.date_sent.isoformat() if message.date_sent else None,
                    "error_code": message.error_code,
                    "error_message": message.error_message
                }
            )
            
        except Exception as e:
            self.logger.error(f"Twilio message status check failed: {e}")
            return MessageResult(
                success=False,
                status="unknown",
                error_message=str(e)
            )


class SendGridIntegration(BaseIntegration):
    """SendGrid email integration."""
    
    def __init__(self, config: CommunicationConfig):
        super().__init__(config)
        self.config: CommunicationConfig = config
    
    def _initialize_client(self) -> None:
        """Initialize SendGrid client."""
        try:
            self.client = SendGridAPIClient(api_key=self.config.api_key)
            # Test the connection
            response = self.client.user.get()
            self.logger.info("SendGrid integration initialized successfully")
        except Exception as e:
            self.logger.error(f"Failed to initialize SendGrid: {e}")
            raise IntegrationError(f"SendGrid initialization failed: {e}")
    
    async def send_email(self, email: EmailMessage) -> MessageResult:
        """Send email via SendGrid."""
        try:
            mail = Mail()
            mail.from_email = (self.config.sender_email, self.config.sender_name)
            mail.subject = email.subject
            
            # Handle multiple recipients
            if isinstance(email.to, list):
                for recipient in email.to:
                    mail.add_to(recipient)
            else:
                mail.add_to(email.to)
            
            # Add CC and BCC
            if email.cc:
                for cc_email in email.cc:
                    mail.add_cc(cc_email)
            
            if email.bcc:
                for bcc_email in email.bcc:
                    mail.add_bcc(bcc_email)
            
            # Add content
            if email.html_content:
                mail.add_content(email.html_content, "text/html")
            else:
                mail.add_content(email.content, "text/plain")
            
            # Add attachments
            if email.attachments:
                for attachment in email.attachments:
                    mail.add_attachment(attachment)
            
            # Handle template
            if email.template_id:
                mail.template_id = email.template_id
                if email.template_data:
                    mail.dynamic_template_data = email.template_data
            
            response = self.client.send(mail)
            
            return MessageResult(
                success=response.status_code in [200, 202],
                message_id=response.headers.get('X-Message-Id'),
                status="sent" if response.status_code in [200, 202] else "failed",
                metadata={
                    "status_code": response.status_code,
                    "headers": dict(response.headers)
                }
            )
            
        except Exception as e:
            self.logger.error(f"SendGrid email sending failed: {e}")
            return MessageResult(
                success=False,
                status="failed",
                error_message=str(e)
            )


class SESIntegration(BaseIntegration):
    """AWS SES email integration."""
    
    def __init__(self, config: CommunicationConfig):
        super().__init__(config)
        self.config: CommunicationConfig = config
    
    def _initialize_client(self) -> None:
        """Initialize AWS SES client."""
        try:
            self.client = boto3.client(
                'ses',
                aws_access_key_id=self.config.api_key,
                aws_secret_access_key=self.config.api_secret,
                region_name=self.config.region
            )
            # Test the connection
            self.client.get_send_quota()
            self.logger.info("AWS SES integration initialized successfully")
        except Exception as e:
            self.logger.error(f"Failed to initialize AWS SES: {e}")
            raise IntegrationError(f"AWS SES initialization failed: {e}")
    
    async def send_email(self, email: EmailMessage) -> MessageResult:
        """Send email via AWS SES."""
        try:
            # Prepare recipients
            destinations = []
            if isinstance(email.to, list):
                destinations.extend(email.to)
            else:
                destinations.append(email.to)
            
            if email.cc:
                destinations.extend(email.cc)
            
            if email.bcc:
                destinations.extend(email.bcc)
            
            # Send email
            response = self.client.send_email(
                Source=f"{self.config.sender_name} <{self.config.sender_email}>",
                Destination={
                    'ToAddresses': [email.to] if isinstance(email.to, str) else email.to,
                    'CcAddresses': email.cc or [],
                    'BccAddresses': email.bcc or []
                },
                Message={
                    'Subject': {'Data': email.subject, 'Charset': 'UTF-8'},
                    'Body': {
                        'Text': {'Data': email.content, 'Charset': 'UTF-8'},
                        'Html': {'Data': email.html_content or email.content, 'Charset': 'UTF-8'}
                    }
                }
            )
            
            return MessageResult(
                success=True,
                message_id=response['MessageId'],
                status="sent",
                metadata={
                    "response_metadata": response.get('ResponseMetadata', {})
                }
            )
            
        except Exception as e:
            self.logger.error(f"AWS SES email sending failed: {e}")
            return MessageResult(
                success=False,
                status="failed",
                error_message=str(e)
            )


class GmailIntegration(BaseIntegration):
    """Gmail API integration."""
    
    def __init__(self, config: CommunicationConfig):
        super().__init__(config)
        self.config: CommunicationConfig = config
        self.credentials = None
    
    def _initialize_client(self) -> None:
        """Initialize Gmail API client."""
        try:
            # Note: In production, you would load OAuth2 credentials properly
            # This is a simplified version
            self.credentials = Credentials(token=self.config.api_key)
            self.client = build('gmail', 'v1', credentials=self.credentials)
            
            # Test the connection
            profile = self.client.users().getProfile(userId='me').execute()
            self.logger.info("Gmail API integration initialized successfully")
        except Exception as e:
            self.logger.error(f"Failed to initialize Gmail API: {e}")
            raise IntegrationError(f"Gmail API initialization failed: {e}")
    
    async def send_email(self, email: EmailMessage) -> MessageResult:
        """Send email via Gmail API."""
        try:
            # Create the message
            message = MIMEMultipart()
            message['to'] = email.to if isinstance(email.to, str) else ', '.join(email.to)
            message['subject'] = email.subject
            message['from'] = self.config.sender_email
            
            if email.cc:
                message['cc'] = ', '.join(email.cc)
            
            # Add body
            if email.html_content:
                message.attach(MIMEText(email.html_content, 'html'))
            else:
                message.attach(MIMEText(email.content, 'plain'))
            
            # Add attachments
            if email.attachments:
                for attachment in email.attachments:
                    part = MIMEBase('application', 'octet-stream')
                    part.set_payload(attachment['content'])
                    encoders.encode_base64(part)
                    part.add_header(
                        'Content-Disposition',
                        f'attachment; filename= {attachment["filename"]}'
                    )
                    message.attach(part)
            
            # Send the message
            raw_message = {'raw': message.as_string().encode('utf-8')}
            sent_message = self.client.users().messages().send(
                userId='me', body=raw_message
            ).execute()
            
            return MessageResult(
                success=True,
                message_id=sent_message['id'],
                status="sent",
                metadata={
                    "thread_id": sent_message.get('threadId'),
                    "label_ids": sent_message.get('labelIds', [])
                }
            )
            
        except Exception as e:
            self.logger.error(f"Gmail email sending failed: {e}")
            return MessageResult(
                success=False,
                status="failed",
                error_message=str(e)
            )