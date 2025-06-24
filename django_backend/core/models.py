"""
DroneStrike v2 Core Models
Translated from Laravel business logic with exact mathematical precision
Preserves all proven financial calculations and business rules
"""

from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator
from django.conf import settings
import uuid
from decimal import Decimal, ROUND_HALF_UP
import math
from datetime import datetime, timedelta


class Company(models.Model):
    """Company/Organization model"""
    name = models.CharField(max_length=255)
    logo = models.ImageField(upload_to='company_logos/', null=True, blank=True)
    primary_color = models.CharField(max_length=7, default='#1a3d6d')  # DroneStrike theme
    website = models.URLField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Companies"

    def __str__(self):
        return self.name


class UserProfile(models.Model):
    """Enhanced user profile with DroneStrike business logic"""
    ROLE_CHOICES = [
        ('user', 'User'),
        ('admin', 'Admin'),
        ('manager', 'Manager'),
        ('agent', 'Agent'),
        ('soldier', 'BOTG Soldier'),
        ('officer', 'Loan Officer'),
        ('five_star_general', 'Five Star General'),  # 50% off for life
        ('beta_infantry', 'Beta Infantry'),  # 50% off first 3 months
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='employees', null=True, blank=True)
    
    # Enhanced fields
    company_name = models.CharField(max_length=255, null=True, blank=True)
    logo_url = models.URLField(null=True, blank=True)
    color_scheme = models.CharField(max_length=7, default='#1a3d6d')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='user')
    
    # Token system (from Token Values.xlsx)
    tokens = models.IntegerField(default=10000)  # Regular tokens
    mail_tokens = models.IntegerField(default=0)  # Special mail tokens ($0.80 each)
    
    # Stripe integration
    stripe_customer_id = models.CharField(max_length=100, null=True, blank=True)
    stripe_subscription_id = models.CharField(max_length=100, null=True, blank=True)
    subscription_plan = models.CharField(max_length=50, null=True, blank=True)
    
    # Subscription management (from Laravel business logic)
    monthly_subscription_active = models.BooleanField(default=False)
    subscription_start_date = models.DateField(null=True, blank=True)
    beta_months_remaining = models.IntegerField(default=0)  # For beta infantry discount
    
    # User experience
    onboarding_completed = models.BooleanField(default=False)
    last_activity = models.DateTimeField(null=True, blank=True)
    
    # Voice command features
    voice_commands_enabled = models.BooleanField(default=True)
    voice_wake_term = models.CharField(max_length=50, default='drone strike')
    
    # User preferences
    preferences = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.username}'s Profile"


class County(models.Model):
    """County information for property location"""
    name = models.CharField(max_length=100)
    state = models.CharField(max_length=2)
    fips_code = models.CharField(max_length=5, unique=True)
    
    # Tax lien specific data
    tax_sale_date = models.DateField(null=True, blank=True)
    redemption_period_months = models.IntegerField(default=24)
    interest_rate = models.DecimalField(max_digits=5, decimal_places=4, default=Decimal('0.08'))
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name_plural = "Counties"
        unique_together = ['name', 'state']
    
    def __str__(self):
        return f"{self.name}, {self.state}"


