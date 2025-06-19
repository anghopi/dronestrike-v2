from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from core.database import get_db
from models.lead import Lead, LeadStatus, WorkflowStage
from models.property import Property
from api.dependencies import get_current_user

router = APIRouter(prefix="/api/targets", tags=["targets"])

@router.get("/")
async def get_targets(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("created_at"),
    sort_direction: Optional[str] = Query("desc"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100)
):
    """Get targets (leads with property info) with filtering and pagination"""
    try:
        # Base query joining leads with properties
        query = db.query(Lead).join(Property, Lead.property_id == Property.id, isouter=True)
        
        # Apply filters
        if search:
            query = query.filter(
                (Lead.first_name.ilike(f"%{search}%")) |
                (Lead.last_name.ilike(f"%{search}%")) |
                (Lead.email.ilike(f"%{search}%")) |
                (Lead.mailing_city.ilike(f"%{search}%"))
            )
        
        if status:
            query = query.filter(Lead.lead_status == status)
        
        # Apply sorting
        if sort_direction == "desc":
            if sort_by == "name":
                query = query.order_by(Lead.first_name.desc())
            elif sort_by == "score":
                query = query.order_by(Lead.score_value.desc())
            else:
                query = query.order_by(Lead.created_at.desc())
        else:
            if sort_by == "name":
                query = query.order_by(Lead.first_name.asc())
            elif sort_by == "score":
                query = query.order_by(Lead.score_value.asc())
            else:
                query = query.order_by(Lead.created_at.asc())
        
        # Get total count before pagination
        total = query.count()
        
        # Apply pagination
        offset = (page - 1) * limit
        leads = query.offset(offset).limit(limit).all()
        
        # Format response to match frontend expectations
        targets = []
        for lead in leads:
            target = {
                "id": lead.id,
                "name": f"{lead.first_name} {lead.last_name}",
                "email": lead.email or "",
                "phone": lead.phone_cell or lead.phone_other or "",
                "address": lead.mailing_address_1,
                "city": lead.mailing_city,
                "state": lead.mailing_state,
                "zip": lead.mailing_zip5,
                "property_type": "Single Family",  # Default for now
                "estimated_value": 0,  # Will be from property record
                "tax_delinquent": False,  # Will be from property record
                "delinquent_amount": 0,
                "owner_occupied": False,
                "last_contact": lead.last_contact.isoformat() if lead.last_contact else None,
                "contact_attempts": 0,  # Add to lead model
                "status": _map_status_to_frontend(lead.lead_status),
                "priority": _get_priority_from_score(lead.score_value),
                "lead_score": lead.score_value,
                "notes": lead.notes or "",
                "tags": [],  # Add tags functionality
                "assigned_to": lead.owner.username if lead.owner else "Unassigned",
                "created_at": lead.created_at.isoformat(),
                "updated_at": lead.updated_at.isoformat() if lead.updated_at else lead.created_at.isoformat()
            }
            
            # Add property information if available
            if lead.property_record:
                target.update({
                    "property_type": lead.property_record.property_type or "Single Family",
                    "estimated_value": float(lead.property_record.estimated_value or 0),
                    "tax_delinquent": bool(lead.property_record.tax_delinquent),
                    "delinquent_amount": float(lead.property_record.delinquent_amount or 0),
                    "owner_occupied": bool(lead.property_record.owner_occupied)
                })
            
            targets.append(target)
        
        return {
            "count": total,
            "results": targets,
            "stats": _calculate_target_stats(db)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching targets: {str(e)}")

@router.get("/{target_id}")
async def get_target(
    target_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get a specific target by ID"""
    try:
        lead = db.query(Lead).filter(Lead.id == target_id).first()
        if not lead:
            raise HTTPException(status_code=404, detail="Target not found")
        
        # Format single target response
        target = {
            "id": lead.id,
            "name": f"{lead.first_name} {lead.last_name}",
            "first_name": lead.first_name,
            "last_name": lead.last_name,
            "email": lead.email,
            "phone_cell": lead.phone_cell,
            "phone_other": lead.phone_other,
            "mailing_address_1": lead.mailing_address_1,
            "mailing_address_2": lead.mailing_address_2,
            "mailing_city": lead.mailing_city,
            "mailing_state": lead.mailing_state,
            "mailing_zip5": lead.mailing_zip5,
            "lead_status": lead.lead_status,
            "workflow_stage": lead.workflow_stage,
            "score_value": lead.score_value,
            "notes": lead.notes,
            "last_contact": lead.last_contact.isoformat() if lead.last_contact else None,
            "created_at": lead.created_at.isoformat(),
            "updated_at": lead.updated_at.isoformat() if lead.updated_at else None,
            "property": None
        }
        
        # Add property information if available
        if lead.property_record:
            target["property"] = {
                "id": lead.property_record.id,
                "property_type": lead.property_record.property_type,
                "estimated_value": float(lead.property_record.estimated_value or 0),
                "tax_delinquent": bool(lead.property_record.tax_delinquent),
                "delinquent_amount": float(lead.property_record.delinquent_amount or 0),
                "owner_occupied": bool(lead.property_record.owner_occupied)
            }
        
        return target
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching target: {str(e)}")

@router.post("/actions/")
async def perform_target_actions(
    action: str,
    target_ids: List[int],
    data: dict = {},
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Perform bulk actions on targets"""
    try:
        leads = db.query(Lead).filter(Lead.id.in_(target_ids)).all()
        if not leads:
            raise HTTPException(status_code=404, detail="No targets found")
        
        result = {"success": True, "affected_count": len(leads), "message": ""}
        
        if action == "update_status":
            new_status = data.get("status")
            if new_status not in [status.value for status in LeadStatus]:
                raise HTTPException(status_code=400, detail="Invalid status")
            
            for lead in leads:
                lead.lead_status = new_status
                lead.updated_at = datetime.utcnow()
            
            result["message"] = f"Updated status to {new_status} for {len(leads)} targets"
        
        elif action == "assign_agent":
            agent_id = data.get("agent_id")
            if not agent_id:
                raise HTTPException(status_code=400, detail="Agent ID required")
            
            for lead in leads:
                lead.owner_id = int(agent_id)
                lead.updated_at = datetime.utcnow()
            
            result["message"] = f"Assigned {len(leads)} targets to agent"
        
        elif action == "add_tags":
            # Implement tag functionality when ready
            result["message"] = f"Tags functionality not yet implemented"
        
        else:
            raise HTTPException(status_code=400, detail=f"Unknown action: {action}")
        
        db.commit()
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error performing action: {str(e)}")

def _map_status_to_frontend(backend_status: str) -> str:
    """Map backend lead status to frontend target status"""
    status_map = {
        "target_acquired": "New",
        "initial_contact": "Contacted", 
        "interested": "Interested",
        "not_interested": "Not Interested",
        "do_not_contact": "Not Interested",
        "qualified": "Interested",
        "negotiation": "Follow Up",
        "closed_won": "Closed",
        "closed_lost": "Closed"
    }
    return status_map.get(backend_status, "New")

def _get_priority_from_score(score: int) -> str:
    """Determine priority based on lead score"""
    if score >= 90:
        return "Critical"
    elif score >= 75:
        return "High"
    elif score >= 50:
        return "Medium"
    else:
        return "Low"

def _calculate_target_stats(db: Session) -> dict:
    """Calculate target statistics"""
    try:
        total_targets = db.query(Lead).count()
        high_priority = db.query(Lead).filter(Lead.score_value >= 75).count()
        tax_delinquent = db.query(Lead).join(Property).filter(Property.tax_delinquent == True).count()
        interested = db.query(Lead).filter(Lead.lead_status.in_(["interested", "qualified"])).count()
        avg_score = db.query(Lead.score_value).filter(Lead.score_value > 0).scalar() or 0
        
        return {
            "total_targets": total_targets,
            "high_priority": high_priority,
            "tax_delinquent": tax_delinquent,
            "interested": interested,
            "avg_lead_score": float(avg_score)
        }
    except Exception:
        return {
            "total_targets": 0,
            "high_priority": 0,
            "tax_delinquent": 0,
            "interested": 0,
            "avg_lead_score": 0.0
        }