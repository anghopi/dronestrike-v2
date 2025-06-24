"""
WebSocket Service - Real-Time Communication System
Handles WebSocket connections, message broadcasting, and real-time updates
"""

import json
import asyncio
import logging
from typing import Dict, List, Set, Optional, Any, Union
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
import uuid
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
import redis
import jwt

from core.config import settings
from models.user import User

logger = logging.getLogger(__name__)


class MessageType(str, Enum):
    """WebSocket message types"""
    # Authentication
    AUTHENTICATE = "authenticate"
    AUTHENTICATION_SUCCESS = "authentication_success"
    AUTHENTICATION_FAILED = "authentication_failed"
    
    # Connection management
    JOIN_ROOM = "join_room"
    LEAVE_ROOM = "leave_room"
    PING = "ping"
    PONG = "pong"
    
    # Mission updates
    MISSION_CREATED = "mission_created"
    MISSION_UPDATED = "mission_updated"
    MISSION_STATUS_CHANGED = "mission_status_changed"
    MISSION_ASSIGNED = "mission_assigned"
    MISSION_STARTED = "mission_started"
    MISSION_COMPLETED = "mission_completed"
    MISSION_DECLINED = "mission_declined"
    
    # Location tracking
    LOCATION_UPDATE = "location_update"
    ROUTE_UPDATE = "route_update"
    GPS_TRACKING = "gps_tracking"
    
    # File uploads
    PHOTO_UPLOADED = "photo_uploaded"
    DOCUMENT_UPLOADED = "document_uploaded"
    FILE_PROCESSED = "file_processed"
    
    # Notifications
    NOTIFICATION = "notification"
    ALERT = "alert"
    EMERGENCY_ALERT = "emergency_alert"
    SYSTEM_NOTIFICATION = "system_notification"
    
    # Communication
    CHAT_MESSAGE = "chat_message"
    BROADCAST = "broadcast"
    DIRECT_MESSAGE = "direct_message"
    
    # Analytics
    STATS_UPDATE = "stats_update"
    PERFORMANCE_UPDATE = "performance_update"
    
    # System
    CONNECTION_COUNT = "connection_count"
    USER_ONLINE = "user_online"
    USER_OFFLINE = "user_offline"
    
    # Errors
    ERROR = "error"
    INVALID_MESSAGE = "invalid_message"


@dataclass
class WebSocketMessage:
    """WebSocket message structure"""
    type: MessageType
    payload: Dict[str, Any]
    timestamp: str = None
    user_id: Optional[int] = None
    mission_id: Optional[int] = None
    room: Optional[str] = None
    message_id: str = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow().isoformat()
        if self.message_id is None:
            self.message_id = str(uuid.uuid4())
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    def to_json(self) -> str:
        return json.dumps(self.to_dict())


@dataclass
class WebSocketConnection:
    """WebSocket connection information"""
    websocket: WebSocket
    user_id: Optional[int] = None
    user: Optional[User] = None
    rooms: Set[str] = None
    connected_at: datetime = None
    last_ping: datetime = None
    authenticated: bool = False
    
    def __post_init__(self):
        if self.rooms is None:
            self.rooms = set()
        if self.connected_at is None:
            self.connected_at = datetime.utcnow()
        if self.last_ping is None:
            self.last_ping = datetime.utcnow()