class Property(models.Model):
    """Property model with Laravel business logic for valuation"""
    PROPERTY_TYPE_CHOICES = [
        ('single_family', 'Single Family'),
        ('multi_family', 'Multi-Family'),
        ('condo', 'Condo'),
        ('townhouse', 'Townhouse'),
        ('commercial', 'Commercial'),
        ('land', 'Land'),
        ('mobile_home', 'Mobile Home'),
    ]
    
    DISPOSITION_CHOICES = [
        ('active', 'Active'),
        ('sold', 'Sold'),
        ('foreclosure', 'In Foreclosure'),
        ('pending', 'Pending'),
        ('withdrawn', 'Withdrawn'),
    ]
    
    county = models.ForeignKey(County, on_delete=models.CASCADE, related_name='properties')
    
    # Address Information
    address1 = models.CharField(max_length=255)
    address2 = models.CharField(max_length=255, null=True, blank=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=2)
    zip_code = models.CharField(max_length=10)
    
    # Original address tracking (for correction detection)
    original_address1 = models.CharField(max_length=255)
    original_city = models.CharField(max_length=100)
    original_state = models.CharField(max_length=2)
    original_zip = models.CharField(max_length=10)
    address1_corrected = models.BooleanField(default=False)
    
    # Geographic Coordinates
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    place_id = models.CharField(max_length=255, null=True, blank=True)  # Google Places ID
    
    # Property Values (Laravel: improvement_value + land_value = total_value)
    improvement_value = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    land_value = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_value = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    market_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    
    # Property details
    property_type = models.CharField(max_length=20, choices=PROPERTY_TYPE_CHOICES)
    disposition = models.CharField(max_length=20, choices=DISPOSITION_CHOICES, default='active')
    square_feet = models.IntegerField(null=True, blank=True)
    bedrooms = models.IntegerField(null=True, blank=True)
    bathrooms = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    year_built = models.IntegerField(null=True, blank=True)
    lot_size = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    # Tax Information (Panacea PLE System Integration)
    account_number = models.CharField(max_length=100)
    tax_url = models.URLField(null=True, blank=True)
    cad_url = models.URLField(null=True, blank=True)
    
    # PLE system data
    ple_property_id = models.IntegerField(null=True, blank=True)
    ple_amount_due = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    ple_amount_tax = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    ple_lawsuit_no = models.CharField(max_length=100, null=True, blank=True)
    ple_date = models.DateField(null=True, blank=True)
    ple_rate = models.DecimalField(max_digits=5, decimal_places=4, null=True, blank=True)
    ple_apr = models.DecimalField(max_digits=5, decimal_places=4, null=True, blank=True)
    ple_pmt = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    ple_boc_repay = models.CharField(max_length=255, null=True, blank=True)
    ple_county = models.CharField(max_length=100, null=True, blank=True)
    ple_purl = models.URLField(null=True, blank=True)
    ple_code = models.CharField(max_length=50, null=True, blank=True)
    ple_obligation = models.TextField(null=True, blank=True)
    ple_if_paid_by = models.DateField(null=True, blank=True)
    
    # Existing loans and encumbrances
    existing_tax_loan = models.BooleanField(default=False)
    existing_tax_loan_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    existing_tax_loan_lender = models.CharField(max_length=255, null=True, blank=True)
    
    # Foreclosure status
    in_foreclosure = models.BooleanField(default=False)
    last_known_lawsuit_date = models.DateField(null=True, blank=True)
    last_known_lawsuit_no = models.CharField(max_length=100, null=True, blank=True)
    
    # Payment tracking
    last_payment = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    last_payment_date = models.DateField(null=True, blank=True)
    last_payer = models.CharField(max_length=255, null=True, blank=True)
    
    # Additional property details
    term = models.IntegerField(null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    street = models.CharField(max_length=255, null=True, blank=True)
    exemptions = models.CharField(max_length=255, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    
    # Status
    is_active = models.BooleanField(default=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name_plural = "Properties"
        indexes = [
            models.Index(fields=['county', 'city']),
            models.Index(fields=['account_number']),
            models.Index(fields=['total_value']),
            models.Index(fields=['ple_amount_due']),
        ]
    
    def save(self, *args, **kwargs):
        """Override save to calculate total_value (Laravel business rule)"""
        self.total_value = self.improvement_value + self.land_value
        
        # Set original address on first save
        if not self.pk:
            self.original_address1 = self.address1
            self.original_city = self.city
            self.original_state = self.state
            self.original_zip = self.zip_code
        
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.address1}, {self.city}, {self.state}"


class Lead(models.Model):
    """Lead model with Laravel business logic - feeds to BOTG and creates TLC opportunities"""
    LEAD_STATUS_CHOICES = [
        ('target_acquired', 'Target Acquired'),
        ('initial_contact', 'Initial Contact'),
        ('interested', 'Interested'),
        ('not_interested', 'Not Interested'),
        ('do_not_contact', 'Do Not Contact'),
        ('qualified', 'Qualified'),
        ('negotiation', 'Negotiation'),
        ('closed_won', 'Closed Won'),
        ('closed_lost', 'Closed Lost'),
    ]
    
    OWNER_TYPE_CHOICES = [
        ('absentee', 'Absentee'),
        ('out_of_state', 'Out-of-State'),
        ('local', 'Local'),
        ('investor', 'Investor'),
        ('estate', 'Estate'),
        ('entity', 'Entity'),
        ('individual', 'Individual'),
    ]
    
    # User relationship
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_leads')
    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='leads', null=True, blank=True)
    
    # Property owner information
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    owner_type = models.CharField(max_length=20, choices=OWNER_TYPE_CHOICES, null=True, blank=True)
    
    # Contact information
    email = models.EmailField(null=True, blank=True)
    phone_cell = models.CharField(max_length=20, null=True, blank=True)
    phone_other = models.CharField(max_length=20, null=True, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    
    # Mailing address (from Laravel Lead model)
    mailing_address_1 = models.CharField(max_length=255)
    mailing_address_2 = models.CharField(max_length=255, null=True, blank=True)
    mailing_street = models.CharField(max_length=255, null=True, blank=True)
    mailing_city = models.CharField(max_length=100)
    mailing_county = models.CharField(max_length=100, null=True, blank=True)
    mailing_state = models.CharField(max_length=2)
    mailing_zip5 = models.CharField(max_length=5)
    mailing_zip4 = models.CharField(max_length=4, null=True, blank=True)
    mailing_place_id = models.CharField(max_length=255, null=True, blank=True)
    
    # Address correction tracking (Laravel)
    mailing_address_1_corrected = models.BooleanField(default=False)
    is_bad_address = models.BooleanField(default=False)
    geocoding = models.JSONField(null=True, blank=True)
    
    # Communication preferences and flags (Laravel)
    do_not_email = models.BooleanField(default=False)
    do_not_email_added = models.BooleanField(default=False)
    do_not_mail = models.BooleanField(default=False)
    email_added = models.CharField(max_length=255, null=True, blank=True)
    email_added_date = models.DateTimeField(null=True, blank=True)
    
    # Postcard tracking (Laravel)
    returned_postcard = models.BooleanField(default=False)
    returned_postcard_date = models.DateTimeField(null=True, blank=True)
    returned_postcard_reason = models.CharField(max_length=255, null=True, blank=True)
    
    # Safety and business flags (Laravel)
    is_business = models.BooleanField(default=False)
    is_dangerous = models.BooleanField(default=False)
    safety_concerns_notes = models.TextField(null=True, blank=True)
    safety_concern_types = models.JSONField(default=list, blank=True)
    
    # Language preferences (Laravel)
    en = models.BooleanField(default=True)  # English
    es = models.BooleanField(default=False)  # Spanish
    
    # Financial information
    has_mortgage = models.BooleanField(default=False)
    monthly_income = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    # Lead management
    lead_status = models.CharField(max_length=20, choices=LEAD_STATUS_CHOICES, default='target_acquired')
    last_contact = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    
    # Geographic data
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    
    # AI scoring and analytics
    score_value = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="AI-powered lead score (0-100)"
    )
    scored_at = models.DateTimeField(null=True, blank=True)
    
    # DroneStrike Workflow Integration (from system architecture)
    workflow_stage = models.CharField(max_length=30, choices=[
        ('lead_identified', 'Lead Identified'),
        ('botg_assigned', 'BOTG Mission Assigned'),
        ('botg_in_progress', 'BOTG Mission In Progress'),
        ('botg_completed', 'BOTG Assessment Complete'),
        ('opportunity_created', 'Opportunity Created'),
        ('tlc_loan_originated', 'TLC Loan Originated'),
        ('tlc_client_onboarded', 'TLC Client Onboarded'),
        ('loan_servicing', 'TLC Loan Servicing'),
    ], default='lead_identified')
    
    # External system references
    botg_mission_id = models.CharField(max_length=100, null=True, blank=True)
    tlc_loan_id = models.CharField(max_length=100, null=True, blank=True)
    tlc_borrower_id = models.CharField(max_length=100, null=True, blank=True)
    
    # Integration status
    sent_to_botg = models.BooleanField(default=False)
    botg_response_received = models.BooleanField(default=False)
    sent_to_tlc = models.BooleanField(default=False)
    tlc_loan_created = models.BooleanField(default=False)
    
    # Data tracking
    source_batch = models.CharField(max_length=100, null=True, blank=True)
    imported_from = models.CharField(max_length=100, null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    botg_assigned_at = models.DateTimeField(null=True, blank=True)
    botg_completed_at = models.DateTimeField(null=True, blank=True)
    tlc_sent_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['lead_status', 'owner']),
            models.Index(fields=['score_value']),
            models.Index(fields=['mailing_city', 'mailing_state']),
            models.Index(fields=['source_batch']),
            models.Index(fields=['workflow_stage']),
        ]
    
    def __str__(self):
        return f"{self.first_name} {self.last_name} - {self.mailing_city}, {self.mailing_state}"


