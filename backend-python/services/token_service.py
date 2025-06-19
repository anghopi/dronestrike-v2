"""
Token management service
Handles token transactions, purchases, and consumption tracking
"""

from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from decimal import Decimal
from datetime import datetime

from models.user import User
from models.token import (
    TokenTransaction, TokenType, TransactionType, ActionType,
    TokenPackage, TokenPrice
)
from models.lead import Lead
from core.config import settings
from .base import BaseService


class TokenService:
    """Token management service"""
    
    def __init__(self, db: Session):
        self.db = db
        self.transaction_service = BaseService(TokenTransaction, db)
        self.package_service = BaseService(TokenPackage, db)
        self.price_service = BaseService(TokenPrice, db)
    
    def get_user_token_balance(self, user: User) -> Dict[str, int]:
        """Get user's current token balance"""
        return {
            "regular_tokens": user.tokens,
            "mail_tokens": user.mail_tokens,
            "total_tokens": user.tokens + user.mail_tokens
        }
    
    def get_token_cost(self, action_type: ActionType, token_type: TokenType = TokenType.REGULAR) -> Optional[int]:
        """Get token cost for a specific action"""
        price = self.db.query(TokenPrice).filter(
            TokenPrice.action_type == action_type.value,
            TokenPrice.token_type == token_type.value,
            TokenPrice.is_active == True
        ).first()
        
        return price.tokens_required if price else None
    
    def consume_tokens(
        self,
        user: User,
        action_type: ActionType,
        description: str,
        token_type: TokenType = TokenType.REGULAR,
        lead: Optional[Lead] = None,
        reference_id: Optional[str] = None
    ) -> TokenTransaction:
        """Consume tokens for an action"""
        
        # Get token cost
        tokens_required = self.get_token_cost(action_type, token_type)
        if tokens_required is None:
            raise ValueError(f"No pricing configured for {action_type.value}")
        
        # Check if user has enough tokens
        current_balance = user.tokens if token_type == TokenType.REGULAR else user.mail_tokens
        if current_balance < tokens_required:
            raise ValueError(f"Insufficient {token_type.value} tokens. Required: {tokens_required}, Available: {current_balance}")
        
        # Calculate cost
        cost_per_token = Decimal(str(settings.MAIL_TOKEN_COST)) if token_type == TokenType.MAIL else None
        total_cost = cost_per_token * tokens_required if cost_per_token else None
        
        # Update user balance
        tokens_before = current_balance
        tokens_after = current_balance - tokens_required
        
        if token_type == TokenType.REGULAR:
            user.tokens = tokens_after
        else:
            user.mail_tokens = tokens_after
        
        # Create transaction record
        transaction_data = {
            "user_id": user.id,
            "token_type": token_type.value,
            "transaction_type": TransactionType.CONSUMPTION.value,
            "action_type": action_type.value,
            "tokens_before": tokens_before,
            "tokens_changed": -tokens_required,
            "tokens_after": tokens_after,
            "cost_per_token": cost_per_token,
            "total_cost": total_cost,
            "description": description,
            "reference_id": reference_id,
            "lead_id": lead.id if lead else None
        }
        
        transaction = self.transaction_service.create(transaction_data)
        
        # Update user in database
        self.db.add(user)
        self.db.commit()
        
        return transaction
    
    def add_tokens(
        self,
        user: User,
        token_amount: int,
        transaction_type: TransactionType,
        description: str,
        token_type: TokenType = TokenType.REGULAR,
        cost_per_token: Optional[Decimal] = None,
        total_cost: Optional[Decimal] = None,
        reference_id: Optional[str] = None
    ) -> TokenTransaction:
        """Add tokens to user account"""
        
        # Get current balance
        current_balance = user.tokens if token_type == TokenType.REGULAR else user.mail_tokens
        tokens_before = current_balance
        tokens_after = current_balance + token_amount
        
        # Update user balance
        if token_type == TokenType.REGULAR:
            user.tokens = tokens_after
        else:
            user.mail_tokens = tokens_after
        
        # Create transaction record
        transaction_data = {
            "user_id": user.id,
            "token_type": token_type.value,
            "transaction_type": transaction_type.value,
            "tokens_before": tokens_before,
            "tokens_changed": token_amount,
            "tokens_after": tokens_after,
            "cost_per_token": cost_per_token,
            "total_cost": total_cost,
            "description": description,
            "reference_id": reference_id
        }
        
        transaction = self.transaction_service.create(transaction_data)
        
        # Update user in database
        self.db.add(user)
        self.db.commit()
        
        return transaction
    
    def get_user_transactions(
        self,
        user: User,
        token_type: Optional[TokenType] = None,
        transaction_type: Optional[TransactionType] = None,
        limit: int = 50
    ) -> List[TokenTransaction]:
        """Get user's token transactions"""
        query = self.db.query(TokenTransaction).filter(TokenTransaction.user_id == user.id)
        
        if token_type:
            query = query.filter(TokenTransaction.token_type == token_type.value)
        
        if transaction_type:
            query = query.filter(TokenTransaction.transaction_type == transaction_type.value)
        
        return query.order_by(TokenTransaction.created_at.desc()).limit(limit).all()
    
    def get_available_packages(self) -> List[TokenPackage]:
        """Get available token packages for purchase"""
        return self.db.query(TokenPackage).filter(
            TokenPackage.is_active == True
        ).order_by(TokenPackage.display_order).all()
    
    def purchase_token_package(
        self,
        user: User,
        package_id: int,
        stripe_payment_intent_id: str
    ) -> TokenTransaction:
        """Process token package purchase"""
        
        package = self.package_service.get_or_404(package_id)
        
        # Add tokens to user account
        total_tokens = package.token_amount + package.bonus_tokens
        
        transaction = self.add_tokens(
            user=user,
            token_amount=total_tokens,
            transaction_type=TransactionType.PURCHASE,
            description=f"Purchased {package.name}",
            token_type=TokenType(package.token_type),
            cost_per_token=package.cost_per_token,
            total_cost=package.price,
            reference_id=stripe_payment_intent_id
        )
        
        # Update transaction with Stripe payment intent
        self.transaction_service.update(transaction, {
            "stripe_payment_intent_id": stripe_payment_intent_id
        })
        
        return transaction
    
    def grant_subscription_tokens(
        self,
        user: User,
        token_amount: int,
        description: str = "Monthly subscription tokens"
    ) -> TokenTransaction:
        """Grant tokens from subscription"""
        
        return self.add_tokens(
            user=user,
            token_amount=token_amount,
            transaction_type=TransactionType.SUBSCRIPTION,
            description=description,
            token_type=TokenType.REGULAR
        )
    
    def can_afford_action(
        self,
        user: User,
        action_type: ActionType,
        token_type: TokenType = TokenType.REGULAR
    ) -> bool:
        """Check if user can afford a specific action"""
        
        tokens_required = self.get_token_cost(action_type, token_type)
        if tokens_required is None:
            return False
        
        current_balance = user.tokens if token_type == TokenType.REGULAR else user.mail_tokens
        return current_balance >= tokens_required