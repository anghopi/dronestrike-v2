import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  XMarkIcon,
  MapPinIcon,
  UserIcon,
  CalendarIcon,
  ClockIcon,
  CameraIcon,
  PhoneIcon,
  ChatBubbleLeftIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  PencilIcon
} from '@heroicons/react/24/outline';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';

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
  status: string;
  priority: string;
  created_at: string;
  scheduled_date: string;
  estimated_duration: number;
  mission_type: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  notes: string;
  photos_required: number;
  photos_uploaded: number;
  safety_level: string;
  completed_at?: string;
}

interface MissionDetailModalProps {
  mission: Mission | null;
  isOpen: boolean;
  onClose: () => void;
}

interface StatusUpdate {
  id: number;
  timestamp: string;
  status: string;
  message: string;
  agent_name: string;
  photos?: string[];
}

// Mock service for status updates
const mockStatusUpdates: StatusUpdate[] = [
  {
    id: 1,
    timestamp: '2025-06-17T09:30:00Z',
    status: 'assigned',
    message: 'Mission assigned to agent. Preparing for deployment.',
    agent_name: 'System',
    photos: []
  },
  {
    id: 2,
    timestamp: '2025-06-17T10:15:00Z',
    status: 'en_route',
    message: 'Agent en route to target location. ETA: 15 minutes.',
    agent_name: 'Agent Rodriguez',
    photos: []
  },
  {
    id: 3,
    timestamp: '2025-06-17T10:30:00Z',
    status: 'arrived',
    message: 'Arrived at property. Beginning assessment.',
    agent_name: 'Agent Rodriguez',
    photos: []
  },
  {
    id: 4,
    timestamp: '2025-06-17T10:45:00Z',
    status: 'in_progress',
    message: 'Property assessment in progress. Initial photos captured.',
    agent_name: 'Agent Rodriguez',
    photos: ['exterior_front.jpg', 'exterior_back.jpg']
  }
];

