"""
Property management endpoints
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from models.user import User
from api.dependencies import get_current_user

router = APIRouter()


@router.get("/")
def get_properties(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get properties"""
    return {"message": "Properties endpoint - Coming soon"}


@router.post("/")
def create_property(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create property"""
    return {"message": "Create property endpoint - Coming soon"}


@router.get("/{property_id}")
def get_property(
    property_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific property"""
    return {"message": f"Property {property_id} endpoint - Coming soon"}