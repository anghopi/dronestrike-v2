#!/usr/bin/env python3
"""
Simple startup script for testing the WebSocket functionality
without complex integrations
"""

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import json
import asyncio
from datetime import datetime

# Simple FastAPI app for testing WebSocket
app = FastAPI(title="DroneStrike WebSocket Test", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple connection manager for testing
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"Client connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"Client disconnected. Total connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                # Remove dead connections
                self.active_connections.remove(connection)

manager = ConnectionManager()

@app.get("/")
async def root():
    return {"message": "DroneStrike WebSocket Test Server", "status": "running"}

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "active_connections": len(manager.active_connections)
    }

@app.websocket("/api/v1/ws/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send welcome message
        await manager.send_personal_message(json.dumps({
            "type": "authentication_success",
            "payload": {
                "user_id": 1,
                "message": "Connected to WebSocket test server"
            },
            "timestamp": datetime.now().isoformat()
        }), websocket)
        
        # Send initial stats
        await asyncio.sleep(1)
        await manager.send_personal_message(json.dumps({
            "type": "stats_update",
            "payload": {
                "active_missions": 3,
                "total_soldiers": 5,
                "soldiers_online": 2,
                "missions_completed_today": 1,
                "average_mission_time": 3600,
                "success_rate": 85,
                "alerts_active": 0,
                "system_health": "good"
            },
            "timestamp": datetime.now().isoformat()
        }), websocket)
        
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            print(f"Received message: {message}")
            
            # Echo back for testing
            response = {
                "type": "echo",
                "payload": {
                    "original_message": message,
                    "server_time": datetime.now().isoformat()
                },
                "timestamp": datetime.now().isoformat()
            }
            await manager.send_personal_message(json.dumps(response), websocket)
            
            # Simulate some real-time updates
            if message.get("type") == "join_room":
                await asyncio.sleep(0.5)
                await manager.send_personal_message(json.dumps({
                    "type": "notification",
                    "payload": {
                        "title": "Room Joined",
                        "message": f"Successfully joined room: {message['payload']['room']}"
                    },
                    "timestamp": datetime.now().isoformat()
                }), websocket)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)

# Background task to send periodic updates
async def send_periodic_updates():
    while True:
        await asyncio.sleep(10)  # Send updates every 10 seconds
        if manager.active_connections:
            update_message = json.dumps({
                "type": "connection_count",
                "payload": {
                    "active_connections": len(manager.active_connections)
                },
                "timestamp": datetime.now().isoformat()
            })
            await manager.broadcast(update_message)

@app.on_event("startup")
async def startup_event():
    # Start background task
    asyncio.create_task(send_periodic_updates())

if __name__ == "__main__":
    print("Starting WebSocket test server...")
    print("WebSocket endpoint: ws://localhost:8000/api/v1/ws/ws")
    print("Health check: http://localhost:8000/api/health")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")