"""
Mission Management Views
Translated from Laravel Mission controllers with exact business logic
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q, Count
from datetime import datetime
from math import radians, cos, sin, asin, sqrt

from .models import (
    Mission, MissionRoute, MissionRoutePoint, MissionLog, MissionPhoto,
    Device, MissionDeclineReason, Lead
)
from .serializers import (
    MissionSerializer, MissionCreateSerializer, MissionUpdateSerializer,
    MissionRouteSerializer, MissionPhotoSerializer, MissionSearchSerializer,
    RouteOptimizationRequestSerializer, DeviceSerializer, MissionDeclineReasonSerializer,
    LeadSerializer
)


class MissionViewSet(viewsets.ModelViewSet):
    """Mission management API with Laravel business logic"""
    queryset = Mission.objects.select_related('user', 'prospect', 'device', 'decline_reason').prefetch_related('photos', 'logs')
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['status', 'is_ongoing', 'go_to_lead']
    search_fields = ['prospect__first_name', 'prospect__last_name', 'prospect__mailing_city']
    ordering_fields = ['created_at', 'status', 'completed_at']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return MissionCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return MissionUpdateSerializer
        return MissionSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        # Users only see their own missions
        return queryset.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        # Check for active mission constraint (Laravel business rule)
        user = self.request.user
        active_missions = Mission.objects.filter(
            user=user,
            status__in=[Mission.STATUS_NEW, Mission.STATUS_ACCEPTED, Mission.STATUS_ON_HOLD]
        )
        
        if active_missions.exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError("User can only have one active mission at a time")
        
        # Set device if provided
        device_id = serializer.validated_data.get('device_id')
        if device_id:
            try:
                device = Device.objects.get(id=device_id, user=user)
                serializer.validated_data['device'] = device
            except Device.DoesNotExist:
                pass
        
        serializer.save(user=user)
    
    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """Accept a mission (status: NEW -> ACCEPTED)"""
        mission = self.get_object()
        
        if mission.status != Mission.STATUS_NEW:
            return Response({
                'error': f'Cannot accept mission with status {mission.get_status_display()}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        mission.status = Mission.STATUS_ACCEPTED
        mission.save()
        
        return Response({
            'success': True,
            'status': mission.get_status_display(),
            'message': 'Mission accepted successfully'
        })
    
    @action(detail=True, methods=['post'])
    def decline(self, request, pk=None):
        """Decline a mission with reason"""
        mission = self.get_object()
        
        if not mission.can_be_declined:
            return Response({
                'error': f'Cannot decline mission with status {mission.get_status_display()}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        decline_reason_id = request.data.get('decline_reason_id')
        if decline_reason_id:
            try:
                decline_reason = MissionDeclineReason.objects.get(id=decline_reason_id)
                mission.decline_reason = decline_reason
                mission.status = Mission.STATUS_DECLINED_SAFETY if decline_reason.is_safety_related else Mission.STATUS_DECLINED
            except MissionDeclineReason.DoesNotExist:
                return Response({
                    'error': 'Invalid decline reason'
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            mission.status = Mission.STATUS_DECLINED
        
        mission.save()
        
        return Response({
            'success': True,
            'status': mission.get_status_display(),
            'decline_reason': mission.decline_reason.reason if mission.decline_reason else None,
            'message': 'Mission declined successfully'
        })
    
    @action(detail=True, methods=['post'])
    def pause(self, request, pk=None):
        """Pause an active mission"""
        mission = self.get_object()
        
        if not mission.can_be_paused:
            return Response({
                'error': f'Cannot pause mission with status {mission.get_status_display()}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        mission.status = Mission.STATUS_PAUSED
        mission.save()
        
        return Response({
            'success': True,
            'status': mission.get_status_display(),
            'message': 'Mission paused successfully'
        })
    
    @action(detail=True, methods=['post'])
    def resume(self, request, pk=None):
        """Resume a paused mission"""
        mission = self.get_object()
        
        if mission.status != Mission.STATUS_PAUSED:
            return Response({
                'error': f'Cannot resume mission with status {mission.get_status_display()}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        mission.status = Mission.STATUS_ACCEPTED
        mission.save()
        
        return Response({
            'success': True,
            'status': mission.get_status_display(),
            'message': 'Mission resumed successfully'
        })
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Complete a mission with GPS coordinates"""
        mission = self.get_object()
        
        if mission.status != Mission.STATUS_ACCEPTED:
            return Response({
                'error': f'Cannot complete mission with status {mission.get_status_display()}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get completion coordinates
        lat_completed = request.data.get('lat_completed')
        lng_completed = request.data.get('lng_completed')
        
        if lat_completed and lng_completed:
            mission.lat_completed = lat_completed
            mission.lng_completed = lng_completed
        
        mission.status = Mission.STATUS_CLOSED
        mission.completed_at = datetime.now()
        mission.save()
        
        # Calculate distance traveled
        distance = mission.get_distance_traveled()
        
        return Response({
            'success': True,
            'status': mission.get_status_display(),
            'completed_at': mission.completed_at.isoformat(),
            'distance_traveled': distance,
            'message': 'Mission completed successfully'
        })
    
    @action(detail=True, methods=['post'])
    def upload_photo(self, request, pk=None):
        """Upload photo for mission with GPS validation"""
        mission = self.get_object()
        
        if 'photo' not in request.FILES:
            return Response({
                'error': 'No photo file provided'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        photo_data = {
            'mission': mission.id,
            'photo': request.FILES['photo'],
            'lat': request.data.get('lat'),
            'lng': request.data.get('lng'),
            'caption': request.data.get('caption', '')
        }
        
        serializer = MissionPhotoSerializer(data=photo_data)
        if serializer.is_valid():
            photo = serializer.save()
            
            # Validate location if GPS coordinates provided
            if photo.lat and photo.lng and mission.prospect.latitude and mission.prospect.longitude:
                # Calculate distance using Haversine formula
                lat1, lon1 = float(photo.lat), float(photo.lng)
                lat2, lon2 = float(mission.prospect.latitude), float(mission.prospect.longitude)
                
                lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
                dlat = lat2 - lat1
                dlon = lon2 - lon1
                a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
                c = 2 * asin(sqrt(a))
                distance_meters = c * 6371000  # Earth radius in meters
                
                photo.distance_from_target = distance_meters
                photo.is_valid_location = distance_meters <= 100  # Within 100 meters
                photo.save()
            
            return Response({
                'success': True,
                'photo_id': photo.id,
                'is_valid_location': photo.is_valid_location,
                'distance_from_target': float(photo.distance_from_target) if photo.distance_from_target else None,
                'message': 'Photo uploaded successfully'
            })
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def search_prospects(self, request):
        """Search for prospects near a location (Laravel mission search logic)"""
        serializer = MissionSearchSerializer(data=request.data)
        
        if serializer.is_valid():
            search_data = serializer.validated_data
            center_lat = float(search_data['lat'])
            center_lng = float(search_data['lng'])
            radius_meters = search_data['radius']
            
            # Convert radius to approximate degrees (rough approximation)
            lat_delta = radius_meters / 111320  # 1 degree lat ≈ 111,320 meters
            lng_delta = radius_meters / (111320 * cos(radians(center_lat)))
            
            # Build base queryset with geographic bounds
            prospects = Lead.objects.filter(
                latitude__isnull=False,
                longitude__isnull=False,
                latitude__gte=center_lat - lat_delta,
                latitude__lte=center_lat + lat_delta,
                longitude__gte=center_lng - lng_delta,
                longitude__lte=center_lng + lng_delta,
                owner=request.user
            )
            
            # Apply filters
            if search_data.get('exclude_dangerous', True):
                prospects = prospects.filter(is_dangerous=False)
            
            if search_data.get('exclude_business', False):
                prospects = prospects.filter(is_business=False)
            
            if search_data.get('exclude_do_not_contact', True):
                prospects = prospects.filter(
                    do_not_email=False,
                    do_not_mail=False
                )
            
            # Property filters
            if search_data.get('property_type'):
                prospects = prospects.filter(property__property_type=search_data['property_type'])
            
            if search_data.get('amount_due_min'):
                prospects = prospects.filter(property__ple_amount_due__gte=search_data['amount_due_min'])
            
            if search_data.get('amount_due_max'):
                prospects = prospects.filter(property__ple_amount_due__lte=search_data['amount_due_max'])
            
            # Calculate exact distances and filter
            valid_prospects = []
            for prospect in prospects[:search_data.get('limit', 50)]:
                # Haversine formula for exact distance
                lat1, lon1 = center_lat, center_lng
                lat2, lon2 = float(prospect.latitude), float(prospect.longitude)
                
                lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
                dlat = lat2 - lat1
                dlon = lon2 - lon1
                a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
                c = 2 * asin(sqrt(a))
                distance_meters = c * 6371000  # Earth radius in meters
                
                if distance_meters <= radius_meters:
                    prospect_data = LeadSerializer(prospect, context={'request': request}).data
                    prospect_data['distance_meters'] = round(distance_meters, 2)
                    valid_prospects.append(prospect_data)
            
            # Sort by distance
            valid_prospects.sort(key=lambda x: x['distance_meters'])
            
            # Log the search
            MissionLog.objects.create(
                mission_id=request.data.get('mission_id') if 'mission_id' in request.data else None,
                lat=center_lat,
                lng=center_lng,
                radius=radius_meters,
                filters=search_data,
                results_count=len(valid_prospects)
            )
            
            return Response({
                'center': {'lat': center_lat, 'lng': center_lng},
                'radius_meters': radius_meters,
                'results_count': len(valid_prospects),
                'prospects': valid_prospects
            })
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def active_mission(self, request):
        """Get user's current active mission"""
        active_mission = Mission.objects.filter(
            user=request.user,
            status__in=[Mission.STATUS_NEW, Mission.STATUS_ACCEPTED, Mission.STATUS_ON_HOLD, Mission.STATUS_PAUSED]
        ).first()
        
        if active_mission:
            serializer = MissionSerializer(active_mission, context={'request': request})
            return Response(serializer.data)
        
        return Response({'message': 'No active mission'}, status=status.HTTP_404_NOT_FOUND)


class MissionRouteViewSet(viewsets.ModelViewSet):
    """Mission route optimization API"""
    queryset = MissionRoute.objects.select_related('user').prefetch_related('route_points__prospect')
    serializer_class = MissionRouteSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['post'])
    def optimize_route(self, request):
        """Create and optimize a route for multiple prospects"""
        serializer = RouteOptimizationRequestSerializer(data=request.data, context={'request': request})
        
        if serializer.is_valid():
            prospect_ids = serializer.validated_data['prospect_ids']
            start_lat = serializer.validated_data.get('start_lat')
            start_lng = serializer.validated_data.get('start_lng')
            
            # Get prospects
            prospects = Lead.objects.filter(
                id__in=prospect_ids,
                owner=request.user,
                latitude__isnull=False,
                longitude__isnull=False
            )
            
            if len(prospects) != len(prospect_ids):
                return Response({
                    'error': 'Some prospects not found or missing coordinates'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create mission route
            mission_route = MissionRoute.objects.create(
                user=request.user,
                status=MissionRoute.STATUS_PENDING
            )
            
            # Create route points
            for index, prospect in enumerate(prospects):
                MissionRoutePoint.objects.create(
                    mission_route=mission_route,
                    prospect=prospect,
                    lat=prospect.latitude,
                    lng=prospect.longitude,
                    provided_index=index,
                    status=MissionRoutePoint.STATUS_PENDING
                )
            
            # TODO: Integrate with Mapbox Directions API for optimization
            # For now, we'll just use the provided order
            route_points = mission_route.route_points.all()
            for index, point in enumerate(route_points):
                point.optimized_index = index
                point.save()
            
            mission_route.is_optimized = True
            mission_route.status = MissionRoute.STATUS_ACTIVE
            mission_route.save()
            
            serializer = MissionRouteSerializer(mission_route, context={'request': request})
            return Response({
                'success': True,
                'route': serializer.data,
                'message': 'Route optimized successfully'
            })
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DeviceViewSet(viewsets.ModelViewSet):
    """Device management for mission tracking"""
    queryset = Device.objects.all()
    serializer_class = DeviceSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class MissionDeclineReasonViewSet(viewsets.ReadOnlyModelViewSet):
    """Mission decline reasons lookup"""
    queryset = MissionDeclineReason.objects.filter(is_active=True).order_by('display_order', 'reason')
    serializer_class = MissionDeclineReasonSerializer
    permission_classes = [permissions.IsAuthenticated]