export const MissionDetailModal: React.FC<MissionDetailModalProps> = ({
  mission,
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [newMessage, setNewMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 500));
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
    }
  });

  if (!isOpen || !mission) return null;

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'assigned': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      'in_progress': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      'completed': 'bg-green-500/20 text-green-300 border-green-500/30',
      'cancelled': 'bg-red-500/20 text-red-300 border-red-500/30',
      'on_hold': 'bg-gray-500/20 text-gray-300 border-gray-500/30'
    };
    return colors[status] || colors['assigned'];
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'low': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      'medium': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      'high': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      'urgent': 'bg-red-500/20 text-red-300 border-red-500/30'
    };
    return colors[priority] || colors['medium'];
  };

  const getSafetyColor = (level: string) => {
    const colors: Record<string, string> = {
      'green': 'bg-green-500/20 text-green-300 border-green-500/30',
      'yellow': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      'red': 'bg-red-500/20 text-red-300 border-red-500/30'
    };
    return colors[level] || colors['green'];
  };

  const handleStatusUpdate = (newStatus: string) => {
    updateStatusMutation.mutate({ id: mission.id, status: newStatus });
  };

  const tabs = [
    { id: 'overview', name: 'Overview', icon: DocumentTextIcon },
    { id: 'timeline', name: 'Timeline', icon: ClockIcon },
    { id: 'photos', name: 'Photos', icon: CameraIcon },
    { id: 'communication', name: 'Communication', icon: ChatBubbleLeftIcon }
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-gray-600/50 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50 bg-gradient-to-r from-brand-color/10 to-brand-color-light/10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand-color/20 rounded-lg border border-brand-color/30">
              <MapPinIcon className="h-6 w-6 text-brand-color" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{mission.mission_number}</h2>
              <p className="text-sm text-gray-400">{mission.target_lead.full_name} • {mission.target_lead.property_address}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium border ${getStatusColor(mission.status)}`}>
              {mission.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-5 w-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Mission Status Actions */}
        <div className="p-4 border-b border-gray-700/50 bg-gray-800/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-gray-400" />
                <span className="text-white font-medium">{mission.assigned_soldier.name}</span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-400 font-mono text-sm">{mission.assigned_soldier.phone}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {mission.status === 'assigned' && (
                <Button
                  onClick={() => handleStatusUpdate('in_progress')}
                  className="btn-primary text-sm px-4 py-2"
                  disabled={updateStatusMutation.isPending}
                >
                  <PlayIcon className="h-4 w-4 mr-1" />
                  Start Mission
                </Button>
              )}
              {mission.status === 'in_progress' && (
                <>
                  <Button
                    onClick={() => handleStatusUpdate('on_hold')}
                    variant="outline"
                    className="text-sm px-4 py-2"
                    disabled={updateStatusMutation.isPending}
                  >
                    <PauseIcon className="h-4 w-4 mr-1" />
                    Pause
                  </Button>
                  <Button
                    onClick={() => handleStatusUpdate('completed')}
                    className="btn-primary text-sm px-4 py-2"
                    disabled={updateStatusMutation.isPending}
                  >
                    <CheckCircleIcon className="h-4 w-4 mr-1" />
                    Complete
                  </Button>
                </>
              )}
              <Button
                onClick={() => window.open(`tel:${mission.assigned_soldier.phone}`, '_self')}
                variant="outline"
                className="text-sm px-4 py-2"
              >
                <PhoneIcon className="h-4 w-4 mr-1" />
                Call Agent
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-700/50">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-brand-color text-brand-color'
                    : 'border-transparent text-gray-400 hover:text-white hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Details */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700/50">
                  <h3 className="text-lg font-semibold text-white mb-4">Mission Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Mission Type</p>
                      <p className="text-white font-medium">{mission.mission_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Priority</p>
                      <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getPriorityColor(mission.priority)}`}>
                        {mission.priority.toUpperCase()}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Scheduled Date</p>
                      <p className="text-white font-medium">{formatDateTime(mission.scheduled_date)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Duration</p>
                      <p className="text-white font-medium">{mission.estimated_duration} minutes</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Safety Level</p>
                      <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getSafetyColor(mission.safety_level)}`}>
                        <div className={`w-2 h-2 rounded-full mr-2 ${
                          mission.safety_level === 'green' ? 'bg-green-400' : 
                          mission.safety_level === 'yellow' ? 'bg-yellow-400' : 'bg-red-400'
                        }`}></div>
                        {mission.safety_level.toUpperCase()}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Photos Progress</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-brand-color h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(mission.photos_uploaded / mission.photos_required) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-white">{mission.photos_uploaded}/{mission.photos_required}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700/50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Mission Notes</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(!isEditing)}
                    >
                      <PencilIcon className="h-4 w-4 mr-1" />
                      {isEditing ? 'Save' : 'Edit'}
                    </Button>
                  </div>
                  {isEditing ? (
                    <textarea
                      className="w-full p-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white resize-none focus:ring-2 focus:ring-brand-color/50"
                      rows={4}
                      defaultValue={mission.notes}
                    />
                  ) : (
                    <p className="text-gray-300">{mission.notes || 'No notes available for this mission.'}</p>
                  )}
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700/50">
                  <h3 className="text-lg font-semibold text-white mb-4">Location</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Property Address</p>
                      <p className="text-white">{mission.target_lead.property_address}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Coordinates</p>
                      <p className="text-white font-mono">{mission.coordinates.lat}, {mission.coordinates.lng}</p>
                    </div>
                    <Button variant="outline" className="w-full">
                      <MapPinIcon className="h-4 w-4 mr-2" />
                      View on Map
                    </Button>
                  </div>
                </div>

                <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700/50">
                  <h3 className="text-lg font-semibold text-white mb-4">Contact Information</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Client Name</p>
                      <p className="text-white">{mission.target_lead.full_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Assigned Agent</p>
                      <p className="text-white">{mission.assigned_soldier.name}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1">
                        <PhoneIcon className="h-4 w-4 mr-1" />
                        Call
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <ChatBubbleLeftIcon className="h-4 w-4 mr-1" />
                        Message
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Timeline Tab */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white mb-4">Mission Timeline</h3>
              <div className="space-y-4">
                {mockStatusUpdates.map((update, index) => (
                  <div key={update.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        update.status === 'completed' ? 'bg-green-500' :
                        update.status === 'in_progress' ? 'bg-yellow-500' :
                        'bg-blue-500'
                      }`}>
                        {update.status === 'completed' ? (
                          <CheckCircleIcon className="h-5 w-5 text-white" />
                        ) : (
                          <div className="w-3 h-3 rounded-full bg-white"></div>
                        )}
                      </div>
                      {index < mockStatusUpdates.length - 1 && (
                        <div className="w-0.5 h-12 bg-gray-600 mt-2"></div>
                      )}
                    </div>
                    <div className="flex-1 bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium">{update.agent_name}</span>
                        <span className="text-xs text-gray-400">{formatDateTime(update.timestamp)}</span>
                      </div>
                      <p className="text-gray-300 text-sm">{update.message}</p>
                      {update.photos && update.photos.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-gray-400 mb-2">Attachments: {update.photos.length} photos</p>
                          <div className="flex gap-2">
                            {update.photos.map((photo, idx) => (
                              <div key={idx} className="w-16 h-16 bg-gray-700 rounded border border-gray-600 flex items-center justify-center">
                                <CameraIcon className="h-6 w-6 text-gray-400" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Photos Tab */}
          {activeTab === 'photos' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Mission Photos</h3>
                <div className="text-sm text-gray-400">
                  {mission.photos_uploaded} of {mission.photos_required} photos uploaded
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: mission.photos_required }, (_, i) => (
                  <div
                    key={i}
                    className={`aspect-square rounded-lg border-2 border-dashed flex items-center justify-center ${
                      i < mission.photos_uploaded
                        ? 'border-green-500/50 bg-green-500/10'
                        : 'border-gray-600/50 bg-gray-800/30'
                    }`}
                  >
                    <div className="text-center">
                      <CameraIcon className={`h-8 w-8 mx-auto mb-2 ${
                        i < mission.photos_uploaded ? 'text-green-400' : 'text-gray-500'
                      }`} />
                      <p className={`text-xs ${
                        i < mission.photos_uploaded ? 'text-green-400' : 'text-gray-500'
                      }`}>
                        {i < mission.photos_uploaded ? 'Uploaded' : 'Pending'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Communication Tab */}
          {activeTab === 'communication' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-white">Team Communication</h3>
              
              <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50 max-h-96 overflow-y-auto">
                <div className="space-y-4">
                  {/* Sample messages */}
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-color flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-bold">AR</span>
                    </div>
                    <div className="flex-1">
                      <div className="bg-gray-700/50 rounded-lg p-3">
                        <p className="text-white text-sm">Just arrived at the property. Initial assessment looks good.</p>
                        <p className="text-xs text-gray-400 mt-1">Agent Rodriguez • 10:30 AM</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 justify-end">
                    <div className="flex-1 max-w-xs">
                      <div className="bg-brand-color/20 rounded-lg p-3">
                        <p className="text-white text-sm">Great! Remember to get photos of all exterior angles.</p>
                        <p className="text-xs text-gray-400 mt-1">Command Center • 10:32 AM</p>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-bold">CC</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message to the field agent..."
                  className="flex-1 bg-gray-800/60 border-gray-600/50 text-white"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && newMessage.trim()) {
                      // Handle send message
                      setNewMessage('');
                    }
                  }}
                />
                <Button className="btn-primary">
                  <span className="text-sm">➤</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};