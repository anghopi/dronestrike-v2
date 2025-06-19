import React, { useState, useCallback, useMemo } from 'react';
import { 
  HomeIcon, 
  MapPinIcon, 
  AdjustmentsHorizontalIcon,
  CommandLineIcon,
  UserIcon
} from '@heroicons/react/24/outline';

// This component should not be imported directly at compile time
// It will be used only through SmartMap with dynamic imports

// Types for DroneStrike map data
interface PropertyLocation {
  id: number;
  type: 'property' | 'lead' | 'mission' | 'opportunity';
  coordinates: [number, number]; // [longitude, latitude]
  title: string;
  address: string;
  status: string;
  value?: number;
  risk_level?: 'low' | 'medium' | 'high';
  workflow_stage?: string;
  mission_status?: 'assigned' | 'in_progress' | 'completed';
  metadata?: any;
}

interface HeatmapData {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: {
      type: 'Point';
      coordinates: [number, number];
    };
    properties: {
      intensity: number;
      value: number;
      type: string;
    };
  }>;
}

interface DroneStrikeMapProps {
  data: PropertyLocation[];
  center?: [number, number];
  zoom?: number;
  style?: string;
  showHeatmap?: boolean;
  showMissions?: boolean;
  showProperties?: boolean;
  showOpportunities?: boolean;
  onLocationClick?: (location: PropertyLocation) => void;
  onMapClick?: (coordinates: [number, number]) => void;
  className?: string;
  mapComponents?: any; // Mapbox components passed from SmartMap
}

// Mock Mapbox token - replace with environment variable
const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN || 'pk.test-token-replace-with-real-token';

// Dallas, TX default center for DroneStrike operations
const DEFAULT_CENTER: [number, number] = [-96.7970, 32.7767];
const DEFAULT_ZOOM = 10;

