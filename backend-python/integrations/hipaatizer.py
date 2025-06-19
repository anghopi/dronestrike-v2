"""
Advanced HIPAATIZER integration for DroneStrike v2.

Provides HIPAA-compliant document signing workflows, template-based generation,
advanced recipient management, electronic signature compliance, and audit trails.
"""

import asyncio
import json
import time
import hashlib
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union, BinaryIO
from enum import Enum
from dataclasses import dataclass, field
import base64

import httpx
from pydantic import BaseModel, validator, Field, EmailStr

from .base import HTTPIntegration, IntegrationConfig, IntegrationError, ValidationError, WebhookHandler, BatchProcessor


class DocumentStatus(Enum):
    """Document status types."""
    DRAFT = "draft"
    SENT = "sent"
    VIEWED = "viewed"
    SIGNED = "signed"
    COMPLETED = "completed"
    DECLINED = "declined"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    ERROR = "error"


class SignerStatus(Enum):
    """Signer status types."""
    PENDING = "pending"
    SENT = "sent"
    VIEWED = "viewed"
    SIGNED = "signed"
    DECLINED = "declined"
    EXPIRED = "expired"


class AuthenticationMethod(Enum):
    """Authentication methods for signers."""
    EMAIL = "email"
    SMS = "sms"
    PHONE_CALL = "phone_call"
    KNOWLEDGE_BASED = "kba"
    ID_VERIFICATION = "id_verification"
    BIOMETRIC = "biometric"


class DocumentType(Enum):
    """Document types."""
    CONSENT_FORM = "consent_form"
    RELEASE_FORM = "release_form"
    AUTHORIZATION = "authorization"
    WAIVER = "waiver"
    AGREEMENT = "agreement"
    MEDICAL_FORM = "medical_form"
    INSURANCE_FORM = "insurance_form"
    CUSTOM = "custom"


class HIPAATIZERConfig(IntegrationConfig):
    """HIPAATIZER-specific configuration."""
    base_url: str = "https://api.hipaatizer.com/v1"
    
    # Webhook settings
    webhook_secret: Optional[str] = None
    webhook_url: Optional[str] = None
    
    # Default settings
    default_expiration_days: int = 30
    require_authentication: bool = True
    auto_remind: bool = True
    reminder_frequency_days: int = 3
    
    # Security settings
    encryption_enabled: bool = True
    audit_trail_detailed: bool = True
    timestamp_server_url: Optional[str] = None
    
    # Compliance settings
    hipaa_compliant: bool = True
    gdpr_compliant: bool = True
    esign_act_compliant: bool = True
    
    class Config:
        extra = "allow"


@dataclass
class DocumentField:
    """Document field definition."""
    field_id: str
    field_type: str  # text, signature, date, checkbox, radio, dropdown
    label: str
    required: bool = True
    x_position: int = 0
    y_position: int = 0
    width: int = 200
    height: int = 40
    page_number: int = 1
    default_value: Optional[str] = None
    options: Optional[List[str]] = None  # For dropdown/radio
    validation_pattern: Optional[str] = None
    tooltip: Optional[str] = None


class Signer(BaseModel):
    """Document signer information."""
    signer_id: str = Field(..., description="Unique signer identifier")
    email: EmailStr = Field(..., description="Signer email address")
    name: str = Field(..., description="Signer full name")
    role: str = Field("signer", description="Signer role")
    phone: Optional[str] = None
    order: int = Field(1, description="Signing order")
    authentication_method: AuthenticationMethod = AuthenticationMethod.EMAIL
    require_id_verification: bool = False
    access_code: Optional[str] = None
    
    # Custom fields for signer
    custom_fields: Optional[Dict[str, str]] = None
    
    # Notification settings
    send_email: bool = True
    language: str = "en"
    message: Optional[str] = None


class Template(BaseModel):
    """Document template."""
    template_id: str = Field(..., description="Template identifier")
    name: str = Field(..., description="Template name")
    description: Optional[str] = None
    document_type: DocumentType = DocumentType.CUSTOM
    fields: List[DocumentField] = Field(default_factory=list)
    active: bool = True
    hipaa_compliant: bool = True
    
    # Template settings
    requires_witness: bool = False
    requires_notary: bool = False
    auto_archive: bool = True
    retention_period_years: int = 7


