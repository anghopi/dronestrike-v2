"""
WebSocket routing for DroneStrike v2
"""

from django.urls import re_path
from . import websocket_service

websocket_urlpatterns = [
    re_path(r'ws/dronestrike/$', websocket_service.DroneStrikeWebSocketConsumer.as_asgi()),
]