class Opportunity(models.Model):
    """Investment opportunity model (from Laravel ScheduleService)"""
    OPPORTUNITY_STATUS_CHOICES = [
        ('identified', 'Identified'),
        ('analyzing', 'Analyzing'),
        ('qualified', 'Qualified'),
        ('proposal_sent', 'Proposal Sent'),
        ('negotiation', 'In Negotiation'),
        ('approved', 'Approved'),
        ('funded', 'Funded'),
        ('closed', 'Closed'),
        ('rejected', 'Rejected'),
    ]
    
    # Core relationships
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='opportunities')
    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='opportunities')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='opportunities')
    
    # Opportunity details
    status = models.CharField(max_length=20, choices=OPPORTUNITY_STATUS_CHOICES, default='identified')
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    
    # Financial calculations (Laravel ScheduleService business logic)
    requested_loan_amount = models.DecimalField(max_digits=12, decimal_places=2)
    max_loan_amount = models.DecimalField(max_digits=12, decimal_places=2)
    ltv_ratio = models.DecimalField(max_digits=5, decimal_places=4)
    
    # Interest and term (Laravel defaults)
    interest_rate = models.DecimalField(max_digits=5, decimal_places=4, default=Decimal('0.08'))  # 8%
    term_months = models.IntegerField(default=24)
    
    # Payment calculations (from Laravel ScheduleService)
    monthly_payment = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    total_interest = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    total_payments = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    
    # Risk assessment
    risk_score = models.IntegerField(
        default=50,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    risk_factors = models.JSONField(default=list, blank=True)
    
    # Due diligence
    property_inspection_completed = models.BooleanField(default=False)
    title_search_completed = models.BooleanField(default=False)
    financial_verification_completed = models.BooleanField(default=False)
    
    # Timeline
    projected_funding_date = models.DateField(null=True, blank=True)
    
    # External integration
    tlc_opportunity_id = models.CharField(max_length=100, null=True, blank=True)
    sent_to_tlc = models.BooleanField(default=False)
    tlc_approved = models.BooleanField(default=False)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name_plural = "Opportunities"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'user']),
            models.Index(fields=['ltv_ratio']),
            models.Index(fields=['requested_loan_amount']),
        ]
    
    def __str__(self):
        return f"{self.title} - ${self.requested_loan_amount}"


