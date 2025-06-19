import React, { useState, useMemo } from 'react';
import { 
  MapIcon,
  ClockIcon,
  UserIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ViewColumnsIcon,
  ArrowPathIcon,
  PlayCircleIcon,
  ShieldCheckIcon,
  BoltIcon,
  FireIcon,
  SignalIcon,
  PhoneIcon,
  ChatBubbleLeftIcon,
  DocumentArrowDownIcon,
  EyeIcon,
  CameraIcon
} from '@heroicons/react/24/outline';

interface Mission {
  id: number;
  mission_number: string;
  target_lead: {
    id: number;
    full_name: string;
    property_address: string;
  };
  assigned_soldier: {
    id: number;
    name: string;
    phone: string;
  };
  status: 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  safety_level: 'green' | 'yellow' | 'red';
  created_at: string;
  scheduled_date?: string;
  estimated_duration?: number;
}

const mockMissions: Mission[] = [
  {
    id: 1,
    mission_number: 'M-2025-001',
    target_lead: { id: 1, full_name: 'John Smith', property_address: '123 Main St, Dallas, TX 75201' },
    assigned_soldier: { id: 1, name: 'Agent Rodriguez', phone: '+1-555-0123' },
    status: 'in_progress',
    priority: 'high',
    safety_level: 'green',
    created_at: '2025-06-17T09:00:00Z',
    scheduled_date: '2025-06-17T14:00:00Z',
    estimated_duration: 120
  },
  {
    id: 2,
    mission_number: 'M-2025-002',
    target_lead: { id: 2, full_name: 'Sarah Johnson', property_address: '456 Oak Ave, Austin, TX 78701' },
    assigned_soldier: { id: 2, name: 'Agent Chen', phone: '+1-555-0124' },
    status: 'assigned',
    priority: 'medium',
    safety_level: 'yellow',
    created_at: '2025-06-17T10:30:00Z',
    scheduled_date: '2025-06-18T09:00:00Z',
    estimated_duration: 90
  },
  {
    id: 3,
    mission_number: 'M-2025-003',
    target_lead: { id: 3, full_name: 'Mike Davis', property_address: '789 Pine St, Houston, TX 77001' },
    assigned_soldier: { id: 3, name: 'Agent Thompson', phone: '+1-555-0125' },
    status: 'completed',
    priority: 'low',
    safety_level: 'green',
    created_at: '2025-06-16T08:00:00Z',
    scheduled_date: '2025-06-16T15:00:00Z',
    estimated_duration: 60
  }
];

