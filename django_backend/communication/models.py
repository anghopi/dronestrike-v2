"""
Communication Models - Comprehensive Communication System
Handles email automation, SMS integration, campaign management, and message tracking
"""

from django.db import models
from django.contrib.auth.models import User
from django.core.validators import EmailValidator
from django.utils import timezone
from django.contrib.postgres.fields import JSONField
import uuid
from enum import Enum


class CommunicationChannelType(models.TextChoices):
    """Communication channel types"""
    EMAIL = 'email', 'Email'
    SMS = 'sms', 'SMS'
    VOICE = 'voice', 'Voice Call'
    PUSH = 'push', 'Push Notification'
    MAIL = 'mail', 'Physical Mail'


class MessageStatus(models.TextChoices):
    """Message delivery status"""
    DRAFT = 'draft', 'Draft'
    QUEUED = 'queued', 'Queued'
    SENDING = 'sending', 'Sending'
    SENT = 'sent', 'Sent'
    DELIVERED = 'delivered', 'Delivered'
    OPENED = 'opened', 'Opened'
    CLICKED = 'clicked', 'Clicked'
    REPLIED = 'replied', 'Replied'
    BOUNCED = 'bounced', 'Bounced'
    FAILED = 'failed', 'Failed'
    UNSUBSCRIBED = 'unsubscribed', 'Unsubscribed'


class CampaignStatus(models.TextChoices):
    """Campaign status"""
    DRAFT = 'draft', 'Draft'
    SCHEDULED = 'scheduled', 'Scheduled'
    RUNNING = 'running', 'Running'
    PAUSED = 'paused', 'Paused'
    COMPLETED = 'completed', 'Completed'
    CANCELLED = 'cancelled', 'Cancelled'


class CampaignType(models.TextChoices):
    """Campaign types"""
    ONE_TIME = 'one_time', 'One-time Campaign'
    DRIP = 'drip', 'Drip Campaign'
    TRIGGERED = 'triggered', 'Triggered Campaign'
    A_B_TEST = 'a_b_test', 'A/B Test Campaign'
    AUTOMATED = 'automated', 'Automated Campaign'


class ContactList(models.Model):
    """Contact lists for organizing recipients"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='contact_lists')
    is_active = models.BooleanField(default=True)
    tags = JSONField(default=list, blank=True)
    
    # Metadata
    contact_count = models.IntegerField(default=0)
    last_updated = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'communication_contact_lists'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.contact_count} contacts)"


class Contact(models.Model):
    """Individual contact information"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(validators=[EmailValidator()], null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    
    # Contact lists relationship
    contact_lists = models.ManyToManyField(ContactList, related_name='contacts', blank=True)
    
    # Preferences
    email_subscribed = models.BooleanField(default=True)
    sms_subscribed = models.BooleanField(default=True)
    marketing_subscribed = models.BooleanField(default=True)
    
    # Custom fields
    custom_fields = JSONField(default=dict, blank=True)
    
    # Tracking
    source = models.CharField(max_length=100, blank=True)  # Where contact came from
    tags = JSONField(default=list, blank=True)
    
    # Metadata
    last_engaged = models.DateTimeField(null=True, blank=True)
    engagement_score = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'communication_contacts'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['phone']),
            models.Index(fields=['last_engaged']),
        ]
    
    def __str__(self):
        name = f"{self.first_name} {self.last_name}".strip()
        return name or self.email or self.phone or str(self.id)
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()


