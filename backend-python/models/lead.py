# Lead model that feeds to BOTG and creates TLC opportunities

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Enum, 
    ForeignKey, Text, Date, Numeric, JSON, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ARRAY
from decimal import Decimal
import enum

from .base import BaseModel


class LeadStatus(str, enum.Enum):
    """Lead status progression in DroneStrike workflow"""
    TARGET_ACQUIRED = "target_acquired"
    INITIAL_CONTACT = "initial_contact"
    INTERESTED = "interested"
    NOT_INTERESTED = "not_interested"
    DO_NOT_CONTACT = "do_not_contact"
    QUALIFIED = "qualified"
    NEGOTIATION = "negotiation"
    CLOSED_WON = "closed_won"
    CLOSED_LOST = "closed_lost"


class OwnerType(str, enum.Enum):
    """Property owner classification"""
    ABSENTEE = "absentee"
    OUT_OF_STATE = "out_of_state"
    LOCAL = "local"
    INVESTOR = "investor"
    ESTATE = "estate"
    ENTITY = "entity"
    INDIVIDUAL = "individual"


class WorkflowStage(str, enum.Enum):
    """DroneStrike workflow integration stages"""
    LEAD_IDENTIFIED = "lead_identified"
    BOTG_ASSIGNED = "botg_assigned"
    BOTG_IN_PROGRESS = "botg_in_progress"
    BOTG_COMPLETED = "botg_completed"
    OPPORTUNITY_CREATED = "opportunity_created"
    TLC_LOAN_ORIGINATED = "tlc_loan_originated"
    TLC_CLIENT_ONBOARDED = "tlc_client_onboarded"
    LOAN_SERVICING = "loan_servicing"