const Missions: React.FC = () => {
  const [missions, setMissions] = useState<Mission[]>(mockMissions);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedActions, setSelectedActions] = useState<{[key: string]: string}>({});

  const handleActionClick = (missionId: number, action: string) => {
    const key = `${missionId}-${action}`;
    setSelectedActions(prev => ({
      ...prev,
      [key]: prev[key] ? '' : action // Toggle selection
    }));
  };

  const isActionSelected = (missionId: number, action: string) => {
    const key = `${missionId}-${action}`;
    return selectedActions[key] === action;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: Mission['status']) => {
    const colors = {
      'assigned': 'status-badge bg-brand-color text-white border-brand-color',
      'in_progress': 'status-badge bg-alert-yellow text-gray-900 border-alert-yellow',
      'completed': 'status-badge bg-olive-green text-white border-olive-green',
      'cancelled': 'status-badge bg-critical-red text-white border-critical-red',
      'on_hold': 'status-badge bg-gray-500 text-white border-gray-500'
    };
    return colors[status] || colors['assigned'];
  };

  const getPriorityColor = (priority: Mission['priority']) => {
    const colors = {
      'low': 'status-badge bg-gray-500 text-white border-gray-500',
      'medium': 'status-badge bg-alert-yellow text-gray-900 border-alert-yellow',
      'high': 'status-badge bg-orange-500 text-white border-orange-500',
      'urgent': 'status-badge bg-critical-red text-white border-critical-red'
    };
    return colors[priority] || colors['medium'];
  };

  const getSafetyColor = (level: Mission['safety_level']) => {
    const colors = {
      'green': 'status-badge bg-olive-green text-white border-olive-green',
      'yellow': 'status-badge bg-alert-yellow text-gray-900 border-alert-yellow',
      'red': 'status-badge bg-critical-red text-white border-critical-red'
    };
    return colors[level] || colors['green'];
  };

  const filteredMissions = missions.filter(mission => {
    const matchesSearch = mission.mission_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         mission.target_lead.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         mission.assigned_soldier.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || mission.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || mission.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getStatusIcon = (status: Mission['status']) => {
    const icons = {
      'assigned': PlayCircleIcon,
      'in_progress': BoltIcon,
      'completed': CheckCircleIcon,
      'cancelled': ExclamationTriangleIcon,
      'on_hold': ClockIcon,
      'pending': ClockIcon,
      'ready': PlayCircleIcon,
      'active': BoltIcon,
      'paused': ClockIcon,
      'failed': ExclamationTriangleIcon,
      'draft': ClockIcon
    };
    return icons[status] || ClockIcon;
  };

  return (
    <div className="h-full space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title flex items-center">
              Mission Command
              <span className="ml-4 status-badge bg-olive-green text-white border-olive-green">
                OPERATIONAL
              </span>
            </h1>
            <p className="page-subtitle">Coordinate field operations and tactical deployments</p>
          </div>
          <div className="flex items-center space-x-3">
            <button className="btn-secondary">
              <ArrowPathIcon className="w-5 h-5 mr-2" />
              Refresh
            </button>
            <button className="btn-danger">
              <BoltIcon className="w-5 h-5 mr-2" />
              Deploy Mission
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search missions, agents, targets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-military w-full pl-10 pr-4 py-3"
          />
        </div>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-military px-3 py-3"
        >
          <option value="all">All Status</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="on_hold">On Hold</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="input-military px-3 py-3"
        >
          <option value="all">All Priority</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>

        <button className="btn-secondary p-3">
          <ViewColumnsIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
        {/* Main Missions Table */}
        <div className="lg:col-span-5">
          <div className="enhanced-card">
            {/* Table Header */}
            <div className="px-6 py-5 border-b border-navy-blue-light">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">
                  Active Missions 
                  <span className="text-gray-400 font-normal ml-2">({filteredMissions.length})</span>
                </h3>
                <div className="flex items-center space-x-2">
                  <button className="btn-secondary px-4 py-2 text-sm">
                    Export
                  </button>
                </div>
              </div>
            </div>

            {/* Missions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
              {filteredMissions.map(mission => {
                const StatusIcon = getStatusIcon(mission.status);
                const statusColorClass = getStatusColor(mission.status);
                const priorityColorClass = getPriorityColor(mission.priority);
                const safetyColorClass = getSafetyColor(mission.safety_level);
                
                return (
                  <div 
                    key={mission.id}
                    className="enhanced-card p-4 hover:bg-navy-blue-light/30 transition-all duration-200"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <StatusIcon className="h-4 w-4 text-brand-color" />
                        <div className="text-sm font-semibold text-white font-mono">
                          {mission.mission_number}
                        </div>
                      </div>
                      <div className="flex space-x-1">
                        <button 
                          className={`p-1 rounded hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors ${isActionSelected(mission.id, 'view') ? 'text-blue-400' : ''}`}
                          onClick={() => handleActionClick(mission.id, 'view')}
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        <button 
                          className={`p-1 rounded hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors ${isActionSelected(mission.id, 'chat') ? 'text-green-400' : ''}`}
                          onClick={() => handleActionClick(mission.id, 'chat')}
                        >
                          <ChatBubbleLeftIcon className="h-4 w-4" />
                        </button>
                        <button 
                          className={`p-1 rounded hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors ${isActionSelected(mission.id, 'map') ? 'text-purple-400' : ''}`}
                          onClick={() => handleActionClick(mission.id, 'map')}
                        >
                          <MapIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Status Badges */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      <span className={`${statusColorClass} px-2 py-1 text-xs font-semibold rounded`}>
                        {mission.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span className={`${priorityColorClass} px-2 py-1 text-xs font-semibold rounded`}>
                        {mission.priority.toUpperCase()}
                      </span>
                      <span className={`${safetyColorClass} px-2 py-1 text-xs font-semibold rounded`}>
                        {mission.safety_level.toUpperCase()}
                      </span>
                    </div>

                    {/* Target Info */}
                    <div className="mb-3">
                      <div className="flex items-center space-x-2 mb-1">
                        <MapIcon className="h-3 w-3 text-brand-color flex-shrink-0" />
                        <span className="text-sm font-medium text-white truncate">
                          {mission.target_lead.full_name}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 truncate pl-5">
                        {mission.target_lead.property_address}
                      </div>
                    </div>

                    {/* Agent Info */}
                    <div className="mb-3">
                      <div className="flex items-center space-x-2 mb-1">
                        <UserIcon className="h-3 w-3 text-olive-green flex-shrink-0" />
                        <span className="text-sm font-medium text-white truncate">
                          {mission.assigned_soldier.name}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 pl-5">
                        <PhoneIcon className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-400 font-mono">
                          {mission.assigned_soldier.phone}
                        </span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="text-xs text-gray-500 border-t border-gray-700/50 pt-2">
                      Created {formatDate(mission.created_at)}
                    </div>
                  </div>
                );
              })}

              {filteredMissions.length === 0 && (
                <div className="col-span-full px-6 py-16 text-center">
                  <div className="mission-empty-state w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                    <BoltIcon className="h-10 w-10 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">No missions found</h3>
                  <p className="text-gray-400 max-w-md mx-auto">
                    Try adjusting your search criteria or filters to find missions.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar - Mission Controls */}
        <div className="space-y-4">
          {/* Mission Overview and Quick Actions - Side by Side */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Mission Stats */}
            <div className="enhanced-card p-6">
              <h3 className="text-sm font-medium text-gray-400 uppercase mb-4 tracking-wider">Mission Overview</h3>
              <div className="space-y-4">
                {[
                  { label: 'Active Missions', value: missions.filter(m => m.status === 'in_progress').length, color: 'text-alert-yellow' },
                  { label: 'Assigned', value: missions.filter(m => m.status === 'assigned').length, color: 'text-brand-color' },
                  { label: 'Completed Today', value: missions.filter(m => m.status === 'completed').length, color: 'text-olive-green' },
                  { label: 'High Priority', value: missions.filter(m => m.priority === 'high' || m.priority === 'urgent').length, color: 'text-critical-red' }
                ].map((stat, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-gray-300 text-sm">{stat.label}</span>
                    <span className={`font-semibold text-lg ${stat.color}`}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="enhanced-card p-6">
              <h3 className="text-sm font-medium text-gray-400 uppercase mb-4 tracking-wider">Quick Actions</h3>
              <div className="space-y-3">
                {[
                  { icon: PlusIcon, label: 'New Mission', class: 'btn-primary' },
                  { icon: DocumentArrowDownIcon, label: 'Export Report', class: 'btn-secondary' },
                  { icon: MapIcon, label: 'Live Map', class: 'btn-secondary' },
                  { icon: PhoneIcon, label: 'Emergency Contact', class: 'btn-danger' }
                ].map((action, index) => (
                  <button
                    key={index}
                    className={`${action.class} w-full flex items-center justify-center space-x-2 py-2 text-sm`}
                  >
                    <action.icon className="h-4 w-4" />
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Agent Status */}
          <div className="enhanced-card p-6">
            <h3 className="text-sm font-medium text-gray-400 uppercase mb-4 tracking-wider">Agent Status</h3>
            <div className="space-y-3">
              {[
                { name: 'Agent Rodriguez', status: 'ACTIVE', color: 'bg-olive-green' },
                { name: 'Agent Chen', status: 'STANDBY', color: 'bg-alert-yellow' },
                { name: 'Agent Thompson', status: 'OFFLINE', color: 'bg-gray-500' }
              ].map((agent, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 ${agent.color} rounded-full`}></div>
                    <span className="text-white text-sm font-medium">{agent.name}</span>
                  </div>
                  <span className={`status-badge ${agent.color} text-white text-xs`}>
                    {agent.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Missions;