export const DroneStrikeMap: React.FC<DroneStrikeMapProps> = ({
  data = [],
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  style = 'mapbox://styles/mapbox/dark-v11', // Dark military theme
  showHeatmap = true,
  showMissions = true,
  showProperties = true,
  showOpportunities = true,
  onLocationClick,
  onMapClick,
  className = '',
  mapComponents
}) => {
  // Initialize hooks first - they must be called unconditionally
  const [viewState, setViewState] = useState({
    longitude: center[0],
    latitude: center[1],
    zoom: zoom
  });
  
  const [selectedLocation, setSelectedLocation] = useState<PropertyLocation | null>(null);
  const [mapStyle, setMapStyle] = useState(style);
  const [showControls, setShowControls] = useState(true);

  // Filter data based on visibility settings
  const filteredData = useMemo(() => {
    return data.filter(location => {
      if (location.type === 'mission' && !showMissions) return false;
      if (location.type === 'property' && !showProperties) return false;
      if (location.type === 'opportunity' && !showOpportunities) return false;
      return true;
    });
  }, [data, showMissions, showProperties, showOpportunities]);

  // Generate heatmap data for property values and mission density
  const heatmapData: HeatmapData = useMemo(() => {
    const features = filteredData.map(location => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: location.coordinates
      },
      properties: {
        intensity: location.type === 'mission' ? 1.5 : 1,
        value: location.value || 50000,
        type: location.type
      }
    }));

    return {
      type: 'FeatureCollection',
      features
    };
  }, [filteredData]);

  // Heatmap layer style
  const heatmapLayer = {
    id: 'heatmap',
    type: 'heatmap' as const,
    source: 'heatmap-data',
    maxzoom: 15,
    paint: {
      // Increase the heatmap weight based on property value and type
      'heatmap-weight': [
        'interpolate',
        ['linear'],
        ['get', 'intensity'],
        0, 0,
        6, 2
      ],
      // Increase the heatmap color weight weight by zoom level
      'heatmap-intensity': [
        'interpolate',
        ['linear'],
        ['zoom'],
        0, 1,
        15, 3
      ],
      // Color ramp for heatmap - military theme
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0, 'rgba(0,0,0,0)',
        0.2, 'rgba(29, 78, 216, 0.8)', // Blue
        0.4, 'rgba(147, 51, 234, 0.8)', // Purple  
        0.6, 'rgba(239, 68, 68, 0.8)', // Red
        0.8, 'rgba(251, 191, 36, 0.8)', // Yellow
        1, 'rgba(255, 255, 255, 0.8)' // White
      ],
      // Adjust the heatmap radius by zoom level
      'heatmap-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        0, 20,
        15, 40
      ],
      // Transition from heatmap to circle layer by zoom level
      'heatmap-opacity': [
        'interpolate',
        ['linear'],
        ['zoom'],
        7, 1,
        15, 0
      ]
    }
  };

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
        return <CommandLineIcon className="h-5 w-5" />;
      case 'property':
        return <HomeIcon className="h-5 w-5" />;
      case 'opportunity':
        return <MapPinIcon className="h-5 w-5" />;
      case 'lead':
        return <UserIcon className="h-5 w-5" />;
      default:
        return <MapPinIcon className="h-5 w-5" />;
    }
  };

  // Handle marker click
  const handleMarkerClick = useCallback((location: PropertyLocation) => {
    setSelectedLocation(location);
    if (onLocationClick) {
      onLocationClick(location);
    }
  }, [onLocationClick]);

  // Handle map click
  const handleMapClick = useCallback((event: any) => {
    const { lng, lat } = event.lngLat;
    if (onMapClick) {
      onMapClick([lng, lat]);
    }
    setSelectedLocation(null);
  }, [onMapClick]);

  // Check if Mapbox components are available (after all hooks)
  if (!mapComponents) {
    console.warn('DroneStrikeMap: No mapComponents provided, returning null');
    return null;
  }

  const { Map, Marker, Popup, Layer, Source, NavigationControl, ScaleControl, GeolocateControl } = mapComponents;

  const renderMap = () => {
    try {
      return (
        <Map
          {...viewState}
          onMove={(evt: any) => setViewState(evt.viewState)}
          onClick={handleMapClick}
          mapboxAccessToken={MAPBOX_TOKEN}
          style={{ width: '100%', height: '100%' }}
          mapStyle={mapStyle}
          attributionControl={false}
        >
          {/* Heatmap Layer */}
          {showHeatmap && Source && Layer && (
            <Source id="heatmap-data" type="geojson" data={heatmapData}>
              <Layer {...heatmapLayer} />
            </Source>
          )}

          {/* Location Markers */}
          {Marker && filteredData.map((location) => (
            <Marker
              key={`${location.type}-${location.id}`}
              longitude={location.coordinates[0]}
              latitude={location.coordinates[1]}
              anchor="center"
            >
              <div
                className="cursor-pointer transform transition-transform hover:scale-110"
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkerClick(location);
                }}
              >
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white shadow-lg text-white"
                  style={{ backgroundColor: getMarkerColor(location) }}
                >
                  {getMarkerIcon(location)}
                </div>
              </div>
            </Marker>
          ))}

          {/* Popup for selected location */}
          {selectedLocation && Popup && (
            <Popup
              longitude={selectedLocation.coordinates[0]}
              latitude={selectedLocation.coordinates[1]}
              anchor="bottom"
              onClose={() => setSelectedLocation(null)}
              closeButton={true}
              closeOnClick={false}
              className="dronestrike-popup"
            >
              <div className="p-4 min-w-64 bg-gray-900 text-white rounded-lg">
                <div className="flex items-start justify-between mb-3">
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
            </Popup>
          )}

          {/* Map Controls */}
          {NavigationControl && ScaleControl && GeolocateControl && showControls && (
            <>
              <NavigationControl position="top-right" showCompass={true} showZoom={true} />
              <GeolocateControl position="top-right" />
              <ScaleControl position="bottom-left" />
            </>
          )}
        </Map>
      );
    } catch (error) {
      console.error('Map rendering error:', error);
      return (
        <div className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-lg overflow-hidden border border-gray-600/50 flex items-center justify-center">
          <div className="text-center">
            <div className="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg max-w-md mx-auto">
              <h3 className="text-yellow-400 font-semibold mb-2">Map Render Error</h3>
              <p className="text-gray-300 text-sm mb-3">
                Map failed to render. This might be due to an invalid Mapbox token or network issues.
              </p>
              <p className="text-gray-400 text-xs">
                Error: {error instanceof Error ? error.message : 'Unknown error'}
              </p>
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Map Container */}
      {renderMap()}

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
              <option value="mapbox://styles/mapbox/dark-v11">Dark</option>
              <option value="mapbox://styles/mapbox/satellite-v9">Satellite</option>
              <option value="mapbox://styles/mapbox/streets-v12">Streets</option>
              <option value="mapbox://styles/mapbox/outdoors-v12">Outdoors</option>
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
    </div>
  );
};

export default DroneStrikeMap;