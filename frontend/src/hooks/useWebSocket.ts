/**
 * React hook for WebSocket integration
 * Provides easy-to-use WebSocket functionality for DroneStrike components
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import websocketService, { MessageType, WebSocketMessage, ConnectionStatus } from '../services/websocketService';

export interface UseWebSocketOptions {
  autoConnect?: boolean;
  onConnectionChange?: (status: ConnectionStatus) => void;
  onMessage?: (message: WebSocketMessage) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { autoConnect = true, onConnectionChange, onMessage } = options;
  
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    websocketService.getStatus()
  );
  const [isAuthenticated, setIsAuthenticated] = useState(
    websocketService.isAuthenticated()
  );
  const [joinedRooms, setJoinedRooms] = useState<string[]>(
    websocketService.getJoinedRooms()
  );
  
  const statusChangeRef = useRef(onConnectionChange);
  const messageRef = useRef(onMessage);
  
  // Update refs when callbacks change
  useEffect(() => {
    statusChangeRef.current = onConnectionChange;
  }, [onConnectionChange]);
  
  useEffect(() => {
    messageRef.current = onMessage;
  }, [onMessage]);
  
  // Connection status change handler
  const handleStatusChange = useCallback(() => {
    const newStatus = websocketService.getStatus();
    const newAuthenticated = websocketService.isAuthenticated();
    const newRooms = websocketService.getJoinedRooms();
    
    setConnectionStatus(newStatus);
    setIsAuthenticated(newAuthenticated);
    setJoinedRooms(newRooms);
    
    if (statusChangeRef.current) {
      statusChangeRef.current(newStatus);
    }
  }, []);
  
  // Global message handler
  const handleMessage = useCallback((message: WebSocketMessage) => {
    if (messageRef.current) {
      messageRef.current(message);
    }
  }, []);
  
  // Connect/disconnect functions
  const connect = useCallback(async (token?: string) => {
    try {
      await websocketService.connect(token);
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
    }
  }, []);
  
  const disconnect = useCallback(() => {
    websocketService.disconnect();
  }, []);
  
  // Room management
  const joinRoom = useCallback((room: string) => {
    websocketService.joinRoom(room);
  }, []);
  
  const leaveRoom = useCallback((room: string) => {
    websocketService.leaveRoom(room);
  }, []);
  
  const joinMissionRoom = useCallback((missionId: number) => {
    websocketService.joinMissionRoom(missionId);
  }, []);
  
  const leaveMissionRoom = useCallback((missionId: number) => {
    websocketService.leaveMissionRoom(missionId);
  }, []);
  
  // Message sending
  const sendMessage = useCallback((message: WebSocketMessage) => {
    websocketService.sendMessage(message);
  }, []);
  
  const sendLocationUpdate = useCallback((
    missionId: number, 
    location: { latitude: number; longitude: number; accuracy?: number }
  ) => {
    websocketService.sendLocationUpdate(missionId, location);
  }, []);
  
  const sendChatMessage = useCallback((
    message: string, 
    toUserId?: number, 
    room?: string
  ) => {
    websocketService.sendChatMessage(message, toUserId, room);
  }, []);
  
  // Setup listeners and auto-connect
  useEffect(() => {
    // Add status change listener
    document.addEventListener('websocket-status-change', handleStatusChange);
    
    // Add global message listener if provided
    if (onMessage) {
      websocketService.onAny(handleMessage);
    }
    
    // Auto-connect if enabled
    if (autoConnect && connectionStatus === ConnectionStatus.DISCONNECTED) {
      const token = localStorage.getItem('token');
      if (token) {
        connect(token);
      }
    }
    
    return () => {
      document.removeEventListener('websocket-status-change', handleStatusChange);
      if (onMessage) {
        websocketService.offAny(handleMessage);
      }
    };
  }, [autoConnect, connectionStatus, handleStatusChange, handleMessage, connect, onMessage]);
  
  return {
    // Connection state
    connectionStatus,
    isAuthenticated,
    isConnected: connectionStatus === ConnectionStatus.CONNECTED || connectionStatus === ConnectionStatus.AUTHENTICATED,
    joinedRooms,
    
    // Connection controls
    connect,
    disconnect,
    
    // Room management
    joinRoom,
    leaveRoom,
    joinMissionRoom,
    leaveMissionRoom,
    
    // Messaging
    sendMessage,
    sendLocationUpdate,
    sendChatMessage,
    
    // WebSocket service reference for advanced usage
    websocketService
  };
}

// Specialized hooks for specific use cases

export function useCampaignUpdates(campaignId?: number) {
  const [campaignData, setCampaignData] = useState<any>(null);
  const [progress, setProgress] = useState<any>({});
  
  const handleMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === MessageType.MISSION_UPDATED && 
        (!campaignId || message.payload.campaign_id === campaignId)) {
      setCampaignData(message.payload);
      setProgress(message.payload.progress || {});
    }
  }, [campaignId]);
  
  const { joinRoom, leaveRoom, ...websocket } = useWebSocket({
    onMessage: handleMessage
  });
  
  useEffect(() => {
    if (campaignId && websocket.isAuthenticated) {
      joinRoom(`campaign_${campaignId}`);
      return () => leaveRoom(`campaign_${campaignId}`);
    }
  }, [campaignId, websocket.isAuthenticated, joinRoom, leaveRoom]);
  
  return {
    ...websocket,
    campaignData,
    progress
  };
}

export function useLeadActivity() {
  const [activities, setActivities] = useState<any[]>([]);
  
  const handleMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === MessageType.NOTIFICATION) {
      setActivities(prev => [message.payload, ...prev.slice(0, 49)]);
    }
  }, []);
  
  const websocket = useWebSocket({
    onMessage: handleMessage
  });
  
  return {
    ...websocket,
    activities,
    clearActivities: () => setActivities([])
  };
}

export function useRealTimeNotifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const handleMessage = useCallback((message: WebSocketMessage) => {
    if ([MessageType.NOTIFICATION, MessageType.ALERT, MessageType.EMERGENCY_ALERT].includes(message.type)) {
      const notification = {
        id: Date.now(),
        type: message.type,
        message: message.payload.message || message.payload,
        timestamp: new Date().toISOString(),
        read: false
      };
      
      setNotifications(prev => [notification, ...prev.slice(0, 99)]);
      setUnreadCount(prev => prev + 1);
    }
  }, []);
  
  const markAsRead = useCallback((notificationId: number) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);
  
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);
  
  const websocket = useWebSocket({
    onMessage: handleMessage
  });
  
  return {
    ...websocket,
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead
  };
}

export default useWebSocket;