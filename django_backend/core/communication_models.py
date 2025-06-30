"""
Communication tracking models for DroneStrike v2
Based on the original Node.js system's communication tracking
"""

from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from decimal import Decimal
from .models import Lead, TokenTransaction


class Communication(models.Model):
    """
    Communication tracking model (from original Node.js system)
    Tracks all interactions with leads including cost and tokens
    """
    COMMUNICATION_TYPES = [
        ('phone', 'Phone Call'),
        ('sms', 'SMS Message'),
        ('email', 'Email'),
        ('mail', 'Physical Mail'),
        ('postcard', 'Postcard'),
        ('letter', 'Letter'),
        ('contract', 'Contract/Document'),
        ('meeting', 'In-Person Meeting'),
        ('other', 'Other'),
    ]
    
    DIRECTION_CHOICES = [
        ('inbound', 'Inbound'),
        ('outbound', 'Outbound'),
    ]
    
    STATUS_CHOICES = [
        ('sent', 'Sent'),
        ('delivered', 'Delivered'),
        ('read', 'Read/Opened'),
        ('replied', 'Replied'),
        ('failed', 'Failed'),
        ('bounced', 'Bounced'),
        ('unsubscribed', 'Unsubscribed'),
    ]
    
    # Core relationships
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='communications')
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='communications')
    campaign = models.ForeignKey('Campaign', on_delete=models.SET_NULL, null=True, blank=True, related_name='communications')
    template = models.ForeignKey('CommunicationTemplate', on_delete=models.SET_NULL, null=True, blank=True)
    
    # Communication details
    type = models.CharField(max_length=20, choices=COMMUNICATION_TYPES)
    direction = models.CharField(max_length=10, choices=DIRECTION_CHOICES)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='sent')
    
    # Content
    subject = models.CharField(max_length=255, blank=True)
    content = models.TextField(blank=True)
    
    # Phone-specific fields
    duration_seconds = models.IntegerField(null=True, blank=True, help_text="Call duration in seconds")
    phone_number = models.CharField(max_length=20, blank=True)
    
    # Email-specific fields
    email_address = models.EmailField(blank=True)
    opened_at = models.DateTimeField(null=True, blank=True)
    clicked_at = models.DateTimeField(null=True, blank=True)
    
    # Response tracking
    response_received = models.BooleanField(default=False)
    response_content = models.TextField(blank=True)
    response_at = models.DateTimeField(null=True, blank=True)
    
    # Failed communication tracking
    failed_at = models.DateTimeField(null=True, blank=True)
    bounce_reason = models.CharField(max_length=255, blank=True)
    
    # Mail-specific fields
    mailing_address = models.TextField(blank=True)
    tracking_number = models.CharField(max_length=100, blank=True)
    postmark_date = models.DateField(null=True, blank=True)
    
    # Token and cost tracking
    tokens_cost = models.IntegerField(default=0, help_text="Tokens consumed for this communication")
    token_type = models.CharField(max_length=10, choices=[
        ('regular', 'Regular Token'),
        ('mail', 'Mail Token'),
    ], default='regular')
    
    # External service tracking
    external_id = models.CharField(max_length=100, blank=True, help_text="ID from external service (Twilio, SendGrid, etc.)")
    external_status = models.CharField(max_length=50, blank=True)
    external_error = models.TextField(blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'type', 'created_at']),
            models.Index(fields=['lead', 'type']),
            models.Index(fields=['status', 'type']),
        ]
    
    def __str__(self):
        return f"{self.get_type_display()} to {self.lead.first_name} {self.lead.last_name} ({self.created_at.date()})"
    
    def save(self, *args, **kwargs):
        """Override save to set sent_at on creation"""
        if not self.pk and not self.sent_at:
            self.sent_at = timezone.now()
        super().save(*args, **kwargs)


