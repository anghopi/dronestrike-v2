import { WebSocketServer, WebSocket } from 'ws';
import { logger, logInfo, logError } from '../monitoring/logger.js';

export interface WebSocketMessage {
  type: string;
  payload?: any;
  timestamp: string;
}

export interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  userRole?: string;
  isAuthenticated?: boolean;
}

export class WebSocketService {
  private clients = new Set<AuthenticatedWebSocket>();
  private rooms = new Map<string, Set<AuthenticatedWebSocket>>();

  constructor(private wss: WebSocketServer) {
    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: AuthenticatedWebSocket, request) => {
      logInfo('New WebSocket connection', {
        userAgent: request.headers['user-agent'],
        origin: request.headers.origin,
      });

      // Add to clients
      this.clients.add(ws);

      // Setup message handling
      ws.on('message', (data) => {
        this.handleMessage(ws, data);
      });

      // Handle disconnection
      ws.on('close', () => {
        this.handleDisconnection(ws);
      });

      // Handle errors
      ws.on('error', (error) => {
        logError('WebSocket error', error);
        this.handleDisconnection(ws);
      });

      // Send welcome message
      this.sendMessage(ws, {
        type: 'connection',
        payload: { message: 'Connected to DroneStrike CRM v2' },
        timestamp: new Date().toISOString(),
      });
    });

    logInfo('WebSocket server configured');
  }

  private handleMessage(ws: AuthenticatedWebSocket, data: any): void {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'authenticate':
          this.handleAuthentication(ws, message.payload);
          break;
        case 'join_room':
          this.handleJoinRoom(ws, message.payload?.room);
          break;
        case 'leave_room':
          this.handleLeaveRoom(ws, message.payload?.room);
          break;
        case 'ping':
          this.sendMessage(ws, { type: 'pong', timestamp: new Date().toISOString() });
          break;
        default:
          logError('Unknown WebSocket message type', new Error(`Unknown type: ${message.type}`));
      }
    } catch (error) {
      logError('Error parsing WebSocket message', error as Error);
      this.sendMessage(ws, {
        type: 'error',
        payload: { message: 'Invalid message format' },
        timestamp: new Date().toISOString(),
      });
    }
  }

  private handleAuthentication(ws: AuthenticatedWebSocket, payload: any): void {
    // TODO: Implement proper JWT token validation
    // For now, accept any authentication
    ws.isAuthenticated = true;
    ws.userId = payload?.userId || 1;
    ws.userRole = payload?.role || 'user';

    this.sendMessage(ws, {
      type: 'authenticated',
      payload: { message: 'Authentication successful' },
      timestamp: new Date().toISOString(),
    });

    logInfo('WebSocket client authenticated', {
      userId: ws.userId,
      role: ws.userRole,
    });
  }

  private handleJoinRoom(ws: AuthenticatedWebSocket, room: string): void {
    if (!ws.isAuthenticated) {
      this.sendMessage(ws, {
        type: 'error',
        payload: { message: 'Authentication required' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }

    this.rooms.get(room)!.add(ws);
    
    this.sendMessage(ws, {
      type: 'room_joined',
      payload: { room },
      timestamp: new Date().toISOString(),
    });

    logInfo('Client joined room', { userId: ws.userId, room });
  }

  private handleLeaveRoom(ws: AuthenticatedWebSocket, room: string): void {
    const roomClients = this.rooms.get(room);
    if (roomClients) {
      roomClients.delete(ws);
      if (roomClients.size === 0) {
        this.rooms.delete(room);
      }
    }

    this.sendMessage(ws, {
      type: 'room_left',
      payload: { room },
      timestamp: new Date().toISOString(),
    });
  }

  private handleDisconnection(ws: AuthenticatedWebSocket): void {
    this.clients.delete(ws);
    
    // Remove from all rooms
    for (const [room, clients] of this.rooms.entries()) {
      clients.delete(ws);
      if (clients.size === 0) {
        this.rooms.delete(room);
      }
    }

    logInfo('WebSocket client disconnected', { userId: ws.userId });
  }

  private sendMessage(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // Public methods for broadcasting

  /**
   * Broadcast message to all authenticated clients
   */
  broadcast(message: Omit<WebSocketMessage, 'timestamp'>): void {
    const fullMessage: WebSocketMessage = {
      ...message,
      timestamp: new Date().toISOString(),
    };

    this.clients.forEach(client => {
      if (client.isAuthenticated) {
        this.sendMessage(client, fullMessage);
      }
    });
  }

  /**
   * Broadcast message to specific room
   */
  broadcastToRoom(room: string, message: Omit<WebSocketMessage, 'timestamp'>): void {
    const roomClients = this.rooms.get(room);
    if (!roomClients) return;

    const fullMessage: WebSocketMessage = {
      ...message,
      timestamp: new Date().toISOString(),
    };

    roomClients.forEach(client => {
      this.sendMessage(client, fullMessage);
    });
  }

  /**
   * Send message to specific user
   */
  sendToUser(userId: number, message: Omit<WebSocketMessage, 'timestamp'>): void {
    const fullMessage: WebSocketMessage = {
      ...message,
      timestamp: new Date().toISOString(),
    };

    this.clients.forEach(client => {
      if (client.userId === userId) {
        this.sendMessage(client, fullMessage);
      }
    });
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalConnections: number;
    authenticatedConnections: number;
    activeRooms: number;
  } {
    const authenticatedCount = Array.from(this.clients).filter(c => c.isAuthenticated).length;
    
    return {
      totalConnections: this.clients.size,
      authenticatedConnections: authenticatedCount,
      activeRooms: this.rooms.size,
    };
  }
}

let webSocketService: WebSocketService | null = null;

export function setupWebSocket(wss: WebSocketServer): WebSocketService {
  webSocketService = new WebSocketService(wss);
  return webSocketService;
}

export function getWebSocketService(): WebSocketService | null {
  return webSocketService;
}