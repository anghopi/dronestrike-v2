"""
Communication API views for DroneStrike v2
Based on the original Node.js system's communication features
"""

import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import Q, Count, Sum
from django.utils import timezone
from datetime import timedelta
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import Lead
from .communication_models import (
    Communication, CommunicationTemplate, Campaign, 
    CommunicationService, CommunicationAnalytics
)
from .user_roles import UserPermission


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def communications_list_api(request):
    """Get user's communications with filtering"""
    # Check permission
    if not request.user.profile.has_permission(UserPermission.CAN_VIEW_LEADS):
        return Response({'error': 'No permission to view communications'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    # Get parameters
    page = int(request.GET.get('page', 1))
    limit = int(request.GET.get('limit', 20))
    comm_type = request.GET.get('type', '')
    lead_id = request.GET.get('lead_id', '')
    direction = request.GET.get('direction', '')
    
    # Base queryset
    queryset = Communication.objects.filter(user=request.user).select_related('lead')
    
    # Apply filters
    if comm_type:
        queryset = queryset.filter(type=comm_type)
    if lead_id:
        queryset = queryset.filter(lead_id=lead_id)
    if direction:
        queryset = queryset.filter(direction=direction)
    
    # Paginate
    paginator = Paginator(queryset.order_by('-created_at'), limit)
    page_obj = paginator.get_page(page)
    
    # Serialize
    communications_data = []
    for comm in page_obj:
        communications_data.append({
            'id': comm.id,
            'type': comm.type,
            'type_display': comm.get_type_display(),
            'direction': comm.direction,
            'status': comm.status,
            'subject': comm.subject,
            'content': comm.content[:200] + '...' if len(comm.content) > 200 else comm.content,
            'tokens_cost': comm.tokens_cost,
            'token_type': comm.token_type,
            'lead': {
                'id': comm.lead.id,
                'name': f"{comm.lead.first_name} {comm.lead.last_name}",
                'email': comm.lead.email,
                'phone': comm.lead.phone_cell,
            },
            'created_at': comm.created_at.isoformat(),
            'sent_at': comm.sent_at.isoformat() if comm.sent_at else None,
            'delivered_at': comm.delivered_at.isoformat() if comm.delivered_at else None,
        })
    
    return Response({
        'communications': communications_data,
        'pagination': {
            'page': page,
            'pages': paginator.num_pages,
            'per_page': limit,
            'total': paginator.count,
        }
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_communication_api(request):
    """Send a communication to a lead"""
    try:
        data = json.loads(request.body)
        
        lead_id = data.get('lead_id')
        comm_type = data.get('type')
        content = data.get('content', '')
        subject = data.get('subject', '')
        
        if not all([lead_id, comm_type, content]):
            return Response({'error': 'lead_id, type, and content are required'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        # Get lead
        try:
            lead = Lead.objects.get(id=lead_id)
        except Lead.DoesNotExist:
            return Response({'error': 'Lead not found'}, 
                           status=status.HTTP_404_NOT_FOUND)
        
        # Check if lead allows this communication type
        if comm_type == 'email' and lead.do_not_email:
            return Response({'error': 'Lead has opted out of email communications'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        # Send communication
        try:
            communication = CommunicationService.send_communication(
                user=request.user,
                lead=lead,
                comm_type=comm_type,
                content=content,
                subject=subject,
                email_address=lead.email if comm_type == 'email' else '',
                phone_number=lead.phone_cell if comm_type in ['sms', 'phone'] else '',
            )
            
            return Response({
                'message': f'{comm_type.upper()} sent successfully',
                'communication': {
                    'id': communication.id,
                    'type': communication.type,
                    'status': communication.status,
                    'tokens_cost': communication.tokens_cost,
                    'created_at': communication.created_at.isoformat(),
                }
            }, status=status.HTTP_201_CREATED)
        
        except (PermissionError, ValueError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def communication_templates_api(request):
    """Get user's communication templates"""
    templates = CommunicationTemplate.objects.filter(
        user=request.user, 
        is_active=True
    ).order_by('type', 'name')
    
    template_data = []
    for template in templates:
        template_data.append({
            'id': template.id,
            'name': template.name,
            'type': template.type,
            'type_display': template.get_type_display(),
            'subject': template.subject,
            'content': template.content,
            'uses_variables': template.uses_variables,
            'available_variables': template.available_variables,
            'times_used': template.times_used,
            'is_default': template.is_default,
            'created_at': template.created_at.isoformat(),
        })
    
    return Response({'templates': template_data})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_template_api(request):
    """Create a new communication template"""
    try:
        data = json.loads(request.body)
        
        name = data.get('name')
        template_type = data.get('type')
        content = data.get('content')
        subject = data.get('subject', '')
        
        if not all([name, template_type, content]):
            return Response({'error': 'name, type, and content are required'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        # Create template
        template = CommunicationTemplate.objects.create(
            user=request.user,
            name=name,
            type=template_type,
            subject=subject,
            content=content,
            available_variables=['first_name', 'last_name', 'address', 'city', 'state']
        )
        
        return Response({
            'message': 'Template created successfully',
            'template': {
                'id': template.id,
                'name': template.name,
                'type': template.type,
            }
        }, status=status.HTTP_201_CREATED)
    
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def campaigns_list_api(request):
    """Get user's campaigns"""
    campaigns = Campaign.objects.filter(user=request.user).order_by('-created_at')
    
    campaigns_data = []
    for campaign in campaigns:
        campaigns_data.append({
            'id': campaign.id,
            'name': campaign.name,
            'type': campaign.type,
            'type_display': campaign.get_type_display(),
            'status': campaign.status,
            'status_display': campaign.get_status_display(),
            'total_sent': campaign.total_sent,
            'total_delivered': campaign.total_delivered,
            'total_opened': campaign.total_opened,
            'total_replied': campaign.total_replied,
            'open_rate': round(campaign.open_rate, 2),
            'response_rate': round(campaign.response_rate, 2),
            'tokens_used': campaign.tokens_used,
            'max_tokens_budget': campaign.max_tokens_budget,
            'created_at': campaign.created_at.isoformat(),
            'started_at': campaign.started_at.isoformat() if campaign.started_at else None,
        })
    
    return Response({'campaigns': campaigns_data})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_campaign_api(request):
    """Create a new campaign"""
    try:
        data = json.loads(request.body)
        
        name = data.get('name')
        campaign_type = data.get('type')
        template_id = data.get('template_id')
        target_criteria = data.get('target_criteria', {})
        max_tokens_budget = data.get('max_tokens_budget', 1000)
        
        if not all([name, campaign_type]):
            return Response({'error': 'name and type are required'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        # Get template if provided
        template = None
        if template_id:
            try:
                template = CommunicationTemplate.objects.get(
                    id=template_id, 
                    user=request.user
                )
            except CommunicationTemplate.DoesNotExist:
                return Response({'error': 'Template not found'}, 
                               status=status.HTTP_404_NOT_FOUND)
        
        # Create campaign
        campaign = Campaign.objects.create(
            user=request.user,
            name=name,
            type=campaign_type,
            template=template,
            target_criteria=target_criteria,
            max_tokens_budget=max_tokens_budget,
        )
        
        return Response({
            'message': 'Campaign created successfully',
            'campaign': {
                'id': campaign.id,
                'name': campaign.name,
                'type': campaign.type,
                'status': campaign.status,
            }
        }, status=status.HTTP_201_CREATED)
    
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def communication_analytics_api(request):
    """Get communication analytics for user"""
    days = int(request.GET.get('days', 30))
    
    # Get user stats
    stats = CommunicationService.get_user_communication_stats(request.user, days)
    
    # Get daily breakdown
    since_date = timezone.now().date() - timedelta(days=days)
    daily_analytics = CommunicationAnalytics.objects.filter(
        user=request.user,
        date__gte=since_date
    ).order_by('date')
    
    daily_data = []
    for analytics in daily_analytics:
        daily_data.append({
            'date': analytics.date.isoformat(),
            'sms_sent': analytics.sms_sent,
            'emails_sent': analytics.emails_sent,
            'mail_sent': analytics.mail_sent,
            'calls_made': analytics.calls_made,
            'tokens_consumed': analytics.tokens_consumed,
            'mail_tokens_consumed': analytics.mail_tokens_consumed,
            'responses_received': analytics.responses_received,
        })
    
    # Get top performing communications
    top_communications = Communication.objects.filter(
        user=request.user,
        created_at__gte=timezone.now() - timedelta(days=days)
    ).values('type').annotate(
        count=Count('id'),
        avg_tokens=Sum('tokens_cost') / Count('id')
    ).order_by('-count')[:5]
    
    return Response({
        'summary': stats,
        'daily_breakdown': daily_data,
        'top_communication_types': list(top_communications),
        'period_days': days,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def lead_communication_history_api(request, lead_id):
    """Get communication history for a specific lead"""
    try:
        lead = Lead.objects.get(id=lead_id)
        
        # Check if user can view this lead
        if not request.user.profile.has_permission(UserPermission.CAN_VIEW_LEADS):
            return Response({'error': 'No permission to view lead communications'}, 
                           status=status.HTTP_403_FORBIDDEN)
        
        communications = Communication.objects.filter(
            lead=lead,
            user=request.user
        ).order_by('-created_at')
        
        communications_data = []
        for comm in communications:
            communications_data.append({
                'id': comm.id,
                'type': comm.type,
                'type_display': comm.get_type_display(),
                'direction': comm.direction,
                'status': comm.status,
                'subject': comm.subject,
                'content': comm.content,
                'tokens_cost': comm.tokens_cost,
                'created_at': comm.created_at.isoformat(),
                'sent_at': comm.sent_at.isoformat() if comm.sent_at else None,
                'delivered_at': comm.delivered_at.isoformat() if comm.delivered_at else None,
            })
        
        return Response({
            'lead': {
                'id': lead.id,
                'name': f"{lead.first_name} {lead.last_name}",
                'email': lead.email,
                'phone': lead.phone_cell,
            },
            'communications': communications_data,
            'total_communications': len(communications_data),
        })
    
    except Lead.DoesNotExist:
        return Response({'error': 'Lead not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def token_costs_api(request):
    """Get current token costs for communications"""
    return Response({
        'token_costs': CommunicationService.TOKEN_COSTS,
        'user_balance': {
            'regular_tokens': request.user.profile.tokens,
            'mail_tokens': request.user.profile.mail_tokens,
        }
    })