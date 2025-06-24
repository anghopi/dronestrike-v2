"""
Payment Processing API Router - Enhanced Payment System
Comprehensive payment processing with Stripe integration, ACH payments, 
subscription management, and automated payment schedules
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from decimal import Decimal
from pydantic import BaseModel, Field, validator
import stripe
import logging
from enum import Enum

from core.database import get_db
from models.user import User
from api.dependencies import get_current_user
from integrations.stripe import AdvancedStripe, StripeConfig, PaymentIntentRequest, SubscriptionRequest
from services.payment_service import PaymentService
from core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize Stripe
if hasattr(settings, 'STRIPE_SECRET_KEY'):
    stripe.api_key = settings.STRIPE_SECRET_KEY

class PaymentMethodType(str, Enum):
    """Payment method types"""
    CARD = "card"
    ACH = "us_bank_account"
    BANK_TRANSFER = "bank_transfer"
    APPLE_PAY = "apple_pay"
    GOOGLE_PAY = "google_pay"

class PaymentStatus(str, Enum):
    """Payment status types"""
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELED = "canceled"
    REFUNDED = "refunded"

class SubscriptionStatus(str, Enum):
    """Subscription status types"""
    ACTIVE = "active"
    PAST_DUE = "past_due"
    UNPAID = "unpaid"
    CANCELED = "canceled"
    INCOMPLETE = "incomplete"
    INCOMPLETE_EXPIRED = "incomplete_expired"
    TRIALING = "trialing"
    PAUSED = "paused"

# Pydantic Models
class PaymentIntentCreate(BaseModel):
    """Payment intent creation request"""
    amount: Decimal = Field(..., gt=0, description="Payment amount")
    currency: str = Field("usd", description="Currency code")
    payment_method_types: List[PaymentMethodType] = Field(default=[PaymentMethodType.CARD])
    description: Optional[str] = None
    metadata: Optional[Dict[str, str]] = None
    
    @validator('amount')
    def validate_amount(cls, v):
        if v <= 0:
            raise ValueError('Amount must be greater than 0')
        return v

class TokenPurchaseRequest(BaseModel):
    """Token purchase request"""
    package_type: str = Field(..., description="Token package type")
    quantity: int = Field(1, ge=1, description="Package quantity")
    payment_method_id: Optional[str] = None
    save_payment_method: bool = False

class SubscriptionCreateRequest(BaseModel):
    """Subscription creation request"""
    price_id: str = Field(..., description="Stripe price ID")
    payment_method_id: Optional[str] = None
    trial_days: Optional[int] = None
    coupon_code: Optional[str] = None
    metadata: Optional[Dict[str, str]] = None

class PaymentMethodRequest(BaseModel):
    """Payment method creation request"""
    type: PaymentMethodType
    card_token: Optional[str] = None
    bank_account_token: Optional[str] = None
    billing_details: Optional[Dict[str, Any]] = None

class RefundRequest(BaseModel):
    """Refund creation request"""
    payment_intent_id: str
    amount: Optional[Decimal] = None
    reason: Optional[str] = None

class PaymentScheduleRequest(BaseModel):
    """Payment schedule creation request"""
    total_amount: Decimal
    installments: int = Field(..., ge=1, le=60)
    frequency: str = Field("monthly", description="Payment frequency")
    start_date: datetime
    description: Optional[str] = None

# Token Packages Configuration
TOKEN_PACKAGES = {
    "starter": {
        "name": "Starter Package",
        "regular_tokens": 1000,
        "mail_tokens": 0,
        "price": 50.00,
        "description": "Perfect for getting started"
    },
    "professional": {
        "name": "Professional Package",
        "regular_tokens": 5000,
        "mail_tokens": 100,
        "price": 200.00,
        "description": "Best value for professionals"
    },
    "enterprise": {
        "name": "Enterprise Package",
        "regular_tokens": 15000,
        "mail_tokens": 500,
        "price": 500.00,
        "description": "For high-volume users"
    },
    "mail_special": {
        "name": "Mail Token Special",
        "regular_tokens": 0,
        "mail_tokens": 1000,
        "price": 800.00,
        "description": "Specialized mail tokens ($0.80 each)"
    }
}

# Payment Endpoints

@router.get("/packages")
async def get_token_packages(current_user: User = Depends(get_current_user)):
    """Get available token packages"""
    return {
        "packages": TOKEN_PACKAGES,
        "pricing": {
            "regular_token_price": 0.05,
            "mail_token_price": 0.80
        }
    }

@router.post("/intents")
async def create_payment_intent(
    request: PaymentIntentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a payment intent"""
    try:
        # Get or create Stripe customer
        customer_id = await _get_or_create_stripe_customer(current_user, db)
        
        # Create payment intent
        intent = stripe.PaymentIntent.create(
            amount=int(request.amount * 100),  # Convert to cents
            currency=request.currency,
            customer=customer_id,
            payment_method_types=[pmt.value for pmt in request.payment_method_types],
            description=request.description,
            metadata={
                **(request.metadata or {}),
                "user_id": str(current_user.id),
                "user_email": current_user.email
            }
        )
        
        return {
            "client_secret": intent.client_secret,
            "payment_intent_id": intent.id,
            "amount": request.amount,
            "currency": request.currency,
            "status": intent.status
        }
        
    except stripe.StripeError as e:
        logger.error(f"Stripe payment intent creation failed: {e}")
        raise HTTPException(status_code=400, detail=f"Payment intent creation failed: {str(e)}")
    except Exception as e:
        logger.error(f"Payment intent creation error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/tokens/purchase")
