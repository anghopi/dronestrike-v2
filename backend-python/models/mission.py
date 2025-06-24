# Mission model for BOTG (Boots on the Ground) operations. Field operations and property assessments


from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, 
    ForeignKey, Text, Numeric, Table, Index, Float
)
from sqlalchemy.orm import relationship
from decimal import Decimal
import enum
from datetime import datetime, timedelta
from typing import List, Optional, Dict

from .base import BaseModel


class MissionStatus(str, enum.Enum):
    """Mission status progression - Enhanced from Laravel"""
    NEW = "new"
    PENDING = "pending"
    ASSIGNED = "assigned"
    ACCEPTED = "accepted"
    IN_PROGRESS = "in_progress"
    ON_HOLD = "on_hold"
    PAUSED = "paused"
    COMPLETED = "completed"
    CLOSED = "closed"
    DECLINED = "declined"
    DECLINED_SAFETY = "declined_safety"
    CANCELLED = "cancelled"
    FAILED = "failed"
    HOLD_EXPIRED = "hold_expired"
    CLOSED_FOR_INACTIVITY = "closed_for_inactivity"


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
    LEAD_CONVERSION = "lead_conversion"
    OPPORTUNITY_PURSUIT = "opportunity_pursuit"
    AGREEMENT_GENERATION = "agreement_generation"
    SAFETY_CHECK = "safety_check"


class SafetyLevel(str, enum.Enum):
    """Safety assessment levels"""
    GREEN = "green"
    YELLOW = "yellow"
    RED = "red"


class MissionFilter(str, enum.Enum):
    """Mission filtering options from Laravel"""
    RESIDENTIAL_ONLY = "residential_only"
    COMMERCIAL_ONLY = "commercial_only"
    LAND_ONLY = "land_only"
    RETURNED_POSTCARD_ONLY = "returned_postcard_only"
    LAWSUIT_ONLY = "lawsuit_only"
    IN_FORECLOSURE_ONLY = "in_foreclosure_only"
    EXISTING_LOAN_ONLY = "existing_loan_only"
    WITH_IMPROVEMENTS_ONLY = "with_improvements_only"
    NOT_VISITED_BY_ME_ONLY = "not_visited_by_me_only"
    MOBILE_HOME_ONLY = "mobile_home_only"
    EXCLUDE_MOBILE_HOME = "exclude_mobile_home"


