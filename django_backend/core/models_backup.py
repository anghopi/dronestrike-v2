"""
DroneStrike v2 Core Models
"""

from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator
from django.conf import settings
from decimal import Decimal, ROUND_HALF_UP
import math
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional


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
    
    @property
    def monthly_rate(self):
        """Calculate monthly subscription rate based on user type (Laravel business logic)"""
        base_rate = Decimal('799.00')
        
        if self.role == 'five_star_general':
            return base_rate * Decimal('0.5')  # 50% off for life
        elif self.role == 'beta_infantry' and self.beta_months_remaining > 0:
            return base_rate * Decimal('0.5')  # 50% off for remaining beta months
        
        return base_rate
    
    @property
    def is_premium_user(self):
        """Check if user has premium subscription"""
        return self.monthly_subscription_active or self.role in ['five_star_general', 'beta_infantry']
    
    def consume_tokens(self, token_type, amount):
        """Consume tokens based on action type (from Token Values.xlsx)"""
        if token_type == 'mail' and self.mail_tokens >= amount:
            self.mail_tokens -= amount
            self.save()
            return True
        elif token_type == 'regular' and self.tokens >= amount:
            self.tokens -= amount
            self.save()
            return True
        return False
    
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
        """Override save to calculate total_value"""
        self.total_value = self.improvement_value + self.land_value
        
        # Set original address on first save
        if not self.pk:
            self.original_address1 = self.address1
            self.original_city = self.city
            self.original_state = self.state
            self.original_zip = self.zip_code
        
        super().save(*args, **kwargs)
    
    @property
    def full_address(self):
        """Get formatted full address"""
        parts = [self.address1]
        if self.address2:
            parts.append(self.address2)
        parts.append(f"{self.city}, {self.state} {self.zip_code}")
        return ', '.join(parts)
    
    def calculate_property_score(self):
        """Calculate property investment score"""
        score = 50  # Base score
        
        # Market value factor (0-30 points)
        market_value = self.market_value or self.total_value
        if market_value > 100000:
            score += 30
        elif market_value > 50000:
            score += 20
        elif market_value > 25000:
            score += 10
        
        # Tax burden factor (-20 to +10 points)
        if self.ple_amount_due and market_value:
            tax_to_value_ratio = self.ple_amount_due / market_value
            if tax_to_value_ratio < Decimal('0.05'):
                score += 10
            elif tax_to_value_ratio > Decimal('0.20'):
                score -= 20
            elif tax_to_value_ratio > Decimal('0.10'):
                score -= 10
        
        # Existing encumbrances (-30 points)
        if self.existing_tax_loan:
            score -= 15
        if self.in_foreclosure:
            score -= 30
        
        # Property condition (improvement to land ratio)
        if self.total_value > 0:
            improvement_ratio = self.improvement_value / self.total_value
            if improvement_ratio > Decimal('0.7'):
                score += 15  # Well-improved property
            elif improvement_ratio < Decimal('0.3'):
                score -= 10  # Mostly land value
        
        return max(0, min(100, score))
    
    def calculate_ltv(self, loan_amount):
        """Calculate loan-to-value ratio (Laravel: round($loanAmount / $property->market_value, 4))"""
        market_value = self.market_value or self.total_value
        if market_value == 0:
            return Decimal('0.0000')
        
        ltv = loan_amount / market_value
        return ltv.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
    
    def calculate_max_loan_amount(self, max_ltv=None):
        """Calculate maximum loan amount (Laravel: market_value * 0.45)"""
        if max_ltv is None:
            max_ltv = Decimal('0.45')
        market_value = self.market_value or self.total_value
        max_loan = market_value * max_ltv
        return max_loan.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
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
    
    # Automated scoring and analytics
    score_value = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Automated lead score (0-100)"
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


