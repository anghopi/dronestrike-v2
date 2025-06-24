/**
 * WebSocket Service - Real-Time Communication Client
 * Handles WebSocket connections, message routing, and real-time updates
 */

import { toast } from 'react-hot-toast';

// Message types enum
export enum MessageType {
  // Authentication
  AUTHENTICATE = 'authenticate',
  AUTHENTICATION_SUCCESS = 'authentication_success',
  AUTHENTICATION_FAILED = 'authentication_failed',
  
  // Connection management
  JOIN_ROOM = 'join_room',
  LEAVE_ROOM = 'leave_room',
  PING = 'ping',
  PONG = 'pong',
  
  // Mission updates
  MISSION_CREATED = 'mission_created',
  MISSION_UPDATED = 'mission_updated',
  MISSION_STATUS_CHANGED = 'mission_status_changed',
  MISSION_ASSIGNED = 'mission_assigned',
  MISSION_STARTED = 'mission_started',
  MISSION_COMPLETED = 'mission_completed',
  MISSION_DECLINED = 'mission_declined',
  
  // Location tracking
  LOCATION_UPDATE = 'location_update',
  ROUTE_UPDATE = 'route_update',
  GPS_TRACKING = 'gps_tracking',
  
  // File uploads
  PHOTO_UPLOADED = 'photo_uploaded',
  DOCUMENT_UPLOADED = 'document_uploaded',
  FILE_PROCESSED = 'file_processed',
  
  // Notifications
  NOTIFICATION = 'notification',
  ALERT = 'alert',
  EMERGENCY_ALERT = 'emergency_alert',
  SYSTEM_NOTIFICATION = 'system_notification',
  
  // Communication
  CHAT_MESSAGE = 'chat_message',
  BROADCAST = 'broadcast',
  DIRECT_MESSAGE = 'direct_message',
  
  // Analytics
  STATS_UPDATE = 'stats_update',
  PERFORMANCE_UPDATE = 'performance_update',
  
  // System
  CONNECTION_COUNT = 'connection_count',
  USER_ONLINE = 'user_online',
  USER_OFFLINE = 'user_offline',
  
  // Errors
  ERROR = 'error',
  INVALID_MESSAGE = 'invalid_message'
}

// Message interface
export interface WebSocketMessage {
  type: MessageType;
  payload: any;
  timestamp?: string;
  user_id?: number;
  mission_id?: number;
  room?: string;
  message_id?: string;
}

// Event listener interface
export interface WebSocketEventListener {
  (message: WebSocketMessage): void;
}

// Connection status
export enum ConnectionStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  AUTHENTICATED = 'authenticated',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  RECONNECTING = 'reconnecting'
}

class WebSocketService {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private pingInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval = 30000; // 30 seconds
  
  // Connection state
  private status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private authenticated = false;
  private connectionId: string | null = null;
  private userId: number | null = null;
  private joinedRooms: Set<string> = new Set();
  
  // Event listeners
  private eventListeners: Map<MessageType, WebSocketEventListener[]> = new Map();
  private globalListeners: WebSocketEventListener[] = [];
  
  // Message queue for offline messages
  private messageQueue: WebSocketMessage[] = [];
  
  constructor() {
    this.initializeEventListeners();
  }
  
  /**
   * Initialize default event listeners
   */
  private initializeEventListeners() {
    // Authentication events
    this.on(MessageType.AUTHENTICATION_SUCCESS, (message) => {
      this.authenticated = true;
      this.status = ConnectionStatus.AUTHENTICATED;
      this.userId = message.payload.user_id;
      this.onConnectionStatusChange(this.status);
      
      // Process queued messages
      this.processMessageQueue();
      
      toast.success('Connected to real-time updates');
    });
    
    this.on(MessageType.AUTHENTICATION_FAILED, (message) => {
      this.authenticated = false;
      this.onConnectionStatusChange(ConnectionStatus.ERROR);
      toast.error('Authentication failed: ' + message.payload.message);
    });
    
    // Connection events
    this.on(MessageType.PONG, () => {
      // Heartbeat response received
    });
    
    // Notification events
    this.on(MessageType.NOTIFICATION, (message) => {
      this.handleNotification(message.payload);
    });
    
    this.on(MessageType.ALERT, (message) => {
      this.handleAlert(message.payload);
    });
    
    this.on(MessageType.EMERGENCY_ALERT, (message) => {
      this.handleEmergencyAlert(message.payload);
    });
    
    // System events
    this.on(MessageType.CONNECTION_COUNT, (message) => {
      console.log('Connection count:', message.payload);
    });
    
    this.on(MessageType.USER_ONLINE, (message) => {
      this.handleUserStatusChange(message.payload.user_id, true);
    });
    
    this.on(MessageType.USER_OFFLINE, (message) => {
      this.handleUserStatusChange(message.payload.user_id, false);
    });
    
    // Error handling
    this.on(MessageType.ERROR, (message) => {
      console.error('WebSocket error:', message.payload.message);
      toast.error(message.payload.message);
    });
  }
  
