"""Integration pages implementation (Gmail, external APIs, etc.)"""

from typing import Dict, Any, Optional, List
from pydantic import BaseModel, validator, EmailStr
from sqlalchemy.orm import Session
from fastapi import Request
from datetime import datetime
from enum import Enum
import json

from .base import BasePage, PageResponse


class IntegrationType(str, Enum):
    """Integration type enumeration"""
    EMAIL = "email"
    CALENDAR = "calendar"
    CRM = "crm"
    STORAGE = "storage"
    PAYMENT = "payment"
    COMMUNICATION = "communication"
    ANALYTICS = "analytics"
    MAPPING = "mapping"


class IntegrationStatus(str, Enum):
    """Integration status enumeration."""
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"
    PENDING = "pending"
    EXPIRED = "expired"


class GmailIntegrationForm(BaseModel):
    """Gmail integration form validation"""
    email: EmailStr
    sync_sent: bool = True
    sync_received: bool = True
    auto_categorize: bool = True
    sync_frequency: str = "realtime"  # realtime, hourly, daily
    folder_mapping: Optional[Dict[str, str]] = {}
    
    @validator('sync_frequency')
    def validate_sync_frequency(cls, v):
        allowed = ['realtime', 'hourly', 'daily']
        if v not in allowed:
            raise ValueError(f'Sync frequency must be one of: {", ".join(allowed)}')
        return v


class CalendarIntegrationForm(BaseModel):
    """Calendar integration form validation"""
    provider: str  # google, outlook, apple
    sync_missions: bool = True
    create_events: bool = True
    send_reminders: bool = True
    calendar_id: Optional[str] = None
    
    @validator('provider')
    def validate_provider(cls, v):
        allowed = ['google', 'outlook', 'apple']
        if v not in allowed:
            raise ValueError(f'Provider must be one of: {", ".join(allowed)}')
        return v


class CRMIntegrationForm(BaseModel):
    """CRM integration form validation"""
    crm_type: str  # salesforce, hubspot, pipedrive, etc.
    api_key: str
    sync_contacts: bool = True
    sync_opportunities: bool = True
    auto_create_leads: bool = True
    field_mapping: Optional[Dict[str, str]] = {}
    
    @validator('api_key')
    def api_key_required(cls, v):
        if not v or not v.strip():
            raise ValueError('API key is required')
        return v.strip()


class WebhookForm(BaseModel):
    """Webhook configuration form validation."""
    name: str
    url: str
    events: List[str]
    secret: Optional[str] = None
    is_active: bool = True
    retry_attempts: int = 3
    
    @validator('name', 'url')
    def required_fields(cls, v):
        if not v or not v.strip():
            raise ValueError('This field is required')
        return v.strip()
    
    @validator('url')
    def validate_url(cls, v):
        if not v.startswith(('http://', 'https://')):
            raise ValueError('URL must start with http:// or https://')
        return v
    
    @validator('events')
    def events_not_empty(cls, v):
        if not v:
            raise ValueError('At least one event must be selected')
        return v
    
    @validator('retry_attempts')
    def validate_retry_attempts(cls, v):
        if v < 0 or v > 10:
            raise ValueError('Retry attempts must be between 0 and 10')
        return v


class APIKeyForm(BaseModel):
    """API key generation form validation"""
    name: str
    description: Optional[str] = None
    permissions: List[str]
    expires_at: Optional[datetime] = None
    
    @validator('name')
    def name_required(cls, v):
        if not v or not v.strip():
            raise ValueError('API key name is required')
        return v.strip()
    
    @validator('permissions')
    def permissions_not_empty(cls, v):
        if not v:
            raise ValueError('At least one permission must be selected')
        return v