class Communication(models.Model):
    """Communication tracking model"""
    COMMUNICATION_TYPE_CHOICES = [
        ('postcard', 'Postcard'),
        ('letter', 'Letter'),
        ('email', 'Email'),
        ('sms', 'SMS'),
        ('phone_call', 'Phone Call'),
        ('door_knock', 'Door Knock'),
        ('other', 'Other'),
    ]
    
    STATUS_CHOICES = [
        ('sent', 'Sent'),
        ('delivered', 'Delivered'),
        ('opened', 'Opened'),
        ('clicked', 'Clicked'),
        ('bounced', 'Bounced'),
        ('failed', 'Failed'),
        ('returned', 'Returned'),
    ]
    
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='communications')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='communications')
    
    # Communication details
    type = models.CharField(max_length=20, choices=COMMUNICATION_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='sent')
    subject = models.CharField(max_length=255, null=True, blank=True)
    content = models.TextField(null=True, blank=True)
    
    # Tracking data
    external_id = models.CharField(max_length=255, null=True, blank=True)  # Mailgun/service ID
    cost = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True)
    
    # Response tracking
    response_received = models.BooleanField(default=False)
    response_content = models.TextField(null=True, blank=True)
    
    # Timestamps
    sent_at = models.DateTimeField(auto_now_add=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    opened_at = models.DateTimeField(null=True, blank=True)
    clicked_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-sent_at']


class Mission(models.Model):
    """BOTG Mission model"""
    MISSION_STATUS_CHOICES = [
        ('pending', 'Pending Assignment'),
        ('assigned', 'Assigned'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('failed', 'Failed'),
    ]
    
    MISSION_TYPE_CHOICES = [
        ('property_assessment', 'Property Assessment'),
        ('owner_contact', 'Owner Contact'),
        ('documentation', 'Documentation'),
        ('verification', 'Verification'),
        ('follow_up', 'Follow Up'),
    ]
    
    # Mission assignment
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='missions')
    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='missions', null=True, blank=True)
    assigned_soldier = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='assigned_missions',
        limit_choices_to={'profile__role': 'soldier'}
    )
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_missions')
    
    # Mission details
    mission_type = models.CharField(max_length=30, choices=MISSION_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=MISSION_STATUS_CHOICES, default='pending')
    priority = models.IntegerField(default=3, validators=[MinValueValidator(1), MaxValueValidator(5)])
    
    # Instructions and objectives
    title = models.CharField(max_length=255)
    description = models.TextField()
    objectives = models.JSONField(default=list, blank=True)
    special_instructions = models.TextField(null=True, blank=True)
    
    # Location and timing
    target_address = models.CharField(max_length=500)
    estimated_duration = models.IntegerField(null=True, blank=True, help_text="Duration in minutes")
    scheduled_for = models.DateTimeField(null=True, blank=True)
    
    # Completion data
    completion_notes = models.TextField(null=True, blank=True)
    photos = models.JSONField(default=list, blank=True)  # Photo URLs
    results = models.JSONField(default=dict, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    assigned_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'assigned_soldier']),
            models.Index(fields=['priority', 'created_at']),
        ]
    
    def __str__(self):
        return f"Mission: {self.title} - {self.status}"


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
    
    def save(self, *args, **kwargs):
        """Calculate financial metrics on save (Laravel ScheduleService logic)"""
        self.calculate_loan_metrics()
        super().save(*args, **kwargs)
    
    def calculate_loan_metrics(self):
        """Calculate loan metrics using Laravel ScheduleService formulas"""
        # Calculate LTV ratio
        self.ltv_ratio = self.property.calculate_ltv(self.requested_loan_amount)
        
        # Calculate max loan amount (45% LTV)
        self.max_loan_amount = self.property.calculate_max_loan_amount()
        
        # Calculate monthly payment using Laravel formula
        if self.requested_loan_amount > 0 and self.interest_rate > 0:
            monthly_rate = self.interest_rate / 12
            num_payments = self.term_months
            
            # Laravel PMT formula: P * [r(1+r)^n] / [(1+r)^n - 1]
            if monthly_rate > 0:
                factor = (1 + monthly_rate) ** num_payments
                self.monthly_payment = (
                    self.requested_loan_amount * 
                    (monthly_rate * factor) / 
                    (factor - 1)
                ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                
                self.total_payments = (self.monthly_payment * num_payments).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                )
                self.total_interest = (self.total_payments - self.requested_loan_amount).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                )
    
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
    communication = models.ForeignKey(Communication, on_delete=models.SET_NULL, null=True, blank=True)
    
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