class CommunicationTemplate(models.Model):
    """
    Templates for communications (from original system)
    """
    TEMPLATE_TYPES = [
        ('sms', 'SMS Template'),
        ('email', 'Email Template'),
        ('postcard', 'Postcard Template'),
        ('letter', 'Letter Template'),
        ('phone', 'Phone Script Template'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='communication_templates')
    
    name = models.CharField(max_length=100)
    communication_type = models.CharField(max_length=20, choices=TEMPLATE_TYPES)
    subject = models.CharField(max_length=255, blank=True, help_text="For emails")
    content = models.TextField()
    
    # Template variables support
    uses_variables = models.BooleanField(default=True)
    available_variables = models.JSONField(default=list, blank=True, help_text="Available template variables")
    
    # Usage tracking
    times_used = models.IntegerField(default=0)
    
    # Status
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['communication_type', 'name']
        unique_together = ['user', 'name', 'communication_type']
    
    def __str__(self):
        return f"{self.name} ({self.get_communication_type_display()})"
    
    def render_content(self, lead, **kwargs):
        """Render template with lead data"""
        context = {
            'first_name': lead.first_name,
            'last_name': lead.last_name,
            'full_name': f"{lead.first_name} {lead.last_name}",
            'address': lead.mailing_address_1,
            'city': lead.mailing_city,
            'state': lead.mailing_state,
            'zip': lead.mailing_zip5,
            **kwargs
        }
        
        content = self.content
        for key, value in context.items():
            content = content.replace(f"{{{key}}}", str(value or ''))
        
        return content


class Campaign(models.Model):
    """
    Enhanced marketing campaigns with sophisticated targeting and automation
    """
    COMMUNICATION_TYPES = [
        ('sms', 'SMS Campaign'),
        ('email', 'Email Campaign'),
        ('postcard', 'Postcard Campaign'),
        ('letter', 'Letter Campaign'),
        ('phone', 'Phone Campaign'),
        ('mixed', 'Mixed Media Campaign'),
    ]
    
    CAMPAIGN_TYPES = [
        ('one_time', 'One Time'),
        ('drip', 'Drip Campaign'),
        ('triggered', 'Triggered'),
        ('a_b_test', 'A/B Test')
    ]
    
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('scheduled', 'Scheduled'),
        ('active', 'Active'),
        ('paused', 'Paused'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='campaigns')
    template = models.ForeignKey(CommunicationTemplate, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Campaign details
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    communication_type = models.CharField(max_length=20, choices=COMMUNICATION_TYPES)
    campaign_type = models.CharField(max_length=20, choices=CAMPAIGN_TYPES, default='one_time')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    
    # Enhanced targeting criteria
    targeting_criteria = models.JSONField(default=dict, blank=True, help_text="Advanced targeting criteria")
    
    # Campaign configuration (for drip, triggered campaigns)
    configuration = models.JSONField(default=dict, blank=True, help_text="Campaign configuration like drip sequence, triggers, etc.")
    
    # Scheduling
    scheduled_start = models.DateTimeField(null=True, blank=True)
    scheduled_end = models.DateTimeField(null=True, blank=True)
    
    # Budget and limits
    max_tokens_budget = models.IntegerField(default=1000)
    tokens_consumed = models.IntegerField(default=0)
    max_recipients = models.IntegerField(null=True, blank=True)
    
    # Enhanced results tracking
    total_sent = models.IntegerField(default=0)
    total_failed = models.IntegerField(default=0)
    total_delivered = models.IntegerField(default=0)
    total_opened = models.IntegerField(default=0)
    total_clicked = models.IntegerField(default=0)
    total_replied = models.IntegerField(default=0)
    total_unsubscribed = models.IntegerField(default=0)
    
    # Error handling
    error_message = models.TextField(blank=True, help_text="Error message if campaign failed")
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.get_communication_type_display()})"
    
    def update_metrics(self, updates):
        """Update campaign metrics atomically"""
        for field, value in updates.items():
            if hasattr(self, field):
                if hasattr(value, 'resolve_expression'):  # Django F object
                    setattr(self, field, value)
                else:
                    current_value = getattr(self, field) or 0
                    setattr(self, field, current_value + value)
        self.save(update_fields=list(updates.keys()))
    
    @property
    def delivery_rate(self):
        """Calculate delivery rate"""
        total_attempts = self.total_sent + self.total_failed
        if total_attempts > 0:
            return (self.total_sent / total_attempts) * 100
        return 0
    
    @property
    def open_rate(self):
        """Calculate email open rate"""
        if self.total_sent > 0:
            return (self.total_opened / self.total_sent) * 100
        return 0
    
    @property
    def click_rate(self):
        """Calculate click rate"""
        if self.total_opened > 0:
            return (self.total_clicked / self.total_opened) * 100
        return 0
    
    @property
    def response_rate(self):
        """Calculate response rate"""
        if self.total_sent > 0:
            return (self.total_replied / self.total_sent) * 100
        return 0
    
    @property
    def cost_per_send(self):
        """Calculate cost per send"""
        if self.total_sent > 0:
            return self.tokens_consumed / self.total_sent
        return 0
    
    @property
    def cost_per_response(self):
        """Calculate cost per response"""
        if self.total_replied > 0:
            return self.tokens_consumed / self.total_replied
        return None


class CampaignRecipient(models.Model):
    """
    Individual recipients in a campaign
    """
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='recipients')
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE)
    communication = models.OneToOneField(Communication, on_delete=models.CASCADE, null=True, blank=True)
    
    # Status tracking
    status = models.CharField(max_length=20, choices=Communication.STATUS_CHOICES, default='sent')
    
    # Timestamps
    added_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    opened_at = models.DateTimeField(null=True, blank=True)
    clicked_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        unique_together = ['campaign', 'lead']
    
    def __str__(self):
        return f"{self.campaign.name} → {self.lead.first_name} {self.lead.last_name}"


