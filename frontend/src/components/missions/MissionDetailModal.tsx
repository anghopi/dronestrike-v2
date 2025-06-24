import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  PencilIcon,
  HandRaisedIcon,
  BoltIcon,
  ShieldCheckIcon,
  FireIcon,
  EyeIcon,
  ArrowPathIcon,
  DocumentArrowUpIcon,
  GlobeAltIcon,
  BeakerIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';

interface Mission {
  id: number;
  mission_number: string;
  title: string;
  description?: string;
  instructions?: string;
  target_lead: {
    id: number;
    full_name: string;
    property_address: string;
    phone?: string;
    email?: string;
  };
  assigned_soldier: {
    id: number;
    name: string;
    phone: string;
    email?: string;
  };
  status: string;
  priority: string;
  safety_level: string;
  mission_type: string;
  created_at: string;
  scheduled_date?: string;
  completed_at?: string;
  estimated_duration: number;
  actual_duration?: number;
  coordinates: {
    lat: number;
    lng: number;
  };
  completion_coordinates?: {
    lat: number;
    lng: number;
  };
  notes: string;
  completion_notes?: string;
  photos_required: number;
  photos_uploaded: number;
  initial_amount_due?: number;
  purchase_offer?: number;
  go_to_lead: boolean;
  decline_reason?: string;
  decline_notes?: string;
  quality_score?: number;
  property_id?: number;
  prospect_id?: number;
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
  location?: { lat: number; lng: number };
  metadata?: any;
}

interface DeclineReason {
  id: number;
  name: string;
  description: string;
  is_safety_related: boolean;
}

interface MissionRoute {
  id: number;
  route_name: string;
  status: string;
  total_distance?: number;
  estimated_time?: number;
  started_at?: string;
  completed_at?: string;
  points: RoutePoint[];
}

interface RoutePoint {
  id: number;
  sequence_number: number;
  latitude: number;
  longitude: number;
  address?: string;
  status: string;
  visited_at?: string;
  notes?: string;
}

// Enhanced mock services
const mockServices = {
  getDeclineReasons: async (): Promise<DeclineReason[]> => {
    return [
      { id: 1, name: 'Property inaccessible', description: 'Cannot access property safely', is_safety_related: false },
      { id: 2, name: 'Aggressive occupant', description: 'Occupant showed aggressive behavior', is_safety_related: true },
      { id: 3, name: 'Dangerous area', description: 'Area deemed unsafe for mission', is_safety_related: true },
      { id: 4, name: 'Property demolished', description: 'Property no longer exists', is_safety_related: false },
      { id: 5, name: 'Wrong address', description: 'Address information incorrect', is_safety_related: false }
    ];
  },

  getMissionRoute: async (missionId: number): Promise<MissionRoute[]> => {
    return [
      {
        id: 1,
        route_name: 'Optimized Route #1',
        status: 'completed',
        total_distance: 12.5,
        estimated_time: 45,
        started_at: '2025-06-17T09:00:00Z',
        completed_at: '2025-06-17T11:30:00Z',
        points: [
          {
            id: 1,
            sequence_number: 1,
            latitude: 32.7767,
            longitude: -96.7970,
            address: '123 Main St, Dallas, TX',
            status: 'visited',
            visited_at: '2025-06-17T10:30:00Z',
            notes: 'Successfully completed assessment'
          },
          {
            id: 2,
            sequence_number: 2,
            latitude: 32.7850,
            longitude: -96.8000,
            address: '456 Oak Ave, Dallas, TX',
            status: 'pending',
            visited_at: undefined,
            notes: undefined
          }
        ]
      }
    ];
  },

  updateMissionStatus: async (missionId: number, status: string, data?: any) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { success: true, message: `Mission ${status} successfully` };
  },

  uploadMissionPhoto: async (missionId: number, file: File, metadata?: any) => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return { success: true, url: 'https://example.com/photo.jpg' };
  }
};

