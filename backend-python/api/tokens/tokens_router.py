"""
Token system endpoints
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from models.user import User
from api.dependencies import get_current_user

router = APIRouter()


@router.get("/")
def get_token_transactions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get token transactions"""
    return {"message": "Token transactions endpoint - Coming soon"}


@router.post("/purchase")
def purchase_tokens(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Purchase tokens"""
    return {"message": "Purchase tokens endpoint - Coming soon"}


@router.get("/balance")
def get_token_balance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current token balance"""
    return {
        "regular_tokens": current_user.tokens,
        "mail_tokens": current_user.mail_tokens,
        "total_tokens": current_user.tokens + current_user.mail_tokens
    }