class GmailIntegrationPage(BasePage):
    """Gmail integration management page"""
    
    def get_page_data(self) -> PageResponse:
        """Get Gmail integration page data"""
        self.require_authentication()
        
        try:
            # Get current Gmail integration status
            gmail_integration = self._get_gmail_integration()
            
            # Get email statistics
            email_stats = self._get_email_statistics()
            
            # Get sync history
            sync_history = self._get_sync_history()
            
            # Get available integrations
            available_integrations = self._get_available_integrations()
            
            # Get webhooks
            webhooks = self._get_user_webhooks()
            
            # Get API keys
            api_keys = self._get_user_api_keys()
            
            # Get integration logs
            integration_logs = self._get_integration_logs()
            
            return self.create_response(data={
                'title': 'Integrations - DroneStrike',
                'gmail_integration': gmail_integration,
                'email_stats': email_stats,
                'sync_history': sync_history,
                'available_integrations': available_integrations,
                'webhooks': webhooks,
                'api_keys': api_keys,
                'integration_logs': integration_logs,
                'sync_frequencies': [
                    {'value': 'realtime', 'label': 'Real-time'},
                    {'value': 'hourly', 'label': 'Every hour'},
                    {'value': 'daily', 'label': 'Daily'}
                ],
                'webhook_events': [
                    'mission.created', 'mission.updated', 'mission.completed',
                    'payment.received', 'user.registered', 'task.assigned'
                ],
                'api_permissions': [
                    'read:missions', 'write:missions', 'read:users', 'write:users',
                    'read:analytics', 'write:webhooks'
                ],
                'integration_categories': [
                    {'id': 'email', 'name': 'Email & Communication', 'icon': 'mail'},
                    {'id': 'calendar', 'name': 'Calendar & Scheduling', 'icon': 'calendar'},
                    {'id': 'crm', 'name': 'CRM & Sales', 'icon': 'users'},
                    {'id': 'storage', 'name': 'File Storage', 'icon': 'folder'},
                    {'id': 'analytics', 'name': 'Analytics & Reporting', 'icon': 'bar-chart'},
                    {'id': 'mapping', 'name': 'Mapping & GIS', 'icon': 'map'}
                ]
            })
            
        except Exception as e:
            self.add_error('Failed to load integrations page')
            return self.create_response(success=False)
    
    def handle_form_submission(self, form_data: Dict[str, Any]) -> PageResponse:
        """Handle integration form submissions."""
        self.require_authentication()
        
        action = form_data.get('action')
        
        if action == 'connect_gmail':
            return self._connect_gmail(form_data)
        elif action == 'disconnect_gmail':
            return self._disconnect_gmail(form_data)
        elif action == 'update_gmail_settings':
            return self._update_gmail_settings(form_data)
        elif action == 'test_gmail_connection':
            return self._test_gmail_connection(form_data)
        elif action == 'sync_gmail_now':
            return self._sync_gmail_now(form_data)
        elif action == 'connect_calendar':
            return self._connect_calendar(form_data)
        elif action == 'connect_crm':
            return self._connect_crm(form_data)
        elif action == 'create_webhook':
            return self._create_webhook(form_data)
        elif action == 'update_webhook':
            return self._update_webhook(form_data)
        elif action == 'delete_webhook':
            return self._delete_webhook(form_data)
        elif action == 'test_webhook':
            return self._test_webhook(form_data)
        elif action == 'generate_api_key':
            return self._generate_api_key(form_data)
        elif action == 'revoke_api_key':
            return self._revoke_api_key(form_data)
        else:
            self.add_error('Invalid action')
            return self.create_response(success=False)
    
    def _connect_gmail(self, form_data: Dict[str, Any]) -> PageResponse:
        gmail_form = self.validate_form_data(GmailIntegrationForm, form_data)
        if not gmail_form:
            return self.create_response(success=False)
        
        try:
            # Initiate OAuth flow for Gmail
            oauth_url = self._initiate_gmail_oauth(gmail_form.email)
            
            # Save pending integration settings
            integration_data = gmail_form.dict()
            integration_data['user_id'] = self.current_user['id']
            integration_data['status'] = IntegrationStatus.PENDING
            integration_data['created_at'] = datetime.utcnow()
            
            self._save_gmail_integration_settings(integration_data)
            
            # Log activity
            self.log_activity('gmail_integration_initiated', {
                'user_id': self.current_user['id'],
                'email': gmail_form.email
            })
            
            return self.create_response(
                success=True,
                data={'oauth_url': oauth_url},
                message='Please complete the OAuth authorization to connect Gmail'
            )
            
        except Exception as e:
            self.add_error('Failed to initiate Gmail connection')
            return self.create_response(success=False)
    
    def _disconnect_gmail(self, form_data: Dict[str, Any]) -> PageResponse:
        try:
            # Revoke OAuth tokens
            self._revoke_gmail_oauth_tokens(self.current_user['id'])
            
            # Update integration status
            self._update_gmail_integration_status(
                self.current_user['id'], 
                IntegrationStatus.DISCONNECTED
            )
            
            # Log activity
            self.log_activity('gmail_integration_disconnected', {
                'user_id': self.current_user['id']
            })
            
            return self.create_response(
                success=True,
                message='Gmail integration disconnected successfully'
            )
            
        except Exception as e:
            self.add_error('Failed to disconnect Gmail')
            return self.create_response(success=False)
    
    def _update_gmail_settings(self, form_data: Dict[str, Any]) -> PageResponse:
        """Update Gmail integration settings."""
        gmail_form = self.validate_form_data(GmailIntegrationForm, form_data)
        if not gmail_form:
            return self.create_response(success=False)
        
        try:
            # Update integration settings
            settings_data = gmail_form.dict()
            settings_data['updated_at'] = datetime.utcnow()
            
            self._update_gmail_integration_settings(self.current_user['id'], settings_data)
            
            # Trigger re-sync if sync settings changed
            if gmail_form.sync_frequency or gmail_form.sync_sent or gmail_form.sync_received:
                self._trigger_gmail_resync(self.current_user['id'])
            
            # Log activity
            self.log_activity('gmail_settings_updated', {
                'user_id': self.current_user['id'],
                'settings': settings_data
            })
            
            return self.create_response(
                success=True,
                message='Gmail settings updated successfully'
            )
            
        except Exception as e:
            self.add_error('Failed to update Gmail settings')
            return self.create_response(success=False)
    
    def _test_gmail_connection(self, form_data: Dict[str, Any]) -> PageResponse:
        try:
            # Test Gmail API connection
            test_result = self._test_gmail_api_connection(self.current_user['id'])
            
            if test_result['success']:
                return self.create_response(
                    success=True,
                    data={'test_result': test_result},
                    message='Gmail connection test successful'
                )
            else:
                self.add_error(f'Gmail connection failed: {test_result.get("error", "Unknown error")}')
                return self.create_response(success=False)
                
        except Exception as e:
            self.add_error('Failed to test Gmail connection')
            return self.create_response(success=False)
    
    def _sync_gmail_now(self, form_data: Dict[str, Any]) -> PageResponse:
        """Trigger immediate Gmail sync."""
        try:
            # Start Gmail sync
            sync_job = self._start_gmail_sync(self.current_user['id'])
            
            # Log activity
            self.log_activity('gmail_manual_sync_triggered', {
                'user_id': self.current_user['id'],
                'sync_job_id': sync_job['id']
            })
            
            return self.create_response(
                success=True,
                data={'sync_job': sync_job},
                message='Gmail sync started successfully'
            )
            
        except Exception as e:
            self.add_error('Failed to start Gmail sync')
            return self.create_response(success=False)
    
    def _connect_calendar(self, form_data: Dict[str, Any]) -> PageResponse:
        calendar_form = self.validate_form_data(CalendarIntegrationForm, form_data)
        if not calendar_form:
            return self.create_response(success=False)
        
        try:
            # Initiate calendar OAuth flow
            oauth_url = self._initiate_calendar_oauth(calendar_form.provider)
            
            # Save integration settings
            integration_data = calendar_form.dict()
            integration_data['user_id'] = self.current_user['id']
            integration_data['status'] = IntegrationStatus.PENDING
            integration_data['created_at'] = datetime.utcnow()
            
            self._save_calendar_integration(integration_data)
            
            return self.create_response(
                success=True,
                data={'oauth_url': oauth_url},
                message=f'{calendar_form.provider.title()} calendar integration initiated'
            )
            
        except Exception as e:
            self.add_error('Failed to connect calendar')
            return self.create_response(success=False)
    
    def _connect_crm(self, form_data: Dict[str, Any]) -> PageResponse:
        crm_form = self.validate_form_data(CRMIntegrationForm, form_data)
        if not crm_form:
            return self.create_response(success=False)
        
        try:
            # Test CRM API connection
            test_result = self._test_crm_connection(crm_form.crm_type, crm_form.api_key)
            
            if not test_result['success']:
                self.add_error(f'CRM connection failed: {test_result.get("error", "Invalid API key")}')
                return self.create_response(success=False)
            
            # Save CRM integration
            integration_data = crm_form.dict()
            integration_data['user_id'] = self.current_user['id']
            integration_data['status'] = IntegrationStatus.CONNECTED
            integration_data['created_at'] = datetime.utcnow()
            
            # Encrypt API key before storing
            integration_data['api_key'] = self._encrypt_api_key(crm_form.api_key)
            
            self._save_crm_integration(integration_data)
            
            # Start initial sync
            self._start_crm_sync(self.current_user['id'], crm_form.crm_type)
            
            return self.create_response(
                success=True,
                message=f'{crm_form.crm_type.title()} CRM connected successfully'
            )
            
        except Exception as e:
            self.add_error('Failed to connect CRM')
            return self.create_response(success=False)
    
    def _create_webhook(self, form_data: Dict[str, Any]) -> PageResponse:
        webhook_form = self.validate_form_data(WebhookForm, form_data)
        if not webhook_form:
            return self.create_response(success=False)
        
        try:
            # Create webhook
            webhook_data = webhook_form.dict()
            webhook_data['user_id'] = self.current_user['id']
            webhook_data['created_at'] = datetime.utcnow()
            
            # Generate webhook secret if not provided
            if not webhook_data['secret']:
                webhook_data['secret'] = self._generate_webhook_secret()
            
            new_webhook = self._save_webhook(webhook_data)
            
            # Test webhook endpoint
            test_result = self._test_webhook_endpoint(new_webhook['id'])
            
            # Log activity
            self.log_activity('webhook_created', {
                'webhook_id': new_webhook['id'],
                'name': webhook_form.name,
                'url': webhook_form.url
            })
            
            return self.create_response(
                success=True,
                data={
                    'webhook': self._format_webhook_for_display(new_webhook),
                    'test_result': test_result
                },
                message='Webhook created successfully'
            )
            
        except Exception as e:
            self.add_error('Failed to create webhook')
            return self.create_response(success=False)
    
    def _test_webhook(self, form_data: Dict[str, Any]) -> PageResponse:
        webhook_id = form_data.get('webhook_id')
        
        if not webhook_id:
            self.add_error('Webhook ID is required')
            return self.create_response(success=False)
        
        try:
            # Send test payload to webhook
            test_result = self._test_webhook_endpoint(webhook_id)
            
            return self.create_response(
                success=True,
                data={'test_result': test_result},
                message='Webhook test completed'
            )
            
        except Exception as e:
            self.add_error('Failed to test webhook')
            return self.create_response(success=False)
    
    def _generate_api_key(self, form_data: Dict[str, Any]) -> PageResponse:
        api_key_form = self.validate_form_data(APIKeyForm, form_data)
        if not api_key_form:
            return self.create_response(success=False)
        
        try:
            # Generate API key
            api_key_data = api_key_form.dict()
            api_key_data['user_id'] = self.current_user['id']
            api_key_data['key'] = self._generate_secure_api_key()
            api_key_data['created_at'] = datetime.utcnow()
            api_key_data['last_used'] = None
            api_key_data['is_active'] = True
            
            new_api_key = self._save_api_key(api_key_data)
            
            # Log activity
            self.log_activity('api_key_generated', {
                'api_key_id': new_api_key['id'],
                'name': api_key_form.name,
                'permissions': api_key_form.permissions
            })
            
            return self.create_response(
                success=True,
                data={
                    'api_key': self._format_api_key_for_display(new_api_key, include_key=True)
                },
                message='API key generated successfully. Please copy it now as it won\'t be shown again.'
            )
            
        except Exception as e:
            self.add_error('Failed to generate API key')
            return self.create_response(success=False)
    
    def _revoke_api_key(self, form_data: Dict[str, Any]) -> PageResponse:
        """Revoke API key."""
        api_key_id = form_data.get('api_key_id')
        
        if not api_key_id:
            self.add_error('API key ID is required')
            return self.create_response(success=False)
        
        try:
            # Revoke API key
            self._revoke_api_key_by_id(api_key_id)
            
            # Log activity
            self.log_activity('api_key_revoked', {
                'api_key_id': api_key_id
            })
            
            return self.create_response(
                success=True,
                message='API key revoked successfully'
            )
            
        except Exception as e:
            self.add_error('Failed to revoke API key')
            return self.create_response(success=False)
    
    def _get_gmail_integration(self) -> Optional[Dict[str, Any]]:
        # Simulate Gmail integration data
        return {
            'id': 1,
            'email': self.current_user.get('email', ''),
            'status': 'connected',
            'sync_sent': True,
            'sync_received': True,
            'auto_categorize': True,
            'sync_frequency': 'realtime',
            'last_sync': '2024-01-10T15:30:00Z',
            'emails_synced': 1250,
            'connected_at': '2023-06-15T10:00:00Z',
            'oauth_scopes': ['gmail.readonly', 'gmail.send'],
            'sync_errors': 0
        }
    
    def _get_email_statistics(self) -> Dict[str, Any]:
        return {
            'total_emails': 1250,
            'sent_emails': 340,
            'received_emails': 910,
            'categorized_emails': 1100,
            'sync_success_rate': 99.2,
            'last_24h_synced': 45,
            'storage_used': '2.3 GB'
        }
    
    def _get_sync_history(self) -> List[Dict[str, Any]]:
        return [
            {
                'id': 1,
                'type': 'full_sync',
                'status': 'completed',
                'emails_processed': 25,
                'started_at': '2024-01-10T15:30:00Z',
                'completed_at': '2024-01-10T15:32:15Z',
                'duration': 135,  # seconds
                'errors': 0
            },
            {
                'id': 2,
                'type': 'incremental',
                'status': 'completed',
                'emails_processed': 12,
                'started_at': '2024-01-10T14:00:00Z',
                'completed_at': '2024-01-10T14:00:45Z',
                'duration': 45,
                'errors': 0
            }
        ]
    
    def _get_available_integrations(self) -> List[Dict[str, Any]]:
        """Get available integrations based on reference system"""
        return [
            # Email & Communication
            {
                'id': 'mailgun',
                'name': 'Mailgun',
                'category': 'email',
                'description': 'Professional email delivery service with advanced analytics',
                'icon': '/integrations/mailgun.png',
                'status': 'connected',
                'popular': True,
                'features': ['Email delivery', 'Webhooks', 'Analytics', 'Templates'],
                'config_required': ['domain', 'api_key', 'webhook_key']
            },
            {
                'id': 'gmail',
                'name': 'Gmail',
                'category': 'email',
                'description': 'Gmail integration for personal email management',
                'icon': '/integrations/gmail.png',
                'status': 'available',
                'popular': True,
                'features': ['Email sync', 'Send emails', 'Label management'],
                'config_required': ['oauth_credentials']
            },
            {
                'id': 'aws_ses',
                'name': 'AWS SES',
                'category': 'email',
                'description': 'Amazon Simple Email Service for bulk email delivery',
                'icon': '/integrations/aws.png',
                'status': 'available',
                'popular': False,
                'features': ['Bulk email', 'Bounce handling', 'Complaint tracking'],
                'config_required': ['access_key', 'secret_key', 'region']
            },
            {
                'id': 'aws_pinpoint',
                'name': 'AWS Pinpoint SMS',
                'category': 'communication',
                'description': 'SMS messaging service for client notifications',
                'icon': '/integrations/aws.png',
                'status': 'available',
                'popular': False,
                'features': ['SMS delivery', 'Two-way messaging', 'Analytics'],
                'config_required': ['access_key', 'secret_key', 'region']
            },
            
            # Payment Processing
            {
                'id': 'stripe',
                'name': 'Stripe',
                'category': 'payment',
                'description': 'Complete payment processing solution',
                'icon': '/integrations/stripe.png',
                'status': 'connected',
                'popular': True,
                'features': ['Credit cards', 'ACH', 'Subscriptions', 'Webhooks'],
                'config_required': ['publishable_key', 'secret_key', 'webhook_secret']
            },
            {
                'id': 'paypal',
                'name': 'PayPal',
                'category': 'payment',
                'description': 'PayPal payment processing with subscription support',
                'icon': '/integrations/paypal.png',
                'status': 'connected',
                'popular': True,
                'features': ['PayPal payments', 'Subscriptions', 'Invoicing', 'Webhooks'],
                'config_required': ['client_id', 'client_secret', 'webhook_id']
            },
            
            # Document Management
            {
                'id': 'docusign',
                'name': 'DocuSign',
                'category': 'storage',
                'description': 'Digital signature and document workflow automation',
                'icon': '/integrations/docusign.png',
                'status': 'connected',
                'popular': True,
                'features': ['Digital signatures', 'Document templates', 'Workflow automation', 'Form data'],
                'config_required': ['integration_key', 'user_id', 'account_id', 'private_key']
            },
            {
                'id': 'hipaasign',
                'name': 'HipaaSign',
                'category': 'storage',
                'description': 'HIPAA-compliant digital signature solution',
                'icon': '/integrations/hipaasign.png',
                'status': 'available',
                'popular': False,
                'features': ['HIPAA compliance', 'Digital signatures', 'Audit trails'],
                'config_required': ['api_key', 'account_id']
            },
            
            # Cloud Storage
            {
                'id': 'aws_s3',
                'name': 'AWS S3',
                'category': 'storage',
                'description': 'Secure cloud storage for documents and drone footage',
                'icon': '/integrations/aws.png',
                'status': 'connected',
                'popular': True,
                'features': ['File storage', 'CDN delivery', 'Backup', 'Access control'],
                'config_required': ['access_key', 'secret_key', 'bucket_name', 'region']
            },
            {
                'id': 'google_drive',
                'name': 'Google Drive',
                'category': 'storage',
                'description': 'Google Drive integration for file storage and sharing',
                'icon': '/integrations/google-drive.png',
                'status': 'available',
                'popular': True,
                'features': ['File sync', 'Shared folders', 'Version control'],
                'config_required': ['oauth_credentials']
            },
            
            # Calendar & Scheduling
            {
                'id': 'google_calendar',
                'name': 'Google Calendar',
                'category': 'calendar',
                'description': 'Mission scheduling and calendar management',
                'icon': '/integrations/google-calendar.png',
                'status': 'available',
                'popular': True,
                'features': ['Event creation', 'Scheduling', 'Reminders', 'Availability'],
                'config_required': ['oauth_credentials']
            },
            {
                'id': 'outlook_calendar',
                'name': 'Outlook Calendar',
                'category': 'calendar',
                'description': 'Microsoft Outlook calendar integration',
                'icon': '/integrations/outlook.png',
                'status': 'available',
                'popular': False,
                'features': ['Event sync', 'Meeting scheduling', 'Teams integration'],
                'config_required': ['client_id', 'client_secret', 'tenant_id']
            },
            
            # Analytics & Monitoring
            {
                'id': 'google_analytics',
                'name': 'Google Analytics',
                'category': 'analytics',
                'description': 'Website and application analytics tracking',
                'icon': '/integrations/google-analytics.png',
                'status': 'available',
                'popular': True,
                'features': ['Traffic analysis', 'Conversion tracking', 'Custom events'],
                'config_required': ['tracking_id', 'measurement_id']
            },
            {
                'id': 'aws_cloudwatch',
                'name': 'AWS CloudWatch',
                'category': 'analytics',
                'description': 'Application monitoring and logging',
                'icon': '/integrations/aws.png',
                'status': 'available',
                'popular': False,
                'features': ['Log monitoring', 'Metrics', 'Alarms', 'Dashboards'],
                'config_required': ['access_key', 'secret_key', 'region']
            },
            
            # CRM & Sales
            {
                'id': 'salesforce',
                'name': 'Salesforce',
                'category': 'crm',
                'description': 'Enterprise CRM for lead and opportunity management',
                'icon': '/integrations/salesforce.png',
                'status': 'available',
                'popular': True,
                'features': ['Lead sync', 'Opportunity tracking', 'Contact management'],
                'config_required': ['client_id', 'client_secret', 'instance_url']
            },
            {
                'id': 'hubspot',
                'name': 'HubSpot',
                'category': 'crm',
                'description': 'Inbound marketing and sales CRM platform',
                'icon': '/integrations/hubspot.png',
                'status': 'available',
                'popular': False,
                'features': ['Contact sync', 'Deal tracking', 'Email marketing'],
                'config_required': ['api_key']
            },
            
            # Mapping & GIS
            {
                'id': 'mapbox',
                'name': 'Mapbox',
                'category': 'mapping',
                'description': 'Advanced mapping and location services',
                'icon': '/integrations/mapbox.png',
                'status': 'connected',
                'popular': True,
                'features': ['Interactive maps', 'Geocoding', 'Routing', 'Satellite imagery'],
                'config_required': ['access_token']
            },
            {
                'id': 'google_maps',
                'name': 'Google Maps',
                'category': 'mapping',
                'description': 'Google Maps API for location services',
                'icon': '/integrations/google-maps.png',
                'status': 'available',
                'popular': True,
                'features': ['Maps', 'Geocoding', 'Directions', 'Places'],
                'config_required': ['api_key']
            },
            
            # Specialized Services
            {
                'id': 'stamps_com',
                'name': 'Stamps.com',
                'category': 'communication',
                'description': 'Postal mail and shipping integration',
                'icon': '/integrations/stamps.png',
                'status': 'available',
                'popular': False,
                'features': ['Postage printing', 'Address validation', 'Tracking'],
                'config_required': ['integration_id', 'username', 'password']
            },
            {
                'id': 'ups_shipping',
                'name': 'UPS Shipping',
                'category': 'communication',
                'description': 'UPS shipping and tracking services',
                'icon': '/integrations/ups.png',
                'status': 'available',
                'popular': False,
                'features': ['Shipping labels', 'Rate calculation', 'Tracking'],
                'config_required': ['access_key', 'username', 'password']
            }
        ]
    
    def _get_user_webhooks(self) -> List[Dict[str, Any]]:
        """Get webhook configurations based on reference system patterns"""
        return [
            # Mission & BOTG Operations
            {
                'id': 1,
                'name': 'Mission Status Updates',
                'url': 'https://operations.dronestrike.com/webhooks/missions',
                'events': ['mission.created', 'mission.assigned', 'mission.completed', 'mission.failed'],
                'is_active': True,
                'secret': 'whsec_***hidden***',
                'retry_attempts': 3,
                'created_at': '2023-08-01T10:00:00Z',
                'last_triggered': '2024-01-10T14:30:00Z',
                'success_rate': 98.5,
                'total_deliveries': 245,
                'integration_type': 'missions',
                'description': 'Real-time mission status updates for BOTG operations'
            },
            
            # Payment Processing Webhooks (Stripe)
            {
                'id': 2,
                'name': 'Stripe Payment Events',
                'url': 'https://api.dronestrike.com/webhooks/stripe',
                'events': ['payment_intent.succeeded', 'payment_intent.payment_failed', 'customer.subscription.created', 'invoice.payment_succeeded'],
                'is_active': True,
                'secret': 'whsec_***hidden***',
                'retry_attempts': 5,
                'created_at': '2023-09-15T14:00:00Z',
                'last_triggered': '2024-01-09T09:15:00Z',
                'success_rate': 100.0,
                'total_deliveries': 167,
                'integration_type': 'payment',
                'description': 'Stripe payment processing events and subscription management'
            },
            
            # PayPal Webhooks
            {
                'id': 3,
                'name': 'PayPal Subscription Events',
                'url': 'https://api.dronestrike.com/webhooks/paypal',
                'events': ['BILLING.SUBSCRIPTION.CREATED', 'BILLING.SUBSCRIPTION.CANCELLED', 'PAYMENT.SALE.COMPLETED'],
                'is_active': True,
                'secret': 'whsec_***hidden***',
                'retry_attempts': 3,
                'created_at': '2023-10-01T12:00:00Z',
                'last_triggered': '2024-01-08T16:45:00Z',
                'success_rate': 97.2,
                'total_deliveries': 89,
                'integration_type': 'payment',
                'description': 'PayPal subscription and payment notifications'
            },
            
            # DocuSign Webhooks
            {
                'id': 4,
                'name': 'DocuSign Document Events',
                'url': 'https://api.dronestrike.com/webhooks/docusign',
                'events': ['envelope-completed', 'envelope-declined', 'envelope-voided', 'envelope-sent'],
                'is_active': True,
                'secret': 'whsec_***hidden***',
                'retry_attempts': 3,
                'created_at': '2023-07-20T09:30:00Z',
                'last_triggered': '2024-01-10T11:20:00Z',
                'success_rate': 99.1,
                'total_deliveries': 324,
                'integration_type': 'documents',
                'description': 'DocuSign envelope status updates and signature completion'
            },
            
            # Email Delivery Webhooks (Mailgun)
            {
                'id': 5,
                'name': 'Mailgun Email Events',
                'url': 'https://api.dronestrike.com/webhooks/mailgun',
                'events': ['delivered', 'failed', 'opened', 'clicked', 'complained', 'unsubscribed'],
                'is_active': True,
                'secret': 'whsec_***hidden***',
                'retry_attempts': 2,
                'created_at': '2023-06-10T15:15:00Z',
                'last_triggered': '2024-01-10T17:30:00Z',
                'success_rate': 99.8,
                'total_deliveries': 1567,
                'integration_type': 'email',
                'description': 'Email delivery status and engagement tracking'
            },
            
            # Lead & CRM Webhooks
            {
                'id': 6,
                'name': 'Lead Processing Events',
                'url': 'https://crm.dronestrike.com/webhooks/leads',
                'events': ['lead.created', 'lead.qualified', 'lead.converted', 'opportunity.won', 'opportunity.lost'],
                'is_active': True,
                'secret': 'whsec_***hidden***',
                'retry_attempts': 3,
                'created_at': '2023-11-05T13:45:00Z',
                'last_triggered': '2024-01-10T10:15:00Z',
                'success_rate': 96.8,
                'total_deliveries': 423,
                'integration_type': 'crm',
                'description': 'Lead lifecycle and opportunity management notifications'
            },
            
            # System Health & Monitoring
            {
                'id': 7,
                'name': 'System Health Alerts',
                'url': 'https://monitoring.dronestrike.com/webhooks/health',
                'events': ['system.error', 'service.down', 'performance.degraded', 'security.alert'],
                'is_active': True,
                'secret': 'whsec_***hidden***',
                'retry_attempts': 5,
                'created_at': '2023-05-15T08:00:00Z',
                'last_triggered': '2024-01-10T06:30:00Z',
                'success_rate': 100.0,
                'total_deliveries': 89,
                'integration_type': 'monitoring',
                'description': 'System health monitoring and alert notifications'
            }
        ]
    
    def _get_user_api_keys(self) -> List[Dict[str, Any]]:
        """Get API keys with enhanced security tracking"""
        return [
            {
                'id': 1,
                'name': 'Mobile App API - Production',
                'description': 'API key for mobile application production environment',
                'key_preview': 'ds_***...***abc123',
                'permissions': ['read:missions', 'write:missions', 'read:users', 'read:properties', 'write:leads'],
                'is_active': True,
                'created_at': '2023-06-15T10:00:00Z',
                'last_used': '2024-01-10T16:45:00Z',
                'expires_at': None,
                'usage_count': 15420,
                'rate_limit': '1000/hour',
                'usage_today': 287,
                'environment': 'production',
                'ip_whitelist': ['192.168.1.0/24', '10.0.0.0/16'],
                'last_ip': '192.168.1.45'
            },
            {
                'id': 2,
                'name': 'Analytics Dashboard - Staging',
                'description': 'Read-only access for analytics dashboard testing',
                'key_preview': 'ds_***...***xyz789',
                'permissions': ['read:analytics', 'read:missions', 'read:properties', 'read:users'],
                'is_active': True,
                'created_at': '2023-09-01T15:30:00Z',
                'last_used': '2024-01-10T12:00:00Z',
                'expires_at': '2024-09-01T15:30:00Z',
                'usage_count': 8950,
                'rate_limit': '500/hour',
                'usage_today': 45,
                'environment': 'staging',
                'ip_whitelist': ['10.0.0.0/8'],
                'last_ip': '10.0.1.23'
            },
            {
                'id': 3,
                'name': 'BOTG Operations API',
                'description': 'Mission management and field operations integration',
                'key_preview': 'ds_***...***botg456',
                'permissions': ['read:missions', 'write:missions', 'read:leads', 'write:opportunities', 'read:users'],
                'is_active': True,
                'created_at': '2023-08-12T09:00:00Z',
                'last_used': '2024-01-10T18:20:00Z',
                'expires_at': None,
                'usage_count': 34567,
                'rate_limit': '2000/hour',
                'usage_today': 1247,
                'environment': 'production',
                'ip_whitelist': ['172.16.0.0/12'],
                'last_ip': '172.16.10.5'
            },
            {
                'id': 4,
                'name': 'Third-Party CRM Integration',
                'description': 'External CRM system data synchronization',
                'key_preview': 'ds_***...***crm789',
                'permissions': ['read:leads', 'write:leads', 'read:opportunities', 'write:opportunities'],
                'is_active': True,
                'created_at': '2023-11-20T14:15:00Z',
                'last_used': '2024-01-10T08:30:00Z',
                'expires_at': '2025-11-20T14:15:00Z',
                'usage_count': 2876,
                'rate_limit': '100/hour',
                'usage_today': 23,
                'environment': 'production',
                'ip_whitelist': ['203.0.113.0/24'],
                'last_ip': '203.0.113.15'
            },
            {
                'id': 5,
                'name': 'Webhook Service API',
                'description': 'Internal webhook processing and delivery system',
                'key_preview': 'ds_***...***hook123',
                'permissions': ['read:webhooks', 'write:webhooks', 'read:integrations'],
                'is_active': True,
                'created_at': '2023-07-08T11:30:00Z',
                'last_used': '2024-01-10T19:45:00Z',
                'expires_at': None,
                'usage_count': 67892,
                'rate_limit': '5000/hour',
                'usage_today': 2341,
                'environment': 'production',
                'ip_whitelist': ['198.51.100.0/24'],
                'last_ip': '198.51.100.42'
            }
        ]
    
    def _format_webhook_for_display(self, webhook: Dict[str, Any]) -> Dict[str, Any]:
        return {
            'id': webhook['id'],
            'name': webhook['name'],
            'url': webhook['url'],
            'events': webhook['events'],
            'is_active': webhook['is_active'],
            'secret': 'whsec_***hidden***',  # Never expose real secret
            'retry_attempts': webhook['retry_attempts'],
            'created_at': webhook['created_at'],
            'last_triggered': webhook.get('last_triggered'),
            'success_rate': webhook.get('success_rate', 0),
            'total_deliveries': webhook.get('total_deliveries', 0)
        }
    
    def _format_api_key_for_display(self, api_key: Dict[str, Any], include_key: bool = False) -> Dict[str, Any]:
        """Format API key for display."""
        formatted = {
            'id': api_key['id'],
            'name': api_key['name'],
            'description': api_key.get('description', ''),
            'permissions': api_key['permissions'],
            'is_active': api_key['is_active'],
            'created_at': api_key['created_at'],
            'last_used': api_key.get('last_used'),
            'expires_at': api_key.get('expires_at'),
            'usage_count': api_key.get('usage_count', 0)
        }
        
        if include_key:
            formatted['key'] = api_key['key']
        else:
            # Show preview of key
            key = api_key['key']
            formatted['key_preview'] = f"{key[:8]}***...***{key[-6:]}"
        
        return formatted
    
    # Integration service methods (simplified implementations)
    def _initiate_gmail_oauth(self, email: str) -> str:
        # Generate OAuth URL for Gmail
        return f"https://accounts.google.com/oauth/authorize?client_id=123&scope=gmail.readonly&redirect_uri=https://dronestrike.com/auth/gmail"
    
    def _initiate_calendar_oauth(self, provider: str) -> str:
        """Initiate calendar OAuth flow."""
        provider_urls = {
            'google': 'https://accounts.google.com/oauth/authorize?scope=calendar',
            'outlook': 'https://login.microsoftonline.com/oauth2/authorize',
            'apple': 'https://appleid.apple.com/auth/authorize'
        }
        return provider_urls.get(provider, '')
    
    def _test_crm_connection(self, crm_type: str, api_key: str) -> Dict[str, Any]:
        """Test CRM API connection."""
        # Simulate CRM connection test
        return {'success': True, 'message': 'Connection successful'}
    
    def _test_gmail_api_connection(self, user_id: int) -> Dict[str, Any]:
        # Simulate Gmail API test
        return {
            'success': True,
            'message': 'Gmail API connection successful',
            'permissions': ['gmail.readonly', 'gmail.send'],
            'quota_remaining': 95000
        }
    
    def _test_webhook_endpoint(self, webhook_id: int) -> Dict[str, Any]:
        # Simulate webhook test
        return {
            'success': True,
            'status_code': 200,
            'response_time': 145,  # ms
            'message': 'Webhook endpoint responded successfully'
        }
    
    def _start_gmail_sync(self, user_id: int) -> Dict[str, Any]:
        import random
        return {
            'id': random.randint(1000, 9999),
            'status': 'running',
            'started_at': datetime.utcnow().isoformat() + 'Z'
        }
    
    def _generate_webhook_secret(self) -> str:
        import secrets
        return f"whsec_{secrets.token_urlsafe(32)}"
    
    def _generate_secure_api_key(self) -> str:
        import secrets
        return f"ds_{secrets.token_urlsafe(32)}"
    
    def _encrypt_api_key(self, api_key: str) -> str:
        # In real implementation, use proper encryption
        return f"encrypted_{api_key}"
    
    # Database simulation methods
    def _save_gmail_integration_settings(self, integration_data: Dict[str, Any]):
        # Save to database
        pass
    
    def _update_gmail_integration_status(self, user_id: int, status: IntegrationStatus):
        # Update status in database
        pass
    
    def _save_webhook(self, webhook_data: Dict[str, Any]) -> Dict[str, Any]:
        """Save webhook to database."""
        webhook_data['id'] = self._generate_webhook_id()
        return webhook_data
    
    def _save_api_key(self, api_key_data: Dict[str, Any]) -> Dict[str, Any]:
        """Save API key to database."""
        api_key_data['id'] = self._generate_api_key_id()
        return api_key_data
    
    def _generate_webhook_id(self) -> int:
        """Generate webhook ID."""
        import random
        return random.randint(1000, 9999)
    
    def _generate_api_key_id(self) -> int:
        """Generate API key ID."""
        import random
        return random.randint(10000, 99999)
    
    def _revoke_api_key_by_id(self, api_key_id: int):
        """Revoke API key by ID."""
        # Update API key status in database
        pass

    def _get_integration_logs(self) -> List[Dict[str, Any]]:
        """Get recent integration activity logs"""
        return [
            {
                'id': 1,
                'timestamp': '2024-03-19T14:22:15Z',
                'integration': 'Stripe',
                'event': 'Payment Processed',
                'status': 'success',
                'details': 'Payment of $1,250.00 processed successfully for mission #2024-0319-001',
                'user': 'system@dronestrike.com',
                'ip_address': '192.168.1.45',
                'duration_ms': 234,
                'request_id': 'req_stripe_1Hqz2e2eZvKYlo2C'
            },
            {
                'id': 2,
                'timestamp': '2024-03-19T14:18:33Z',
                'integration': 'SendGrid',
                'event': 'Email Sent',
                'status': 'success',
                'details': 'Mission status update notification sent to 15 recipients',
                'user': 'notifications@dronestrike.com',
                'ip_address': '10.0.1.23',
                'duration_ms': 1250,
                'request_id': 'req_sendgrid_sg_1234567890'
            },
            {
                'id': 3,
                'timestamp': '2024-03-19T14:15:22Z',
                'integration': 'DocuSign',
                'event': 'Document Signed',
                'status': 'success',
                'details': 'Property acquisition agreement completed by John Smith',
                'user': 'legal@dronestrike.com',
                'ip_address': '172.16.10.5',
                'duration_ms': 890,
                'request_id': 'req_docusign_abc123def456'
            },
            {
                'id': 4,
                'timestamp': '2024-03-19T14:10:41Z',
                'integration': 'Twilio',
                'event': 'SMS Sent',
                'status': 'success',
                'details': 'Mission alert sent to field team: "Mission ready for deployment"',
                'user': 'operations@dronestrike.com',
                'ip_address': '198.51.100.42',
                'duration_ms': 567,
                'request_id': 'req_twilio_tw_msg_xyz789'
            },
            {
                'id': 5,
                'timestamp': '2024-03-19T14:05:18Z',
                'integration': 'AWS S3',
                'event': 'File Upload',
                'status': 'success',
                'details': 'Mission report uploaded: mission_2024_0319_final.pdf (2.4 MB)',
                'user': 'pilot@dronestrike.com',
                'ip_address': '203.0.113.15',
                'duration_ms': 3456,
                'request_id': 'req_s3_bucket_upload_789'
            },
            {
                'id': 6,
                'timestamp': '2024-03-19T13:58:47Z',
                'integration': 'Mailgun',
                'event': 'Webhook Received',
                'status': 'error',
                'details': 'Invalid webhook signature - potential security issue',
                'user': 'system',
                'ip_address': '192.0.2.100',
                'duration_ms': 45,
                'request_id': 'req_mailgun_wh_failed_123'
            },
            {
                'id': 7,
                'timestamp': '2024-03-19T13:55:12Z',
                'integration': 'PayPal',
                'event': 'Subscription Created',
                'status': 'success',
                'details': 'New subscription created for Premium Plan ($99/month)',
                'user': 'billing@dronestrike.com',
                'ip_address': '192.168.1.45',
                'duration_ms': 1890,
                'request_id': 'req_paypal_sub_create_456'
            },
            {
                'id': 8,
                'timestamp': '2024-03-19T13:50:33Z',
                'integration': 'Google Calendar',
                'event': 'Event Created',
                'status': 'success',
                'details': 'Mission briefing scheduled for 2024-03-20T09:00:00Z',
                'user': 'scheduler@dronestrike.com',
                'ip_address': '10.0.1.23',
                'duration_ms': 678,
                'request_id': 'req_gcal_event_create_789'
            },
            {
                'id': 9,
                'timestamp': '2024-03-19T13:45:28Z',
                'integration': 'Salesforce',
                'event': 'Lead Updated',
                'status': 'success',
                'details': 'Lead #SF-12345 marked as qualified and assigned to sales rep',
                'user': 'crm-sync@dronestrike.com',
                'ip_address': '172.16.10.5',
                'duration_ms': 1234,
                'request_id': 'req_sf_lead_update_abc'
            },
            {
                'id': 10,
                'timestamp': '2024-03-19T13:40:15Z',
                'integration': 'Mapbox',
                'event': 'Route Calculated',
                'status': 'success',
                'details': 'Optimal flight path calculated for mission area (32.7767°N, 96.7970°W)',
                'user': 'flight-planner@dronestrike.com',
                'ip_address': '198.51.100.42',
                'duration_ms': 456,
                'request_id': 'req_mapbox_route_calc_def'
            },
            {
                'id': 11,
                'timestamp': '2024-03-19T13:35:44Z',
                'integration': 'HubSpot',
                'event': 'Contact Sync',
                'status': 'failed',
                'details': 'API rate limit exceeded - retrying in 60 seconds',
                'user': 'crm-sync@dronestrike.com',
                'ip_address': '172.16.10.5',
                'duration_ms': 234,
                'request_id': 'req_hubspot_sync_rate_limit'
            },
            {
                'id': 12,
                'timestamp': '2024-03-19T13:30:22Z',
                'integration': 'AWS CloudWatch',
                'event': 'Metric Published',
                'status': 'success',
                'details': 'Mission completion metrics published to dashboard',
                'user': 'monitoring@dronestrike.com',
                'ip_address': '203.0.113.15',
                'duration_ms': 123,
                'request_id': 'req_cw_metric_publish_ghi'
            }
        ]


# Page class aliases for backward compatibility
IntegrationsPage = GmailIntegrationPage