class Loan(models.Model):
    """Loan model for TLC integration"""
    LOAN_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('funded', 'Funded'),
        ('current', 'Current'),
        ('late', 'Late'),
        ('default', 'Default'),
        ('paid_off', 'Paid Off'),
        ('foreclosure', 'In Foreclosure'),
        ('charged_off', 'Charged Off'),
    ]
    
    LOAN_TYPE_CHOICES = [
        ('tax_lien', 'Tax Lien'),
        ('bridge', 'Bridge Loan'),
        ('rehab', 'Rehab Loan'),
        ('fix_flip', 'Fix and Flip'),
        ('rental', 'Rental Property'),
    ]
    
    # Core relationships
    opportunity = models.OneToOneField(Opportunity, on_delete=models.CASCADE, related_name='loan')
    borrower = models.ForeignKey(User, on_delete=models.CASCADE, related_name='loans')
    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='loans')
    
    # Loan details
    loan_number = models.CharField(max_length=50, unique=True)
    loan_type = models.CharField(max_length=20, choices=LOAN_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=LOAN_STATUS_CHOICES, default='pending')
    
    # Financial terms (Laravel exact values)
    principal_amount = models.DecimalField(max_digits=12, decimal_places=2)
    interest_rate = models.DecimalField(max_digits=5, decimal_places=4)
    term_months = models.IntegerField()
    monthly_payment = models.DecimalField(max_digits=10, decimal_places=2)
    
    # LTV calculation
    property_value = models.DecimalField(max_digits=12, decimal_places=2)
    ltv_ratio = models.DecimalField(max_digits=5, decimal_places=4)
    
    # Payment tracking
    total_payments_made = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    last_payment_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    last_payment_date = models.DateField(null=True, blank=True)
    next_payment_due = models.DateField(null=True, blank=True)
    
    # Balance tracking
    current_balance = models.DecimalField(max_digits=12, decimal_places=2)
    accrued_interest = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    late_fees = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('0.00'))
    
    # Dates
    originated_at = models.DateTimeField(null=True, blank=True)
    first_payment_due = models.DateField(null=True, blank=True)
    maturity_date = models.DateField(null=True, blank=True)
    
    # TLC Integration
    tlc_loan_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    tlc_borrower_id = models.CharField(max_length=100, null=True, blank=True)
    synced_with_tlc = models.BooleanField(default=False)
    last_tlc_sync = models.DateTimeField(null=True, blank=True)
    
    # Documents and notes
    loan_documents = models.JSONField(default=list, blank=True)
    notes = models.TextField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['loan_number']),
            models.Index(fields=['status', 'borrower']),
            models.Index(fields=['next_payment_due']),
            models.Index(fields=['tlc_loan_id']),
        ]
    
    def save(self, *args, **kwargs):
        """Generate loan number and calculate fields on save"""
        if not self.loan_number:
            self.loan_number = self.generate_loan_number()
        
        # Calculate current balance if not set
        if not self.current_balance:
            self.current_balance = self.principal_amount
        
        super().save(*args, **kwargs)
    
    def generate_loan_number(self):
        """Generate unique loan number (DroneStrike format)"""
        import uuid
        timestamp = datetime.now().strftime('%Y%m%d')
        short_uuid = str(uuid.uuid4())[:8].upper()
        return f"DS-{timestamp}-{short_uuid}"
    
    def calculate_payment_schedule(self):
        """Generate payment schedule (Laravel ScheduleService logic)"""
        schedule = []
        balance = self.principal_amount
        monthly_rate = self.interest_rate / 12
        
        for payment_num in range(1, self.term_months + 1):
            interest_payment = (balance * monthly_rate).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            )
            principal_payment = self.monthly_payment - interest_payment
            balance -= principal_payment
            
            payment_date = self.first_payment_due
            if payment_date:
                payment_date = payment_date.replace(
                    month=payment_date.month + payment_num - 1
                )
            
            schedule.append({
                'payment_number': payment_num,
                'payment_date': payment_date.isoformat() if payment_date else None,
                'payment_amount': float(self.monthly_payment),
                'principal': float(principal_payment),
                'interest': float(interest_payment),
                'balance': float(max(Decimal('0.00'), balance)),
            })
        
        return schedule
    
    @property
    def get_days_late(self):
        """Calculate days late for payment"""
        if not self.next_payment_due or self.status in ['paid_off', 'charged_off']:
            return 0
        
        from django.utils import timezone
        today = timezone.now().date()
        if today > self.next_payment_due:
            return (today - self.next_payment_due).days
        return 0
    
    def __str__(self):
        return f"Loan {self.loan_number} - ${self.principal_amount}"