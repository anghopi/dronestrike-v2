"""
Payment processing integrations for DroneStrike.
"""

import stripe
import paypalrestsdk
from typing import Dict, Any, Optional, List
from decimal import Decimal
from pydantic import BaseModel
from .base import BaseIntegration, IntegrationConfig, IntegrationError


class PaymentConfig(IntegrationConfig):
    """Configuration for payment integrations."""
    webhook_secret: Optional[str] = None
    currency: str = "USD"
    test_mode: bool = True


class PaymentResult(BaseModel):
    """Payment processing result."""
    success: bool
    transaction_id: Optional[str] = None
    amount: Optional[Decimal] = None
    currency: str = "USD"
    status: str
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = {}


class StripeIntegration(BaseIntegration):
    """Stripe payment processing integration."""
    
    def __init__(self, config: PaymentConfig):
        super().__init__(config)
        self.config: PaymentConfig = config
    
    def _initialize_client(self) -> None:
        """Initialize Stripe client."""
        stripe.api_key = self.config.api_key
        self.client = stripe
        
        # Test the connection
        try:
            stripe.Account.retrieve()
            self.logger.info("Stripe integration initialized successfully")
        except stripe.error.StripeError as e:
            self.logger.error(f"Failed to initialize Stripe: {e}")
            raise IntegrationError(f"Stripe initialization failed: {e}")
    
    async def create_payment_intent(
        self,
        amount: Decimal,
        currency: str = None,
        customer_id: str = None,
        metadata: Dict[str, str] = None
    ) -> PaymentResult:
        """Create a Stripe payment intent."""
        try:
            intent = stripe.PaymentIntent.create(
                amount=int(amount * 100),  # Convert to cents
                currency=currency or self.config.currency,
                customer=customer_id,
                metadata=metadata or {},
                automatic_payment_methods={'enabled': True}
            )
            
            return PaymentResult(
                success=True,
                transaction_id=intent.id,
                amount=amount,
                currency=intent.currency.upper(),
                status=intent.status,
                metadata={
                    'client_secret': intent.client_secret,
                    'payment_method_types': intent.payment_method_types
                }
            )
            
        except stripe.error.StripeError as e:
            self.logger.error(f"Stripe payment intent creation failed: {e}")
            return PaymentResult(
                success=False,
                status="failed",
                error_message=str(e)
            )
    
    async def confirm_payment(self, payment_intent_id: str) -> PaymentResult:
        """Confirm a Stripe payment intent."""
        try:
            intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            
            return PaymentResult(
                success=intent.status == "succeeded",
                transaction_id=intent.id,
                amount=Decimal(intent.amount) / 100,
                currency=intent.currency.upper(),
                status=intent.status,
                metadata={
                    'payment_method': intent.payment_method,
                    'charges': [charge.id for charge in intent.charges.data]
                }
            )
            
        except stripe.error.StripeError as e:
            self.logger.error(f"Stripe payment confirmation failed: {e}")
            return PaymentResult(
                success=False,
                status="failed",
                error_message=str(e)
            )
    
    async def create_customer(
        self,
        email: str,
        name: str = None,
        metadata: Dict[str, str] = None
    ) -> str:
        """Create a Stripe customer."""
        try:
            customer = stripe.Customer.create(
                email=email,
                name=name,
                metadata=metadata or {}
            )
            return customer.id
            
        except stripe.error.StripeError as e:
            self.logger.error(f"Stripe customer creation failed: {e}")
            raise IntegrationError(f"Failed to create customer: {e}")
    
    async def create_subscription(
        self,
        customer_id: str,
        price_id: str,
        metadata: Dict[str, str] = None
    ) -> PaymentResult:
        """Create a Stripe subscription."""
        try:
            subscription = stripe.Subscription.create(
                customer=customer_id,
                items=[{'price': price_id}],
                metadata=metadata or {}
            )
            
            return PaymentResult(
                success=subscription.status in ["active", "trialing"],
                transaction_id=subscription.id,
                status=subscription.status,
                metadata={
                    'current_period_start': subscription.current_period_start,
                    'current_period_end': subscription.current_period_end,
                    'latest_invoice': subscription.latest_invoice
                }
            )
            
        except stripe.error.StripeError as e:
            self.logger.error(f"Stripe subscription creation failed: {e}")
            return PaymentResult(
                success=False,
                status="failed",
                error_message=str(e)
            )
    
    def verify_webhook(self, payload: bytes, signature: str) -> Dict[str, Any]:
        """Verify and parse Stripe webhook."""
        try:
            event = stripe.Webhook.construct_event(
                payload, signature, self.config.webhook_secret
            )
            return event
            
        except ValueError as e:
            raise IntegrationError(f"Invalid payload: {e}")
        except stripe.error.SignatureVerificationError as e:
            raise IntegrationError(f"Invalid signature: {e}")


