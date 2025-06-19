"""
Advanced Stripe integration for DroneStrike v2.

Provides comprehensive payment processing including subscriptions, invoices,
customer portal, fraud prevention, multi-party payments, webhooks, and analytics.
"""

import asyncio
import json
import time
import decimal
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union
from enum import Enum
from dataclasses import dataclass, field

import httpx
import stripe
from pydantic import BaseModel, validator, Field

from .base import HTTPIntegration, IntegrationConfig, IntegrationError, ValidationError, WebhookHandler, BatchProcessor


class StripeEventType(Enum):
    """Stripe webhook event types."""
    PAYMENT_INTENT_SUCCEEDED = "payment_intent.succeeded"
    PAYMENT_INTENT_FAILED = "payment_intent.payment_failed"
    INVOICE_PAYMENT_SUCCEEDED = "invoice.payment_succeeded"
    INVOICE_PAYMENT_FAILED = "invoice.payment_failed"
    CUSTOMER_SUBSCRIPTION_CREATED = "customer.subscription.created"
    CUSTOMER_SUBSCRIPTION_UPDATED = "customer.subscription.updated"
    CUSTOMER_SUBSCRIPTION_DELETED = "customer.subscription.deleted"
    CUSTOMER_CREATED = "customer.created"
    CUSTOMER_UPDATED = "customer.updated"
    CUSTOMER_DELETED = "customer.deleted"
    CHARGE_DISPUTE_CREATED = "charge.dispute.created"
    REVIEW_OPENED = "review.opened"
    RADAR_EARLY_FRAUD_WARNING_CREATED = "radar.early_fraud_warning.created"


class StripeCurrency(Enum):
    """Supported currencies."""
    USD = "usd"
    EUR = "eur"
    GBP = "gbp"
    CAD = "cad"
    AUD = "aud"
    JPY = "jpy"


class StripeInterval(Enum):
    """Subscription intervals."""
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    YEAR = "year"


class StripePaymentMethodType(Enum):
    """Payment method types."""
    CARD = "card"
    BANK_ACCOUNT = "us_bank_account"
    ACH_DEBIT = "ach_debit"
    SEPA_DEBIT = "sepa_debit"
    IDEAL = "ideal"
    SOFORT = "sofort"
    GIROPAY = "giropay"


class StripeConfig(IntegrationConfig):
    """Stripe-specific configuration."""
    publishable_key: str = Field(..., description="Stripe publishable key")
    base_url: str = "https://api.stripe.com/v1"
    
    # Webhook settings
    webhook_endpoint_secret: Optional[str] = None
    
    # Default settings
    default_currency: StripeCurrency = StripeCurrency.USD
    statement_descriptor: Optional[str] = None
    
    # Connect settings
    connect_enabled: bool = False
    platform_fee_percentage: float = Field(2.5, ge=0.0, le=100.0)
    
    # Fraud prevention
    radar_enabled: bool = True
    require_3d_secure: bool = False
    
    # Tax settings
    tax_calculation_enabled: bool = False
    
    class Config:
        extra = "allow"


@dataclass
class Money:
    """Money representation with currency."""
    amount: int  # Amount in smallest currency unit (cents)
    currency: str = "usd"
    
    @classmethod
    def from_decimal(cls, amount: decimal.Decimal, currency: str = "usd") -> 'Money':
        """Create Money from decimal amount."""
        # Convert to smallest currency unit
        if currency.lower() in ["jpy", "krw"]:  # Zero decimal currencies
            cents = int(amount)
        else:
            cents = int(amount * 100)
        return cls(amount=cents, currency=currency.lower())
    
    def to_decimal(self) -> decimal.Decimal:
        """Convert to decimal amount."""
        if self.currency.lower() in ["jpy", "krw"]:
            return decimal.Decimal(self.amount)
        else:
            return decimal.Decimal(self.amount) / 100
    
    def __str__(self) -> str:
        return f"{self.to_decimal()} {self.currency.upper()}"


class CustomerRequest(BaseModel):
    """Customer creation request."""
    email: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[Dict[str, str]] = None
    shipping: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, str]] = None
    payment_method: Optional[str] = None
    invoice_settings: Optional[Dict[str, Any]] = None
    tax_exempt: Optional[str] = None  # none, exempt, reverse


class PaymentIntentRequest(BaseModel):
    """Payment intent creation request."""
    amount: int = Field(..., gt=0, description="Amount in smallest currency unit")
    currency: str = Field("usd", description="Three-letter currency code")
    customer: Optional[str] = None
    description: Optional[str] = None
    receipt_email: Optional[str] = None
    statement_descriptor: Optional[str] = None
    metadata: Optional[Dict[str, str]] = None
    payment_method_types: Optional[List[str]] = None
    confirm: bool = False
    capture_method: str = "automatic"  # automatic or manual
    setup_future_usage: Optional[str] = None  # on_session, off_session
    shipping: Optional[Dict[str, Any]] = None
    application_fee_amount: Optional[int] = None
    on_behalf_of: Optional[str] = None  # For Connect
    transfer_data: Optional[Dict[str, Any]] = None  # For Connect


