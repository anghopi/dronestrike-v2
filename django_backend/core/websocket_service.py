"""
WebSocket service for real-time updates in DroneStrike v2
Provides live updates for campaigns, missions, and lead activities
"""

import json
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import User
from django.utils import timezone

from .models import Lead, UserProfile
from .communication_models import Campaign, Communication

logger = logging.getLogger(__name__)


class DroneStrikeWebSocketConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time DroneStrike updates
    Handles campaign progress, mission updates, and lead activities
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.user = None
        self.room_group_name = None
        self.user_channel = None
    
    async def connect(self):
        """Handle WebSocket connection"""
        try:
            # Get user from scope (requires authentication middleware)
            self.user = self.scope["user"]
            
            if not self.user.is_authenticated:
                logger.warning("Unauthenticated WebSocket connection attempt")
                await self.close()
                return
            
            # Create user-specific channel group
            self.user_channel = f"user_{self.user.id}"
            self.room_group_name = f"dronestrike_{self.user.id}"
            
            # Join user group
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
            
            await self.accept()
            
            # Send initial connection confirmation
            await self.send_message({
                'type': 'connection_established',
                'message': 'Connected to DroneStrike real-time updates',
                'user_id': self.user.id,
                'timestamp': timezone.now().isoformat()
            })
            
            logger.info(f"WebSocket connected for user {self.user.id}")
            
        except Exception as e:
            logger.error(f"WebSocket connection error: {str(e)}")
            await self.close()
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        if self.room_group_name:
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
        
        logger.info(f"WebSocket disconnected for user {self.user.id if self.user else 'unknown'} with code {close_code}")
    
    async def receive(self, text_data):
        """Handle incoming WebSocket messages"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'subscribe_campaign':
                await self.handle_campaign_subscription(data)
            elif message_type == 'subscribe_lead_activity':
                await self.handle_lead_activity_subscription(data)
            elif message_type == 'ping':
                await self.send_message({'type': 'pong', 'timestamp': timezone.now().isoformat()})
            else:
                await self.send_message({
                    'type': 'error',
                    'message': f'Unknown message type: {message_type}'
                })
                
        except json.JSONDecodeError:
            await self.send_message({
                'type': 'error',
                'message': 'Invalid JSON format'
            })
        except Exception as e:
            logger.error(f"WebSocket receive error: {str(e)}")
            await self.send_message({
                'type': 'error',
                'message': 'Internal server error'
            })
    
    async def handle_campaign_subscription(self, data):
        """Handle campaign progress subscription"""
        campaign_id = data.get('campaign_id')
        if not campaign_id:
            await self.send_message({
                'type': 'error',
                'message': 'Campaign ID required'
            })
            return
        
        # Verify user owns the campaign
        campaign = await self.get_user_campaign(campaign_id)
        if not campaign:
            await self.send_message({
                'type': 'error',
                'message': 'Campaign not found or access denied'
            })
            return
        
        # Add to campaign-specific group
        campaign_group = f"campaign_{campaign_id}"
        await self.channel_layer.group_add(campaign_group, self.channel_name)
        
        await self.send_message({
            'type': 'subscribed_to_campaign',
            'campaign_id': campaign_id,
            'campaign_name': campaign.name,
            'current_status': campaign.status
        })
    
    async def handle_lead_activity_subscription(self, data):
        """Handle lead activity subscription"""
        await self.send_message({
            'type': 'subscribed_to_lead_activity',
            'message': 'Subscribed to lead activity updates'
        })
    
    async def send_message(self, message):
        """Send message to WebSocket"""
        await self.send(text_data=json.dumps(message))
    
    # Message handlers for different event types
    async def campaign_update(self, event):
        """Handle campaign update events"""
        await self.send_message({
            'type': 'campaign_update',
            'campaign_id': event['campaign_id'],
            'status': event['status'],
            'progress': event.get('progress', {}),
            'message': event.get('message', ''),
            'timestamp': event['timestamp']
        })
    
    async def lead_activity(self, event):
        """Handle lead activity events"""
        await self.send_message({
            'type': 'lead_activity',
            'lead_id': event['lead_id'],
            'activity_type': event['activity_type'],
            'details': event.get('details', {}),
            'timestamp': event['timestamp']
        })
    
    async def communication_sent(self, event):
        """Handle communication sent events"""
        await self.send_message({
            'type': 'communication_sent',
            'communication_id': event['communication_id'],
            'lead_id': event['lead_id'],
            'communication_type': event['communication_type'],
            'status': event['status'],
            'timestamp': event['timestamp']
        })
    
    async def token_balance_update(self, event):
        """Handle token balance updates"""
        await self.send_message({
            'type': 'token_balance_update',
            'regular_tokens': event['regular_tokens'],
            'mail_tokens': event['mail_tokens'],
            'change_amount': event.get('change_amount', 0),
            'reason': event.get('reason', ''),
            'timestamp': event['timestamp']
        })
    
    @database_sync_to_async
    def get_user_campaign(self, campaign_id):
        """Get campaign if user owns it"""
        try:
            from .communication_models import Campaign
            return Campaign.objects.get(id=campaign_id, user=self.user)
        except Campaign.DoesNotExist:
            return None


class WebSocketNotificationService:
    """
    Service for sending real-time notifications via WebSocket
    Used by other parts of the application to broadcast updates
    """
    
    @staticmethod
    async def notify_campaign_progress(campaign_id: int, status: str, progress: Dict[str, Any] = None, message: str = ""):
        """Notify about campaign progress"""
        from channels.layers import get_channel_layer
        
        channel_layer = get_channel_layer()
        if not channel_layer:
            return
        
        # Get campaign to find the user
        try:
            from .communication_models import Campaign
            campaign = await database_sync_to_async(Campaign.objects.get)(id=campaign_id)
            user_group = f"dronestrike_{campaign.user.id}"
            campaign_group = f"campaign_{campaign_id}"
            
            event_data = {
                'type': 'campaign_update',
                'campaign_id': campaign_id,
                'status': status,
                'progress': progress or {},
                'message': message,
                'timestamp': timezone.now().isoformat()
            }
            
            # Send to user group and campaign-specific group
            await channel_layer.group_send(user_group, event_data)
            await channel_layer.group_send(campaign_group, event_data)
            
        except Exception as e:
            logger.error(f"Error sending campaign progress notification: {str(e)}")
    
    @staticmethod
    async def notify_lead_activity(user_id: int, lead_id: int, activity_type: str, details: Dict[str, Any] = None):
        """Notify about lead activity"""
        from channels.layers import get_channel_layer
        
        channel_layer = get_channel_layer()
        if not channel_layer:
            return
        
        try:
            user_group = f"dronestrike_{user_id}"
            
            await channel_layer.group_send(user_group, {
                'type': 'lead_activity',
                'lead_id': lead_id,
                'activity_type': activity_type,
                'details': details or {},
                'timestamp': timezone.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error sending lead activity notification: {str(e)}")
    
    @staticmethod
    async def notify_communication_sent(user_id: int, communication_id: int, lead_id: int, 
                                      communication_type: str, status: str):
        """Notify about communication sent"""
        from channels.layers import get_channel_layer
        
        channel_layer = get_channel_layer()
        if not channel_layer:
            return
        
        try:
            user_group = f"dronestrike_{user_id}"
            
            await channel_layer.group_send(user_group, {
                'type': 'communication_sent',
                'communication_id': communication_id,
                'lead_id': lead_id,
                'communication_type': communication_type,
                'status': status,
                'timestamp': timezone.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error sending communication notification: {str(e)}")
    
    @staticmethod
    async def notify_token_balance_update(user_id: int, regular_tokens: int, mail_tokens: int, 
                                        change_amount: int = 0, reason: str = ""):
        """Notify about token balance changes"""
        from channels.layers import get_channel_layer
        
        channel_layer = get_channel_layer()
        if not channel_layer:
            return
        
        try:
            user_group = f"dronestrike_{user_id}"
            
            await channel_layer.group_send(user_group, {
                'type': 'token_balance_update',
                'regular_tokens': regular_tokens,
                'mail_tokens': mail_tokens,
                'change_amount': change_amount,
                'reason': reason,
                'timestamp': timezone.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error sending token balance notification: {str(e)}")


class RealtimeMetricsCollector:
    """
    Collects and broadcasts real-time metrics for dashboard updates
    """
    
    def __init__(self, user: User):
        self.user = user
    
    async def get_live_dashboard_metrics(self) -> Dict[str, Any]:
        """Get live dashboard metrics"""
        try:
            # Active campaigns
            active_campaigns = await self.get_active_campaigns_count()
            
            # Recent communications
            recent_communications = await self.get_recent_communications_count()
            
            # Token balance
            token_balance = await self.get_current_token_balance()
            
            # Lead activity
            recent_lead_activity = await self.get_recent_lead_activity()
            
            return {
                'active_campaigns': active_campaigns,
                'recent_communications': recent_communications,
                'token_balance': token_balance,
                'recent_lead_activity': recent_lead_activity,
                'last_updated': timezone.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error collecting live metrics: {str(e)}")
            return {}
    
    @database_sync_to_async
    def get_active_campaigns_count(self):
        """Get count of active campaigns"""
        from .communication_models import Campaign
        return Campaign.objects.filter(user=self.user, status='active').count()
    
    @database_sync_to_async
    def get_recent_communications_count(self):
        """Get count of recent communications (last 24 hours)"""
        cutoff = timezone.now() - timedelta(hours=24)
        return Communication.objects.filter(
            user=self.user,
            created_at__gte=cutoff
        ).count()
    
    @database_sync_to_async
    def get_current_token_balance(self):
        """Get current token balance"""
        profile = self.user.profile
        return {
            'regular_tokens': profile.tokens,
            'mail_tokens': profile.mail_tokens
        }
    
    @database_sync_to_async
    def get_recent_lead_activity(self):
        """Get recent lead activity count"""
        cutoff = timezone.now() - timedelta(hours=24)
        return {
            'new_leads': Lead.objects.filter(
                owner=self.user,
                created_at__gte=cutoff
            ).count(),
            'updated_leads': Lead.objects.filter(
                owner=self.user,
                updated_at__gte=cutoff
            ).count()
        }


# Background task for periodic metric updates
async def periodic_metrics_broadcaster():
    """Background task to broadcast metrics updates"""
    from channels.layers import get_channel_layer
    
    channel_layer = get_channel_layer()
    if not channel_layer:
        return
    
    while True:
        try:
            # This would run every 30 seconds
            await asyncio.sleep(30)
            
            # Get all active users (simplified - you'd want to track connected users)
            active_users = await database_sync_to_async(list)(
                User.objects.filter(is_active=True)[:100]  # Limit for performance
            )
            
            for user in active_users:
                metrics_collector = RealtimeMetricsCollector(user)
                metrics = await metrics_collector.get_live_dashboard_metrics()
                
                if metrics:
                    user_group = f"dronestrike_{user.id}"
                    await channel_layer.group_send(user_group, {
                        'type': 'dashboard_metrics_update',
                        'metrics': metrics
                    })
                    
        except Exception as e:
            logger.error(f"Error in periodic metrics broadcaster: {str(e)}")
            await asyncio.sleep(60)  # Wait longer on error