class DocumentRequest(BaseModel):
    """Document creation request."""
    title: str = Field(..., description="Document title")
    message: Optional[str] = None
    template_id: Optional[str] = None
    document_content: Optional[bytes] = None  # PDF content
    signers: List[Signer] = Field(..., min_items=1)
    fields: Optional[List[DocumentField]] = None
    
    # Document settings
    expiration_date: Optional[datetime] = None
    require_all_signers: bool = True
    signing_order: bool = False
    allow_decline: bool = True
    
    # Security settings
    authentication_required: bool = True
    encryption_enabled: bool = True
    
    # Notification settings
    send_emails: bool = True
    reminder_enabled: bool = True
    reminder_frequency_days: int = 3
    
    # Metadata
    metadata: Optional[Dict[str, str]] = None
    tags: Optional[List[str]] = None


class BulkDocumentRequest(BaseModel):
    """Bulk document processing request."""
    template_id: str
    documents: List[Dict[str, Any]] = Field(..., min_items=1)
    batch_name: Optional[str] = None
    
    # Batch settings
    auto_send: bool = True
    batch_expiration_date: Optional[datetime] = None
    
    class Config:
        extra = "forbid"


class AuditTrailRequest(BaseModel):
    """Audit trail request parameters."""
    document_id: Optional[str] = None
    signer_email: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    event_type: Optional[str] = None
    include_ip_geolocation: bool = True
    
    class Config:
        extra = "forbid"


