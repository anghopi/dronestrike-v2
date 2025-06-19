"""Advanced Email Processing Tasks"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from pathlib import Path
import jinja2
from celery import Task
from celery.exceptions import Retry
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry as UrllibRetry

from .celery_app import celery_app, TaskContext, BaseTask
from core.config import settings
from core.database import get_db_session
from models.user import User
from models.lead import Lead
from utils.logging_config import get_logger
from utils.security_utils import SecurityManager
from utils.monitoring_utils import MetricsCollector
from integrations.mailgun import MailgunClient

logger = get_logger(__name__)
metrics = MetricsCollector()
security = SecurityManager()

# Email template configuration
TEMPLATE_DIR = Path(__file__).parent.parent / "templates" / "email"
template_loader = jinja2.FileSystemLoader(TEMPLATE_DIR)
template_env = jinja2.Environment(
    loader=template_loader,
    autoescape=jinja2.select_autoescape(['html', 'xml'])
)

class EmailTaskBase(BaseTask):
    """Base class for email tasks with enhanced error handling."""
    
    def __init__(self):
        self.mailgun = MailgunClient()
        
        # Configure HTTP session with retries
        self.session = requests.Session()
        retry_strategy = UrllibRetry(
            total=3,
            status_forcelist=[429, 500, 502, 503, 504],
            method_whitelist=["HEAD", "GET", "POST"],
            backoff_factor=1
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Enhanced failure handling for email tasks."""
        super().on_failure(exc, task_id, args, kwargs, einfo)
        
        # Log email delivery failure
        recipient = kwargs.get('recipient') or (args[0] if args else 'unknown')
        logger.error(f"Email delivery failed", extra={
            'task_id': task_id,
            'recipient': recipient,
            'exception': str(exc),
            'email_type': kwargs.get('email_type', 'unknown')
        })
        
        # Record failure metrics
        metrics.record_email_failure(recipient, str(exc))

@celery_app.task(
    bind=True,
    base=EmailTaskBase,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(requests.RequestException, ConnectionError),
    retry_backoff=True,
    retry_jitter=True
)
def send_email(self, recipient: str, subject: str, template_name: str, 
               context: Dict[str, Any], attachments: Optional[List[Dict]] = None,
               email_type: str = 'general', priority: str = 'normal',
               scheduled_at: Optional[datetime] = None) -> Dict[str, Any]:
    """
    Send email with template rendering and comprehensive error handling.
    
    Args:
        recipient: Email address of recipient
        subject: Email subject line
        template_name: Name of email template (without extension)
        context: Template context variables
        attachments: List of attachment dictionaries
        email_type: Type of email for tracking (welcome, notification, etc.)
        priority: Email priority (low, normal, high)
        scheduled_at: Schedule email for future delivery
    
    Returns:
        Dict containing delivery status and message ID
    """
    with TaskContext(self.name, self.request.id):
        try:
            # Validate recipient email
            if not security.validate_email(recipient):
                raise ValueError(f"Invalid email address: {recipient}")
            
            # Check if recipient is on suppression list
            if self._is_suppressed(recipient):
                logger.warning(f"Email suppressed for recipient: {recipient}")
                return {
                    'status': 'suppressed',
                    'recipient': recipient,
                    'reason': 'Recipient on suppression list'
                }
            
            # Rate limiting check
            if not self._check_rate_limit(recipient, email_type):
                logger.warning(f"Rate limit exceeded for {recipient}")
                return {
                    'status': 'rate_limited',
                    'recipient': recipient,
                    'reason': 'Rate limit exceeded'
                }
            
            # Render email template
            html_content, text_content = self._render_template(template_name, context)
            
            # Prepare email data
            email_data = {
                'from': f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM_ADDRESS}>",
                'to': recipient,
                'subject': subject,
                'html': html_content,
                'text': text_content,
                'o:tag': [email_type, f"priority:{priority}"],
                'o:tracking': 'yes',
                'o:tracking-clicks': 'yes',
                'o:tracking-opens': 'yes'
            }
            
            # Add scheduled delivery
            if scheduled_at:
                email_data['o:deliverytime'] = scheduled_at.strftime('%a, %d %b %Y %H:%M:%S %z')
            
            # Add attachments
            if attachments:
                files = []
                for attachment in attachments:
                    files.append(('attachment', (
                        attachment['filename'],
                        attachment['content'],
                        attachment.get('content_type', 'application/octet-stream')
                    )))
                email_data['files'] = files
            
            # Send email via Mailgun
            response = self.mailgun.send_email(email_data)
            
            if response.get('id'):
                # Record successful delivery
                self._record_email_sent(recipient, email_type, response['id'])
                
                logger.info(f"Email sent successfully", extra={
                    'recipient': recipient,
                    'email_type': email_type,
                    'message_id': response['id']
                })
                
                return {
                    'status': 'sent',
                    'recipient': recipient,
                    'message_id': response['id'],
                    'email_type': email_type
                }
            else:
                raise Exception(f"Failed to send email: {response}")
                
        except Exception as exc:
            logger.error(f"Email task failed: {exc}", extra={
                'recipient': recipient,
                'email_type': email_type,
                'retry_count': self.request.retries
            })
            
            # Retry with exponential backoff
            if self.request.retries < self.max_retries:
                raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
            
            # Final failure
            self._record_email_failed(recipient, email_type, str(exc))
            raise exc
    
    def _render_template(self, template_name: str, context: Dict[str, Any]) -> tuple[str, str]:
        """Render HTML and text email templates."""
        try:
            # Add common context variables
            context.update({
                'app_name': settings.APP_NAME,
                'app_url': settings.FRONTEND_URL,
                'support_email': settings.SUPPORT_EMAIL,
                'current_year': datetime.now().year,
                'unsubscribe_url': f"{settings.FRONTEND_URL}/unsubscribe"
            })
            
            # Render HTML template
            html_template = template_env.get_template(f"{template_name}.html")
            html_content = html_template.render(**context)
            
            # Render text template (fallback to HTML if not found)
            try:
                text_template = template_env.get_template(f"{template_name}.txt")
                text_content = text_template.render(**context)
            except jinja2.TemplateNotFound:
                # Create basic text version from HTML
                import re
                text_content = re.sub('<[^<]+?>', '', html_content)
                text_content = re.sub(r'\s+', ' ', text_content).strip()
            
            return html_content, text_content
            
        except Exception as e:
            logger.error(f"Template rendering failed: {e}")
            raise
    
    def _is_suppressed(self, email: str) -> bool:
        """Check if email is on suppression list."""
        try:
            return self.mailgun.is_suppressed(email)
        except Exception as e:
            logger.warning(f"Failed to check suppression list: {e}")
            return False
    
    def _check_rate_limit(self, email: str, email_type: str) -> bool:
        """Check if email sending rate limit is exceeded."""
        try:
            # Implement rate limiting logic based on email type
            rate_limits = {
                'welcome': 1,  # 1 per day
                'notification': 10,  # 10 per hour
                'marketing': 3,  # 3 per day
                'general': 5  # 5 per hour
            }
            
            limit = rate_limits.get(email_type, 5)
            
            # Check rate limit using Redis (implementation would use actual Redis)
            # For now, return True (no rate limiting)
            return True
            
        except Exception as e:
            logger.warning(f"Rate limit check failed: {e}")
            return True
    
    def _record_email_sent(self, recipient: str, email_type: str, message_id: str):
        """Record successful email delivery."""
        try:
            metrics.record_email_sent(recipient, email_type, message_id)
        except Exception as e:
            logger.warning(f"Failed to record email sent: {e}")
    
    def _record_email_failed(self, recipient: str, email_type: str, error: str):
        """Record failed email delivery."""
        try:
            metrics.record_email_failure(recipient, email_type, error)
        except Exception as e:
            logger.warning(f"Failed to record email failure: {e}")

