"""
Mission Service - Enhanced from Laravel implementation
Handles mission creation, assignment, GPS tracking, route optimization, and lifecycle management
"""

from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc, asc
import json
import math
import uuid

from models.mission import (
    Mission, MissionStatus, MissionType, MissionPriority, SafetyLevel,
    MissionDeclineReason, MissionRoute, MissionRoutePoint, MissionLog,
    MissionDocument, mission_soldiers
)
from models.user import User
from models.property import Property
from models.lead import Lead
from core.config import settings
from services.websocket_service import event_service


class MissionService:
    """Enhanced mission service with all Laravel functionality"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_mission(
        self,
        assigned_by: int,
        mission_type: str,
        title: str,
        property_id: Optional[int] = None,
        prospect_id: Optional[int] = None,
        description: Optional[str] = None,
        instructions: Optional[str] = None,
        priority: str = "normal",
        safety_level: str = "green",
        scheduled_date: Optional[datetime] = None,
        estimated_duration: int = 60,
        lat_created: Optional[float] = None,
        lng_created: Optional[float] = None,
        go_to_lead: bool = False,
        initial_amount_due: Optional[Decimal] = None,
        filters: Optional[Dict[str, Any]] = None,
        device_id: Optional[str] = None
    ) -> Mission:
        """Create a new mission with enhanced features"""
        
        # Create mission
        mission = Mission(
            property_id=property_id,
            prospect_id=prospect_id,
            assigned_by=assigned_by,
            type=mission_type,
            title=title,
            description=description,
            instructions=instructions,
            priority=priority,
            safety_level=safety_level,
            scheduled_date=scheduled_date,
            estimated_duration=estimated_duration,
            lat_created=lat_created,
            lng_created=lng_created,
            go_to_lead=go_to_lead,
            initial_amount_due=initial_amount_due,
            device_id=device_id,
            assigned_at=datetime.utcnow(),
            status=MissionStatus.NEW
        )
        
        self.db.add(mission)
        self.db.flush()  # Get the ID
        
        # Create mission log
        self._create_mission_log(
            mission_id=mission.id,
            user_id=assigned_by,
            action="created",
            description=f"Mission created: {title}",
            filter_criteria=json.dumps(filters) if filters else None
        )
        
        # If location provided, find nearby properties for optimization
        if lat_created and lng_created and not property_id:
            nearest_properties = self._find_nearest_properties(
                lat_created, lng_created, radius_km=5.0, filters=filters
            )
            if nearest_properties:
                mission.property_id = nearest_properties[0].id
        
        self.db.commit()
        
        # Broadcast mission creation
        import asyncio
        asyncio.create_task(event_service.broadcast_mission_created({
            "id": mission.id,
            "title": mission.title,
            "type": mission.type,
            "priority": mission.priority,
            "status": mission.status,
            "assigned_by": assigned_by,
            "created_at": mission.created_at.isoformat() if mission.created_at else datetime.utcnow().isoformat(),
            "location": {
                "latitude": mission.lat_created,
                "longitude": mission.lng_created
            } if mission.lat_created and mission.lng_created else None
        }))
        
        return mission
    
    def assign_mission(
        self,
        mission_id: int,
        soldier_ids: List[int],
        assigned_by: int,
        create_route: bool = True
    ) -> Mission:
        """Assign mission to soldiers with route optimization"""
        
        mission = self.get_mission_by_id(mission_id)
        if not mission:
            raise ValueError("Mission not found")
        
        # Remove existing assignments
        self.db.execute(
            mission_soldiers.delete().where(mission_soldiers.c.mission_id == mission_id)
        )
        
        # Add new assignments
        for soldier_id in soldier_ids:
            self.db.execute(
                mission_soldiers.insert().values(
                    mission_id=mission_id,
                    soldier_id=soldier_id,
                    assigned_at=datetime.utcnow(),
                    is_active=True,
                    role='soldier'
                )
            )
        
        # Update mission status
        mission.status = MissionStatus.ASSIGNED
        
        # Create mission log
        self._create_mission_log(
            mission_id=mission_id,
            user_id=assigned_by,
            action="assigned",
            description=f"Mission assigned to {len(soldier_ids)} soldiers"
        )
        
        # Create optimized routes if requested
        if create_route and mission.lat_created and mission.lng_created:
            for soldier_id in soldier_ids:
                self._create_optimized_route(mission, soldier_id)
        
        self.db.commit()
        
        # Broadcast mission assignment
        import asyncio
        mission_data = {
            "id": mission.id,
            "title": mission.title,
            "status": mission.status,
            "assigned_soldiers": soldier_ids,
            "assigned_by": assigned_by,
            "assigned_at": datetime.utcnow().isoformat()
        }
        
        asyncio.create_task(event_service.broadcast_mission_status_change(
            mission_id=mission.id,
            old_status="new",
            new_status=mission.status,
            mission_data=mission_data
        ))
        
        # Send individual assignment notifications to soldiers
        for soldier_id in soldier_ids:
            asyncio.create_task(event_service.send_notification(
                user_id=soldier_id,
                notification_data={
                    "title": "New Mission Assignment",
                    "message": f"You have been assigned to mission: {mission.title}",
                    "mission_id": mission.id,
                    "action_url": f"/missions/{mission.id}"
                }
            ))
        
        return mission
    
    def start_mission(self, mission_id: int, soldier_id: int, lat: float, lng: float) -> Mission:
        """Start mission execution"""
        
        mission = self.get_mission_by_id(mission_id)
        if not mission:
            raise ValueError("Mission not found")
        
        if soldier_id not in mission.get_soldier_ids():
            raise ValueError("Soldier not assigned to this mission")
        
        mission.status = MissionStatus.IN_PROGRESS
        mission.start_latitude = lat
        mission.start_longitude = lng
        
        # Update route status
        route = self.db.query(MissionRoute).filter(
            and_(
                MissionRoute.mission_id == mission_id,
                MissionRoute.soldier_id == soldier_id
            )
        ).first()
        
        if route:
            route.status = "active"
            route.started_at = datetime.utcnow()
        
        self._create_mission_log(
            mission_id=mission_id,
            user_id=soldier_id,
            action="started",
            description="Mission started",
            log_metadata=json.dumps({"start_location": {"lat": lat, "lng": lng}})
        )
        
        self.db.commit()
        
        # Broadcast mission start
        import asyncio
        mission_data = {
            "id": mission.id,
            "title": mission.title,
            "status": mission.status,
            "soldier_id": soldier_id,
            "started_at": datetime.utcnow().isoformat(),
            "start_location": {
                "latitude": lat,
                "longitude": lng
            }
        }
        
        asyncio.create_task(event_service.broadcast_mission_status_change(
            mission_id=mission.id,
            old_status="assigned",
            new_status=mission.status,
            mission_data=mission_data
        ))
        
        # Send notification to command center
        asyncio.create_task(event_service.send_notification(
            user_id=mission.assigned_by,
            notification_data={
                "title": "Mission Started",
                "message": f"Mission '{mission.title}' has been started by soldier {soldier_id}",
                "mission_id": mission.id,
                "action_url": f"/missions/{mission.id}"
            }
        ))
        
        return mission
    
    def complete_mission(
        self,
        mission_id: int,
        soldier_id: int,
        lat: float,
        lng: float,
        completion_notes: Optional[str] = None,
        purchase_offer: Optional[Decimal] = None,
        create_opportunity: bool = False
    ) -> Mission:
        """Complete mission with opportunity creation"""
        
        mission = self.get_mission_by_id(mission_id)
        if not mission:
            raise ValueError("Mission not found")
        
        if soldier_id not in mission.get_soldier_ids():
            raise ValueError("Soldier not assigned to this mission")
        
        mission.status = MissionStatus.COMPLETED
        mission.completed_at = datetime.utcnow()
        mission.end_latitude = lat
        mission.end_longitude = lng
        mission.lat_completed = lat
        mission.lng_completed = lng
        mission.completion_notes = completion_notes
        mission.purchase_offer = purchase_offer
        
        if mission.scheduled_date:
            duration = datetime.utcnow() - mission.scheduled_date
            mission.actual_duration = int(duration.total_seconds() / 60)
        
        # Update route status
        route = self.db.query(MissionRoute).filter(
            and_(
                MissionRoute.mission_id == mission_id,
                MissionRoute.soldier_id == soldier_id
            )
        ).first()
        
        if route:
            route.status = "completed"
            route.completed_at = datetime.utcnow()
        
        self._create_mission_log(
            mission_id=mission_id,
            user_id=soldier_id,
            action="completed",
            description="Mission completed",
            log_metadata=json.dumps({
                "completion_location": {"lat": lat, "lng": lng},
                "purchase_offer": str(purchase_offer) if purchase_offer else None
            })
        )
        
        # Create opportunity if requested and go_to_lead is True
        if create_opportunity and mission.go_to_lead and mission.prospect_id:
            self._create_opportunity_from_mission(mission)
        
        self.db.commit()
        
        # Broadcast mission completion
        import asyncio
        mission_data = {
            "id": mission.id,
            "title": mission.title,
            "status": mission.status,
            "soldier_id": soldier_id,
            "completed_at": mission.completed_at.isoformat() if mission.completed_at else datetime.utcnow().isoformat(),
            "completion_location": {
                "latitude": lat,
                "longitude": lng
            },
            "purchase_offer": str(purchase_offer) if purchase_offer else None,
            "completion_notes": completion_notes,
            "actual_duration": mission.actual_duration
        }
        
        asyncio.create_task(event_service.broadcast_mission_status_change(
            mission_id=mission.id,
            old_status="in_progress",
            new_status=mission.status,
            mission_data=mission_data
        ))
        
        # Send notifications
        asyncio.create_task(event_service.send_notification(
            user_id=mission.assigned_by,
            notification_data={
                "title": "Mission Completed",
                "message": f"Mission '{mission.title}' has been completed by soldier {soldier_id}",
                "mission_id": mission.id,
                "action_url": f"/missions/{mission.id}"
            }
        ))
        
        # Send completion notification to soldier
        asyncio.create_task(event_service.send_notification(
            user_id=soldier_id,
            notification_data={
                "title": "Mission Completed Successfully",
                "message": f"You have successfully completed mission: {mission.title}",
                "mission_id": mission.id,
                "action_url": f"/missions/{mission.id}"
            }
        ))
        
        return mission
    
    def decline_mission(
        self,
        mission_id: int,
        soldier_id: int,
        decline_reason_id: int,
        decline_notes: Optional[str] = None,
        is_safety_related: bool = False
    ) -> Mission:
        """Decline mission with reason tracking"""
        
        mission = self.get_mission_by_id(mission_id)
        if not mission:
            raise ValueError("Mission not found")
        
        if soldier_id not in mission.get_soldier_ids():
            raise ValueError("Soldier not assigned to this mission")
        
        mission.status = MissionStatus.DECLINED_SAFETY if is_safety_related else MissionStatus.DECLINED
        mission.decline_reason_id = decline_reason_id
        mission.decline_notes = decline_notes
        
        # Update safety level if safety related
        if is_safety_related:
            mission.safety_level = SafetyLevel.RED
        
        self._create_mission_log(
            mission_id=mission_id,
            user_id=soldier_id,
            action="declined_safety" if is_safety_related else "declined",
            description=f"Mission declined: {decline_notes or 'No reason provided'}",
            log_metadata=json.dumps({"decline_reason_id": decline_reason_id})
        )
        
        self.db.commit()
        return mission
    
    def pause_mission(self, mission_id: int, soldier_id: int, reason: Optional[str] = None) -> Mission:
        """Pause mission temporarily"""
        
        mission = self.get_mission_by_id(mission_id)
        if not mission:
            raise ValueError("Mission not found")
        
        if soldier_id not in mission.get_soldier_ids():
            raise ValueError("Soldier not assigned to this mission")
        
        mission.status = MissionStatus.PAUSED
        
        self._create_mission_log(
            mission_id=mission_id,
            user_id=soldier_id,
            action="paused",
            description=f"Mission paused: {reason or 'No reason provided'}"
        )
        
        self.db.commit()
        return mission
    
    def resume_mission(self, mission_id: int, soldier_id: int) -> Mission:
        """Resume paused mission"""
        
        mission = self.get_mission_by_id(mission_id)
        if not mission:
            raise ValueError("Mission not found")
        
        if mission.status != MissionStatus.PAUSED:
            raise ValueError("Mission is not paused")
        
        mission.status = MissionStatus.IN_PROGRESS
        
        self._create_mission_log(
            mission_id=mission_id,
            user_id=soldier_id,
            action="resumed",
            description="Mission resumed"
        )
        
        self.db.commit()
        return mission
    
    def put_mission_on_hold(self, mission_id: int, user_id: int, reason: Optional[str] = None) -> Mission:
        """Put mission on hold"""
        
        mission = self.get_mission_by_id(mission_id)
        if not mission:
            raise ValueError("Mission not found")
        
        mission.status = MissionStatus.ON_HOLD
        
        self._create_mission_log(
            mission_id=mission_id,
            user_id=user_id,
            action="on_hold",
            description=f"Mission put on hold: {reason or 'No reason provided'}"
        )
        
        self.db.commit()
        return mission
    
    def get_missions_on_hold(self, soldier_id: Optional[int] = None) -> List[Mission]:
        """Get missions that are on hold"""
        
        query = self.db.query(Mission).filter(Mission.status == MissionStatus.ON_HOLD)
        
        if soldier_id:
            query = query.join(mission_soldiers).filter(mission_soldiers.c.soldier_id == soldier_id)
        
        return query.all()
    
    def get_mission_by_id(self, mission_id: int) -> Optional[Mission]:
        """Get mission by ID with all relationships"""
        
        return self.db.query(Mission).filter(Mission.id == mission_id).first()
    
    def get_missions_for_soldier(
        self,
        soldier_id: int,
        status_filter: Optional[List[str]] = None,
        include_completed: bool = False
    ) -> List[Mission]:
        """Get missions assigned to a specific soldier"""
        
        query = self.db.query(Mission).join(mission_soldiers).filter(
            mission_soldiers.c.soldier_id == soldier_id
        )
        
        if not include_completed:
            query = query.filter(Mission.status != MissionStatus.COMPLETED)
        
        if status_filter:
            query = query.filter(Mission.status.in_(status_filter))
        
        return query.order_by(desc(Mission.priority), asc(Mission.scheduled_date)).all()
    
    def get_missions_by_criteria(
        self,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        safety_level: Optional[str] = None,
        assigned_by: Optional[int] = None,
        property_id: Optional[int] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        radius_km: Optional[float] = None,
        limit: int = 100,
        offset: int = 0
    ) -> Tuple[List[Mission], int]:
        """Get missions by various criteria with pagination"""
        
        query = self.db.query(Mission)
        
        # Apply filters
        if status:
            query = query.filter(Mission.status == status)
        if priority:
            query = query.filter(Mission.priority == priority)
        if safety_level:
            query = query.filter(Mission.safety_level == safety_level)
        if assigned_by:
            query = query.filter(Mission.assigned_by == assigned_by)
        if property_id:
            query = query.filter(Mission.property_id == property_id)
        if date_from:
            query = query.filter(Mission.created_at >= date_from)
        if date_to:
            query = query.filter(Mission.created_at <= date_to)
        
        # Location-based filtering
        if lat and lng and radius_km:
            # Use Haversine formula for distance filtering
            query = query.filter(
                func.acos(
                    func.cos(func.radians(lat)) *
                    func.cos(func.radians(Mission.lat_created)) *
                    func.cos(func.radians(Mission.lng_created) - func.radians(lng)) +
                    func.sin(func.radians(lat)) *
                    func.sin(func.radians(Mission.lat_created))
                ) * 6371 <= radius_km
            )
        
        # Get total count
        total = query.count()
        
        # Apply pagination and ordering
        missions = query.order_by(
            desc(Mission.priority),
            desc(Mission.created_at)
        ).offset(offset).limit(limit).all()
        
        return missions, total
    
    def get_decline_reasons(self, safety_only: bool = False) -> List[MissionDeclineReason]:
        """Get available decline reasons"""
        
        query = self.db.query(MissionDeclineReason).filter(MissionDeclineReason.is_active == True)
        
        if safety_only:
            query = query.filter(MissionDeclineReason.is_safety_related == True)
        
        return query.order_by(MissionDeclineReason.sort_order).all()
    
    def _create_mission_log(
        self,
        mission_id: int,
        user_id: int,
        action: str,
        description: Optional[str] = None,
        filter_criteria: Optional[str] = None,
        log_metadata: Optional[str] = None
    ) -> MissionLog:
        """Create mission activity log"""
        
        log = MissionLog(
            mission_id=mission_id,
            user_id=user_id,
            action=action,
            description=description,
            filter_criteria=filter_criteria,
            log_metadata=log_metadata
        )
        
        self.db.add(log)
        return log
    
    def _find_nearest_properties(
        self,
        lat: float,
        lng: float,
        radius_km: float = 5.0,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 10
    ) -> List[Property]:
        """Find nearest properties using filters"""
        
        query = self.db.query(Property).filter(
            and_(
                Property.latitude.isnot(None),
                Property.longitude.isnot(None)
            )
        )
        
        # Apply mission filters if provided
        if filters:
            if filters.get('residential_only'):
                query = query.filter(Property.property_type == 'residential')
            if filters.get('commercial_only'):
                query = query.filter(Property.property_type == 'commercial')
            if filters.get('land_only'):
                query = query.filter(Property.property_type == 'land')
            if filters.get('amount_due_min'):
                query = query.filter(Property.amount_due >= filters['amount_due_min'])
            if filters.get('amount_due_max'):
                query = query.filter(Property.amount_due <= filters['amount_due_max'])
        
        # Distance calculation using Haversine formula
        distance_expr = func.acos(
            func.cos(func.radians(lat)) *
            func.cos(func.radians(Property.latitude)) *
            func.cos(func.radians(Property.longitude) - func.radians(lng)) +
            func.sin(func.radians(lat)) *
            func.sin(func.radians(Property.latitude))
        ) * 6371
        
        return query.filter(distance_expr <= radius_km).order_by(distance_expr).limit(limit).all()
    
    def _create_optimized_route(self, mission: Mission, soldier_id: int) -> MissionRoute:
        """Create optimized route for mission"""
        
        route = MissionRoute(
            mission_id=mission.id,
            soldier_id=soldier_id,
            route_name=f"Route for {mission.title}",
            status="pending"
        )
        
        self.db.add(route)
        self.db.flush()
        
        # Add main property as first point
        if mission.property_id and mission.lat_created and mission.lng_created:
            point = MissionRoutePoint(
                route_id=route.id,
                property_id=mission.property_id,
                sequence_number=1,
                latitude=mission.lat_created,
                longitude=mission.lng_created,
                address=mission.property_record.address if mission.property_record else None,
                status="pending"
            )
            self.db.add(point)
        
        return route
    
    def _create_opportunity_from_mission(self, mission: Mission) -> Optional[Any]:
        """Create opportunity from completed mission"""
        
        # This would integrate with the opportunity service
        # For now, just log the action
        self._create_mission_log(
            mission_id=mission.id,
            user_id=mission.get_soldier_ids()[0] if mission.soldiers else mission.assigned_by,
            action="opportunity_created",
            description="Opportunity created from mission completion"
        )
        
        return None
    
    def get_mission_statistics(self, soldier_id: Optional[int] = None) -> Dict[str, Any]:
        """Get mission statistics"""
        
        query = self.db.query(Mission)
        
        if soldier_id:
            query = query.join(mission_soldiers).filter(mission_soldiers.c.soldier_id == soldier_id)
        
        stats = {
            'total': query.count(),
            'new': query.filter(Mission.status == MissionStatus.NEW).count(),
            'assigned': query.filter(Mission.status == MissionStatus.ASSIGNED).count(),
            'in_progress': query.filter(Mission.status == MissionStatus.IN_PROGRESS).count(),
            'completed': query.filter(Mission.status == MissionStatus.COMPLETED).count(),
            'declined': query.filter(Mission.status.in_([MissionStatus.DECLINED, MissionStatus.DECLINED_SAFETY])).count(),
            'on_hold': query.filter(Mission.status == MissionStatus.ON_HOLD).count(),
            'high_priority': query.filter(Mission.priority.in_(['high', 'urgent'])).count(),
            'safety_concerns': query.filter(Mission.safety_level.in_(['yellow', 'red'])).count()
        }
        
        return stats