class SubscriptionRequest(BaseModel):
    """Subscription creation request."""
    customer: str
    items: List[Dict[str, Any]] = Field(..., min_items=1)
    trial_period_days: Optional[int] = None
    trial_end: Optional[datetime] = None
    proration_behavior: str = "create_prorations"
    billing_cycle_anchor: Optional[datetime] = None
    collection_method: str = "charge_automatically"
    default_payment_method: Optional[str] = None
    metadata: Optional[Dict[str, str]] = None
    promotional_code: Optional[str] = None
    add_invoice_items: Optional[List[Dict[str, Any]]] = None
    application_fee_percent: Optional[float] = None  # For Connect
    transfer_data: Optional[Dict[str, Any]] = None  # For Connect


class ProductRequest(BaseModel):
    """Product creation request."""
    name: str
    description: Optional[str] = None
    images: Optional[List[str]] = None
    metadata: Optional[Dict[str, str]] = None
    active: bool = True
    type: str = "service"  # good or service
    url: Optional[str] = None
    statement_descriptor: Optional[str] = None


class PriceRequest(BaseModel):
    """Price creation request."""
    product: str
    unit_amount: Optional[int] = None  # For one-time prices
    currency: str = "usd"
    recurring: Optional[Dict[str, Any]] = None  # For recurring prices
    active: bool = True
    metadata: Optional[Dict[str, str]] = None
    nickname: Optional[str] = None
    billing_scheme: str = "per_unit"  # per_unit or tiered
    tiers: Optional[List[Dict[str, Any]]] = None  # For tiered pricing
    transform_quantity: Optional[Dict[str, Any]] = None


class InvoiceRequest(BaseModel):
    """Invoice creation request."""
    customer: str
    description: Optional[str] = None
    metadata: Optional[Dict[str, str]] = None
    auto_advance: bool = True
    collection_method: str = "charge_automatically"
    days_until_due: Optional[int] = None
    default_payment_method: Optional[str] = None
    due_date: Optional[datetime] = None
    footer: Optional[str] = None
    statement_descriptor: Optional[str] = None
    application_fee_amount: Optional[int] = None  # For Connect


class RefundRequest(BaseModel):
    """Refund creation request."""
    charge: Optional[str] = None
    payment_intent: Optional[str] = None
    amount: Optional[int] = None  # If not provided, refunds full amount
    reason: Optional[str] = None  # duplicate, fraudulent, requested_by_customer
    metadata: Optional[Dict[str, str]] = None
    refund_application_fee: bool = False  # For Connect
    reverse_transfer: bool = False  # For Connect


