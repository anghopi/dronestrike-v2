#Task Management API endpoints

from typing import Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, validator
from datetime import datetime, date
from enum import Enum

from core.database import get_db
from models.user import User
from api.dependencies import get_current_user, get_current_officer_or_admin

router = APIRouter()
# Enums
class TaskStatus(str, Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    DONE = "done"
    CANCELLED = "cancelled"


class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


# Pydantic models
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    assignee_id: Optional[int] = None
    due_date: Optional[date] = None
    
    @validator('title')
    def validate_title(cls, v):
        if not v or not v.strip():
            raise ValueError('Title is required')
        return v.strip()


# Task endpoints
@router.post("/")
async def create_task(
    task_data: TaskCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Create a new task"""
    try:
        # Mock implementation
        return {
            "id": 1,
            "title": task_data.title,
            "description": task_data.description,
            "status": task_data.status,
            "priority": task_data.priority,
            "assignee_id": task_data.assignee_id,
            "due_date": task_data.due_date.isoformat() if task_data.due_date else None,
            "created_by": current_user.id,
            "created_at": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create task: {str(e)}"
        )


@router.get("/")
async def get_tasks(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    status_filter: Optional[List[TaskStatus]] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100)
) -> Any:
    """Get tasks with filtering and pagination"""
    try:
        # Mock implementation
        return {
            "tasks": [
                {
                    "id": 1,
                    "title": "Sample Task",
                    "status": TaskStatus.TODO,
                    "priority": TaskPriority.MEDIUM,
                    "created_at": datetime.now().isoformat()
                }
            ],
            "total": 1,
            "page": page,
            "limit": limit
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch tasks: {str(e)}"
        )


@router.get("/kanban")
async def get_kanban_board(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Get tasks organized in kanban board format"""
    try:
        # Mock implementation
        return {
            "todo": [],
            "in_progress": [],
            "review": [],
            "done": []
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch kanban board: {str(e)}"
        )