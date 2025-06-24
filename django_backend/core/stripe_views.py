"""
Stripe integration for token purchasing system
Based on Token Values.xlsx pricing structure
"""
import stripe
import json
from decimal import Decimal
from django.conf import settings
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.views import View
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import (
    TokenTransaction, TokenPackagePurchase, SubscriptionPlan, 
    UserSubscription, LeadPackagePurchase, UserProfile
)
from .stripe_config import TOKEN_PRICING

# Initialize Stripe with your secret key
stripe.api_key = settings.STRIPE_SECRET_KEY if hasattr(settings, 'STRIPE_SECRET_KEY') else 'sk_test_...'

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_token_packages(request):
    """Get available token packages"""
    return Response({
        'regular_token_price': TOKEN_PRICING['regular_token_price'],
        'mail_token_price': TOKEN_PRICING['mail_token_price'],
        'packages': TOKEN_PRICING['packages'],
        'lead_packages': TOKEN_PRICING['lead_packages'],
        'subscriptions': TOKEN_PRICING['subscriptions'],
        'feature_costs': TOKEN_PRICING['feature_costs']
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_token_balance(request):
    """Get user's current token balance"""
    user_profile = request.user.profile
    
    # Calculate token balances from transactions
    regular_balance = sum(
        transaction.tokens_changed for transaction in 
        TokenTransaction.objects.filter(user=request.user, token_type='regular')
    )
    
    mail_balance = sum(
        transaction.tokens_changed for transaction in 
        TokenTransaction.objects.filter(user=request.user, token_type='mail')
    )
    
    return Response({
        'regular_tokens': regular_balance,
        'mail_tokens': mail_balance,
        'profile_tokens': user_profile.tokens,
        'profile_mail_tokens': user_profile.mail_tokens
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_token_purchase_intent(request):
    """Create Stripe PaymentIntent for token purchase"""
    try:
        data = request.data
        package_name = data.get('package_name')
        custom_amount = data.get('custom_amount')  # For custom token purchases
        
        if package_name:
            # Find package in config
            package = None
            for pkg in TOKEN_PRICING['packages']:
                if pkg['name'] == package_name:
                    package = pkg
                    break
            
            if not package:
                return Response({
                    'error': 'Package not found'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            amount_cents = int(package['price'] * 100)
            description = f"DroneStrike Token Package: {package['name']}"
            
        elif custom_amount:
            # Custom token purchase
            amount_cents = int(float(custom_amount) * 100)
            description = f"DroneStrike Custom Token Purchase: ${custom_amount}"
            package = {
                'name': 'Custom Token Purchase',
                'price': float(custom_amount),
                'regular_tokens': int(float(custom_amount) / TOKEN_PRICING['regular_token_price']),
                'mail_tokens': 0
            }
        else:
            return Response({
                'error': 'Package name or custom amount required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create or get Stripe customer
        user_profile = request.user.profile
        if not user_profile.stripe_customer_id:
            customer = stripe.Customer.create(
                email=request.user.email,
                metadata={
                    'user_id': request.user.id,
                    'username': request.user.username
                }
            )
            user_profile.stripe_customer_id = customer.id
            user_profile.save()
        
        # Create PaymentIntent
        payment_intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency='usd',
            customer=user_profile.stripe_customer_id,
            metadata={
                'user_id': request.user.id,
                'package_name': package['name'],
                'regular_tokens': package['regular_tokens'],
                'mail_tokens': package['mail_tokens'],
                'type': 'token_purchase'
            },
            description=description
        )
        
        # Create purchase record
        purchase = TokenPackagePurchase.objects.create(
            user=request.user,
            package_name=package['name'],
            regular_tokens=package['regular_tokens'],
            mail_tokens=package['mail_tokens'],
            total_price=package['price'],
            stripe_payment_intent_id=payment_intent.id,
            stripe_customer_id=user_profile.stripe_customer_id,
            payment_status='pending'
        )
        
        return Response({
            'client_secret': payment_intent.client_secret,
            'purchase_id': purchase.id,
            'amount': package['price'],
            'package': package
        })
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_subscription_intent(request):
    """Create Stripe subscription for monthly plans"""
    try:
        data = request.data
        plan_name = data.get('plan_name', 'DroneStrike Professional')
        discount_code = data.get('discount_code')
        
        # Get subscription plan
        subscription_config = TOKEN_PRICING['subscriptions'][0]  # Currently only one plan
        
        user_profile = request.user.profile
        if not user_profile.stripe_customer_id:
            customer = stripe.Customer.create(
                email=request.user.email,
                metadata={
                    'user_id': request.user.id,
                    'username': request.user.username
                }
            )
            user_profile.stripe_customer_id = customer.id
            user_profile.save()
        
        # Create price if not exists (you'd normally do this in Stripe dashboard)
        price_id = subscription_config.get('stripe_price_id')
        if not price_id:
            price = stripe.Price.create(
                unit_amount=int(subscription_config['price_monthly'] * 100),
                currency='usd',
                recurring={'interval': 'month'},
                product_data={
                    'name': subscription_config['name'],
                    'description': subscription_config['description']
                }
            )
            price_id = price.id
        
        # Apply discount if valid
        coupon_id = None
        if discount_code:
            if discount_code.upper() == '5STARGENERAL':
                # Create 50% off forever coupon
                coupon = stripe.Coupon.create(
                    percent_off=50,
                    duration='forever',
                    id=f'5star_{request.user.id}',
                    metadata={'discount_type': 'five_star_general'}
                )
                coupon_id = coupon.id
            elif discount_code.upper() == 'INFANTRY':
                # Create 50% off 3 months coupon
                coupon = stripe.Coupon.create(
                    percent_off=50,
                    duration='repeating',
                    duration_in_months=3,
                    id=f'infantry_{request.user.id}',
                    metadata={'discount_type': 'infantry'}
                )
                coupon_id = coupon.id
        
        # Create subscription
        subscription_params = {
            'customer': user_profile.stripe_customer_id,
            'items': [{'price': price_id}],
            'payment_behavior': 'default_incomplete',
            'expand': ['latest_invoice.payment_intent'],
            'metadata': {
                'user_id': request.user.id,
                'plan_name': plan_name,
                'type': 'subscription'
            }
        }
        
        if coupon_id:
            subscription_params['coupon'] = coupon_id
        
        subscription = stripe.Subscription.create(**subscription_params)
        
        return Response({
            'subscription_id': subscription.id,
            'client_secret': subscription.latest_invoice.payment_intent.client_secret,
            'plan': subscription_config,
            'discount_applied': coupon_id is not None
        })
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@csrf_exempt
def stripe_webhook(request):
    """Handle Stripe webhooks for payment confirmations"""
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    endpoint_secret = getattr(settings, 'STRIPE_WEBHOOK_SECRET', 'whsec_...')
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, endpoint_secret
        )
    except ValueError:
        return HttpResponse(status=400)
    except stripe.error.SignatureVerificationError:
        return HttpResponse(status=400)
    
    # Handle the event
    if event['type'] == 'payment_intent.succeeded':
        payment_intent = event['data']['object']
        handle_token_purchase_success(payment_intent)
    
    elif event['type'] == 'invoice.payment_succeeded':
        invoice = event['data']['object']
        handle_subscription_payment_success(invoice)
    
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        handle_subscription_cancelled(subscription)
    
    return HttpResponse(status=200)

def handle_token_purchase_success(payment_intent):
    """Handle successful token purchase"""
    try:
        purchase = TokenPackagePurchase.objects.get(
            stripe_payment_intent_id=payment_intent['id']
        )
        purchase.payment_status = 'succeeded'
        purchase.save()
        
        # Credit tokens to user
        user = purchase.user
        
        if purchase.regular_tokens > 0:
            TokenTransaction.objects.create(
                user=user,
                token_type='regular',
                transaction_type='purchase',
                tokens_before=user.profile.tokens,
                tokens_changed=purchase.regular_tokens,
                tokens_after=user.profile.tokens + purchase.regular_tokens,
                total_cost=purchase.total_price,
                description=f'Token purchase: {purchase.package_name}',
                stripe_payment_intent_id=payment_intent['id']
            )
            user.profile.tokens += purchase.regular_tokens
        
        if purchase.mail_tokens > 0:
            TokenTransaction.objects.create(
                user=user,
                token_type='mail',
                transaction_type='purchase',
                tokens_before=user.profile.mail_tokens,
                tokens_changed=purchase.mail_tokens,
                tokens_after=user.profile.mail_tokens + purchase.mail_tokens,
                total_cost=purchase.total_price,
                description=f'Mail token purchase: {purchase.package_name}',
                stripe_payment_intent_id=payment_intent['id']
            )
            user.profile.mail_tokens += purchase.mail_tokens
        
        user.profile.save()
        
    except TokenPackagePurchase.DoesNotExist:
        pass

def handle_subscription_payment_success(invoice):
    """Handle successful subscription payment"""
    # Implementation for subscription handling
    pass

def handle_subscription_cancelled(subscription):
    """Handle subscription cancellation"""
    # Implementation for subscription cancellation
    pass

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_purchase_history(request):
    """Get user's purchase history"""
    purchases = TokenPackagePurchase.objects.filter(user=request.user).order_by('-created_at')
    transactions = TokenTransaction.objects.filter(user=request.user).order_by('-created_at')
    
    purchase_data = []
    for purchase in purchases:
        purchase_data.append({
            'id': purchase.id,
            'type': 'package_purchase',
            'package_name': purchase.package_name,
            'regular_tokens': purchase.regular_tokens,
            'mail_tokens': purchase.mail_tokens,
            'total_price': str(purchase.total_price),
            'payment_status': purchase.payment_status,
            'created_at': purchase.created_at.isoformat()
        })
    
    transaction_data = []
    for transaction in transactions:
        transaction_data.append({
            'id': transaction.id,
            'type': 'transaction',
            'token_type': transaction.token_type,
            'transaction_type': transaction.transaction_type,
            'tokens_changed': transaction.tokens_changed,
            'description': transaction.description,
            'created_at': transaction.created_at.isoformat()
        })
    
    return Response({
        'purchases': purchase_data,
        'transactions': transaction_data
    })