class CommunicationAnalytics(models.Model):
    """
    Daily analytics for communication tracking
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='communication_analytics')
    date = models.DateField()
    
    # Communication counts by type
    sms_sent = models.IntegerField(default=0)
    emails_sent = models.IntegerField(default=0)
    mail_sent = models.IntegerField(default=0)
    calls_made = models.IntegerField(default=0)
    
    # Token usage
    tokens_consumed = models.IntegerField(default=0)
    mail_tokens_consumed = models.IntegerField(default=0)
    
    # Response tracking
    responses_received = models.IntegerField(default=0)
    appointments_scheduled = models.IntegerField(default=0)
    
    # Costs
    total_communication_cost = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    
    class Meta:
        unique_together = ['user', 'date']
        ordering = ['-date']
    
    def __str__(self):
        return f"{self.user.username} - {self.date}"


class CommunicationService:
    """
    Service class for handling communications
    Implements token consumption and tracking like original system
    """
    
    # Token costs (from original Node.js system)
    TOKEN_COSTS = {
        'sms': 2,
        'email': 1,
        'phone': 1,  # Per minute
        'postcard': 5,  # Uses mail tokens
        'letter': 3,   # Uses mail tokens
    }
    
    @classmethod
    def send_communication(cls, user, lead, comm_type, content, **kwargs):
        """
        Send a communication and track tokens
        """
        # Check if user has permission
        from .user_roles import UserPermission
        if not user.profile.has_permission(UserPermission.CAN_VIEW_LEADS):
            raise PermissionError("No permission to send communications")
        
        # Calculate token cost
        token_cost = cls.TOKEN_COSTS.get(comm_type, 1)
        token_type = 'mail' if comm_type in ['postcard', 'letter'] else 'regular'
        
        # Check token availability
        profile = user.profile
        available_tokens = profile.mail_tokens if token_type == 'mail' else profile.tokens
        
        if available_tokens < token_cost:
            raise ValueError(f"Insufficient {token_type} tokens. Need {token_cost}, have {available_tokens}")
        
        # Create communication record
        communication = Communication.objects.create(
            user=user,
            lead=lead,
            type=comm_type,
            direction='outbound',
            content=content,
            tokens_cost=token_cost,
            token_type=token_type,
            **kwargs
        )
        
        # Deduct tokens
        tokens_before = available_tokens
        if token_type == 'mail':
            profile.mail_tokens -= token_cost
            tokens_after = profile.mail_tokens
        else:
            profile.tokens -= token_cost
            tokens_after = profile.tokens
        profile.save()
        
        # Record token transaction
        TokenTransaction.objects.create(
            user=user,
            token_type=token_type,
            transaction_type='consumption',
            action_type=f"{comm_type}_send",
            tokens_before=tokens_before,
            tokens_changed=-token_cost,
            tokens_after=tokens_after,
            description=f"{comm_type.upper()} to {lead.first_name} {lead.last_name}",
            lead=lead
        )
        
        # Update analytics
        cls._update_analytics(user, comm_type, token_cost, token_type)
        
        return communication
    
    @classmethod
    def _update_analytics(cls, user, comm_type, tokens_used, token_type):
        """Update daily analytics"""
        today = timezone.now().date()
        analytics, created = CommunicationAnalytics.objects.get_or_create(
            user=user,
            date=today,
            defaults={
                'tokens_consumed': 0,
                'mail_tokens_consumed': 0,
            }
        )
        
        # Update counts
        if comm_type == 'sms':
            analytics.sms_sent += 1
        elif comm_type == 'email':
            analytics.emails_sent += 1
        elif comm_type in ['postcard', 'letter']:
            analytics.mail_sent += 1
        elif comm_type == 'phone':
            analytics.calls_made += 1
        
        # Update token usage
        if token_type == 'mail':
            analytics.mail_tokens_consumed += tokens_used
        else:
            analytics.tokens_consumed += tokens_used
        
        analytics.save()
    
    @classmethod
    def get_user_communication_stats(cls, user, days=30):
        """Get user's communication statistics"""
        from django.utils import timezone
        from datetime import timedelta
        
        since_date = timezone.now().date() - timedelta(days=days)
        
        analytics = CommunicationAnalytics.objects.filter(
            user=user,
            date__gte=since_date
        ).aggregate(
            total_sms=models.Sum('sms_sent'),
            total_emails=models.Sum('emails_sent'),
            total_mail=models.Sum('mail_sent'),
            total_calls=models.Sum('calls_made'),
            total_tokens=models.Sum('tokens_consumed'),
            total_mail_tokens=models.Sum('mail_tokens_consumed'),
        )
        
        return {
            'period_days': days,
            'sms_sent': analytics['total_sms'] or 0,
            'emails_sent': analytics['total_emails'] or 0,
            'mail_sent': analytics['total_mail'] or 0,
            'calls_made': analytics['total_calls'] or 0,
            'tokens_used': analytics['total_tokens'] or 0,
            'mail_tokens_used': analytics['total_mail_tokens'] or 0,
        }