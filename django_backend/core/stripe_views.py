"""
Stripe integration for token purchasing system
Based on Token Values.xlsx pricing structure
"""
import stripe
import json
from decimal import Decimal
from datetime import timedelta
from django.conf import settings
from django.utils import timezone
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
stripe.api_key = settings.STRIPE_SECRET_KEY

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
        'regular_tokens': user_profile.tokens,
        'mail_tokens': user_profile.mail_tokens,
        'last_updated': user_profile.updated_at.isoformat() if hasattr(user_profile, 'updated_at') else timezone.now().isoformat()
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
    import logging
    logger = logging.getLogger(__name__)
    
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    endpoint_secret = settings.STRIPE_WEBHOOK_SECRET
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, endpoint_secret
        )
        logger.info(f"Stripe webhook received: {event['type']}")
    except ValueError as e:
        logger.error(f"Invalid payload in Stripe webhook: {e}")
        return HttpResponse(status=400)
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Invalid signature in Stripe webhook: {e}")
        return HttpResponse(status=400)
    
    # Handle the event
    try:
        if event['type'] == 'payment_intent.succeeded':
            payment_intent = event['data']['object']
            logger.info(f"Processing payment_intent.succeeded: {payment_intent['id']}")
            handle_token_purchase_success(payment_intent)
        
        elif event['type'] == 'invoice.payment_succeeded':
            invoice = event['data']['object']
            logger.info(f"Processing invoice.payment_succeeded: {invoice['id']}")
            handle_subscription_payment_success(invoice)
        
        elif event['type'] == 'customer.subscription.deleted':
            subscription = event['data']['object']
            logger.info(f"Processing customer.subscription.deleted: {subscription['id']}")
            handle_subscription_cancelled(subscription)
        
        else:
            logger.info(f"Unhandled webhook event type: {event['type']}")
    
    except Exception as e:
        logger.error(f"Error processing Stripe webhook {event['type']}: {e}")
        return HttpResponse(status=500)
    
    return HttpResponse(status=200)

def handle_token_purchase_success(payment_intent):
    """Handle successful token purchase"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        purchase = TokenPackagePurchase.objects.get(
            stripe_payment_intent_id=payment_intent['id']
        )
        
        # Prevent double processing
        if purchase.payment_status == 'succeeded':
            logger.info(f"Payment {payment_intent['id']} already processed, skipping")
            return
        
        purchase.payment_status = 'succeeded'
        purchase.save()
        
        # Credit tokens to user
        user = purchase.user
        logger.info(f"Crediting tokens to user {user.id} for purchase {purchase.id}")
        
        if purchase.regular_tokens > 0:
            tokens_before = user.profile.tokens
            TokenTransaction.objects.create(
                user=user,
                token_type='regular',
                transaction_type='purchase',
                tokens_before=tokens_before,
                tokens_changed=purchase.regular_tokens,
                tokens_after=tokens_before + purchase.regular_tokens,
                total_cost=purchase.total_price,
                description=f'Token purchase: {purchase.package_name}',
                stripe_payment_intent_id=payment_intent['id']
            )
            user.profile.tokens += purchase.regular_tokens
            logger.info(f"Added {purchase.regular_tokens} regular tokens to user {user.id}")
        
        if purchase.mail_tokens > 0:
            mail_tokens_before = user.profile.mail_tokens
            TokenTransaction.objects.create(
                user=user,
                token_type='mail',
                transaction_type='purchase',
                tokens_before=mail_tokens_before,
                tokens_changed=purchase.mail_tokens,
                tokens_after=mail_tokens_before + purchase.mail_tokens,
                total_cost=purchase.total_price,
                description=f'Mail token purchase: {purchase.package_name}',
                stripe_payment_intent_id=payment_intent['id']
            )
            user.profile.mail_tokens += purchase.mail_tokens
            logger.info(f"Added {purchase.mail_tokens} mail tokens to user {user.id}")
        
        user.profile.save()
        logger.info(f"Successfully processed token purchase for user {user.id}")
        
    except TokenPackagePurchase.DoesNotExist:
        logger.error(f"TokenPackagePurchase not found for payment_intent: {payment_intent['id']}")
    except Exception as e:
        logger.error(f"Error processing token purchase success: {e}")
        raise

def handle_subscription_payment_success(invoice):
    """Handle successful subscription payment"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Get customer and user
        customer_id = invoice['customer']
        subscription_id = invoice['subscription']
        
        user_profile = UserProfile.objects.get(stripe_customer_id=customer_id)
        user = user_profile.user
        
        logger.info(f"Processing subscription payment for user {user.id}")
        
        # Get or create subscription record
        user_subscription, created = UserSubscription.objects.get_or_create(
            user=user,
            stripe_subscription_id=subscription_id,
            defaults={
                'plan_name': 'DroneStrike Professional',
                'status': 'active',
                'current_period_start': timezone.now(),
                'current_period_end': timezone.now() + timedelta(days=30)
            }
        )
        
        if not created:
            # Update existing subscription
            user_subscription.status = 'active'
            user_subscription.current_period_start = timezone.now()
            user_subscription.current_period_end = timezone.now() + timedelta(days=30)
            user_subscription.save()
        
        # Update user profile subscription status
        user_profile.monthly_subscription_active = True
        user_profile.save()
        
        # Record subscription payment transaction
        TokenTransaction.objects.create(
            user=user,
            token_type='subscription',
            transaction_type='subscription_payment',
            tokens_before=0,
            tokens_changed=0,
            tokens_after=0,
            total_cost=invoice['amount_paid'] / 100,  # Convert from cents
            description=f'Subscription payment for {user_subscription.plan_name}',
            stripe_invoice_id=invoice['id']
        )
        
        logger.info(f"Successfully processed subscription payment for user {user.id}")
        
    except UserProfile.DoesNotExist:
        logger.error(f"UserProfile not found for customer: {customer_id}")
    except Exception as e:
        logger.error(f"Error processing subscription payment: {e}")
        raise