async def purchase_tokens(
    request: TokenPurchaseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Purchase token packages"""
    try:
        # Validate package
        if request.package_type not in TOKEN_PACKAGES:
            raise HTTPException(status_code=400, detail="Invalid package type")
        
        package = TOKEN_PACKAGES[request.package_type]
        total_amount = Decimal(str(package["price"])) * request.quantity
        
        # Get or create customer
        customer_id = await _get_or_create_stripe_customer(current_user, db)
        
        # Create payment intent
        intent = stripe.PaymentIntent.create(
            amount=int(total_amount * 100),
            currency="usd",
            customer=customer_id,
            payment_method=request.payment_method_id,
            confirmation_method="manual",
            confirm=True if request.payment_method_id else False,
            metadata={
                "user_id": str(current_user.id),
                "package_type": request.package_type,
                "quantity": str(request.quantity),
                "regular_tokens": str(package["regular_tokens"] * request.quantity),
                "mail_tokens": str(package["mail_tokens"] * request.quantity),
                "type": "token_purchase"
            },
            description=f"Token Package: {package['name']} x{request.quantity}"
        )
        
        # Save payment method if requested
        if request.save_payment_method and request.payment_method_id:
            stripe.PaymentMethod.attach(
                request.payment_method_id,
                customer=customer_id
            )
        
        return {
            "payment_intent_id": intent.id,
            "client_secret": intent.client_secret,
            "status": intent.status,
            "package": {
                "name": package["name"],
                "quantity": request.quantity,
                "total_amount": total_amount,
                "regular_tokens": package["regular_tokens"] * request.quantity,
                "mail_tokens": package["mail_tokens"] * request.quantity
            }
        }
        
    except stripe.StripeError as e:
        logger.error(f"Token purchase failed: {e}")
        raise HTTPException(status_code=400, detail=f"Token purchase failed: {str(e)}")
    except Exception as e:
        logger.error(f"Token purchase error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/subscriptions")
async def create_subscription(
    request: SubscriptionCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a subscription"""
    try:
        # Get or create customer
        customer_id = await _get_or_create_stripe_customer(current_user, db)
        
        # Prepare subscription data
        subscription_data = {
            "customer": customer_id,
            "items": [{"price": request.price_id}],
            "payment_behavior": "default_incomplete",
            "expand": ["latest_invoice.payment_intent"],
            "metadata": {
                **(request.metadata or {}),
                "user_id": str(current_user.id),
                "type": "subscription"
            }
        }
        
        # Add payment method if provided
        if request.payment_method_id:
            subscription_data["default_payment_method"] = request.payment_method_id
        
        # Add trial period if specified
        if request.trial_days:
            subscription_data["trial_period_days"] = request.trial_days
        
        # Apply coupon if provided
        if request.coupon_code:
            coupon_id = await _handle_coupon_code(request.coupon_code, current_user, db)
            if coupon_id:
                subscription_data["coupon"] = coupon_id
        
        # Create subscription
        subscription = stripe.Subscription.create(**subscription_data)
        
        return {
            "subscription_id": subscription.id,
            "client_secret": subscription.latest_invoice.payment_intent.client_secret,
            "status": subscription.status,
            "current_period_start": subscription.current_period_start,
            "current_period_end": subscription.current_period_end,
            "trial_end": subscription.trial_end
        }
        
    except stripe.StripeError as e:
        logger.error(f"Subscription creation failed: {e}")
        raise HTTPException(status_code=400, detail=f"Subscription creation failed: {str(e)}")
    except Exception as e:
        logger.error(f"Subscription creation error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/subscriptions/{subscription_id}")
async def get_subscription(
    subscription_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get subscription details"""
    try:
        subscription = stripe.Subscription.retrieve(subscription_id)
        
        # Verify ownership
        customer = stripe.Customer.retrieve(subscription.customer)
        if customer.metadata.get("user_id") != str(current_user.id):
            raise HTTPException(status_code=403, detail="Access denied")
        
        return {
            "id": subscription.id,
            "status": subscription.status,
            "current_period_start": subscription.current_period_start,
            "current_period_end": subscription.current_period_end,
            "trial_start": subscription.trial_start,
            "trial_end": subscription.trial_end,
            "cancel_at_period_end": subscription.cancel_at_period_end,
            "canceled_at": subscription.canceled_at,
            "items": [
                {
                    "price_id": item.price.id,
                    "product_name": stripe.Product.retrieve(item.price.product).name,
                    "amount": item.price.unit_amount,
                    "currency": item.price.currency,
                    "interval": item.price.recurring.interval
                }
                for item in subscription.items.data
            ]
        }
        
    except stripe.StripeError as e:
        logger.error(f"Subscription retrieval failed: {e}")
        raise HTTPException(status_code=400, detail=f"Subscription retrieval failed: {str(e)}")

@router.delete("/subscriptions/{subscription_id}")
async def cancel_subscription(
    subscription_id: str,
    at_period_end: bool = Query(True, description="Cancel at period end"),
    current_user: User = Depends(get_current_user)
):
    """Cancel a subscription"""
    try:
        subscription = stripe.Subscription.retrieve(subscription_id)
        
        # Verify ownership
        customer = stripe.Customer.retrieve(subscription.customer)
        if customer.metadata.get("user_id") != str(current_user.id):
            raise HTTPException(status_code=403, detail="Access denied")
        
        if at_period_end:
            subscription = stripe.Subscription.modify(
                subscription_id,
                cancel_at_period_end=True
            )
        else:
            subscription = stripe.Subscription.cancel(subscription_id)
        
        return {
            "subscription_id": subscription.id,
            "status": subscription.status,
            "canceled_at": subscription.canceled_at,
            "cancel_at_period_end": subscription.cancel_at_period_end
        }
        
    except stripe.StripeError as e:
        logger.error(f"Subscription cancellation failed: {e}")
        raise HTTPException(status_code=400, detail=f"Subscription cancellation failed: {str(e)}")

@router.post("/payment-methods")
async def create_payment_method(
    request: PaymentMethodRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create and attach payment method"""
    try:
        # Get or create customer
        customer_id = await _get_or_create_stripe_customer(current_user, db)
        
        # Create payment method data
        pm_data = {"type": request.type.value}
        
        if request.type == PaymentMethodType.CARD and request.card_token:
            pm_data["card"] = {"token": request.card_token}
        elif request.type == PaymentMethodType.ACH and request.bank_account_token:
            pm_data["us_bank_account"] = {"account_holder_type": "individual"}
        
        if request.billing_details:
            pm_data["billing_details"] = request.billing_details
        
        # Create payment method
        payment_method = stripe.PaymentMethod.create(**pm_data)
        
        # Attach to customer
        stripe.PaymentMethod.attach(payment_method.id, customer=customer_id)
        
        return {
            "payment_method_id": payment_method.id,
            "type": payment_method.type,
            "card": payment_method.card if hasattr(payment_method, 'card') else None,
            "us_bank_account": payment_method.us_bank_account if hasattr(payment_method, 'us_bank_account') else None
        }
        
    except stripe.StripeError as e:
        logger.error(f"Payment method creation failed: {e}")
        raise HTTPException(status_code=400, detail=f"Payment method creation failed: {str(e)}")

@router.get("/payment-methods")
async def list_payment_methods(
    type: Optional[PaymentMethodType] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List user's payment methods"""
    try:
        # Get customer
        customer_id = await _get_or_create_stripe_customer(current_user, db)
        
        # List payment methods
        params = {"customer": customer_id, "limit": 100}
        if type:
            params["type"] = type.value
        
        payment_methods = stripe.PaymentMethod.list(**params)
        
        return {
            "payment_methods": [
                {
                    "id": pm.id,
                    "type": pm.type,
                    "card": {
                        "brand": pm.card.brand,
                        "last4": pm.card.last4,
                        "exp_month": pm.card.exp_month,
                        "exp_year": pm.card.exp_year
                    } if pm.type == "card" else None,
                    "us_bank_account": {
                        "bank_name": pm.us_bank_account.bank_name,
                        "last4": pm.us_bank_account.last4,
                        "account_type": pm.us_bank_account.account_type
                    } if pm.type == "us_bank_account" else None,
                    "created": pm.created
                }
                for pm in payment_methods.data
            ]
        }
        
    except stripe.StripeError as e:
        logger.error(f"Payment methods retrieval failed: {e}")
        raise HTTPException(status_code=400, detail=f"Payment methods retrieval failed: {str(e)}")

@router.delete("/payment-methods/{payment_method_id}")
async def delete_payment_method(
    payment_method_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a payment method"""
    try:
        # Verify ownership by checking customer
        payment_method = stripe.PaymentMethod.retrieve(payment_method_id)
        if payment_method.customer:
            customer = stripe.Customer.retrieve(payment_method.customer)
            if customer.metadata.get("user_id") != str(current_user.id):
                raise HTTPException(status_code=403, detail="Access denied")
        
        # Detach payment method
        stripe.PaymentMethod.detach(payment_method_id)
        
        return {"message": "Payment method deleted successfully"}
        
    except stripe.StripeError as e:
        logger.error(f"Payment method deletion failed: {e}")
        raise HTTPException(status_code=400, detail=f"Payment method deletion failed: {str(e)}")

@router.post("/refunds")
async def create_refund(
    request: RefundRequest,
    current_user: User = Depends(get_current_user)
):
    """Create a refund"""
    try:
        # Verify payment intent ownership
        payment_intent = stripe.PaymentIntent.retrieve(request.payment_intent_id)
        customer = stripe.Customer.retrieve(payment_intent.customer)
        if customer.metadata.get("user_id") != str(current_user.id):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Create refund
        refund_data = {"payment_intent": request.payment_intent_id}
        if request.amount:
            refund_data["amount"] = int(request.amount * 100)
        if request.reason:
            refund_data["reason"] = request.reason
        
        refund = stripe.Refund.create(**refund_data)
        
        return {
            "refund_id": refund.id,
            "amount": refund.amount / 100,
            "currency": refund.currency,
            "status": refund.status,
            "reason": refund.reason
        }
        
    except stripe.StripeError as e:
        logger.error(f"Refund creation failed: {e}")
        raise HTTPException(status_code=400, detail=f"Refund creation failed: {str(e)}")

@router.post("/schedules")
async def create_payment_schedule(
    request: PaymentScheduleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create an automated payment schedule"""
    try:
        # Calculate installment amount
        installment_amount = request.total_amount / request.installments
        
        # Get customer
        customer_id = await _get_or_create_stripe_customer(current_user, db)
        
        # Create schedule using Stripe's subscription schedules
        schedule_phases = []
        current_date = request.start_date
        
        for i in range(request.installments):
            schedule_phases.append({
                "start_date": int(current_date.timestamp()),
                "end_date": int((current_date + timedelta(days=30)).timestamp()),
                "items": [
                    {
                        "price_data": {
                            "currency": "usd",
                            "product_data": {
                                "name": f"Payment Schedule - Installment {i+1}"
                            },
                            "unit_amount": int(installment_amount * 100),
                            "recurring": {"interval": "month"}
                        }
                    }
                ]
            })
            current_date += timedelta(days=30)
        
        schedule = stripe.SubscriptionSchedule.create(
            customer=customer_id,
            start_date=int(request.start_date.timestamp()),
            phases=schedule_phases,
            metadata={
                "user_id": str(current_user.id),
                "total_amount": str(request.total_amount),
                "installments": str(request.installments),
                "type": "payment_schedule"
            }
        )
        
        return {
            "schedule_id": schedule.id,
            "status": schedule.status,
            "total_amount": request.total_amount,
            "installment_amount": installment_amount,
            "installments": request.installments,
            "start_date": request.start_date,
            "phases": len(schedule_phases)
        }
        
    except stripe.StripeError as e:
        logger.error(f"Payment schedule creation failed: {e}")
        raise HTTPException(status_code=400, detail=f"Payment schedule creation failed: {str(e)}")

@router.get("/analytics")
async def get_payment_analytics(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get payment analytics for user"""
    try:
        # Get customer
        customer_id = await _get_or_create_stripe_customer(current_user, db)
        
        # Set default date range (last 30 days)
        if not start_date:
            start_date = datetime.now() - timedelta(days=30)
        if not end_date:
            end_date = datetime.now()
        
        # Get payment intents
        payment_intents = stripe.PaymentIntent.list(
            customer=customer_id,
            created={
                "gte": int(start_date.timestamp()),
                "lte": int(end_date.timestamp())
            },
            limit=100
        )
        
        # Calculate analytics
        total_amount = sum(pi.amount for pi in payment_intents.data if pi.status == "succeeded") / 100
        total_transactions = len([pi for pi in payment_intents.data if pi.status == "succeeded"])
        failed_transactions = len([pi for pi in payment_intents.data if pi.status == "failed"])
        
        # Get subscriptions
        subscriptions = stripe.Subscription.list(customer=customer_id, limit=100)
        active_subscriptions = len([sub for sub in subscriptions.data if sub.status == "active"])
        
        return {
            "period": {
                "start_date": start_date,
                "end_date": end_date
            },
            "summary": {
                "total_amount": total_amount,
                "total_transactions": total_transactions,
                "failed_transactions": failed_transactions,
                "success_rate": (total_transactions / (total_transactions + failed_transactions) * 100) if (total_transactions + failed_transactions) > 0 else 0,
                "average_transaction": total_amount / total_transactions if total_transactions > 0 else 0
            },
            "subscriptions": {
                "active_count": active_subscriptions,
                "total_count": len(subscriptions.data)
            },
            "transactions": [
                {
                    "id": pi.id,
                    "amount": pi.amount / 100,
                    "currency": pi.currency,
                    "status": pi.status,
                    "description": pi.description,
                    "created": pi.created
                }
                for pi in payment_intents.data
            ]
        }
        
    except stripe.StripeError as e:
        logger.error(f"Payment analytics failed: {e}")
        raise HTTPException(status_code=400, detail=f"Payment analytics failed: {str(e)}")

# Webhook endpoint
@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle Stripe webhooks"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Handle different event types
    if event["type"] == "payment_intent.succeeded":
        await _handle_payment_succeeded(event["data"]["object"], db)
    elif event["type"] == "payment_intent.payment_failed":
        await _handle_payment_failed(event["data"]["object"], db)
    elif event["type"] == "invoice.payment_succeeded":
        await _handle_subscription_payment_succeeded(event["data"]["object"], db)
    elif event["type"] == "customer.subscription.deleted":
        await _handle_subscription_deleted(event["data"]["object"], db)
    elif event["type"] == "invoice.payment_failed":
        await _handle_subscription_payment_failed(event["data"]["object"], db)
    
    return JSONResponse(content={"status": "success"})

# Helper Functions

async def _get_or_create_stripe_customer(user: User, db: Session) -> str:
    """Get or create Stripe customer for user"""
    # This would typically check the user's profile for existing customer ID
    # For now, create a new customer or retrieve existing one
    
    # Check if user has a customer ID stored (you'd implement this based on your user model)
    customer_id = None  # Get from user profile
    
    if not customer_id:
        customer = stripe.Customer.create(
            email=user.email,
            name=user.username,
            metadata={
                "user_id": str(user.id),
                "username": user.username
            }
        )
        customer_id = customer.id
        
        # Save customer ID to user profile (implement based on your user model)
        # user.stripe_customer_id = customer_id
        # db.commit()
    
    return customer_id

async def _handle_coupon_code(coupon_code: str, user: User, db: Session) -> Optional[str]:
    """Handle coupon code application"""
    coupon_code = coupon_code.upper()
    
    if coupon_code == "5STARGENERAL":
        # Create 50% off forever coupon
        try:
            coupon = stripe.Coupon.create(
                percent_off=50,
                duration="forever",
                id=f"5star_{user.id}_{int(datetime.now().timestamp())}",
                metadata={"discount_type": "five_star_general", "user_id": str(user.id)}
            )
            return coupon.id
        except stripe.error.StripeError:
            # Coupon might already exist
            return None
    
    elif coupon_code == "INFANTRY":
        # Create 50% off 3 months coupon
        try:
            coupon = stripe.Coupon.create(
                percent_off=50,
                duration="repeating",
                duration_in_months=3,
                id=f"infantry_{user.id}_{int(datetime.now().timestamp())}",
                metadata={"discount_type": "infantry", "user_id": str(user.id)}
            )
            return coupon.id
        except stripe.error.StripeError:
            return None
    
    return None

async def _handle_payment_succeeded(payment_intent: Dict[str, Any], db: Session):
    """Handle successful payment"""
    logger.info(f"Payment succeeded: {payment_intent['id']}")
    
    # Implement token crediting logic based on metadata
    metadata = payment_intent.get("metadata", {})
    if metadata.get("type") == "token_purchase":
        try:
            # Get user and credit tokens
            user_id = int(metadata.get("user_id"))
            user = db.query(User).filter(User.id == user_id).first()
            
            if user:
                payment_service = PaymentService(db)
                regular_tokens = int(metadata.get("regular_tokens", 0))
                mail_tokens = int(metadata.get("mail_tokens", 0))
                amount = Decimal(str(payment_intent["amount"] / 100))
                
                # Credit tokens to user account
                payment_service.credit_tokens(
                    user=user,
                    regular_tokens=regular_tokens,
                    mail_tokens=mail_tokens,
                    transaction_type="purchase",
                    description=f"Token purchase via payment intent {payment_intent['id']}",
                    payment_intent_id=payment_intent['id'],
                    cost=amount
                )
                
                logger.info(f"Credited {regular_tokens} regular + {mail_tokens} mail tokens to user {user_id}")
            else:
                logger.error(f"User not found for payment: {user_id}")
                
        except Exception as e:
            logger.error(f"Error crediting tokens: {e}")

async def _handle_payment_failed(payment_intent: Dict[str, Any], db: Session):
    """Handle failed payment"""
    logger.error(f"Payment failed: {payment_intent['id']}")
    
    # Implement failure handling logic
    # Send notification to user, log the failure, etc.

async def _handle_subscription_payment_succeeded(invoice: Dict[str, Any], db: Session):
    """Handle successful subscription payment"""
    logger.info(f"Subscription payment succeeded: {invoice['id']}")
    
    try:
        # Get subscription details
        subscription_id = invoice.get("subscription")
        customer_id = invoice.get("customer")
        amount = Decimal(str(invoice["amount_paid"] / 100))
        
        if subscription_id and customer_id:
            payment_service = PaymentService(db)
            success = payment_service.handle_subscription_payment_success(
                subscription_id=subscription_id,
                invoice_id=invoice["id"],
                customer_id=customer_id,
                amount=amount
            )
            
            if success:
                logger.info(f"Subscription tokens credited for invoice {invoice['id']}")
            else:
                logger.error(f"Failed to credit subscription tokens for invoice {invoice['id']}")
    
    except Exception as e:
        logger.error(f"Error handling subscription payment: {e}")

async def _handle_subscription_deleted(subscription: Dict[str, Any], db: Session):
    """Handle subscription cancellation"""
    logger.info(f"Subscription deleted: {subscription['id']}")
    
    try:
        payment_service = PaymentService(db)
        success = payment_service.handle_subscription_cancellation(subscription["id"])
        
        if success:
            logger.info(f"Subscription cancellation processed: {subscription['id']}")
        else:
            logger.error(f"Failed to process subscription cancellation: {subscription['id']}")
    
    except Exception as e:
        logger.error(f"Error handling subscription cancellation: {e}")

async def _handle_subscription_payment_failed(invoice: Dict[str, Any], db: Session):
    """Handle failed subscription payment"""
    logger.error(f"Subscription payment failed: {invoice['id']}")
    
    # Handle payment failure (retry, notify user, etc.)