# Investment opportunity model

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, 
    ForeignKey, Text, Numeric, Date, JSON, Index
)
from sqlalchemy.orm import relationship
from decimal import Decimal
import enum

from .base import BaseModel


class OpportunityStatus(str, enum.Enum):
    """Investment opportunity status"""
    IDENTIFIED = "identified"
    ANALYZING = "analyzing"
    QUALIFIED = "qualified"
    PROPOSAL_SENT = "proposal_sent"
    NEGOTIATION = "negotiation"
    APPROVED = "approved"
    FUNDED = "funded"
    CLOSED = "closed"
    REJECTED = "rejected"


class Opportunity(BaseModel):
    """Investment opportunity model (from Laravel ScheduleService)"""
    __tablename__ = "opportunities"
    
    # Core Relationships
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Opportunity Details
    status = Column(String(20), default='identified', nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Financial Calculations (from Laravel ScheduleService business logic)
    requested_loan_amount = Column(Numeric(12, 2), nullable=False)
    max_loan_amount = Column(Numeric(12, 2), nullable=False)
    ltv_ratio = Column(Numeric(5, 4), nullable=False)  # Loan-to-Value ratio
    
    # Interest and Term (from Laravel defaults)
    interest_rate = Column(Numeric(5, 4), default=Decimal('0.08'), nullable=False)  # 8%
    term_months = Column(Integer, default=24, nullable=False)
    
    # Payment Calculations (from Laravel ScheduleService)
    monthly_payment = Column(Numeric(10, 2), nullable=True)
    total_interest = Column(Numeric(12, 2), nullable=True)
    total_payments = Column(Numeric(12, 2), nullable=True)
    
    # Risk Assessment
    risk_score = Column(Integer, default=50, nullable=False)  # 0-100
    risk_factors = Column(JSON, default=list)  # Array of risk factors
    
    # Due Diligence
    property_inspection_completed = Column(Boolean, default=False)
    title_search_completed = Column(Boolean, default=False)
    financial_verification_completed = Column(Boolean, default=False)
    
    # Timeline
    projected_funding_date = Column(Date, nullable=True)
    
    # External Integration
    tlc_opportunity_id = Column(String(100), nullable=True)
    sent_to_tlc = Column(Boolean, default=False)
    tlc_approved = Column(Boolean, default=False)
    
    # Relationships
    lead = relationship("Lead", back_populates="opportunities")
    property_record = relationship("Property", back_populates="opportunities")
    user = relationship("User", back_populates="opportunities")
    payment_schedule = relationship("PaymentSchedule", back_populates="opportunity")
    
    # Database Indexes
    __table_args__ = (
        Index('ix_opportunity_status_user', 'status', 'user_id'),
        Index('ix_opportunity_ltv_ratio', 'ltv_ratio'),
        Index('ix_opportunity_requested_amount', 'requested_loan_amount'),
        Index('ix_opportunity_funding_date', 'projected_funding_date'),
    )
    
    def __repr__(self):
        return f"<Opportunity(title='{self.title}', amount=${self.requested_loan_amount})>"
    
    @property
    def is_qualified(self) -> bool:
        """Check if opportunity meets qualification criteria"""
        return (
            self.status in ['qualified', 'proposal_sent', 'negotiation', 'approved', 'funded'] and
            self.ltv_ratio <= Decimal('0.75') and  # Max 75% LTV
            self.risk_score <= 70  # Acceptable risk level
        )
    
    @property
    def due_diligence_complete(self) -> bool:
        """Check if all due diligence items are completed"""
        return (
            self.property_inspection_completed and
            self.title_search_completed and
            self.financial_verification_completed
        )
    
    def calculate_monthly_payment(self) -> Decimal:
        """Calculate monthly payment using Laravel ScheduleService logic"""
        if self.requested_loan_amount <= 0 or self.term_months <= 0:
            return Decimal('0.00')
        
        # Monthly interest rate
        monthly_rate = self.interest_rate / 12
        
        if monthly_rate == 0:
            # No interest loan
            return self.requested_loan_amount / self.term_months
        
        # Standard loan payment formula: P * [r(1+r)^n] / [(1+r)^n - 1]
        power = (1 + monthly_rate) ** self.term_months
        monthly_payment = self.requested_loan_amount * (monthly_rate * power) / (power - 1)
        
        return Decimal(str(round(monthly_payment, 2)))
    
    def calculate_total_payments(self) -> Decimal:
        """Calculate total payments over loan term"""
        if not self.monthly_payment:
            self.monthly_payment = self.calculate_monthly_payment()
        return self.monthly_payment * self.term_months
    
    def calculate_total_interest(self) -> Decimal:
        """Calculate total interest paid over loan term"""
        total_payments = self.calculate_total_payments()
        return total_payments - self.requested_loan_amount
    
    def update_financial_calculations(self):
        """Update all financial calculations based on current values"""
        self.monthly_payment = self.calculate_monthly_payment()
        self.total_payments = self.calculate_total_payments()
        self.total_interest = self.calculate_total_interest()
    
    def calculate_ltv_ratio(self, property_value: Decimal) -> Decimal:
        """Calculate LTV ratio based on property value"""
        if property_value <= 0:
            return Decimal('0.00')
        return self.requested_loan_amount / property_value


class PaymentSchedule(BaseModel):
    """Payment schedule for funded opportunities (Laravel ScheduleService)"""
    __tablename__ = "payment_schedules"
    
    opportunity_id = Column(Integer, ForeignKey("opportunities.id"), nullable=False)
    
    # Payment Details
    payment_number = Column(Integer, nullable=False)  # 1, 2, 3, etc.
    due_date = Column(Date, nullable=False)
    payment_amount = Column(Numeric(10, 2), nullable=False)
    principal_amount = Column(Numeric(10, 2), nullable=False)
    interest_amount = Column(Numeric(10, 2), nullable=False)
    remaining_balance = Column(Numeric(12, 2), nullable=False)
    
    # Payment Status
    paid_date = Column(Date, nullable=True)
    paid_amount = Column(Numeric(10, 2), nullable=True)
    payment_method = Column(String(50), nullable=True)
    
    # Late Payment Tracking
    is_late = Column(Boolean, default=False)
    late_fee = Column(Numeric(8, 2), default=Decimal('0.00'))
    
    # Relationships
    opportunity = relationship("Opportunity", back_populates="payment_schedule")
    
    # Database Indexes
    __table_args__ = (
        Index('ix_payment_opportunity_number', 'opportunity_id', 'payment_number'),
        Index('ix_payment_due_date', 'due_date'),
        Index('ix_payment_status', 'paid_date', 'is_late'),
    )
    
    def __repr__(self):
        return f"<PaymentSchedule(opportunity_id={self.opportunity_id}, payment_number={self.payment_number})>"
    
    @property
    def is_paid(self) -> bool:
        """Check if payment has been made"""
        return self.paid_date is not None and self.paid_amount is not None
    
    @property
    def is_overdue(self) -> bool:
        """Check if payment is overdue"""
        if self.is_paid:
            return False
        from datetime import date
        return date.today() > self.due_date
    
    def mark_as_paid(self, amount: Decimal, payment_method: str = None):
        """Mark payment as paid"""
        from datetime import date
        self.paid_date = date.today()
        self.paid_amount = amount
        self.payment_method = payment_method
        
        # Check if payment is late
        if date.today() > self.due_date:
            self.is_late = True