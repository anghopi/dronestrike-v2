"""
Payment Service - Business Logic for Payment Processing
Handles token crediting, subscription management, payment schedules, and analytics
"""

from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
import stripe
import logging
from enum import Enum

from models.user import User
from models.token import TokenTransaction
from core.config import settings

logger = logging.getLogger(__name__)

class PaymentType(str, Enum):
    """Payment types"""
    TOKEN_PURCHASE = "token_purchase"
    SUBSCRIPTION = "subscription"
    LEAD_PACKAGE = "lead_package"
    ACH_PAYMENT = "ach_payment"
    REFUND = "refund"

class SubscriptionTier(str, Enum):
    """Subscription tiers"""
    BASIC = "basic"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"

class PaymentService:
    """Enhanced payment service with comprehensive business logic"""
    
    def __init__(self, db: Session):
        self.db = db
        
    # Token Management
    
    def credit_tokens(
        self,
        user: User,
        regular_tokens: int = 0,
        mail_tokens: int = 0,
        transaction_type: str = "purchase",
        description: str = None,
        payment_intent_id: str = None,
        cost: Decimal = None
    ) -> Tuple[TokenTransaction, TokenTransaction]:
        """Credit tokens to user and create transaction records"""
        
        transactions = []
        
        if regular_tokens > 0:
            # Get current balance
            current_balance = self.get_user_token_balance(user.id, "regular")
            
            # Create transaction record
            transaction = TokenTransaction(
                user_id=user.id,
                token_type="regular",
                transaction_type=transaction_type,
                tokens_before=current_balance,
                tokens_changed=regular_tokens,
                tokens_after=current_balance + regular_tokens,
                description=description or f"Token credit: {regular_tokens} regular tokens",
                cost_per_token=Decimal("0.05") if cost else None,
                total_cost=cost,
                stripe_payment_intent_id=payment_intent_id
            )
            
            self.db.add(transaction)
            transactions.append(transaction)
            
            logger.info(f"Credited {regular_tokens} regular tokens to user {user.id}")
        
        if mail_tokens > 0:
            # Get current balance
            current_balance = self.get_user_token_balance(user.id, "mail")
            
            # Create transaction record
            transaction = TokenTransaction(
                user_id=user.id,
                token_type="mail",
                transaction_type=transaction_type,
                tokens_before=current_balance,
                tokens_changed=mail_tokens,
                tokens_after=current_balance + mail_tokens,
                description=description or f"Token credit: {mail_tokens} mail tokens",
                cost_per_token=Decimal("0.80") if cost else None,
                total_cost=cost,
                stripe_payment_intent_id=payment_intent_id
            )
            
            self.db.add(transaction)
            transactions.append(transaction)
            
            logger.info(f"Credited {mail_tokens} mail tokens to user {user.id}")
        
        self.db.commit()
        return transactions
    
    def debit_tokens(
        self,
        user: User,
        regular_tokens: int = 0,
        mail_tokens: int = 0,
        action_type: str = "api_call",
        description: str = None,
        reference_id: str = None
    ) -> Tuple[bool, List[TokenTransaction]]:
        """Debit tokens from user and create transaction records"""
        
        transactions = []
        
        # Check if user has sufficient tokens
        regular_balance = self.get_user_token_balance(user.id, "regular")
        mail_balance = self.get_user_token_balance(user.id, "mail")
        
        if regular_tokens > regular_balance or mail_tokens > mail_balance:
            logger.warning(f"Insufficient tokens for user {user.id}")
            return False, []
        
        if regular_tokens > 0:
            transaction = TokenTransaction(
                user_id=user.id,
                token_type="regular",
                transaction_type="consumption",
                action_type=action_type,
                tokens_before=regular_balance,
                tokens_changed=-regular_tokens,
                tokens_after=regular_balance - regular_tokens,
                description=description or f"Token usage: {action_type}",
                reference_id=reference_id
            )
            
            self.db.add(transaction)
            transactions.append(transaction)
        
        if mail_tokens > 0:
            transaction = TokenTransaction(
                user_id=user.id,
                token_type="mail",
                transaction_type="consumption",
                action_type=action_type,
                tokens_before=mail_balance,
                tokens_changed=-mail_tokens,
                tokens_after=mail_balance - mail_tokens,
                description=description or f"Mail token usage: {action_type}",
                reference_id=reference_id
            )
            
            self.db.add(transaction)
            transactions.append(transaction)
        
        self.db.commit()
        logger.info(f"Debited {regular_tokens} regular + {mail_tokens} mail tokens from user {user.id}")
        return True, transactions
    
    def get_user_token_balance(self, user_id: int, token_type: str = None) -> int:
        """Get user's current token balance"""
        
        query = self.db.query(func.sum(TokenTransaction.tokens_changed)).filter(
            TokenTransaction.user_id == user_id
        )
        
        if token_type:
            query = query.filter(TokenTransaction.token_type == token_type)
        
        result = query.scalar()
        return result or 0
    
    def get_token_usage_analytics(
        self,
        user_id: int,
        start_date: datetime = None,
        end_date: datetime = None
    ) -> Dict[str, Any]:
        """Get token usage analytics for user"""
        
        if not start_date:
            start_date = datetime.now() - timedelta(days=30)
        if not end_date:
            end_date = datetime.now()
        
        # Base query
        query = self.db.query(TokenTransaction).filter(
            and_(
                TokenTransaction.user_id == user_id,
                TokenTransaction.created_at >= start_date,
                TokenTransaction.created_at <= end_date
            )
        )
        
        transactions = query.all()
        
        # Calculate analytics
        regular_consumed = sum(
            abs(t.tokens_changed) for t in transactions 
            if t.token_type == "regular" and t.transaction_type == "consumption"
        )
        
        mail_consumed = sum(
            abs(t.tokens_changed) for t in transactions 
            if t.token_type == "mail" and t.transaction_type == "consumption"
        )
        
        regular_purchased = sum(
            t.tokens_changed for t in transactions 
            if t.token_type == "regular" and t.transaction_type == "purchase"
        )
        
        mail_purchased = sum(
            t.tokens_changed for t in transactions 
            if t.token_type == "mail" and t.transaction_type == "purchase"
        )
        
        # Usage by action type
        usage_by_action = {}
        for transaction in transactions:
            if transaction.transaction_type == "consumption" and transaction.action_type:
                if transaction.action_type not in usage_by_action:
                    usage_by_action[transaction.action_type] = {"regular": 0, "mail": 0}
                usage_by_action[transaction.action_type][transaction.token_type] += abs(transaction.tokens_changed)
        
        return {
            "period": {
                "start_date": start_date,
                "end_date": end_date
            },
            "current_balance": {
                "regular_tokens": self.get_user_token_balance(user_id, "regular"),
                "mail_tokens": self.get_user_token_balance(user_id, "mail")
            },
            "period_activity": {
                "regular_consumed": regular_consumed,
                "mail_consumed": mail_consumed,
                "regular_purchased": regular_purchased,
                "mail_purchased": mail_purchased,
                "total_cost": sum(t.total_cost or Decimal("0") for t in transactions if t.transaction_type == "purchase")
            },
            "usage_by_action": usage_by_action,
            "transaction_count": len(transactions)
        }
    
    # Subscription Management
    
    def handle_subscription_payment_success(
        self,
        subscription_id: str,
        invoice_id: str,
        customer_id: str,
        amount: Decimal
    ) -> bool:
        """Handle successful subscription payment"""
        
        try:
            # Get subscription details from Stripe
            subscription = stripe.Subscription.retrieve(subscription_id)
            customer = stripe.Customer.retrieve(customer_id)
            
            user_id = int(customer.metadata.get("user_id"))
            user = self.db.query(User).filter(User.id == user_id).first()
            
            if not user:
                logger.error(f"User not found for subscription payment: {user_id}")
                return False
            
            # Determine subscription tier and credit tokens
            tier = self._determine_subscription_tier(subscription)
            monthly_tokens = self._get_monthly_token_allocation(tier)
            
            # Credit monthly tokens
            self.credit_tokens(
                user=user,
                regular_tokens=monthly_tokens["regular"],
                mail_tokens=monthly_tokens["mail"],
                transaction_type="subscription",
                description=f"Monthly subscription tokens - {tier.title()} Plan",
                payment_intent_id=invoice_id
            )
            
            # Update user subscription status
            # This would update your user model with subscription info
            
            logger.info(f"Subscription payment processed for user {user_id}: {tier} plan")
            return True
            
        except Exception as e:
            logger.error(f"Error handling subscription payment: {e}")
            return False
    
    def handle_subscription_cancellation(self, subscription_id: str) -> bool:
        """Handle subscription cancellation"""
        
        try:
            subscription = stripe.Subscription.retrieve(subscription_id)
            customer = stripe.Customer.retrieve(subscription.customer)
            
            user_id = int(customer.metadata.get("user_id"))
            
            # Update user subscription status
            # Mark subscription as cancelled in your database
            
            logger.info(f"Subscription cancelled for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error handling subscription cancellation: {e}")
            return False
    
    def _determine_subscription_tier(self, subscription) -> SubscriptionTier:
        """Determine subscription tier from Stripe subscription"""
        
        # Get price information
        price = subscription.items.data[0].price
        amount = price.unit_amount / 100  # Convert from cents
        
        if amount <= 50:
            return SubscriptionTier.BASIC
        elif amount <= 150:
            return SubscriptionTier.PROFESSIONAL
        else:
            return SubscriptionTier.ENTERPRISE
    
    def _get_monthly_token_allocation(self, tier: SubscriptionTier) -> Dict[str, int]:
        """Get monthly token allocation for subscription tier"""
        
        allocations = {
            SubscriptionTier.BASIC: {"regular": 2000, "mail": 25},
            SubscriptionTier.PROFESSIONAL: {"regular": 10000, "mail": 125},
            SubscriptionTier.ENTERPRISE: {"regular": 50000, "mail": 625}
        }
        
        return allocations.get(tier, {"regular": 0, "mail": 0})
    
    # Payment Analytics
    
    def get_payment_analytics(
        self,
        user_id: int = None,
        start_date: datetime = None,
        end_date: datetime = None
    ) -> Dict[str, Any]:
        """Get comprehensive payment analytics"""
        
        if not start_date:
            start_date = datetime.now() - timedelta(days=30)
        if not end_date:
            end_date = datetime.now()
        
        # Base query for transactions
        query = self.db.query(TokenTransaction).filter(
            and_(
                TokenTransaction.created_at >= start_date,
                TokenTransaction.created_at <= end_date
            )
        )
        
        if user_id:
            query = query.filter(TokenTransaction.user_id == user_id)
        
        transactions = query.all()
        
        # Calculate metrics
        total_revenue = sum(
            t.total_cost or Decimal("0") for t in transactions 
            if t.transaction_type == "purchase"
        )
        
        total_transactions = len([t for t in transactions if t.transaction_type == "purchase"])
        
        # Revenue by payment type
        revenue_by_type = {}
        for transaction in transactions:
            if transaction.transaction_type == "purchase" and transaction.total_cost:
                payment_type = self._classify_payment_type(transaction)
                if payment_type not in revenue_by_type:
                    revenue_by_type[payment_type] = Decimal("0")
                revenue_by_type[payment_type] += transaction.total_cost
        
        # Monthly trends
        monthly_revenue = {}
        for transaction in transactions:
            if transaction.transaction_type == "purchase" and transaction.total_cost:
                month_key = transaction.created_at.strftime("%Y-%m")
                if month_key not in monthly_revenue:
                    monthly_revenue[month_key] = Decimal("0")
                monthly_revenue[month_key] += transaction.total_cost
        
        return {
            "period": {
                "start_date": start_date,
                "end_date": end_date
            },
            "summary": {
                "total_revenue": float(total_revenue),
                "total_transactions": total_transactions,
                "average_transaction": float(total_revenue / total_transactions) if total_transactions > 0 else 0,
                "tokens_sold": {
                    "regular": sum(t.tokens_changed for t in transactions if t.token_type == "regular" and t.transaction_type == "purchase"),
                    "mail": sum(t.tokens_changed for t in transactions if t.token_type == "mail" and t.transaction_type == "purchase")
                }
            },
            "revenue_by_type": {k: float(v) for k, v in revenue_by_type.items()},
            "monthly_trends": {k: float(v) for k, v in monthly_revenue.items()},
            "user_specific": user_id is not None
        }
    
    def _classify_payment_type(self, transaction: TokenTransaction) -> str:
        """Classify payment type based on transaction"""
        
        if transaction.stripe_payment_intent_id:
            return "stripe_payment"
        elif transaction.transaction_type == "subscription":
            return "subscription"
        else:
            return "manual_credit"
    
    # ACH Payment Processing
    
    def setup_ach_payment(
        self,
        user: User,
        bank_account_token: str,
        amount: Decimal,
        description: str = None
    ) -> Dict[str, Any]:
        """Setup ACH payment processing"""
        
        try:
            # Get or create customer
            customer_id = self._get_or_create_stripe_customer(user)
            
            # Create payment method for bank account
            payment_method = stripe.PaymentMethod.create(
                type="us_bank_account",
                us_bank_account={
                    "account_holder_type": "individual"
                }
            )
            
            # Attach to customer
            stripe.PaymentMethod.attach(payment_method.id, customer=customer_id)
            
            # Create payment intent for ACH
            payment_intent = stripe.PaymentIntent.create(
                amount=int(amount * 100),
                currency="usd",
                customer=customer_id,
                payment_method=payment_method.id,
                payment_method_types=["us_bank_account"],
                confirm=True,
                description=description or "ACH Payment",
                metadata={
                    "user_id": str(user.id),
                    "payment_type": "ach"
                }
            )
            
            return {
                "payment_intent_id": payment_intent.id,
                "status": payment_intent.status,
                "client_secret": payment_intent.client_secret
            }
            
        except stripe.StripeError as e:
            logger.error(f"ACH payment setup failed: {e}")
            raise Exception(f"ACH payment setup failed: {str(e)}")
    
    def _get_or_create_stripe_customer(self, user: User) -> str:
        """Get or create Stripe customer for user"""
        
        # Check if user has existing customer ID (implement based on your user model)
        customer_id = getattr(user, 'stripe_customer_id', None)
        
        if not customer_id:
            customer = stripe.Customer.create(
                email=user.email,
                name=getattr(user, 'full_name', user.username),
                metadata={
                    "user_id": str(user.id),
                    "username": user.username
                }
            )
            customer_id = customer.id
            
            # Save to user profile (implement based on your user model)
            # user.stripe_customer_id = customer_id
            # self.db.commit()
        
        return customer_id
    
    # Payment Validation
    
    def validate_payment_amount(self, amount: Decimal, payment_type: str) -> Tuple[bool, str]:
        """Validate payment amount based on type"""
        
        if amount <= 0:
            return False, "Amount must be greater than 0"
        
        # Set limits based on payment type
        limits = {
            "token_purchase": {"min": Decimal("1.00"), "max": Decimal("10000.00")},
            "subscription": {"min": Decimal("10.00"), "max": Decimal("1000.00")},
            "ach_payment": {"min": Decimal("10.00"), "max": Decimal("25000.00")}
        }
        
        limit = limits.get(payment_type, {"min": Decimal("1.00"), "max": Decimal("50000.00")})
        
        if amount < limit["min"]:
            return False, f"Minimum amount for {payment_type} is ${limit['min']}"
        
        if amount > limit["max"]:
            return False, f"Maximum amount for {payment_type} is ${limit['max']}"
        
        return True, "Amount is valid"
    
    # Discount and Coupon Management
    
    def apply_discount(
        self,
        user: User,
        discount_code: str,
        amount: Decimal
    ) -> Tuple[bool, Decimal, str]:
        """Apply discount code to payment amount"""
        
        discount_code = discount_code.upper()
        
        # Five Star General - 50% off for life
        if discount_code == "5STARGENERAL":
            # Check if user has already used this discount
            if self._has_used_discount(user.id, "five_star_general"):
                return False, amount, "Discount code already used"
            
            discounted_amount = amount * Decimal("0.5")
            return True, discounted_amount, "50% Five Star General discount applied"
        
        # Beta Infantry - 50% off first 3 months
        elif discount_code == "INFANTRY":
            if self._has_used_discount(user.id, "infantry"):
                return False, amount, "Discount code already used"
            
            discounted_amount = amount * Decimal("0.5")
            return True, discounted_amount, "50% Infantry discount applied (3 months)"
        
        # New user discount
        elif discount_code == "NEWUSER":
            if self._is_existing_customer(user.id):
                return False, amount, "Discount only available for new users"
            
            discounted_amount = amount * Decimal("0.8")  # 20% off
            return True, discounted_amount, "20% new user discount applied"
        
        return False, amount, "Invalid discount code"
    
    def _has_used_discount(self, user_id: int, discount_type: str) -> bool:
        """Check if user has already used a specific discount type"""
        
        # Check transaction history for discount usage
        transaction = self.db.query(TokenTransaction).filter(
            and_(
                TokenTransaction.user_id == user_id,
                TokenTransaction.description.contains(discount_type)
            )
        ).first()
        
        return transaction is not None
    
    def _is_existing_customer(self, user_id: int) -> bool:
        """Check if user is an existing customer"""
        
        # Check if user has made any purchases
        transaction = self.db.query(TokenTransaction).filter(
            and_(
                TokenTransaction.user_id == user_id,
                TokenTransaction.transaction_type == "purchase"
            )
        ).first()
        
        return transaction is not None