  /**
   * Connect to WebSocket server
   */
  public connect(token?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.status = ConnectionStatus.CONNECTING;
        this.onConnectionStatusChange(this.status);
        
        // Construct WebSocket URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
        const wsUrl = `${protocol}//${host}/api/v1/ws/ws${tokenParam}`;
        
        this.socket = new WebSocket(wsUrl);
        
        this.socket.onopen = () => {
          this.status = ConnectionStatus.CONNECTED;
          this.onConnectionStatusChange(this.status);
          this.reconnectAttempts = 0;
          
          // Start heartbeat
          this.startHeartbeat();
          
          // If no token provided in URL, authenticate manually
          if (!token) {
            const storedToken = localStorage.getItem('token');
            if (storedToken) {
              this.authenticate(storedToken);
            }
          }
          
          resolve();
        };
        
        this.socket.onmessage = (event) => {
          this.handleMessage(event.data);
        };
        
        this.socket.onclose = (event) => {
          this.handleDisconnection(event);
        };
        
        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.status = ConnectionStatus.ERROR;
          this.onConnectionStatusChange(this.status);
          reject(error);
        };
        
      } catch (error) {
        this.status = ConnectionStatus.ERROR;
        this.onConnectionStatusChange(this.status);
        reject(error);
      }
    });
  }
  
  /**
   * Disconnect from WebSocket server
   */
  public disconnect() {
    if (this.socket) {
      this.socket.close(1000, 'User disconnected');
    }
    this.stopHeartbeat();
    this.authenticated = false;
    this.connectionId = null;
    this.userId = null;
    this.joinedRooms.clear();
    this.status = ConnectionStatus.DISCONNECTED;
    this.onConnectionStatusChange(this.status);
  }
  
  /**
   * Authenticate with JWT token
   */
  public authenticate(token: string) {
    this.sendMessage({
      type: MessageType.AUTHENTICATE,
      payload: { token }
    });
  }
  
  /**
   * Send a message to the WebSocket server
   */
  public sendMessage(message: WebSocketMessage) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      // Queue message for when connection is restored
      this.messageQueue.push(message);
    }
  }
  
  /**
   * Join a room for real-time updates
   */
  public joinRoom(room: string) {
    if (!this.authenticated) {
      console.warn('Not authenticated, cannot join room');
      return;
    }
    
    this.sendMessage({
      type: MessageType.JOIN_ROOM,
      payload: { room }
    });
    
    this.joinedRooms.add(room);
  }
  
  /**
   * Leave a room
   */
  public leaveRoom(room: string) {
    if (!this.authenticated) {
      return;
    }
    
    this.sendMessage({
      type: MessageType.LEAVE_ROOM,
      payload: { room }
    });
    
    this.joinedRooms.delete(room);
  }
  
  /**
   * Join mission room for real-time mission updates
   */
  public joinMissionRoom(missionId: number) {
    this.joinRoom(`mission_${missionId}`);
  }
  
  /**
   * Leave mission room
   */
  public leaveMissionRoom(missionId: number) {
    this.leaveRoom(`mission_${missionId}`);
  }
  
  /**
   * Send location update during mission
   */
  public sendLocationUpdate(missionId: number, location: { latitude: number; longitude: number; accuracy?: number }) {
    this.sendMessage({
      type: MessageType.LOCATION_UPDATE,
      payload: {
        mission_id: missionId,
        location: {
          ...location,
          timestamp: new Date().toISOString()
        }
      },
      mission_id: missionId
    });
  }
  
  /**
   * Send chat message
   */
  public sendChatMessage(message: string, toUserId?: number, room?: string) {
    this.sendMessage({
      type: MessageType.CHAT_MESSAGE,
      payload: {
        message,
        to_user_id: toUserId,
        room
      }
    });
  }
  
  /**
   * Send emergency alert (for authorized users)
   */
  public sendEmergencyAlert(alertData: any, missionId?: number) {
    this.sendMessage({
      type: MessageType.EMERGENCY_ALERT,
      payload: {
        alert_data: alertData,
        mission_id: missionId
      },
      mission_id: missionId
    });
  }
  
  /**
   * Add event listener for specific message type
   */
  public on(messageType: MessageType, listener: WebSocketEventListener) {
    if (!this.eventListeners.has(messageType)) {
      this.eventListeners.set(messageType, []);
    }
    this.eventListeners.get(messageType)!.push(listener);
  }
  
  /**
   * Remove event listener
   */
  public off(messageType: MessageType, listener: WebSocketEventListener) {
    const listeners = this.eventListeners.get(messageType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }
  
  /**
   * Add global event listener (receives all messages)
   */
  public onAny(listener: WebSocketEventListener) {
    this.globalListeners.push(listener);
  }
  
  /**
   * Remove global event listener
   */
  public offAny(listener: WebSocketEventListener) {
    const index = this.globalListeners.indexOf(listener);
    if (index > -1) {
      this.globalListeners.splice(index, 1);
    }
  }
  
  /**
   * Get connection status
   */
  public getStatus(): ConnectionStatus {
    return this.status;
  }
  
  /**
   * Check if authenticated
   */
  public isAuthenticated(): boolean {
    return this.authenticated;
  }
  
  /**
   * Get current user ID
   */
  public getUserId(): number | null {
    return this.userId;
  }
  
  /**
   * Get joined rooms
   */
  public getJoinedRooms(): string[] {
    return Array.from(this.joinedRooms);
  }
  
  // Private methods
  
  private handleMessage(data: string) {
    try {
      const message: WebSocketMessage = JSON.parse(data);
      
      // Call specific event listeners
      const listeners = this.eventListeners.get(message.type);
      if (listeners) {
        listeners.forEach(listener => listener(message));
      }
      
      // Call global listeners
      this.globalListeners.forEach(listener => listener(message));
      
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }
  
  private handleDisconnection(event: CloseEvent) {
    this.authenticated = false;
    this.stopHeartbeat();
    
    if (event.code === 1000) {
      // Normal closure
      this.status = ConnectionStatus.DISCONNECTED;
      this.onConnectionStatusChange(this.status);
    } else {
      // Unexpected closure, attempt to reconnect
      this.status = ConnectionStatus.RECONNECTING;
      this.onConnectionStatusChange(this.status);
      this.attemptReconnect();
    }
  }
  
  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        this.connect(localStorage.getItem('token') || undefined)
          .then(() => {
            // Rejoin rooms
            this.joinedRooms.forEach(room => this.joinRoom(room));
          })
          .catch(() => {
            this.attemptReconnect();
          });
      }, delay);
    } else {
      this.status = ConnectionStatus.ERROR;
      this.onConnectionStatusChange(this.status);
      toast.error('Failed to reconnect to real-time updates');
    }
  }
  
  private startHeartbeat() {
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.sendMessage({
          type: MessageType.PING,
          payload: { timestamp: new Date().toISOString() }
        });
      }
    }, this.heartbeatInterval);
  }
  
  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  
  private processMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
  }
  
  private onConnectionStatusChange(status: ConnectionStatus) {
    // Emit status change event
    console.log('WebSocket status changed:', status);
    
    // Update UI indicators, etc.
    document.dispatchEvent(new CustomEvent('websocket-status-change', {
      detail: { status, authenticated: this.authenticated }
    }));
  }
  
  private handleNotification(payload: any) {
    toast.success(payload.message || 'New notification', {
      duration: 5000
    });
    
    // Dispatch custom event for notification components
    document.dispatchEvent(new CustomEvent('websocket-notification', {
      detail: payload
    }));
  }
  
  private handleAlert(payload: any) {
    toast(payload.message || 'Alert', {
      icon: '⚠️',
      duration: 8000
    });
    
    document.dispatchEvent(new CustomEvent('websocket-alert', {
      detail: payload
    }));
  }
  
  private handleEmergencyAlert(payload: any) {
    toast.error(payload.message || 'EMERGENCY ALERT', {
      duration: 0, // Don't auto-dismiss emergency alerts
      style: {
        background: '#ef4444',
        color: 'white',
        fontWeight: 'bold'
      }
    });
    
    // Flash the page or show modal for emergency alerts
    document.dispatchEvent(new CustomEvent('websocket-emergency-alert', {
      detail: payload
    }));
  }
  
  private handleUserStatusChange(userId: number, online: boolean) {
    document.dispatchEvent(new CustomEvent('websocket-user-status', {
      detail: { userId, online }
    }));
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

// Auto-connect on service creation if token exists
const token = localStorage.getItem('token');
if (token) {
  websocketService.connect(token).catch(console.error);
}

// Reconnect when token changes
window.addEventListener('storage', (event) => {
  if (event.key === 'token') {
    if (event.newValue) {
      websocketService.connect(event.newValue).catch(console.error);
    } else {
      websocketService.disconnect();
    }
  }
});

export default websocketService;