class Lead(BaseModel):
    __tablename__ = "leads"
    
    # Relationships
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=True)
    
    # Property Owner Information
    first_name = Column(String(255), nullable=False)
    last_name = Column(String(255), nullable=False)
    owner_type = Column(String(20), nullable=True)  # Store enum as string
    
    # Contact Information
    email = Column(String(255), nullable=True)
    phone_cell = Column(String(20), nullable=True)
    phone_other = Column(String(20), nullable=True)
    birth_date = Column(Date, nullable=True)
    
    # Mailing Address (from Laravel Lead model)
    mailing_address_1 = Column(String(255), nullable=False)
    mailing_address_2 = Column(String(255), nullable=True)
    mailing_street = Column(String(255), nullable=True)
    mailing_city = Column(String(100), nullable=False)
    mailing_state = Column(String(2), nullable=False)
    mailing_zip5 = Column(String(5), nullable=False)
    mailing_zip4 = Column(String(4), nullable=True)
    mailing_place_id = Column(String(255), nullable=True)
    
    # Address correction tracking (from Laravel)
    mailing_address_1_corrected = Column(Boolean, default=False)
    is_bad_address = Column(Boolean, default=False)
    geocoding = Column(JSON, nullable=True)
    
    # Communication preferences and flags (from Laravel)
    do_not_email = Column(Boolean, default=False)
    do_not_email_added = Column(Boolean, default=False)
    do_not_mail = Column(Boolean, default=False)
    email_added = Column(String(255), nullable=True)
    email_added_date = Column(DateTime, nullable=True)
    
    # Postcard tracking (Laravel)
    returned_postcard = Column(Boolean, default=False)
    returned_postcard_date = Column(DateTime, nullable=True)
    returned_postcard_reason = Column(String(255), nullable=True)
    
    # Safety and business flags (Laravel)
    is_business = Column(Boolean, default=False)
    is_dangerous = Column(Boolean, default=False)
    safety_concerns_notes = Column(Text, nullable=True)
    safety_concern_types = Column(JSON, default=list)  # Array of safety concern types
    
    # Language preferences (from Laravel)
    en = Column(Boolean, default=True)   # English
    es = Column(Boolean, default=False)  # Spanish
    
    # Financial Information
    has_mortgage = Column(Boolean, default=False)
    monthly_income = Column(Numeric(10, 2), nullable=True)
    
    # Lead Management
    lead_status = Column(String(20), default='target_acquired')
    last_contact = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    
    # Geographic Data
    latitude = Column(Numeric(9, 6), nullable=True)
    longitude = Column(Numeric(9, 6), nullable=True)
    
    # Analytics
    score_value = Column(Integer, default=0) 
    scored_at = Column(DateTime, nullable=True)
    
    # DroneStrike Workflow Integration
    workflow_stage = Column(String(30), default='lead_identified')
    
    # External System References
    botg_mission_id = Column(String(100), nullable=True)
    tlc_loan_id = Column(String(100), nullable=True)
    tlc_borrower_id = Column(String(100), nullable=True)
    
    # Integration Status
    sent_to_botg = Column(Boolean, default=False)
    botg_response_received = Column(Boolean, default=False)
    sent_to_tlc = Column(Boolean, default=False)
    tlc_loan_created = Column(Boolean, default=False)
    
    # Data Tracking
    source_batch = Column(String(100), nullable=True)
    imported_from = Column(String(100), nullable=True)
    
    # Workflow Timestamps
    botg_assigned_at = Column(DateTime, nullable=True)
    botg_completed_at = Column(DateTime, nullable=True)
    tlc_sent_at = Column(DateTime, nullable=True)
    
    # Relationships
    owner = relationship("User", back_populates="owned_leads")
    property_record = relationship("Property", back_populates="leads")
    opportunities = relationship("Opportunity", back_populates="lead")
    token_transactions = relationship("TokenTransaction", back_populates="lead")
    
    # Database Indexes
    __table_args__ = (
        Index('ix_lead_status_owner', 'lead_status', 'owner_id'),
        Index('ix_lead_score_value', 'score_value'),
        Index('ix_lead_mailing_city_state', 'mailing_city', 'mailing_state'),
        Index('ix_lead_source_batch', 'source_batch'),
        Index('ix_lead_workflow_stage', 'workflow_stage'),
        Index('ix_lead_created_at', 'created_at'),
    )
    
    def __repr__(self):
        return f"<Lead(name='{self.first_name} {self.last_name}', city='{self.mailing_city}')>"
    
    def full_name(self) -> str:
        """Full name of lead"""
        return f"{self.first_name} {self.last_name}"
    
    @property
    def full_mailing_address(self) -> str:
        """Full formatted mailing address"""
        parts = [self.mailing_address_1]
        if self.mailing_address_2:
            parts.append(self.mailing_address_2)
        
        zip_code = self.mailing_zip5
        if self.mailing_zip4:
            zip_code += f"-{self.mailing_zip4}"
        
        parts.append(f"{self.mailing_city}, {self.mailing_state} {zip_code}")
        return ", ".join(parts)
    
    @property
    def primary_phone(self) -> str:
        """Primary phone number (cell preferred)"""
        return self.phone_cell or self.phone_other
    
    @property
    def is_qualified(self) -> bool:
        """Check if lead is qualified (score >= 70 and qualified status)"""
        return self.score_value >= 70 and self.lead_status == 'qualified'
    
    @property
    def can_contact(self) -> bool:
        """Check if lead can be contacted"""
        return not self.do_not_email and not self.do_not_mail and self.lead_status != 'do_not_contact'
    
    def update_score(self, new_score: int):
        """Update the score with validation"""
        from datetime import datetime
        self.score_value = max(0, min(100, new_score))
        self.scored_at = datetime.utcnow()
    
    def advance_workflow_stage(self, stage: WorkflowStage):
        """Advance to next workflow stage with timestamp tracking"""
        from datetime import datetime
        self.workflow_stage = stage.value
        
        # Set appropriate timestamps
        if stage == WorkflowStage.BOTG_ASSIGNED:
            self.botg_assigned_at = datetime.utcnow()
            self.sent_to_botg = True
        elif stage == WorkflowStage.BOTG_COMPLETED:
            self.botg_completed_at = datetime.utcnow()
            self.botg_response_received = True
        elif stage == WorkflowStage.TLC_LOAN_ORIGINATED:
            self.tlc_sent_at = datetime.utcnow()
            self.sent_to_tlc = True