# Mission model for BOTG (Boots on the Ground) operations. Field operations and property assessments


from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, 
    ForeignKey, Text, Numeric, Table, Index
)
from sqlalchemy.orm import relationship
from decimal import Decimal
import enum

from .base import BaseModel


class MissionStatus(str, enum.Enum):
    """Mission status progression"""
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED = "failed"


class MissionPriority(str, enum.Enum):
    """Mission priority levels"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class MissionType(str, enum.Enum):
    """Types of missions that can be assigned"""
    PROPERTY_ASSESSMENT = "property_assessment"
    PHOTO_DOCUMENTATION = "photo_documentation"
    CONDITION_INSPECTION = "condition_inspection"
    NEIGHBOR_CONTACT = "neighbor_contact"
    MARKET_RESEARCH = "market_research"
    COMPLIANCE_CHECK = "compliance_check"


# Association table for many-to-many relationship between missions and soldiers
mission_soldiers = Table(
    'mission_soldiers',
    BaseModel.metadata,
    Column('mission_id', Integer, ForeignKey('missions.id'), primary_key=True),
    Column('soldier_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('assigned_at', DateTime, nullable=False),
    Column('is_active', Boolean, default=True)
)


class Mission(BaseModel):
    """Mission entity for field operations and property assessments"""
    __tablename__ = "missions"
    
    # Core Relationships
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    assigned_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Mission Details
    type = Column(String(30), nullable=False)  # Store enum as string
    status = Column(String(20), default='pending', nullable=False)
    priority = Column(String(10), default='normal', nullable=False)
    
    # Description & Instructions
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    instructions = Column(Text, nullable=True)
    
    # Scheduling
    scheduled_date = Column(DateTime, nullable=True)
    estimated_duration = Column(Integer, default=60, nullable=False)  # minutes
    
    # Location Data (for tracking start/end points)
    start_latitude = Column(Numeric(9, 6), nullable=True)
    start_longitude = Column(Numeric(9, 6), nullable=True)
    end_latitude = Column(Numeric(9, 6), nullable=True)
    end_longitude = Column(Numeric(9, 6), nullable=True)
    
    # Completion Data
    actual_duration = Column(Integer, nullable=True)  # minutes
    completed_at = Column(DateTime, nullable=True)
    completion_notes = Column(Text, nullable=True)
    
    # Results Tracking
    photos_count = Column(Integer, default=0, nullable=False)
    documents_count = Column(Integer, default=0, nullable=False)
    
    # Quality Assessment
    quality_score = Column(Integer, nullable=True)  # 0-100
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)
    
    # Assignment Tracking
    assigned_at = Column(DateTime, nullable=False)
    
    # Relationships
    property_record = relationship("Property", back_populates="missions")
    assigner = relationship("User", foreign_keys=[assigned_by], back_populates="created_missions")
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    soldiers = relationship(
        "User",
        secondary=mission_soldiers,
        back_populates="assigned_missions"
    )
    
    # Database Indexes
    __table_args__ = (
        Index('ix_mission_status_property', 'status', 'property_id'),
        Index('ix_mission_priority_scheduled', 'priority', 'scheduled_date'),
        Index('ix_mission_assigned_by', 'assigned_by'),
        Index('ix_mission_type_status', 'type', 'status'),
        Index('ix_mission_completed_at', 'completed_at'),
    )
    
    def __repr__(self):
        return f"<Mission(title='{self.title}', status='{self.status}')>"
    
    def is_assigned(self) -> bool:
        """Check if mission is assigned to any soldiers"""
        return len(self.soldiers) > 0
    
    @property
    def is_completed(self) -> bool:
        """Check if mission is completed"""
        return self.status == 'completed'
    
    @property
    def is_in_progress(self) -> bool:
        """Check if mission is in progress"""
        return self.status == 'in_progress'
    
    @property
    def is_overdue(self) -> bool:
        """Check if mission is overdue"""
        if not self.scheduled_date:
            return False
        from datetime import datetime
        return datetime.utcnow() > self.scheduled_date and not self.is_completed
    
    def calculate_duration_efficiency(self) -> float:
        """Calculate efficiency ratio (estimated vs actual duration)"""
        if not self.actual_duration or self.estimated_duration == 0:
            return 1.0
        return self.estimated_duration / self.actual_duration
    
    def get_soldier_ids(self) -> list:
        """Get list of assigned soldier IDs"""
        return [soldier.id for soldier in self.soldiers]


class MissionDocument(BaseModel):
    """Documents and photos attached to missions"""
    __tablename__ = "mission_documents"
    
    mission_id = Column(Integer, ForeignKey("missions.id"), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # File Information
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)  # bytes
    mime_type = Column(String(100), nullable=False)
    
    # Document Metadata
    document_type = Column(String(50), nullable=False)  # photo, document, report
    title = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    
    # GPS and timestamp from device
    capture_latitude = Column(Numeric(9, 6), nullable=True)
    capture_longitude = Column(Numeric(9, 6), nullable=True)
    capture_timestamp = Column(DateTime, nullable=True)
    
    # Relationships
    mission = relationship("Mission")
    uploader = relationship("User")
    
    def __repr__(self):
        return f"<MissionDocument(filename='{self.filename}', mission_id={self.mission_id})>"