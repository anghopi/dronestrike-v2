import React, { useEffect, useState, useRef } from 'react';
import { 
  MapPinIcon, 
  ClockIcon, 
  UserIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlayIcon,
  PauseIcon,
  CameraIcon,
  ChatBubbleLeftRightIcon,
  SignalIcon
} from '@heroicons/react/24/outline';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import websocketService, { MessageType, ConnectionStatus } from '../../services/websocketService';
import type { WebSocketMessage } from '../../services/websocketService';

interface Mission {
  id: number;
  title: string;
  status: string;
  assigned_to?: number;
  assigned_soldier?: {
    id: number;
    name: string;
    rank: string;
  };
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

interface LocationUpdate {
  mission_id: number;
  user_id: number;
  location: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp: string;
  };
}

interface RealtimeMissionTrackerProps {
  missionId: number;
  mission: Mission;
  onMissionUpdate?: (mission: Mission) => void;
}

const RealtimeMissionTracker: React.FC<RealtimeMissionTrackerProps> = ({
  missionId,
  mission: initialMission,
  onMissionUpdate
}) => {
  const [mission, setMission] = useState<Mission>(initialMission);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(websocketService.getStatus());
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationUpdate | null>(null);
  const [locationHistory, setLocationHistory] = useState<LocationUpdate[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const locationWatchId = useRef<number | null>(null);

  useEffect(() => {
    // Join mission room for real-time updates
    if (websocketService.isAuthenticated()) {
      websocketService.joinMissionRoom(missionId);
    }

    // Set up event listeners
    const handleMissionUpdate = (message: WebSocketMessage) => {
      if (message.mission_id === missionId) {
        const updatedMission = { ...mission, ...message.payload.mission_data };
        setMission(updatedMission);
        onMissionUpdate?.(updatedMission);
      }
    };

    const handleMissionStatusChange = (message: WebSocketMessage) => {
      if (message.mission_id === missionId) {
        const { new_status, mission_data } = message.payload;
        const updatedMission = { ...mission, status: new_status, ...mission_data };
        setMission(updatedMission);
        onMissionUpdate?.(updatedMission);
        
        // Show status change notification
        const statusMessage = getStatusChangeMessage(message.payload.old_status, new_status);
        if (statusMessage) {
          setAlerts(prev => [...prev, {
            id: Date.now(),
            type: 'status_change',
            message: statusMessage,
            timestamp: new Date().toISOString()
          }]);
        }
      }
    };

    const handleLocationUpdate = (message: WebSocketMessage) => {
      if (message.mission_id === missionId) {
        const locationData = message.payload as LocationUpdate;
        setCurrentLocation(locationData);
        setLocationHistory(prev => [...prev.slice(-9), locationData]); // Keep last 10 locations
      }
    };

    const handlePhotoUploaded = (message: WebSocketMessage) => {
      if (message.mission_id === missionId) {
        setPhotos(prev => [...prev, message.payload.photo_data]);
        setAlerts(prev => [...prev, {
          id: Date.now(),
          type: 'photo_upload',
          message: 'New photo uploaded',
          timestamp: new Date().toISOString()
        }]);
      }
    };

    const handleChatMessage = (message: WebSocketMessage) => {
      // Only show chat messages related to this mission
      if (message.payload.room === `mission_${missionId}` || message.mission_id === missionId) {
        setChatMessages(prev => [...prev, {
          id: Date.now(),
          from_user_id: message.payload.from_user_id,
          message: message.payload.message.message,
          timestamp: message.payload.timestamp
        }]);
      }
    };

    const handleEmergencyAlert = (message: WebSocketMessage) => {
      if (message.mission_id === missionId) {
        setAlerts(prev => [...prev, {
          id: Date.now(),
          type: 'emergency',
          message: message.payload.message || 'EMERGENCY ALERT',
          timestamp: new Date().toISOString(),
          priority: 'high'
        }]);
      }
    };

    // Register event listeners
    websocketService.on(MessageType.MISSION_UPDATED, handleMissionUpdate);
    websocketService.on(MessageType.MISSION_STATUS_CHANGED, handleMissionStatusChange);
    websocketService.on(MessageType.LOCATION_UPDATE, handleLocationUpdate);
    websocketService.on(MessageType.PHOTO_UPLOADED, handlePhotoUploaded);
    websocketService.on(MessageType.CHAT_MESSAGE, handleChatMessage);
    websocketService.on(MessageType.EMERGENCY_ALERT, handleEmergencyAlert);

    // Listen for connection status changes
    const handleStatusChange = (event: CustomEvent) => {
      setConnectionStatus(event.detail.status);
      
      // Rejoin room if reconnected
      if (event.detail.status === ConnectionStatus.AUTHENTICATED) {
        websocketService.joinMissionRoom(missionId);
      }
    };

    document.addEventListener('websocket-status-change', handleStatusChange as EventListener);

    // Cleanup
    return () => {
      websocketService.off(MessageType.MISSION_UPDATED, handleMissionUpdate);
      websocketService.off(MessageType.MISSION_STATUS_CHANGED, handleMissionStatusChange);
      websocketService.off(MessageType.LOCATION_UPDATE, handleLocationUpdate);
      websocketService.off(MessageType.PHOTO_UPLOADED, handlePhotoUploaded);
      websocketService.off(MessageType.CHAT_MESSAGE, handleChatMessage);
      websocketService.off(MessageType.EMERGENCY_ALERT, handleEmergencyAlert);
      
      document.removeEventListener('websocket-status-change', handleStatusChange as EventListener);
      
      websocketService.leaveMissionRoom(missionId);
      
      if (locationWatchId.current) {
        navigator.geolocation.clearWatch(locationWatchId.current);
      }
    };
  }, [missionId, mission, onMissionUpdate]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      return;
    }

    setIsTracking(true);
    
    locationWatchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const locationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        
        websocketService.sendLocationUpdate(missionId, locationData);
      },
      (error) => {
        console.error('Error getting location:', error);
        setIsTracking(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }
    );
  };

  const stopLocationTracking = () => {
    if (locationWatchId.current) {
      navigator.geolocation.clearWatch(locationWatchId.current);
      locationWatchId.current = null;
    }
    setIsTracking(false);
  };

  const sendChatMessage = () => {
    if (newMessage.trim()) {
      websocketService.sendChatMessage(newMessage, undefined, `mission_${missionId}`);
      setNewMessage('');
    }
  };

  const sendEmergencyAlert = () => {
    const alertData = {
      mission_id: missionId,
      message: 'Emergency assistance requested',
      location: currentLocation?.location,
      timestamp: new Date().toISOString()
    };
    
    websocketService.sendEmergencyAlert(alertData, missionId);
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'assigned': return 'bg-yellow-100 text-yellow-800';
      case 'declined': return 'bg-red-100 text-red-800';
      case 'paused': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusChangeMessage = (oldStatus: string, newStatus: string): string | null => {
    if (oldStatus === 'assigned' && newStatus === 'in_progress') {
      return 'Mission started';
    }
    if (oldStatus === 'in_progress' && newStatus === 'completed') {
      return 'Mission completed successfully';
    }
    if (newStatus === 'declined') {
      return 'Mission was declined';
    }
    return `Mission status changed from ${oldStatus} to ${newStatus}`;
  };

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getConnectionStatusColor = (): string => {
    switch (connectionStatus) {
      case ConnectionStatus.AUTHENTICATED: return 'text-green-500';
      case ConnectionStatus.CONNECTED: return 'text-yellow-500';
      case ConnectionStatus.CONNECTING: return 'text-blue-500';
      case ConnectionStatus.RECONNECTING: return 'text-orange-500';
      default: return 'text-red-500';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold text-gray-900">{mission.title}</h2>
            <Badge className={getStatusColor(mission.status)}>
              {mission.status.replace('_', ' ').toUpperCase()}
            </Badge>
            
            {/* Connection status indicator */}
            <div className="flex items-center space-x-2">
              <SignalIcon className={`h-4 w-4 ${getConnectionStatusColor()}`} />
              <span className="text-xs text-gray-500 capitalize">{connectionStatus}</span>
            </div>
          </div>
          
          <div className="flex space-x-2">
            {mission.status === 'in_progress' && (
              <>
                <Button
                  onClick={isTracking ? stopLocationTracking : startLocationTracking}
                  variant={isTracking ? 'outline' : 'default'}
                  size="sm"
                >
                  {isTracking ? (
                    <>
                      <PauseIcon className="h-4 w-4 mr-2" />
                      Stop Tracking
                    </>
                  ) : (
                    <>
                      <PlayIcon className="h-4 w-4 mr-2" />
                      Start Tracking
                    </>
                  )}
                </Button>
                
                <Button onClick={sendEmergencyAlert} variant="outline" size="sm" className="text-red-600">
                  <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
                  Emergency
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
        {/* Mission Details */}
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Mission Details</h3>
            
            <div className="space-y-3">
              {mission.assigned_soldier && (
                <div className="flex items-center space-x-3">
                  <UserIcon className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {mission.assigned_soldier.rank} {mission.assigned_soldier.name}
                    </p>
                    <p className="text-xs text-gray-500">Assigned Soldier</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-center space-x-3">
                <MapPinIcon className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {mission.location.address || `${mission.location.latitude}, ${mission.location.longitude}`}
                  </p>
                  <p className="text-xs text-gray-500">Target Location</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <ClockIcon className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(mission.created_at).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">Created</p>
                </div>
              </div>
              
              {mission.started_at && (
                <div className="flex items-center space-x-3">
                  <PlayIcon className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(mission.started_at).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">Started</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Current Location */}
          {currentLocation && (
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-3">Current Location</h4>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <MapPinIcon className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium text-blue-900">Live Position</span>
                </div>
                <p className="text-sm text-blue-800">
                  {currentLocation.location.latitude.toFixed(6)}, {currentLocation.location.longitude.toFixed(6)}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Accuracy: ±{currentLocation.location.accuracy?.toFixed(0)}m
                </p>
                <p className="text-xs text-blue-600">
                  Updated: {formatTimestamp(currentLocation.location.timestamp)}
                </p>
              </div>
            </div>
          )}

          {/* Location History */}
          {locationHistory.length > 0 && (
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-3">Recent Locations</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {locationHistory.slice(-5).reverse().map((location, index) => (
                  <div key={index} className="text-xs bg-gray-50 rounded p-2">
                    <p className="font-mono">
                      {location.location.latitude.toFixed(4)}, {location.location.longitude.toFixed(4)}
                    </p>
                    <p className="text-gray-500">
                      {formatTimestamp(location.location.timestamp)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Alerts and Activity */}
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Activity Feed</h3>
            
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {alerts.length === 0 ? (
                <p className="text-sm text-gray-500">No recent activity</p>
              ) : (
                alerts.slice(-10).reverse().map((alert) => (
                  <div key={alert.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      {alert.type === 'emergency' ? (
                        <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                      ) : alert.type === 'photo_upload' ? (
                        <CameraIcon className="h-5 w-5 text-blue-500" />
                      ) : (
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm ${alert.priority === 'high' ? 'font-bold text-red-900' : 'text-gray-900'}`}>
                        {alert.message}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatTimestamp(alert.timestamp)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Photos */}
          {photos.length > 0 && (
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-3">Recent Photos</h4>
              <div className="grid grid-cols-2 gap-2">
                {photos.slice(-4).map((photo, index) => (
                  <div key={index} className="aspect-square bg-gray-200 rounded-lg overflow-hidden">
                    <img
                      src={photo.url || photo.thumbnail}
                      alt="Mission photo"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Chat */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Mission Chat</h3>
          
          <div 
            ref={chatContainerRef}
            className="border rounded-lg h-64 overflow-y-auto p-4 space-y-3"
          >
            {chatMessages.length === 0 ? (
              <p className="text-sm text-gray-500">No messages yet</p>
            ) : (
              chatMessages.map((msg) => (
                <div key={msg.id} className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-medium text-gray-900">
                      User {msg.from_user_id}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(msg.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800">{msg.message}</p>
                </div>
              ))
            )}
          </div>
          
          <div className="flex space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!websocketService.isAuthenticated()}
            />
            <Button 
              onClick={sendChatMessage}
              disabled={!newMessage.trim() || !websocketService.isAuthenticated()}
              size="sm"
            >
              <ChatBubbleLeftRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealtimeMissionTracker;