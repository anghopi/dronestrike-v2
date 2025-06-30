"""
Campaign Management API Views for DroneStrike v2
RESTful API endpoints for sophisticated campaign management
"""

import json
import logging
import asyncio
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.core.exceptions import ValidationError

from .campaign_system import CampaignService
from .communication_models import Campaign, CommunicationTemplate
from .user_roles import UserPermission
from .models import Lead

logger = logging.getLogger(__name__)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def campaigns_api(request):
    """
    GET: List user's campaigns
    POST: Create new campaign
    """
    campaign_service = CampaignService(request.user)
    
    if request.method == 'GET':
        try:
            # Get query parameters
            status_filter = request.GET.get('status')
            communication_type = request.GET.get('type')
            limit = int(request.GET.get('limit', 20))
            offset = int(request.GET.get('offset', 0))
            
            # Build query
            campaigns = Campaign.objects.filter(user=request.user)
            
            if status_filter:
                campaigns = campaigns.filter(status=status_filter)
            if communication_type:
                campaigns = campaigns.filter(communication_type=communication_type)
            
            campaigns = campaigns.order_by('-created_at')[offset:offset + limit]
            
            # Serialize campaigns
            campaigns_data = []
            for campaign in campaigns:
                campaigns_data.append({
                    'id': campaign.id,
                    'name': campaign.name,
                    'description': campaign.description,
                    'communication_type': campaign.communication_type,
                    'status': campaign.status,
                    'created_at': campaign.created_at.isoformat(),
                    'scheduled_start': campaign.scheduled_start.isoformat() if campaign.scheduled_start else None,
                    'total_sent': campaign.total_sent or 0,
                    'total_failed': campaign.total_failed or 0,
                    'tokens_consumed': campaign.tokens_consumed or 0,
                    'template': {
                        'id': campaign.template.id,
                        'name': campaign.template.name
                    } if campaign.template else None
                })
            
            return Response({
                'campaigns': campaigns_data,
                'total_count': Campaign.objects.filter(user=request.user).count(),
                'has_more': len(campaigns_data) == limit
            })
            
        except Exception as e:
            logger.error(f"Error fetching campaigns for user {request.user.id}: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    elif request.method == 'POST':
        try:
            # Check permissions
            if not request.user.profile.has_permission(UserPermission.CAN_SEND_COMMUNICATIONS):
                return Response({'error': 'No permission to create campaigns'}, 
                              status=status.HTTP_403_FORBIDDEN)
            
            data = json.loads(request.body) if request.body else {}
            
            # Validate required fields
            required_fields = ['name', 'communication_type']
            for field in required_fields:
                if field not in data:
                    return Response({'error': f'Missing required field: {field}'}, 
                                  status=status.HTTP_400_BAD_REQUEST)
            
            # Create campaign
            campaign = campaign_service.create_campaign(data)
            
            return Response({
                'success': True,
                'campaign': {
                    'id': campaign.id,
                    'name': campaign.name,
                    'status': campaign.status,
                    'communication_type': campaign.communication_type,
                    'created_at': campaign.created_at.isoformat()
                }
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error creating campaign for user {request.user.id}: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def campaign_detail_api(request, campaign_id):
    """
    GET: Get campaign details
    PUT: Update campaign
    DELETE: Delete campaign
    """
    try:
        campaign = Campaign.objects.get(id=campaign_id, user=request.user)
    except Campaign.DoesNotExist:
        return Response({'error': 'Campaign not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        try:
            campaign_service = CampaignService(request.user)
            
            # Get basic campaign data
            campaign_data = {
                'id': campaign.id,
                'name': campaign.name,
                'description': campaign.description,
                'communication_type': campaign.communication_type,
                'status': campaign.status,
                'targeting_criteria': campaign.targeting_criteria,
                'created_at': campaign.created_at.isoformat(),
                'scheduled_start': campaign.scheduled_start.isoformat() if campaign.scheduled_start else None,
                'started_at': campaign.started_at.isoformat() if campaign.started_at else None,
                'completed_at': campaign.completed_at.isoformat() if campaign.completed_at else None,
                'total_sent': campaign.total_sent or 0,
                'total_failed': campaign.total_failed or 0,
                'tokens_consumed': campaign.tokens_consumed or 0,
                'template': {
                    'id': campaign.template.id,
                    'name': campaign.template.name,
                    'subject': campaign.template.subject,
                    'content': campaign.template.content
                } if campaign.template else None
            }
            
            # Get performance analytics if campaign has started
            if campaign.status in ['active', 'completed', 'paused']:
                performance = campaign_service.get_campaign_performance(campaign_id)
                campaign_data['performance'] = performance
            
            return Response(campaign_data)
            
        except Exception as e:
            logger.error(f"Error fetching campaign {campaign_id}: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    elif request.method == 'PUT':
        try:
            data = json.loads(request.body) if request.body else {}
            
            # Update allowed fields
            allowed_fields = ['name', 'description', 'targeting_criteria']
            for field in allowed_fields:
                if field in data:
                    setattr(campaign, field, data[field])
            
            campaign.save()
            
            return Response({
                'success': True,
                'message': 'Campaign updated successfully'
            })
            
        except Exception as e:
            logger.error(f"Error updating campaign {campaign_id}: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == 'DELETE':
        try:
            if campaign.status == 'active':
                return Response({'error': 'Cannot delete active campaign'}, 
                              status=status.HTTP_400_BAD_REQUEST)
            
            campaign.delete()
            
            return Response({
                'success': True,
                'message': 'Campaign deleted successfully'
            })
            
        except Exception as e:
            logger.error(f"Error deleting campaign {campaign_id}: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def launch_campaign_api(request, campaign_id):
    """Launch a campaign"""
    try:
        campaign = Campaign.objects.get(id=campaign_id, user=request.user)
    except Campaign.DoesNotExist:
        return Response({'error': 'Campaign not found'}, status=status.HTTP_404_NOT_FOUND)
    
    try:
        campaign_service = CampaignService(request.user)
        
        # Use asyncio to run the async launch method
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(campaign_service.launch_campaign(campaign_id))
        finally:
            loop.close()
        
        return Response({
            'success': True,
            'launch_result': result
        })
        
    except Exception as e:
        logger.error(f"Error launching campaign {campaign_id}: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def pause_campaign_api(request, campaign_id):
    """Pause an active campaign"""
    try:
        campaign = Campaign.objects.get(id=campaign_id, user=request.user)
    except Campaign.DoesNotExist:
        return Response({'error': 'Campaign not found'}, status=status.HTTP_404_NOT_FOUND)
    
    try:
        if campaign.status != 'active':
            return Response({'error': 'Can only pause active campaigns'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        campaign.status = 'paused'
        campaign.save()
        
        return Response({
            'success': True,
            'message': 'Campaign paused successfully'
        })
        
    except Exception as e:
        logger.error(f"Error pausing campaign {campaign_id}: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def preview_campaign_api(request, campaign_id):
    """Preview campaign audience and content"""
    try:
        campaign = Campaign.objects.get(id=campaign_id, user=request.user)
    except Campaign.DoesNotExist:
        return Response({'error': 'Campaign not found'}, status=status.HTTP_404_NOT_FOUND)
    
    try:
        campaign_service = CampaignService(request.user)
        
        data = json.loads(request.body) if request.body else {}
        sample_size = data.get('sample_size', 5)
        
        preview = campaign_service.preview_campaign(campaign_id, sample_size)
        
        return Response(preview)
        
    except Exception as e:
        logger.error(f"Error previewing campaign {campaign_id}: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def test_audience_api(request):
    """Test audience targeting criteria"""
    try:
        data = json.loads(request.body) if request.body else {}
        targeting_criteria = data.get('targeting_criteria', {})
        
        campaign_service = CampaignService(request.user)
        
        # Analyze audience
        analysis = campaign_service.targeting_engine.analyze_audience(targeting_criteria)
        
        return Response({
            'audience_analysis': analysis,
            'estimated_cost': {
                'email': analysis['total_size'] * 1,
                'sms': analysis['total_size'] * 3,
                'postcard': analysis['total_size'] * 10,
                'letter': analysis['total_size'] * 15
            }
        })
        
    except Exception as e:
        logger.error(f"Error testing audience for user {request.user.id}: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def campaign_templates_api(request):
    """Get available communication templates"""
    try:
        communication_type = request.GET.get('type')
        
        templates = CommunicationTemplate.objects.filter(user=request.user)
        if communication_type:
            templates = templates.filter(communication_type=communication_type)
        
        templates_data = []
        for template in templates:
            templates_data.append({
                'id': template.id,
                'name': template.name,
                'description': template.description,
                'communication_type': template.communication_type,
                'subject': template.subject,
                'content': template.content[:200] + '...' if len(template.content) > 200 else template.content,
                'created_at': template.created_at.isoformat(),
                'usage_count': Campaign.objects.filter(template=template).count()
            })
        
        return Response({
            'templates': templates_data,
            'total_count': len(templates_data)
        })
        
    except Exception as e:
        logger.error(f"Error fetching templates for user {request.user.id}: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def campaign_analytics_api(request):
    """Get campaign analytics overview"""
    try:
        campaign_service = CampaignService(request.user)
        
        # Get overall campaign overview
        overview = campaign_service.get_user_campaign_overview()
        
        # Get recent campaign performance
        recent_campaigns = Campaign.objects.filter(
            user=request.user,
            status__in=['completed', 'active']
        ).order_by('-created_at')[:10]
        
        campaign_performance = []
        for campaign in recent_campaigns:
            perf = campaign_service.get_campaign_performance(campaign.id)
            campaign_performance.append(perf)
        
        # Calculate aggregate metrics
        total_sent = sum(c['delivery_metrics']['total_sent'] for c in campaign_performance)
        total_responses = sum(c['engagement_metrics']['total_responded'] for c in campaign_performance)
        total_cost = sum(c['cost_metrics']['total_cost'] for c in campaign_performance)
        
        avg_response_rate = (
            sum(c['engagement_metrics']['response_rate'] for c in campaign_performance) / 
            len(campaign_performance)
        ) if campaign_performance else 0
        
        return Response({
            'overview': overview,
            'aggregate_metrics': {
                'total_sent': total_sent,
                'total_responses': total_responses,
                'total_cost': total_cost,
                'average_response_rate': round(avg_response_rate, 2),
                'cost_per_response': round(total_cost / total_responses, 2) if total_responses > 0 else None
            },
            'recent_campaigns': campaign_performance[:5]
        })
        
    except Exception as e:
        logger.error(f"Error fetching analytics for user {request.user.id}: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def compare_campaigns_api(request):
    """Compare multiple campaigns"""
    try:
        data = json.loads(request.body) if request.body else {}
        campaign_ids = data.get('campaign_ids', [])
        
        if len(campaign_ids) < 2:
            return Response({'error': 'At least 2 campaigns required for comparison'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        # Verify all campaigns belong to user
        user_campaigns = Campaign.objects.filter(
            id__in=campaign_ids, 
            user=request.user
        ).values_list('id', flat=True)
        
        if len(user_campaigns) != len(campaign_ids):
            return Response({'error': 'Some campaigns not found'}, 
                          status=status.HTTP_404_NOT_FOUND)
        
        campaign_service = CampaignService(request.user)
        comparison = campaign_service.analytics.get_comparative_analysis(campaign_ids)
        
        return Response(comparison)
        
    except Exception as e:
        logger.error(f"Error comparing campaigns for user {request.user.id}: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def targeting_options_api(request):
    """Get available targeting options"""
    try:
        # Get unique values for targeting
        user_leads = Lead.objects.filter(owner=request.user)
        
        states = user_leads.values_list('mailing_state', flat=True).distinct()
        cities = user_leads.values_list('mailing_city', flat=True).distinct()
        lead_statuses = user_leads.values_list('lead_status', flat=True).distinct()
        workflow_stages = user_leads.values_list('workflow_stage', flat=True).distinct()
        owner_types = user_leads.values_list('owner_type', flat=True).distinct()
        
        # Property types from related properties
        property_types = user_leads.filter(
            property__isnull=False
        ).values_list('property__property_type', flat=True).distinct()
        
        return Response({
            'geographic': {
                'states': [s for s in states if s],
                'cities': [c for c in cities if c][:100],  # Limit to avoid huge lists
            },
            'lead_criteria': {
                'statuses': [s for s in lead_statuses if s],
                'workflow_stages': [w for w in workflow_stages if w],
                'owner_types': [o for o in owner_types if o]
            },
            'property_criteria': {
                'property_types': [p for p in property_types if p]
            },
            'communication_options': {
                'types': ['email', 'sms', 'postcard', 'letter'],
                'exclude_recent_days': [7, 14, 30, 60, 90]
            },
            'demographics': {
                'owner_types': ['individual', 'entity', 'trust', 'corporation'],
                'business_filters': ['exclude_businesses', 'only_businesses']
            }
        })
        
    except Exception as e:
        logger.error(f"Error fetching targeting options for user {request.user.id}: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)