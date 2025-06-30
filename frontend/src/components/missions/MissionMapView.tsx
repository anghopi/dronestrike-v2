import React, { useState, useCallback } from 'react';
import Map, { Marker, Popup } from 'react-map-gl';
import { 
  MapPinIcon,
  PlayIcon,
  PauseIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import 'mapbox-gl/dist/mapbox-gl.css';

interface Mission {
  id: number;
  mission_number: string;
  title: string;
  description?: string;
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
  go_to_lead: boolean;
}

interface MissionMapViewProps {
  missions: Mission[];
  selectedMission?: Mission | null;
  onMissionSelect?: (mission: Mission) => void;
  onMissionUpdate?: (mission: Mission) => void;
  showRoutes?: boolean;
  showLiveTracking?: boolean;
}

const MissionMapView: React.FC<MissionMapViewProps> = ({
  missions,
  selectedMission,
  onMissionSelect,
  onMissionUpdate,
  showRoutes = false,
  showLiveTracking = false
}) => {
  const [viewState, setViewState] = useState({
    longitude: -96.8000,
    latitude: 32.7767,
    zoom: 10
  });
  const [popupInfo, setPopupInfo] = useState<Mission | null>(null);

  const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN || 'pk.eyJ1IjoiZHJvbmVzdHJpa2UiLCJhIjoiY2x6aXBpdXViMGF5cTJrczhwbmhmdTF1eCJ9.your_token_here';

  const getMissionColor = (mission: Mission): string => {
    switch (mission.status) {
      case 'completed': return '#22c55e'; // green
      case 'in_progress': return '#3b82f6'; // blue
      case 'assigned': return '#f59e0b'; // yellow
      case 'declined': return '#ef4444'; // red
      case 'paused': return '#f97316'; // orange
      default: return '#6b7280'; // gray
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return <ExclamationTriangleIcon className="h-4 w-4 text-red-600" />;
      case 'high': return <ExclamationTriangleIcon className="h-4 w-4 text-orange-600" />;
      case 'normal': return <ClockIcon className="h-4 w-4 text-blue-600" />;
      case 'low': return <ClockIcon className="h-4 w-4 text-gray-600" />;
      default: return <MapPinIcon className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadgeColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'assigned': return 'bg-yellow-100 text-yellow-800';
      case 'declined': return 'bg-red-100 text-red-800';
      case 'paused': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleMarkerClick = useCallback((mission: Mission) => {
    setPopupInfo(mission);
    onMissionSelect?.(mission);
  }, [onMissionSelect]);

  const handleMissionAction = (mission: Mission, action: string) => {
    // Simulate mission actions
    const updatedMission = { ...mission };
    switch (action) {
      case 'start':
        updatedMission.status = 'in_progress';
        break;
      case 'complete':
        updatedMission.status = 'completed';
        break;
      case 'pause':
        updatedMission.status = 'paused';
        break;
    }
    onMissionUpdate?.(updatedMission);
    setPopupInfo(updatedMission);
  };

  return (
    <div className="w-full h-full relative">
      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        mapboxAccessToken={MAPBOX_TOKEN}
      >
        {missions.map((mission) => (
          <Marker
            key={mission.id}
            longitude={mission.coordinates.lng}
            latitude={mission.coordinates.lat}
            onClick={() => handleMarkerClick(mission)}
            style={{ cursor: 'pointer' }}
          >
            <div 
              className={`w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center ${
                selectedMission?.id === mission.id ? 'ring-2 ring-blue-500' : ''
              }`}
              style={{ backgroundColor: getMissionColor(mission) }}
            >
              <MapPinIcon className="h-4 w-4 text-white" />
            </div>
          </Marker>
        ))}

        {popupInfo && (
          <Popup
            longitude={popupInfo.coordinates.lng}
            latitude={popupInfo.coordinates.lat}
            onClose={() => setPopupInfo(null)}
            closeButton={true}
            closeOnClick={false}
            className="mission-popup"
          >
            <div className="p-4 min-w-[300px]">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{popupInfo.title}</h3>
                  <p className="text-sm text-gray-600">Mission #{popupInfo.id}</p>
                </div>
                {getPriorityIcon(popupInfo.priority)}
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <Badge className={getStatusBadgeColor(popupInfo.status)}>
                    {popupInfo.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Priority:</span>
                  <span className="text-sm font-medium capitalize">{popupInfo.priority}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Safety Level:</span>
                  <span className={`text-sm font-medium capitalize ${
                    popupInfo.safety_level === 'red' ? 'text-red-600' :
                    popupInfo.safety_level === 'yellow' ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {popupInfo.safety_level}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Assigned to:</span>
                  <span className="text-sm font-medium">
                    {popupInfo.assigned_soldier.name}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Duration:</span>
                  <span className="text-sm">{popupInfo.estimated_duration} min</span>
                </div>
              </div>

              {popupInfo.description && (
                <div className="mb-4">
                  <p className="text-sm text-gray-700">{popupInfo.description}</p>
                </div>
              )}

              {/* Action buttons based on status */}
              <div className="flex gap-2">
                {popupInfo.status === 'assigned' && (
                  <Button
                    size="sm"
                    onClick={() => handleMissionAction(popupInfo, 'start')}
                    className="flex items-center gap-1"
                  >
                    <PlayIcon className="h-3 w-3" />
                    Start
                  </Button>
                )}

                {popupInfo.status === 'in_progress' && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleMissionAction(popupInfo, 'complete')}
                      className="flex items-center gap-1"
                    >
                      <CheckCircleIcon className="h-3 w-3" />
                      Complete
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMissionAction(popupInfo, 'pause')}
                      className="flex items-center gap-1"
                    >
                      <PauseIcon className="h-3 w-3" />
                      Pause
                    </Button>
                  </>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onMissionSelect?.(popupInfo)}
                  className="flex items-center gap-1"
                >
                  <EyeIcon className="h-3 w-3" />
                  Details
                </Button>
              </div>
            </div>
          </Popup>
        )}
      </Map>

      {/* Map Controls */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-3">
        <div className="flex flex-col gap-2">
          <div className="text-xs font-medium text-gray-700">Missions: {missions.length}</div>
          <div className="flex gap-2">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-xs">Completed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-xs">Active</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-xs">Assigned</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Tracking Indicator */}
      {showLiveTracking && (
        <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-xs font-medium text-gray-700">Live Tracking Active</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MissionMapView;