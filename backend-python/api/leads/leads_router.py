# Lead management endpoints
# Handles lead CRUD operations, scoring, and workflow progression

from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from datetime import datetime, date
from decimal import Decimal

from core.database import get_db
from models.user import User
from models.lead import Lead, LeadStatus, OwnerType, WorkflowStage
from services.base import BaseService
from api.dependencies import get_current_user, get_current_officer_or_admin

router = APIRouter()

# Pydantic models
class LeadCreate(BaseModel):
    property_id: Optional[int] = None
    first_name: str
    last_name: str
    owner_type: Optional[OwnerType] = None
    email: Optional[EmailStr] = None
    phone_cell: Optional[str] = None
    phone_other: Optional[str] = None
    birth_date: Optional[date] = None
    mailing_address_1: str
    mailing_address_2: Optional[str] = None
    mailing_street: Optional[str] = None
    mailing_city: str
    mailing_state: str
    mailing_zip5: str
    mailing_zip4: Optional[str] = None
    has_mortgage: bool = False
    monthly_income: Optional[Decimal] = None
    notes: Optional[str] = None
    source_batch: Optional[str] = None


class LeadUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone_cell: Optional[str] = None
    phone_other: Optional[str] = None
    lead_status: Optional[LeadStatus] = None
    notes: Optional[str] = None
    monthly_income: Optional[Decimal] = None
    has_mortgage: Optional[bool] = None


class LeadResponse(BaseModel):
    id: int
    owner_id: int
    property_id: Optional[int]
    first_name: str
    last_name: str
    full_name: str
    owner_type: Optional[str]
    email: Optional[str]
    phone_cell: Optional[str]
    primary_phone: Optional[str]
    mailing_address_1: str
    mailing_city: str
    mailing_state: str
    mailing_zip5: str
    full_mailing_address: str
    lead_status: str
    workflow_stage: str
    score_value: int
    is_qualified: bool
    can_contact: bool
    last_contact: Optional[datetime]
    notes: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]


class LeadScoreUpdate(BaseModel):
    score: int


class WorkflowStageUpdate(BaseModel):
    stage: WorkflowStage


class LeadListResponse(BaseModel):
    leads: List[LeadResponse]
    total: int
    page: int
    size: int