class MessageTemplate(models.Model):
    """Reusable message templates"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    channel_type = models.CharField(max_length=20, choices=CommunicationChannelType.choices)
    
    # Template content
    subject = models.CharField(max_length=255, blank=True)  # For email
    body_text = models.TextField()  # Plain text version
    body_html = models.TextField(blank=True)  # HTML version (for email)
    
    # Template variables
    variables = JSONField(default=list, blank=True)  # List of variable names
    
    # Metadata
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='message_templates')
    is_active = models.BooleanField(default=True)
    version = models.IntegerField(default=1)
    
    # Usage tracking
    usage_count = models.IntegerField(default=0)
    last_used = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'communication_message_templates'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.channel_type})"


class CommunicationCampaign(models.Model):
    """Communication campaign management"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    
    # Campaign configuration
    campaign_type = models.CharField(max_length=20, choices=CampaignType.choices, default=CampaignType.ONE_TIME)
    channel_type = models.CharField(max_length=20, choices=CommunicationChannelType.choices)
    status = models.CharField(max_length=20, choices=CampaignStatus.choices, default=CampaignStatus.DRAFT)
    
    # Recipients
    contact_lists = models.ManyToManyField(ContactList, related_name='campaigns', blank=True)
    individual_contacts = models.ManyToManyField(Contact, related_name='campaigns', blank=True)
    
    # Message content
    template = models.ForeignKey(MessageTemplate, on_delete=models.SET_NULL, null=True, blank=True)
    subject = models.CharField(max_length=255, blank=True)
    body_text = models.TextField()
    body_html = models.TextField(blank=True)
    
    # Scheduling
    scheduled_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    # A/B Testing
    is_ab_test = models.BooleanField(default=False)
    ab_test_percentage = models.IntegerField(default=50)  # Percentage for variant A
    ab_winner_variant = models.CharField(max_length=1, choices=[('A', 'A'), ('B', 'B')], null=True, blank=True)
    
    # Campaign settings
    send_immediately = models.BooleanField(default=False)
    time_zone = models.CharField(max_length=50, default='UTC')
    rate_limit = models.IntegerField(default=100)  # Messages per hour
    
    # Tracking
    total_recipients = models.IntegerField(default=0)
    messages_sent = models.IntegerField(default=0)
    messages_delivered = models.IntegerField(default=0)
    messages_opened = models.IntegerField(default=0)
    messages_clicked = models.IntegerField(default=0)
    messages_bounced = models.IntegerField(default=0)
    messages_failed = models.IntegerField(default=0)
    unsubscribes = models.IntegerField(default=0)
    
    # Metadata
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='communication_campaigns')
    tags = JSONField(default=list, blank=True)
    metadata = JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'communication_campaigns'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.channel_type})"
    
    @property
    def delivery_rate(self):
        """Calculate delivery rate percentage"""
        if self.messages_sent == 0:
            return 0
        return (self.messages_delivered / self.messages_sent) * 100
    
    @property
    def open_rate(self):
        """Calculate open rate percentage"""
        if self.messages_delivered == 0:
            return 0
        return (self.messages_opened / self.messages_delivered) * 100
    
    @property
    def click_rate(self):
        """Calculate click rate percentage"""
        if self.messages_opened == 0:
            return 0
        return (self.messages_clicked / self.messages_opened) * 100


class CommunicationMessage(models.Model):
    """Individual message records"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Relationships
    campaign = models.ForeignKey(CommunicationCampaign, on_delete=models.CASCADE, related_name='messages', null=True, blank=True)
    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name='messages')
    template = models.ForeignKey(MessageTemplate, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Message details
    channel_type = models.CharField(max_length=20, choices=CommunicationChannelType.choices)
    status = models.CharField(max_length=20, choices=MessageStatus.choices, default=MessageStatus.DRAFT)
    
    # Recipients
    to_email = models.EmailField(null=True, blank=True)
    to_phone = models.CharField(max_length=20, null=True, blank=True)
    
    # Content
    subject = models.CharField(max_length=255, blank=True)
    body_text = models.TextField()
    body_html = models.TextField(blank=True)
    
    # External service tracking
    external_id = models.CharField(max_length=255, null=True, blank=True)  # Mailgun, Twilio, etc.
    provider = models.CharField(max_length=50, blank=True)  # mailgun, twilio, voipms
    
    # Delivery tracking
    queued_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    opened_at = models.DateTimeField(null=True, blank=True)
    clicked_at = models.DateTimeField(null=True, blank=True)
    bounced_at = models.DateTimeField(null=True, blank=True)
    failed_at = models.DateTimeField(null=True, blank=True)
    
    # Error handling
    error_message = models.TextField(blank=True)
    retry_count = models.IntegerField(default=0)
    max_retries = models.IntegerField(default=3)
    
    # Engagement tracking
    open_count = models.IntegerField(default=0)
    click_count = models.IntegerField(default=0)
    
    # A/B Testing
    ab_variant = models.CharField(max_length=1, choices=[('A', 'A'), ('B', 'B')], null=True, blank=True)
    
    # Metadata
    metadata = JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'communication_messages'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['channel_type']),
            models.Index(fields=['sent_at']),
            models.Index(fields=['external_id']),
        ]
    
    def __str__(self):
        return f"{self.channel_type} to {self.to_email or self.to_phone} - {self.status}"


class MessageTracking(models.Model):
    """Detailed message tracking events"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(CommunicationMessage, on_delete=models.CASCADE, related_name='tracking_events')
    
    # Event details
    event_type = models.CharField(max_length=50)  # opened, clicked, bounced, etc.
    event_data = JSONField(default=dict, blank=True)
    
    # Source information
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    location_data = JSONField(default=dict, blank=True)
    
    # Timing
    timestamp = models.DateTimeField(auto_now_add=True)
    
    # External tracking
    external_event_id = models.CharField(max_length=255, null=True, blank=True)
    
    class Meta:
        db_table = 'communication_message_tracking'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['event_type']),
            models.Index(fields=['timestamp']),
        ]
    
    def __str__(self):
        return f"{self.event_type} - {self.message.id} - {self.timestamp}"