# Association table for many-to-many relationship between missions and soldiers
mission_soldiers = Table(
    'mission_soldiers',
    BaseModel.metadata,
    Column('mission_id', Integer, ForeignKey('missions.id'), primary_key=True),
    Column('soldier_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('assigned_at', DateTime, nullable=False),
    Column('is_active', Boolean, default=True),
    Column('role', String(50), default='soldier'),  # soldier, lead, supervisor
    Index('ix_mission_soldiers_active', 'mission_id', 'is_active')
)


class Mission(BaseModel):
    """Mission entity for field operations and property assessments"""
    __tablename__ = "missions"
    
    # Core Relationships  
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=True)  # Can be null for general missions
    prospect_id = Column(Integer, ForeignKey("leads.id"), nullable=True)  # Laravel compatibility
    assigned_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    device_id = Column(String(100), nullable=True)  # Mobile device tracking
    linked_with = Column(Integer, ForeignKey("missions.id"), nullable=True)  # Mission linking
    link_type = Column(String(50), nullable=True)  # Type of link (follow_up, continuation, etc)
    
    # Mission Details
    type = Column(String(30), nullable=False)  # Store enum as string
    status = Column(String(30), default='new', nullable=False)
    priority = Column(String(10), default='normal', nullable=False)
    safety_level = Column(String(10), default='green', nullable=False)
    duration = Column(Integer, nullable=True)  # Laravel compatibility
    is_ongoing = Column(Boolean, default=False, nullable=False)
    go_to_lead = Column(Boolean, default=False, nullable=False)  # Direct to lead conversion
    
    # Description & Instructions
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    instructions = Column(Text, nullable=True)
    
    # Scheduling
    scheduled_date = Column(DateTime, nullable=True)
    estimated_duration = Column(Integer, default=60, nullable=False)  # minutes
    
    # Location Data (Enhanced GPS tracking)
    start_latitude = Column(Numeric(9, 6), nullable=True)
    start_longitude = Column(Numeric(9, 6), nullable=True)
    end_latitude = Column(Numeric(9, 6), nullable=True)
    end_longitude = Column(Numeric(9, 6), nullable=True)
    lat_created = Column(Numeric(9, 6), nullable=True)  # Laravel compatibility
    lng_created = Column(Numeric(9, 6), nullable=True)
    lat_completed = Column(Numeric(9, 6), nullable=True)
    lng_completed = Column(Numeric(9, 6), nullable=True)
    
    # Completion Data
    actual_duration = Column(Integer, nullable=True)  # minutes
    completed_at = Column(DateTime, nullable=True)
    completion_notes = Column(Text, nullable=True)
    
    # Results Tracking
    photos_count = Column(Integer, default=0, nullable=False)
    documents_count = Column(Integer, default=0, nullable=False)
    
    # Financial Data
    initial_amount_due = Column(Numeric(12, 2), nullable=True)
    purchase_offer = Column(Numeric(12, 2), nullable=True)
    
    # Decline Tracking
    decline_reason_id = Column(Integer, ForeignKey("mission_decline_reasons.id"), nullable=True)
    decline_notes = Column(Text, nullable=True)
    
    # Quality Assessment
    quality_score = Column(Integer, nullable=True)  # 0-100
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)
    
    # Assignment Tracking
    assigned_at = Column(DateTime, nullable=False)
    
    # Relationships
    property_record = relationship("Property", back_populates="missions")
    prospect = relationship("Lead", foreign_keys=[prospect_id])  # Laravel compatibility
    assigner = relationship("User", foreign_keys=[assigned_by], back_populates="created_missions")
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    decline_reason = relationship("MissionDeclineReason", foreign_keys=[decline_reason_id])
    linked_mission = relationship("Mission", remote_side="Mission.id")
    soldiers = relationship(
        "User",
        secondary=mission_soldiers,
        back_populates="assigned_missions"
    )
    routes = relationship("MissionRoute", back_populates="mission", cascade="all, delete-orphan")
    logs = relationship("MissionLog", back_populates="mission", cascade="all, delete-orphan")
    documents = relationship("MissionDocument", back_populates="mission", cascade="all, delete-orphan")
    
    # Database Indexes - Enhanced
    __table_args__ = (
        Index('ix_mission_status_property', 'status', 'property_id'),
        Index('ix_mission_priority_scheduled', 'priority', 'scheduled_date'),
        Index('ix_mission_assigned_by', 'assigned_by'),
        Index('ix_mission_type_status', 'type', 'status'),
        Index('ix_mission_completed_at', 'completed_at'),
        Index('ix_mission_safety_level', 'safety_level'),
        Index('ix_mission_prospect_status', 'prospect_id', 'status'),
        Index('ix_mission_location_created', 'lat_created', 'lng_created'),
        Index('ix_mission_device_status', 'device_id', 'status'),
        Index('ix_mission_go_to_lead', 'go_to_lead'),
        Index('ix_mission_linked_with', 'linked_with'),
    )
    
    def __repr__(self):
        return f"<Mission(title='{self.title}', status='{self.status}')>"
    
    def is_assigned(self) -> bool:
        """Check if mission is assigned to any soldiers"""
        return len(self.soldiers) > 0
    
    @property
    def is_completed(self) -> bool:
        """Check if mission is completed"""
        return self.status in ['completed', 'closed']
    
    @property
    def is_in_progress(self) -> bool:
        """Check if mission is in progress"""
        return self.status == 'in_progress'
    
    @property
    def is_declined(self) -> bool:
        """Check if mission is declined"""
        return self.status in ['declined', 'declined_safety']
    
    @property
    def is_on_hold(self) -> bool:
        """Check if mission is on hold"""
        return self.status in ['on_hold', 'paused']
    
    @property
    def is_overdue(self) -> bool:
        """Check if mission is overdue"""
        if not self.scheduled_date:
            return False
        return datetime.utcnow() > self.scheduled_date and not self.is_completed
    
    @property
    def is_safety_concern(self) -> bool:
        """Check if mission has safety concerns"""
        return self.safety_level in ['yellow', 'red'] or self.status == 'declined_safety'
    
    def calculate_duration_efficiency(self) -> float:
        """Calculate efficiency ratio (estimated vs actual duration)"""
        if not self.actual_duration or self.estimated_duration == 0:
            return 1.0
        return self.estimated_duration / self.actual_duration
    
    def get_soldier_ids(self) -> List[int]:
        """Get list of assigned soldier IDs"""
        return [soldier.id for soldier in self.soldiers]
    
    def can_be_assigned_to(self, user_id: int) -> bool:
        """Check if mission can be assigned to a specific user"""
        return self.status in ['new', 'pending', 'on_hold'] and user_id not in self.get_soldier_ids()
    
    def get_distance_from_point(self, lat: float, lng: float) -> Optional[float]:
        """Calculate distance from a point to mission location"""
        if not self.lat_created or not self.lng_created:
            return None
        
        # Haversine formula for distance calculation
        import math
        R = 6371  # Earth's radius in kilometers
        
        lat1, lng1 = math.radians(float(self.lat_created)), math.radians(float(self.lng_created))
        lat2, lng2 = math.radians(lat), math.radians(lng)
        
        dlat = lat2 - lat1
        dlng = lng2 - lng1
        
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        return R * c
    
    def generate_mission_number(self) -> str:
        """Generate mission number like M-2025-001"""
        from datetime import datetime
        year = datetime.now().year
        return f"M-{year}-{self.id:03d}"


