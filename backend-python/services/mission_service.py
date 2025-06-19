"""
Mission management service
Handles BOTG (Boots on the Ground) mission operations
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime, date
from decimal import Decimal

from models.mission import Mission, MissionStatus, MissionPriority, MissionType, MissionDocument
from models.user import User, UserRole
from models.property import Property
from .base import BaseService


class MissionService(BaseService[Mission]):
    """Mission management service"""
    
    def __init__(self, db: Session):
        super().__init__(Mission, db)
    
    def create_mission(
        self,
        property_id: int,
        assigner: User,
        mission_type: MissionType,
        title: str,
        description: Optional[str] = None,
        instructions: Optional[str] = None,
        priority: MissionPriority = MissionPriority.NORMAL,
        scheduled_date: Optional[datetime] = None,
        estimated_duration: int = 60
    ) -> Mission:
        """Create a new mission"""
        
        mission_data = {
            "property_id": property_id,
            "assigned_by": assigner.id,
            "type": mission_type.value,
            "title": title,
            "description": description,
            "instructions": instructions,
            "priority": priority.value,
            "scheduled_date": scheduled_date,
            "estimated_duration": estimated_duration,
            "assigned_at": datetime.utcnow()
        }
        
        return self.create(mission_data)
    
    def assign_soldiers(self, mission: Mission, soldier_ids: List[int]) -> Mission:
        """Assign soldiers to a mission"""
        
        # Validate soldiers exist and have soldier role
        soldiers = self.db.query(User).filter(
            User.id.in_(soldier_ids),
            User.role == UserRole.SOLDIER,
            User.is_active == True
        ).all()
        
        if len(soldiers) != len(soldier_ids):
            raise ValueError("One or more soldiers not found or not active")
        
        # Assign soldiers
        mission.soldiers = soldiers
        
        # Update status if it was pending
        if mission.status == MissionStatus.PENDING.value:
            mission.status = MissionStatus.ASSIGNED.value
        
        self.db.add(mission)
        self.db.commit()
        
        return mission
    
    def start_mission(
        self,
        mission: Mission,
        soldier: User,
        latitude: Optional[Decimal] = None,
        longitude: Optional[Decimal] = None
    ) -> Mission:
        """Start a mission (soldier action)"""
        
        # Validate soldier is assigned to mission
        if soldier not in mission.soldiers:
            raise ValueError("Soldier not assigned to this mission")
        
        # Update mission status and location
        update_data = {
            "status": MissionStatus.IN_PROGRESS.value,
            "start_latitude": latitude,
            "start_longitude": longitude
        }
        
        return self.update(mission, update_data)
    
    def complete_mission(
        self,
        mission: Mission,
        soldier: User,
        completion_notes: Optional[str] = None,
        latitude: Optional[Decimal] = None,
        longitude: Optional[Decimal] = None,
        photos_count: int = 0,
        documents_count: int = 0
    ) -> Mission:
        """Complete a mission (soldier action)"""
        
        # Validate soldier is assigned to mission
        if soldier not in mission.soldiers:
            raise ValueError("Soldier not assigned to this mission")
        
        # Calculate actual duration if mission was in progress
        actual_duration = None
        if mission.status == MissionStatus.IN_PROGRESS.value:
            # Simple duration calculation - in real implementation would track start time
            actual_duration = mission.estimated_duration
        
        completed_at = datetime.utcnow()
        
        update_data = {
            "status": MissionStatus.COMPLETED.value,
            "completed_at": completed_at,
            "completion_notes": completion_notes,
            "end_latitude": latitude,
            "end_longitude": longitude,
            "photos_count": photos_count,
            "documents_count": documents_count,
            "actual_duration": actual_duration
        }
        
        return self.update(mission, update_data)
    
    def cancel_mission(self, mission: Mission, reason: Optional[str] = None) -> Mission:
        """Cancel a mission"""
        
        update_data = {
            "status": MissionStatus.CANCELLED.value,
            "completion_notes": reason
        }
        
        return self.update(mission, update_data)
    
    def fail_mission(self, mission: Mission, reason: Optional[str] = None) -> Mission:
        """Mark mission as failed"""
        
        update_data = {
            "status": MissionStatus.FAILED.value,
            "completion_notes": reason
        }
        
        return self.update(mission, update_data)
    
    def review_mission(
        self,
        mission: Mission,
        reviewer: User,
        quality_score: int,
        review_notes: Optional[str] = None
    ) -> Mission:
        """Review a completed mission"""
        
        if mission.status != MissionStatus.COMPLETED.value:
            raise ValueError("Can only review completed missions")
        
        # Validate quality score
        quality_score = max(0, min(100, quality_score))
        
        update_data = {
            "quality_score": quality_score,
            "reviewed_by": reviewer.id,
            "reviewed_at": datetime.utcnow(),
            "review_notes": review_notes
        }
        
        return self.update(mission, update_data)
    
    def get_missions_for_soldier(
        self,
        soldier: User,
        status: Optional[MissionStatus] = None,
        limit: int = 50
    ) -> List[Mission]:
        """Get missions assigned to a soldier"""
        
        query = self.db.query(Mission).join(Mission.soldiers).filter(
            User.id == soldier.id
        )
        
        if status:
            query = query.filter(Mission.status == status.value)
        
        return query.order_by(Mission.scheduled_date.desc()).limit(limit).all()
    
    def get_missions_by_property(self, property_id: int) -> List[Mission]:
        """Get all missions for a property"""
        
        return self.db.query(Mission).filter(
            Mission.property_id == property_id
        ).order_by(Mission.created_at.desc()).all()
    
    def get_overdue_missions(self) -> List[Mission]:
        """Get missions that are overdue"""
        
        now = datetime.utcnow()
        
        return self.db.query(Mission).filter(
            Mission.scheduled_date < now,
            Mission.status.in_([MissionStatus.PENDING.value, MissionStatus.ASSIGNED.value, MissionStatus.IN_PROGRESS.value])
        ).all()
    
    def get_mission_stats(self, user: Optional[User] = None) -> Dict[str, Any]:
        """Get mission statistics"""
        
        query = self.db.query(Mission)
        
        if user:
            if user.role == UserRole.SOLDIER:
                # For soldiers, only their assigned missions
                query = query.join(Mission.soldiers).filter(User.id == user.id)
            elif user.role in [UserRole.OFFICER, UserRole.ADMIN]:
                # Officers and admins see all missions
                pass
            else:
                # Other users see missions they created
                query = query.filter(Mission.assigned_by == user.id)
        
        total_missions = query.count()
        
        # Status breakdown
        status_counts = {}
        for status in MissionStatus:
            count = query.filter(Mission.status == status.value).count()
            status_counts[status.value] = count
        
        # Priority breakdown
        priority_counts = {}
        for priority in MissionPriority:
            count = query.filter(Mission.priority == priority.value).count()
            priority_counts[priority.value] = count
        
        # Recent completions (last 30 days)
        thirty_days_ago = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        recent_completions = query.filter(
            Mission.completed_at >= thirty_days_ago,
            Mission.status == MissionStatus.COMPLETED.value
        ).count()
        
        return {
            "total_missions": total_missions,
            "status_breakdown": status_counts,
            "priority_breakdown": priority_counts,
            "recent_completions": recent_completions,
            "overdue_count": len(self.get_overdue_missions())
        }