"""
Main API router that includes all endpoint modules
"""

from fastapi import APIRouter

from api.auth import auth_router
from api.users import users_router
from api.properties import properties_router
from api.leads import leads_router
from api.targets import targets_router
from api.missions import missions_router
from api.opportunities import opportunities_router
from api.tokens import tokens_router
from api.analytics import analytics_router
from api.tasks import tasks_router
from api.communications import communications_router
from api.marketing import marketing_router
from api.integrations import integrations_router
from api.admin import admin_router
from api.files import files_router
from api.mapbox import mapbox_router
from api.payments import payment_router
from api.websocket import websocket_router

api_router = APIRouter()

# Include all route modules
api_router.include_router(auth_router.router, prefix="/auth", tags=["authentication"])
api_router.include_router(users_router.router, prefix="/users", tags=["users"])
api_router.include_router(properties_router.router, prefix="/properties", tags=["properties"])
api_router.include_router(leads_router.router, prefix="/leads", tags=["leads"])
api_router.include_router(targets_router.router, tags=["targets"])
api_router.include_router(missions_router.router, prefix="/missions", tags=["missions"])
api_router.include_router(opportunities_router.router, prefix="/opportunities", tags=["opportunities"])
api_router.include_router(tokens_router.router, prefix="/tokens", tags=["tokens"])
api_router.include_router(analytics_router.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(tasks_router.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(communications_router.router, prefix="/communications", tags=["communications"])
api_router.include_router(marketing_router.router, prefix="/marketing", tags=["marketing"])
api_router.include_router(integrations_router.router, prefix="/integrations", tags=["integrations"])
api_router.include_router(admin_router.router, prefix="/admin", tags=["admin"])
api_router.include_router(files_router.router, prefix="/files", tags=["files"])
api_router.include_router(mapbox_router.router, tags=["mapbox"])
api_router.include_router(payment_router.router, prefix="/payments", tags=["payments"])
api_router.include_router(websocket_router.router, prefix="/ws", tags=["websocket"])