class MissionDeclineReason(BaseModel):
    """Reasons for declining missions"""
    __tablename__ = "mission_decline_reasons"
    
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_safety_related = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    
    def __repr__(self):
        return f"<MissionDeclineReason(name='{self.name}')>"


class MissionRoute(BaseModel):
    """Optimized routes for missions"""
    __tablename__ = "mission_routes"
    
    mission_id = Column(Integer, ForeignKey("missions.id"), nullable=False)
    soldier_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Route Information
    route_name = Column(String(100), nullable=False)
    total_distance = Column(Float, nullable=True)  # kilometers
    estimated_time = Column(Integer, nullable=True)  # minutes
    
    # Route Status
    status = Column(String(20), default='pending', nullable=False)  # pending, active, completed
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Optimization Data
    optimization_score = Column(Float, nullable=True)
    fuel_cost_estimate = Column(Numeric(8, 2), nullable=True)
    
    # Relationships
    mission = relationship("Mission", back_populates="routes")
    soldier = relationship("User")
    points = relationship("MissionRoutePoint", back_populates="route", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<MissionRoute(name='{self.route_name}', mission_id={self.mission_id})>"


class MissionRoutePoint(BaseModel):
    """Individual points in a mission route"""
    __tablename__ = "mission_route_points"
    
    route_id = Column(Integer, ForeignKey("mission_routes.id"), nullable=False)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=True)
    
    # Point Information
    sequence_number = Column(Integer, nullable=False)
    latitude = Column(Numeric(9, 6), nullable=False)
    longitude = Column(Numeric(9, 6), nullable=False)
    address = Column(String(500), nullable=True)
    
    # Point Status
    status = Column(String(20), default='pending', nullable=False)  # pending, visited, skipped
    visited_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    
    # Timing
    estimated_arrival = Column(DateTime, nullable=True)
    actual_arrival = Column(DateTime, nullable=True)
    time_spent = Column(Integer, nullable=True)  # minutes
    
    # Relationships
    route = relationship("MissionRoute", back_populates="points")
    property_record = relationship("Property")
    
    def __repr__(self):
        return f"<MissionRoutePoint(sequence={self.sequence_number}, route_id={self.route_id})>"


