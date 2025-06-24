import React, { useState, useEffect } from 'react';
import { 
  ChartBarIcon,
  UsersIcon,
  MapIcon,
  ClockIcon,
  SignalIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { Badge } from '../ui/badge';
import websocketService, { MessageType, ConnectionStatus } from '../../services/websocketService';
import type { WebSocketMessage } from '../../services/websocketService';

interface DashboardStats {
  active_missions: number;
  total_soldiers: number;
  soldiers_online: number;
  missions_completed_today: number;
  average_mission_time: number;
  success_rate: number;
  alerts_active: number;
  system_health: 'good' | 'warning' | 'critical';
}

interface LiveMetric {
  id: string;
  name: string;
  value: number;
  previous_value?: number;
  unit: string;
  icon: React.ComponentType<any>;
  color: string;
  trend?: 'up' | 'down' | 'stable';
}

interface OnlineUser {
  id: number;
  name: string;
  role: string;
  status: 'online' | 'busy' | 'away';
  last_seen: string;
  current_mission?: number;
}

interface RealtimeDashboardProps {
  className?: string;
}

const RealtimeDashboard: React.FC<RealtimeDashboardProps> = ({ className = '' }) => {
  const [stats, setStats] = useState<DashboardStats>({
    active_missions: 0,
    total_soldiers: 0,
    soldiers_online: 0,
    missions_completed_today: 0,
    average_mission_time: 0,
    success_rate: 0,
    alerts_active: 0,
    system_health: 'good'
  });
  
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(websocketService.getStatus());
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [connectionCount, setConnectionCount] = useState(0);
  const [serverHealth, setServerHealth] = useState<'healthy' | 'degraded' | 'down'>('healthy');

  useEffect(() => {
    // Set up WebSocket event listeners
    const handleStatsUpdate = (message: WebSocketMessage) => {
      const newStats = message.payload;
      setStats(prev => ({ ...prev, ...newStats }));
      setLastUpdate(new Date());
    };

    const handleConnectionCount = (message: WebSocketMessage) => {
      setConnectionCount(message.payload.active_connections || 0);
    };

    const handleUserOnline = (message: WebSocketMessage) => {
      const { user_id, online } = message.payload;
      
      if (online) {
        // Add or update user
        setOnlineUsers(prev => {
          const existing = prev.find(u => u.id === user_id);
          if (existing) {
            return prev.map(u => u.id === user_id ? { ...u, status: 'online', last_seen: new Date().toISOString() } : u);
          } else {
            return [...prev, {
              id: user_id,
              name: `User ${user_id}`,
              role: 'soldier',
              status: 'online',
              last_seen: new Date().toISOString()
            }];
          }
        });
      }
    };

    const handleUserOffline = (message: WebSocketMessage) => {
      const { user_id } = message.payload;
      setOnlineUsers(prev => prev.filter(u => u.id !== user_id));
    };

    const handleMissionStatusChange = (message: WebSocketMessage) => {
      const { mission_id, new_status, old_status, mission_data } = message.payload;
      
      // Add to recent activities
      setRecentActivities(prev => [{
        id: Date.now(),
        type: 'mission_status',
        message: `Mission ${mission_id} changed from ${old_status} to ${new_status}`,
        timestamp: new Date().toISOString(),
        mission_id,
        data: mission_data
      }, ...prev.slice(0, 19)]); // Keep last 20 activities

      // Update stats based on status change
      if (new_status === 'completed') {
        setStats(prev => ({
          ...prev,
          missions_completed_today: prev.missions_completed_today + 1,
          active_missions: Math.max(0, prev.active_missions - 1)
        }));
      } else if (old_status !== 'active' && new_status === 'in_progress') {
        setStats(prev => ({
          ...prev,
          active_missions: prev.active_missions + 1
        }));
      }
    };

    const handleLocationUpdate = (message: WebSocketMessage) => {
      const { mission_id, user_id, location } = message.payload;
      
      // Update user location in online users
      setOnlineUsers(prev => prev.map(u => 
        u.id === user_id 
          ? { ...u, current_mission: mission_id, last_seen: new Date().toISOString() }
          : u
      ));
    };

    const handleEmergencyAlert = (message: WebSocketMessage) => {
      setStats(prev => ({
        ...prev,
        alerts_active: prev.alerts_active + 1
      }));

      setRecentActivities(prev => [{
        id: Date.now(),
        type: 'emergency',
        message: message.payload.message || 'Emergency alert received',
        timestamp: new Date().toISOString(),
        mission_id: message.mission_id,
        priority: 'high'
      }, ...prev.slice(0, 19)]);
    };

    const handleSystemNotification = (message: WebSocketMessage) => {
      setRecentActivities(prev => [{
        id: Date.now(),
        type: 'system',
        message: message.payload.message || 'System notification',
        timestamp: new Date().toISOString(),
        data: message.payload
      }, ...prev.slice(0, 19)]);
    };

    // Register event listeners
    websocketService.on(MessageType.STATS_UPDATE, handleStatsUpdate);
    websocketService.on(MessageType.CONNECTION_COUNT, handleConnectionCount);
    websocketService.on(MessageType.USER_ONLINE, handleUserOnline);
    websocketService.on(MessageType.USER_OFFLINE, handleUserOffline);
    websocketService.on(MessageType.MISSION_STATUS_CHANGED, handleMissionStatusChange);
    websocketService.on(MessageType.LOCATION_UPDATE, handleLocationUpdate);
    websocketService.on(MessageType.EMERGENCY_ALERT, handleEmergencyAlert);
    websocketService.on(MessageType.SYSTEM_NOTIFICATION, handleSystemNotification);

    // Listen for connection status changes
    const handleStatusChange = (event: CustomEvent) => {
      setConnectionStatus(event.detail.status);
      
      // Update server health based on connection status
      if (event.detail.status === ConnectionStatus.AUTHENTICATED) {
        setServerHealth('healthy');
      } else if (event.detail.status === ConnectionStatus.RECONNECTING) {
        setServerHealth('degraded');
      } else if (event.detail.status === ConnectionStatus.DISCONNECTED) {
        setServerHealth('down');
      }
    };

    document.addEventListener('websocket-status-change', handleStatusChange as EventListener);

    // Auto-join command room for receiving updates
    if (websocketService.isAuthenticated()) {
      websocketService.joinRoom('command');
    }

    // Load initial data
    loadInitialData();

    return () => {
      websocketService.off(MessageType.STATS_UPDATE, handleStatsUpdate);
      websocketService.off(MessageType.CONNECTION_COUNT, handleConnectionCount);
      websocketService.off(MessageType.USER_ONLINE, handleUserOnline);
      websocketService.off(MessageType.USER_OFFLINE, handleUserOffline);
      websocketService.off(MessageType.MISSION_STATUS_CHANGED, handleMissionStatusChange);
      websocketService.off(MessageType.LOCATION_UPDATE, handleLocationUpdate);
      websocketService.off(MessageType.EMERGENCY_ALERT, handleEmergencyAlert);
      websocketService.off(MessageType.SYSTEM_NOTIFICATION, handleSystemNotification);
      
      document.removeEventListener('websocket-status-change', handleStatusChange as EventListener);
      
      websocketService.leaveRoom('command');
    };
  }, []);

  const loadInitialData = async () => {
    try {
      // Load initial stats from API
      const response = await fetch('/api/analytics/dashboard-stats', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading initial dashboard data:', error);
    }
  };

  const getMetrics = (): LiveMetric[] => [
    {
      id: 'active_missions',
      name: 'Active Missions',
      value: stats.active_missions,
      unit: '',
      icon: MapIcon,
      color: 'text-blue-600',
      trend: 'stable'
    },
    {
      id: 'soldiers_online',
      name: 'Soldiers Online',
      value: stats.soldiers_online,
      unit: `/${stats.total_soldiers}`,
      icon: UsersIcon,
      color: 'text-green-600',
      trend: 'stable'
    },
    {
      id: 'completed_today',
      name: 'Completed Today',
      value: stats.missions_completed_today,
      unit: '',
      icon: CheckCircleIcon,
      color: 'text-emerald-600',
      trend: 'up'
    },
    {
      id: 'success_rate',
      name: 'Success Rate',
      value: stats.success_rate,
      unit: '%',
      icon: ChartBarIcon,
      color: 'text-purple-600',
      trend: 'stable'
    },
    {
      id: 'avg_mission_time',
      name: 'Avg Mission Time',
      value: Math.round(stats.average_mission_time / 60),
      unit: ' min',
      icon: ClockIcon,
      color: 'text-orange-600',
      trend: 'down'
    },
    {
      id: 'active_alerts',
      name: 'Active Alerts',
      value: stats.alerts_active,
      unit: '',
      icon: ExclamationTriangleIcon,
      color: 'text-red-600',
      trend: stats.alerts_active > 0 ? 'up' : 'stable'
    }
  ];

  const getConnectionStatusColor = (): string => {
    switch (connectionStatus) {
      case ConnectionStatus.AUTHENTICATED: return 'text-green-500';
      case ConnectionStatus.CONNECTED: return 'text-yellow-500';
      case ConnectionStatus.CONNECTING: return 'text-blue-500';
      case ConnectionStatus.RECONNECTING: return 'text-orange-500';
      default: return 'text-red-500';
    }
  };

  const getServerHealthColor = (): string => {
    switch (serverHealth) {
      case 'healthy': return 'bg-green-100 text-green-800';
      case 'degraded': return 'bg-yellow-100 text-yellow-800';
      case 'down': return 'bg-red-100 text-red-800';
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case 'up':
        return <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />;
      case 'down':
        return <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'emergency':
        return <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />;
      case 'mission_status':
        return <MapIcon className="h-4 w-4 text-blue-500" />;
      case 'system':
        return <CheckCircleIcon className="h-4 w-4 text-gray-500" />;
      default:
        return <EyeIcon className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Connection Status */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Real-Time Dashboard</h2>
        
        <div className="flex items-center space-x-4">
          {/* Server Health */}
          <Badge className={getServerHealthColor()}>
            {serverHealth.toUpperCase()}
          </Badge>
          
          {/* Connection Status */}
          <div className="flex items-center space-x-2">
            <SignalIcon className={`h-5 w-5 ${getConnectionStatusColor()}`} />
            <span className="text-sm text-gray-600 capitalize">{connectionStatus}</span>
          </div>
          
          {/* Last Update */}
          <div className="text-sm text-gray-500">
            Last update: {lastUpdate.toLocaleTimeString()}
          </div>
          
          {/* Connection Count */}
          <div className="text-sm text-gray-500">
            {connectionCount} connected
          </div>
        </div>
      </div>

      {/* Live Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {getMetrics().map((metric) => (
          <div key={metric.id} className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg bg-gray-100`}>
                  <metric.icon className={`h-6 w-6 ${metric.color}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">{metric.name}</p>
                  <div className="flex items-center space-x-2">
                    <p className="text-2xl font-bold text-gray-900">
                      {metric.value.toLocaleString()}{metric.unit}
                    </p>
                    {getTrendIcon(metric.trend)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Online Users */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Online Personnel</h3>
          </div>
          <div className="p-6 max-h-80 overflow-y-auto">
            {onlineUsers.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No users online</p>
            ) : (
              <div className="space-y-3">
                {onlineUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                      </div>
                    </div>
                    {user.current_mission && (
                      <Badge variant="outline" className="text-xs">
                        Mission {user.current_mission}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          </div>
          <div className="p-6 max-h-80 overflow-y-auto">
            {recentActivities.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No recent activity</p>
            ) : (
              <div className="space-y-4">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${activity.priority === 'high' ? 'font-bold text-red-900' : 'text-gray-900'}`}>
                        {activity.message}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <p className="text-xs text-gray-500">
                          {formatTimestamp(activity.timestamp)}
                        </p>
                        {activity.mission_id && (
                          <Badge variant="outline" className="text-xs">
                            Mission {activity.mission_id}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System Health Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${serverHealth === 'healthy' ? 'bg-green-500' : serverHealth === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
            <div>
              <p className="text-sm font-medium text-gray-600">Server Status</p>
              <p className="text-lg font-semibold text-gray-900 capitalize">{serverHealth}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center space-x-3">
            <SignalIcon className={`h-6 w-6 ${getConnectionStatusColor()}`} />
            <div>
              <p className="text-sm font-medium text-gray-600">WebSocket</p>
              <p className="text-lg font-semibold text-gray-900 capitalize">{connectionStatus}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center space-x-3">
            <UsersIcon className="h-6 w-6 text-blue-500" />
            <div>
              <p className="text-sm font-medium text-gray-600">Active Connections</p>
              <p className="text-lg font-semibold text-gray-900">{connectionCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center space-x-3">
            <ChartBarIcon className="h-6 w-6 text-green-500" />
            <div>
              <p className="text-sm font-medium text-gray-600">System Load</p>
              <p className="text-lg font-semibold text-gray-900">Normal</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealtimeDashboard;