"""
Mission management endpoints - Enhanced from Laravel implementation
Comprehensive CRUD operations, filtering, soldier assignment, and mission lifecycle management
"""

from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field

from core.database import get_db
from models.user import User
from models.mission import Mission, MissionStatus, MissionType, MissionPriority, SafetyLevel
from api.dependencies import get_current_user
from services.mission_service import MissionService

router = APIRouter()


# Pydantic Models for Request/Response
class MissionCreateRequest(BaseModel):
    property_id: Optional[int] = None
    prospect_id: Optional[int] = None
    mission_type: str
    title: str
    description: Optional[str] = None
    instructions: Optional[str] = None
    priority: str = "normal"
    safety_level: str = "green"
    scheduled_date: Optional[datetime] = None
    estimated_duration: int = 60
    lat_created: Optional[float] = None
    lng_created: Optional[float] = None
    go_to_lead: bool = False
    initial_amount_due: Optional[Decimal] = None
    filters: Optional[Dict[str, Any]] = None
    device_id: Optional[str] = None


class MissionAssignRequest(BaseModel):
    soldier_ids: List[int]
    create_route: bool = True


class MissionLocationUpdate(BaseModel):
    latitude: float
    longitude: float
    notes: Optional[str] = None


class MissionCompleteRequest(BaseModel):
    latitude: float
    longitude: float
    completion_notes: Optional[str] = None
    purchase_offer: Optional[Decimal] = None
    create_opportunity: bool = False


class MissionDeclineRequest(BaseModel):
    decline_reason_id: int
    decline_notes: Optional[str] = None
    is_safety_related: bool = False


class MissionPauseRequest(BaseModel):
    reason: Optional[str] = None


class MissionResponse(BaseModel):
    id: int
    mission_number: str
    title: str
    description: Optional[str]
    status: str
    priority: str
    safety_level: str
    type: str
    assigned_by: int
    property_id: Optional[int]
    prospect_id: Optional[int]
    scheduled_date: Optional[datetime]
    created_at: datetime
    completed_at: Optional[datetime]
    lat_created: Optional[float]
    lng_created: Optional[float]
    lat_completed: Optional[float]
    lng_completed: Optional[float]
    go_to_lead: bool
    initial_amount_due: Optional[Decimal]
    purchase_offer: Optional[Decimal]
    completion_notes: Optional[str]
    
    class Config:
        from_attributes = True


