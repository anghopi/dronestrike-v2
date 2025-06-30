import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import websocketService, { MessageType, ConnectionStatus } from '../services/websocketService';

const WebSocketTest: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(websocketService.getStatus());
  const [messages, setMessages] = useState<any[]>([]);
  const [customMessage, setCustomMessage] = useState('');

  useEffect(() => {
    // Listen for all message types
    const handleMessage = (message: any) => {
      setMessages(prev => [...prev, {
        ...message,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now() + Math.random()
      }].slice(-50)); // Keep last 50 messages
    };

    // Listen for connection status changes
    const handleStatusChange = (event: CustomEvent) => {
      setConnectionStatus(event.detail.status);
    };

    // Register listeners for various message types
    websocketService.on(MessageType.AUTHENTICATION_SUCCESS, handleMessage);
    websocketService.on(MessageType.STATS_UPDATE, handleMessage);
    websocketService.on(MessageType.NOTIFICATION, handleMessage);
    websocketService.on(MessageType.CONNECTION_COUNT, handleMessage);
    websocketService.on(MessageType.MISSION_STATUS_CHANGED, handleMessage);
    websocketService.on(MessageType.LOCATION_UPDATE, handleMessage);
    websocketService.on(MessageType.EMERGENCY_ALERT, handleMessage);

    // Listen for global messages
    websocketService.onAny(handleMessage);

    document.addEventListener('websocket-status-change', handleStatusChange as EventListener);

    return () => {
      websocketService.off(MessageType.AUTHENTICATION_SUCCESS, handleMessage);
      websocketService.off(MessageType.STATS_UPDATE, handleMessage);
      websocketService.off(MessageType.NOTIFICATION, handleMessage);
      websocketService.off(MessageType.CONNECTION_COUNT, handleMessage);
      websocketService.off(MessageType.MISSION_STATUS_CHANGED, handleMessage);
      websocketService.off(MessageType.LOCATION_UPDATE, handleMessage);
      websocketService.off(MessageType.EMERGENCY_ALERT, handleMessage);
      websocketService.offAny(handleMessage);
      document.removeEventListener('websocket-status-change', handleStatusChange as EventListener);
    };
  }, []);

  const connect = () => {
    websocketService.connect().catch(console.error);
  };

  const disconnect = () => {
    websocketService.disconnect();
  };

  const sendTestMessage = () => {
    websocketService.sendMessage({
      type: MessageType.PING,
      payload: {
        message: 'Hello from React app',
        timestamp: new Date().toISOString()
      }
    });
  };

  const joinTestRoom = () => {
    websocketService.joinRoom('test_room');
  };

  const sendCustomMessage = () => {
    if (!customMessage.trim()) return;
    
    try {
      const parsed = JSON.parse(customMessage);
      websocketService.sendMessage(parsed);
    } catch (e) {
      websocketService.sendMessage({
        type: MessageType.CHAT_MESSAGE,
        payload: {
          message: customMessage
        }
      });
    }
    setCustomMessage('');
  };

  const sendLocationUpdate = () => {
    navigator.geolocation.getCurrentPosition((position) => {
      websocketService.sendLocationUpdate(1, {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      });
    });
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case ConnectionStatus.AUTHENTICATED: return 'text-green-600 bg-green-100';
      case ConnectionStatus.CONNECTED: return 'text-yellow-600 bg-yellow-100';
      case ConnectionStatus.CONNECTING: return 'text-blue-600 bg-blue-100';
      case ConnectionStatus.RECONNECTING: return 'text-orange-600 bg-orange-100';
      default: return 'text-red-600 bg-red-100';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">WebSocket Test Page</h1>
        <div className={`inline-block px-4 py-2 rounded-lg font-medium ${getStatusColor()}`}>
          Status: {connectionStatus}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Controls */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4">Connection Controls</h2>
            <div className="space-y-3">
              <Button onClick={connect} className="w-full">
                Connect
              </Button>
              <Button onClick={disconnect} variant="outline" className="w-full">
                Disconnect
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4">Test Actions</h2>
            <div className="space-y-3">
              <Button onClick={sendTestMessage} className="w-full">
                Send Test Message
              </Button>
              <Button onClick={joinTestRoom} variant="outline" className="w-full">
                Join Test Room
              </Button>
              <Button onClick={sendLocationUpdate} variant="outline" className="w-full">
                Send Location Update
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4">Custom Message</h2>
            <div className="space-y-3">
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Enter JSON message or plain text..."
                className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button onClick={sendCustomMessage} className="w-full">
                Send Custom Message
              </Button>
            </div>
          </div>
        </div>

        {/* Message Log */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">Message Log</h2>
            <p className="text-sm text-gray-500">Last {messages.length} messages</p>
          </div>
          <div className="p-6 h-96 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-gray-500 text-center">No messages received yet</p>
            ) : (
              <div className="space-y-3">
                {messages.reverse().map((msg) => (
                  <div key={msg.id} className="border-l-4 border-blue-200 pl-4 py-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-blue-600">{msg.type}</span>
                      <span className="text-gray-500">{msg.timestamp}</span>
                    </div>
                    <pre className="text-xs text-gray-700 mt-1 whitespace-pre-wrap">
                      {JSON.stringify(msg.payload, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="p-4 border-t bg-gray-50">
            <Button 
              onClick={() => setMessages([])} 
              variant="outline" 
              size="sm"
            >
              Clear Messages
            </Button>
          </div>
        </div>
      </div>

      {/* Real-time Components Demo */}
      <div className="mt-8 bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-2xl font-semibold mb-4">Real-time Components</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">Dashboard</h3>
            <p className="text-sm text-gray-600 mb-3">Live metrics and system status</p>
            <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
              View Dashboard
            </Button>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">Mission Tracker</h3>
            <p className="text-sm text-gray-600 mb-3">Real-time mission monitoring</p>
            <Button variant="outline" onClick={() => window.location.href = '/missions'}>
              View Missions
            </Button>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">Notifications</h3>
            <p className="text-sm text-gray-600 mb-3">Real-time alerts and updates</p>
            <Button variant="outline" onClick={() => {
              websocketService.sendMessage({
                type: MessageType.NOTIFICATION,
                payload: {
                  title: 'Test Notification',
                  message: 'This is a test notification from the WebSocket test page'
                }
              });
            }}>
              Send Test Notification
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebSocketTest;