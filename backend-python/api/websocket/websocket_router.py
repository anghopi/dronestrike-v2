"""
WebSocket Router - Real-Time Communication Endpoints
Handles WebSocket connections, authentication, and message routing
"""

import json
import asyncio
import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import jwt

from core.database import get_db
from models.user import User
from services.websocket_service import (
    connection_manager, 
    event_service, 
    WebSocketMessage, 
    MessageType
)
from core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Main WebSocket endpoint for real-time communication"""
    connection_id = None
    
    try:
        # Accept connection
        connection_id = await connection_manager.connect(websocket)
        
        # Send welcome message
        welcome_message = WebSocketMessage(
            type=MessageType.AUTHENTICATION_SUCCESS if token else MessageType.AUTHENTICATE,
            payload={
                "connection_id": connection_id,
                "message": "Connected successfully. Please authenticate." if not token else "Authenticating...",
                "server_time": connection_manager.active_connections[connection_id].connected_at.isoformat()
            }
        )
        await connection_manager.send_to_connection(connection_id, welcome_message)
        
        # Auto-authenticate if token provided
        if token:
            authenticated = await connection_manager.authenticate(connection_id, token, db)
            if authenticated:
                auth_success = WebSocketMessage(
                    type=MessageType.AUTHENTICATION_SUCCESS,
                    payload={
                        "message": "Authentication successful",
                        "user_id": connection_manager.active_connections[connection_id].user_id
                    }
                )
                await connection_manager.send_to_connection(connection_id, auth_success)
            else:
                auth_failed = WebSocketMessage(
                    type=MessageType.AUTHENTICATION_FAILED,
                    payload={"message": "Authentication failed"}
                )
                await connection_manager.send_to_connection(connection_id, auth_failed)
        
        # Handle incoming messages
        while True:
            try:
                # Receive message
                data = await websocket.receive_text()
                connection_manager.stats["messages_received"] += 1
                
                # Parse message
                try:
                    message_data = json.loads(data)
                    message_type = message_data.get("type")
                    payload = message_data.get("payload", {})
                    
                    logger.debug(f"Received WebSocket message: {message_type} from {connection_id}")
                    
                    # Handle message based on type
                    await handle_websocket_message(connection_id, message_type, payload, db)
                    
                except json.JSONDecodeError:
                    error_message = WebSocketMessage(
                        type=MessageType.ERROR,
                        payload={"message": "Invalid JSON format"}
                    )
                    await connection_manager.send_to_connection(connection_id, error_message)
                
                except Exception as e:
                    logger.error(f"Error processing WebSocket message: {e}")
                    error_message = WebSocketMessage(
                        type=MessageType.ERROR,
                        payload={"message": "Error processing message"}
                    )
                    await connection_manager.send_to_connection(connection_id, error_message)
                    
            except WebSocketDisconnect:
                break
                
    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
        
    finally:
        if connection_id:
            await connection_manager.disconnect(connection_id)


async def handle_websocket_message(
    connection_id: str, 
    message_type: str, 
    payload: Dict[str, Any], 
    db: Session
):
    """Handle incoming WebSocket messages"""
    
    connection = connection_manager.active_connections.get(connection_id)
    if not connection:
        return
    
    try:
        if message_type == MessageType.AUTHENTICATE:
            # Handle authentication
            token = payload.get("token")
            if not token:
                response = WebSocketMessage(
                    type=MessageType.AUTHENTICATION_FAILED,
                    payload={"message": "Token required"}
                )
                await connection_manager.send_to_connection(connection_id, response)
                return
            
            authenticated = await connection_manager.authenticate(connection_id, token, db)
            if authenticated:
                response = WebSocketMessage(
                    type=MessageType.AUTHENTICATION_SUCCESS,
                    payload={
                        "message": "Authentication successful",
                        "user_id": connection.user_id
                    }
                )
            else:
                response = WebSocketMessage(
                    type=MessageType.AUTHENTICATION_FAILED,
                    payload={"message": "Invalid token"}
                )
            await connection_manager.send_to_connection(connection_id, response)
        
        elif message_type == MessageType.JOIN_ROOM:
            # Handle room joining
            if not connection.authenticated:
                await send_auth_required(connection_id)
                return
            
            room = payload.get("room")
            if room:
                await connection_manager.join_room(connection_id, room)
                response = WebSocketMessage(
                    type=MessageType.JOIN_ROOM,
                    payload={"message": f"Joined room: {room}", "room": room}
                )
                await connection_manager.send_to_connection(connection_id, response)
        
        elif message_type == MessageType.LEAVE_ROOM:
            # Handle room leaving
            if not connection.authenticated:
                await send_auth_required(connection_id)
                return
            
            room = payload.get("room")
            if room:
                await connection_manager.leave_room(connection_id, room)
                response = WebSocketMessage(
                    type=MessageType.LEAVE_ROOM,
                    payload={"message": f"Left room: {room}", "room": room}
                )
                await connection_manager.send_to_connection(connection_id, response)
        
        elif message_type == MessageType.PING:
            # Handle ping for keepalive
            connection.last_ping = connection_manager.active_connections[connection_id].connected_at.__class__.utcnow()
            response = WebSocketMessage(
                type=MessageType.PONG,
                payload={"timestamp": connection.last_ping.isoformat()}
            )
            await connection_manager.send_to_connection(connection_id, response)
        
        elif message_type == MessageType.LOCATION_UPDATE:
            # Handle location updates
            if not connection.authenticated:
                await send_auth_required(connection_id)
                return
            
            mission_id = payload.get("mission_id")
            location_data = payload.get("location")
            
            if mission_id and location_data:
                await event_service.broadcast_location_update(
                    mission_id=mission_id,
                    user_id=connection.user_id,
                    location_data=location_data
                )
        
        elif message_type == MessageType.CHAT_MESSAGE:
            # Handle chat messages
            if not connection.authenticated:
                await send_auth_required(connection_id)
                return
            
            to_user_id = payload.get("to_user_id")
            room = payload.get("room")
            message = payload.get("message")
            
            if message and (to_user_id or room):
                await event_service.send_chat_message(
                    from_user_id=connection.user_id,
                    to_user_id=to_user_id,
                    room=room,
                    chat_data={"message": message}
                )
        
        elif message_type == MessageType.EMERGENCY_ALERT:
            # Handle emergency alerts (for authorized users only)
            if not connection.authenticated:
                await send_auth_required(connection_id)
                return
            
            # Check if user has permission to send emergency alerts
            # This would typically check user role/permissions
            if connection.user and hasattr(connection.user, 'role') and connection.user.role in ['admin', 'officer']:
                mission_id = payload.get("mission_id")
                alert_data = payload.get("alert_data", {})
                alert_data["sender_id"] = connection.user_id
                
                await event_service.send_emergency_alert(mission_id, alert_data)
            else:
                error_message = WebSocketMessage(
                    type=MessageType.ERROR,
                    payload={"message": "Insufficient permissions for emergency alerts"}
                )
                await connection_manager.send_to_connection(connection_id, error_message)
        
        else:
            # Unknown message type
            error_message = WebSocketMessage(
                type=MessageType.INVALID_MESSAGE,
                payload={"message": f"Unknown message type: {message_type}"}
            )
            await connection_manager.send_to_connection(connection_id, error_message)
    
    except Exception as e:
        logger.error(f"Error handling WebSocket message {message_type}: {e}")
        error_message = WebSocketMessage(
            type=MessageType.ERROR,
            payload={"message": "Internal server error"}
        )
        await connection_manager.send_to_connection(connection_id, error_message)


async def send_auth_required(connection_id: str):
    """Send authentication required message"""
    message = WebSocketMessage(
        type=MessageType.ERROR,
        payload={"message": "Authentication required"}
    )
    await connection_manager.send_to_connection(connection_id, message)


# REST API endpoints for WebSocket management

@router.get("/connections/stats")
async def get_connection_stats():
    """Get WebSocket connection statistics"""
    return connection_manager.get_connection_stats()


@router.get("/connections/users/{user_id}")
async def get_user_connections(user_id: int):
    """Get connection information for a specific user"""
    connections = connection_manager.get_user_connections(user_id)
    is_online = connection_manager.is_user_online(user_id)
    
    return {
        "user_id": user_id,
        "is_online": is_online,
        "connections": connections,
        "connection_count": len(connections)
    }


@router.post("/broadcast")
async def broadcast_message(
    message_data: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """Broadcast message to all authenticated connections (admin only)"""
    # Check permissions
    if not hasattr(current_user, 'role') or current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    message = WebSocketMessage(
        type=MessageType.BROADCAST,
        payload=message_data,
        user_id=current_user.id
    )
    
    await connection_manager.broadcast_to_authenticated(message)
    
    return {"message": "Broadcast sent successfully"}


@router.post("/rooms/{room}/broadcast")
async def broadcast_to_room(
    room: str,
    message_data: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """Broadcast message to specific room"""
    message = WebSocketMessage(
        type=MessageType.BROADCAST,
        payload=message_data,
        user_id=current_user.id,
        room=room
    )
    
    await connection_manager.send_to_room(room, message)
    
    return {"message": f"Broadcast sent to room {room}"}


@router.post("/users/{user_id}/notify")
async def send_user_notification(
    user_id: int,
    notification_data: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """Send notification to specific user"""
    await event_service.send_notification(user_id, notification_data)
    
    return {"message": f"Notification sent to user {user_id}"}


@router.post("/missions/{mission_id}/broadcast")
async def broadcast_mission_update(
    mission_id: int,
    update_data: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """Broadcast update to mission room"""
    message = WebSocketMessage(
        type=MessageType.MISSION_UPDATED,
        payload=update_data,
        mission_id=mission_id,
        user_id=current_user.id
    )
    
    await connection_manager.send_to_room(f"mission_{mission_id}", message)
    
    return {"message": f"Update broadcast to mission {mission_id}"}


@router.delete("/connections/cleanup")
async def cleanup_stale_connections():
    """Clean up stale WebSocket connections (admin only)"""
    await connection_manager.cleanup_stale_connections()
    return {"message": "Stale connections cleaned up"}


# Import current_user dependency
from api.dependencies import get_current_user