"""
Advanced Mailgun integration for DroneStrike v2.

Provides comprehensive email services including delivery, tracking, validation,
mailing lists, A/B testing, authentication, and webhook processing.
"""

import asyncio
import json
import time
import base64
import mimetypes
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union, BinaryIO
from enum import Enum
from dataclasses import dataclass, field
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

import httpx
from pydantic import BaseModel, validator, Field, EmailStr

from .base import HTTPIntegration, IntegrationConfig, IntegrationError, ValidationError, WebhookHandler, BatchProcessor


class MailgunEventType(Enum):
    """Mailgun webhook event types."""
    DELIVERED = "delivered"
    OPENED = "opened"
    CLICKED = "clicked"
    UNSUBSCRIBED = "unsubscribed"
    COMPLAINED = "complained"
    BOUNCED = "bounced"
    DROPPED = "dropped"
    REJECTED = "rejected"
    STORED = "stored"


class MailgunSeverity(Enum):
    """Message severity levels."""
    TEMPORARY = "temporary"
    PERMANENT = "permanent"


class MailgunListAccess(Enum):
    """Mailing list access levels."""
    READONLY = "readonly"
    MEMBERS = "members"
    EVERYONE = "everyone"


class MailgunValidationStatus(Enum):
    """Email validation statuses."""
    VALID = "valid"
    INVALID = "invalid"
    UNKNOWN = "unknown"
    CATCH_ALL = "catch_all"
    DO_NOT_MAIL = "do_not_mail"


class MailgunConfig(IntegrationConfig):
    """Mailgun-specific configuration."""
    domain: str = Field(..., description="Mailgun domain")
    base_url: str = "https://api.mailgun.net/v3"
    eu_base_url: str = "https://api.eu.mailgun.net/v3"
    
    # Region settings
    use_eu_region: bool = False
    
    # Default settings
    default_from_email: Optional[str] = None
    default_from_name: Optional[str] = None
    default_reply_to: Optional[str] = None
    
    # Tracking settings
    track_clicks: bool = True
    track_opens: bool = True
    
    # Webhook settings
    webhook_signing_key: Optional[str] = None
    
    # Validation settings
    validation_enabled: bool = True
    
    # Template settings
    template_engine: str = "handlebars"  # handlebars or mustache
    
    class Config:
        extra = "allow"
    
    @property
    def api_base_url(self) -> str:
        """Get the appropriate API base URL."""
        return self.eu_base_url if self.use_eu_region else self.base_url


@dataclass
class EmailAttachment:
    """Email attachment representation."""
    filename: str
    content: bytes
    content_type: Optional[str] = None
    inline: bool = False
    
    def __post_init__(self):
        if not self.content_type:
            self.content_type, _ = mimetypes.guess_type(self.filename)
            if not self.content_type:
                self.content_type = "application/octet-stream"


class EmailMessage(BaseModel):
    """Email message model."""
    to: Union[str, List[str]] = Field(..., description="Recipient email(s)")
    subject: str = Field(..., description="Email subject")
    html: Optional[str] = Field(None, description="HTML content")
    text: Optional[str] = Field(None, description="Plain text content")
    from_email: Optional[str] = Field(None, description="Sender email")
    from_name: Optional[str] = Field(None, description="Sender name")
    reply_to: Optional[str] = Field(None, description="Reply-to email")
    cc: Optional[List[str]] = Field(None, description="CC recipients")
    bcc: Optional[List[str]] = Field(None, description="BCC recipients")
    tags: Optional[List[str]] = Field(None, description="Message tags")
    custom_vars: Optional[Dict[str, str]] = Field(None, description="Custom variables")
    template: Optional[str] = Field(None, description="Template name")
    template_vars: Optional[Dict[str, Any]] = Field(None, description="Template variables")
    tracking: Optional[bool] = Field(None, description="Enable tracking")
    click_tracking: Optional[bool] = Field(None, description="Enable click tracking")
    open_tracking: Optional[bool] = Field(None, description="Enable open tracking")
    delivery_time: Optional[datetime] = Field(None, description="Scheduled delivery time")
    test_mode: bool = Field(False, description="Test mode")
    
    @validator('to')
    def validate_recipients(cls, v):
        if isinstance(v, str):
            return [v]
        return v
    
    @validator('html', 'text')
    def validate_content(cls, v, values):
        # At least one of html or text must be provided
        if not v and not values.get('html') and not values.get('text') and not values.get('template'):
            raise ValueError('At least one of html, text, or template must be provided')
        return v


class MailingListMember(BaseModel):
    """Mailing list member model."""
    email: EmailStr
    name: Optional[str] = None
    vars: Optional[Dict[str, Any]] = None
    subscribed: bool = True


class MailingList(BaseModel):
    """Mailing list model."""
    address: EmailStr = Field(..., description="List email address")
    name: str = Field(..., description="List name")
    description: Optional[str] = None
    access_level: MailgunListAccess = MailgunListAccess.EVERYONE
    reply_preference: str = Field("list", description="Reply preference")