// Enhanced mock status updates with more Laravel-like data
const mockStatusUpdates: StatusUpdate[] = [
  {
    id: 1,
    timestamp: '2025-06-17T09:00:00Z',
    status: 'created',
    message: 'Mission created and assigned. Route optimization completed.',
    agent_name: 'System',
    photos: [],
    metadata: { route_distance: '12.5 km', estimated_time: '45 min' }
  },
  {
    id: 2,
    timestamp: '2025-06-17T09:15:00Z',
    status: 'assigned',
    message: 'Mission assigned to field agent. Pre-mission briefing completed.',
    agent_name: 'Command Center',
    photos: []
  },
  {
    id: 3,
    timestamp: '2025-06-17T10:00:00Z',
    status: 'started',
    message: 'Agent started mission execution. En route to target location.',
    agent_name: 'Agent Rodriguez',
    location: { lat: 32.7500, lng: -96.8000 },
    photos: []
  },
  {
    id: 4,
    timestamp: '2025-06-17T10:30:00Z',
    status: 'arrived',
    message: 'Arrived at target property. Beginning property assessment.',
    agent_name: 'Agent Rodriguez',
    location: { lat: 32.7767, lng: -96.7970 },
    photos: []
  },
  {
    id: 5,
    timestamp: '2025-06-17T10:45:00Z',
    status: 'in_progress',
    message: 'Property assessment in progress. Initial photos captured.',
    agent_name: 'Agent Rodriguez',
    photos: ['exterior_front.jpg', 'exterior_back.jpg', 'driveway.jpg']
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
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [selectedDeclineReason, setSelectedDeclineReason] = useState<number | null>(null);
  const [declineNotes, setDeclineNotes] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');
  const [purchaseOffer, setPurchaseOffer] = useState('');
  const [createOpportunity, setCreateOpportunity] = useState(false);
  
  const queryClient = useQueryClient();

  // Fetch decline reasons
  const { data: declineReasons = [] } = useQuery({
    queryKey: ['decline-reasons'],
    queryFn: mockServices.getDeclineReasons,
    enabled: isOpen
  });

  // Fetch mission route
  const { data: missionRoutes = [] } = useQuery({
    queryKey: ['mission-route', mission?.id],
    queryFn: () => mission ? mockServices.getMissionRoute(mission.id) : [],
    enabled: isOpen && !!mission
  });

  // Mission status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, data }: { id: number; status: string; data?: any }) => 
      mockServices.updateMissionStatus(id, status, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      setShowDeclineModal(false);
      setCompletionNotes('');
      setPurchaseOffer('');
      setCreateOpportunity(false);
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
      'new': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      'assigned': 'bg-brand-color/20 text-brand-color border-brand-color/30',
      'accepted': 'bg-green-500/20 text-green-300 border-green-500/30',
      'in_progress': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      'on_hold': 'bg-gray-500/20 text-gray-300 border-gray-500/30',
      'paused': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      'completed': 'bg-olive-green/20 text-olive-green border-olive-green/30',
      'closed': 'bg-olive-green/20 text-olive-green border-olive-green/30',
      'declined': 'bg-red-500/20 text-red-300 border-red-500/30',
      'declined_safety': 'bg-critical-red/20 text-critical-red border-critical-red/30',
      'cancelled': 'bg-red-500/20 text-red-300 border-red-500/30',
      'failed': 'bg-critical-red/20 text-critical-red border-critical-red/30'
    };
    return colors[status] || colors['new'];
  };

  const getPriorityIcon = (priority: string) => {
    const icons = {
      low: ClockIcon,
      normal: ShieldCheckIcon,
      high: ExclamationTriangleIcon,
      urgent: FireIcon
    };
    return icons[priority as keyof typeof icons] || ShieldCheckIcon;
  };

  const getSafetyIcon = (level: string) => {
    const icons = {
      green: ShieldCheckIcon,
      yellow: ExclamationTriangleIcon,
      red: FireIcon
    };
    return icons[level as keyof typeof icons] || ShieldCheckIcon;
  };

  const handleStartMission = () => {
    updateStatusMutation.mutate({
      id: mission.id,
      status: 'in_progress',
      data: { started_at: new Date().toISOString() }
    });
  };

  const handleCompleteMission = () => {
    const data = {
      completed_at: new Date().toISOString(),
      completion_notes: completionNotes,
      purchase_offer: purchaseOffer ? parseFloat(purchaseOffer) : null,
      create_opportunity: createOpportunity
    };
    
    updateStatusMutation.mutate({
      id: mission.id,
      status: 'completed',
      data
    });
  };

  const handleDeclineMission = () => {
    if (!selectedDeclineReason) return;
    
    const reason = declineReasons.find(r => r.id === selectedDeclineReason);
    const data = {
      decline_reason_id: selectedDeclineReason,
      decline_notes: declineNotes,
      is_safety_related: reason?.is_safety_related || false
    };
    
    updateStatusMutation.mutate({
      id: mission.id,
      status: reason?.is_safety_related ? 'declined_safety' : 'declined',
      data
    });
  };

  const handlePauseMission = () => {
    updateStatusMutation.mutate({
      id: mission.id,
      status: 'paused',
      data: { paused_at: new Date().toISOString() }
    });
  };

  const handleResumeMission = () => {
    updateStatusMutation.mutate({
      id: mission.id,
      status: 'in_progress',
      data: { resumed_at: new Date().toISOString() }
    });
  };

  const tabs = [
    { id: 'overview', name: 'Overview', icon: DocumentTextIcon },
    { id: 'timeline', name: 'Timeline', icon: ClockIcon },
    { id: 'route', name: 'Route', icon: MapPinIcon },
    { id: 'photos', name: 'Photos', icon: CameraIcon },
    { id: 'communication', name: 'Communication', icon: ChatBubbleLeftIcon }
  ];

  const PriorityIcon = getPriorityIcon(mission.priority);
  const SafetyIcon = getSafetyIcon(mission.safety_level);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="enhanced-card w-full max-w-7xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-navy-blue-light">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand-color/20 rounded-lg border border-brand-color/30">
              <BoltIcon className="h-6 w-6 text-brand-color" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{mission.mission_number}</h2>
              <p className="text-sm text-gray-400">{mission.title}</p>
              <p className="text-xs text-gray-500">{mission.target_lead.full_name} • {mission.target_lead.property_address}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium border ${getStatusColor(mission.status)}`}>
              {mission.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </div>
            <div className="flex items-center space-x-2">
              <PriorityIcon className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-400 uppercase">{mission.priority}</span>
            </div>
            <div className="flex items-center space-x-2">
              <SafetyIcon className={`w-4 h-4 ${
                mission.safety_level === 'green' ? 'text-olive-green' :
                mission.safety_level === 'yellow' ? 'text-alert-yellow' : 'text-critical-red'
              }`} />
              <span className="text-xs text-gray-400 uppercase">{mission.safety_level}</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-6 w-6 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Mission Status Actions */}
        <div className="p-4 border-b border-navy-blue-light bg-gray-800/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-gray-400" />
                <span className="text-white font-medium">{mission.assigned_soldier.name}</span>
                <span className="text-gray-400">•</span>
                <PhoneIcon className="h-3 w-3 text-gray-400" />
                <span className="text-gray-400 font-mono text-sm">{mission.assigned_soldier.phone}</span>
              </div>
              {mission.go_to_lead && (
                <Badge variant="secondary" className="text-xs">
                  LEAD CONVERSION
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {mission.status === 'assigned' && (
                <Button
                  onClick={handleStartMission}
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
                    onClick={handlePauseMission}
                    variant="outline"
                    className="text-sm px-4 py-2"
                    disabled={updateStatusMutation.isPending}
                  >
                    <PauseIcon className="h-4 w-4 mr-1" />
                    Pause
                  </Button>
                  <Button
                    onClick={() => setShowDeclineModal(true)}
                    className="btn-secondary text-sm px-4 py-2"
                    disabled={updateStatusMutation.isPending}
                  >
                    <HandRaisedIcon className="h-4 w-4 mr-1" />
                    Decline
                  </Button>
                  <Button
                    onClick={handleCompleteMission}
                    className="btn-success text-sm px-4 py-2"
                    disabled={updateStatusMutation.isPending}
                  >
                    <CheckCircleIcon className="h-4 w-4 mr-1" />
                    Complete
                  </Button>
                </>
              )}

              {mission.status === 'paused' && (
                <Button
                  onClick={handleResumeMission}
                  className="btn-primary text-sm px-4 py-2"
                  disabled={updateStatusMutation.isPending}
                >
                  <PlayIcon className="h-4 w-4 mr-1" />
                  Resume
                </Button>
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
        <div className="border-b border-navy-blue-light">
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
        <div className="flex-1 overflow-y-auto p-6" style={{ maxHeight: 'calc(95vh - 300px)' }}>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Details */}
              <div className="lg:col-span-2 space-y-6">
                <div className="enhanced-card p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Mission Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Mission Type</p>
                      <p className="text-white font-medium">{mission.mission_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Created</p>
                      <p className="text-white font-medium">{formatDateTime(mission.created_at)}</p>
                    </div>
                    {mission.scheduled_date && (
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Scheduled Date</p>
                        <p className="text-white font-medium">{formatDateTime(mission.scheduled_date)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Duration</p>
                      <p className="text-white font-medium">
                        {mission.estimated_duration} min 
                        {mission.actual_duration && ` (actual: ${mission.actual_duration} min)`}
                      </p>
                    </div>
                    {mission.initial_amount_due && (
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Initial Amount Due</p>
                        <p className="text-white font-medium">${mission.initial_amount_due.toLocaleString()}</p>
                      </div>
                    )}
                    {mission.purchase_offer && (
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Purchase Offer</p>
                        <p className="text-olive-green font-medium">${mission.purchase_offer.toLocaleString()}</p>
                      </div>
                    )}
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
                    {mission.quality_score && (
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Quality Score</p>
                        <p className="text-white font-medium">{mission.quality_score}/100</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description & Instructions */}
                {(mission.description || mission.instructions) && (
                  <div className="enhanced-card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Instructions & Notes</h3>
                    {mission.description && (
                      <div className="mb-4">
                        <p className="text-sm text-gray-400 mb-2">Description</p>
                        <p className="text-gray-300">{mission.description}</p>
                      </div>
                    )}
                    {mission.instructions && (
                      <div className="mb-4">
                        <p className="text-sm text-gray-400 mb-2">Special Instructions</p>
                        <p className="text-gray-300">{mission.instructions}</p>
                      </div>
                    )}
                    {mission.completion_notes && (
                      <div>
                        <p className="text-sm text-gray-400 mb-2">Completion Notes</p>
                        <p className="text-gray-300">{mission.completion_notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Decline Information */}
                {mission.status.includes('declined') && (
                  <div className="enhanced-card p-6 border-critical-red/30">
                    <h3 className="text-lg font-semibold text-critical-red mb-4">Mission Declined</h3>
                    {mission.decline_reason && (
                      <div className="mb-3">
                        <p className="text-sm text-gray-400 mb-1">Decline Reason</p>
                        <p className="text-white font-medium">{mission.decline_reason}</p>
                      </div>
                    )}
                    {mission.decline_notes && (
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Decline Notes</p>
                        <p className="text-gray-300">{mission.decline_notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <div className="enhanced-card p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Location</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Property Address</p>
                      <p className="text-white">{mission.target_lead.property_address}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Start Coordinates</p>
                      <p className="text-white font-mono text-sm">{mission.coordinates.lat.toFixed(6)}, {mission.coordinates.lng.toFixed(6)}</p>
                    </div>
                    {mission.completion_coordinates && (
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Completion Coordinates</p>
                        <p className="text-white font-mono text-sm">{mission.completion_coordinates.lat.toFixed(6)}, {mission.completion_coordinates.lng.toFixed(6)}</p>
                      </div>
                    )}
                    <Button variant="outline" className="w-full">
                      <MapPinIcon className="h-4 w-4 mr-2" />
                      View on Map
                    </Button>
                  </div>
                </div>

                <div className="enhanced-card p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Contact Information</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Target Contact</p>
                      <p className="text-white">{mission.target_lead.full_name}</p>
                      {mission.target_lead.phone && (
                        <p className="text-gray-400 text-sm font-mono">{mission.target_lead.phone}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Assigned Agent</p>
                      <p className="text-white">{mission.assigned_soldier.name}</p>
                      <p className="text-gray-400 text-sm font-mono">{mission.assigned_soldier.phone}</p>
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

                {/* Mission Stats */}
                <div className="enhanced-card p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Mission Stats</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Property ID:</span>
                      <span className="text-white">{mission.property_id || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Prospect ID:</span>
                      <span className="text-white">{mission.prospect_id || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Lead Conversion:</span>
                      <span className={mission.go_to_lead ? 'text-olive-green' : 'text-gray-400'}>
                        {mission.go_to_lead ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    {mission.completed_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Completed:</span>
                        <span className="text-white">{formatDateTime(mission.completed_at)}</span>
                      </div>
                    )}
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
                        update.status === 'completed' ? 'bg-olive-green' :
                        update.status === 'in_progress' ? 'bg-alert-yellow' :
                        update.status === 'declined' ? 'bg-critical-red' :
                        'bg-brand-color'
                      }`}>
                        {update.status === 'completed' ? (
                          <CheckCircleIcon className="h-5 w-5 text-white" />
                        ) : update.status === 'declined' ? (
                          <ExclamationTriangleIcon className="h-5 w-5 text-white" />
                        ) : (
                          <div className="w-3 h-3 rounded-full bg-white"></div>
                        )}
                      </div>
                      {index < mockStatusUpdates.length - 1 && (
                        <div className="w-0.5 h-12 bg-gray-600 mt-2"></div>
                      )}
                    </div>
                    <div className="flex-1 enhanced-card p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium">{update.agent_name}</span>
                        <span className="text-xs text-gray-400">{formatDateTime(update.timestamp)}</span>
                      </div>
                      <p className="text-gray-300 text-sm mb-2">{update.message}</p>
                      
                      {update.location && (
                        <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                          <MapPinIcon className="h-3 w-3" />
                          {update.location.lat.toFixed(6)}, {update.location.lng.toFixed(6)}
                        </div>
                      )}
                      
                      {update.metadata && (
                        <div className="text-xs text-gray-400 mb-2">
                          {Object.entries(update.metadata).map(([key, value]) => (
                            <React.Fragment key={key}>
                              <span className="mr-3">{key}: {String(value)}</span>
                            </React.Fragment>
                          ))}
                        </div>
                      )}
                      
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

          {/* Route Tab */}
          {activeTab === 'route' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-white mb-4">Mission Route</h3>
              
              {missionRoutes.length > 0 ? (
                <div className="space-y-4">
                  {missionRoutes.map((route) => (
                    <div key={route.id} className="enhanced-card p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-medium text-white">{route.route_name}</h4>
                        <Badge variant={route.status === 'completed' ? 'default' : 'secondary'}>
                          {route.status.toUpperCase()}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                        <div>
                          <p className="text-gray-400">Total Distance</p>
                          <p className="text-white font-medium">{route.total_distance} km</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Estimated Time</p>
                          <p className="text-white font-medium">{route.estimated_time} min</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Status</p>
                          <p className="text-white font-medium">{route.status}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <h5 className="text-white font-medium">Route Points</h5>
                        {route.points.map((point) => (
                          <div key={point.id} className="flex items-center justify-between p-3 bg-gray-800/30 rounded">
                            <div className="flex items-center space-x-3">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                point.status === 'visited' ? 'bg-olive-green text-white' :
                                point.status === 'pending' ? 'bg-gray-600 text-white' : 'bg-alert-yellow text-gray-900'
                              }`}>
                                {point.sequence_number}
                              </div>
                              <div>
                                <p className="text-white text-sm">{point.address}</p>
                                <p className="text-gray-400 text-xs font-mono">
                                  {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-400">{point.status.toUpperCase()}</p>
                              {point.visited_at && (
                                <p className="text-xs text-gray-500">{formatDateTime(point.visited_at)}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="enhanced-card p-8 text-center">
                  <MapPinIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">No route information available for this mission.</p>
                </div>
              )}
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
                        ? 'border-olive-green/50 bg-olive-green/10'
                        : 'border-gray-600/50 bg-gray-800/30'
                    }`}
                  >
                    <div className="text-center">
                      <CameraIcon className={`h-8 w-8 mx-auto mb-2 ${
                        i < mission.photos_uploaded ? 'text-olive-green' : 'text-gray-500'
                      }`} />
                      <p className={`text-xs ${
                        i < mission.photos_uploaded ? 'text-olive-green' : 'text-gray-500'
                      }`}>
                        {i < mission.photos_uploaded ? 'Uploaded' : 'Pending'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="enhanced-card p-6">
                <h4 className="text-white font-medium mb-3">Upload New Photo</h4>
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center">
                  <DocumentArrowUpIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">Drag and drop photos here, or click to select</p>
                  <Button variant="outline" className="mt-3">
                    Choose Files
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Communication Tab */}
          {activeTab === 'communication' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-white">Team Communication</h3>
              
              <div className="enhanced-card p-4 max-h-96 overflow-y-auto">
                <div className="space-y-4">
                  {/* Sample messages with more context */}
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-color flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-bold">AR</span>
                    </div>
                    <div className="flex-1">
                      <div className="bg-gray-700/50 rounded-lg p-3">
                        <p className="text-white text-sm">Just arrived at the property. Initial assessment looks good. Property appears to be residential, single family home.</p>
                        <p className="text-xs text-gray-400 mt-2">Agent Rodriguez • 10:30 AM • 📍 32.7767, -96.7970</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 justify-end">
                    <div className="flex-1 max-w-xs">
                      <div className="bg-brand-color/20 rounded-lg p-3">
                        <p className="text-white text-sm">Great! Remember to get photos of all exterior angles and check for any safety concerns.</p>
                        <p className="text-xs text-gray-400 mt-2">Command Center • 10:32 AM</p>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-bold">CC</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-color flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-bold">AR</span>
                    </div>
                    <div className="flex-1">
                      <div className="bg-gray-700/50 rounded-lg p-3">
                        <p className="text-white text-sm">Photos captured. Property condition is good. Potential lead conversion opportunity - homeowner expressed interest in discussing options.</p>
                        <div className="flex gap-2 mt-2">
                          <div className="w-12 h-12 bg-gray-600 rounded border border-gray-500 flex items-center justify-center">
                            <CameraIcon className="h-4 w-4 text-gray-400" />
                          </div>
                          <div className="w-12 h-12 bg-gray-600 rounded border border-gray-500 flex items-center justify-center">
                            <CameraIcon className="h-4 w-4 text-gray-400" />
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Agent Rodriguez • 10:45 AM</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message to the field agent..."
                  className="flex-1 input-military"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && newMessage.trim()) {
                      // Handle send message
                      setNewMessage('');
                    }
                  }}
                />
                <Button className="btn-primary px-4">
                  <span className="text-sm">Send</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Decline Modal */}
        {showDeclineModal && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4">
            <div className="enhanced-card p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-white mb-4">Decline Mission</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Decline Reason</label>
                  <select
                    value={selectedDeclineReason || ''}
                    onChange={(e) => setSelectedDeclineReason(parseInt(e.target.value))}
                    className="input-military w-full"
                  >
                    <option value="">Select reason...</option>
                    {declineReasons.map((reason) => (
                      <option key={reason.id} value={reason.id}>
                        {reason.name} {reason.is_safety_related ? '⚠️' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Additional Notes</label>
                  <textarea
                    value={declineNotes}
                    onChange={(e) => setDeclineNotes(e.target.value)}
                    className="input-military w-full h-24 resize-none"
                    placeholder="Provide additional details..."
                  />
                </div>
                
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowDeclineModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDeclineMission}
                    disabled={!selectedDeclineReason || updateStatusMutation.isPending}
                    className="btn-danger flex-1"
                  >
                    {updateStatusMutation.isPending ? 'Declining...' : 'Decline Mission'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};