class TokenTransaction(models.Model):
    """Token usage tracking (from Token Values.xlsx)"""
    TOKEN_TYPE_CHOICES = [
        ('regular', 'Regular Token'),
        ('mail', 'Mail Token'),
    ]
    
    TRANSACTION_TYPE_CHOICES = [
        ('purchase', 'Purchase'),
        ('consumption', 'Consumption'),
        ('refund', 'Refund'),
        ('bonus', 'Bonus'),
        ('subscription', 'Subscription Credit'),
    ]
    
    ACTION_TYPE_CHOICES = [
        ('postcard_send', 'Postcard Send'),
        ('email_send', 'Email Send'),
        ('sms_send', 'SMS Send'),
        ('phone_verification', 'Phone Verification'),
        ('address_verification', 'Address Verification'),
        ('property_lookup', 'Property Lookup'),
        ('lead_export', 'Lead Export'),
        ('api_call', 'API Call'),
        ('other', 'Other'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='token_transactions')
    
    # Transaction details
    token_type = models.CharField(max_length=10, choices=TOKEN_TYPE_CHOICES)
    transaction_type = models.CharField(max_length=15, choices=TRANSACTION_TYPE_CHOICES)
    action_type = models.CharField(max_length=25, choices=ACTION_TYPE_CHOICES, null=True, blank=True)
    
    # Amounts (from Token Values.xlsx)
    tokens_before = models.IntegerField()
    tokens_changed = models.IntegerField()  # Positive for credit, negative for debit
    tokens_after = models.IntegerField()
    
    # Cost tracking
    cost_per_token = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True)
    total_cost = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    
    # Reference data
    description = models.CharField(max_length=255)
    reference_id = models.CharField(max_length=100, null=True, blank=True)  # External transaction ID
    
    # Related objects
    lead = models.ForeignKey(Lead, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Stripe integration
    stripe_payment_intent_id = models.CharField(max_length=100, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'token_type']),
            models.Index(fields=['transaction_type', 'created_at']),
        ]
    
    def __str__(self):
        sign = '+' if self.tokens_changed > 0 else ''
        return f"{self.user.username}: {sign}{self.tokens_changed} {self.token_type} tokens"


