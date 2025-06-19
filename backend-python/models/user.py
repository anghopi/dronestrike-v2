"""User and authentication models"""

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Enum, 
    ForeignKey, JSON, Date, Numeric
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import enum
import uuid

from .base import BaseModel


class UserRole(str, enum.Enum):
    """User roles in the DroneStrike system"""
    USER = "user"
    ADMIN = "admin"
    MANAGER = "manager"
    AGENT = "agent"
    SOLDIER = "soldier"  # BOTG Soldier
    OFFICER = "officer"  # Loan Officer
    FIVE_STAR_GENERAL = "five_star_general"  # 50% off for life
    BETA_INFANTRY = "beta_infantry"  # 50% off first 3 months


class Company(BaseModel):
    """Company/Organization model"""
    __tablename__ = "companies"
    
    name = Column(String(255), nullable=False)
    logo_url = Column(String(500), nullable=True)
    primary_color = Column(String(7), default='#1a3d6d')  # DroneStrike theme
    website = Column(String(500), nullable=True)
    
    # Relationships
    employees = relationship("User", back_populates="company")
    
    def __repr__(self):
        return f"<Company(name='{self.name}')>"


class User(BaseModel):
    """Enhanced user model with DroneStrike business logic"""
    __tablename__ = "users"
    
    # Basic Information
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    
    # Personal Information
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    
    # Company Relationship
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    company_name = Column(String(255), nullable=True)  # Legacy field
    
    # Role & Access
    role = Column(Enum(UserRole), default=UserRole.USER, nullable=False)
    
    # UI Customization
    logo_url = Column(String(500), nullable=True)
    color_scheme = Column(String(7), default='#1a3d6d')
    
    # Token System (from Token Values.xlsx)
    tokens = Column(Integer, default=10000, nullable=False)  # Regular tokens
    mail_tokens = Column(Integer, default=0, nullable=False)  # Mail tokens ($0.80 each)
    
    # Stripe Integration
    stripe_customer_id = Column(String(100), nullable=True)
    stripe_subscription_id = Column(String(100), nullable=True)
    subscription_plan = Column(String(50), nullable=True)
    
    # Subscription Management ( this is transalted from Laravel)
    monthly_subscription_active = Column(Boolean, default=False)
    subscription_start_date = Column(Date, nullable=True)
    beta_months_remaining = Column(Integer, default=0)  # For beta infantry discount
    
    # User Experience
    onboarding_completed = Column(Boolean, default=False)
    last_activity = Column(DateTime, nullable=True)
    last_login = Column(DateTime, nullable=True)
    is_email_verified = Column(Boolean, default=False)
    
    # Voice Command Features
    voice_commands_enabled = Column(Boolean, default=True)
    voice_wake_term = Column(String(50), default='drone strike')
    
    # User Preferences (JSON field for flexibility)
    preferences = Column(JSON, default=dict)
    
    # Relationships
    company = relationship("Company", back_populates="employees")
    owned_leads = relationship("Lead", back_populates="owner")
    opportunities = relationship("Opportunity", back_populates="user")
    token_transactions = relationship("TokenTransaction", back_populates="user")
    assigned_missions = relationship(
        "Mission", 
        secondary="mission_soldiers",
        back_populates="soldiers"
    )
    created_missions = relationship(
        "Mission", 
        foreign_keys="Mission.assigned_by",
        back_populates="assigner"
    )
    
    @property
    def full_name(self) -> str:
        """Full name property"""
        return f"{self.first_name} {self.last_name}"
    
    @property
    def has_special_pricing(self) -> bool:
        """Check if user has special pricing (Five Star General or Beta Infantry)"""
        return self.role in [UserRole.FIVE_STAR_GENERAL, UserRole.BETA_INFANTRY]
    
    @property
    def effective_discount(self) -> float:
        """Get effective discount rate for user"""
        if self.role == UserRole.FIVE_STAR_GENERAL:
            return 0.50  # 50% off for life
        elif self.role == UserRole.BETA_INFANTRY and self.beta_months_remaining > 0:
            return 0.50  # 50% off for remaining beta months
        return 0.0
    
    def __repr__(self):
        return f"<User(username='{self.username}', email='{self.email}')>"


class UserSession(BaseModel):
    """User session tracking"""
    __tablename__ = "user_sessions"
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_token = Column(String(255), unique=True, nullable=False)
    refresh_token = Column(String(255), unique=True, nullable=True)
    expires_at = Column(DateTime, nullable=False)
    ip_address = Column(String(45), nullable=True)  # IPv6 compatible
    user_agent = Column(String(500), nullable=True)
    
    # Relationships
    user = relationship("User")
    
    def __repr__(self):
        return f"<UserSession(user_id={self.user_id}, expires_at='{self.expires_at}')>"