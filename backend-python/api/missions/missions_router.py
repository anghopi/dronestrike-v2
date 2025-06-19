"""
Mission management endpoints (BOTG operations)
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from models.user import User
from api.dependencies import get_current_user

router = APIRouter()


@router.get("/")
def get_missions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get missions"""
    return {"message": "Missions endpoint - Coming soon"}


@router.post("/")
def create_mission(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create mission"""
    return {"message": "Create mission endpoint - Coming soon"}


@router.get("/{mission_id}")
def get_mission(
    mission_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific mission"""
    return {"message": f"Mission {mission_id} endpoint - Coming soon"}