class Device(models.Model):
    """Device tracking for mission creation (from Laravel)"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='devices')
    device_id = models.CharField(max_length=255, unique=True)
    device_name = models.CharField(max_length=255, null=True, blank=True)
    device_type = models.CharField(max_length=50, choices=[
        ('ios', 'iOS'),
        ('android', 'Android'),
        ('web', 'Web Browser'),
    ])
    push_token = models.CharField(max_length=255, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    last_seen = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.user.username}'s {self.device_type} device"


class MissionDeclineReason(models.Model):
    """Decline reasons for missions (from Laravel)"""
    reason = models.CharField(max_length=255)
    is_safety_related = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    display_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['display_order', 'reason']
    
    def __str__(self):
        return self.reason


class Mission(models.Model):
    """Mission model - translated from Laravel Mission.php with exact business logic"""
    
    # Status constants from Laravel
    STATUS_NEW = 1
    STATUS_ACCEPTED = 2
    STATUS_ON_HOLD = 4
    STATUS_CLOSED = 8
    STATUS_DECLINED = 16
    STATUS_DECLINED_SAFETY = 32
    STATUS_HOLD_EXPIRED = 64
    STATUS_CLOSED_FOR_INACTIVITY = 128
    STATUS_SUSPENDED = 256
    STATUS_PAUSED = 1024
    
    STATUS_CHOICES = [
        (STATUS_NEW, 'New'),
        (STATUS_ACCEPTED, 'Accepted'),
        (STATUS_ON_HOLD, 'On Hold'),
        (STATUS_CLOSED, 'Closed'),
        (STATUS_DECLINED, 'Declined'),
        (STATUS_DECLINED_SAFETY, 'Declined - Safety'),
        (STATUS_HOLD_EXPIRED, 'Hold Expired'),
        (STATUS_CLOSED_FOR_INACTIVITY, 'Closed for Inactivity'),
        (STATUS_SUSPENDED, 'Suspended'),
        (STATUS_PAUSED, 'Paused'),
    ]
    
    # Core relationships (from Laravel Mission.php)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='missions')
    prospect = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='missions')
    created_on_device = models.ForeignKey(Device, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Mission status and workflow
    status = models.IntegerField(choices=STATUS_CHOICES, default=STATUS_NEW)
    decline_reason = models.ForeignKey(MissionDeclineReason, on_delete=models.SET_NULL, null=True, blank=True)
    
    # GPS tracking (exact precision from Laravel - decimal 17,14)
    lat_created = models.DecimalField(max_digits=17, decimal_places=14, null=True, blank=True)
    lng_created = models.DecimalField(max_digits=17, decimal_places=14, null=True, blank=True)
    lat_completed = models.DecimalField(max_digits=17, decimal_places=14, null=True, blank=True)
    lng_completed = models.DecimalField(max_digits=17, decimal_places=14, null=True, blank=True)
    
    # Mission completion
    completed_at = models.DateTimeField(null=True, blank=True)
    
    # Polymorphic linking (from Laravel)
    linked_with = models.CharField(max_length=100, null=True, blank=True)
    link_type = models.CharField(max_length=20, choices=[
        ('USER', 'User'),
        ('OPPORTUNITY', 'Opportunity'),
    ], null=True, blank=True)
    
    # Mission flags and business logic
    is_ongoing = models.BooleanField(default=False)
    go_to_lead = models.BooleanField(default=False)
    
    # Financial tracking (from Laravel)
    purchase_offer = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    initial_amount_due = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['prospect']),
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['is_ongoing']),
        ]
    
    def __str__(self):
        return f"Mission {self.id} - {self.prospect} ({self.get_status_display()})"
    
    @property
    def is_active(self):
        """Check if mission is in active state (from Laravel business logic)"""
        return self.status in [self.STATUS_NEW, self.STATUS_ACCEPTED, self.STATUS_ON_HOLD]
    
    @property
    def can_be_declined(self):
        """Check if mission can be declined (from Laravel business logic)"""
        return self.status in [self.STATUS_NEW, self.STATUS_ACCEPTED]
    
    @property
    def can_be_paused(self):
        """Check if mission can be paused (from Laravel business logic)"""
        return self.status == self.STATUS_ACCEPTED
    
    def get_distance_traveled(self):
        """Calculate distance between start and completion points"""
        if self.lat_created and self.lng_created and self.lat_completed and self.lng_completed:
            from math import radians, cos, sin, asin, sqrt
            
            # Convert to float for calculation
            lat1, lon1 = float(self.lat_created), float(self.lng_created)
            lat2, lon2 = float(self.lat_completed), float(self.lng_completed)
            
            # Haversine formula
            lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
            c = 2 * asin(sqrt(a))
            r = 3956  # Radius of earth in miles
            return round(c * r, 2)
        return None


class MissionRoute(models.Model):
    """Mission route for multi-target optimization (from Laravel)"""
    
    STATUS_PENDING = 1
    STATUS_ACTIVE = 2
    STATUS_COMPLETED = 4
    
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_ACTIVE, 'Active'),
        (STATUS_COMPLETED, 'Completed'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='mission_routes')
    status = models.IntegerField(choices=STATUS_CHOICES, default=STATUS_PENDING)
    
    # Route optimization
    optimization_url = models.TextField(null=True, blank=True)  # External routing service URL
    is_optimized = models.BooleanField(default=False)
    
    # Route metadata
    total_distance_meters = models.IntegerField(null=True, blank=True)
    total_time_seconds = models.IntegerField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Route {self.id} for {self.user.username} ({self.get_status_display()})"


class MissionRoutePoint(models.Model):
    """Individual points in a mission route (from Laravel)"""
    
    mission_route = models.ForeignKey(MissionRoute, on_delete=models.CASCADE, related_name='route_points')
    prospect = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='route_points')
    
    # GPS coordinates (exact precision from Laravel)
    lat = models.DecimalField(max_digits=17, decimal_places=14)
    lng = models.DecimalField(max_digits=17, decimal_places=14)
    
    # Route optimization data
    provided_index = models.IntegerField()  # Original order
    optimized_index = models.IntegerField(null=True, blank=True)  # Optimized order
    
    # Distance and timing to next point
    length_in_meters = models.IntegerField(null=True, blank=True)
    travel_time_in_seconds = models.IntegerField(null=True, blank=True)
    
    # Route geometry (from routing service)
    points = models.JSONField(null=True, blank=True)  # Detailed route points
    
    # Point status
    STATUS_PENDING = 1
    STATUS_VISITED = 2
    STATUS_SKIPPED = 4
    
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_VISITED, 'Visited'),
        (STATUS_SKIPPED, 'Skipped'),
    ]
    
    status = models.IntegerField(choices=STATUS_CHOICES, default=STATUS_PENDING)
    visited_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['optimized_index', 'provided_index']
        indexes = [
            models.Index(fields=['mission_route', 'optimized_index']),
            models.Index(fields=['prospect']),
        ]
    
    def __str__(self):
        return f"Route Point {self.id} - {self.prospect}"


class MissionLog(models.Model):
    """Mission search logs (from Laravel)"""
    
    mission = models.ForeignKey(Mission, on_delete=models.CASCADE, related_name='logs')
    
    # Search center coordinates
    lat = models.DecimalField(max_digits=17, decimal_places=14)
    lng = models.DecimalField(max_digits=17, decimal_places=14)
    radius = models.IntegerField()  # Search radius in meters
    
    # Search filters (from Laravel business logic)
    filters = models.JSONField(default=dict, blank=True)
    
    # Financial filters
    amount_due_min = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    amount_due_max = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    
    # Results metadata
    results_count = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Search Log {self.id} for Mission {self.mission.id}"


class MissionPhoto(models.Model):
    """Mission photos with GPS validation (from Laravel)"""
    
    mission = models.ForeignKey(Mission, on_delete=models.CASCADE, related_name='photos')
    
    # Photo file
    photo = models.ImageField(upload_to='mission_photos/')
    
    # GPS coordinates where photo was taken
    lat = models.DecimalField(max_digits=17, decimal_places=14, null=True, blank=True)
    lng = models.DecimalField(max_digits=17, decimal_places=14, null=True, blank=True)
    
    # Validation
    is_valid_location = models.BooleanField(default=False)
    distance_from_target = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)  # meters
    
    # Photo metadata
    caption = models.CharField(max_length=255, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Photo {self.id} for Mission {self.mission.id}"


# Additional Token System Models (extending existing TokenTransaction)

class TokenPackagePurchase(models.Model):
    """Track token package purchases"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='package_purchases')
    package_name = models.CharField(max_length=200)
    regular_tokens = models.IntegerField(default=0)
    mail_tokens = models.IntegerField(default=0)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Stripe details
    stripe_payment_intent_id = models.CharField(max_length=200, unique=True)
    stripe_customer_id = models.CharField(max_length=200)
    payment_status = models.CharField(max_length=50, default='pending')
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.user.username} - {self.package_name} - ${self.total_price}"

