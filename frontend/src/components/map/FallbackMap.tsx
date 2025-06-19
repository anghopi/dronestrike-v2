import React, { useState } from 'react';
import { 
  HomeIcon, 
  MapPinIcon, 
  AdjustmentsHorizontalIcon,
  CommandLineIcon,
  UserIcon
} from '@heroicons/react/24/outline';

interface PropertyLocation {
  id: number;
  type: 'property' | 'lead' | 'mission' | 'opportunity';
  coordinates: [number, number];
  title: string;
  address: string;
  status: string;
  value?: number;
  risk_level?: 'low' | 'medium' | 'high';
  workflow_stage?: string;
  mission_status?: 'assigned' | 'in_progress' | 'completed';
  metadata?: any;
}

interface FallbackMapProps {
  data: PropertyLocation[];
  center?: [number, number];
  zoom?: number;
  showHeatmap?: boolean;
  showMissions?: boolean;
  showProperties?: boolean;
  showOpportunities?: boolean;
  onLocationClick?: (location: PropertyLocation) => void;
  onMapClick?: (coordinates: [number, number]) => void;
  className?: string;
}

export const FallbackMap: React.FC<FallbackMapProps> = ({
  data = [],
  center = [-96.7970, 32.7767],
  zoom = 10,
  showHeatmap = true,
  showMissions = true,
  showProperties = true,
  showOpportunities = true,
  onLocationClick,
  onMapClick,
  className = ''
}) => {
  const [selectedLocation, setSelectedLocation] = useState<PropertyLocation | null>(null);
  const [mapStyle, setMapStyle] = useState('dark');

  // Filter data based on visibility settings
  const filteredData = data.filter(location => {
    if (location.type === 'mission' && !showMissions) return false;
    if (location.type === 'property' && !showProperties) return false;
    if (location.type === 'opportunity' && !showOpportunities) return false;
    return true;
  });

  // Get marker color based on location type and status
  const getMarkerColor = (location: PropertyLocation): string => {
    switch (location.type) {
      case 'mission':
        switch (location.mission_status) {
          case 'assigned': return '#3B82F6'; // Blue
          case 'in_progress': return '#F59E0B'; // Yellow
          case 'completed': return '#10B981'; // Green
          default: return '#6B7280'; // Gray
        }
      case 'property':
        switch (location.risk_level) {
          case 'low': return '#10B981'; // Green
          case 'medium': return '#F59E0B'; // Yellow
          case 'high': return '#EF4444'; // Red
          default: return '#8B5CF6'; // Purple
        }
      case 'opportunity':
        return '#7C3AED'; // Purple
      case 'lead':
        return '#06B6D4'; // Cyan
      default:
        return '#6B7280'; // Gray
    }
  };

  // Get marker icon based on location type
  const getMarkerIcon = (location: PropertyLocation) => {
    switch (location.type) {
      case 'mission':
        return <CommandLineIcon className="h-4 w-4" />;
      case 'property':
        return <HomeIcon className="h-4 w-4" />;
      case 'opportunity':
        return <MapPinIcon className="h-4 w-4" />;
      case 'lead':
        return <UserIcon className="h-4 w-4" />;
      default:
        return <MapPinIcon className="h-4 w-4" />;
    }
  };

  const handleMarkerClick = (location: PropertyLocation) => {
    setSelectedLocation(location);
    if (onLocationClick) {
      onLocationClick(location);
    }
  };

  const handleMapClick = () => {
    setSelectedLocation(null);
    if (onMapClick) {
      onMapClick(center);
    }
  };

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Map Container */}
      <div 
        className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-lg overflow-hidden border border-gray-600/50 cursor-pointer"
        onClick={handleMapClick}
      >
        {/* Grid Background */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="white" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Heatmap Overlay */}
        {showHeatmap && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-20 left-20 w-32 h-32 bg-red-500/20 rounded-full blur-xl"></div>
            <div className="absolute top-40 right-32 w-24 h-24 bg-yellow-500/20 rounded-full blur-lg"></div>
            <div className="absolute bottom-32 left-40 w-40 h-40 bg-blue-500/20 rounded-full blur-2xl"></div>
            <div className="absolute bottom-20 right-20 w-28 h-28 bg-purple-500/20 rounded-full blur-xl"></div>
          </div>
        )}

        {/* Location Markers */}
        {filteredData.map((location) => {
          // Convert coordinates to screen position (rough approximation)
          const x = ((location.coordinates[0] + 97) * 100) % 80 + 10;
          const y = ((location.coordinates[1] - 32) * 100) % 70 + 15;
          
          return (
            <div
              key={`${location.type}-${location.id}`}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer hover:scale-110 transition-transform z-10"
              style={{ 
                left: `${x}%`, 
                top: `${y}%`
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleMarkerClick(location);
              }}
            >
              <div
                className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white shadow-lg text-white relative"
                style={{ backgroundColor: getMarkerColor(location) }}
              >
                {getMarkerIcon(location)}
                {/* Pulse animation for active missions */}
                {location.type === 'mission' && location.mission_status === 'in_progress' && (
                  <div className="absolute inset-0 rounded-full border-2 border-yellow-400 animate-ping"></div>
                )}
              </div>
            </div>
          );
        })}

        {/* Selected Location Popup */}
        {selectedLocation && (
          <div
            className="absolute z-20 transform -translate-x-1/2 translate-y-2"
            style={{
              left: `${((selectedLocation.coordinates[0] + 97) * 100) % 80 + 10}%`,
              top: `${((selectedLocation.coordinates[1] - 32) * 100) % 70 + 15}%`
            }}
          >
            <div className="bg-gray-900 text-white rounded-lg p-4 shadow-2xl border border-gray-600 min-w-64 max-w-xs">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedLocation(null);
                }}
                className="absolute top-2 right-2 text-gray-400 hover:text-white text-xl leading-none"
              >
                ×
              </button>
              
              <div className="flex items-start justify-between mb-3 pr-6">
                <div>
                  <h3 className="font-bold text-lg text-white">{selectedLocation.title}</h3>
                  <p className="text-sm text-gray-400">{selectedLocation.address}</p>
                </div>
                <div className="flex items-center gap-1">
                  {getMarkerIcon(selectedLocation)}
                  <span className="text-xs uppercase font-medium text-gray-300">
                    {selectedLocation.type}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className={`font-medium ${
                    selectedLocation.status === 'completed' ? 'text-green-400' :
                    selectedLocation.status === 'in_progress' ? 'text-yellow-400' :
                    selectedLocation.status === 'assigned' ? 'text-blue-400' : 'text-gray-300'
                  }`}>
                    {selectedLocation.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </div>
                
                {selectedLocation.value && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Value:</span>
                    <span className="font-medium text-green-400">
                      ${selectedLocation.value.toLocaleString()}
                    </span>
                  </div>
                )}
                
                {selectedLocation.risk_level && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Risk Level:</span>
                    <span className={`font-medium ${
                      selectedLocation.risk_level === 'low' ? 'text-green-400' :
                      selectedLocation.risk_level === 'medium' ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {selectedLocation.risk_level.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Center location indicator */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-blue-400 text-xs font-medium bg-gray-900/80 px-2 py-1 rounded">
            Dallas, TX Metro Area
          </div>
        </div>
      </div>

      {/* Map Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        <div className="bg-gray-900/90 backdrop-blur-sm border border-gray-600/50 rounded-lg p-2">
          <div className="flex flex-col gap-1">
            <button className="w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded text-white text-lg font-bold transition-colors">+</button>
            <button className="w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded text-white text-lg font-bold transition-colors">-</button>
          </div>
        </div>
      </div>

      {/* Map Style Selector */}
      <div className="absolute top-4 left-4 z-10">
        <div className="bg-gray-900/90 backdrop-blur-sm border border-gray-600/50 rounded-lg p-3">
          <div className="flex items-center gap-3">
            <AdjustmentsHorizontalIcon className="h-5 w-5 text-white" />
            <select
              value={mapStyle}
              onChange={(e) => setMapStyle(e.target.value)}
              className="bg-gray-800/60 border border-gray-600/50 text-white text-sm rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-color/50"
            >
              <option value="dark">Dark</option>
              <option value="satellite">Satellite</option>
              <option value="streets">Streets</option>
              <option value="outdoors">Outdoors</option>
            </select>
          </div>
        </div>
      </div>

      {/* Layer Controls */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="bg-gray-900/90 backdrop-blur-sm border border-gray-600/50 rounded-lg p-3">
          <div className="space-y-2">
            <div className="text-white text-sm font-medium mb-2">Layers</div>
            
            <label className="flex items-center gap-2 text-white text-sm">
              <input
                type="checkbox"
                checked={showHeatmap}
                readOnly
                className="rounded"
              />
              Heatmap
            </label>
            
            <label className="flex items-center gap-2 text-white text-sm">
              <input
                type="checkbox"
                checked={showMissions}
                readOnly
                className="rounded"
              />
              BOTG Missions
            </label>
            
            <label className="flex items-center gap-2 text-white text-sm">
              <input
                type="checkbox"
                checked={showProperties}
                readOnly
                className="rounded"
              />
              Properties
            </label>
            
            <label className="flex items-center gap-2 text-white text-sm">
              <input
                type="checkbox"
                checked={showOpportunities}
                readOnly
                className="rounded"
              />
              Opportunities
            </label>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-10">
        <div className="bg-gray-900/90 backdrop-blur-sm border border-gray-600/50 rounded-lg p-3">
          <div className="text-white text-sm font-medium mb-2">Legend</div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-white">BOTG Assigned</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-white">In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-white">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500"></div>
              <span className="text-white">Opportunities</span>
            </div>
          </div>
        </div>
      </div>

      {/* Fallback Notice */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-yellow-900/80 border border-yellow-600/50 rounded-lg px-3 py-1">
          <div className="text-yellow-300 text-xs font-medium">
            📍 Fallback Map Mode - Configure Mapbox for full functionality
          </div>
        </div>
      </div>
    </div>
  );
};