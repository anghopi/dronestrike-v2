"""
Advanced Campaign Management System for DroneStrike v2
SMS/Email/Mail targeting system with sophisticated automation
Based on original Node.js system's campaign capabilities
"""

import logging
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from django.db import transaction, models
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User

from .models import Lead, Property, UserProfile
from .communication_models import Communication, CommunicationTemplate
# Forward reference for Campaign to avoid circular imports
from .token_engine import TokenEngine
from .user_roles import UserPermission
from .filtering_system import PropertyFilter

logger = logging.getLogger(__name__)


class CampaignTargetingEngine:
    """
    Advanced targeting engine for campaign audiences
    Matches original Node.js system's targeting capabilities
    """
    
    def __init__(self, user: User):
        self.user = user
        self.property_filter = PropertyFilter()
    
    def build_audience(self, targeting_criteria: Dict[str, Any]) -> models.QuerySet:
        """
        Build targeted audience based on sophisticated criteria
        """
        # Start with user's leads
        base_queryset = Lead.objects.filter(owner=self.user)
        
        # Geographic targeting
        if 'geographic' in targeting_criteria:
            geo_criteria = targeting_criteria['geographic']
            
            if 'states' in geo_criteria:
                base_queryset = base_queryset.filter(
                    mailing_state__in=geo_criteria['states']
                )
            
            if 'cities' in geo_criteria:
                base_queryset = base_queryset.filter(
                    mailing_city__in=geo_criteria['cities']
                )
            
            if 'zip_codes' in geo_criteria:
                base_queryset = base_queryset.filter(
                    mailing_zip5__in=geo_criteria['zip_codes']
                )
        
        # Lead status targeting
        if 'lead_status' in targeting_criteria:
            base_queryset = base_queryset.filter(
                lead_status__in=targeting_criteria['lead_status']
            )
        
        # Workflow stage targeting
        if 'workflow_stages' in targeting_criteria:
            base_queryset = base_queryset.filter(
                workflow_stage__in=targeting_criteria['workflow_stages']
            )
        
        # Property value targeting
        if 'property_criteria' in targeting_criteria:
            prop_criteria = targeting_criteria['property_criteria']
            
            if 'min_value' in prop_criteria:
                base_queryset = base_queryset.filter(
                    property__total_value__gte=prop_criteria['min_value']
                )
            
            if 'max_value' in prop_criteria:
                base_queryset = base_queryset.filter(
                    property__total_value__lte=prop_criteria['max_value']
                )
            
            if 'property_types' in prop_criteria:
                base_queryset = base_queryset.filter(
                    property__property_type__in=prop_criteria['property_types']
                )
            
            if 'min_taxes_due' in prop_criteria:
                base_queryset = base_queryset.filter(
                    property__ple_amount_due__gte=prop_criteria['min_taxes_due']
                )
        
        # Communication history targeting
        if 'communication_history' in targeting_criteria:
            comm_criteria = targeting_criteria['communication_history']
            
            if 'exclude_recent_contacts' in comm_criteria:
                days = comm_criteria['exclude_recent_contacts']
                cutoff_date = timezone.now() - timedelta(days=days)
                recent_contacts = Communication.objects.filter(
                    lead__in=base_queryset,
                    created_at__gte=cutoff_date
                ).values_list('lead_id', flat=True)
                base_queryset = base_queryset.exclude(id__in=recent_contacts)
            
            if 'only_unopened_emails' in comm_criteria and comm_criteria['only_unopened_emails']:
                # Find leads with unopened emails
                unopened_leads = Communication.objects.filter(
                    lead__in=base_queryset,
                    communication_type='email',
                    opened_at__isnull=True
                ).values_list('lead_id', flat=True)
                base_queryset = base_queryset.filter(id__in=unopened_leads)
        
        # Demographic targeting
        if 'demographics' in targeting_criteria:
            demo_criteria = targeting_criteria['demographics']
            
            if 'owner_types' in demo_criteria:
                base_queryset = base_queryset.filter(
                    owner_type__in=demo_criteria['owner_types']
                )
            
            if 'exclude_businesses' in demo_criteria and demo_criteria['exclude_businesses']:
                base_queryset = base_queryset.filter(is_business=False)
        
        # Engagement targeting
        if 'engagement' in targeting_criteria:
            eng_criteria = targeting_criteria['engagement']
            
            if 'min_lead_score' in eng_criteria:
                # Would need to calculate lead scores
                pass  # Implement lead scoring integration
            
            if 'response_history' in eng_criteria:
                if eng_criteria['response_history'] == 'responsive':
                    # Find leads that have responded to communications
                    responsive_leads = Communication.objects.filter(
                        lead__in=base_queryset,
                        response_received=True
                    ).values_list('lead_id', flat=True)
                    base_queryset = base_queryset.filter(id__in=responsive_leads)
                elif eng_criteria['response_history'] == 'non_responsive':
                    # Find leads that haven't responded
                    responsive_leads = Communication.objects.filter(
                        lead__in=base_queryset,
                        response_received=True
                    ).values_list('lead_id', flat=True)
                    base_queryset = base_queryset.exclude(id__in=responsive_leads)
        
        # Exclude opted-out leads
        if targeting_criteria.get('respect_opt_outs', True):
            base_queryset = base_queryset.exclude(
                models.Q(do_not_email=True) |
                models.Q(do_not_mail=True) |
                models.Q(phone_dnd=True)
            )
        
        return base_queryset.distinct()
    
    def estimate_audience_size(self, targeting_criteria: Dict[str, Any]) -> int:
        """Estimate audience size without executing full query"""
        return self.build_audience(targeting_criteria).count()
    
    def analyze_audience(self, targeting_criteria: Dict[str, Any]) -> Dict[str, Any]:
        """Provide detailed audience analysis"""
        audience = self.build_audience(targeting_criteria)
        
        # Geographic distribution
        geo_distribution = audience.values('mailing_state', 'mailing_city').annotate(
            count=models.Count('id')
        ).order_by('-count')[:10]
        
        # Lead status distribution
        status_distribution = audience.values('lead_status').annotate(
            count=models.Count('id')
        )
        
        # Property value ranges
        property_values = audience.filter(
            property__total_value__isnull=False
        ).aggregate(
            min_value=models.Min('property__total_value'),
            max_value=models.Max('property__total_value'),
            avg_value=models.Avg('property__total_value')
        )
        
        return {
            'total_size': audience.count(),
            'geographic_distribution': list(geo_distribution),
            'status_distribution': list(status_distribution),
            'property_value_stats': property_values,
            'communication_preferences': {
                'email_ok': audience.filter(do_not_email=False).count(),
                'mail_ok': audience.filter(do_not_mail=False).count(),
                'phone_ok': audience.filter(phone_dnd=False).count(),
            }
        }