class SubscriptionPlan(models.Model):
    """Subscription plans available"""
    name = models.CharField(max_length=200)
    price_monthly = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField()
    features = models.JSONField(default=list)
    stripe_price_id = models.CharField(max_length=200, unique=True)
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.name} - ${self.price_monthly}/month"

class UserSubscription(models.Model):
    """User's current subscription"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='subscription')
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.CASCADE)
    
    # Stripe details
    stripe_subscription_id = models.CharField(max_length=200, unique=True)
    stripe_customer_id = models.CharField(max_length=200)
    
    # Status
    status = models.CharField(max_length=50, default='active')  # active, canceled, past_due, etc.
    current_period_start = models.DateTimeField()
    current_period_end = models.DateTimeField()
    
    # Beta discounts
    discount_type = models.CharField(max_length=50, null=True, blank=True)
    discount_percent = models.IntegerField(null=True, blank=True)
    discount_end_date = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.username} - {self.plan.name}"

class LeadPackagePurchase(models.Model):
    """Lead package purchases"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='lead_purchases')
    package_name = models.CharField(max_length=200)
    number_of_leads = models.IntegerField(validators=[MinValueValidator(1)])
    price_per_lead = models.DecimalField(max_digits=6, decimal_places=2)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Tokens included with package
    regular_tokens_included = models.IntegerField(default=0)
    mail_tokens_included = models.IntegerField(default=0)
    
    # Features included
    includes_skip_trace = models.BooleanField(default=False)
    includes_mail_tokens = models.BooleanField(default=False)
    
    # Stripe details
    stripe_payment_intent_id = models.CharField(max_length=200, unique=True)
    payment_status = models.CharField(max_length=50, default='pending')
    
    # Fulfillment
    leads_delivered = models.IntegerField(default=0)
    tokens_credited = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.user.username} - {self.number_of_leads} leads - ${self.total_price}"