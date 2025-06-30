"""
Enhanced Communication API Router - Comprehensive Communication System
Provides complete email automation, SMS integration, campaign management, and analytics
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from pydantic import BaseModel, Field, EmailStr, validator
import logging
from enum import Enum

from core.database import get_db
from models.user import User
from api.dependencies import get_current_user
from services.communication_service import CommunicationService, CommunicationChannelType, MessageStatus, CampaignStatus

router = APIRouter()
logger = logging.getLogger(__name__)


# Pydantic Models

class ContactCreate(BaseModel):
    """Contact creation request"""
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    first_name: str = ""
    last_name: str = ""
    custom_fields: Optional[Dict[str, Any]] = {}
    contact_lists: Optional[List[str]] = []
    
    @validator('email', 'phone')
    def validate_contact_info(cls, v, values):
        if not v and not values.get('email') and not values.get('phone'):
            raise ValueError('Either email or phone must be provided')
        return v


class ContactUpdate(BaseModel):
    """Contact update request"""
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    custom_fields: Optional[Dict[str, Any]] = None
    email_subscribed: Optional[bool] = None
    sms_subscribed: Optional[bool] = None


class ContactListCreate(BaseModel):
    """Contact list creation request"""
    name: str = Field(..., min_length=1, max_length=255)
    description: str = ""
    tags: Optional[List[str]] = []


class TemplateCreate(BaseModel):
    """Message template creation request"""
    name: str = Field(..., min_length=1, max_length=255)
    channel_type: CommunicationChannelType
    subject: str = ""
    body_text: str = Field(..., min_length=1)
    body_html: str = ""
    variables: Optional[List[str]] = []


class CampaignCreate(BaseModel):
    """Campaign creation request"""
    name: str = Field(..., min_length=1, max_length=255)
    channel_type: CommunicationChannelType
    subject: str = ""
    body_text: str = Field(..., min_length=1)
    body_html: str = ""
    contact_lists: Optional[List[str]] = []
    individual_contacts: Optional[List[str]] = []
    template_id: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    send_immediately: bool = False


class EmailSend(BaseModel):
    """Email sending request"""
    to_email: EmailStr
    subject: str = Field(..., min_length=1)
    body_text: str = Field(..., min_length=1)
    body_html: str = ""
    from_email: Optional[str] = None
    template_id: Optional[str] = None
    track_opens: bool = True
    track_clicks: bool = True


class SMSSend(BaseModel):
    """SMS sending request"""
    to_phone: str = Field(..., min_length=10)
    body_text: str = Field(..., min_length=1, max_length=1600)
    from_phone: Optional[str] = None
    template_id: Optional[str] = None


class AutomationCreate(BaseModel):
    """Automation workflow creation request"""
    name: str = Field(..., min_length=1, max_length=255)
    trigger_type: str
    trigger_conditions: Dict[str, Any]
    workflow_steps: List[Dict[str, Any]]


class UnsubscribeRequest(BaseModel):
    """Unsubscribe request"""
    contact_id: str
    channel_type: CommunicationChannelType
    reason: str = ""


# Contact Management Endpoints

@router.post("/contacts")
async def create_contact(
    contact_data: ContactCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new contact"""
    try:
        service = CommunicationService(db)
        contact = service.create_contact(
            email=contact_data.email,
            phone=contact_data.phone,
            first_name=contact_data.first_name,
            last_name=contact_data.last_name,
            custom_fields=contact_data.custom_fields,
            contact_lists=contact_data.contact_lists
        )
        
        return {
            "id": contact.id,
            "email": contact.email,
            "phone": contact.phone,
            "first_name": contact.first_name,
            "last_name": contact.last_name,
            "full_name": contact.full_name,
            "custom_fields": contact.custom_fields,
            "email_subscribed": contact.email_subscribed,
            "sms_subscribed": contact.sms_subscribed
        }
        
    except Exception as e:
        logger.error(f"Error creating contact: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/contacts")
