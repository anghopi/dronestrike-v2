"""
Token Consumption Engine for DroneStrike v2
Comprehensive token management system based on the original Node.js system
"""

import logging
from decimal import Decimal
from datetime import datetime, timedelta
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum, Count, F, Q
from .models import TokenTransaction, UserProfile
from .user_roles import UserPermission

logger = logging.getLogger(__name__)


class TokenEngine:
    """
    Central token management system
    Handles all token operations with precise tracking like the original system
    """
    
    # Token costs from original Node.js system (Token Values.xlsx)
    ACTION_COSTS = {
        # Communication costs
        'sms_send': {'tokens': 2, 'token_type': 'regular'},
        'email_send': {'tokens': 1, 'token_type': 'regular'},
        'phone_call': {'tokens': 1, 'token_type': 'regular', 'per_minute': True},
        'postcard_send': {'tokens': 5, 'token_type': 'mail'},
        'letter_send': {'tokens': 3, 'token_type': 'mail'},
        
        # Property and lead operations
        'property_lookup': {'tokens': 1, 'token_type': 'regular'},
        'lead_export': {'tokens': 2, 'token_type': 'regular'},
        'address_verification': {'tokens': 1, 'token_type': 'regular'},
        'phone_verification': {'tokens': 2, 'token_type': 'regular'},
        
        # Advanced features (when AI is enabled)
        'lead_scoring': {'tokens': 1, 'token_type': 'regular'},
        'followup_generation': {'tokens': 3, 'token_type': 'regular'},
        'property_analysis': {'tokens': 2, 'token_type': 'regular'},
        'market_report': {'tokens': 5, 'token_type': 'regular'},
        
        # Data operations
        'csv_import_row': {'tokens': 0.1, 'token_type': 'regular'},  # Per row
        'bulk_email': {'tokens': 0.5, 'token_type': 'regular'},     # Per email in bulk
        'route_optimization': {'tokens': 2, 'token_type': 'regular'},
        
        # API operations
        'api_call_external': {'tokens': 1, 'token_type': 'regular'},
        'geocoding': {'tokens': 1, 'token_type': 'regular'},
        'reverse_geocoding': {'tokens': 1, 'token_type': 'regular'},
        
        # Special operations
        'mission_creation': {'tokens': 0, 'token_type': 'regular'},  # Free
        'lead_creation': {'tokens': 0, 'token_type': 'regular'},     # Free
    }
    
    # Token package pricing (from original system)
    TOKEN_PACKAGES = {
        'starter_1k': {
            'name': 'Starter Package',
            'regular_tokens': 1000,
            'mail_tokens': 0,
            'price': 10.00,
            'description': '1,000 regular tokens for communications and data'
        },
        'professional_5k': {
            'name': 'Professional Package',
            'regular_tokens': 5000,
            'mail_tokens': 100,
            'price': 40.00,
            'description': '5,000 regular tokens + 100 mail tokens'
        },
        'enterprise_15k': {
            'name': 'Enterprise Package',
            'regular_tokens': 15000,
            'mail_tokens': 500,
            'price': 100.00,
            'description': '15,000 regular tokens + 500 mail tokens'
        },
        'mail_only_100': {
            'name': 'Mail Tokens Only',
            'regular_tokens': 0,
            'mail_tokens': 100,
            'price': 80.00,
            'description': '100 mail tokens for postcards and letters'
        }
    }
    
    @classmethod
    def check_token_availability(cls, user, action_type: str, quantity: int = 1, 
                                duration_minutes: int = 0) -> tuple[bool, str, dict]:
        """
        Check if user has sufficient tokens for an action
        Returns: (has_tokens, message, cost_breakdown)
        """
        if action_type not in cls.ACTION_COSTS:
            return False, f"Unknown action type: {action_type}", {}
        
        action_config = cls.ACTION_COSTS[action_type]
        token_type = action_config['token_type']
        base_cost = action_config['tokens']
        
        # Calculate total cost
        if action_config.get('per_minute') and duration_minutes > 0:
            total_cost = base_cost * duration_minutes
        else:
            total_cost = base_cost * quantity
        
        # Round up to nearest integer for token consumption
        total_cost = int(total_cost) if total_cost == int(total_cost) else int(total_cost) + 1
        
        # Check user balance
        profile = user.profile
        available_tokens = profile.mail_tokens if token_type == 'mail' else profile.tokens
        
        cost_breakdown = {
            'action_type': action_type,
            'token_type': token_type,
            'base_cost': base_cost,
            'quantity': quantity,
            'duration_minutes': duration_minutes,
            'total_cost': total_cost,
            'available_tokens': available_tokens,
            'sufficient': available_tokens >= total_cost
        }
        
        if available_tokens >= total_cost:
            return True, f"Sufficient {token_type} tokens available", cost_breakdown
        else:
            deficit = total_cost - available_tokens
            return False, f"Insufficient {token_type} tokens. Need {total_cost}, have {available_tokens}, deficit: {deficit}", cost_breakdown
    
    @classmethod
    @transaction.atomic
    def consume_tokens(cls, user, action_type: str, quantity: int = 1, 
                      duration_minutes: int = 0, description: str = "", 
                      reference_id: str = "", lead=None) -> dict:
        """
        Consume tokens for an action with atomic transaction
        Returns: transaction_record
        """
        # Check availability first
        has_tokens, message, cost_breakdown = cls.check_token_availability(
            user, action_type, quantity, duration_minutes
        )
        
        if not has_tokens:
            raise ValueError(message)
        
        token_type = cost_breakdown['token_type']
        total_cost = cost_breakdown['total_cost']
        
        # Get current balance and update profile
        profile = user.profile
        if token_type == 'mail':
            tokens_before = profile.mail_tokens
            profile.mail_tokens -= total_cost
            tokens_after = profile.mail_tokens
        else:
            tokens_before = profile.tokens
            profile.tokens -= total_cost
            tokens_after = profile.tokens
        
        profile.save()
        
        # Create transaction record
        transaction_record = TokenTransaction.objects.create(
            user=user,
            token_type=token_type,
            transaction_type='consumption',
            action_type=action_type,
            tokens_before=tokens_before,
            tokens_changed=-total_cost,
            tokens_after=tokens_after,
            description=description or f"{action_type} - {quantity} unit(s)",
            reference_id=reference_id,
            lead=lead
        )
        
        logger.info(f"Consumed {total_cost} {token_type} tokens for {action_type}: {user.username}")
        
        return {
            'transaction_id': transaction_record.id,
            'tokens_consumed': total_cost,
            'token_type': token_type,
            'tokens_remaining': tokens_after,
            'action_type': action_type,
            'cost_breakdown': cost_breakdown
        }
    
    @classmethod
    @transaction.atomic
    def add_tokens(cls, user, token_type: str, amount: int, 
                  transaction_type: str = 'purchase', description: str = "",
                  stripe_payment_intent_id: str = "") -> dict:
        """
        Add tokens to user account
        """
        if token_type not in ['regular', 'mail']:
            raise ValueError(f"Invalid token type: {token_type}")
        
        profile = user.profile
        
        if token_type == 'mail':
            tokens_before = profile.mail_tokens
            profile.mail_tokens += amount
            tokens_after = profile.mail_tokens
        else:
            tokens_before = profile.tokens
            profile.tokens += amount
            tokens_after = profile.tokens
        
        profile.save()
        
        # Create transaction record
        transaction_record = TokenTransaction.objects.create(
            user=user,
            token_type=token_type,
            transaction_type=transaction_type,
            action_type='token_purchase',
            tokens_before=tokens_before,
            tokens_changed=amount,
            tokens_after=tokens_after,
            description=description or f"Added {amount} {token_type} tokens",
            stripe_payment_intent_id=stripe_payment_intent_id
        )
        
        logger.info(f"Added {amount} {token_type} tokens to {user.username}")
        
        return {
            'transaction_id': transaction_record.id,
            'tokens_added': amount,
            'token_type': token_type,
            'tokens_total': tokens_after,
            'transaction_type': transaction_type
        }
    
    @classmethod
    def get_user_token_summary(cls, user, days: int = 30) -> dict:
        """
        Get comprehensive token usage summary for user
        """
        since_date = timezone.now() - timedelta(days=days)
        
        # Get current balances
        profile = user.profile
        current_balance = {
            'regular_tokens': profile.tokens,
            'mail_tokens': profile.mail_tokens,
            'total_value': profile.tokens + (profile.mail_tokens * 0.8)  # Mail tokens worth $0.80 each
        }
        
        # Get transactions in period
        transactions = TokenTransaction.objects.filter(
            user=user,
            created_at__gte=since_date
        )
        
        # Aggregate by transaction type
        purchase_summary = transactions.filter(
            transaction_type__in=['purchase', 'subscription', 'bonus']
        ).aggregate(
            total_regular=Sum('tokens_changed', filter=Q(token_type='regular', tokens_changed__gt=0)) or 0,
            total_mail=Sum('tokens_changed', filter=Q(token_type='mail', tokens_changed__gt=0)) or 0,
            purchase_count=Count('id')
        )
        
        consumption_summary = transactions.filter(
            transaction_type='consumption'
        ).aggregate(
            total_regular=Sum('tokens_changed', filter=Q(token_type='regular')) or 0,
            total_mail=Sum('tokens_changed', filter=Q(token_type='mail')) or 0,
            consumption_count=Count('id')
        )
        
        # Top consuming actions
        top_actions = transactions.filter(
            transaction_type='consumption'
        ).values('action_type').annotate(
            total_consumed=Sum('tokens_changed'),
            usage_count=Count('id')
        ).order_by('total_consumed')[:5]  # Most negative (highest consumption)
        
        # Daily usage breakdown
        daily_usage = transactions.filter(
            transaction_type='consumption'
        ).extra(
            select={'day': 'date(created_at)'}
        ).values('day').annotate(
            regular_tokens=Sum('tokens_changed', filter=Q(token_type='regular')) or 0,
            mail_tokens=Sum('tokens_changed', filter=Q(token_type='mail')) or 0
        ).order_by('day')
        
        return {
            'current_balance': current_balance,
            'period_days': days,
            'period_summary': {
                'tokens_purchased': {
                    'regular': purchase_summary['total_regular'],
                    'mail': purchase_summary['total_mail'],
                    'purchase_count': purchase_summary['purchase_count']
                },
                'tokens_consumed': {
                    'regular': abs(consumption_summary['total_regular']),
                    'mail': abs(consumption_summary['total_mail']),
                    'consumption_count': consumption_summary['consumption_count']
                }
            },
            'top_consuming_actions': list(top_actions),
            'daily_usage': list(daily_usage)
        }
    
    @classmethod
    def estimate_action_cost(cls, action_type: str, quantity: int = 1, 
                           duration_minutes: int = 0) -> dict:
        """
        Estimate cost for an action without consuming tokens
        """
        if action_type not in cls.ACTION_COSTS:
            return {'error': f"Unknown action type: {action_type}"}
        
        action_config = cls.ACTION_COSTS[action_type]
        token_type = action_config['token_type']
        base_cost = action_config['tokens']
        
        if action_config.get('per_minute') and duration_minutes > 0:
            total_cost = base_cost * duration_minutes
        else:
            total_cost = base_cost * quantity
        
        # Round up to nearest integer
        total_cost = int(total_cost) if total_cost == int(total_cost) else int(total_cost) + 1
        
        return {
            'action_type': action_type,
            'token_type': token_type,
            'base_cost': base_cost,
            'quantity': quantity,
            'duration_minutes': duration_minutes,
            'estimated_cost': total_cost,
            'cost_in_dollars': total_cost * (0.80 if token_type == 'mail' else 0.01)
        }
    
    @classmethod
    def get_low_token_users(cls, regular_threshold: int = 100, 
                           mail_threshold: int = 10) -> list:
        """
        Get users with low token balances for notification
        """
        low_token_users = UserProfile.objects.filter(
            Q(tokens__lt=regular_threshold) | 
            Q(mail_tokens__lt=mail_threshold)
        ).select_related('user')
        
        users_data = []
        for profile in low_token_users:
            users_data.append({
                'user_id': profile.user.id,
                'username': profile.user.username,
                'email': profile.user.email,
                'regular_tokens': profile.tokens,
                'mail_tokens': profile.mail_tokens,
                'needs_regular': profile.tokens < regular_threshold,
                'needs_mail': profile.mail_tokens < mail_threshold,
                'recommended_package': cls._recommend_token_package(profile)
            })
        
        return users_data
    
    @classmethod
    def _recommend_token_package(cls, profile) -> str:
        """
        Recommend appropriate token package based on usage
        """
        if profile.tokens < 100 and profile.mail_tokens < 10:
            return 'professional_5k'
        elif profile.tokens < 100:
            return 'starter_1k'
        elif profile.mail_tokens < 10:
            return 'mail_only_100'
        else:
            return 'starter_1k'
    
    @classmethod
    def refund_tokens(cls, user, transaction_id: int, reason: str = "") -> dict:
        """
        Refund tokens from a previous transaction
        """
        try:
            original_transaction = TokenTransaction.objects.get(
                id=transaction_id,
                user=user,
                transaction_type='consumption'
            )
        except TokenTransaction.DoesNotExist:
            raise ValueError("Transaction not found or not refundable")
        
        # Can only refund within 24 hours
        if timezone.now() - original_transaction.created_at > timedelta(hours=24):
            raise ValueError("Refund period has expired (24 hours)")
        
        # Refund the tokens
        refund_amount = abs(original_transaction.tokens_changed)
        return cls.add_tokens(
            user=user,
            token_type=original_transaction.token_type,
            amount=refund_amount,
            transaction_type='refund',
            description=f"Refund for transaction {transaction_id}: {reason}",
        )


# Decorator for token-gated views
def requires_tokens(action_type: str, quantity: int = 1):
    """
    Decorator to require tokens for a view
    """
    def decorator(view_func):
        def wrapper(request, *args, **kwargs):
            user = request.user
            if not user.is_authenticated:
                from django.http import JsonResponse
                return JsonResponse({'error': 'Authentication required'}, status=401)
            
            # Check token availability
            has_tokens, message, cost_breakdown = TokenEngine.check_token_availability(
                user, action_type, quantity
            )
            
            if not has_tokens:
                from django.http import JsonResponse
                return JsonResponse({
                    'error': 'Insufficient tokens',
                    'message': message,
                    'cost_breakdown': cost_breakdown
                }, status=402)  # Payment Required
            
            # Add cost breakdown to request for the view to use
            request.token_cost_breakdown = cost_breakdown
            
            return view_func(request, *args, **kwargs)
        
        return wrapper
    return decorator


# Token management service instance
token_engine = TokenEngine()