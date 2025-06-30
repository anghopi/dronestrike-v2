"""
Role-based API views for DroneStrike v2
Implements sophisticated permission checking like the original systems
"""

import json
from decimal import Decimal
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.core.paginator import Paginator
from django.db.models import Q, Count, Sum
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import (
    UserProfile, Lead, Mission, Property, TokenTransaction, 
    TLCClient, Opportunity
)
from .user_roles import (
    UserRole, UserPermission, UserPermissionCheck, UserSecurityEvent
)


class RoleBasedAPIView:
    """Base class for role-based API views"""
    
    @staticmethod
    def check_user_permissions(user, required_permission):
        """Check if user has required permission"""
        if not hasattr(user, 'profile'):
            return False, "No user profile found"
        
        profile = user.profile
        profile.check_suspension_expiry()
        
        if profile.is_suspended:
            return False, "User is suspended"
        
        if not profile.has_permission(required_permission):
            return False, f"Permission required: {required_permission}"
        
        return True, "Permission granted"
    
    @staticmethod
    def log_security_event(user, event_type, description, request=None, **kwargs):
        """Log security event"""
        return UserSecurityEvent.log_event(
            user=user,
            event_type=event_type,
            description=description,
            request=request,
            **kwargs
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_profile_api(request):
    """Get current user's profile with role information"""
    profile = request.user.profile
    
    data = {
        'user': {
            'id': request.user.id,
            'username': request.user.username,
            'email': request.user.email,
            'first_name': request.user.first_name,
            'last_name': request.user.last_name,
        },
        'profile': {
            'company_name': profile.company_name,
            'role': profile.role,
            'role_flags': profile.role_flags,
            'roles': profile.get_role_names(),
            'primary_role': profile.get_primary_role_display(),
            'permissions': profile.get_permissions(),
            'tokens': profile.tokens,
            'mail_tokens': profile.mail_tokens,
            'is_suspended': profile.is_suspended,
            'suspension_reason': profile.suspension_reason,
            'max_active_missions': profile.max_active_missions,
            'max_daily_missions': profile.max_daily_missions,
            'onboarding_completed': profile.onboarding_completed,
        }
    }
    
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def leads_api(request):
    """Get leads with role-based filtering"""
    # Check permission
    has_permission, message = RoleBasedAPIView.check_user_permissions(
        request.user, UserPermission.CAN_VIEW_LEADS
    )
    if not has_permission:
        return Response({'error': message}, status=status.HTTP_403_FORBIDDEN)
    
    # Get query parameters
    page = int(request.GET.get('page', 1))
    limit = int(request.GET.get('limit', 50))
    search = request.GET.get('search', '')
    status_filter = request.GET.get('status', '')
    
    # Base queryset - only user's leads unless they can view all
    queryset = Lead.objects.all()
    if not request.user.profile.has_permission(UserPermission.CAN_VIEW_ALL_MISSIONS):
        queryset = queryset.filter(owner=request.user)
    
    # Apply filters
    if search:
        queryset = queryset.filter(
            Q(first_name__icontains=search) |
            Q(last_name__icontains=search) |
            Q(mailing_city__icontains=search) |
            Q(mailing_state__icontains=search) |
            Q(property__address1__icontains=search)
        )
    
    if status_filter:
        queryset = queryset.filter(lead_status=status_filter)
    
    # Paginate
    paginator = Paginator(queryset.order_by('-created_at'), limit)
    page_obj = paginator.get_page(page)
    
    # Serialize leads
    leads_data = []
    for lead in page_obj:
        lead_data = {
            'id': lead.id,
            'first_name': lead.first_name,
            'last_name': lead.last_name,
            'email': lead.email,
            'phone_cell': lead.phone_cell,
            'mailing_address_1': lead.mailing_address_1,
            'mailing_city': lead.mailing_city,
            'mailing_state': lead.mailing_state,
            'mailing_zip5': lead.mailing_zip5,
            'lead_status': lead.lead_status,
            'score_value': lead.score_value,
            'workflow_stage': lead.workflow_stage,
            'created_at': lead.created_at.isoformat(),
            'updated_at': lead.updated_at.isoformat(),
        }
        
        # Add property data if available
        if lead.property:
            lead_data['property'] = {
                'address1': lead.property.address1,
                'city': lead.property.city,
                'state': lead.property.state,
                'zip_code': lead.property.zip_code,
                'total_value': str(lead.property.total_value),
                'ple_amount_due': str(lead.property.ple_amount_due) if lead.property.ple_amount_due else None,
            }
        
        leads_data.append(lead_data)
    
    return Response({
        'leads': leads_data,
        'pagination': {
            'page': page,
            'pages': paginator.num_pages,
            'per_page': limit,
            'total': paginator.count,
            'has_next': page_obj.has_next(),
            'has_previous': page_obj.has_previous(),
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def missions_api(request):
    """Get missions with role-based access control"""
    # Check permission
    profile = request.user.profile
    can_view_all = profile.has_permission(UserPermission.CAN_VIEW_ALL_MISSIONS)
    
    if not profile.has_permission(UserPermission.CAN_ACCEPT_MISSIONS) and not can_view_all:
        return Response({'error': 'No permission to view missions'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    # Get query parameters
    page = int(request.GET.get('page', 1))
    limit = int(request.GET.get('limit', 20))
    status_filter = request.GET.get('status', '')
    
    # Base queryset
    queryset = Mission.objects.select_related('prospect', 'user')
    if not can_view_all:
        queryset = queryset.filter(user=request.user)
    
    if status_filter:
        status_map = {
            'new': Mission.STATUS_NEW,
            'accepted': Mission.STATUS_ACCEPTED,
            'on_hold': Mission.STATUS_ON_HOLD,
            'closed': Mission.STATUS_CLOSED,
            'declined': Mission.STATUS_DECLINED,
        }
        if status_filter in status_map:
            queryset = queryset.filter(status=status_map[status_filter])
    
    # Paginate
    paginator = Paginator(queryset.order_by('-created_at'), limit)
    page_obj = paginator.get_page(page)
    
    # Serialize missions
    missions_data = []
    for mission in page_obj:
        mission_data = {
            'id': mission.id,
            'status': mission.status,
            'status_display': mission.get_status_display(),
            'is_active': mission.is_active,
            'can_be_declined': mission.can_be_declined,
            'prospect': {
                'id': mission.prospect.id,
                'name': f"{mission.prospect.first_name} {mission.prospect.last_name}",
                'address': f"{mission.prospect.mailing_address_1}, {mission.prospect.mailing_city}, {mission.prospect.mailing_state}",
                'lead_status': mission.prospect.lead_status,
                'score_value': mission.prospect.score_value,
            },
            'user': {
                'id': mission.user.id,
                'username': mission.user.username,
            },
            'created_at': mission.created_at.isoformat(),
            'completed_at': mission.completed_at.isoformat() if mission.completed_at else None,
            'purchase_offer': str(mission.purchase_offer) if mission.purchase_offer else None,
        }
        
        # Add GPS data if available
        if mission.lat_created and mission.lng_created:
            mission_data['location_created'] = {
                'lat': float(mission.lat_created),
                'lng': float(mission.lng_created),
            }
        
        if mission.lat_completed and mission.lng_completed:
            mission_data['location_completed'] = {
                'lat': float(mission.lat_completed),
                'lng': float(mission.lng_completed),
            }
            mission_data['distance_traveled'] = mission.get_distance_traveled()
        
        missions_data.append(mission_data)
    
    return Response({
        'missions': missions_data,
        'pagination': {
            'page': page,
            'pages': paginator.num_pages,
            'per_page': limit,
            'total': paginator.count,
        }
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_mission_api(request):
    """Create new mission with role-based validation"""
    # Check permission
    has_permission, message = RoleBasedAPIView.check_user_permissions(
        request.user, UserPermission.CAN_CREATE_MISSIONS
    )
    if not has_permission:
        return Response({'error': message}, status=status.HTTP_403_FORBIDDEN)
    
    # Check if user can accept more missions
    profile = request.user.profile
    can_accept, reason = profile.can_accept_missions()
    if not can_accept:
        return Response({'error': reason}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        data = json.loads(request.body)
        prospect_id = data.get('prospect_id')
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        
        if not prospect_id:
            return Response({'error': 'prospect_id is required'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        # Get prospect
        try:
            prospect = Lead.objects.get(id=prospect_id)
        except Lead.DoesNotExist:
            return Response({'error': 'Prospect not found'}, 
                           status=status.HTTP_404_NOT_FOUND)
        
        # Check if mission already exists for this prospect
        existing_mission = Mission.objects.filter(
            prospect=prospect,
            status__in=[Mission.STATUS_NEW, Mission.STATUS_ACCEPTED, Mission.STATUS_ON_HOLD]
        ).exists()
        
        if existing_mission:
            return Response({'error': 'Active mission already exists for this prospect'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        # Create mission
        mission = Mission.objects.create(
            user=request.user,
            prospect=prospect,
            status=Mission.STATUS_NEW,
            lat_created=Decimal(str(latitude)) if latitude else None,
            lng_created=Decimal(str(longitude)) if longitude else None,
            initial_amount_due=prospect.property.ple_amount_due if prospect.property else None,
        )
        
        # Log security event
        RoleBasedAPIView.log_security_event(
            user=request.user,
            event_type='mission_created',
            description=f"Created mission {mission.id} for prospect {prospect.id}",
            request=request,
            mission_id=mission.id,
            prospect_id=prospect.id
        )
        
        return Response({
            'mission': {
                'id': mission.id,
                'status': mission.status,
                'status_display': mission.get_status_display(),
                'prospect': {
                    'id': prospect.id,
                    'name': f"{prospect.first_name} {prospect.last_name}",
                },
                'created_at': mission.created_at.isoformat(),
            }
        }, status=status.HTTP_201_CREATED)
    
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_mission_api(request, mission_id):
    """Accept a mission"""
    # Check permission
    has_permission, message = RoleBasedAPIView.check_user_permissions(
        request.user, UserPermission.CAN_ACCEPT_MISSIONS
    )
    if not has_permission:
        return Response({'error': message}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        mission = Mission.objects.get(id=mission_id)
        
        # Check if user can accept more missions
        profile = request.user.profile
        can_accept, reason = profile.can_accept_missions()
        if not can_accept:
            return Response({'error': reason}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if mission can be accepted
        if mission.status != Mission.STATUS_NEW:
            return Response({'error': 'Mission cannot be accepted in current status'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        # Accept mission
        mission.status = Mission.STATUS_ACCEPTED
        mission.user = request.user
        mission.save()
        
        # Log event
        RoleBasedAPIView.log_security_event(
            user=request.user,
            event_type='mission_created',
            description=f"Accepted mission {mission.id}",
            request=request,
            mission_id=mission.id
        )
        
        return Response({
            'message': 'Mission accepted successfully',
            'mission': {
                'id': mission.id,
                'status': mission.status,
                'status_display': mission.get_status_display(),
            }
        })
    
    except Mission.DoesNotExist:
        return Response({'error': 'Mission not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_analytics_api(request):
    """Get user analytics and statistics"""
    # Only managers and admins can view analytics
    profile = request.user.profile
    if not profile.has_permission(UserPermission.CAN_VIEW_USER_ANALYTICS):
        return Response({'error': 'No permission to view analytics'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    # Get user statistics
    users = User.objects.select_related('profile')
    user_stats = []
    
    for user in users:
        if hasattr(user, 'profile'):
            profile = user.profile
            mission_stats = profile.get_mission_stats()
            
            user_stats.append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'roles': profile.get_role_names(),
                'primary_role': profile.get_primary_role_display(),
                'is_suspended': profile.is_suspended,
                'tokens': profile.tokens,
                'mail_tokens': profile.mail_tokens,
                'mission_stats': mission_stats,
                'last_activity': profile.last_activity.isoformat() if profile.last_activity else None,
                'created_at': profile.created_at.isoformat(),
            })
    
    # Overall statistics
    total_users = users.count()
    active_users = users.filter(profile__last_activity__gte=timezone.now() - timezone.timedelta(days=30)).count()
    suspended_users = users.filter(profile__is_suspended=True).count()
    
    return Response({
        'users': user_stats,
        'summary': {
            'total_users': total_users,
            'active_users': active_users,
            'suspended_users': suspended_users,
            'total_missions': Mission.objects.count(),
            'total_leads': Lead.objects.count(),
            'total_opportunities': Opportunity.objects.count(),
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def token_balance_api(request):
    """Get user's token balance and recent transactions"""
    profile = request.user.profile
    
    # Recent transactions
    recent_transactions = TokenTransaction.objects.filter(
        user=request.user
    ).order_by('-created_at')[:10]
    
    transactions_data = []
    for tx in recent_transactions:
        transactions_data.append({
            'id': tx.id,
            'token_type': tx.token_type,
            'transaction_type': tx.transaction_type,
            'action_type': tx.action_type,
            'tokens_changed': tx.tokens_changed,
            'tokens_after': tx.tokens_after,
            'description': tx.description,
            'created_at': tx.created_at.isoformat(),
        })
    
    return Response({
        'balance': {
            'regular_tokens': profile.tokens,
            'mail_tokens': profile.mail_tokens,
        },
        'recent_transactions': transactions_data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def available_roles_api(request):
    """Get available roles and permissions for admin interface"""
    # Only admins can view role information
    if not request.user.profile.has_permission(UserPermission.CAN_MANAGE_USERS):
        return Response({'error': 'No permission to view roles'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    roles_data = []
    for role_flag, role_name in UserRole.ROLE_NAMES.items():
        permissions = UserPermission.ROLE_PERMISSIONS.get(role_flag, [])
        roles_data.append({
            'flag': role_flag,
            'name': role_name,
            'permissions': permissions,
        })
    
    return Response({
        'roles': roles_data,
        'all_permissions': list(set().union(*UserPermission.ROLE_PERMISSIONS.values())),
    })