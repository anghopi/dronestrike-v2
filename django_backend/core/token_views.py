"""
Token management API views for DroneStrike v2
Advanced token operations and analytics
"""

import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import TokenTransaction
from .token_engine import TokenEngine, requires_tokens
from .user_roles import UserPermission


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def token_balance_detailed_api(request):
    """Get detailed token balance and analytics"""
    days = int(request.GET.get('days', 30))
    
    summary = TokenEngine.get_user_token_summary(request.user, days)
    
    return Response(summary)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def token_transactions_api(request):
    """Get user's token transaction history"""
    page = int(request.GET.get('page', 1))
    limit = int(request.GET.get('limit', 50))
    transaction_type = request.GET.get('type', '')
    token_type = request.GET.get('token_type', '')
    
    # Base queryset
    queryset = TokenTransaction.objects.filter(user=request.user)
    
    # Apply filters
    if transaction_type:
        queryset = queryset.filter(transaction_type=transaction_type)
    if token_type:
        queryset = queryset.filter(token_type=token_type)
    
    # Paginate
    paginator = Paginator(queryset.order_by('-created_at'), limit)
    page_obj = paginator.get_page(page)
    
    # Serialize transactions
    transactions_data = []
    for tx in page_obj:
        transactions_data.append({
            'id': tx.id,
            'token_type': tx.token_type,
            'transaction_type': tx.transaction_type,
            'action_type': tx.action_type,
            'tokens_before': tx.tokens_before,
            'tokens_changed': tx.tokens_changed,
            'tokens_after': tx.tokens_after,
            'description': tx.description,
            'cost_per_token': str(tx.cost_per_token) if tx.cost_per_token else None,
            'total_cost': str(tx.total_cost) if tx.total_cost else None,
            'reference_id': tx.reference_id,
            'lead_id': tx.lead.id if tx.lead else None,
            'lead_name': f"{tx.lead.first_name} {tx.lead.last_name}" if tx.lead else None,
            'created_at': tx.created_at.isoformat(),
        })
    
    return Response({
        'transactions': transactions_data,
        'pagination': {
            'page': page,
            'pages': paginator.num_pages,
            'per_page': limit,
            'total': paginator.count,
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def token_packages_api(request):
    """Get available token packages"""
    packages = []
    for package_id, package_info in TokenEngine.TOKEN_PACKAGES.items():
        packages.append({
            'id': package_id,
            **package_info
        })
    
    return Response({
        'packages': packages,
        'current_balance': {
            'regular_tokens': request.user.profile.tokens,
            'mail_tokens': request.user.profile.mail_tokens,
        }
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def estimate_token_cost_api(request):
    """Estimate token cost for an action"""
    try:
        data = json.loads(request.body)
        
        action_type = data.get('action_type')
        quantity = data.get('quantity', 1)
        duration_minutes = data.get('duration_minutes', 0)
        
        if not action_type:
            return Response({'error': 'action_type is required'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        estimate = TokenEngine.estimate_action_cost(
            action_type, quantity, duration_minutes
        )
        
        if 'error' in estimate:
            return Response(estimate, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user has sufficient tokens
        has_tokens, message, cost_breakdown = TokenEngine.check_token_availability(
            request.user, action_type, quantity, duration_minutes
        )
        
        estimate.update({
            'user_can_afford': has_tokens,
            'availability_message': message,
            'user_balance': {
                'regular_tokens': request.user.profile.tokens,
                'mail_tokens': request.user.profile.mail_tokens,
            }
        })
        
        return Response(estimate)
    
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def consume_tokens_api(request):
    """Manually consume tokens for an action"""
    try:
        data = json.loads(request.body)
        
        action_type = data.get('action_type')
        quantity = data.get('quantity', 1)
        duration_minutes = data.get('duration_minutes', 0)
        description = data.get('description', '')
        reference_id = data.get('reference_id', '')
        lead_id = data.get('lead_id')
        
        if not action_type:
            return Response({'error': 'action_type is required'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        # Get lead if provided
        lead = None
        if lead_id:
            from .models import Lead
            try:
                lead = Lead.objects.get(id=lead_id)
            except Lead.DoesNotExist:
                return Response({'error': 'Lead not found'}, 
                               status=status.HTTP_404_NOT_FOUND)
        
        # Consume tokens
        try:
            result = TokenEngine.consume_tokens(
                user=request.user,
                action_type=action_type,
                quantity=quantity,
                duration_minutes=duration_minutes,
                description=description,
                reference_id=reference_id,
                lead=lead
            )
            
            return Response({
                'message': 'Tokens consumed successfully',
                'result': result
            }, status=status.HTTP_201_CREATED)
        
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_tokens_api(request):
    """Add tokens to user account (admin only)"""
    # Check admin permission
    if not request.user.profile.has_permission(UserPermission.CAN_MANAGE_USERS):
        return Response({'error': 'Admin permission required'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        data = json.loads(request.body)
        
        target_user_id = data.get('user_id')
        token_type = data.get('token_type')
        amount = data.get('amount')
        description = data.get('description', '')
        
        if not all([target_user_id, token_type, amount]):
            return Response({'error': 'user_id, token_type, and amount are required'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        # Get target user
        from django.contrib.auth.models import User
        try:
            target_user = User.objects.get(id=target_user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, 
                           status=status.HTTP_404_NOT_FOUND)
        
        # Add tokens
        result = TokenEngine.add_tokens(
            user=target_user,
            token_type=token_type,
            amount=int(amount),
            transaction_type='bonus',
            description=description or f"Admin credit by {request.user.username}"
        )
        
        return Response({
            'message': 'Tokens added successfully',
            'result': result
        }, status=status.HTTP_201_CREATED)
    
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def refund_tokens_api(request):
    """Refund tokens from a transaction"""
    try:
        data = json.loads(request.body)
        
        transaction_id = data.get('transaction_id')
        reason = data.get('reason', '')
        
        if not transaction_id:
            return Response({'error': 'transaction_id is required'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        # Refund tokens
        try:
            result = TokenEngine.refund_tokens(
                user=request.user,
                transaction_id=int(transaction_id),
                reason=reason
            )
            
            return Response({
                'message': 'Tokens refunded successfully',
                'result': result
            }, status=status.HTTP_201_CREATED)
        
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def token_analytics_api(request):
    """Get comprehensive token analytics"""
    # Only managers and admins can view system analytics
    if not request.user.profile.has_permission(UserPermission.CAN_VIEW_TOKEN_ANALYTICS):
        return Response({'error': 'No permission to view token analytics'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    from django.contrib.auth.models import User
    from django.db.models import Sum, Count, Avg, Q
    
    # Get low token users
    low_token_users = TokenEngine.get_low_token_users()
    
    # Overall system statistics
    total_users = User.objects.count()
    total_transactions = TokenTransaction.objects.count()
    
    # Token distribution
    token_stats = TokenTransaction.objects.aggregate(
        total_purchased=Sum('tokens_changed', filter=Q(transaction_type='purchase', tokens_changed__gt=0)),
        total_consumed=Sum('tokens_changed', filter=Q(transaction_type='consumption')),
        avg_transaction=Avg('tokens_changed')
    )
    
    # Top consuming actions
    top_actions = TokenTransaction.objects.filter(
        transaction_type='consumption'
    ).values('action_type').annotate(
        total_consumed=Sum('tokens_changed'),
        usage_count=Count('id'),
        avg_cost=Avg('tokens_changed')
    ).order_by('total_consumed')[:10]
    
    # Monthly trends (last 12 months)
    from datetime import timedelta
    monthly_data = []
    for i in range(12):
        month_start = timezone.now().replace(day=1) - timedelta(days=30*i)
        month_end = month_start + timedelta(days=30)
        
        month_stats = TokenTransaction.objects.filter(
            created_at__gte=month_start,
            created_at__lt=month_end
        ).aggregate(
            purchases=Sum('tokens_changed', filter=Q(transaction_type='purchase', tokens_changed__gt=0)),
            consumption=Sum('tokens_changed', filter=Q(transaction_type='consumption')),
            transaction_count=Count('id')
        )
        
        monthly_data.append({
            'month': month_start.strftime('%Y-%m'),
            'purchases': month_stats['purchases'] or 0,
            'consumption': abs(month_stats['consumption']) if month_stats['consumption'] else 0,
            'transaction_count': month_stats['transaction_count'] or 0
        })
    
    return Response({
        'system_overview': {
            'total_users': total_users,
            'total_transactions': total_transactions,
            'low_token_users_count': len(low_token_users),
            'total_tokens_purchased': token_stats['total_purchased'] or 0,
            'total_tokens_consumed': abs(token_stats['total_consumed']) if token_stats['total_consumed'] else 0,
        },
        'low_token_users': low_token_users,
        'top_consuming_actions': list(top_actions),
        'monthly_trends': monthly_data[::-1],  # Reverse to show oldest first
        'available_packages': list(TokenEngine.TOKEN_PACKAGES.keys()),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def action_costs_api(request):
    """Get all available action types and their costs"""
    action_costs = []
    for action_type, config in TokenEngine.ACTION_COSTS.items():
        action_costs.append({
            'action_type': action_type,
            'base_cost': config['tokens'],
            'token_type': config['token_type'],
            'per_minute': config.get('per_minute', False),
            'cost_in_dollars': config['tokens'] * (0.80 if config['token_type'] == 'mail' else 0.01)
        })
    
    return Response({
        'action_costs': action_costs,
        'user_balance': {
            'regular_tokens': request.user.profile.tokens,
            'mail_tokens': request.user.profile.mail_tokens,
        }
    })


# Example of using the token decorator
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@requires_tokens('property_lookup', 1)
def property_lookup_api(request):
    """Example API that requires tokens"""
    try:
        # Consume the tokens (decorator already checked availability)
        result = TokenEngine.consume_tokens(
            user=request.user,
            action_type='property_lookup',
            quantity=1,
            description="Property lookup via API"
        )
        
        # Perform the actual property lookup here
        # ... property lookup logic ...
        
        return Response({
            'message': 'Property lookup completed',
            'token_usage': result,
            'property_data': {
                'address': '123 Example St',
                'value': 150000,
                'taxes_due': 2500
            }
        })
    
    except ValueError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)