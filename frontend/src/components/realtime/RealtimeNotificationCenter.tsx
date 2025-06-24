import React, { useState, useEffect, useRef } from 'react';
import { 
  BellIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  XMarkIcon,
  EyeIcon,
  TrashIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import websocketService, { MessageType, ConnectionStatus } from '../../services/websocketService';
import type { WebSocketMessage } from '../../services/websocketService';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'emergency';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  mission_id?: number;
  user_id?: number;
  action_url?: string;
  data?: any;
}

interface RealtimeNotificationCenterProps {
  className?: string;
}

const RealtimeNotificationCenter: React.FC<RealtimeNotificationCenterProps> = ({ className = '' }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(websocketService.getStatus());
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread' | 'missions' | 'system'>('all');
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    // Set up WebSocket event listeners
    const handleNotification = (message: WebSocketMessage) => {
      const notification: Notification = {
        id: message.message_id || Date.now().toString(),
        type: 'info',
        title: message.payload.title || 'Notification',
        message: message.payload.message || 'New notification received',
        timestamp: message.timestamp || new Date().toISOString(),
        read: false,
        mission_id: message.mission_id,
        user_id: message.user_id,
        action_url: message.payload.action_url,
        data: message.payload
      };
      
      addNotification(notification);
      playNotificationSound();
    };

    const handleAlert = (message: WebSocketMessage) => {
      const notification: Notification = {
        id: message.message_id || Date.now().toString(),
        type: 'warning',
        title: message.payload.title || 'Alert',
        message: message.payload.message || 'Alert notification',
        timestamp: message.timestamp || new Date().toISOString(),
        read: false,
        mission_id: message.mission_id,
        user_id: message.user_id,
        data: message.payload
      };
      
      addNotification(notification);
      playNotificationSound();
    };

    const handleEmergencyAlert = (message: WebSocketMessage) => {
      const notification: Notification = {
        id: message.message_id || Date.now().toString(),
        type: 'emergency',
        title: 'EMERGENCY ALERT',
        message: message.payload.message || 'Emergency situation detected',
        timestamp: message.timestamp || new Date().toISOString(),
        read: false,
        mission_id: message.mission_id,
        user_id: message.user_id,
        data: message.payload
      };
      
      addNotification(notification);
      playEmergencySound();
      
      // Auto-open for emergency alerts
      setIsOpen(true);
    };

    const handleMissionStatusChange = (message: WebSocketMessage) => {
      const { old_status, new_status, mission_data } = message.payload;
      const notification: Notification = {
        id: message.message_id || Date.now().toString(),
        type: getStatusChangeType(new_status),
        title: 'Mission Status Update',
        message: `Mission "${mission_data.title}" changed from ${old_status} to ${new_status}`,
        timestamp: message.timestamp || new Date().toISOString(),
        read: false,
        mission_id: message.mission_id,
        action_url: `/missions/${message.mission_id}`,
        data: message.payload
      };
      
      addNotification(notification);
    };

    const handleMissionAssigned = (message: WebSocketMessage) => {
      const notification: Notification = {
        id: message.message_id || Date.now().toString(),
        type: 'info',
        title: 'New Mission Assignment',
        message: `You have been assigned to mission: ${message.payload.mission_title}`,
        timestamp: message.timestamp || new Date().toISOString(),
        read: false,
        mission_id: message.mission_id,
        action_url: `/missions/${message.mission_id}`,
        data: message.payload
      };
      
      addNotification(notification);
      playNotificationSound();
    };

    const handlePhotoUploaded = (message: WebSocketMessage) => {
      const notification: Notification = {
        id: message.message_id || Date.now().toString(),
        type: 'success',
        title: 'Photo Uploaded',
        message: `New photo uploaded for mission ${message.mission_id}`,
        timestamp: message.timestamp || new Date().toISOString(),
        read: false,
        mission_id: message.mission_id,
        action_url: `/missions/${message.mission_id}`,
        data: message.payload
      };
      
      addNotification(notification);
    };

    const handleSystemNotification = (message: WebSocketMessage) => {
      const notification: Notification = {
        id: message.message_id || Date.now().toString(),
        type: 'info',
        title: message.payload.title || 'System Notification',
        message: message.payload.message || 'System update',
        timestamp: message.timestamp || new Date().toISOString(),
        read: false,
        data: message.payload
      };
      
      addNotification(notification);
    };

    // Register event listeners
    websocketService.on(MessageType.NOTIFICATION, handleNotification);
    websocketService.on(MessageType.ALERT, handleAlert);
    websocketService.on(MessageType.EMERGENCY_ALERT, handleEmergencyAlert);
    websocketService.on(MessageType.MISSION_STATUS_CHANGED, handleMissionStatusChange);
    websocketService.on(MessageType.MISSION_ASSIGNED, handleMissionAssigned);
    websocketService.on(MessageType.PHOTO_UPLOADED, handlePhotoUploaded);
    websocketService.on(MessageType.SYSTEM_NOTIFICATION, handleSystemNotification);

    // Listen for connection status changes
    const handleStatusChange = (event: CustomEvent) => {
      setConnectionStatus(event.detail.status);
    };

    document.addEventListener('websocket-status-change', handleStatusChange as EventListener);

    // Click outside to close
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    // Load stored notifications
    loadStoredNotifications();

    return () => {
      websocketService.off(MessageType.NOTIFICATION, handleNotification);
      websocketService.off(MessageType.ALERT, handleAlert);
      websocketService.off(MessageType.EMERGENCY_ALERT, handleEmergencyAlert);
      websocketService.off(MessageType.MISSION_STATUS_CHANGED, handleMissionStatusChange);
      websocketService.off(MessageType.MISSION_ASSIGNED, handleMissionAssigned);
      websocketService.off(MessageType.PHOTO_UPLOADED, handlePhotoUploaded);
      websocketService.off(MessageType.SYSTEM_NOTIFICATION, handleSystemNotification);
      
      document.removeEventListener('websocket-status-change', handleStatusChange as EventListener);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Update unread count when notifications change
  useEffect(() => {
    const unread = notifications.filter(n => !n.read).length;
    setUnreadCount(unread);
  }, [notifications]);

  // Save notifications to localStorage
  useEffect(() => {
    localStorage.setItem('notifications', JSON.stringify(notifications.slice(-100))); // Keep last 100
  }, [notifications]);

  const loadStoredNotifications = () => {
    try {
      const stored = localStorage.getItem('notifications');
      if (stored) {
        const parsedNotifications = JSON.parse(stored);
        setNotifications(parsedNotifications);
      }
    } catch (error) {
      console.error('Error loading stored notifications:', error);
    }
  };

  const addNotification = (notification: Notification) => {
    setNotifications(prev => [notification, ...prev].slice(0, 100)); // Keep only last 100
  };

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.volume = 0.3;
      audioRef.current.play().catch(() => {
        // Ignore audio play errors (often due to user interaction requirements)
      });
    }
  };

  const playEmergencySound = () => {
    if (audioRef.current) {
      audioRef.current.volume = 0.8;
      audioRef.current.play().catch(() => {
        // Ignore audio play errors
      });
    }
  };

  const getStatusChangeType = (status: string): Notification['type'] => {
    switch (status) {
      case 'completed': return 'success';
      case 'declined': return 'error';
      case 'in_progress': return 'info';
      default: return 'info';
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
      case 'emergency':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-600 animate-pulse" />;
      default:
        return <InformationCircleIcon className="h-5 w-5 text-blue-500" />;
    }
  };

  const getNotificationBgColor = (type: Notification['type'], read: boolean) => {
    if (read) return 'bg-gray-50';
    
    switch (type) {
      case 'emergency': return 'bg-red-50 border-l-4 border-red-500';
      case 'error': return 'bg-red-50';
      case 'warning': return 'bg-yellow-50';
      case 'success': return 'bg-green-50';
      default: return 'bg-blue-50';
    }
  };

  const filteredNotifications = notifications.filter(n => {
    switch (filter) {
      case 'unread': return !n.read;
      case 'missions': return n.mission_id !== undefined;
      case 'system': return n.mission_id === undefined;
      default: return true;
    }
  });

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
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
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Audio element for notification sounds */}
      <audio
        ref={audioRef}
        preload="auto"
      >
        <source src="/sounds/notification.mp3" type="audio/mpeg" />
        <source src="/sounds/notification.wav" type="audio/wav" />
      </audio>

      {/* Notification Bell Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
      >
        <BellIcon className={`h-6 w-6 ${getConnectionStatusColor()}`} />
        {unreadCount > 0 && (
          <Badge className="absolute -top-2 -right-2 h-5 w-5 min-w-[20px] p-0 text-xs bg-red-500 text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-lg shadow-lg border z-50 max-h-96 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${getConnectionStatusColor().replace('text-', 'bg-')}`} />
                <span className="text-xs text-gray-500 capitalize">{connectionStatus}</span>
              </div>
            </div>
            
            {/* Filter tabs */}
            <div className="flex space-x-2 mt-3">
              {['all', 'unread', 'missions', 'system'].map((filterType) => (
                <button
                  key={filterType}
                  onClick={() => setFilter(filterType as any)}
                  className={`px-2 py-1 text-xs rounded ${
                    filter === filterType
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-b bg-gray-50 flex justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
              >
                <EyeIcon className="h-4 w-4 mr-1" />
                Mark all read
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="text-red-600 hover:text-red-700"
              >
                <TrashIcon className="h-4 w-4 mr-1" />
                Clear all
              </Button>
            </div>
          )}

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <BellIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No notifications</p>
              </div>
            ) : (
              filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b hover:bg-gray-50 cursor-pointer ${getNotificationBgColor(notification.type, notification.read)}`}
                  onClick={() => {
                    markAsRead(notification.id);
                    if (notification.action_url) {
                      window.location.href = notification.action_url;
                    }
                  }}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-medium ${notification.read ? 'text-gray-700' : 'text-gray-900'}`}>
                          {notification.title}
                        </p>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(notification.timestamp)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                          >
                            <XMarkIcon className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <p className={`text-sm mt-1 ${notification.read ? 'text-gray-500' : 'text-gray-700'}`}>
                        {notification.message}
                      </p>
                      
                      {notification.mission_id && (
                        <div className="mt-2">
                          <Badge variant="outline" className="text-xs">
                            Mission {notification.mission_id}
                          </Badge>
                        </div>
                      )}
                      
                      {!notification.read && (
                        <div className="absolute left-2 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full" />
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t bg-gray-50 text-center">
            <Button variant="ghost" size="sm" className="text-xs">
              <Cog6ToothIcon className="h-4 w-4 mr-1" />
              Notification Settings
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RealtimeNotificationCenter;