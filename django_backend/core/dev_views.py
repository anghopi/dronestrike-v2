"""
Development Views for Testing Real Data
Temporary endpoints for development without authentication
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db.models import Q, Count, Sum, Avg
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from .models import (
    TLCClient, TLCClientAddress, TLCTaxInfo, TLCPropertyValuation,
    TokenTransaction, UserProfile, Mission, MissionRoute, Device, MissionDeclineReason, Lead
)
from .serializers import TLCClientSerializer, MissionSerializer, DeviceSerializer
from .stripe_config import TOKEN_PRICING
from .services import TokenService


@api_view(['GET'])
@permission_classes([AllowAny])
def dev_tlc_clients_list(request):
    """
    Development endpoint for TLC clients - no authentication required
    """
    try:
        # Get query parameters
        page = int(request.GET.get('page', 1))
        page_size = min(int(request.GET.get('page_size', 50)), 100)
        search = request.GET.get('search', '')
        status_filter = request.GET.get('status', '')
        workflow_filter = request.GET.get('workflow_stage', '')
        
        # Build queryset
        queryset = TLCClient.objects.all().select_related(
            'tax_info', 'property_valuation'
        ).prefetch_related('addresses')
        
        # Apply filters
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(email__icontains=search) |
                Q(client_number__icontains=search)
            )
        
        if status_filter:
            queryset = queryset.filter(status=status_filter)
            
        if workflow_filter:
            queryset = queryset.filter(workflow_stage=workflow_filter)
        
        # Ordering
        ordering = request.GET.get('ordering', '-created_at')
        queryset = queryset.order_by(ordering)
        
        # Pagination
        total = queryset.count()
        start = (page - 1) * page_size
        end = start + page_size
        clients = queryset[start:end]
        
        # Serialize
        serializer = TLCClientSerializer(clients, many=True)
        
        return Response({
            'count': total,
            'next': f"?page={page + 1}" if end < total else None,
            'previous': f"?page={page - 1}" if page > 1 else None,
            'results': serializer.data
        })
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def dev_tlc_analytics(request):
    """
    Development endpoint for TLC analytics - no authentication required
    """
    try:
        # Client status distribution
        status_counts = TLCClient.objects.values('status').annotate(
            count=Count('status')
        ).order_by('-count')
        
        # County distribution
        county_counts = TLCClientAddress.objects.filter(
            address_type='property'
        ).values('county').annotate(
            count=Count('county')
        ).order_by('-count')[:20]
        
        # Tax amount statistics
        tax_stats = TLCTaxInfo.objects.aggregate(
            total_portfolio=Sum('total_amount_due'),
            avg_amount=Avg('total_amount_due'),
            count=Count('id')
        )
        
        # Tax amount ranges
        tax_ranges = {
            'under_1000': TLCTaxInfo.objects.filter(total_amount_due__lt=1000).count(),
            '1000_5000': TLCTaxInfo.objects.filter(
                total_amount_due__gte=1000, total_amount_due__lt=5000
            ).count(),
            '5000_10000': TLCTaxInfo.objects.filter(
                total_amount_due__gte=5000, total_amount_due__lt=10000
            ).count(),
            '10000_25000': TLCTaxInfo.objects.filter(
                total_amount_due__gte=10000, total_amount_due__lt=25000
            ).count(),
            '25000_plus': TLCTaxInfo.objects.filter(total_amount_due__gte=25000).count(),
        }
        
        return Response({
            'status_distribution': list(status_counts),
            'county_distribution': list(county_counts),
            'tax_statistics': tax_stats,
            'tax_ranges': tax_ranges,
            'total_clients': TLCClient.objects.count()
        })
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def dev_stripe_token_packages(request):
    """
    Development endpoint for Stripe token packages - no authentication required
    """
    try:
        return Response({
            'regular_token_price': TOKEN_PRICING['regular_token_price'],
            'mail_token_price': TOKEN_PRICING['mail_token_price'],
            'packages': TOKEN_PRICING['packages'],
            'lead_packages': TOKEN_PRICING['lead_packages'],
            'subscriptions': TOKEN_PRICING['subscriptions'],
            'feature_costs': TOKEN_PRICING['feature_costs'],
            'status': 'Stripe integration configured',
            'available_endpoints': [
                '/api/dev/stripe/packages/',
                '/api/dev/stripe/balance/',
                '/api/dev/stripe/purchase-intent/'
            ]
        })
    except Exception as e:
        return Response({
            'error': str(e),
            'status': 'Stripe integration error'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def dev_stripe_balance(request):
    """
    Development endpoint for token balance - no authentication required
    Returns mock balance for testing
    """
    try:
        return Response({
            'regular_tokens': 50000,
            'mail_tokens': 25,
            'last_updated': '2025-06-25T19:50:42Z',
            'status': 'mock_data'
        })
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def dev_stripe_create_purchase_intent(request):
    """
    Development endpoint for creating Stripe payment intent - no authentication required
    """
    try:
        package_name = request.data.get('package_name', '')
        amount = request.data.get('amount', 0)
        
        # Mock Stripe payment intent response
        return Response({
            'client_secret': 'pi_mock_1234567890_secret_mock',
            'payment_intent_id': 'pi_mock_1234567890',
            'amount': amount,
            'currency': 'usd',
            'package_name': package_name,
            'status': 'mock_payment_intent_created',
            'next_action': 'redirect_to_stripe_checkout'
        })
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def dev_missions_list(request):
    """
    Development endpoint for missions - no authentication required
    """
    try:
        # Get query parameters
        page = int(request.GET.get('page', 1))
        page_size = min(int(request.GET.get('page_size', 20)), 100)
        status_filter = request.GET.get('status', '')
        
        # Build queryset
        queryset = Mission.objects.all().select_related(
            'user', 'prospect', 'created_on_device', 'decline_reason'
        ).prefetch_related('photos', 'logs')
        
        # Apply filters
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Ordering
        ordering = request.GET.get('ordering', '-created_at')
        queryset = queryset.order_by(ordering)
        
        # Pagination
        total = queryset.count()
        start = (page - 1) * page_size
        end = start + page_size
        missions = queryset[start:end]
        
        # Serialize
        serializer = MissionSerializer(missions, many=True)
        
        return Response({
            'count': total,
            'next': f"?page={page + 1}" if end < total else None,
            'previous': f"?page={page - 1}" if page > 1 else None,
            'results': serializer.data
        })
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def dev_missions_analytics(request):
    """
    Development endpoint for mission analytics - no authentication required
    """
    try:
        # Mission status distribution
        status_counts = Mission.objects.values('status').annotate(
            count=Count('status')
        ).order_by('-count')
        
        # Device usage
        device_counts = Mission.objects.filter(
            created_on_device__isnull=False
        ).values('created_on_device__device_name').annotate(
            count=Count('created_on_device')
        ).order_by('-count')[:10]
        
        # Mission completion rate
        total_missions = Mission.objects.count()
        completed_missions = Mission.objects.filter(status=Mission.STATUS_CLOSED).count()
        completion_rate = (completed_missions / total_missions * 100) if total_missions > 0 else 0
        
        # Recent mission activity
        recent_missions = Mission.objects.order_by('-created_at')[:5]
        recent_data = MissionSerializer(recent_missions, many=True).data
        
        return Response({
            'status_distribution': list(status_counts),
            'device_usage': list(device_counts),
            'completion_rate': round(completion_rate, 2),
            'total_missions': total_missions,
            'recent_missions': recent_data,
            'available_endpoints': [
                '/api/dev/missions/',
                '/api/dev/missions/analytics/',
                '/api/dev/devices/'
            ]
        })
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def dev_devices_list(request):
    """
    Development endpoint for devices - no authentication required
    """
    try:
        devices = Device.objects.all()
        serializer = DeviceSerializer(devices, many=True)
        
        return Response({
            'count': devices.count(),
            'results': serializer.data
        })
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def dev_send_email(request):
    """
    Development endpoint for sending emails - no authentication required
    Tests email functionality and token consumption
    """
    try:
        # Get request data
        to_email = request.data.get('to_email')
        subject = request.data.get('subject', 'DroneStrike Communication Test')
        message = request.data.get('message', 'This is a test email from DroneStrike v2.')
        lead_id = request.data.get('lead_id')
        
        if not to_email:
            return Response({
                'error': 'to_email is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get or create test user profile for token consumption
        from django.contrib.auth.models import User
        test_user, created = User.objects.get_or_create(
            username='dev_user',
            defaults={
                'email': 'dev@dronestrike.com',
                'first_name': 'Dev',
                'last_name': 'User'
            }
        )
        
        # Get or create user profile
        user_profile, created = UserProfile.objects.get_or_create(
            user=test_user,
            defaults={
                'tokens': 1000,
                'mail_tokens': 50
            }
        )
        
        # Get lead if specified
        lead = None
        if lead_id:
            try:
                lead = Lead.objects.get(id=lead_id)
            except Lead.DoesNotExist:
                pass
        
        # Consume tokens for email
        token_result = TokenService.consume_tokens(
            user_profile=user_profile,
            action_type='email_send',
            quantity=1,
            reference_object=lead
        )
        
        if not token_result['success']:
            return Response({
                'error': token_result['error'],
                'tokens_needed': token_result['tokens_needed'],
                'tokens_available': token_result['tokens_available']
            }, status=status.HTTP_402_PAYMENT_REQUIRED)
        
        # Mock email sending (in real implementation, use Mailgun/SendGrid)
        email_data = {
            'email_id': f'email_{token_result["transaction_id"]}',
            'to': to_email,
            'subject': subject,
            'message': message,
            'status': 'sent',
            'tokens_consumed': token_result['tokens_consumed'],
            'tokens_remaining': token_result['tokens_remaining'],
            'sent_at': timezone.now().isoformat(),
            'provider': 'mock_mailgun'
        }
        
        return Response({
            'success': True,
            'email': email_data,
            'token_usage': {
                'tokens_consumed': token_result['tokens_consumed'],
                'tokens_remaining': token_result['tokens_remaining'],
                'token_type': token_result['token_type']
            }
        })
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def dev_send_sms(request):
    """
    Development endpoint for sending SMS - no authentication required
    Tests SMS functionality and token consumption
    """
    try:
        # Get request data
        to_phone = request.data.get('to_phone')
        message = request.data.get('message', 'DroneStrike v2 SMS test message.')
        lead_id = request.data.get('lead_id')
        
        if not to_phone:
            return Response({
                'error': 'to_phone is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get or create test user profile for token consumption
        from django.contrib.auth.models import User
        test_user, created = User.objects.get_or_create(
            username='dev_user',
            defaults={
                'email': 'dev@dronestrike.com',
                'first_name': 'Dev',
                'last_name': 'User'
            }
        )
        
        # Get or create user profile
        user_profile, created = UserProfile.objects.get_or_create(
            user=test_user,
            defaults={
                'tokens': 1000,
                'mail_tokens': 50
            }
        )
        
        # Get lead if specified
        lead = None
        if lead_id:
            try:
                lead = Lead.objects.get(id=lead_id)
            except Lead.DoesNotExist:
                pass
        
        # Consume tokens for SMS (costs 2 tokens)
        token_result = TokenService.consume_tokens(
            user_profile=user_profile,
            action_type='sms_send',
            quantity=1,
            reference_object=lead
        )
        
        if not token_result['success']:
            return Response({
                'error': token_result['error'],
                'tokens_needed': token_result['tokens_needed'],
                'tokens_available': token_result['tokens_available']
            }, status=status.HTTP_402_PAYMENT_REQUIRED)
        
        # Mock SMS sending (in real implementation, use Twilio/VoIP.ms)
        sms_data = {
            'sms_id': f'sms_{token_result["transaction_id"]}',
            'to': to_phone,
            'message': message,
            'status': 'sent',
            'tokens_consumed': token_result['tokens_consumed'],
            'tokens_remaining': token_result['tokens_remaining'],
            'sent_at': timezone.now().isoformat(),
            'provider': 'mock_voipms'
        }
        
        return Response({
            'success': True,
            'sms': sms_data,
            'token_usage': {
                'tokens_consumed': token_result['tokens_consumed'],
                'tokens_remaining': token_result['tokens_remaining'],
                'token_type': token_result['token_type']
            }
        })
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def dev_send_postcard(request):
    """
    Development endpoint for sending postcards - no authentication required
    Tests mail token functionality and consumption
    """
    try:
        # Get request data
        to_address = request.data.get('to_address')
        message = request.data.get('message', 'DroneStrike v2 postcard test message.')
        lead_id = request.data.get('lead_id')
        
        if not to_address:
            return Response({
                'error': 'to_address is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get or create test user profile for token consumption
        from django.contrib.auth.models import User
        test_user, created = User.objects.get_or_create(
            username='dev_user',
            defaults={
                'email': 'dev@dronestrike.com',
                'first_name': 'Dev',
                'last_name': 'User'
            }
        )
        
        # Get or create user profile
        user_profile, created = UserProfile.objects.get_or_create(
            user=test_user,
            defaults={
                'tokens': 1000,
                'mail_tokens': 50
            }
        )
        
        # Get lead if specified
        lead = None
        if lead_id:
            try:
                lead = Lead.objects.get(id=lead_id)
            except Lead.DoesNotExist:
                pass
        
        # Consume mail tokens for postcard (costs 1 mail token = $0.80)
        token_result = TokenService.consume_tokens(
            user_profile=user_profile,
            action_type='postcard_send',
            quantity=1,
            reference_object=lead
        )
        
        if not token_result['success']:
            return Response({
                'error': token_result['error'],
                'tokens_needed': token_result['tokens_needed'],
                'tokens_available': token_result['tokens_available']
            }, status=status.HTTP_402_PAYMENT_REQUIRED)
        
        # Mock postcard sending (in real implementation, use Lob.com or similar)
        postcard_data = {
            'postcard_id': f'postcard_{token_result["transaction_id"]}',
            'to_address': to_address,
            'message': message,
            'status': 'queued',
            'tokens_consumed': token_result['tokens_consumed'],
            'tokens_remaining': token_result['tokens_remaining'],
            'estimated_delivery': (timezone.now() + timedelta(days=5)).isoformat(),
            'created_at': timezone.now().isoformat(),
            'provider': 'mock_lob',
            'cost': '$0.80'
        }
        
        return Response({
            'success': True,
            'postcard': postcard_data,
            'token_usage': {
                'tokens_consumed': token_result['tokens_consumed'],
                'tokens_remaining': token_result['tokens_remaining'],
                'token_type': token_result['token_type']
            }
        })
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def dev_communication_analytics(request):
    """
    Development endpoint for communication analytics - no authentication required
    """
    try:
        from django.utils import timezone
        from datetime import timedelta
        
        # Get communication-related token transactions
        email_transactions = TokenTransaction.objects.filter(
            action_type='email_send'
        ).count()
        
        sms_transactions = TokenTransaction.objects.filter(
            action_type='sms_send'
        ).count()
        
        postcard_transactions = TokenTransaction.objects.filter(
            action_type='postcard_send'
        ).count()
        
        # Mock campaign data
        recent_campaigns = [
            {
                'id': 1,
                'name': 'Tax Lien Outreach Q4 2024',
                'type': 'email',
                'status': 'completed',
                'sent': 1250,
                'delivered': 1195,
                'opened': 387,
                'clicked': 82,
                'created_at': '2024-12-01T10:00:00Z'
            },
            {
                'id': 2,
                'name': 'Property Acquisition SMS',
                'type': 'sms',
                'status': 'active',
                'sent': 456,
                'delivered': 445,
                'responses': 23,
                'created_at': '2024-12-15T14:30:00Z'
            },
            {
                'id': 3,
                'name': 'Direct Mail Holiday Campaign',
                'type': 'postcard',
                'status': 'scheduled',
                'scheduled_count': 500,
                'estimated_delivery': '2024-12-28T00:00:00Z',
                'created_at': '2024-12-20T09:15:00Z'
            }
        ]
        
        return Response({
            'transaction_counts': {
                'email_sent': email_transactions,
                'sms_sent': sms_transactions,
                'postcards_sent': postcard_transactions,
                'total_communications': email_transactions + sms_transactions + postcard_transactions
            },
            'token_costs': {
                'email_cost': 1,
                'sms_cost': 2, 
                'postcard_cost': '1 mail token ($0.80)'
            },
            'recent_campaigns': recent_campaigns,
            'available_endpoints': [
                '/api/dev/communication/email/',
                '/api/dev/communication/sms/',
                '/api/dev/communication/postcard/',
                '/api/dev/communication/analytics/'
            ]
        })
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def dev_comprehensive_analytics(request):
    """
    Development endpoint for comprehensive system analytics - no authentication required
    Provides overview of all system metrics and KPIs
    """
    try:
        # TLC Client Analytics
        tlc_total = TLCClient.objects.count()
        tlc_status_dist = TLCClient.objects.values('status').annotate(count=Count('status'))
        
        # Communication Analytics
        comm_stats = {
            'emails_sent': TokenTransaction.objects.filter(action_type='email_send').count(),
            'sms_sent': TokenTransaction.objects.filter(action_type='sms_send').count(),
            'postcards_sent': TokenTransaction.objects.filter(action_type='postcard_send').count(),
            'total_communications': TokenTransaction.objects.filter(
                action_type__in=['email_send', 'sms_send', 'postcard_send']
            ).count()
        }
        
        # Mission Analytics
        mission_stats = {
            'total_missions': Mission.objects.count(),
            'active_missions': Mission.objects.filter(
                status__in=[Mission.STATUS_NEW, Mission.STATUS_ACCEPTED]
            ).count()
        }
        
        # Financial Analytics
        token_stats = TokenTransaction.objects.aggregate(
            total_regular_consumed=Sum('tokens_changed', filter=Q(token_type='regular', tokens_changed__lt=0)),
            total_mail_consumed=Sum('tokens_changed', filter=Q(token_type='mail', tokens_changed__lt=0))
        )
        
        # Revenue projections (based on token usage)
        revenue_projection = {
            'monthly_token_revenue': float((abs(token_stats['total_regular_consumed'] or 0) * 0.001) + 
                                         (abs(token_stats['total_mail_consumed'] or 0) * 0.80))
        }
        
        return Response({
            'overview': {
                'tlc_clients': tlc_total,
                'total_communications': comm_stats['total_communications'],
                'active_missions': mission_stats['active_missions'],
                'monthly_revenue': revenue_projection['monthly_token_revenue']
            },
            'tlc_analytics': {
                'total_clients': tlc_total,
                'status_distribution': list(tlc_status_dist)
            },
            'communication_analytics': comm_stats,
            'mission_analytics': mission_stats,
            'financial_analytics': {
                'token_consumption': token_stats,
                'revenue_projection': revenue_projection
            },
            'generated_at': timezone.now().isoformat(),
            'available_endpoints': [
                '/api/dev/analytics/',
                '/api/dev/tlc/analytics/',
                '/api/dev/missions/analytics/',
                '/api/dev/communication/analytics/'
            ]
        })
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def dev_register_user(request):
    """
    Development endpoint for user registration - no authentication required
    Tests user creation and profile setup
    """
    try:
        from django.contrib.auth.models import User
        from django.contrib.auth.hashers import make_password
        
        # Get request data
        username = request.data.get('username')
        email = request.data.get('email')
        password = request.data.get('password')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')
        
        if not username or not email or not password:
            return Response({
                'error': 'username, email, and password are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user already exists
        if User.objects.filter(username=username).exists():
            return Response({
                'error': 'Username already exists'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if User.objects.filter(email=email).exists():
            return Response({
                'error': 'Email already exists'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create user
        user = User.objects.create(
            username=username,
            email=email,
            password=make_password(password),
            first_name=first_name,
            last_name=last_name,
            is_active=True
        )
        
        # Create user profile with starter tokens
        user_profile, created = UserProfile.objects.get_or_create(
            user=user,
            defaults={
                'tokens': 100,  # Starter regular tokens
                'mail_tokens': 5  # Starter mail tokens
            }
        )
        
        # Create initial token transaction record
        TokenTransaction.objects.create(
            user=user,
            token_type='regular',
            transaction_type='initial_grant',
            tokens_before=0,
            tokens_changed=100,
            tokens_after=100,
            total_cost=Decimal('0.00'),
            description='Welcome bonus - starter tokens'
        )
        
        TokenTransaction.objects.create(
            user=user,
            token_type='mail',
            transaction_type='initial_grant',
            tokens_before=0,
            tokens_changed=5,
            tokens_after=5,
            total_cost=Decimal('0.00'),
            description='Welcome bonus - starter mail tokens'
        )
        
        return Response({
            'success': True,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'profile': {
                    'tokens': user_profile.tokens,
                    'mail_tokens': user_profile.mail_tokens
                }
            },
            'message': 'User registered successfully with starter tokens'
        })
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def dev_login_user(request):
    """
    Development endpoint for user login - no authentication required
    Tests authentication and returns mock JWT
    """
    try:
        from django.contrib.auth import authenticate
        from django.contrib.auth.models import User
        
        # Get request data
        username = request.data.get('username')
        password = request.data.get('password')
        
        if not username or not password:
            return Response({
                'error': 'username and password are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Authenticate user
        user = authenticate(username=username, password=password)
        
        if not user:
            return Response({
                'error': 'Invalid credentials'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        if not user.is_active:
            return Response({
                'error': 'User account is disabled'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Get or create user profile
        user_profile, created = UserProfile.objects.get_or_create(
            user=user,
            defaults={
                'tokens': 100,
                'mail_tokens': 5
            }
        )
        
        # Mock JWT token (in real implementation, use djangorestframework-simplejwt)
        mock_jwt = f"mock_jwt_token_for_user_{user.id}_{timezone.now().timestamp()}"
        
        return Response({
            'success': True,
            'access_token': mock_jwt,
            'refresh_token': f"mock_refresh_token_for_user_{user.id}",
            'token_type': 'Bearer',
            'expires_in': 3600,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'profile': {
                    'tokens': user_profile.tokens,
                    'mail_tokens': user_profile.mail_tokens,
                    'stripe_customer_id': user_profile.stripe_customer_id
                }
            },
            'message': 'Login successful'
        })
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def dev_auth_analytics(request):
    """
    Development endpoint for authentication analytics - no authentication required
    """
    try:
        from django.contrib.auth.models import User
        
        # User statistics
        total_users = User.objects.count()
        active_users = User.objects.filter(is_active=True).count()
        inactive_users = total_users - active_users
        
        # Recent registrations (last 30 days)
        recent_cutoff = timezone.now() - timedelta(days=30)
        recent_registrations = User.objects.filter(
            date_joined__gte=recent_cutoff
        ).count()
        
        # User login activity (mock data since Django doesn't track this by default)
        login_stats = {
            'daily_active_users': 15,
            'weekly_active_users': 45,
            'monthly_active_users': 78
        }
        
        # Token usage by users
        token_stats = TokenTransaction.objects.aggregate(
            total_regular_consumed=Sum('tokens_changed', filter=Q(token_type='regular', tokens_changed__lt=0)),
            total_mail_consumed=Sum('tokens_changed', filter=Q(token_type='mail', tokens_changed__lt=0)),
            total_regular_purchased=Sum('tokens_changed', filter=Q(token_type='regular', tokens_changed__gt=0)),
            total_mail_purchased=Sum('tokens_changed', filter=Q(token_type='mail', tokens_changed__gt=0))
        )
        
        # Recent users
        recent_users = User.objects.order_by('-date_joined')[:5]
        recent_users_data = []
        for user in recent_users:
            profile = getattr(user, 'profile', None)
            recent_users_data.append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'date_joined': user.date_joined.isoformat(),
                'tokens': profile.tokens if profile else 0,
                'mail_tokens': profile.mail_tokens if profile else 0
            })
        
        return Response({
            'user_statistics': {
                'total_users': total_users,
                'active_users': active_users,
                'inactive_users': inactive_users,
                'recent_registrations_30d': recent_registrations
            },
            'activity_statistics': login_stats,
            'token_statistics': {
                'regular_tokens_consumed': abs(token_stats['total_regular_consumed'] or 0),
                'mail_tokens_consumed': abs(token_stats['total_mail_consumed'] or 0),
                'regular_tokens_purchased': token_stats['total_regular_purchased'] or 0,
                'mail_tokens_purchased': token_stats['total_mail_purchased'] or 0
            },
            'recent_users': recent_users_data,
            'available_endpoints': [
                '/api/dev/auth/register/',
                '/api/dev/auth/login/',
                '/api/dev/auth/analytics/'
            ]
        })
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)