class AdvancedHIPAATIZER(HTTPIntegration):
    """
    Advanced HIPAATIZER integration with comprehensive e-signature capabilities.
    
    Features:
    - HIPAA-compliant document signing workflows
    - Template-based document generation
    - Advanced recipient management with authentication
    - Electronic signature compliance tracking
    - Audit trail and compliance reporting
    - Custom fields and form integration
    - Webhook notifications for status changes
    - Bulk document processing
    - Multi-factor authentication integration
    - Document encryption and security
    """
    
    def __init__(self, config: HIPAATIZERConfig):
        super().__init__(config)
        self.config: HIPAATIZERConfig = config
        self.batch_processor = BatchProcessor(batch_size=50, max_workers=10)
        self.webhook_handler = None
        
        if config.webhook_secret:
            self.webhook_handler = HIPAATIZERWebhookHandler(config.webhook_secret)
    
    def _initialize_client(self) -> None:
        """Initialize HIPAATIZER HTTP client."""
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(self.config.timeout),
            headers=self._get_default_headers(),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=100)
        )
    
    def _get_default_headers(self) -> Dict[str, str]:
        """Get default headers for HIPAATIZER requests."""
        return {
            "User-Agent": "DroneStrike/2.0 HIPAATIZER Integration",
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-API-Version": "2023-10-01"
        }
    
    async def _perform_health_check(self) -> None:
        """Perform HIPAATIZER API health check."""
        try:
            await self.get_account_info()
        except Exception as e:
            raise IntegrationError(f"HIPAATIZER health check failed: {e}")
    
    # Account Management
    
    async def get_account_info(self) -> Dict[str, Any]:
        """Get account information and limits."""
        url = f"{self.config.base_url}/account"
        
        try:
            response = await self._make_request("GET", url, use_cache=True)
            
            return {
                "account_id": response.get("account_id"),
                "organization_name": response.get("organization_name"),
                "plan": response.get("plan"),
                "features": response.get("features", []),
                "limits": {
                    "documents_per_month": response.get("limits", {}).get("documents_per_month"),
                    "signers_per_document": response.get("limits", {}).get("signers_per_document"),
                    "templates": response.get("limits", {}).get("templates"),
                    "api_calls_per_day": response.get("limits", {}).get("api_calls_per_day")
                },
                "usage": {
                    "documents_this_month": response.get("usage", {}).get("documents_this_month", 0),
                    "api_calls_today": response.get("usage", {}).get("api_calls_today", 0)
                },
                "compliance": {
                    "hipaa_enabled": response.get("compliance", {}).get("hipaa_enabled", False),
                    "gdpr_enabled": response.get("compliance", {}).get("gdpr_enabled", False),
                    "esign_act_compliant": response.get("compliance", {}).get("esign_act_compliant", False)
                }
            }
        except Exception as e:
            self._handle_error(e, "get account info")
    
    # Template Management
    
    async def create_template(self, template: Template) -> Dict[str, Any]:
        """Create a document template."""
        url = f"{self.config.base_url}/templates"
        
        template_data = {
            "template_id": template.template_id,
            "name": template.name,
            "description": template.description,
            "document_type": template.document_type.value,
            "fields": [
                {
                    "field_id": field.field_id,
                    "field_type": field.field_type,
                    "label": field.label,
                    "required": field.required,
                    "position": {
                        "x": field.x_position,
                        "y": field.y_position,
                        "width": field.width,
                        "height": field.height,
                        "page": field.page_number
                    },
                    "default_value": field.default_value,
                    "options": field.options,
                    "validation_pattern": field.validation_pattern,
                    "tooltip": field.tooltip
                }
                for field in template.fields
            ],
            "settings": {
                "active": template.active,
                "hipaa_compliant": template.hipaa_compliant,
                "requires_witness": template.requires_witness,
                "requires_notary": template.requires_notary,
                "auto_archive": template.auto_archive,
                "retention_period_years": template.retention_period_years
            }
        }
        
        try:
            response = await self._make_request("POST", url, data=template_data)
            
            return {
                "template_id": response.get("template_id"),
                "name": template.name,
                "status": "created",
                "fields_count": len(template.fields),
                "created_at": response.get("created_at"),
                "message": response.get("message", "Template created successfully")
            }
        except Exception as e:
            self._handle_error(e, f"create template {template.name}")
    
    async def get_template(self, template_id: str) -> Dict[str, Any]:
        """Get template by ID."""
        url = f"{self.config.base_url}/templates/{template_id}"
        
        try:
            response = await self._make_request("GET", url, use_cache=True)
            return self._format_template_response(response)
        except Exception as e:
            self._handle_error(e, f"get template {template_id}")
    
    async def list_templates(
        self,
        active: Optional[bool] = None,
        document_type: Optional[DocumentType] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """List available templates."""
        url = f"{self.config.base_url}/templates"
        params = {"limit": limit}
        
        if active is not None:
            params["active"] = active
        if document_type:
            params["document_type"] = document_type.value
        
        try:
            response = await self._make_request("GET", url, params=params, use_cache=True)
            templates = response.get("templates", [])
            
            return [self._format_template_response(template) for template in templates]
        except Exception as e:
            self._handle_error(e, "list templates")
    
    async def update_template(
        self,
        template_id: str,
        **kwargs
    ) -> Dict[str, Any]:
        """Update template."""
        url = f"{self.config.base_url}/templates/{template_id}"
        
        try:
            response = await self._make_request("PUT", url, data=kwargs)
            return {
                "template_id": template_id,
                "status": "updated",
                "message": response.get("message", "Template updated successfully")
            }
        except Exception as e:
            self._handle_error(e, f"update template {template_id}")
    
    async def delete_template(self, template_id: str) -> Dict[str, Any]:
        """Delete template."""
        url = f"{self.config.base_url}/templates/{template_id}"
        
        try:
            response = await self._make_request("DELETE", url)
            return {
                "template_id": template_id,
                "status": "deleted",
                "message": response.get("message", "Template deleted successfully")
            }
        except Exception as e:
            self._handle_error(e, f"delete template {template_id}")
    
    def _format_template_response(self, template_data: Dict[str, Any]) -> Dict[str, Any]:
        """Format template response."""
        return {
            "template_id": template_data.get("template_id"),
            "name": template_data.get("name"),
            "description": template_data.get("description"),
            "document_type": template_data.get("document_type"),
            "fields_count": len(template_data.get("fields", [])),
            "active": template_data.get("settings", {}).get("active"),
            "hipaa_compliant": template_data.get("settings", {}).get("hipaa_compliant"),
            "created_at": template_data.get("created_at"),
            "updated_at": template_data.get("updated_at"),
            "usage_count": template_data.get("usage_count", 0)
        }
    
    # Document Management
    
    async def create_document(
        self,
        document_request: DocumentRequest
    ) -> Dict[str, Any]:
        """Create a document for signing."""
        url = f"{self.config.base_url}/documents"
        
        # Prepare document data
        document_data = {
            "title": document_request.title,
            "message": document_request.message,
            "signers": [
                {
                    "signer_id": signer.signer_id,
                    "email": signer.email,
                    "name": signer.name,
                    "role": signer.role,
                    "phone": signer.phone,
                    "order": signer.order,
                    "authentication_method": signer.authentication_method.value,
                    "require_id_verification": signer.require_id_verification,
                    "access_code": signer.access_code,
                    "custom_fields": signer.custom_fields,
                    "notification_settings": {
                        "send_email": signer.send_email,
                        "language": signer.language,
                        "message": signer.message
                    }
                }
                for signer in document_request.signers
            ],
            "settings": {
                "expiration_date": document_request.expiration_date.isoformat() if document_request.expiration_date else None,
                "require_all_signers": document_request.require_all_signers,
                "signing_order": document_request.signing_order,
                "allow_decline": document_request.allow_decline,
                "authentication_required": document_request.authentication_required,
                "encryption_enabled": document_request.encryption_enabled,
                "send_emails": document_request.send_emails,
                "reminder_enabled": document_request.reminder_enabled,
                "reminder_frequency_days": document_request.reminder_frequency_days
            },
            "metadata": document_request.metadata,
            "tags": document_request.tags
        }
        
        # Add template or document content
        if document_request.template_id:
            document_data["template_id"] = document_request.template_id
        elif document_request.document_content:
            document_data["document_content"] = base64.b64encode(document_request.document_content).decode('utf-8')
        
        # Add custom fields
        if document_request.fields:
            document_data["fields"] = [
                {
                    "field_id": field.field_id,
                    "field_type": field.field_type,
                    "label": field.label,
                    "required": field.required,
                    "position": {
                        "x": field.x_position,
                        "y": field.y_position,
                        "width": field.width,
                        "height": field.height,
                        "page": field.page_number
                    },
                    "default_value": field.default_value,
                    "options": field.options,
                    "validation_pattern": field.validation_pattern
                }
                for field in document_request.fields
            ]
        
        try:
            response = await self._make_request("POST", url, data=document_data)
            
            return {
                "document_id": response.get("document_id"),
                "title": document_request.title,
                "status": DocumentStatus.DRAFT.value,
                "signers_count": len(document_request.signers),
                "signing_url": response.get("signing_url"),
                "document_url": response.get("document_url"),
                "expiration_date": document_request.expiration_date,
                "created_at": response.get("created_at"),
                "message": response.get("message", "Document created successfully")
            }
        except Exception as e:
            self._handle_error(e, f"create document {document_request.title}")
    
    async def get_document(self, document_id: str) -> Dict[str, Any]:
        """Get document by ID."""
        url = f"{self.config.base_url}/documents/{document_id}"
        
        try:
            response = await self._make_request("GET", url)
            return self._format_document_response(response)
        except Exception as e:
            self._handle_error(e, f"get document {document_id}")
    
    async def send_document(self, document_id: str) -> Dict[str, Any]:
        """Send document to signers."""
        url = f"{self.config.base_url}/documents/{document_id}/send"
        
        try:
            response = await self._make_request("POST", url)
            
            return {
                "document_id": document_id,
                "status": DocumentStatus.SENT.value,
                "sent_at": response.get("sent_at"),
                "signers_notified": response.get("signers_notified", []),
                "message": response.get("message", "Document sent successfully")
            }
        except Exception as e:
            self._handle_error(e, f"send document {document_id}")
    
    async def cancel_document(self, document_id: str, reason: Optional[str] = None) -> Dict[str, Any]:
        """Cancel document."""
        url = f"{self.config.base_url}/documents/{document_id}/cancel"
        data = {"reason": reason} if reason else {}
        
        try:
            response = await self._make_request("POST", url, data=data)
            
            return {
                "document_id": document_id,
                "status": DocumentStatus.CANCELLED.value,
                "cancelled_at": response.get("cancelled_at"),
                "reason": reason,
                "message": response.get("message", "Document cancelled successfully")
            }
        except Exception as e:
            self._handle_error(e, f"cancel document {document_id}")
    
    async def get_document_status(self, document_id: str) -> Dict[str, Any]:
        """Get detailed document status."""
        url = f"{self.config.base_url}/documents/{document_id}/status"
        
        try:
            response = await self._make_request("GET", url)
            
            return {
                "document_id": document_id,
                "status": response.get("status"),
                "overall_progress": response.get("overall_progress", 0),
                "signers": [
                    {
                        "signer_id": signer.get("signer_id"),
                        "email": signer.get("email"),
                        "name": signer.get("name"),
                        "status": signer.get("status"),
                        "signed_at": signer.get("signed_at"),
                        "viewed_at": signer.get("viewed_at"),
                        "ip_address": signer.get("ip_address"),
                        "user_agent": signer.get("user_agent")
                    }
                    for signer in response.get("signers", [])
                ],
                "created_at": response.get("created_at"),
                "sent_at": response.get("sent_at"),
                "completed_at": response.get("completed_at"),
                "last_activity": response.get("last_activity")
            }
        except Exception as e:
            self._handle_error(e, f"get document status {document_id}")
    
    async def download_document(
        self,
        document_id: str,
        include_audit_trail: bool = True
    ) -> Dict[str, Any]:
        """Download signed document."""
        url = f"{self.config.base_url}/documents/{document_id}/download"
        params = {"include_audit_trail": include_audit_trail}
        
        try:
            response = await self._make_request("GET", url, params=params)
            
            return {
                "document_id": document_id,
                "pdf_content": response.get("pdf_content"),  # Base64 encoded
                "filename": response.get("filename"),
                "file_size": response.get("file_size"),
                "audit_trail_included": include_audit_trail,
                "download_url": response.get("download_url"),
                "expires_at": response.get("expires_at")
            }
        except Exception as e:
            self._handle_error(e, f"download document {document_id}")
    
    async def list_documents(
        self,
        status: Optional[DocumentStatus] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        signer_email: Optional[str] = None,
        template_id: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """List documents with filters."""
        url = f"{self.config.base_url}/documents"
        params = {"limit": limit}
        
        if status:
            params["status"] = status.value
        if date_from:
            params["date_from"] = date_from.isoformat()
        if date_to:
            params["date_to"] = date_to.isoformat()
        if signer_email:
            params["signer_email"] = signer_email
        if template_id:
            params["template_id"] = template_id
        
        try:
            response = await self._make_request("GET", url, params=params)
            documents = response.get("documents", [])
            
            return [self._format_document_response(doc) for doc in documents]
        except Exception as e:
            self._handle_error(e, "list documents")
    
    def _format_document_response(self, document_data: Dict[str, Any]) -> Dict[str, Any]:
        """Format document response."""
        return {
            "document_id": document_data.get("document_id"),
            "title": document_data.get("title"),
            "status": document_data.get("status"),
            "template_id": document_data.get("template_id"),
            "signers_count": len(document_data.get("signers", [])),
            "completed_signatures": sum(1 for s in document_data.get("signers", []) if s.get("status") == "signed"),
            "progress_percentage": document_data.get("progress_percentage", 0),
            "created_at": document_data.get("created_at"),
            "sent_at": document_data.get("sent_at"),
            "completed_at": document_data.get("completed_at"),
            "expires_at": document_data.get("expires_at"),
            "tags": document_data.get("tags", []),
            "metadata": document_data.get("metadata", {})
        }
    
    # Bulk Processing
    
    async def create_bulk_documents(
        self,
        bulk_request: BulkDocumentRequest
    ) -> Dict[str, Any]:
        """Create multiple documents from template."""
        url = f"{self.config.base_url}/documents/bulk"
        
        bulk_data = {
            "template_id": bulk_request.template_id,
            "batch_name": bulk_request.batch_name,
            "documents": bulk_request.documents,
            "settings": {
                "auto_send": bulk_request.auto_send,
                "batch_expiration_date": bulk_request.batch_expiration_date.isoformat() if bulk_request.batch_expiration_date else None
            }
        }
        
        try:
            response = await self._make_request("POST", url, data=bulk_data)
            
            return {
                "batch_id": response.get("batch_id"),
                "batch_name": bulk_request.batch_name,
                "template_id": bulk_request.template_id,
                "documents_created": response.get("documents_created", 0),
                "documents_sent": response.get("documents_sent", 0) if bulk_request.auto_send else 0,
                "failed_documents": response.get("failed_documents", []),
                "status": "processing",
                "created_at": response.get("created_at"),
                "estimated_completion": response.get("estimated_completion")
            }
        except Exception as e:
            self._handle_error(e, f"create bulk documents for template {bulk_request.template_id}")
    
    async def get_bulk_status(self, batch_id: str) -> Dict[str, Any]:
        """Get bulk processing status."""
        url = f"{self.config.base_url}/documents/bulk/{batch_id}/status"
        
        try:
            response = await self._make_request("GET", url)
            
            return {
                "batch_id": batch_id,
                "status": response.get("status"),
                "total_documents": response.get("total_documents", 0),
                "completed_documents": response.get("completed_documents", 0),
                "signed_documents": response.get("signed_documents", 0),
                "failed_documents": response.get("failed_documents", 0),
                "progress_percentage": response.get("progress_percentage", 0),
                "created_at": response.get("created_at"),
                "completed_at": response.get("completed_at"),
                "documents": response.get("documents", [])
            }
        except Exception as e:
            self._handle_error(e, f"get bulk status {batch_id}")
    
    # Audit Trail and Compliance
    
    async def get_audit_trail(
        self,
        audit_request: AuditTrailRequest
    ) -> Dict[str, Any]:
        """Get detailed audit trail."""
        url = f"{self.config.base_url}/audit-trail"
        
        params = {}
        if audit_request.document_id:
            params["document_id"] = audit_request.document_id
        if audit_request.signer_email:
            params["signer_email"] = audit_request.signer_email
        if audit_request.date_from:
            params["date_from"] = audit_request.date_from.isoformat()
        if audit_request.date_to:
            params["date_to"] = audit_request.date_to.isoformat()
        if audit_request.event_type:
            params["event_type"] = audit_request.event_type
        
        params["include_ip_geolocation"] = audit_request.include_ip_geolocation
        
        try:
            response = await self._make_request("GET", url, params=params)
            
            events = []
            for event in response.get("events", []):
                processed_event = {
                    "event_id": event.get("event_id"),
                    "document_id": event.get("document_id"),
                    "event_type": event.get("event_type"),
                    "timestamp": event.get("timestamp"),
                    "actor": {
                        "email": event.get("actor", {}).get("email"),
                        "name": event.get("actor", {}).get("name"),
                        "role": event.get("actor", {}).get("role"),
                        "ip_address": event.get("actor", {}).get("ip_address"),
                        "user_agent": event.get("actor", {}).get("user_agent")
                    },
                    "details": event.get("details", {}),
                    "compliance_data": {
                        "timezone": event.get("compliance_data", {}).get("timezone"),
                        "timestamp_server": event.get("compliance_data", {}).get("timestamp_server"),
                        "digital_certificate": event.get("compliance_data", {}).get("digital_certificate")
                    }
                }
                
                # Add geolocation if requested
                if audit_request.include_ip_geolocation and event.get("geolocation"):
                    processed_event["geolocation"] = {
                        "country": event.get("geolocation", {}).get("country"),
                        "region": event.get("geolocation", {}).get("region"),
                        "city": event.get("geolocation", {}).get("city"),
                        "latitude": event.get("geolocation", {}).get("latitude"),
                        "longitude": event.get("geolocation", {}).get("longitude")
                    }
                
                events.append(processed_event)
            
            return {
                "total_events": response.get("total_events", 0),
                "events": events,
                "compliance_summary": {
                    "hipaa_compliant": response.get("compliance_summary", {}).get("hipaa_compliant"),
                    "esign_act_compliant": response.get("compliance_summary", {}).get("esign_act_compliant"),
                    "timestamp_verified": response.get("compliance_summary", {}).get("timestamp_verified"),
                    "identity_verified": response.get("compliance_summary", {}).get("identity_verified")
                },
                "generated_at": response.get("generated_at")
            }
        except Exception as e:
            self._handle_error(e, "get audit trail")
    
    async def generate_compliance_report(
        self,
        date_from: datetime,
        date_to: datetime,
        report_type: str = "full"
    ) -> Dict[str, Any]:
        """Generate compliance report."""
        url = f"{self.config.base_url}/compliance/report"
        
        data = {
            "date_from": date_from.isoformat(),
            "date_to": date_to.isoformat(),
            "report_type": report_type,
            "include_audit_trails": True,
            "include_certificates": True
        }
        
        try:
            response = await self._make_request("POST", url, data=data)
            
            return {
                "report_id": response.get("report_id"),
                "report_type": report_type,
                "period": {
                    "from": date_from.isoformat(),
                    "to": date_to.isoformat()
                },
                "summary": {
                    "total_documents": response.get("summary", {}).get("total_documents", 0),
                    "completed_documents": response.get("summary", {}).get("completed_documents", 0),
                    "compliance_rate": response.get("summary", {}).get("compliance_rate", 0),
                    "security_events": response.get("summary", {}).get("security_events", 0)
                },
                "download_url": response.get("download_url"),
                "expires_at": response.get("expires_at"),
                "generated_at": response.get("generated_at")
            }
        except Exception as e:
            self._handle_error(e, "generate compliance report")
    
    # Webhook Management
    
    async def create_webhook(
        self,
        url: str,
        events: List[str],
        secret: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create webhook endpoint."""
        webhook_url = f"{self.config.base_url}/webhooks"
        
        data = {
            "url": url,
            "events": events,
            "secret": secret or self.config.webhook_secret,
            "active": True
        }
        
        try:
            response = await self._make_request("POST", webhook_url, data=data)
            
            return {
                "webhook_id": response.get("webhook_id"),
                "url": url,
                "events": events,
                "status": "active",
                "created_at": response.get("created_at"),
                "secret": response.get("secret")  # Returns masked secret
            }
        except Exception as e:
            self._handle_error(e, f"create webhook for {url}")
    
    async def list_webhooks(self) -> List[Dict[str, Any]]:
        """List configured webhooks."""
        url = f"{self.config.base_url}/webhooks"
        
        try:
            response = await self._make_request("GET", url)
            webhooks = response.get("webhooks", [])
            
            return [
                {
                    "webhook_id": webhook.get("webhook_id"),
                    "url": webhook.get("url"),
                    "events": webhook.get("events", []),
                    "active": webhook.get("active"),
                    "created_at": webhook.get("created_at"),
                    "last_delivery": webhook.get("last_delivery")
                }
                for webhook in webhooks
            ]
        except Exception as e:
            self._handle_error(e, "list webhooks")
    
    # Analytics and Reporting
    
    async def get_usage_statistics(
        self,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get usage statistics."""
        if not date_from:
            date_from = datetime.now() - timedelta(days=30)
        if not date_to:
            date_to = datetime.now()
        
        url = f"{self.config.base_url}/analytics/usage"
        params = {
            "date_from": date_from.isoformat(),
            "date_to": date_to.isoformat()
        }
        
        try:
            response = await self._make_request("GET", url, params=params)
            
            return {
                "period": {
                    "from": date_from.isoformat(),
                    "to": date_to.isoformat(),
                    "days": (date_to - date_from).days
                },
                "documents": {
                    "total_created": response.get("documents", {}).get("total_created", 0),
                    "total_sent": response.get("documents", {}).get("total_sent", 0),
                    "total_completed": response.get("documents", {}).get("total_completed", 0),
                    "total_declined": response.get("documents", {}).get("total_declined", 0),
                    "completion_rate": response.get("documents", {}).get("completion_rate", 0)
                },
                "templates": {
                    "total_templates": response.get("templates", {}).get("total_templates", 0),
                    "most_used_template": response.get("templates", {}).get("most_used_template"),
                    "template_usage": response.get("templates", {}).get("template_usage", {})
                },
                "signers": {
                    "unique_signers": response.get("signers", {}).get("unique_signers", 0),
                    "average_signing_time": response.get("signers", {}).get("average_signing_time", 0),
                    "authentication_methods": response.get("signers", {}).get("authentication_methods", {})
                },
                "daily_activity": response.get("daily_activity", [])
            }
        except Exception as e:
            self._handle_error(e, "get usage statistics")
    
    async def get_integration_metrics(self) -> Dict[str, Any]:
        """Get integration-specific metrics."""
        base_metrics = await self.get_metrics()
        
        try:
            account_info = await self.get_account_info()
            usage_stats = await self.get_usage_statistics()
            
            return {
                **base_metrics,
                "integration_type": "hipaatizer",
                "account_id": account_info.get("account_id"),
                "plan": account_info.get("plan"),
                "compliance": account_info.get("compliance", {}),
                "limits": account_info.get("limits", {}),
                "current_usage": account_info.get("usage", {}),
                "recent_activity": {
                    "documents_created": usage_stats.get("documents", {}).get("total_created", 0),
                    "documents_completed": usage_stats.get("documents", {}).get("total_completed", 0),
                    "completion_rate": usage_stats.get("documents", {}).get("completion_rate", 0),
                    "unique_signers": usage_stats.get("signers", {}).get("unique_signers", 0)
                },
                "features_enabled": {
                    "templates": True,
                    "bulk_processing": True,
                    "audit_trails": True,
                    "compliance_reporting": True,
                    "webhooks": self.webhook_handler is not None,
                    "multi_factor_auth": True,
                    "encryption": self.config.encryption_enabled,
                    "hipaa_compliance": self.config.hipaa_compliant
                }
            }
        except Exception as e:
            self.logger.warning(f"Could not fetch additional metrics: {e}")
            return {
                **base_metrics,
                "integration_type": "hipaatizer"
            }


class HIPAATIZERWebhookHandler(WebhookHandler):
    """Handle HIPAATIZER webhooks for document events."""
    
    async def process_webhook(self, event_type: str, data: Dict[str, Any]) -> None:
        """Process HIPAATIZER webhook events."""
        self.logger.info(f"Processing HIPAATIZER webhook: {event_type}")
        
        if event_type == "document.created":
            await self._handle_document_created(data)
        elif event_type == "document.sent":
            await self._handle_document_sent(data)
        elif event_type == "document.viewed":
            await self._handle_document_viewed(data)
        elif event_type == "document.signed":
            await self._handle_document_signed(data)
        elif event_type == "document.completed":
            await self._handle_document_completed(data)
        elif event_type == "document.declined":
            await self._handle_document_declined(data)
        elif event_type == "document.expired":
            await self._handle_document_expired(data)
        elif event_type == "signer.authenticated":
            await self._handle_signer_authenticated(data)
        elif event_type == "audit.event":
            await self._handle_audit_event(data)
        else:
            self.logger.warning(f"Unknown webhook event type: {event_type}")
    
    async def _handle_document_created(self, data: Dict[str, Any]) -> None:
        """Handle document creation event."""
        document = data.get("document", {})
        self.logger.info(f"Document created: {document.get('document_id')} - {document.get('title')}")
        # Implement document creation handling logic
    
    async def _handle_document_sent(self, data: Dict[str, Any]) -> None:
        """Handle document sent event."""
        document = data.get("document", {})
        self.logger.info(f"Document sent: {document.get('document_id')} to {len(document.get('signers', []))} signers")
        # Implement document sent handling logic
    
    async def _handle_document_viewed(self, data: Dict[str, Any]) -> None:
        """Handle document viewed event."""
        document = data.get("document", {})
        signer = data.get("signer", {})
        self.logger.info(f"Document viewed: {document.get('document_id')} by {signer.get('email')}")
        # Implement document viewed handling logic
    
    async def _handle_document_signed(self, data: Dict[str, Any]) -> None:
        """Handle document signed event."""
        document = data.get("document", {})
        signer = data.get("signer", {})
        self.logger.info(f"Document signed: {document.get('document_id')} by {signer.get('email')}")
        # Implement document signed handling logic
    
    async def _handle_document_completed(self, data: Dict[str, Any]) -> None:
        """Handle document completion event."""
        document = data.get("document", {})
        self.logger.info(f"Document completed: {document.get('document_id')} - All signatures collected")
        # Implement document completion handling logic
    
    async def _handle_document_declined(self, data: Dict[str, Any]) -> None:
        """Handle document declined event."""
        document = data.get("document", {})
        signer = data.get("signer", {})
        self.logger.info(f"Document declined: {document.get('document_id')} by {signer.get('email')}")
        # Implement document declined handling logic
    
    async def _handle_document_expired(self, data: Dict[str, Any]) -> None:
        """Handle document expired event."""
        document = data.get("document", {})
        self.logger.info(f"Document expired: {document.get('document_id')}")
        # Implement document expired handling logic
    
    async def _handle_signer_authenticated(self, data: Dict[str, Any]) -> None:
        """Handle signer authentication event."""
        signer = data.get("signer", {})
        auth_method = data.get("authentication_method")
        self.logger.info(f"Signer authenticated: {signer.get('email')} via {auth_method}")
        # Implement signer authentication handling logic
    
    async def _handle_audit_event(self, data: Dict[str, Any]) -> None:
        """Handle audit trail event."""
        event = data.get("event", {})
        self.logger.info(f"Audit event: {event.get('event_type')} for document {event.get('document_id')}")
        # Implement audit event handling logic


# Export classes
__all__ = [
    "AdvancedHIPAATIZER",
    "HIPAATIZERConfig",
    "HIPAATIZERWebhookHandler",
    "DocumentStatus",
    "SignerStatus",
    "AuthenticationMethod",
    "DocumentType",
    "DocumentField",
    "Signer",
    "Template",
    "DocumentRequest",
    "BulkDocumentRequest",
    "AuditTrailRequest"
]