def handle_subscription_cancelled(subscription):
    """Handle subscription cancellation"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        customer_id = subscription['customer']
        subscription_id = subscription['id']
        
        user_profile = UserProfile.objects.get(stripe_customer_id=customer_id)
        user = user_profile.user
        
        logger.info(f"Processing subscription cancellation for user {user.id}")
        
        # Update subscription record
        try:
            user_subscription = UserSubscription.objects.get(
                user=user,
                stripe_subscription_id=subscription_id
            )
            user_subscription.status = 'cancelled'
            user_subscription.cancelled_at = timezone.now()
            user_subscription.save()
        except UserSubscription.DoesNotExist:
            logger.warning(f"UserSubscription not found for subscription {subscription_id}")
        
        # Update user profile
        user_profile.monthly_subscription_active = False
        user_profile.save()
        
        # Record cancellation transaction
        TokenTransaction.objects.create(
            user=user,
            token_type='subscription',
            transaction_type='subscription_cancelled',
            tokens_before=0,
            tokens_changed=0,
            tokens_after=0,
            total_cost=0,
            description='Subscription cancelled',
            stripe_subscription_id=subscription_id
        )
        
        logger.info(f"Successfully processed subscription cancellation for user {user.id}")
        
    except UserProfile.DoesNotExist:
        logger.error(f"UserProfile not found for customer: {customer_id}")
    except Exception as e:
        logger.error(f"Error processing subscription cancellation: {e}")
        raise

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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_subscription(request):
    """Get user's current subscription status"""
    try:
        user_subscription = UserSubscription.objects.filter(
            user=request.user,
            status='active'
        ).first()
        
        if user_subscription:
            return Response({
                'subscription': {
                    'id': user_subscription.id,
                    'plan_name': user_subscription.plan_name,
                    'status': user_subscription.status,
                    'current_period_start': user_subscription.current_period_start.isoformat(),
                    'current_period_end': user_subscription.current_period_end.isoformat(),
                    'stripe_subscription_id': user_subscription.stripe_subscription_id
                },
                'has_subscription': True
            })
        else:
            return Response({
                'subscription': None,
                'has_subscription': False
            })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_subscription(request):
    """Cancel user's subscription"""
    try:
        user_subscription = UserSubscription.objects.filter(
            user=request.user,
            status='active'
        ).first()
        
        if not user_subscription:
            return Response({'error': 'No active subscription found'}, 
                          status=status.HTTP_404_NOT_FOUND)
        
        # Cancel in Stripe
        stripe.Subscription.delete(user_subscription.stripe_subscription_id)
        
        # Update local record
        user_subscription.status = 'cancelled'
        user_subscription.cancelled_at = timezone.now()
        user_subscription.save()
        
        # Update user profile
        request.user.profile.monthly_subscription_active = False
        request.user.profile.save()
        
        return Response({
            'success': True,
            'message': 'Subscription cancelled successfully'
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reactivate_subscription(request):
    """Reactivate a cancelled subscription"""
    try:
        # Get the last subscription for the user
        user_subscription = UserSubscription.objects.filter(
            user=request.user
        ).order_by('-created_at').first()
        
        if not user_subscription:
            return Response({'error': 'No subscription history found'}, 
                          status=status.HTTP_404_NOT_FOUND)
        
        # Create new subscription with same plan
        data = request.data
        plan_name = data.get('plan_name', 'DroneStrike Professional')
        
        # This would use the same logic as create_subscription_intent
        # For now, redirect to subscription creation
        return Response({
            'message': 'Please create a new subscription',
            'redirect_to_subscription': True
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_payment_method(request):
    """Update subscription payment method"""
    try:
        data = request.data
        payment_method_id = data.get('payment_method_id')
        
        if not payment_method_id:
            return Response({'error': 'Payment method ID required'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        user_profile = request.user.profile
        if not user_profile.stripe_customer_id:
            return Response({'error': 'No Stripe customer found'}, 
                          status=status.HTTP_404_NOT_FOUND)
        
        # Attach payment method to customer
        stripe.PaymentMethod.attach(
            payment_method_id,
            customer=user_profile.stripe_customer_id
        )
        
        # Set as default payment method
        stripe.Customer.modify(
            user_profile.stripe_customer_id,
            invoice_settings={'default_payment_method': payment_method_id}
        )
        
        return Response({
            'success': True,
            'message': 'Payment method updated successfully'
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_billing_portal_url(request):
    """Get Stripe customer portal URL for subscription management"""
    try:
        user_profile = request.user.profile
        if not user_profile.stripe_customer_id:
            return Response({'error': 'No Stripe customer found'}, 
                          status=status.HTTP_404_NOT_FOUND)
        
        # Create billing portal session
        session = stripe.billing_portal.Session.create(
            customer=user_profile.stripe_customer_id,
            return_url=request.build_absolute_uri('/dashboard/')
        )
        
        return Response({
            'portal_url': session.url
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)