import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Navigation, 
  Camera, 
  Phone, 
  MessageSquare, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Users, 
  Home,
  List,
  Settings,
  Wifi,
  WifiOff,
  Download,
  Upload
} from 'lucide-react';
import { useOffline } from '../../hooks/useOffline';
import { offlineService } from '../../services/offlineService';

interface Mission {
  id: number;
  target: {
    name: string;
    address: string;
    phone?: string;
    notes?: string;
    is_dangerous: boolean;
  };
  status: 'assigned' | 'en_route' | 'on_site' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimated_duration: number;
  assigned_at: string;
  deadline: string;
  distance?: number;
}

interface MobileBOTGInterfaceProps {
  agentId: string;
  onMissionUpdate: (missionId: number, status: string, notes?: string) => void;
}

const MobileBOTGInterface: React.FC<MobileBOTGInterfaceProps> = ({ 
  agentId, 
  onMissionUpdate 
}) => {
  const [activeTab, setActiveTab] = useState<'missions' | 'map' | 'settings'>('missions');
  const [missions, setMissions] = useState<Mission[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [missionNotes, setMissionNotes] = useState('');
  
  // Offline functionality
  const { isOnline, isLoading, stats, queueAction, syncWithServer, clearOfflineData } = useOffline();

  // Load cached missions when offline
  useEffect(() => {
    const loadMissions = async () => {
      try {
        if (isOnline) {
          // Load from API when online
          const mockMissions: Mission[] = [
            {
              id: 1,
              target: {
                name: 'John Smith',
                address: '123 Main St, Houston, TX 77001',
                phone: '(555) 123-4567',
                notes: 'Ring doorbell twice. Friendly contact.',
                is_dangerous: false
              },
              status: 'assigned',
              priority: 'high',
              estimated_duration: 30,
              assigned_at: '2024-01-15T09:00:00Z',
              deadline: '2024-01-15T17:00:00Z',
              distance: 2.3
            },
            {
              id: 2,
              target: {
                name: 'Sarah Johnson',
                address: '456 Oak Ave, Houston, TX 77002',
                phone: '(555) 987-6543',
                notes: 'Apartment 2B. Beware of large dog.',
                is_dangerous: true
              },
              status: 'assigned',
              priority: 'medium',
              estimated_duration: 45,
              assigned_at: '2024-01-15T10:00:00Z',
              deadline: '2024-01-15T18:00:00Z',
              distance: 4.7
            }
          ];
          setMissions(mockMissions);
          
          // Cache missions for offline use
          await offlineService.cacheMissions(mockMissions);
        } else {
          // Load from cache when offline
          const cachedMissions = await offlineService.getCachedMissions();
          setMissions(cachedMissions);
        }
      } catch (error) {
        console.error('Failed to load missions:', error);
      }
    };

    loadMissions();
  }, [isOnline]);

  // Get current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting location:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    }
  }, []);


  const handleMissionStatusUpdate = async (mission: Mission, newStatus: string) => {
    try {
      const updatedMission = { ...mission, status: newStatus as any };
      const updatedMissions = missions.map(m => 
        m.id === mission.id ? updatedMission : m
      );
      
      // Update UI immediately
      setMissions(updatedMissions);
      
      // Prepare update data
      const updateData = {
        id: mission.id,
        status: newStatus,
        notes: missionNotes,
        updated_at: new Date().toISOString(),
        agent_id: agentId,
        location: currentLocation
      };

      if (isOnline) {
        // Update immediately if online
        try {
          onMissionUpdate(mission.id, newStatus, missionNotes);
          
          // Update cached data
          await offlineService.cacheMissions(updatedMissions);
        } catch (error) {
          console.error('Failed to update mission online, queuing for later:', error);
          // Queue for later sync if online update fails
          await queueAction({
            type: 'mission_update',
            data: updateData
          });
        }
      } else {
        // Queue for later sync when offline
        await queueAction({
          type: 'mission_update',
          data: updateData
        });
        
        // Update cached data
        await offlineService.cacheMissions(updatedMissions);
      }
      
      setSelectedMission(null);
      setMissionNotes('');
    } catch (error) {
      console.error('Failed to handle mission status update:', error);
    }
  };

  const openNavigation = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    // Try to open in native maps app
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      window.open(`maps://maps.google.com/maps?daddr=${encodedAddress}`);
    } else {
      window.open(`https://maps.google.com/maps?daddr=${encodedAddress}`);
    }
  };

  const callTarget = (phone: string) => {
    window.open(`tel:${phone}`);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-500';
      case 'failed': return 'text-red-500';
      case 'on_site': return 'text-blue-500';
      case 'en_route': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };

  const renderMissionsList = () => (
    <div className="space-y-4">
      {missions.map((mission) => (
        <div 
          key={mission.id} 
          className="bg-slate-800 rounded-lg p-4 border border-slate-700 touch-manipulation"
        >
          {/* Mission Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${getPriorityColor(mission.priority)}`}></div>
              <h3 className="text-lg font-semibold text-white">{mission.target.name}</h3>
              {mission.target.is_dangerous && (
                <AlertTriangle size={20} className="text-red-500" />
              )}
            </div>
            <span className={`text-sm font-medium ${getStatusColor(mission.status)}`}>
              {mission.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          {/* Target Info */}
          <div className="space-y-2 mb-4">
            <div className="flex items-start space-x-2">
              <MapPin size={16} className="text-slate-400 mt-1 flex-shrink-0" />
              <p className="text-slate-300 text-sm">{mission.target.address}</p>
            </div>
            {mission.target.phone && (
              <div className="flex items-center space-x-2">
                <Phone size={16} className="text-slate-400" />
                <p className="text-slate-300 text-sm">{mission.target.phone}</p>
              </div>
            )}
            {mission.target.notes && (
              <div className="bg-slate-700/50 rounded p-2 mt-2">
                <p className="text-slate-300 text-sm italic">{mission.target.notes}</p>
              </div>
            )}
          </div>

          {/* Mission Details */}
          <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
            <div>
              <span className="text-slate-400">Duration:</span>
              <span className="text-white ml-2">{mission.estimated_duration}min</span>
            </div>
            <div>
              <span className="text-slate-400">Distance:</span>
              <span className="text-white ml-2">{mission.distance}mi</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => openNavigation(mission.target.address)}
              className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium touch-manipulation active:bg-blue-800 transition-colors"
            >
              <Navigation size={18} />
              <span>Navigate</span>
            </button>
            
            {mission.target.phone && (
              <button
                onClick={() => callTarget(mission.target.phone!)}
                className="flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-medium touch-manipulation active:bg-green-800 transition-colors"
              >
                <Phone size={18} />
                <span>Call</span>
              </button>
            )}
          </div>

          {/* Status Update Buttons */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <button
              onClick={() => setSelectedMission(mission)}
              className="flex items-center justify-center space-x-2 bg-slate-600 hover:bg-slate-700 text-white py-2 px-4 rounded-lg font-medium touch-manipulation active:bg-slate-800 transition-colors"
            >
              <Clock size={16} />
              <span>Update Status</span>
            </button>
            
            <button
              onClick={() => handleMissionStatusUpdate(mission, 'completed')}
              className="flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-medium touch-manipulation active:bg-green-800 transition-colors"
            >
              <CheckCircle size={16} />
              <span>Complete</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const renderStatusUpdateModal = () => {
    if (!selectedMission) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-end justify-center z-50">
        <div className="bg-slate-800 rounded-t-xl w-full max-w-md p-6 space-y-4">
          <h3 className="text-xl font-semibold text-white text-center">
            Update Mission Status
          </h3>
          
          <div className="space-y-3">
            <button
              onClick={() => handleMissionStatusUpdate(selectedMission, 'en_route')}
              className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-3 rounded-lg font-medium touch-manipulation"
            >
              En Route
            </button>
            
            <button
              onClick={() => handleMissionStatusUpdate(selectedMission, 'on_site')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium touch-manipulation"
            >
              On Site
            </button>
            
            <button
              onClick={() => handleMissionStatusUpdate(selectedMission, 'completed')}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium touch-manipulation"
            >
              Completed
            </button>
            
            <button
              onClick={() => handleMissionStatusUpdate(selectedMission, 'failed')}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-medium touch-manipulation"
            >
              Failed/Unable to Complete
            </button>
          </div>

          <div className="space-y-2">
            <label className="block text-slate-300 font-medium">Notes (Optional)</label>
            <textarea
              value={missionNotes}
              onChange={(e) => setMissionNotes(e.target.value)}
              placeholder="Add notes about this mission..."
              rows={3}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 touch-manipulation"
            />
          </div>
          
          <button
            onClick={() => setSelectedMission(null)}
            className="w-full bg-slate-600 hover:bg-slate-700 text-white py-3 rounded-lg font-medium touch-manipulation"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Enhanced Status Bar */}
      <div className="bg-slate-800 px-4 py-2 flex items-center justify-between text-sm">
        <div className="flex items-center space-x-2">
          {isOnline ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-500" />
          )}
          <span className={isOnline ? 'text-green-400' : 'text-red-400'}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
          {!isOnline && stats && stats.queuedActions > 0 && (
            <span className="text-yellow-400">({stats.queuedActions} pending)</span>
          )}
        </div>
        
        <div className="text-slate-300">
          Agent: {agentId}
        </div>
        
        <div className="flex items-center space-x-2">
          {currentLocation ? (
            <MapPin className="w-4 h-4 text-green-500" />
          ) : (
            <MapPin className="w-4 h-4 text-red-500" />
          )}
          <span className={`text-xs ${currentLocation ? 'text-green-400' : 'text-red-400'}`}>
            GPS {currentLocation ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
        <h1 className="text-2xl font-bold text-center">BOTG Mobile</h1>
        <p className="text-slate-300 text-center text-sm mt-1">
          {missions.filter(m => m.status === 'assigned').length} missions assigned
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4">
        {activeTab === 'missions' && renderMissionsList()}
        {activeTab === 'map' && (
          <div className="text-center text-slate-400 mt-20">
            <MapPin size={48} className="mx-auto mb-4" />
            <p>Map view coming soon...</p>
          </div>
        )}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Offline Status */}
            <div className="bg-slate-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                {isOnline ? (
                  <Wifi className="w-5 h-5 text-green-500" />
                ) : (
                  <WifiOff className="w-5 h-5 text-red-500" />
                )}
                <span>Connection Status</span>
              </h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-300">Status:</span>
                  <span className={isOnline ? 'text-green-400' : 'text-red-400'}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                
                {stats && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-300">Cached Missions:</span>
                      <span className="text-white">{stats.missions}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-slate-300">Pending Actions:</span>
                      <span className={stats.queuedActions > 0 ? 'text-yellow-400' : 'text-white'}>
                        {stats.queuedActions}
                      </span>
                    </div>
                    
                    {stats.lastSync && (
                      <div className="flex justify-between">
                        <span className="text-slate-300">Last Sync:</span>
                        <span className="text-white text-xs">
                          {new Date(stats.lastSync).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            
            {/* Sync Actions */}
            <div className="bg-slate-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Sync Actions</h3>
              
              <div className="space-y-3">
                <button
                  onClick={syncWithServer}
                  disabled={!isOnline || isLoading}
                  className={`w-full flex items-center justify-center space-x-2 py-3 rounded-lg font-medium touch-manipulation transition-colors ${
                    isOnline && !isLoading
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>{isLoading ? 'Syncing...' : 'Sync with Server'}</span>
                </button>
                
                <button
                  onClick={clearOfflineData}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-medium touch-manipulation transition-colors disabled:bg-slate-600 disabled:text-slate-400"
                >
                  <Download className="w-4 h-4" />
                  <span>{isLoading ? 'Clearing...' : 'Clear Offline Data'}</span>
                </button>
              </div>
            </div>
            
            {/* Agent Info */}
            <div className="bg-slate-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Agent Information</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-300">Agent ID:</span>
                  <span className="text-white font-mono">{agentId}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-slate-300">GPS Status:</span>
                  <span className={currentLocation ? 'text-green-400' : 'text-red-400'}>
                    {currentLocation ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                {currentLocation && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-300">Latitude:</span>
                      <span className="text-white font-mono text-sm">
                        {currentLocation.lat.toFixed(6)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-slate-300">Longitude:</span>
                      <span className="text-white font-mono text-sm">
                        {currentLocation.lng.toFixed(6)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="bg-slate-800 border-t border-slate-700 px-4 py-2">
        <div className="flex items-center justify-around">
          <button
            onClick={() => setActiveTab('missions')}
            className={`flex flex-col items-center space-y-1 py-2 px-4 rounded-lg touch-manipulation ${
              activeTab === 'missions' ? 'bg-slate-700 text-white' : 'text-slate-400'
            }`}
          >
            <List size={24} />
            <span className="text-xs">Missions</span>
          </button>
          
          <button
            onClick={() => setActiveTab('map')}
            className={`flex flex-col items-center space-y-1 py-2 px-4 rounded-lg touch-manipulation ${
              activeTab === 'map' ? 'bg-slate-700 text-white' : 'text-slate-400'
            }`}
          >
            <MapPin size={24} />
            <span className="text-xs">Map</span>
          </button>
          
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center space-y-1 py-2 px-4 rounded-lg touch-manipulation ${
              activeTab === 'settings' ? 'bg-slate-700 text-white' : 'text-slate-400'
            }`}
          >
            <Settings size={24} />
            <span className="text-xs">Settings</span>
          </button>
        </div>
      </div>

      {/* Status Update Modal */}
      {renderStatusUpdateModal()}
    </div>
  );
};

export default MobileBOTGInterface;