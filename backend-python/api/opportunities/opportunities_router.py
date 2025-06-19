"""
Investment opportunity endpoints
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from models.user import User
from api.dependencies import get_current_user

router = APIRouter()


@router.get("/")
def get_opportunities(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get opportunities"""
    return {"message": "Opportunities endpoint - Coming soon"}


@router.post("/")
def create_opportunity(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create opportunity"""
    return {"message": "Create opportunity endpoint - Coming soon"}


@router.get("/{opportunity_id}")
def get_opportunity(
    opportunity_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific opportunity"""
    return {"message": f"Opportunity {opportunity_id} endpoint - Coming soon"}