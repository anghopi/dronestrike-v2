# Token system models for tracking usage and transactions


from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, 
    ForeignKey, Numeric, Index
)
from sqlalchemy.orm import relationship
from decimal import Decimal
import enum

from .base import BaseModel


class TokenType(str, enum.Enum):
    """Types of tokens in the system"""
    REGULAR = "regular"
    MAIL = "mail"  # Special mail tokens ($0.80 each)


class TransactionType(str, enum.Enum):
    """Types of token transactions"""
    PURCHASE = "purchase"
    CONSUMPTION = "consumption"
    REFUND = "refund"
    BONUS = "bonus"
    SUBSCRIPTION = "subscription"  # Subscription credit


class ActionType(str, enum.Enum):
    """Types of actions that consume tokens"""
    POSTCARD_SEND = "postcard_send"
    EMAIL_SEND = "email_send"
    SMS_SEND = "sms_send"
    PHONE_VERIFICATION = "phone_verification"
    ADDRESS_VERIFICATION = "address_verification"
    PROPERTY_LOOKUP = "property_lookup"
    LEAD_EXPORT = "lead_export"
    API_CALL = "api_call"
    OTHER = "other"


class TokenTransaction(BaseModel):
    """Token usage tracking (from Token Values.xlsx)"""
    __tablename__ = "token_transactions"
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Transaction Details
    token_type = Column(String(10), nullable=False)  # Store enum as string
    transaction_type = Column(String(15), nullable=False)
    action_type = Column(String(25), nullable=True)
    
    # Token Amounts (from Token Values.xlsx)
    tokens_before = Column(Integer, nullable=False)
    tokens_changed = Column(Integer, nullable=False)  # Positive for credit, negative for debit
    tokens_after = Column(Integer, nullable=False)
    
    # Cost Tracking
    cost_per_token = Column(Numeric(6, 4), nullable=True)
    total_cost = Column(Numeric(8, 2), nullable=True)
    
    # Reference Data
    description = Column(String(255), nullable=False)
    reference_id = Column(String(100), nullable=True)  # External transaction ID
    
    # Related Objects
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    
    # Stripe Integration
    stripe_payment_intent_id = Column(String(100), nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="token_transactions")
    lead = relationship("Lead", back_populates="token_transactions")
    
    # Database Indexes
    __table_args__ = (
        Index('ix_token_user_type', 'user_id', 'token_type'),
        Index('ix_token_transaction_type_date', 'transaction_type', 'created_at'),
        Index('ix_token_action_type', 'action_type'),
        Index('ix_token_reference_id', 'reference_id'),
    )
    
    def __repr__(self):
        sign = '+' if self.tokens_changed > 0 else ''
        return f"<TokenTransaction(user_id={self.user_id}, {sign}{self.tokens_changed} {self.token_type})>"


class TokenPrice(BaseModel):
    """Token pricing configuration"""
    __tablename__ = "token_prices"
    
    token_type = Column(String(10), nullable=False)
    action_type = Column(String(25), nullable=False)
    
    # Pricing
    tokens_required = Column(Integer, nullable=False)
    cost_per_token = Column(Numeric(6, 4), nullable=True)
    
    # Configuration
    is_active = Column(Boolean, default=True)
    description = Column(String(255), nullable=True)
    
    # Relationships - none needed for this configuration table
    
    __table_args__ = (
        Index('ix_token_price_type_action', 'token_type', 'action_type'),
    )
    
    def __repr__(self):
        return f"<TokenPrice(type={self.token_type}, action={self.action_type}, tokens={self.tokens_required})>"


class TokenPackage(BaseModel):
    """Token packages for purchase"""
    __tablename__ = "token_packages"
    
    name = Column(String(100), nullable=False)
    token_type = Column(String(10), nullable=False)
    token_amount = Column(Integer, nullable=False)
    price = Column(Numeric(8, 2), nullable=False)
    
    # Bonus tokens (for bulk purchases)
    bonus_tokens = Column(Integer, default=0)
    
    # Display and ordering
    display_order = Column(Integer, default=0)
    is_popular = Column(Boolean, default=False)
    description = Column(String(255), nullable=True)
    
    # Stripe integration
    stripe_price_id = Column(String(100), nullable=True)
    
    def __repr__(self):
        return f"<TokenPackage(name='{self.name}', tokens={self.token_amount}, price={self.price})>"
    
    @property
    def total_tokens(self) -> int:
        """Total tokens including bonus"""
        return self.token_amount + self.bonus_tokens
    
    @property
    def cost_per_token(self) -> Decimal:
        """Cost per token including bonus tokens"""
        if self.total_tokens == 0:
            return Decimal('0.00')
        return self.price / self.total_tokens