@celery_app.task(bind=True, base=EmailTaskBase)
def send_welcome_email(self, user_id: int) -> Dict[str, Any]:
    """Send welcome email to new user."""
    try:
        # Get user data
        async def get_user():
            async with get_db_session() as session:
                user = await session.get(User, user_id)
                return user
        
        user = asyncio.run(get_user())
        if not user:
            raise ValueError(f"User not found: {user_id}")
        
        # Prepare template context
        context = {
            'user_name': f"{user.first_name} {user.last_name}".strip() or user.email,
            'login_url': f"{settings.FRONTEND_URL}/login",
            'getting_started_url': f"{settings.FRONTEND_URL}/getting-started"
        }
        
        return send_email.apply(args=[
            user.email,
            f"Welcome to {settings.APP_NAME}!",
            'welcome',
            context,
            None,  # no attachments
            'welcome',
            'high'
        ]).get()
        
    except Exception as e:
        logger.error(f"Welcome email failed: {e}")
        raise

@celery_app.task(bind=True, base=EmailTaskBase)
def send_password_reset_email(self, user_id: int, reset_token: str) -> Dict[str, Any]:
    """Send password reset email."""
    try:
        # Get user data
        async def get_user():
            async with get_db_session() as session:
                user = await session.get(User, user_id)
                return user
        
        user = asyncio.run(get_user())
        if not user:
            raise ValueError(f"User not found: {user_id}")
        
        # Prepare template context
        context = {
            'user_name': f"{user.first_name} {user.last_name}".strip() or user.email,
            'reset_url': f"{settings.FRONTEND_URL}/reset-password?token={reset_token}",
            'expires_in': "24 hours"
        }
        
        return send_email.apply(args=[
            user.email,
            "Reset Your Password",
            'password_reset',
            context,
            None,
            'password_reset',
            'high'
        ]).get()
        
    except Exception as e:
        logger.error(f"Password reset email failed: {e}")
        raise