async def get_contacts(
    query: str = Query("", description="Search query"),
    email_subscribed: Optional[bool] = Query(None),
    sms_subscribed: Optional[bool] = Query(None),
    tags: Optional[List[str]] = Query(None),
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search and filter contacts"""
    try:
        service = CommunicationService(db)
        result = service.search_contacts(
            query=query,
            email_subscribed=email_subscribed,
            sms_subscribed=sms_subscribed,
            tags=tags or [],
            limit=limit,
            offset=offset
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error fetching contacts: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch contacts")


@router.put("/contacts/{contact_id}")
async def update_contact(
    contact_id: str,
    contact_data: ContactUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a contact"""
    try:
        service = CommunicationService(db)
        contact = service.update_contact(
            contact_id=contact_id,
            **contact_data.dict(exclude_unset=True)
        )
        
        return {
            "id": contact.id,
            "email": contact.email,
            "phone": contact.phone,
            "first_name": contact.first_name,
            "last_name": contact.last_name,
            "full_name": contact.full_name,
            "email_subscribed": contact.email_subscribed,
            "sms_subscribed": contact.sms_subscribed
        }
        
    except Exception as e:
        logger.error(f"Error updating contact: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/contact-lists")
async def get_contact_lists(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get contact lists for user"""
    try:
        service = CommunicationService(db)
        contact_lists = service.get_contact_lists(current_user.id)
        
        return {"contact_lists": contact_lists}
        
    except Exception as e:
        logger.error(f"Error fetching contact lists: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch contact lists")


# Template Management Endpoints

@router.post("/templates")
async def create_template(
    template_data: TemplateCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a message template"""
    try:
        service = CommunicationService(db)
        template = service.create_template(
            name=template_data.name,
            channel_type=template_data.channel_type.value,
            subject=template_data.subject,
            body_text=template_data.body_text,
            body_html=template_data.body_html,
            variables=template_data.variables,
            user_id=current_user.id
        )
        
        return {
            "id": template.id,
            "name": template.name,
            "channel_type": template.channel_type,
            "subject": template.subject,
            "body_text": template.body_text,
            "body_html": template.body_html,
            "variables": template.variables
        }
        
    except Exception as e:
        logger.error(f"Error creating template: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/templates")
async def get_templates(
    channel_type: Optional[CommunicationChannelType] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get message templates"""
    try:
        service = CommunicationService(db)
        templates = service.get_templates(
            channel_type=channel_type.value if channel_type else None,
            user_id=current_user.id
        )
        
        return {"templates": templates}
        
    except Exception as e:
        logger.error(f"Error fetching templates: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch templates")


@router.post("/templates/{template_id}/render")
async def render_template(
    template_id: str,
    variables: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Render template with variables"""
    try:
        service = CommunicationService(db)
        rendered = service.render_template(template_id, variables)
        
        return rendered
        
    except Exception as e:
        logger.error(f"Error rendering template: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# Campaign Management Endpoints

@router.post("/campaigns")
async def create_campaign(
    campaign_data: CampaignCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a communication campaign"""
    try:
        service = CommunicationService(db)
        campaign = service.create_campaign(
            name=campaign_data.name,
            channel_type=campaign_data.channel_type.value,
            subject=campaign_data.subject,
            body_text=campaign_data.body_text,
            body_html=campaign_data.body_html,
            contact_lists=campaign_data.contact_lists,
            individual_contacts=campaign_data.individual_contacts,
            scheduled_at=campaign_data.scheduled_at,
            template_id=campaign_data.template_id,
            user_id=current_user.id
        )
        
        # Start campaign immediately if requested
        if campaign_data.send_immediately:
            service.start_campaign(campaign.id)
        
        return {
            "id": campaign.id,
            "name": campaign.name,
            "channel_type": campaign.channel_type,
            "status": campaign.status,
            "subject": campaign.subject,
            "total_recipients": campaign.total_recipients,
            "scheduled_at": campaign.scheduled_at.isoformat() if campaign.scheduled_at else None
        }
        
    except Exception as e:
        logger.error(f"Error creating campaign: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/campaigns")
async def get_campaigns(
    status: Optional[CampaignStatus] = Query(None),
    channel_type: Optional[CommunicationChannelType] = Query(None),
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get campaigns with filtering"""
    try:
        service = CommunicationService(db)
        result = service.get_campaigns(
            status=status.value if status else None,
            channel_type=channel_type.value if channel_type else None,
            user_id=current_user.id,
            limit=limit,
            offset=offset
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error fetching campaigns: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch campaigns")


@router.post("/campaigns/{campaign_id}/start")
async def start_campaign(
    campaign_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Start a campaign"""
    try:
        service = CommunicationService(db)
        success = service.start_campaign(campaign_id)
        
        if not success:
            raise HTTPException(status_code=400, detail="Failed to start campaign")
        
        return {"message": "Campaign started successfully"}
        
    except Exception as e:
        logger.error(f"Error starting campaign: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/campaigns/{campaign_id}/pause")
async def pause_campaign(
    campaign_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Pause a running campaign"""
    try:
        service = CommunicationService(db)
        success = service.pause_campaign(campaign_id)
        
        if not success:
            raise HTTPException(status_code=400, detail="Failed to pause campaign")
        
        return {"message": "Campaign paused successfully"}
        
    except Exception as e:
        logger.error(f"Error pausing campaign: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/campaigns/{campaign_id}/cancel")
async def cancel_campaign(
    campaign_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel a campaign"""
    try:
        service = CommunicationService(db)
        success = service.cancel_campaign(campaign_id)
        
        if not success:
            raise HTTPException(status_code=400, detail="Failed to cancel campaign")
        
        return {"message": "Campaign cancelled successfully"}
        
    except Exception as e:
        logger.error(f"Error cancelling campaign: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# Message Sending Endpoints

@router.post("/messages/email")
async def send_email(
    email_data: EmailSend,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send an individual email"""
    try:
        service = CommunicationService(db)
        message = service.send_email(
            to_email=email_data.to_email,
            subject=email_data.subject,
            body_text=email_data.body_text,
            body_html=email_data.body_html,
            from_email=email_data.from_email,
            template_id=email_data.template_id,
            track_opens=email_data.track_opens,
            track_clicks=email_data.track_clicks
        )
        
        return message
        
    except Exception as e:
        logger.error(f"Error sending email: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/messages/sms")
async def send_sms(
    sms_data: SMSSend,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send an SMS message"""
    try:
        service = CommunicationService(db)
        message = service.send_sms(
            to_phone=sms_data.to_phone,
            body_text=sms_data.body_text,
            from_phone=sms_data.from_phone,
            template_id=sms_data.template_id
        )
        
        return message
        
    except Exception as e:
        logger.error(f"Error sending SMS: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# Analytics Endpoints

@router.get("/analytics")
async def get_communication_analytics(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    channel_type: Optional[CommunicationChannelType] = Query(None),
    campaign_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get comprehensive communication analytics"""
    try:
        service = CommunicationService(db)
        analytics = service.get_communication_analytics(
            start_date=start_date,
            end_date=end_date,
            channel_type=channel_type.value if channel_type else None,
            campaign_id=campaign_id
        )
        
        return analytics
        
    except Exception as e:
        logger.error(f"Error fetching analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch analytics")


@router.get("/campaigns/{campaign_id}/performance")
async def get_campaign_performance(
    campaign_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed campaign performance metrics"""
    try:
        service = CommunicationService(db)
        performance = service.get_campaign_performance(campaign_id)
        
        return performance
        
    except Exception as e:
        logger.error(f"Error fetching campaign performance: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch campaign performance")


# Automation Endpoints

@router.post("/automations")
async def create_automation(
    automation_data: AutomationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create an automation workflow"""
    try:
        service = CommunicationService(db)
        automation = service.create_automation(
            name=automation_data.name,
            trigger_type=automation_data.trigger_type,
            trigger_conditions=automation_data.trigger_conditions,
            workflow_steps=automation_data.workflow_steps,
            user_id=current_user.id
        )
        
        return automation
        
    except Exception as e:
        logger.error(f"Error creating automation: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/automations/{automation_id}/trigger")
async def trigger_automation(
    automation_id: str,
    contact_id: str,
    trigger_data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually trigger an automation for a contact"""
    try:
        service = CommunicationService(db)
        success = service.trigger_automation(automation_id, contact_id, trigger_data)
        
        if not success:
            raise HTTPException(status_code=400, detail="Failed to trigger automation")
        
        return {"message": "Automation triggered successfully"}
        
    except Exception as e:
        logger.error(f"Error triggering automation: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# Webhook Endpoints

@router.post("/webhooks/mailgun")
async def mailgun_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """Handle Mailgun delivery webhooks"""
    try:
        event_data = await request.json()
        
        service = CommunicationService(db)
        success = service.handle_mailgun_webhook(event_data)
        
        if not success:
            raise HTTPException(status_code=400, detail="Failed to process webhook")
        
        return {"status": "success"}
        
    except Exception as e:
        logger.error(f"Error processing Mailgun webhook: {e}")
        return JSONResponse(status_code=200, content={"status": "error"})


@router.post("/webhooks/twilio")
async def twilio_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """Handle Twilio delivery webhooks"""
    try:
        form_data = await request.form()
        event_data = dict(form_data)
        
        service = CommunicationService(db)
        success = service.handle_twilio_webhook(event_data)
        
        if not success:
            raise HTTPException(status_code=400, detail="Failed to process webhook")
        
        return {"status": "success"}
        
    except Exception as e:
        logger.error(f"Error processing Twilio webhook: {e}")
        return JSONResponse(status_code=200, content={"status": "error"})


# Unsubscribe Management

@router.post("/unsubscribe")
async def process_unsubscribe(
    unsubscribe_data: UnsubscribeRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Process an unsubscribe request"""
    try:
        service = CommunicationService(db)
        
        # Get client IP for tracking
        client_ip = request.client.host
        
        success = service.process_unsubscribe(
            contact_id=unsubscribe_data.contact_id,
            channel_type=unsubscribe_data.channel_type.value,
            reason=unsubscribe_data.reason,
            ip_address=client_ip
        )
        
        if not success:
            raise HTTPException(status_code=400, detail="Failed to process unsubscribe")
        
        return {"message": "Unsubscribe processed successfully"}
        
    except Exception as e:
        logger.error(f"Error processing unsubscribe: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/suppression-list")
async def get_suppression_list(
    channel_type: CommunicationChannelType,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get suppression list for channel"""
    try:
        service = CommunicationService(db)
        suppression_list = service.get_suppression_list(channel_type.value)
        
        return {"suppression_list": suppression_list}
        
    except Exception as e:
        logger.error(f"Error fetching suppression list: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch suppression list")