# Mission CRUD Endpoints
@router.post("/", response_model=MissionResponse)
def create_mission(
    request: MissionCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new mission"""
    
    mission_service = MissionService(db)
    
    try:
        mission = mission_service.create_mission(
            property_id=request.property_id,
            prospect_id=request.prospect_id,
            assigned_by=current_user.id,
            mission_type=request.mission_type,
            title=request.title,
            description=request.description,
            instructions=request.instructions,
            priority=request.priority,
            safety_level=request.safety_level,
            scheduled_date=request.scheduled_date,
            estimated_duration=request.estimated_duration,
            lat_created=request.lat_created,
            lng_created=request.lng_created,
            go_to_lead=request.go_to_lead,
            initial_amount_due=request.initial_amount_due,
            filters=request.filters,
            device_id=request.device_id
        )
        
        # Add mission number
        mission_dict = mission.__dict__.copy()
        mission_dict['mission_number'] = mission.generate_mission_number()
        
        return MissionResponse(**mission_dict)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=List[MissionResponse])
def get_missions(
    status: Optional[str] = Query(None, description="Filter by status"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    safety_level: Optional[str] = Query(None, description="Filter by safety level"),
    assigned_by: Optional[int] = Query(None, description="Filter by assigner"),
    property_id: Optional[int] = Query(None, description="Filter by property"),
    soldier_id: Optional[int] = Query(None, description="Filter by assigned soldier"),
    date_from: Optional[datetime] = Query(None, description="Filter from date"),
    date_to: Optional[datetime] = Query(None, description="Filter to date"),
    lat: Optional[float] = Query(None, description="Center latitude for location search"),
    lng: Optional[float] = Query(None, description="Center longitude for location search"),
    radius_km: Optional[float] = Query(None, description="Search radius in kilometers"),
    limit: int = Query(100, description="Max results"),
    offset: int = Query(0, description="Offset for pagination"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get missions with filtering and pagination"""
    
    mission_service = MissionService(db)
    
    try:
        # For soldiers, filter to their assigned missions if no soldier_id specified
        if current_user.role == "soldier" and not soldier_id:
            soldier_id = current_user.id
        
        if soldier_id:
            # Get missions for specific soldier
            status_filter = [status] if status else None
            missions = mission_service.get_missions_for_soldier(
                soldier_id=soldier_id,
                status_filter=status_filter,
                include_completed=True
            )
            missions = missions[offset:offset+limit]  # Simple pagination
        else:
            # Get missions by criteria
            missions, total = mission_service.get_missions_by_criteria(
                status=status,
                priority=priority,
                safety_level=safety_level,
                assigned_by=assigned_by,
                property_id=property_id,
                date_from=date_from,
                date_to=date_to,
                lat=lat,
                lng=lng,
                radius_km=radius_km,
                limit=limit,
                offset=offset
            )
        
        # Convert to response format
        response_missions = []
        for mission in missions:
            mission_dict = mission.__dict__.copy()
            mission_dict['mission_number'] = mission.generate_mission_number()
            response_missions.append(MissionResponse(**mission_dict))
        
        return response_missions
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{mission_id}", response_model=MissionResponse)
def get_mission(
    mission_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific mission by ID"""
    
    mission_service = MissionService(db)
    
    mission = mission_service.get_mission_by_id(mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    
    # Check permissions - soldiers can only see their assigned missions
    if current_user.role == "soldier" and current_user.id not in mission.get_soldier_ids():
        raise HTTPException(status_code=403, detail="Access denied")
    
    mission_dict = mission.__dict__.copy()
    mission_dict['mission_number'] = mission.generate_mission_number()
    
    return MissionResponse(**mission_dict)


@router.patch("/{mission_id}/assign")
def assign_mission(
    mission_id: int,
    request: MissionAssignRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Assign mission to soldiers"""
    
    # Check permissions - only admins and officers can assign missions
    if current_user.role not in ["admin", "officer"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    mission_service = MissionService(db)
    
    try:
        mission = mission_service.assign_mission(
            mission_id=mission_id,
            soldier_ids=request.soldier_ids,
            assigned_by=current_user.id,
            create_route=request.create_route
        )
        
        return {"message": f"Mission assigned to {len(request.soldier_ids)} soldiers", "mission_id": mission.id}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Mission Lifecycle Endpoints
@router.patch("/{mission_id}/start")
def start_mission(
    mission_id: int,
    request: MissionLocationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Start mission execution"""
    
    mission_service = MissionService(db)
    
    try:
        mission = mission_service.start_mission(
            mission_id=mission_id,
            soldier_id=current_user.id,
            lat=request.latitude,
            lng=request.longitude
        )
        
        return {"message": "Mission started", "mission_id": mission.id, "status": mission.status}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{mission_id}/complete")
def complete_mission(
    mission_id: int,
    request: MissionCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Complete mission"""
    
    mission_service = MissionService(db)
    
    try:
        mission = mission_service.complete_mission(
            mission_id=mission_id,
            soldier_id=current_user.id,
            lat=request.latitude,
            lng=request.longitude,
            completion_notes=request.completion_notes,
            purchase_offer=request.purchase_offer,
            create_opportunity=request.create_opportunity
        )
        
        return {"message": "Mission completed", "mission_id": mission.id, "status": mission.status}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{mission_id}/decline")
def decline_mission(
    mission_id: int,
    request: MissionDeclineRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Decline mission"""
    
    mission_service = MissionService(db)
    
    try:
        mission = mission_service.decline_mission(
            mission_id=mission_id,
            soldier_id=current_user.id,
            decline_reason_id=request.decline_reason_id,
            decline_notes=request.decline_notes,
            is_safety_related=request.is_safety_related
        )
        
        return {"message": "Mission declined", "mission_id": mission.id, "status": mission.status}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{mission_id}/pause")
def pause_mission(
    mission_id: int,
    request: MissionPauseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Pause mission"""
    
    mission_service = MissionService(db)
    
    try:
        mission = mission_service.pause_mission(
            mission_id=mission_id,
            soldier_id=current_user.id,
            reason=request.reason
        )
        
        return {"message": "Mission paused", "mission_id": mission.id, "status": mission.status}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{mission_id}/resume")
def resume_mission(
    mission_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Resume paused mission"""
    
    mission_service = MissionService(db)
    
    try:
        mission = mission_service.resume_mission(
            mission_id=mission_id,
            soldier_id=current_user.id
        )
        
        return {"message": "Mission resumed", "mission_id": mission.id, "status": mission.status}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{mission_id}/hold")
def put_mission_on_hold(
    mission_id: int,
    request: MissionPauseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Put mission on hold"""
    
    # Check permissions - only admins and officers can put missions on hold
    if current_user.role not in ["admin", "officer"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    mission_service = MissionService(db)
    
    try:
        mission = mission_service.put_mission_on_hold(
            mission_id=mission_id,
            user_id=current_user.id,
            reason=request.reason
        )
        
        return {"message": "Mission put on hold", "mission_id": mission.id, "status": mission.status}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Special Endpoints from Laravel
@router.get("/soldiers/onhold")
def get_missions_on_hold(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get missions on hold for soldier"""
    
    mission_service = MissionService(db)
    
    try:
        missions = mission_service.get_missions_on_hold(
            soldier_id=current_user.id if current_user.role == "soldier" else None
        )
        
        response_missions = []
        for mission in missions:
            mission_dict = mission.__dict__.copy()
            mission_dict['mission_number'] = mission.generate_mission_number()
            response_missions.append(MissionResponse(**mission_dict))
        
        return response_missions
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/decline-reasons")
def get_decline_reasons(
    safety_only: bool = Query(False, description="Get only safety-related reasons"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get available decline reasons"""
    
    mission_service = MissionService(db)
    
    try:
        reasons = mission_service.get_decline_reasons(safety_only=safety_only)
        
        return [
            {
                "id": reason.id,
                "name": reason.name,
                "description": reason.description,
                "is_safety_related": reason.is_safety_related,
                "sort_order": reason.sort_order
            }
            for reason in reasons
        ]
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/statistics")
def get_mission_statistics(
    soldier_id: Optional[int] = Query(None, description="Get stats for specific soldier"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get mission statistics"""
    
    mission_service = MissionService(db)
    
    try:
        # For soldiers, only show their own stats
        if current_user.role == "soldier":
            soldier_id = current_user.id
        
        stats = mission_service.get_mission_statistics(soldier_id=soldier_id)
        
        return stats
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# File Upload Endpoints
@router.post("/{mission_id}/photos")
async def upload_mission_photo(
    mission_id: int,
    file: UploadFile = File(...),
    latitude: Optional[float] = Query(None),
    longitude: Optional[float] = Query(None),
    description: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload photo for mission"""
    
    mission_service = MissionService(db)
    
    # Verify mission exists and user has access
    mission = mission_service.get_mission_by_id(mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    
    if current_user.role == "soldier" and current_user.id not in mission.get_soldier_ids():
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        # TODO: Implement file upload logic
        # This would typically save to S3 or local storage
        # and create a MissionDocument record
        
        return {
            "message": "Photo uploaded successfully",
            "mission_id": mission_id,
            "filename": file.filename,
            "size": file.size,
            "location": {"lat": latitude, "lng": longitude} if latitude and longitude else None
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{mission_id}/documents")
async def upload_mission_document(
    mission_id: int,
    file: UploadFile = File(...),
    document_type: str = Query("document", description="Type of document"),
    title: Optional[str] = Query(None),
    description: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload document for mission"""
    
    mission_service = MissionService(db)
    
    # Verify mission exists and user has access
    mission = mission_service.get_mission_by_id(mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    
    if current_user.role == "soldier" and current_user.id not in mission.get_soldier_ids():
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        # TODO: Implement file upload logic
        # This would typically save to S3 or local storage
        # and create a MissionDocument record
        
        return {
            "message": "Document uploaded successfully",
            "mission_id": mission_id,
            "filename": file.filename,
            "size": file.size,
            "document_type": document_type
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Admin Endpoints (from Laravel)
@router.get("/admin/{user_id}/latest")
def get_latest_mission_for_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get latest mission for a user (admin endpoint)"""
    
    # Check permissions
    if current_user.role not in ["admin", "officer"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    mission_service = MissionService(db)
    
    try:
        missions = mission_service.get_missions_for_soldier(
            soldier_id=user_id,
            status_filter=None,
            include_completed=True
        )
        
        if not missions:
            raise HTTPException(status_code=404, detail="No missions found for user")
        
        latest_mission = missions[0]  # Already sorted by date
        mission_dict = latest_mission.__dict__.copy()
        mission_dict['mission_number'] = latest_mission.generate_mission_number()
        
        return MissionResponse(**mission_dict)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{mission_id}/logs")
def get_mission_logs(
    mission_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get mission activity logs"""
    
    mission_service = MissionService(db)
    
    # Verify mission exists and user has access
    mission = mission_service.get_mission_by_id(mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    
    if current_user.role == "soldier" and current_user.id not in mission.get_soldier_ids():
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        logs = db.query(mission_service.db.query(mission.logs)).all()
        
        return [
            {
                "id": log.id,
                "action": log.action,
                "description": log.description,
                "user_id": log.user_id,
                "created_at": log.created_at,
                "metadata": log.metadata
            }
            for log in logs
        ]
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{mission_id}/routes")
def get_mission_routes(
    mission_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get mission routes"""
    
    mission_service = MissionService(db)
    
    # Verify mission exists and user has access
    mission = mission_service.get_mission_by_id(mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    
    if current_user.role == "soldier" and current_user.id not in mission.get_soldier_ids():
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        routes = mission.routes
        
        return [
            {
                "id": route.id,
                "route_name": route.route_name,
                "soldier_id": route.soldier_id,
                "status": route.status,
                "total_distance": route.total_distance,
                "estimated_time": route.estimated_time,
                "started_at": route.started_at,
                "completed_at": route.completed_at,
                "points": [
                    {
                        "id": point.id,
                        "sequence_number": point.sequence_number,
                        "latitude": float(point.latitude),
                        "longitude": float(point.longitude),
                        "address": point.address,
                        "status": point.status,
                        "visited_at": point.visited_at,
                        "notes": point.notes
                    }
                    for point in route.points
                ]
            }
            for route in routes
        ]
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))