@celery_app.task(bind=True, base=EmailTaskBase)
def send_bulk_email(self, recipients: List[str], subject: str, template_name: str,
                   context: Dict[str, Any], email_type: str = 'bulk') -> Dict[str, Any]:
    """Send bulk emails with batching and rate limiting."""
    try:
        results = {
            'sent': 0,
            'failed': 0,
            'suppressed': 0,
            'rate_limited': 0,
            'errors': []
        }
        
        # Process in batches to avoid overwhelming the system
        batch_size = 50
        batches = [recipients[i:i + batch_size] for i in range(0, len(recipients), batch_size)]
        
        for batch in batches:
            batch_tasks = []
            
            for recipient in batch:
                task = send_email.delay(
                    recipient, subject, template_name, context,
                    None, email_type, 'normal'
                )
                batch_tasks.append((recipient, task))
            
            # Wait for batch completion with timeout
            for recipient, task in batch_tasks:
                try:
                    result = task.get(timeout=30)
                    status = result.get('status', 'unknown')
                    results[status] = results.get(status, 0) + 1
                    
                    if status == 'sent':
                        results['sent'] += 1
                    
                except Exception as e:
                    results['failed'] += 1
                    results['errors'].append({
                        'recipient': recipient,
                        'error': str(e)
                    })
            
            # Add delay between batches
            if len(batches) > 1:
                import time
                time.sleep(2)
        
        logger.info(f"Bulk email completed", extra={
            'total_recipients': len(recipients),
            'sent': results['sent'],
            'failed': results['failed']
        })
        
        return results
        
    except Exception as e:
        logger.error(f"Bulk email failed: {e}")
        raise

@celery_app.task(bind=True, base=EmailTaskBase)
def send_notification_email(self, user_id: int, notification_type: str, 
                           context: Dict[str, Any]) -> Dict[str, Any]:
    """Send notification email based on type."""
    try:
        # Get user data
        async def get_user():
            async with get_db_session() as session:
                user = await session.get(User, user_id)
                return user
        
        user = asyncio.run(get_user())
        if not user:
            raise ValueError(f"User not found: {user_id}")
        
        # Check user notification preferences
        if not user.email_notifications:
            logger.info(f"Email notifications disabled for user {user_id}")
            return {'status': 'disabled', 'reason': 'User has disabled email notifications'}
        
        # Notification type mapping
        notification_config = {
            'lead_assigned': {
                'subject': 'New Lead Assigned',
                'template': 'lead_assigned',
                'priority': 'high'
            },
            'mission_completed': {
                'subject': 'Mission Completed',
                'template': 'mission_completed',
                'priority': 'normal'
            },
            'payment_received': {
                'subject': 'Payment Received',
                'template': 'payment_received',
                'priority': 'high'
            },
            'system_alert': {
                'subject': 'System Alert',
                'template': 'system_alert',
                'priority': 'high'
            }
        }
        
        config = notification_config.get(notification_type)
        if not config:
            raise ValueError(f"Unknown notification type: {notification_type}")
        
        # Add user data to context
        context.update({
            'user_name': f"{user.first_name} {user.last_name}".strip() or user.email,
            'user_email': user.email
        })
        
        return send_email.apply(args=[
            user.email,
            config['subject'],
            config['template'],
            context,
            None,
            f'notification_{notification_type}',
            config['priority']
        ]).get()
        
    except Exception as e:
        logger.error(f"Notification email failed: {e}")
        raise

@celery_app.task(bind=True, base=EmailTaskBase)
def process_email_bounces(self) -> Dict[str, Any]:
    """Process email bounces and update suppression list."""
    try:
        # Get bounce events from Mailgun
        bounces = self.mailgun.get_bounces()
        
        processed = 0
        for bounce in bounces:
            try:
                # Update user status if needed
                email = bounce.get('address')
                if email:
                    async def update_user():
                        async with get_db_session() as session:
                            user = await session.execute(
                                select(User).where(User.email == email)
                            )
                            user = user.scalar_one_or_none()
                            if user:
                                user.email_bounced = True
                                user.email_bounce_reason = bounce.get('error', 'Unknown')
                                await session.commit()
                    
                    asyncio.run(update_user())
                    processed += 1
                    
            except Exception as e:
                logger.warning(f"Failed to process bounce for {bounce.get('address')}: {e}")
        
        logger.info(f"Processed {processed} email bounces")
        return {'processed': processed}
        
    except Exception as e:
        logger.error(f"Bounce processing failed: {e}")
        raise

@celery_app.task(bind=True, base=EmailTaskBase)
def cleanup_email_logs(self, days_to_keep: int = 30) -> Dict[str, Any]:
    """Clean up old email logs and metrics."""
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
        
        # Clean up email logs (implementation would depend on storage)
        cleaned_count = metrics.cleanup_email_logs(cutoff_date)
        
        logger.info(f"Cleaned up {cleaned_count} old email logs")
        return {'cleaned': cleaned_count}
        
    except Exception as e:
        logger.error(f"Email log cleanup failed: {e}")
        raise