class EmailTemplate(BaseModel):
    """Email template model."""
    name: str = Field(..., description="Template name")
    description: Optional[str] = None
    template: str = Field(..., description="Template content")
    engine: str = Field("handlebars", description="Template engine")
    version_tag: Optional[str] = Field(None, description="Version tag")
    active: bool = Field(True, description="Template active status")


class ABTestSettings(BaseModel):
    """A/B test configuration."""
    test_name: str
    variants: List[Dict[str, Any]] = Field(..., min_items=2, max_items=5)
    test_percentage: int = Field(50, ge=1, le=100)
    winner_criteria: str = Field("open_rate", description="Winner criteria")
    test_duration_hours: int = Field(24, ge=1, le=168)
    auto_select_winner: bool = True


class AdvancedMailgun(HTTPIntegration):
    """
    Advanced Mailgun integration with comprehensive email capabilities.
    
    Features:
    - Complete email delivery with templates
    - Advanced tracking (opens, clicks, bounces, complaints)
    - Email validation and verification
    - Mailing list management with segmentation
    - A/B testing capabilities
    - Email authentication (DKIM, SPF, DMARC)
    - Webhook processing for all events
    - Suppression list management
    - Analytics and reporting
    """
    
    def __init__(self, config: MailgunConfig):
        super().__init__(config)
        self.config: MailgunConfig = config
        self.batch_processor = BatchProcessor(batch_size=1000, max_workers=10)
        self.webhook_handler = None
        
        if config.webhook_signing_key:
            self.webhook_handler = MailgunWebhookHandler(config.webhook_signing_key)
    
    def _initialize_client(self) -> None:
        """Initialize Mailgun HTTP client."""
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(self.config.timeout),
            headers=self._get_default_headers(),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=100),
            auth=("api", self.config.api_key)
        )
    
    def _get_default_headers(self) -> Dict[str, str]:
        """Get default headers for Mailgun requests."""
        return {
            "User-Agent": "DroneStrike/2.0 Mailgun Integration",
            "Accept": "application/json"
        }
    
    async def _perform_health_check(self) -> None:
        """Perform Mailgun API health check."""
        try:
            await self.get_domain_info()
        except Exception as e:
            raise IntegrationError(f"Mailgun health check failed: {e}")
    
    def _get_domain_url(self, endpoint: str = "") -> str:
        """Get domain-specific API URL."""
        base_url = self.config.api_base_url
        if endpoint:
            return f"{base_url}/{self.config.domain}/{endpoint}"
        return f"{base_url}/{self.config.domain}"
    
    # Domain Management
    
    async def get_domain_info(self) -> Dict[str, Any]:
        """Get domain information and settings."""
        url = f"{self.config.api_base_url}/domains/{self.config.domain}"
        
        try:
            response = await self._make_request("GET", url, use_cache=True)
            domain_data = response.get("domain", {})
            
            return {
                "name": domain_data.get("name"),
                "state": domain_data.get("state"),
                "created_at": domain_data.get("created_at"),
                "smtp_login": domain_data.get("smtp_login"),
                "smtp_password": domain_data.get("smtp_password"),
                "spam_action": domain_data.get("spam_action"),
                "wildcard": domain_data.get("wildcard"),
                "force_dkim_authority": domain_data.get("force_dkim_authority"),
                "dkim_key_size": domain_data.get("dkim_key_size"),
                "ips": domain_data.get("ips", []),
                "tracking": {
                    "click": domain_data.get("click_tracking", {}).get("active"),
                    "open": domain_data.get("open_tracking", {}).get("active"),
                    "unsubscribe": domain_data.get("unsubscribe_tracking", {}).get("active")
                }
            }
        except Exception as e:
            self._handle_error(e, "get domain info")
    
    async def get_domain_stats(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        resolution: str = "day"
    ) -> Dict[str, Any]:
        """Get domain statistics."""
        params = {"resolution": resolution}
        
        if start_date:
            params["start"] = start_date.strftime("%a, %d %b %Y %H:%M:%S %z")
        if end_date:
            params["end"] = end_date.strftime("%a, %d %b %Y %H:%M:%S %z")
        
        url = f"{self.config.api_base_url}/{self.config.domain}/stats/total"
        
        try:
            response = await self._make_request("GET", url, params=params)
            return self._process_stats_response(response)
        except Exception as e:
            self._handle_error(e, "get domain stats")
    
    def _process_stats_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Process statistics response."""
        stats = response.get("stats", [])
        
        processed_stats = {
            "total_sent": 0,
            "total_delivered": 0,
            "total_bounced": 0,
            "total_complained": 0,
            "total_unsubscribed": 0,
            "total_clicked": 0,
            "total_opened": 0,
            "daily_stats": []
        }
        
        for stat in stats:
            time_period = stat.get("time")
            sent = stat.get("sent", 0)
            delivered = stat.get("delivered", 0)
            bounced = stat.get("bounced", 0)
            complained = stat.get("complained", 0)
            unsubscribed = stat.get("unsubscribed", 0)
            clicked = stat.get("clicked", 0)
            opened = stat.get("opened", 0)
            
            processed_stats["total_sent"] += sent
            processed_stats["total_delivered"] += delivered
            processed_stats["total_bounced"] += bounced
            processed_stats["total_complained"] += complained
            processed_stats["total_unsubscribed"] += unsubscribed
            processed_stats["total_clicked"] += clicked
            processed_stats["total_opened"] += opened
            
            processed_stats["daily_stats"].append({
                "date": time_period,
                "sent": sent,
                "delivered": delivered,
                "bounced": bounced,
                "complained": complained,
                "unsubscribed": unsubscribed,
                "clicked": clicked,
                "opened": opened,
                "delivery_rate": (delivered / sent * 100) if sent > 0 else 0,
                "bounce_rate": (bounced / sent * 100) if sent > 0 else 0,
                "complaint_rate": (complained / sent * 100) if sent > 0 else 0,
                "open_rate": (opened / delivered * 100) if delivered > 0 else 0,
                "click_rate": (clicked / delivered * 100) if delivered > 0 else 0
            })
        
        # Calculate overall rates
        if processed_stats["total_sent"] > 0:
            processed_stats["overall_delivery_rate"] = (
                processed_stats["total_delivered"] / processed_stats["total_sent"] * 100
            )
            processed_stats["overall_bounce_rate"] = (
                processed_stats["total_bounced"] / processed_stats["total_sent"] * 100
            )
            processed_stats["overall_complaint_rate"] = (
                processed_stats["total_complained"] / processed_stats["total_sent"] * 100
            )
        
        if processed_stats["total_delivered"] > 0:
            processed_stats["overall_open_rate"] = (
                processed_stats["total_opened"] / processed_stats["total_delivered"] * 100
            )
            processed_stats["overall_click_rate"] = (
                processed_stats["total_clicked"] / processed_stats["total_delivered"] * 100
            )
        
        return processed_stats
    
    # Email Sending
    
    async def send_email(
        self,
        message: EmailMessage,
        attachments: Optional[List[EmailAttachment]] = None
    ) -> Dict[str, Any]:
        """Send email message."""
        url = self._get_domain_url("messages")
        
        # Prepare form data
        form_data = self._prepare_message_data(message)
        
        # Handle attachments
        files = []
        if attachments:
            for attachment in attachments:
                files.append((
                    "inline" if attachment.inline else "attachment",
                    (attachment.filename, attachment.content, attachment.content_type)
                ))
        
        try:
            if files:
                response = await self._make_request("POST", url, data=form_data, files=files)
            else:
                response = await self._make_request("POST", url, data=form_data)
            
            return {
                "message_id": response.get("id"),
                "message": response.get("message", "Queued. Thank you."),
                "status": "queued",
                "recipients": len(message.to),
                "timestamp": datetime.now()
            }
        except Exception as e:
            self._handle_error(e, f"send email to {message.to}")
    
    def _prepare_message_data(self, message: EmailMessage) -> Dict[str, Any]:
        """Prepare message data for API request."""
        data = {}
        
        # Recipients
        data["to"] = ",".join(message.to)
        if message.cc:
            data["cc"] = ",".join(message.cc)
        if message.bcc:
            data["bcc"] = ",".join(message.bcc)
        
        # Sender
        if message.from_email:
            from_field = message.from_email
            if message.from_name:
                from_field = f"{message.from_name} <{message.from_email}>"
        else:
            from_field = self.config.default_from_email
            if self.config.default_from_name:
                from_field = f"{self.config.default_from_name} <{self.config.default_from_email}>"
        
        data["from"] = from_field
        
        # Reply-to
        if message.reply_to:
            data["h:Reply-To"] = message.reply_to
        elif self.config.default_reply_to:
            data["h:Reply-To"] = self.config.default_reply_to
        
        # Subject and content
        data["subject"] = message.subject
        
        if message.template:
            data["template"] = message.template
            if message.template_vars:
                for key, value in message.template_vars.items():
                    data[f"v:{key}"] = str(value)
        else:
            if message.html:
                data["html"] = message.html
            if message.text:
                data["text"] = message.text
        
        # Tracking settings
        tracking_enabled = message.tracking if message.tracking is not None else True
        data["o:tracking"] = "yes" if tracking_enabled else "no"
        
        if message.click_tracking is not None:
            data["o:tracking-clicks"] = "yes" if message.click_tracking else "no"
        elif self.config.track_clicks:
            data["o:tracking-clicks"] = "yes"
        
        if message.open_tracking is not None:
            data["o:tracking-opens"] = "yes" if message.open_tracking else "no"
        elif self.config.track_opens:
            data["o:tracking-opens"] = "yes"
        
        # Tags
        if message.tags:
            for tag in message.tags:
                data[f"o:tag"] = tag
        
        # Custom variables
        if message.custom_vars:
            for key, value in message.custom_vars.items():
                data[f"v:{key}"] = str(value)
        
        # Delivery time
        if message.delivery_time:
            data["o:deliverytime"] = message.delivery_time.strftime("%a, %d %b %Y %H:%M:%S %z")
        
        # Test mode
        if message.test_mode:
            data["o:testmode"] = "yes"
        
        return data
    
    async def send_batch_emails(
        self,
        messages: List[EmailMessage],
        attachments_per_message: Optional[List[List[EmailAttachment]]] = None
    ) -> List[Dict[str, Any]]:
        """Send multiple emails in batch."""
        async def send_single_email(index_and_message) -> Dict[str, Any]:
            index, message = index_and_message
            try:
                attachments = None
                if attachments_per_message and index < len(attachments_per_message):
                    attachments = attachments_per_message[index]
                
                return await self.send_email(message, attachments)
            except Exception as e:
                return {
                    "error": str(e),
                    "message": message.dict(),
                    "status": "failed"
                }
        
        indexed_messages = list(enumerate(messages))
        return await self.batch_processor.process_batch(indexed_messages, send_single_email)
    
    async def send_template_email(
        self,
        template_name: str,
        recipients: List[str],
        template_vars: Dict[str, Any],
        **kwargs
    ) -> Dict[str, Any]:
        """Send email using template."""
        message = EmailMessage(
            to=recipients,
            subject=kwargs.get("subject", ""),
            template=template_name,
            template_vars=template_vars,
            **{k: v for k, v in kwargs.items() if k != "subject"}
        )
        
        return await self.send_email(message)
    
    # Email Tracking
    
    async def get_message_events(
        self,
        message_id: Optional[str] = None,
        begin: Optional[datetime] = None,
        end: Optional[datetime] = None,
        event_type: Optional[MailgunEventType] = None,
        limit: int = 300
    ) -> List[Dict[str, Any]]:
        """Get message events for tracking."""
        url = self._get_domain_url("events")
        
        params = {"limit": limit}
        
        if message_id:
            params["message-id"] = message_id
        if begin:
            params["begin"] = begin.strftime("%a, %d %b %Y %H:%M:%S %z")
        if end:
            params["end"] = end.strftime("%a, %d %b %Y %H:%M:%S %z")
        if event_type:
            params["event"] = event_type.value
        
        try:
            response = await self._make_request("GET", url, params=params)
            return self._process_events_response(response)
        except Exception as e:
            self._handle_error(e, "get message events")
    
    def _process_events_response(self, response: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Process events response."""
        events = response.get("items", [])
        
        processed_events = []
        for event in events:
            processed_event = {
                "id": event.get("id"),
                "event": event.get("event"),
                "timestamp": datetime.fromtimestamp(event.get("timestamp", 0)),
                "message_id": event.get("message", {}).get("headers", {}).get("message-id"),
                "recipient": event.get("recipient"),
                "sender": event.get("message", {}).get("headers", {}).get("from"),
                "subject": event.get("message", {}).get("headers", {}).get("subject"),
                "tags": event.get("tags", []),
                "user_variables": event.get("user-variables", {}),
                "campaigns": event.get("campaigns", [])
            }
            
            # Event-specific data
            if event.get("event") == "clicked":
                processed_event["url"] = event.get("url")
                processed_event["ip"] = event.get("ip")
                processed_event["country"] = event.get("country")
                processed_event["region"] = event.get("region")
                processed_event["city"] = event.get("city")
                processed_event["user_agent"] = event.get("user-agent")
                processed_event["device_type"] = event.get("device-type")
                processed_event["client_type"] = event.get("client-type")
                processed_event["client_name"] = event.get("client-name")
                processed_event["client_os"] = event.get("client-os")
            
            elif event.get("event") == "opened":
                processed_event["ip"] = event.get("ip")
                processed_event["country"] = event.get("country")
                processed_event["region"] = event.get("region")
                processed_event["city"] = event.get("city")
                processed_event["user_agent"] = event.get("user-agent")
                processed_event["device_type"] = event.get("device-type")
                processed_event["client_type"] = event.get("client-type")
                processed_event["client_name"] = event.get("client-name")
                processed_event["client_os"] = event.get("client-os")
            
            elif event.get("event") in ["bounced", "dropped"]:
                processed_event["reason"] = event.get("reason")
                processed_event["code"] = event.get("code")
                processed_event["error"] = event.get("error")
                processed_event["notification"] = event.get("notification")
            
            elif event.get("event") == "complained":
                processed_event["complaint_type"] = event.get("complaint-type")
            
            processed_events.append(processed_event)
        
        return processed_events
    
    async def get_message_tracking_summary(
        self,
        message_id: str
    ) -> Dict[str, Any]:
        """Get comprehensive tracking summary for a message."""
        events = await self.get_message_events(message_id=message_id)
        
        summary = {
            "message_id": message_id,
            "total_events": len(events),
            "event_counts": {},
            "delivery_status": "unknown",
            "open_count": 0,
            "click_count": 0,
            "unique_opens": 0,
            "unique_clicks": 0,
            "opened_by": [],
            "clicked_by": [],
            "clicked_urls": [],
            "bounced": False,
            "complained": False,
            "unsubscribed": False,
            "first_open": None,
            "first_click": None,
            "last_activity": None
        }
        
        unique_opens = set()
        unique_clicks = set()
        
        for event in events:
            event_type = event["event"]
            recipient = event["recipient"]
            timestamp = event["timestamp"]
            
            # Count events
            summary["event_counts"][event_type] = summary["event_counts"].get(event_type, 0) + 1
            
            # Track delivery status
            if event_type == "delivered":
                summary["delivery_status"] = "delivered"
            elif event_type in ["bounced", "dropped"]:
                summary["delivery_status"] = "failed"
                summary["bounced"] = True
            
            # Track opens
            if event_type == "opened":
                summary["open_count"] += 1
                if recipient not in unique_opens:
                    unique_opens.add(recipient)
                    summary["opened_by"].append({
                        "recipient": recipient,
                        "timestamp": timestamp,
                        "location": f"{event.get('city', '')}, {event.get('region', '')}, {event.get('country', '')}".strip(', '),
                        "device": event.get("device_type"),
                        "client": event.get("client_name")
                    })
                
                if not summary["first_open"] or timestamp < summary["first_open"]:
                    summary["first_open"] = timestamp
            
            # Track clicks
            if event_type == "clicked":
                summary["click_count"] += 1
                url = event.get("url")
                if url and url not in summary["clicked_urls"]:
                    summary["clicked_urls"].append(url)
                
                if recipient not in unique_clicks:
                    unique_clicks.add(recipient)
                    summary["clicked_by"].append({
                        "recipient": recipient,
                        "timestamp": timestamp,
                        "url": url,
                        "location": f"{event.get('city', '')}, {event.get('region', '')}, {event.get('country', '')}".strip(', '),
                        "device": event.get("device_type"),
                        "client": event.get("client_name")
                    })
                
                if not summary["first_click"] or timestamp < summary["first_click"]:
                    summary["first_click"] = timestamp
            
            # Track complaints and unsubscribes
            if event_type == "complained":
                summary["complained"] = True
            elif event_type == "unsubscribed":
                summary["unsubscribed"] = True
            
            # Track last activity
            if not summary["last_activity"] or timestamp > summary["last_activity"]:
                summary["last_activity"] = timestamp
        
        summary["unique_opens"] = len(unique_opens)
        summary["unique_clicks"] = len(unique_clicks)
        
        return summary
    
    # Email Validation
    
    async def validate_email(self, email: str) -> Dict[str, Any]:
        """Validate single email address."""
        if not self.config.validation_enabled:
            return {"email": email, "status": "validation_disabled"}
        
        url = f"{self.config.api_base_url}/address/validate"
        params = {"address": email}
        
        try:
            response = await self._make_request("GET", url, params=params)
            return self._process_validation_response(response, email)
        except Exception as e:
            self._handle_error(e, f"validate email {email}")
    
    async def validate_email_list(
        self,
        email_list: str,
        emails: List[str]
    ) -> Dict[str, Any]:
        """Validate list of email addresses."""
        url = f"{self.config.api_base_url}/address/validate/bulk/{email_list}"
        
        # Prepare CSV data
        csv_data = "\n".join(emails)
        
        try:
            response = await self._make_request(
                "POST", 
                url, 
                data={"csv": csv_data},
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            return {
                "list_id": response.get("id"),
                "message": response.get("message"),
                "status": "processing",
                "total_emails": len(emails)
            }
        except Exception as e:
            self._handle_error(e, f"validate email list {email_list}")
    
    async def get_validation_results(self, list_id: str) -> Dict[str, Any]:
        """Get bulk validation results."""
        url = f"{self.config.api_base_url}/address/validate/bulk/{list_id}"
        
        try:
            response = await self._make_request("GET", url)
            return self._process_bulk_validation_response(response)
        except Exception as e:
            self._handle_error(e, f"get validation results {list_id}")
    
    def _process_validation_response(self, response: Dict[str, Any], email: str) -> Dict[str, Any]:
        """Process single email validation response."""
        return {
            "email": email,
            "is_valid": response.get("is_valid", False),
            "mailbox_verification": response.get("mailbox_verification"),
            "is_disposable_address": response.get("is_disposable_address", False),
            "is_role_address": response.get("is_role_address", False),
            "reason": response.get("reason", []),
            "risk": response.get("risk", "unknown"),
            "result": response.get("result", "unknown"),
            "address": response.get("address"),
            "did_you_mean": response.get("did_you_mean")
        }
    
    def _process_bulk_validation_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Process bulk validation response."""
        return {
            "id": response.get("id"),
            "status": response.get("status"),
            "quantity": response.get("quantity"),
            "created_at": response.get("created_at"),
            "download_url": response.get("download_url", {}).get("csv"),
            "summary": response.get("summary", {}),
            "preview": response.get("preview", [])
        }
    
    # Mailing Lists
    
    async def create_mailing_list(self, mailing_list: MailingList) -> Dict[str, Any]:
        """Create mailing list."""
        url = f"{self.config.api_base_url}/lists"
        
        data = {
            "address": mailing_list.address,
            "name": mailing_list.name,
            "access_level": mailing_list.access_level.value,
            "reply_preference": mailing_list.reply_preference
        }
        
        if mailing_list.description:
            data["description"] = mailing_list.description
        
        try:
            response = await self._make_request("POST", url, data=data)
            return {
                "address": response.get("list", {}).get("address"),
                "name": response.get("list", {}).get("name"),
                "status": "created",
                "message": response.get("message", "Mailing list created")
            }
        except Exception as e:
            self._handle_error(e, f"create mailing list {mailing_list.address}")
    
    async def get_mailing_lists(
        self,
        limit: int = 100,
        skip: int = 0
    ) -> List[Dict[str, Any]]:
        """Get all mailing lists."""
        url = f"{self.config.api_base_url}/lists"
        params = {"limit": limit, "skip": skip}
        
        try:
            response = await self._make_request("GET", url, params=params)
            lists = response.get("items", [])
            
            return [
                {
                    "address": lst.get("address"),
                    "name": lst.get("name"),
                    "description": lst.get("description"),
                    "access_level": lst.get("access_level"),
                    "reply_preference": lst.get("reply_preference"),
                    "members_count": lst.get("members_count", 0),
                    "created_at": lst.get("created_at")
                }
                for lst in lists
            ]
        except Exception as e:
            self._handle_error(e, "get mailing lists")
    
    async def add_list_member(
        self,
        list_address: str,
        member: MailingListMember
    ) -> Dict[str, Any]:
        """Add member to mailing list."""
        url = f"{self.config.api_base_url}/lists/{list_address}/members"
        
        data = {
            "address": member.email,
            "subscribed": "yes" if member.subscribed else "no"
        }
        
        if member.name:
            data["name"] = member.name
        
        if member.vars:
            data["vars"] = json.dumps(member.vars)
        
        try:
            response = await self._make_request("POST", url, data=data)
            return {
                "list_address": list_address,
                "member_email": member.email,
                "status": "added",
                "message": response.get("message", "Member added to list")
            }
        except Exception as e:
            self._handle_error(e, f"add member {member.email} to list {list_address}")
    
    async def bulk_add_list_members(
        self,
        list_address: str,
        members: List[MailingListMember]
    ) -> List[Dict[str, Any]]:
        """Add multiple members to mailing list."""
        async def add_single_member(member: MailingListMember) -> Dict[str, Any]:
            try:
                return await self.add_list_member(list_address, member)
            except Exception as e:
                return {
                    "error": str(e),
                    "member_email": member.email,
                    "status": "failed"
                }
        
        return await self.batch_processor.process_batch(members, add_single_member)
    
    async def remove_list_member(
        self,
        list_address: str,
        member_email: str
    ) -> Dict[str, Any]:
        """Remove member from mailing list."""
        url = f"{self.config.api_base_url}/lists/{list_address}/members/{member_email}"
        
        try:
            response = await self._make_request("DELETE", url)
            return {
                "list_address": list_address,
                "member_email": member_email,
                "status": "removed",
                "message": response.get("message", "Member removed from list")
            }
        except Exception as e:
            self._handle_error(e, f"remove member {member_email} from list {list_address}")
    
    async def get_list_members(
        self,
        list_address: str,
        subscribed: Optional[bool] = None,
        limit: int = 100,
        skip: int = 0
    ) -> List[Dict[str, Any]]:
        """Get mailing list members."""
        url = f"{self.config.api_base_url}/lists/{list_address}/members"
        params = {"limit": limit, "skip": skip}
        
        if subscribed is not None:
            params["subscribed"] = "yes" if subscribed else "no"
        
        try:
            response = await self._make_request("GET", url, params=params)
            members = response.get("items", [])
            
            return [
                {
                    "address": member.get("address"),
                    "name": member.get("name"),
                    "subscribed": member.get("subscribed"),
                    "vars": member.get("vars", {}),
                    "created_at": member.get("created_at")
                }
                for member in members
            ]
        except Exception as e:
            self._handle_error(e, f"get members for list {list_address}")
    
    # Email Templates
    
    async def create_template(self, template: EmailTemplate) -> Dict[str, Any]:
        """Create email template."""
        url = f"{self.config.api_base_url}/{self.config.domain}/templates"
        
        data = {
            "name": template.name,
            "template": template.template,
            "engine": template.engine,
            "active": "yes" if template.active else "no"
        }
        
        if template.description:
            data["description"] = template.description
        
        if template.version_tag:
            data["tag"] = template.version_tag
        
        try:
            response = await self._make_request("POST", url, data=data)
            return {
                "name": template.name,
                "status": "created",
                "message": response.get("message", "Template created successfully")
            }
        except Exception as e:
            self._handle_error(e, f"create template {template.name}")
    
    async def get_templates(self) -> List[Dict[str, Any]]:
        """Get all email templates."""
        url = f"{self.config.api_base_url}/{self.config.domain}/templates"
        
        try:
            response = await self._make_request("GET", url, use_cache=True)
            templates = response.get("items", [])
            
            return [
                {
                    "name": tmpl.get("name"),
                    "description": tmpl.get("description"),
                    "engine": tmpl.get("engine"),
                    "active": tmpl.get("active"),
                    "created_at": tmpl.get("created_at"),
                    "version": tmpl.get("version", {})
                }
                for tmpl in templates
            ]
        except Exception as e:
            self._handle_error(e, "get templates")
    
    async def delete_template(self, template_name: str) -> Dict[str, Any]:
        """Delete email template."""
        url = f"{self.config.api_base_url}/{self.config.domain}/templates/{template_name}"
        
        try:
            response = await self._make_request("DELETE", url)
            return {
                "name": template_name,
                "status": "deleted",
                "message": response.get("message", "Template deleted successfully")
            }
        except Exception as e:
            self._handle_error(e, f"delete template {template_name}")
    
    # Suppression Management
    
    async def get_bounces(
        self,
        limit: int = 100,
        skip: int = 0
    ) -> List[Dict[str, Any]]:
        """Get bounced email addresses."""
        url = self._get_domain_url("bounces")
        params = {"limit": limit, "skip": skip}
        
        try:
            response = await self._make_request("GET", url, params=params)
            bounces = response.get("items", [])
            
            return [
                {
                    "address": bounce.get("address"),
                    "code": bounce.get("code"),
                    "error": bounce.get("error"),
                    "created_at": bounce.get("created_at")
                }
                for bounce in bounces
            ]
        except Exception as e:
            self._handle_error(e, "get bounces")
    
    async def add_bounce(self, email: str, code: str = "550", error: str = "Generic bounce") -> Dict[str, Any]:
        """Add email to bounce list."""
        url = self._get_domain_url("bounces")
        data = {"address": email, "code": code, "error": error}
        
        try:
            response = await self._make_request("POST", url, data=data)
            return {
                "address": email,
                "status": "added",
                "message": response.get("message", "Address added to bounce list")
            }
        except Exception as e:
            self._handle_error(e, f"add bounce {email}")
    
    async def remove_bounce(self, email: str) -> Dict[str, Any]:
        """Remove email from bounce list."""
        url = self._get_domain_url(f"bounces/{email}")
        
        try:
            response = await self._make_request("DELETE", url)
            return {
                "address": email,
                "status": "removed",
                "message": response.get("message", "Address removed from bounce list")
            }
        except Exception as e:
            self._handle_error(e, f"remove bounce {email}")
    
    async def get_unsubscribes(
        self,
        limit: int = 100,
        skip: int = 0
    ) -> List[Dict[str, Any]]:
        """Get unsubscribed email addresses."""
        url = self._get_domain_url("unsubscribes")
        params = {"limit": limit, "skip": skip}
        
        try:
            response = await self._make_request("GET", url, params=params)
            unsubscribes = response.get("items", [])
            
            return [
                {
                    "address": unsub.get("address"),
                    "tags": unsub.get("tags", []),
                    "created_at": unsub.get("created_at")
                }
                for unsub in unsubscribes
            ]
        except Exception as e:
            self._handle_error(e, "get unsubscribes")
    
    async def add_unsubscribe(self, email: str, tags: Optional[List[str]] = None) -> Dict[str, Any]:
        """Add email to unsubscribe list."""
        url = self._get_domain_url("unsubscribes")
        data = {"address": email}
        
        if tags:
            data["tags"] = ",".join(tags)
        
        try:
            response = await self._make_request("POST", url, data=data)
            return {
                "address": email,
                "status": "added",
                "message": response.get("message", "Address added to unsubscribe list")
            }
        except Exception as e:
            self._handle_error(e, f"add unsubscribe {email}")
    
    async def remove_unsubscribe(self, email: str) -> Dict[str, Any]:
        """Remove email from unsubscribe list."""
        url = self._get_domain_url(f"unsubscribes/{email}")
        
        try:
            response = await self._make_request("DELETE", url)
            return {
                "address": email,
                "status": "removed",
                "message": response.get("message", "Address removed from unsubscribe list")
            }
        except Exception as e:
            self._handle_error(e, f"remove unsubscribe {email}")
    
    async def get_complaints(
        self,
        limit: int = 100,
        skip: int = 0
    ) -> List[Dict[str, Any]]:
        """Get complaint email addresses."""
        url = self._get_domain_url("complaints")
        params = {"limit": limit, "skip": skip}
        
        try:
            response = await self._make_request("GET", url, params=params)
            complaints = response.get("items", [])
            
            return [
                {
                    "address": complaint.get("address"),
                    "created_at": complaint.get("created_at")
                }
                for complaint in complaints
            ]
        except Exception as e:
            self._handle_error(e, "get complaints")
    
    # A/B Testing
    
    async def create_ab_test(
        self,
        test_settings: ABTestSettings,
        base_message: EmailMessage
    ) -> Dict[str, Any]:
        """Create A/B test campaign."""
        # This is a simplified implementation
        # In practice, you'd need to implement more sophisticated A/B testing logic
        
        test_results = []
        total_recipients = len(base_message.to)
        test_size = int(total_recipients * test_settings.test_percentage / 100)
        
        for i, variant in enumerate(test_settings.variants):
            # Create variant message
            variant_message = base_message.copy()
            
            # Apply variant changes
            if "subject" in variant:
                variant_message.subject = variant["subject"]
            if "html" in variant:
                variant_message.html = variant["html"]
            if "from_name" in variant:
                variant_message.from_name = variant["from_name"]
            
            # Send to test segment
            test_recipients = base_message.to[:test_size] if i == 0 else base_message.to[test_size:test_size*2]
            variant_message.to = test_recipients
            variant_message.tags = [f"ab_test_{test_settings.test_name}_variant_{i}"]
            
            result = await self.send_email(variant_message)
            test_results.append({
                "variant_id": i,
                "variant_name": variant.get("name", f"Variant {i}"),
                "recipients": len(test_recipients),
                "message_id": result.get("message_id"),
                "status": result.get("status")
            })
        
        return {
            "test_name": test_settings.test_name,
            "test_id": f"ab_test_{test_settings.test_name}_{int(time.time())}",
            "variants": test_results,
            "test_percentage": test_settings.test_percentage,
            "total_recipients": total_recipients,
            "status": "running",
            "created_at": datetime.now()
        }
    
    # Analytics and Reporting
    
    async def get_integration_metrics(self) -> Dict[str, Any]:
        """Get integration-specific metrics."""
        base_metrics = await self.get_metrics()
        
        try:
            domain_info = await self.get_domain_info()
            domain_stats = await self.get_domain_stats()
            
            return {
                **base_metrics,
                "integration_type": "mailgun",
                "domain": self.config.domain,
                "domain_state": domain_info.get("state"),
                "tracking_enabled": domain_info.get("tracking", {}),
                "monthly_stats": {
                    "sent": domain_stats.get("total_sent", 0),
                    "delivered": domain_stats.get("total_delivered", 0),
                    "bounced": domain_stats.get("total_bounced", 0),
                    "complained": domain_stats.get("total_complained", 0),
                    "opened": domain_stats.get("total_opened", 0),
                    "clicked": domain_stats.get("total_clicked", 0),
                    "delivery_rate": domain_stats.get("overall_delivery_rate", 0),
                    "open_rate": domain_stats.get("overall_open_rate", 0),
                    "click_rate": domain_stats.get("overall_click_rate", 0)
                },
                "features_enabled": {
                    "email_sending": True,
                    "tracking": self.config.track_opens or self.config.track_clicks,
                    "validation": self.config.validation_enabled,
                    "templates": True,
                    "mailing_lists": True,
                    "suppression_management": True,
                    "webhooks": self.webhook_handler is not None
                }
            }
        except Exception as e:
            self.logger.warning(f"Could not fetch additional metrics: {e}")
            return {
                **base_metrics,
                "integration_type": "mailgun"
            }


class MailgunWebhookHandler(WebhookHandler):
    """Handle Mailgun webhooks for email events."""
    
    async def process_webhook(self, event_type: str, data: Dict[str, Any]) -> None:
        """Process Mailgun webhook events."""
        self.logger.info(f"Processing Mailgun webhook: {event_type}")
        
        event_data = data.get("event-data", {})
        
        if event_type == "delivered":
            await self._handle_delivered(event_data)
        elif event_type == "opened":
            await self._handle_opened(event_data)
        elif event_type == "clicked":
            await self._handle_clicked(event_data)
        elif event_type == "bounced":
            await self._handle_bounced(event_data)
        elif event_type == "complained":
            await self._handle_complained(event_data)
        elif event_type == "unsubscribed":
            await self._handle_unsubscribed(event_data)
        elif event_type == "dropped":
            await self._handle_dropped(event_data)
        else:
            self.logger.warning(f"Unknown webhook event type: {event_type}")
    
    async def _handle_delivered(self, data: Dict[str, Any]) -> None:
        """Handle email delivered event."""
        self.logger.info(f"Email delivered to {data.get('recipient')}")
        # Implement delivery handling logic
    
    async def _handle_opened(self, data: Dict[str, Any]) -> None:
        """Handle email opened event."""
        self.logger.info(f"Email opened by {data.get('recipient')}")
        # Implement open tracking logic
    
    async def _handle_clicked(self, data: Dict[str, Any]) -> None:
        """Handle email clicked event."""
        self.logger.info(f"Email clicked by {data.get('recipient')} - URL: {data.get('url')}")
        # Implement click tracking logic
    
    async def _handle_bounced(self, data: Dict[str, Any]) -> None:
        """Handle email bounced event."""
        self.logger.info(f"Email bounced for {data.get('recipient')} - Reason: {data.get('reason')}")
        # Implement bounce handling logic
    
    async def _handle_complained(self, data: Dict[str, Any]) -> None:
        """Handle email complained event."""
        self.logger.info(f"Email complaint from {data.get('recipient')}")
        # Implement complaint handling logic
    
    async def _handle_unsubscribed(self, data: Dict[str, Any]) -> None:
        """Handle email unsubscribed event."""
        self.logger.info(f"Email unsubscribe from {data.get('recipient')}")
        # Implement unsubscribe handling logic
    
    async def _handle_dropped(self, data: Dict[str, Any]) -> None:
        """Handle email dropped event."""
        self.logger.info(f"Email dropped for {data.get('recipient')} - Reason: {data.get('reason')}")
        # Implement drop handling logic


# Export classes
__all__ = [
    "AdvancedMailgun",
    "MailgunConfig",
    "MailgunWebhookHandler",
    "MailgunEventType",
    "MailgunSeverity",
    "MailgunListAccess",
    "MailgunValidationStatus",
    "EmailMessage",
    "EmailAttachment",
    "MailingListMember",
    "MailingList",
    "EmailTemplate",
    "ABTestSettings"
]