class AdvancedStripe(HTTPIntegration):
    """
    Advanced Stripe integration with comprehensive payment capabilities.
    
    Features:
    - Complete payment processing
    - Subscription management with prorations
    - Invoice generation and management
    - Customer portal integration
    - Advanced fraud prevention
    - Multi-party payments (Connect)
    - Webhook handling with signature verification
    - Payment method management
    - Tax calculation integration
    - Comprehensive refund/dispute handling
    """
    
    def __init__(self, config: StripeConfig):
        super().__init__(config)
        self.config: StripeConfig = config
        
        # Initialize Stripe library
        stripe.api_key = config.api_key
        if config.base_url != "https://api.stripe.com/v1":
            stripe.api_base = config.base_url
        
        self.batch_processor = BatchProcessor(batch_size=100, max_workers=5)
        self.webhook_handler = None
        
        if config.webhook_endpoint_secret:
            self.webhook_handler = StripeWebhookHandler(config.webhook_endpoint_secret)
    
    def _initialize_client(self) -> None:
        """Initialize Stripe HTTP client."""
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(self.config.timeout),
            headers=self._get_default_headers(),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=100)
        )
    
    def _get_default_headers(self) -> Dict[str, str]:
        """Get default headers for Stripe requests."""
        return {
            "User-Agent": "DroneStrike/2.0 Stripe Integration",
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "Stripe-Version": "2023-10-16"
        }
    
    async def _perform_health_check(self) -> None:
        """Perform Stripe API health check."""
        try:
            await self.get_account_info()
        except Exception as e:
            raise IntegrationError(f"Stripe health check failed: {e}")
    
    def _handle_stripe_error(self, error: stripe.StripeError, context: str = "") -> None:
        """Handle Stripe-specific errors."""
        error_msg = f"Stripe error in {context}: {str(error)}"
        self.logger.error(error_msg, exc_info=True)
        
        if isinstance(error, stripe.CardError):
            raise ValidationError(f"Card error: {error.user_message}")
        elif isinstance(error, stripe.RateLimitError):
            raise IntegrationError("Rate limit exceeded")
        elif isinstance(error, stripe.InvalidRequestError):
            raise ValidationError(f"Invalid request: {error.user_message}")
        elif isinstance(error, stripe.AuthenticationError):
            raise IntegrationError("Authentication failed")
        elif isinstance(error, stripe.APIConnectionError):
            raise IntegrationError("Network error")
        elif isinstance(error, stripe.StripeError):
            raise IntegrationError(f"Stripe API error: {error.user_message}")
        else:
            raise IntegrationError(error_msg)
    
    # Account Management
    
    async def get_account_info(self) -> Dict[str, Any]:
        """Get Stripe account information."""
        try:
            account = stripe.Account.retrieve()
            
            return {
                "id": account.id,
                "business_profile": account.business_profile,
                "charges_enabled": account.charges_enabled,
                "country": account.country,
                "default_currency": account.default_currency,
                "details_submitted": account.details_submitted,
                "email": account.email,
                "payouts_enabled": account.payouts_enabled,
                "settings": account.settings,
                "type": account.type,
                "created": datetime.fromtimestamp(account.created)
            }
        except stripe.StripeError as e:
            self._handle_stripe_error(e, "get account info")
    
    async def get_balance(self) -> Dict[str, Any]:
        """Get account balance."""
        try:
            balance = stripe.Balance.retrieve()
            
            return {
                "available": [
                    {
                        "amount": Money(bal.amount, bal.currency).to_decimal(),
                        "currency": bal.currency,
                        "source_types": bal.source_types
                    }
                    for bal in balance.available
                ],
                "pending": [
                    {
                        "amount": Money(bal.amount, bal.currency).to_decimal(),
                        "currency": bal.currency,
                        "source_types": bal.source_types
                    }
                    for bal in balance.pending
                ],
                "connect_reserved": [
                    {
                        "amount": Money(bal.amount, bal.currency).to_decimal(),
                        "currency": bal.currency,
                        "source_types": bal.source_types
                    }
                    for bal in (balance.connect_reserved or [])
                ]
            }
        except stripe.StripeError as e:
            self._handle_stripe_error(e, "get balance")
    
    # Customer Management
    
    async def create_customer(self, customer_request: CustomerRequest) -> Dict[str, Any]:
        """Create a new customer."""
        try:
            customer_data = customer_request.dict(exclude_none=True)
            customer = stripe.Customer.create(**customer_data)
            
            return self._format_customer(customer)
        except stripe.StripeError as e:
            self._handle_stripe_error(e, f"create customer {customer_request.email}")
    
    async def get_customer(self, customer_id: str) -> Dict[str, Any]:
        """Get customer by ID."""
        try:
            customer = stripe.Customer.retrieve(customer_id)
            return self._format_customer(customer)
        except stripe.StripeError as e:
            self._handle_stripe_error(e, f"get customer {customer_id}")
    
    async def update_customer(
        self,
        customer_id: str,
        **kwargs
    ) -> Dict[str, Any]:
        """Update customer information."""
        try:
            customer = stripe.Customer.modify(customer_id, **kwargs)
            return self._format_customer(customer)
        except stripe.StripeError as e:
            self._handle_stripe_error(e, f"update customer {customer_id}")
    
    async def delete_customer(self, customer_id: str) -> Dict[str, Any]:
        """Delete a customer."""
        try:
            deleted = stripe.Customer.delete(customer_id)
            return {
                "id": deleted.id,
                "deleted": deleted.deleted
            }
        except stripe.StripeError as e:
            self._handle_stripe_error(e, f"delete customer {customer_id}")
    
    async def list_customers(
        self,
        email: Optional[str] = None,
        created: Optional[Dict[str, int]] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """List customers with optional filters."""
        try:
            params = {"limit": limit}
            if email:
                params["email"] = email
            if created:
                params["created"] = created
            
            customers = stripe.Customer.list(**params)
            return [self._format_customer(customer) for customer in customers.data]
        except stripe.StripeError as e:
            self._handle_stripe_error(e, "list customers")
    
    def _format_customer(self, customer) -> Dict[str, Any]:
        """Format customer object for response."""
        return {
            "id": customer.id,
            "email": customer.email,
            "name": customer.name,
            "description": customer.description,
            "phone": customer.phone,
            "address": customer.address,
            "shipping": customer.shipping,
            "metadata": customer.metadata,
            "balance": customer.balance,
            "currency": customer.currency,
            "delinquent": customer.delinquent,
            "tax_exempt": customer.tax_exempt,
            "created": datetime.fromtimestamp(customer.created),
            "default_source": customer.default_source,
            "invoice_prefix": customer.invoice_prefix,
            "next_invoice_sequence": customer.next_invoice_sequence
        }
    
    # Payment Intents
    
    async def create_payment_intent(
        self,
        payment_request: PaymentIntentRequest
    ) -> Dict[str, Any]:
        """Create a payment intent."""
        try:
            # Add platform fee if Connect is enabled
            intent_data = payment_request.dict(exclude_none=True)
            
            if (self.config.connect_enabled and 
                not intent_data.get("application_fee_amount") and 
                intent_data.get("on_behalf_of")):
                
                fee_amount = int(payment_request.amount * self.config.platform_fee_percentage / 100)
                intent_data["application_fee_amount"] = fee_amount
            
            payment_intent = stripe.PaymentIntent.create(**intent_data)
            return self._format_payment_intent(payment_intent)
        except stripe.StripeError as e:
            self._handle_stripe_error(e, f"create payment intent for {payment_request.amount}")
    
    async def get_payment_intent(self, payment_intent_id: str) -> Dict[str, Any]:
        """Get payment intent by ID."""
        try:
            payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            return self._format_payment_intent(payment_intent)
        except stripe.StripeError as e:
            self._handle_stripe_error(e, f"get payment intent {payment_intent_id}")
    
    async def confirm_payment_intent(
        self,
        payment_intent_id: str,
        payment_method: Optional[str] = None,
        return_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """Confirm a payment intent."""
        try:
            params = {}
            if payment_method:
                params["payment_method"] = payment_method
            if return_url:
                params["return_url"] = return_url
            
            payment_intent = stripe.PaymentIntent.confirm(payment_intent_id, **params)
            return self._format_payment_intent(payment_intent)
        except stripe.StripeError as e:
            self._handle_stripe_error(e, f"confirm payment intent {payment_intent_id}")
    
    async def cancel_payment_intent(self, payment_intent_id: str) -> Dict[str, Any]:
        """Cancel a payment intent."""
        try:
            payment_intent = stripe.PaymentIntent.cancel(payment_intent_id)
            return self._format_payment_intent(payment_intent)
        except stripe.StripeError as e:
            self._handle_stripe_error(e, f"cancel payment intent {payment_intent_id}")
    
    def _format_payment_intent(self, payment_intent) -> Dict[str, Any]:
        """Format payment intent for response."""
        return {
            "id": payment_intent.id,
            "amount": payment_intent.amount,
            "amount_received": payment_intent.amount_received,
            "currency": payment_intent.currency,
            "status": payment_intent.status,
            "client_secret": payment_intent.client_secret,
            "customer": payment_intent.customer,
            "description": payment_intent.description,
            "receipt_email": payment_intent.receipt_email,
            "metadata": payment_intent.metadata,
            "payment_method": payment_intent.payment_method,
            "payment_method_types": payment_intent.payment_method_types,
            "charges": [self._format_charge(charge) for charge in payment_intent.charges.data],
            "created": datetime.fromtimestamp(payment_intent.created),
            "application_fee_amount": payment_intent.application_fee_amount,
            "transfer_data": payment_intent.transfer_data
        }
    
    def _format_charge(self, charge) -> Dict[str, Any]:
        """Format charge object."""
        return {
            "id": charge.id,
            "amount": charge.amount,
            "currency": charge.currency,
            "status": charge.status,
            "paid": charge.paid,
            "refunded": charge.refunded,
            "captured": charge.captured,
            "receipt_url": charge.receipt_url,
            "failure_code": charge.failure_code,
            "failure_message": charge.failure_message,
            "outcome": charge.outcome,
            "created": datetime.fromtimestamp(charge.created)
        }
    
    # Payment Methods
    
    async def create_payment_method(
        self,
        type_: str,
        customer: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Create a payment method."""
        try:
            payment_method = stripe.PaymentMethod.create(
                type=type_,
                **kwargs
            )
            
            if customer:
                payment_method = stripe.PaymentMethod.attach(
                    payment_method.id,
                    customer=customer
                )
            
            return self._format_payment_method(payment_method)
        except stripe.StripeError as e:
            self._handle_stripe_error(e, f"create payment method {type_}")
    
    async def list_payment_methods(
        self,
        customer: str,
        type_: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """List customer payment methods."""
        try:
            params = {"customer": customer}
            if type_:
                params["type"] = type_
            
            payment_methods = stripe.PaymentMethod.list(**params)
            return [self._format_payment_method(pm) for pm in payment_methods.data]
        except stripe.StripeError as e:
            self._handle_stripe_error(e, f"list payment methods for {customer}")
    
    async def detach_payment_method(self, payment_method_id: str) -> Dict[str, Any]:
        """Detach payment method from customer."""
        try:
            payment_method = stripe.PaymentMethod.detach(payment_method_id)
            return self._format_payment_method(payment_method)
        except stripe.StripeError as e:
            self._handle_stripe_error(e, f"detach payment method {payment_method_id}")
    
    def _format_payment_method(self, payment_method) -> Dict[str, Any]:
        """Format payment method for response."""
        return {
            "id": payment_method.id,
            "type": payment_method.type,
            "customer": payment_method.customer,
            "metadata": payment_method.metadata,
            "created": datetime.fromtimestamp(payment_method.created),
            "card": payment_method.card if hasattr(payment_method, 'card') else None,
            "us_bank_account": payment_method.us_bank_account if hasattr(payment_method, 'us_bank_account') else None
        }
    
    # Products and Prices
    
    async def create_product(self, product_request: ProductRequest) -> Dict[str, Any]:
        """Create a product."""
        try:
            product_data = product_request.dict(exclude_none=True)
            product = stripe.Product.create(**product_data)
            return self._format_product(product)
        except stripe.StripeError as e:
            self._handle_stripe_error(e, f"create product {product_request.name}")
    
    async def create_price(self, price_request: PriceRequest) -> Dict[str, Any]:
        """Create a price."""
        try:
            price_data = price_request.dict(exclude_none=True)
            price = stripe.Price.create(**price_data)
            return self._format_price(price)
        except stripe.StripeError as e:
            self._handle_stripe_error(e, f"create price for {price_request.product}")
    
    async def list_products(
        self,
        active: Optional[bool] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """List products."""
        try:
            params = {"limit": limit}
            if active is not None:
                params["active"] = active
            
            products = stripe.Product.list(**params)
            return [self._format_product(product) for product in products.data]
        except stripe.StripeError as e:
            self._handle_stripe_error(e, "list products")
    
    async def list_prices(
        self,
        product: Optional[str] = None,
        active: Optional[bool] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """List prices."""
        try:
            params = {"limit": limit}
            if product:
                params["product"] = product
            if active is not None:
                params["active"] = active
            
            prices = stripe.Price.list(**params)
            return [self._format_price(price) for price in prices.data]
        except stripe.StripeError as e:
            self._handle_stripe_error(e, "list prices")
    
    def _format_product(self, product) -> Dict[str, Any]:
        """Format product for response."""
        return {
            "id": product.id,
            "name": product.name,
            "description": product.description,
            "active": product.active,
            "type": product.type,
            "url": product.url,
            "images": product.images,
            "metadata": product.metadata,
            "created": datetime.fromtimestamp(product.created),
            "updated": datetime.fromtimestamp(product.updated)
        }
    
    def _format_price(self, price) -> Dict[str, Any]:
        """Format price for response."""
        return {
            "id": price.id,
            "product": price.product,
            "active": price.active,
            "currency": price.currency,
            "unit_amount": price.unit_amount,
            "recurring": price.recurring,
            "type": price.type,
            "billing_scheme": price.billing_scheme,
            "nickname": price.nickname,
            "metadata": price.metadata,
            "created": datetime.fromtimestamp(price.created)
        }
    
    # Subscriptions
    
    async def create_subscription(
        self,
        subscription_request: SubscriptionRequest
    ) -> Dict[str, Any]:
        """Create a subscription."""
        try:
            subscription_data = subscription_request.dict(exclude_none=True)
            
            # Convert datetime objects to Unix timestamps
            if subscription_data.get("trial_end"):
                subscription_data["trial_end"] = int(subscription_data["trial_end"].timestamp())
            if subscription_data.get("billing_cycle_anchor"):
                subscription_data["billing_cycle_anchor"] = int(subscription_data["billing_cycle_anchor"].timestamp())
            
            subscription = stripe.Subscription.create(**subscription_data)
            return self._format_subscription(subscription)
        except stripe.StripeError as e:
            self._handle_stripe_error(e, f"create subscription for {subscription_request.customer}")
    
    async def get_subscription(self, subscription_id: str) -> Dict[str, Any]:
        """Get subscription by ID."""
        try:
            subscription = stripe.Subscription.retrieve(subscription_id)
            return self._format_subscription(subscription)
        except stripe.StripeError as e:
            self._handle_stripe_error(e, f"get subscription {subscription_id}")
    
    async def update_subscription(
        self,
        subscription_id: str,
        **kwargs
    ) -> Dict[str, Any]:
        """Update subscription."""
        try:
            subscription = stripe.Subscription.modify(subscription_id, **kwargs)
            return self._format_subscription(subscription)
        except stripe.StripeError as e:
            self._handle_stripe_error(e, f"update subscription {subscription_id}")
    
    async def cancel_subscription(
        self,
        subscription_id: str,
        at_period_end: bool = False
    ) -> Dict[str, Any]:
        """Cancel subscription."""
        try:
            if at_period_end:
                subscription = stripe.Subscription.modify(
                    subscription_id,
                    cancel_at_period_end=True
                )
            else:
                subscription = stripe.Subscription.cancel(subscription_id)
            
            return self._format_subscription(subscription)
        except stripe.StripeError as e:
            self._handle_stripe_error(e, f"cancel subscription {subscription_id}")
    
    async def list_subscriptions(
        self,
        customer: Optional[str] = None,
        price: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """List subscriptions."""
        try:
            params = {"limit": limit}
            if customer:
                params["customer"] = customer
            if price:
                params["price"] = price
            if status:
                params["status"] = status
            
            subscriptions = stripe.Subscription.list(**params)
            return [self._format_subscription(sub) for sub in subscriptions.data]
        except stripe.StripeError as e:
            self._handle_stripe_error(e, "list subscriptions")
    
    def _format_subscription(self, subscription) -> Dict[str, Any]:
        """Format subscription for response."""
        return {
            "id": subscription.id,
            "customer": subscription.customer,
            "status": subscription.status,
            "current_period_start": datetime.fromtimestamp(subscription.current_period_start),
            "current_period_end": datetime.fromtimestamp(subscription.current_period_end),
            "trial_start": datetime.fromtimestamp(subscription.trial_start) if subscription.trial_start else None,
            "trial_end": datetime.fromtimestamp(subscription.trial_end) if subscription.trial_end else None,
            "cancel_at_period_end": subscription.cancel_at_period_end,
            "canceled_at": datetime.fromtimestamp(subscription.canceled_at) if subscription.canceled_at else None,
            "items": [
                {
                    "id": item.id,
                    "price": self._format_price(item.price),
                    "quantity": item.quantity
                }
                for item in subscription.items.data
            ],
            "metadata": subscription.metadata,
            "created": datetime.fromtimestamp(subscription.created),
            "application_fee_percent": subscription.application_fee_percent,
            "transfer_data": subscription.transfer_data
        }
    
    # Invoices
    
    async def create_invoice(self, invoice_request: InvoiceRequest) -> Dict[str, Any]:
        """Create an invoice."""
        try:
            invoice_data = invoice_request.dict(exclude_none=True)
            
            # Convert datetime to Unix timestamp
            if invoice_data.get("due_date"):
                invoice_data["due_date"] = int(invoice_data["due_date"].timestamp())
            
            invoice = stripe.Invoice.create(**invoice_data)
            return self._format_invoice(invoice)
        except stripe.StripeError as e:
            self._handle_stripe_error(e, f"create invoice for {invoice_request.customer}")
    
    async def finalize_invoice(self, invoice_id: str) -> Dict[str, Any]:
        """Finalize an invoice."""
        try:
            invoice = stripe.Invoice.finalize_invoice(invoice_id)
            return self._format_invoice(invoice)
        except stripe.StripeError as e:
            self._handle_stripe_error(e, f"finalize invoice {invoice_id}")
    
    async def pay_invoice(self, invoice_id: str) -> Dict[str, Any]:
        """Pay an invoice."""
        try:
            invoice = stripe.Invoice.pay(invoice_id)
            return self._format_invoice(invoice)
        except stripe.StripeError as e:
            self._handle_stripe_error(e, f"pay invoice {invoice_id}")
    
    async def send_invoice(self, invoice_id: str) -> Dict[str, Any]:
        """Send an invoice."""
        try:
            invoice = stripe.Invoice.send_invoice(invoice_id)
            return self._format_invoice(invoice)
        except stripe.StripeError as e:
            self._handle_stripe_error(e, f"send invoice {invoice_id}")
    
    async def list_invoices(
        self,
        customer: Optional[str] = None,
        subscription: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """List invoices."""
        try:
            params = {"limit": limit}
            if customer:
                params["customer"] = customer
            if subscription:
                params["subscription"] = subscription
            if status:
                params["status"] = status
            
            invoices = stripe.Invoice.list(**params)
            return [self._format_invoice(invoice) for invoice in invoices.data]
        except stripe.StripeError as e:
            self._handle_stripe_error(e, "list invoices")
    
    def _format_invoice(self, invoice) -> Dict[str, Any]:
        """Format invoice for response."""
        return {
            "id": invoice.id,
            "customer": invoice.customer,
            "subscription": invoice.subscription,
            "status": invoice.status,
            "amount_due": invoice.amount_due,
            "amount_paid": invoice.amount_paid,
            "amount_remaining": invoice.amount_remaining,
            "currency": invoice.currency,
            "description": invoice.description,
            "due_date": datetime.fromtimestamp(invoice.due_date) if invoice.due_date else None,
            "hosted_invoice_url": invoice.hosted_invoice_url,
            "invoice_pdf": invoice.invoice_pdf,
            "number": invoice.number,
            "paid": invoice.paid,
            "receipt_number": invoice.receipt_number,
            "metadata": invoice.metadata,
            "created": datetime.fromtimestamp(invoice.created),
            "application_fee_amount": invoice.application_fee_amount
        }
    
    # Refunds
    
    async def create_refund(self, refund_request: RefundRequest) -> Dict[str, Any]:
        """Create a refund."""
        try:
            refund_data = refund_request.dict(exclude_none=True)
            refund = stripe.Refund.create(**refund_data)
            return self._format_refund(refund)
        except stripe.StripeError as e:
            self._handle_stripe_error(e, f"create refund for {refund_request.charge or refund_request.payment_intent}")
    
    async def get_refund(self, refund_id: str) -> Dict[str, Any]:
        """Get refund by ID."""
        try:
            refund = stripe.Refund.retrieve(refund_id)
            return self._format_refund(refund)
        except stripe.StripeError as e:
            self._handle_stripe_error(e, f"get refund {refund_id}")
    
    async def list_refunds(
        self,
        charge: Optional[str] = None,
        payment_intent: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """List refunds."""
        try:
            params = {"limit": limit}
            if charge:
                params["charge"] = charge
            if payment_intent:
                params["payment_intent"] = payment_intent
            
            refunds = stripe.Refund.list(**params)
            return [self._format_refund(refund) for refund in refunds.data]
        except stripe.StripeError as e:
            self._handle_stripe_error(e, "list refunds")
    
    def _format_refund(self, refund) -> Dict[str, Any]:
        """Format refund for response."""
        return {
            "id": refund.id,
            "amount": refund.amount,
            "currency": refund.currency,
            "charge": refund.charge,
            "payment_intent": refund.payment_intent,
            "reason": refund.reason,
            "status": refund.status,
            "metadata": refund.metadata,
            "created": datetime.fromtimestamp(refund.created),
            "receipt_number": refund.receipt_number
        }
    
    # Customer Portal
    
    async def create_billing_portal_session(
        self,
        customer: str,
        return_url: str,
        configuration: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create billing portal session."""
        try:
            params = {
                "customer": customer,
                "return_url": return_url
            }
            if configuration:
                params["configuration"] = configuration
            
            session = stripe.billing_portal.Session.create(**params)
            return {
                "id": session.id,
                "url": session.url,
                "customer": session.customer,
                "return_url": session.return_url,
                "created": datetime.fromtimestamp(session.created)
            }
        except stripe.StripeError as e:
            self._handle_stripe_error(e, f"create billing portal session for {customer}")
    
    # Disputes and Fraud Prevention
    
    async def list_disputes(
        self,
        charge: Optional[str] = None,
        payment_intent: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """List disputes."""
        try:
            params = {"limit": limit}
            if charge:
                params["charge"] = charge
            if payment_intent:
                params["payment_intent"] = payment_intent
            
            disputes = stripe.Dispute.list(**params)
            return [self._format_dispute(dispute) for dispute in disputes.data]
        except stripe.StripeError as e:
            self._handle_stripe_error(e, "list disputes")
    
    async def update_dispute(
        self,
        dispute_id: str,
        evidence: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, str]] = None,
        submit: bool = False
    ) -> Dict[str, Any]:
        """Update dispute with evidence."""
        try:
            params = {}
            if evidence:
                params["evidence"] = evidence
            if metadata:
                params["metadata"] = metadata
            if submit:
                params["submit"] = True
            
            dispute = stripe.Dispute.modify(dispute_id, **params)
            return self._format_dispute(dispute)
        except stripe.StripeError as e:
            self._handle_stripe_error(e, f"update dispute {dispute_id}")
    
    def _format_dispute(self, dispute) -> Dict[str, Any]:
        """Format dispute for response."""
        return {
            "id": dispute.id,
            "amount": dispute.amount,
            "currency": dispute.currency,
            "charge": dispute.charge,
            "reason": dispute.reason,
            "status": dispute.status,
            "evidence": dispute.evidence,
            "evidence_details": dispute.evidence_details,
            "is_charge_refundable": dispute.is_charge_refundable,
            "metadata": dispute.metadata,
            "created": datetime.fromtimestamp(dispute.created)
        }
    
    # Analytics and Reporting
    
    async def get_integration_metrics(self) -> Dict[str, Any]:
        """Get integration-specific metrics."""
        base_metrics = await self.get_metrics()
        
        try:
            account_info = await self.get_account_info()
            balance = await self.get_balance()
            
            # Get recent payment activity
            recent_charges = stripe.Charge.list(limit=100)
            successful_charges = [c for c in recent_charges.data if c.paid]
            failed_charges = [c for c in recent_charges.data if not c.paid]
            
            total_volume = sum(c.amount for c in successful_charges)
            
            return {
                **base_metrics,
                "integration_type": "stripe",
                "account_id": account_info.get("id"),
                "charges_enabled": account_info.get("charges_enabled"),
                "payouts_enabled": account_info.get("payouts_enabled"),
                "default_currency": account_info.get("default_currency"),
                "available_balance": balance.get("available", []),
                "pending_balance": balance.get("pending", []),
                "recent_activity": {
                    "successful_charges": len(successful_charges),
                    "failed_charges": len(failed_charges),
                    "total_volume": total_volume,
                    "success_rate": len(successful_charges) / len(recent_charges.data) * 100 if recent_charges.data else 0
                },
                "features_enabled": {
                    "payment_processing": True,
                    "subscriptions": True,
                    "invoicing": True,
                    "customer_portal": True,
                    "connect": self.config.connect_enabled,
                    "radar": self.config.radar_enabled,
                    "tax_calculation": self.config.tax_calculation_enabled,
                    "webhooks": self.webhook_handler is not None
                }
            }
        except Exception as e:
            self.logger.warning(f"Could not fetch additional metrics: {e}")
            return {
                **base_metrics,
                "integration_type": "stripe"
            }


class StripeWebhookHandler(WebhookHandler):
    """Handle Stripe webhooks with signature verification."""
    
    def __init__(self, endpoint_secret: str):
        super().__init__(endpoint_secret)
        self.endpoint_secret = endpoint_secret
    
    async def verify_webhook(
        self,
        payload: bytes,
        signature: str,
        timestamp: str = None
    ) -> bool:
        """Verify Stripe webhook signature."""
        try:
            stripe.Webhook.construct_event(
                payload, signature, self.endpoint_secret
            )
            return True
        except (stripe.SignatureVerificationError, ValueError) as e:
            self.logger.error(f"Stripe webhook verification failed: {e}")
            return False
    
    async def process_webhook(self, event_type: str, data: Dict[str, Any]) -> None:
        """Process Stripe webhook events."""
        self.logger.info(f"Processing Stripe webhook: {event_type}")
        
        if event_type == "payment_intent.succeeded":
            await self._handle_payment_succeeded(data)
        elif event_type == "payment_intent.payment_failed":
            await self._handle_payment_failed(data)
        elif event_type == "invoice.payment_succeeded":
            await self._handle_invoice_payment_succeeded(data)
        elif event_type == "invoice.payment_failed":
            await self._handle_invoice_payment_failed(data)
        elif event_type.startswith("customer.subscription."):
            await self._handle_subscription_event(event_type, data)
        elif event_type.startswith("customer."):
            await self._handle_customer_event(event_type, data)
        elif event_type == "charge.dispute.created":
            await self._handle_dispute_created(data)
        elif event_type == "review.opened":
            await self._handle_review_opened(data)
        elif event_type == "radar.early_fraud_warning.created":
            await self._handle_fraud_warning(data)
        else:
            self.logger.warning(f"Unknown webhook event type: {event_type}")
    
    async def _handle_payment_succeeded(self, data: Dict[str, Any]) -> None:
        """Handle successful payment event."""
        payment_intent = data.get("object", {})
        self.logger.info(f"Payment succeeded: {payment_intent.get('id')} - Amount: {payment_intent.get('amount')}")
        # Implement payment success handling logic
    
    async def _handle_payment_failed(self, data: Dict[str, Any]) -> None:
        """Handle failed payment event."""
        payment_intent = data.get("object", {})
        self.logger.info(f"Payment failed: {payment_intent.get('id')} - Error: {payment_intent.get('last_payment_error')}")
        # Implement payment failure handling logic
    
    async def _handle_invoice_payment_succeeded(self, data: Dict[str, Any]) -> None:
        """Handle successful invoice payment."""
        invoice = data.get("object", {})
        self.logger.info(f"Invoice payment succeeded: {invoice.get('id')} - Customer: {invoice.get('customer')}")
        # Implement invoice payment success handling logic
    
    async def _handle_invoice_payment_failed(self, data: Dict[str, Any]) -> None:
        """Handle failed invoice payment."""
        invoice = data.get("object", {})
        self.logger.info(f"Invoice payment failed: {invoice.get('id')} - Customer: {invoice.get('customer')}")
        # Implement invoice payment failure handling logic
    
    async def _handle_subscription_event(self, event_type: str, data: Dict[str, Any]) -> None:
        """Handle subscription events."""
        subscription = data.get("object", {})
        self.logger.info(f"Subscription event {event_type}: {subscription.get('id')} - Status: {subscription.get('status')}")
        # Implement subscription event handling logic
    
    async def _handle_customer_event(self, event_type: str, data: Dict[str, Any]) -> None:
        """Handle customer events."""
        customer = data.get("object", {})
        self.logger.info(f"Customer event {event_type}: {customer.get('id')}")
        # Implement customer event handling logic
    
    async def _handle_dispute_created(self, data: Dict[str, Any]) -> None:
        """Handle dispute creation."""
        dispute = data.get("object", {})
        self.logger.info(f"Dispute created: {dispute.get('id')} - Charge: {dispute.get('charge')}")
        # Implement dispute handling logic
    
    async def _handle_review_opened(self, data: Dict[str, Any]) -> None:
        """Handle review opened for potential fraud."""
        review = data.get("object", {})
        self.logger.info(f"Review opened: {review.get('id')} - Reason: {review.get('reason')}")
        # Implement fraud review handling logic
    
    async def _handle_fraud_warning(self, data: Dict[str, Any]) -> None:
        """Handle early fraud warning."""
        warning = data.get("object", {})
        self.logger.info(f"Fraud warning: {warning.get('id')} - Charge: {warning.get('charge')}")
        # Implement fraud warning handling logic


# Export classes
__all__ = [
    "AdvancedStripe",
    "StripeConfig",
    "StripeWebhookHandler",
    "StripeEventType",
    "StripeCurrency",
    "StripeInterval",
    "StripePaymentMethodType",
    "Money",
    "CustomerRequest",
    "PaymentIntentRequest",
    "SubscriptionRequest",
    "ProductRequest",
    "PriceRequest",
    "InvoiceRequest",
    "RefundRequest"
]