class WebSocketConnectionManager:
    """Manages WebSocket connections and message broadcasting"""
    
    def __init__(self):
        # Active connections
        self.active_connections: Dict[str, WebSocketConnection] = {}
        self.user_connections: Dict[int, Set[str]] = {}  # user_id -> connection_ids
        self.room_connections: Dict[str, Set[str]] = {}  # room -> connection_ids
        
        # Redis for cross-server communication
        try:
            self.redis_client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                decode_responses=True
            )
            self.redis_enabled = True
        except Exception as e:
            logger.warning(f"Redis not available for WebSocket: {e}")
            self.redis_client = None
            self.redis_enabled = False
        
        # Connection statistics
        self.stats = {
            "total_connections": 0,
            "active_connections": 0,
            "authenticated_connections": 0,
            "messages_sent": 0,
            "messages_received": 0
        }
    
    async def connect(self, websocket: WebSocket) -> str:
        """Accept a new WebSocket connection"""
        await websocket.accept()
        
        connection_id = str(uuid.uuid4())
        connection = WebSocketConnection(websocket=websocket)
        
        self.active_connections[connection_id] = connection
        self.stats["total_connections"] += 1
        self.stats["active_connections"] += 1
        
        logger.info(f"New WebSocket connection: {connection_id}")
        
        # Send connection count update
        await self._broadcast_connection_count()
        
        return connection_id
    
    async def disconnect(self, connection_id: str):
        """Handle WebSocket disconnection"""
        if connection_id in self.active_connections:
            connection = self.active_connections[connection_id]
            
            # Remove from user connections
            if connection.user_id and connection.user_id in self.user_connections:
                self.user_connections[connection.user_id].discard(connection_id)
                if not self.user_connections[connection.user_id]:
                    del self.user_connections[connection.user_id]
                    # Broadcast user offline
                    await self._broadcast_user_status(connection.user_id, False)
            
            # Remove from rooms
            for room in connection.rooms:
                if room in self.room_connections:
                    self.room_connections[room].discard(connection_id)
                    if not self.room_connections[room]:
                        del self.room_connections[room]
            
            # Remove connection
            del self.active_connections[connection_id]
            self.stats["active_connections"] -= 1
            
            logger.info(f"WebSocket disconnected: {connection_id}")
            
            # Send connection count update
            await self._broadcast_connection_count()
    
    async def authenticate(self, connection_id: str, token: str, db: Session) -> bool:
        """Authenticate a WebSocket connection"""
        try:
            # Decode JWT token
            payload = jwt.decode(
                token, 
                settings.SECRET_KEY, 
                algorithms=[settings.ALGORITHM]
            )
            user_id = int(payload.get("sub"))
            
            # Get user from database
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                return False
            
            # Update connection
            connection = self.active_connections[connection_id]
            connection.user_id = user_id
            connection.user = user
            connection.authenticated = True
            
            # Add to user connections
            if user_id not in self.user_connections:
                self.user_connections[user_id] = set()
            self.user_connections[user_id].add(connection_id)
            
            # Auto-join user room
            await self.join_room(connection_id, f"user_{user_id}")
            
            # Join role-based rooms
            if hasattr(user, 'role'):
                await self.join_room(connection_id, f"role_{user.role}")
            
            self.stats["authenticated_connections"] += 1
            
            # Broadcast user online
            await self._broadcast_user_status(user_id, True)
            
            logger.info(f"WebSocket authenticated: {connection_id} for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"WebSocket authentication failed: {e}")
            return False
    
    async def join_room(self, connection_id: str, room: str):
        """Add connection to a room"""
        if connection_id in self.active_connections:
            connection = self.active_connections[connection_id]
            connection.rooms.add(room)
            
            if room not in self.room_connections:
                self.room_connections[room] = set()
            self.room_connections[room].add(connection_id)
            
            logger.debug(f"Connection {connection_id} joined room {room}")
    
    async def leave_room(self, connection_id: str, room: str):
        """Remove connection from a room"""
        if connection_id in self.active_connections:
            connection = self.active_connections[connection_id]
            connection.rooms.discard(room)
            
            if room in self.room_connections:
                self.room_connections[room].discard(connection_id)
                if not self.room_connections[room]:
                    del self.room_connections[room]
            
            logger.debug(f"Connection {connection_id} left room {room}")
    
    async def send_to_connection(self, connection_id: str, message: WebSocketMessage):
        """Send message to specific connection"""
        if connection_id in self.active_connections:
            try:
                connection = self.active_connections[connection_id]
                await connection.websocket.send_text(message.to_json())
                self.stats["messages_sent"] += 1
                logger.debug(f"Sent message to connection {connection_id}: {message.type}")
            except Exception as e:
                logger.error(f"Failed to send message to connection {connection_id}: {e}")
                await self.disconnect(connection_id)
    
    async def send_to_user(self, user_id: int, message: WebSocketMessage):
        """Send message to all connections of a user"""
        if user_id in self.user_connections:
            tasks = []
            for connection_id in self.user_connections[user_id].copy():
                tasks.append(self.send_to_connection(connection_id, message))
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
    
    async def send_to_room(self, room: str, message: WebSocketMessage, exclude_connection: str = None):
        """Send message to all connections in a room"""
        if room in self.room_connections:
            tasks = []
            for connection_id in self.room_connections[room].copy():
                if connection_id != exclude_connection:
                    tasks.append(self.send_to_connection(connection_id, message))
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
    
    async def broadcast_to_all(self, message: WebSocketMessage, exclude_connection: str = None):
        """Broadcast message to all authenticated connections"""
        tasks = []
        for connection_id, connection in self.active_connections.items():
            if connection.authenticated and connection_id != exclude_connection:
                tasks.append(self.send_to_connection(connection_id, message))
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def broadcast_to_authenticated(self, message: WebSocketMessage):
        """Broadcast to all authenticated users"""
        tasks = []
        for connection_id, connection in self.active_connections.items():
            if connection.authenticated:
                tasks.append(self.send_to_connection(connection_id, message))
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _broadcast_connection_count(self):
        """Broadcast current connection count"""
        message = WebSocketMessage(
            type=MessageType.CONNECTION_COUNT,
            payload={
                "active_connections": self.stats["active_connections"],
                "authenticated_connections": self.stats["authenticated_connections"]
            }
        )
        await self.broadcast_to_authenticated(message)
    
    async def _broadcast_user_status(self, user_id: int, online: bool):
        """Broadcast user online/offline status"""
        message = WebSocketMessage(
            type=MessageType.USER_ONLINE if online else MessageType.USER_OFFLINE,
            payload={
                "user_id": user_id,
                "online": online,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
        await self.broadcast_to_authenticated(message)
    
    async def cleanup_stale_connections(self):
        """Clean up stale connections that haven't pinged recently"""
        cutoff_time = datetime.utcnow() - timedelta(minutes=5)
        stale_connections = []
        
        for connection_id, connection in self.active_connections.items():
            if connection.last_ping < cutoff_time:
                stale_connections.append(connection_id)
        
        for connection_id in stale_connections:
            logger.warning(f"Cleaning up stale connection: {connection_id}")
            await self.disconnect(connection_id)
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """Get connection statistics"""
        return {
            **self.stats,
            "rooms": {room: len(connections) for room, connections in self.room_connections.items()},
            "users_online": len(self.user_connections)
        }
    
    def get_user_connections(self, user_id: int) -> List[str]:
        """Get all connection IDs for a user"""
        return list(self.user_connections.get(user_id, set()))
    
    def is_user_online(self, user_id: int) -> bool:
        """Check if user has any active connections"""
        return user_id in self.user_connections and len(self.user_connections[user_id]) > 0


class WebSocketEventService:
    """Service for handling specific WebSocket events"""
    
    def __init__(self, connection_manager: WebSocketConnectionManager):
        self.connection_manager = connection_manager
    
    # Mission Events
    
    async def broadcast_mission_created(self, mission_data: Dict[str, Any]):
        """Broadcast new mission creation"""
        message = WebSocketMessage(
            type=MessageType.MISSION_CREATED,
            payload=mission_data,
            mission_id=mission_data.get("id")
        )
        
        # Send to command room
        await self.connection_manager.send_to_room("command", message)
        
        # Send to assigned soldier if any
        if mission_data.get("assigned_to"):
            await self.connection_manager.send_to_user(mission_data["assigned_to"], message)
    
    async def broadcast_mission_status_change(self, mission_id: int, old_status: str, new_status: str, mission_data: Dict[str, Any]):
        """Broadcast mission status changes"""
        message = WebSocketMessage(
            type=MessageType.MISSION_STATUS_CHANGED,
            payload={
                "mission_id": mission_id,
                "old_status": old_status,
                "new_status": new_status,
                "mission_data": mission_data,
                "timestamp": datetime.utcnow().isoformat()
            },
            mission_id=mission_id
        )
        
        # Send to mission room
        await self.connection_manager.send_to_room(f"mission_{mission_id}", message)
        
        # Send to assigned soldier
        if mission_data.get("assigned_to"):
            await self.connection_manager.send_to_user(mission_data["assigned_to"], message)
        
        # Send to command
        await self.connection_manager.send_to_room("command", message)
    
    async def broadcast_location_update(self, mission_id: int, user_id: int, location_data: Dict[str, Any]):
        """Broadcast location updates during missions"""
        message = WebSocketMessage(
            type=MessageType.LOCATION_UPDATE,
            payload={
                "mission_id": mission_id,
                "user_id": user_id,
                "location": location_data,
                "timestamp": datetime.utcnow().isoformat()
            },
            mission_id=mission_id,
            user_id=user_id
        )
        
        # Send to mission room for live tracking
        await self.connection_manager.send_to_room(f"mission_{mission_id}", message)
        
        # Send to command for monitoring
        await self.connection_manager.send_to_room("command", message)
    
    # File Upload Events
    
    async def broadcast_photo_uploaded(self, mission_id: int, user_id: int, photo_data: Dict[str, Any]):
        """Broadcast photo upload notifications"""
        message = WebSocketMessage(
            type=MessageType.PHOTO_UPLOADED,
            payload={
                "mission_id": mission_id,
                "user_id": user_id,
                "photo_data": photo_data,
                "timestamp": datetime.utcnow().isoformat()
            },
            mission_id=mission_id,
            user_id=user_id
        )
        
        # Send to mission room
        await self.connection_manager.send_to_room(f"mission_{mission_id}", message)
        
        # Send to command
        await self.connection_manager.send_to_room("command", message)
    
    # Notification Events
    
    async def send_notification(self, user_id: int, notification_data: Dict[str, Any]):
        """Send notification to specific user"""
        message = WebSocketMessage(
            type=MessageType.NOTIFICATION,
            payload=notification_data,
            user_id=user_id
        )
        
        await self.connection_manager.send_to_user(user_id, message)
    
    async def send_emergency_alert(self, mission_id: Optional[int], alert_data: Dict[str, Any]):
        """Send emergency alert"""
        message = WebSocketMessage(
            type=MessageType.EMERGENCY_ALERT,
            payload=alert_data,
            mission_id=mission_id
        )
        
        # Send to all authenticated users for emergency alerts
        await self.connection_manager.broadcast_to_authenticated(message)
    
    # Analytics Events
    
    async def broadcast_stats_update(self, stats_data: Dict[str, Any]):
        """Broadcast statistics updates"""
        message = WebSocketMessage(
            type=MessageType.STATS_UPDATE,
            payload=stats_data
        )
        
        # Send to command room for dashboard updates
        await self.connection_manager.send_to_room("command", message)
    
    # Chat Events
    
    async def send_chat_message(self, from_user_id: int, to_user_id: Optional[int], room: Optional[str], chat_data: Dict[str, Any]):
        """Send chat message"""
        message = WebSocketMessage(
            type=MessageType.CHAT_MESSAGE,
            payload={
                "from_user_id": from_user_id,
                "to_user_id": to_user_id,
                "message": chat_data,
                "timestamp": datetime.utcnow().isoformat()
            },
            user_id=from_user_id
        )
        
        if to_user_id:
            # Direct message
            await self.connection_manager.send_to_user(to_user_id, message)
            await self.connection_manager.send_to_user(from_user_id, message)  # Echo back
        elif room:
            # Room message
            await self.connection_manager.send_to_room(room, message)


# Global connection manager instance
connection_manager = WebSocketConnectionManager()
event_service = WebSocketEventService(connection_manager)