class CampaignScheduler:
    """
    Sophisticated campaign scheduling system
    Handles timing, frequency, and delivery optimization
    """
    
    def __init__(self, user: User):
        self.user = user
    
    def schedule_campaign(self, campaign, schedule_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Schedule campaign based on configuration
        """
        schedule_type = schedule_config.get('type', 'immediate')
        
        if schedule_type == 'immediate':
            return self._schedule_immediate(campaign)
        elif schedule_type == 'scheduled':
            return self._schedule_datetime(campaign, schedule_config['datetime'])
        elif schedule_type == 'drip':
            return self._schedule_drip_campaign(campaign, schedule_config)
        elif schedule_type == 'triggered':
            return self._schedule_triggered_campaign(campaign, schedule_config)
        else:
            raise ValueError(f"Unknown schedule type: {schedule_type}")
    
    def _schedule_immediate(self, campaign) -> Dict[str, Any]:
        """Schedule for immediate delivery"""
        campaign.status = 'active'
        campaign.scheduled_start = timezone.now()
        campaign.save()
        
        return {
            'status': 'scheduled',
            'delivery_time': 'immediate',
            'estimated_completion': timezone.now() + timedelta(hours=1)
        }
    
    def _schedule_datetime(self, campaign, scheduled_datetime: datetime) -> Dict[str, Any]:
        """Schedule for specific datetime"""
        campaign.status = 'scheduled'
        campaign.scheduled_start = scheduled_datetime
        campaign.save()
        
        return {
            'status': 'scheduled',
            'delivery_time': scheduled_datetime.isoformat(),
            'estimated_completion': scheduled_datetime + timedelta(hours=1)
        }
    
    def _schedule_drip_campaign(self, campaign, config: Dict[str, Any]) -> Dict[str, Any]:
        """Schedule drip campaign with multiple touchpoints"""
        drip_sequence = config.get('sequence', [])
        interval_days = config.get('interval_days', 7)
        
        campaign.status = 'scheduled'
        campaign.campaign_type = 'drip'
        campaign.scheduled_start = config.get('start_date', timezone.now())
        
        # Store drip configuration
        campaign.configuration = {
            'drip_sequence': drip_sequence,
            'interval_days': interval_days,
            'current_step': 0
        }
        campaign.save()
        
        return {
            'status': 'scheduled',
            'campaign_type': 'drip',
            'total_steps': len(drip_sequence),
            'interval_days': interval_days,
            'estimated_completion': campaign.scheduled_start + timedelta(
                days=interval_days * len(drip_sequence)
            )
        }
    
    def _schedule_triggered_campaign(self, campaign, config: Dict[str, Any]) -> Dict[str, Any]:
        """Schedule triggered campaign based on events"""
        trigger_event = config.get('trigger', 'lead_created')
        delay_hours = config.get('delay_hours', 0)
        
        campaign.status = 'scheduled'
        campaign.campaign_type = 'triggered'
        campaign.configuration = {
            'trigger_event': trigger_event,
            'delay_hours': delay_hours,
            'conditions': config.get('conditions', {})
        }
        campaign.save()
        
        return {
            'status': 'scheduled',
            'campaign_type': 'triggered',
            'trigger_event': trigger_event,
            'delay_hours': delay_hours
        }


class CampaignExecutor:
    """
    Campaign execution engine with delivery optimization
    Handles actual sending and tracking
    """
    
    def __init__(self, user: User):
        self.user = user
        self.token_engine = TokenEngine()
    
    async def execute_campaign(self, campaign) -> Dict[str, Any]:
        """
        Execute campaign with sophisticated delivery logic
        """
        try:
            # Check user permissions
            if not self.user.profile.has_permission(UserPermission.CAN_SEND_COMMUNICATIONS):
                raise PermissionError("No permission to send communications")
            
            # Get campaign audience
            targeting_engine = CampaignTargetingEngine(self.user)
            audience = targeting_engine.build_audience(campaign.targeting_criteria)
            
            if audience.count() == 0:
                return {'status': 'failed', 'error': 'No audience found'}
            
            # Calculate token cost
            cost_per_contact = self._get_communication_cost(campaign.communication_type)
            total_cost = audience.count() * cost_per_contact
            
            # Check token availability
            can_afford, message, breakdown = self.token_engine.check_token_availability(
                self.user, f"{campaign.communication_type}_send", total_cost
            )
            
            if not can_afford:
                return {'status': 'failed', 'error': f'Insufficient tokens: {message}'}
            
            # Execute delivery
            campaign.status = 'active'
            campaign.started_at = timezone.now()
            campaign.save()
            
            delivery_results = await self._deliver_to_audience(campaign, audience)
            
            # Update campaign status
            campaign.status = 'completed'
            campaign.completed_at = timezone.now()
            campaign.total_sent = delivery_results['sent']
            campaign.total_failed = delivery_results['failed']
            campaign.save()
            
            return {
                'status': 'completed',
                'total_audience': audience.count(),
                'sent': delivery_results['sent'],
                'failed': delivery_results['failed'],
                'tokens_consumed': delivery_results['tokens_used'],
                'delivery_rate': delivery_results['sent'] / audience.count() * 100
            }
        
        except Exception as e:
            campaign.status = 'failed'
            campaign.error_message = str(e)
            campaign.save()
            logger.error(f"Campaign {campaign.id} execution failed: {str(e)}")
            return {'status': 'failed', 'error': str(e)}
    
    async def _deliver_to_audience(self, campaign, audience: models.QuerySet) -> Dict[str, Any]:
        """
        Deliver campaign to audience with batching and rate limiting
        """
        sent_count = 0
        failed_count = 0
        tokens_used = 0
        batch_size = 50  # Process in batches
        
        # Get template
        template = campaign.template
        if not template:
            raise ValueError("Campaign has no template")
        
        # Process in batches to avoid overwhelming the system
        for i in range(0, audience.count(), batch_size):
            batch = audience[i:i + batch_size]
            
            batch_results = await self._process_batch(campaign, template, batch)
            sent_count += batch_results['sent']
            failed_count += batch_results['failed']
            tokens_used += batch_results['tokens']
            
            # Rate limiting - pause between batches
            if i + batch_size < audience.count():
                await asyncio.sleep(1)  # 1 second pause between batches
        
        return {
            'sent': sent_count,
            'failed': failed_count,
            'tokens_used': tokens_used
        }
    
    async def _process_batch(self, campaign, template: CommunicationTemplate, 
                           leads: models.QuerySet) -> Dict[str, Any]:
        """Process a batch of leads for campaign delivery"""
        sent = 0
        failed = 0
        tokens = 0
        
        for lead in leads:
            try:
                # Personalize content
                personalized_content = self._personalize_content(template, lead)
                
                # Create communication record
                communication = Communication.objects.create(
                    lead=lead,
                    campaign=campaign,
                    template=template,
                    communication_type=campaign.communication_type,
                    subject=personalized_content['subject'],
                    content=personalized_content['content'],
                    status='sent',
                    sent_at=timezone.now()
                )
                
                # Consume tokens
                cost = self._get_communication_cost(campaign.communication_type)
                self.token_engine.consume_tokens(
                    user=self.user,
                    action_type=f"{campaign.communication_type}_send",
                    quantity=cost,
                    description=f"Campaign: {campaign.name}"
                )
                
                sent += 1
                tokens += cost
                
                # Update campaign metrics
                campaign.update_metrics({
                    'sent': models.F('total_sent') + 1
                })
                
            except Exception as e:
                logger.error(f"Failed to send to lead {lead.id}: {str(e)}")
                failed += 1
                
                # Record failed communication
                Communication.objects.create(
                    lead=lead,
                    campaign=campaign,
                    template=template,
                    communication_type=campaign.communication_type,
                    status='failed',
                    error_message=str(e),
                    failed_at=timezone.now()
                )
        
        return {'sent': sent, 'failed': failed, 'tokens': tokens}
    
    def _personalize_content(self, template: CommunicationTemplate, lead: Lead) -> Dict[str, str]:
        """
        Personalize template content with lead data
        Advanced templating with property information
        """
        context = {
            'first_name': lead.first_name or 'Property Owner',
            'last_name': lead.last_name or '',
            'full_name': f"{lead.first_name} {lead.last_name}".strip() or 'Property Owner',
            'property_address': '',
            'property_value': '',
            'taxes_due': '',
            'city': lead.mailing_city or '',
            'state': lead.mailing_state or '',
            'zip_code': lead.mailing_zip5 or '',
        }
        
        # Add property context if available
        if lead.property:
            context.update({
                'property_address': lead.property.address1 or '',
                'property_city': lead.property.city or '',
                'property_value': f"${lead.property.total_value:,.2f}" if lead.property.total_value else '',
                'taxes_due': f"${lead.property.ple_amount_due:,.2f}" if lead.property.ple_amount_due else '',
                'property_type': lead.property.property_type or 'property',
            })
        
        # Simple template replacement (could be enhanced with Jinja2)
        subject = template.subject
        content = template.content
        
        for key, value in context.items():
            subject = subject.replace(f"{{{key}}}", str(value))
            content = content.replace(f"{{{key}}}", str(value))
        
        return {
            'subject': subject,
            'content': content
        }
    
    def _get_communication_cost(self, communication_type: str) -> int:
        """Get token cost for communication type"""
        costs = {
            'email': 1,
            'sms': 3,
            'postcard': 10,
            'letter': 15
        }
        return costs.get(communication_type, 1)


class CampaignAnalytics:
    """
    Advanced campaign analytics and reporting
    Tracks performance, engagement, and ROI
    """
    
    def __init__(self, user: User):
        self.user = user
    
    def get_campaign_performance(self, campaign) -> Dict[str, Any]:
        """Get comprehensive campaign performance metrics"""
        communications = Communication.objects.filter(campaign=campaign)
        
        # Basic metrics
        total_sent = communications.filter(status='sent').count()
        total_failed = communications.filter(status='failed').count()
        total_opened = communications.filter(opened_at__isnull=False).count()
        total_clicked = communications.filter(clicked_at__isnull=False).count()
        total_responded = communications.filter(response_received=True).count()
        
        # Calculate rates
        delivery_rate = (total_sent / (total_sent + total_failed) * 100) if (total_sent + total_failed) > 0 else 0
        open_rate = (total_opened / total_sent * 100) if total_sent > 0 else 0
        click_rate = (total_clicked / total_sent * 100) if total_sent > 0 else 0
        response_rate = (total_responded / total_sent * 100) if total_sent > 0 else 0
        
        # Cost analysis
        total_cost = campaign.tokens_consumed or 0
        cost_per_send = total_cost / total_sent if total_sent > 0 else 0
        cost_per_response = total_cost / total_responded if total_responded > 0 else 0
        
        # Time-based analysis
        hourly_stats = self._get_hourly_engagement_stats(communications)
        
        return {
            'campaign_id': campaign.id,
            'campaign_name': campaign.name,
            'status': campaign.status,
            'delivery_metrics': {
                'total_sent': total_sent,
                'total_failed': total_failed,
                'delivery_rate': round(delivery_rate, 2)
            },
            'engagement_metrics': {
                'total_opened': total_opened,
                'total_clicked': total_clicked,
                'total_responded': total_responded,
                'open_rate': round(open_rate, 2),
                'click_rate': round(click_rate, 2),
                'response_rate': round(response_rate, 2)
            },
            'cost_metrics': {
                'total_cost': total_cost,
                'cost_per_send': round(cost_per_send, 2),
                'cost_per_response': round(cost_per_response, 2) if total_responded > 0 else None
            },
            'timing_analysis': hourly_stats,
            'duration': {
                'started_at': campaign.started_at.isoformat() if campaign.started_at else None,
                'completed_at': campaign.completed_at.isoformat() if campaign.completed_at else None,
                'duration_hours': self._calculate_duration_hours(campaign)
            }
        }
    
    def get_comparative_analysis(self, campaign_ids: List[int]) -> Dict[str, Any]:
        """Compare multiple campaigns"""
        campaigns = Campaign.objects.filter(id__in=campaign_ids, user=self.user)
        
        comparison_data = []
        for campaign in campaigns:
            performance = self.get_campaign_performance(campaign)
            comparison_data.append({
                'campaign_id': campaign.id,
                'name': campaign.name,
                'type': campaign.communication_type,
                'delivery_rate': performance['delivery_metrics']['delivery_rate'],
                'open_rate': performance['engagement_metrics']['open_rate'],
                'response_rate': performance['engagement_metrics']['response_rate'],
                'cost_per_response': performance['cost_metrics']['cost_per_response'],
                'total_sent': performance['delivery_metrics']['total_sent']
            })
        
        return {
            'campaigns': comparison_data,
            'insights': self._generate_comparison_insights(comparison_data)
        }
    
    def _get_hourly_engagement_stats(self, communications: models.QuerySet) -> Dict[str, Any]:
        """Analyze engagement patterns by hour"""
        from django.db.models import Count, Q
        from django.db.models.functions import Extract
        
        hourly_opens = communications.filter(
            opened_at__isnull=False
        ).extra(
            select={'hour': 'EXTRACT(hour FROM opened_at)'}
        ).values('hour').annotate(
            count=Count('id')
        ).order_by('hour')
        
        return {
            'peak_open_hours': list(hourly_opens),
            'best_open_hour': max(hourly_opens, key=lambda x: x['count'])['hour'] if hourly_opens else None
        }
    
    def _calculate_duration_hours(self, campaign) -> Optional[float]:
        """Calculate campaign duration in hours"""
        if campaign.started_at and campaign.completed_at:
            duration = campaign.completed_at - campaign.started_at
            return duration.total_seconds() / 3600
        return None
    
    def _generate_comparison_insights(self, comparison_data: List[Dict]) -> List[str]:
        """Generate insights from campaign comparison"""
        insights = []
        
        if len(comparison_data) < 2:
            return insights
        
        # Find best performing campaign by response rate
        best_response = max(comparison_data, key=lambda x: x['response_rate'] or 0)
        insights.append(f"'{best_response['name']}' had the highest response rate at {best_response['response_rate']:.1f}%")
        
        # Find most cost effective
        cost_effective = [c for c in comparison_data if c['cost_per_response'] is not None]
        if cost_effective:
            cheapest = min(cost_effective, key=lambda x: x['cost_per_response'])
            insights.append(f"'{cheapest['name']}' was most cost-effective at {cheapest['cost_per_response']:.1f} tokens per response")
        
        # Communication type analysis
        email_campaigns = [c for c in comparison_data if c['type'] == 'email']
        sms_campaigns = [c for c in comparison_data if c['type'] == 'sms']
        
        if email_campaigns and sms_campaigns:
            avg_email_response = sum(c['response_rate'] for c in email_campaigns) / len(email_campaigns)
            avg_sms_response = sum(c['response_rate'] for c in sms_campaigns) / len(sms_campaigns)
            
            if avg_sms_response > avg_email_response:
                insights.append(f"SMS campaigns averaged {avg_sms_response:.1f}% response vs {avg_email_response:.1f}% for email")
            else:
                insights.append(f"Email campaigns averaged {avg_email_response:.1f}% response vs {avg_sms_response:.1f}% for SMS")
        
        return insights


class CampaignService:
    """
    Main service for campaign management
    Orchestrates targeting, scheduling, execution, and analytics
    """
    
    def __init__(self, user: User):
        self.user = user
        self.targeting_engine = CampaignTargetingEngine(user)
        self.scheduler = CampaignScheduler(user)
        self.executor = CampaignExecutor(user)
        self.analytics = CampaignAnalytics(user)
    
    @transaction.atomic
    def create_campaign(self, campaign_data: Dict[str, Any]):
        """Create a new campaign with full configuration"""
        # Validate user permissions
        if not self.user.profile.has_permission(UserPermission.CAN_SEND_COMMUNICATIONS):
            raise PermissionError("No permission to create campaigns")
        
        # Import Campaign model here to avoid circular imports
        from .communication_models import Campaign
        
        # Create campaign
        campaign = Campaign.objects.create(
            user=self.user,
            name=campaign_data['name'],
            description=campaign_data.get('description', ''),
            communication_type=campaign_data['communication_type'],
            template_id=campaign_data.get('template_id'),
            targeting_criteria=campaign_data.get('targeting_criteria', {}),
            status='draft'
        )
        
        # Set up scheduling if provided
        if 'schedule' in campaign_data:
            schedule_result = self.scheduler.schedule_campaign(
                campaign, campaign_data['schedule']
            )
            campaign.scheduled_start = schedule_result.get('delivery_time')
            campaign.save()
        
        return campaign
    
    async def launch_campaign(self, campaign_id: int) -> Dict[str, Any]:
        """Launch a campaign"""
        try:
            from .communication_models import Campaign
            campaign = Campaign.objects.get(id=campaign_id, user=self.user)
            
            if campaign.status != 'draft' and campaign.status != 'scheduled':
                raise ValueError(f"Cannot launch campaign with status: {campaign.status}")
            
            return await self.executor.execute_campaign(campaign)
            
        except Campaign.DoesNotExist:
            raise ValueError("Campaign not found")
    
    def preview_campaign(self, campaign_id: int, sample_size: int = 5) -> Dict[str, Any]:
        """Preview campaign with sample audience and content"""
        from .communication_models import Campaign
        campaign = Campaign.objects.get(id=campaign_id, user=self.user)
        
        # Get sample audience
        audience = self.targeting_engine.build_audience(campaign.targeting_criteria)
        sample_leads = audience[:sample_size]
        
        # Generate sample content
        sample_content = []
        if campaign.template:
            for lead in sample_leads:
                personalized = self.executor._personalize_content(campaign.template, lead)
                sample_content.append({
                    'lead_name': f"{lead.first_name} {lead.last_name}".strip(),
                    'subject': personalized['subject'],
                    'content': personalized['content'][:200] + '...' if len(personalized['content']) > 200 else personalized['content']
                })
        
        # Audience analysis
        audience_analysis = self.targeting_engine.analyze_audience(campaign.targeting_criteria)
        
        return {
            'campaign': {
                'id': campaign.id,
                'name': campaign.name,
                'type': campaign.communication_type,
                'status': campaign.status
            },
            'audience_analysis': audience_analysis,
            'sample_content': sample_content,
            'estimated_cost': audience_analysis['total_size'] * self.executor._get_communication_cost(campaign.communication_type)
        }
    
    def get_campaign_performance(self, campaign_id: int) -> Dict[str, Any]:
        """Get campaign performance analytics"""
        from .communication_models import Campaign
        campaign = Campaign.objects.get(id=campaign_id, user=self.user)
        return self.analytics.get_campaign_performance(campaign)
    
    def get_user_campaign_overview(self) -> Dict[str, Any]:
        """Get overview of all user campaigns"""
        from .communication_models import Campaign
        campaigns = Campaign.objects.filter(user=self.user).order_by('-created_at')
        
        total_campaigns = campaigns.count()
        active_campaigns = campaigns.filter(status='active').count()
        completed_campaigns = campaigns.filter(status='completed').count()
        
        # Recent performance
        recent_campaigns = campaigns[:5]
        recent_performance = []
        for campaign in recent_campaigns:
            perf = self.analytics.get_campaign_performance(campaign)
            recent_performance.append({
                'id': campaign.id,
                'name': campaign.name,
                'type': campaign.communication_type,
                'status': campaign.status,
                'response_rate': perf['engagement_metrics']['response_rate']
            })
        
        return {
            'summary': {
                'total_campaigns': total_campaigns,
                'active_campaigns': active_campaigns,
                'completed_campaigns': completed_campaigns
            },
            'recent_campaigns': recent_performance
        }