@router.get("/", response_model=LeadListResponse)
def get_leads(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: Optional[LeadStatus] = None,
    workflow_stage: Optional[WorkflowStage] = None,
    min_score: Optional[int] = Query(None, ge=0, le=100),
    city: Optional[str] = None,
    state: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Get leads with filtering and pagination"""
    
    lead_service = BaseService(Lead, db)
    
    # Build filters
    filters = {"owner_id": current_user.id}
    
    if status:
        filters["lead_status"] = status.value
    if workflow_stage:
        filters["workflow_stage"] = workflow_stage.value
    if city:
        filters["mailing_city"] = city
    if state:
        filters["mailing_state"] = state
    
    # Get leads with pagination
    skip = (page - 1) * size
    leads = lead_service.get_multi(skip=skip, limit=size, filters=filters)
    total = lead_service.count(filters=filters)
    
    # Apply additional filters that require custom queries
    if min_score is not None:
        leads = [lead for lead in leads if lead.score_value >= min_score]
    
    if search:
        search_lower = search.lower()
        leads = [
            lead for lead in leads 
            if (search_lower in f"{lead.first_name} {lead.last_name}".lower() or
                search_lower in lead.mailing_address_1.lower() or
                search_lower in lead.mailing_city.lower())
        ]
    
    # Convert to response format
    lead_responses = []
    for lead in leads:
        lead_responses.append(LeadResponse(
            id=lead.id,
            owner_id=lead.owner_id,
            property_id=lead.property_id,
            first_name=lead.first_name,
            last_name=lead.last_name,
            full_name=lead.full_name,
            owner_type=lead.owner_type,
            email=lead.email,
            phone_cell=lead.phone_cell,
            primary_phone=lead.primary_phone,
            mailing_address_1=lead.mailing_address_1,
            mailing_city=lead.mailing_city,
            mailing_state=lead.mailing_state,
            mailing_zip5=lead.mailing_zip5,
            full_mailing_address=lead.full_mailing_address,
            lead_status=lead.lead_status,
            workflow_stage=lead.workflow_stage,
            score_value=lead.score_value,
            is_qualified=lead.is_qualified,
            can_contact=lead.can_contact,
            last_contact=lead.last_contact,
            notes=lead.notes,
            created_at=lead.created_at,
            updated_at=lead.updated_at
        ))
    
    return LeadListResponse(
        leads=lead_responses,
        total=total,
        page=page,
        size=size
    )


@router.post("/", response_model=LeadResponse)
def create_lead(
    lead_data: LeadCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Create a new lead"""
    
    lead_service = BaseService(Lead, db)
    
    # Add owner_id from current user
    lead_dict = lead_data.dict()
    lead_dict["owner_id"] = current_user.id
    
    # Set original address fields
    lead_dict["original_address1"] = lead_dict["mailing_address_1"]
    lead_dict["original_city"] = lead_dict["mailing_city"]
    lead_dict["original_state"] = lead_dict["mailing_state"]
    lead_dict["original_zip"] = lead_dict["mailing_zip5"]
    
    lead = lead_service.create(lead_dict)
    
    return LeadResponse(
        id=lead.id,
        owner_id=lead.owner_id,
        property_id=lead.property_id,
        first_name=lead.first_name,
        last_name=lead.last_name,
        full_name=lead.full_name,
        owner_type=lead.owner_type,
        email=lead.email,
        phone_cell=lead.phone_cell,
        primary_phone=lead.primary_phone,
        mailing_address_1=lead.mailing_address_1,
        mailing_city=lead.mailing_city,
        mailing_state=lead.mailing_state,
        mailing_zip5=lead.mailing_zip5,
        full_mailing_address=lead.full_mailing_address,
        lead_status=lead.lead_status,
        workflow_stage=lead.workflow_stage,
        score_value=lead.score_value,
        is_qualified=lead.is_qualified,
        can_contact=lead.can_contact,
        last_contact=lead.last_contact,
        notes=lead.notes,
        created_at=lead.created_at,
        updated_at=lead.updated_at
    )


@router.get("/{lead_id}", response_model=LeadResponse)
def get_lead(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Get a specific lead"""
    
    lead_service = BaseService(Lead, db)
    lead = lead_service.get_or_404(lead_id)
    
    # Check ownership
    if lead.owner_id != current_user.id and current_user.role not in ["admin", "officer"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this lead"
        )
    
    return LeadResponse(
        id=lead.id,
        owner_id=lead.owner_id,
        property_id=lead.property_id,
        first_name=lead.first_name,
        last_name=lead.last_name,
        full_name=lead.full_name,
        owner_type=lead.owner_type,
        email=lead.email,
        phone_cell=lead.phone_cell,
        primary_phone=lead.primary_phone,
        mailing_address_1=lead.mailing_address_1,
        mailing_city=lead.mailing_city,
        mailing_state=lead.mailing_state,
        mailing_zip5=lead.mailing_zip5,
        full_mailing_address=lead.full_mailing_address,
        lead_status=lead.lead_status,
        workflow_stage=lead.workflow_stage,
        score_value=lead.score_value,
        is_qualified=lead.is_qualified,
        can_contact=lead.can_contact,
        last_contact=lead.last_contact,
        notes=lead.notes,
        created_at=lead.created_at,
        updated_at=lead.updated_at
    )


@router.put("/{lead_id}", response_model=LeadResponse)
def update_lead(
    lead_id: int,
    lead_data: LeadUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Update a lead"""
    
    lead_service = BaseService(Lead, db)
    lead = lead_service.get_or_404(lead_id)
    
    # Check ownership
    if lead.owner_id != current_user.id and current_user.role not in ["admin", "officer"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this lead"
        )
    
    # Update lead
    update_data = lead_data.dict(exclude_unset=True)
    if update_data:
        lead = lead_service.update(lead, update_data)
    
    return LeadResponse(
        id=lead.id,
        owner_id=lead.owner_id,
        property_id=lead.property_id,
        first_name=lead.first_name,
        last_name=lead.last_name,
        full_name=lead.full_name,
        owner_type=lead.owner_type,
        email=lead.email,
        phone_cell=lead.phone_cell,
        primary_phone=lead.primary_phone,
        mailing_address_1=lead.mailing_address_1,
        mailing_city=lead.mailing_city,
        mailing_state=lead.mailing_state,
        mailing_zip5=lead.mailing_zip5,
        full_mailing_address=lead.full_mailing_address,
        lead_status=lead.lead_status,
        workflow_stage=lead.workflow_stage,
        score_value=lead.score_value,
        is_qualified=lead.is_qualified,
        can_contact=lead.can_contact,
        last_contact=lead.last_contact,
        notes=lead.notes,
        created_at=lead.created_at,
        updated_at=lead.updated_at
    )


@router.post("/{lead_id}/score")
def update_lead_score(
    lead_id: int,
    score_data: LeadScoreUpdate,
    current_user: User = Depends(get_current_officer_or_admin),
    db: Session = Depends(get_db)
) -> Any:
    """Update lead AI score (officer/admin only)"""
    
    lead_service = BaseService(Lead, db)
    lead = lead_service.get_or_404(lead_id)
    
    # Update score
    lead.update_score(score_data.score)
    db.commit()
    
    return {"message": "Lead score updated successfully", "new_score": lead.score_value}


@router.post("/{lead_id}/workflow")
def advance_workflow_stage(
    lead_id: int,
    stage_data: WorkflowStageUpdate,
    current_user: User = Depends(get_current_officer_or_admin),
    db: Session = Depends(get_db)
) -> Any:
    """Advance lead to next workflow stage (officer/admin only)"""
    
    lead_service = BaseService(Lead, db)
    lead = lead_service.get_or_404(lead_id)
    
    # Advance workflow stage
    lead.advance_workflow_stage(stage_data.stage)
    db.commit()
    
    return {"message": "Workflow stage advanced", "new_stage": lead.workflow_stage}


@router.delete("/{lead_id}")
def delete_lead(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Delete a lead"""
    
    lead_service = BaseService(Lead, db)
    lead = lead_service.get_or_404(lead_id)
    
    # Check ownership or admin
    if lead.owner_id != current_user.id and current_user.role not in ["admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this lead"
        )
    
    lead_service.delete(lead_id)
    return {"message": "Lead deleted successfully"}