class MissionLog(BaseModel):
    """Mission search filters and activity logs"""
    __tablename__ = "mission_logs"
    
    mission_id = Column(Integer, ForeignKey("missions.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Filter Criteria (from Laravel MissionFilter)
    filter_criteria = Column(Text, nullable=True)  # JSON string of applied filters
    search_radius = Column(Float, nullable=True)  # kilometers
    
    # Location Filters
    center_latitude = Column(Numeric(9, 6), nullable=True)
    center_longitude = Column(Numeric(9, 6), nullable=True)
    
    # Property Type Filters
    residential_only = Column(Boolean, default=False)
    commercial_only = Column(Boolean, default=False)
    land_only = Column(Boolean, default=False)
    mobile_home_only = Column(Boolean, default=False)
    exclude_mobile_home = Column(Boolean, default=False)
    
    # Status Filters
    returned_postcard_only = Column(Boolean, default=False)
    lawsuit_only = Column(Boolean, default=False)
    in_foreclosure_only = Column(Boolean, default=False)
    existing_loan_only = Column(Boolean, default=False)
    with_improvements_only = Column(Boolean, default=False)
    not_visited_by_me_only = Column(Boolean, default=False)
    
    # Amount Filters
    amount_due_min = Column(Numeric(12, 2), nullable=True)
    amount_due_max = Column(Numeric(12, 2), nullable=True)
    
    # Activity Log
    action = Column(String(50), nullable=False)  # created, assigned, started, completed, etc.
    description = Column(Text, nullable=True)
    log_metadata = Column(Text, nullable=True)  # JSON metadata
    
    # Relationships
    mission = relationship("Mission", back_populates="logs")
    user = relationship("User")
    
    def __repr__(self):
        return f"<MissionLog(action='{self.action}', mission_id={self.mission_id})>"


class MissionDocument(BaseModel):
    """Documents and photos attached to missions - Enhanced"""
    __tablename__ = "mission_documents"
    
    mission_id = Column(Integer, ForeignKey("missions.id"), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # File Information
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)  # bytes
    mime_type = Column(String(100), nullable=False)
    file_hash = Column(String(64), nullable=True)  # SHA-256 for integrity
    
    # Document Metadata
    document_type = Column(String(50), nullable=False)  # photo, document, report, video
    category = Column(String(50), nullable=True)  # exterior, interior, damage, etc.
    title = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    tags = Column(String(500), nullable=True)  # comma-separated tags
    
    # GPS and timestamp from device
    capture_latitude = Column(Numeric(9, 6), nullable=True)
    capture_longitude = Column(Numeric(9, 6), nullable=True)
    capture_timestamp = Column(DateTime, nullable=True)
    device_info = Column(String(200), nullable=True)  # device make/model
    
    # Processing Status
    processing_status = Column(String(20), default='pending', nullable=False)
    ai_analysis = Column(Text, nullable=True)  # AI-generated analysis
    quality_score = Column(Integer, nullable=True)  # 0-100
    
    # Security and Compliance
    is_encrypted = Column(Boolean, default=False, nullable=False)
    retention_date = Column(DateTime, nullable=True)
    access_level = Column(String(20), default='standard', nullable=False)
    
    # Relationships
    mission = relationship("Mission", back_populates="documents")
    uploader = relationship("User")
    
    def __repr__(self):
        return f"<MissionDocument(filename='{self.filename}', mission_id={self.mission_id})>"