class CommunicationAutomation(models.Model):
    """Automated communication workflows"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    
    # Trigger configuration
    trigger_type = models.CharField(max_length=50)  # user_signup, property_view, etc.
    trigger_conditions = JSONField(default=dict, blank=True)
    
    # Workflow steps
    workflow_steps = JSONField(default=list, blank=True)  # List of campaign/delay configurations
    
    # Status
    is_active = models.BooleanField(default=True)
    
    # Statistics
    triggered_count = models.IntegerField(default=0)
    completed_count = models.IntegerField(default=0)
    
    # Metadata
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='communication_automations')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'communication_automations'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.trigger_type})"


class AutomationExecution(models.Model):
    """Track automation execution for individual contacts"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    automation = models.ForeignKey(CommunicationAutomation, on_delete=models.CASCADE, related_name='executions')
    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name='automation_executions')
    
    # Execution state
    current_step = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=[
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('paused', 'Paused'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ], default='pending')
    
    # Timing
    triggered_at = models.DateTimeField(auto_now_add=True)
    next_step_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    # Execution data
    execution_data = JSONField(default=dict, blank=True)
    
    class Meta:
        db_table = 'communication_automation_executions'
        ordering = ['-triggered_at']
        unique_together = ['automation', 'contact']
    
    def __str__(self):
        return f"{self.automation.name} - {self.contact} - {self.status}"


class CommunicationAnalytics(models.Model):
    """Aggregated communication analytics"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Time period
    date = models.DateField()
    hour = models.IntegerField(null=True, blank=True)  # For hourly analytics
    
    # Dimensions
    channel_type = models.CharField(max_length=20, choices=CommunicationChannelType.choices, null=True, blank=True)
    campaign_id = models.UUIDField(null=True, blank=True)
    template_id = models.UUIDField(null=True, blank=True)
    
    # Metrics
    messages_sent = models.IntegerField(default=0)
    messages_delivered = models.IntegerField(default=0)
    messages_opened = models.IntegerField(default=0)
    messages_clicked = models.IntegerField(default=0)
    messages_bounced = models.IntegerField(default=0)
    messages_failed = models.IntegerField(default=0)
    unsubscribes = models.IntegerField(default=0)
    
    # Revenue tracking (if applicable)
    revenue_generated = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'communication_analytics'
        ordering = ['-date', '-hour']
        indexes = [
            models.Index(fields=['date']),
            models.Index(fields=['channel_type']),
            models.Index(fields=['campaign_id']),
        ]
        unique_together = ['date', 'hour', 'channel_type', 'campaign_id', 'template_id']
    
    def __str__(self):
        period = f"{self.date}"
        if self.hour is not None:
            period += f" {self.hour}:00"
        return f"Analytics {period} - {self.channel_type}"


class UnsubscribeRequest(models.Model):
    """Handle unsubscribe requests"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name='unsubscribe_requests')
    
    # Unsubscribe details
    channel_type = models.CharField(max_length=20, choices=CommunicationChannelType.choices)
    reason = models.TextField(blank=True)
    
    # Source information
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    
    # Processing
    processed = models.BooleanField(default=False)
    processed_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'communication_unsubscribe_requests'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Unsubscribe - {self.contact} - {self.channel_type}"