class PayPalIntegration(BaseIntegration):
    """PayPal payment processing integration."""
    
    def __init__(self, config: PaymentConfig):
        super().__init__(config)
        self.config: PaymentConfig = config
    
    def _initialize_client(self) -> None:
        """Initialize PayPal client."""
        paypalrestsdk.configure({
            "mode": "sandbox" if self.config.test_mode else "live",
            "client_id": self.config.api_key,
            "client_secret": self.config.api_secret
        })
        self.client = paypalrestsdk
        self.logger.info("PayPal integration initialized successfully")
    
    async def create_payment(
        self,
        amount: Decimal,
        currency: str = None,
        description: str = "DroneStrike Payment",
        return_url: str = None,
        cancel_url: str = None
    ) -> PaymentResult:
        """Create a PayPal payment."""
        try:
            payment = paypalrestsdk.Payment({
                "intent": "sale",
                "payer": {"payment_method": "paypal"},
                "redirect_urls": {
                    "return_url": return_url,
                    "cancel_url": cancel_url
                },
                "transactions": [{
                    "item_list": {
                        "items": [{
                            "name": description,
                            "sku": "dronestrike-service",
                            "price": str(amount),
                            "currency": currency or self.config.currency,
                            "quantity": 1
                        }]
                    },
                    "amount": {
                        "total": str(amount),
                        "currency": currency or self.config.currency
                    },
                    "description": description
                }]
            })
            
            if payment.create():
                approval_url = next(
                    link.href for link in payment.links 
                    if link.rel == "approval_url"
                )
                
                return PaymentResult(
                    success=True,
                    transaction_id=payment.id,
                    amount=amount,
                    currency=currency or self.config.currency,
                    status="created",
                    metadata={
                        "approval_url": approval_url,
                        "links": [{"rel": link.rel, "href": link.href} for link in payment.links]
                    }
                )
            else:
                return PaymentResult(
                    success=False,
                    status="failed",
                    error_message=str(payment.error)
                )
                
        except Exception as e:
            self.logger.error(f"PayPal payment creation failed: {e}")
            return PaymentResult(
                success=False,
                status="failed",
                error_message=str(e)
            )
    
    async def execute_payment(self, payment_id: str, payer_id: str) -> PaymentResult:
        """Execute a PayPal payment."""
        try:
            payment = paypalrestsdk.Payment.find(payment_id)
            
            if payment.execute({"payer_id": payer_id}):
                transaction = payment.transactions[0]
                
                return PaymentResult(
                    success=True,
                    transaction_id=payment.id,
                    amount=Decimal(transaction.amount.total),
                    currency=transaction.amount.currency,
                    status="completed",
                    metadata={
                        "sale_id": transaction.related_resources[0].sale.id,
                        "payer_id": payer_id
                    }
                )
            else:
                return PaymentResult(
                    success=False,
                    status="failed",
                    error_message=str(payment.error)
                )
                
        except Exception as e:
            self.logger.error(f"PayPal payment execution failed: {e}")
            return PaymentResult(
                success=False,
                status="failed",
                error_message=str(e)
            )
    
    async def refund_payment(self, sale_id: str, amount: Decimal = None) -> PaymentResult:
        """Refund a PayPal payment."""
        try:
            sale = paypalrestsdk.Sale.find(sale_id)
            
            refund_data = {}
            if amount:
                refund_data["amount"] = {
                    "total": str(amount),
                    "currency": sale.amount.currency
                }
            
            refund = sale.refund(refund_data)
            
            if refund.success():
                return PaymentResult(
                    success=True,
                    transaction_id=refund.id,
                    amount=Decimal(refund.amount.total),
                    currency=refund.amount.currency,
                    status="completed",
                    metadata={"parent_payment": sale_id}
                )
            else:
                return PaymentResult(
                    success=False,
                    status="failed",
                    error_message=str(refund.error)
                )
                
        except Exception as e:
            self.logger.error(f"PayPal refund failed: {e}")
            return PaymentResult(
                success=False,
                status="failed",
                error_message=str(e)
            )