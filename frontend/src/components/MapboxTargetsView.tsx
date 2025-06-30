import React, { useState, useEffect, useCallback, useRef } from 'react';
import Map, { Marker, Popup, Source, Layer } from 'react-map-gl';
import { Search, Filter, Target, Home, Building2, Mountain } from 'lucide-react';
import { targetAPI } from '../services/api';
import 'mapbox-gl/dist/mapbox-gl.css';

interface TargetData {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  county: string;
  property_type: string;
  amount_due: number;
  appraised_value: number;
  status: string;
  is_active: boolean;
  latitude: number;
  longitude: number;
  account_number: string;
  created_at: string;
  do_not_mail: boolean;
  do_not_email: boolean;
}

interface MapPin {
  id: number;
  lat: number;
  lng: number;
  weight: number;
  target: TargetData;
}

interface FilterOptions {
  counties: string[];
  states: string[];
  cities: string[];
  zip_codes: string[];
  property_types: string[];
  lead_statuses: string[];
  property_type_filters: Array<{value: string; label: string}>;
  status_options: Array<{value: string; label: string}>;
}

interface StatisticsData {
  totals: {
    total_targets: number;
    active_targets: number;
    inactive_targets: number;
    total_amount: number;
    average_amount: number;
    max_amount: number;
    min_amount: number;
  };
  breakdowns: {
    property_types: Array<{property_type: string; count: number}>;
    counties: Array<{county: string; count: number}>;
    statuses: Array<{status: string; count: number}>;
    states: Array<{state: string; count: number}>;
  };
  contact_stats: {
    can_mail: number;
    can_email: number;
    has_email: number;
    has_phone: number;
    mail_percentage: number;
    email_percentage: number;
  };
}

// Mapbox access token from environment
const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

const MapboxTargetsView: React.FC = () => {
  const mapRef = useRef<any>(null);
  const [mapPins, setMapPins] = useState<MapPin[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [selectedTarget, setSelectedTarget] = useState<TargetData | null>(null);
  const [popupInfo, setPopupInfo] = useState<{target: TargetData; lat: number; lng: number} | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  
  // Map state
  const [viewState, setViewState] = useState({
    longitude: -98.5795,
    latitude: 39.8283,
    zoom: 5
  });
  const [searchRadius, setSearchRadius] = useState(10);
  const [searchCenter, setSearchCenter] = useState<[number, number] | null>(null);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'radius' | 'zip' | 'county'>('radius');
  const [filters, setFilters] = useState({
    property_type_filter: 'all',
    is_active: '',
    lead_status: '',
    amount_due_min: '',
    amount_due_max: '',
    appraised_value_min: '',
    appraised_value_max: '',
    do_not_mail: '',
    do_not_email: '',
    property_county: '',
    property_state: '',
    property_zip: '',
    property_city: ''
  });

  // Load filter options on mount
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const response = await targetAPI.getFilterOptions();
        setFilterOptions(response as FilterOptions);
      } catch (error) {
        console.error('Error loading filter options:', error);
      }
    };
    
    loadFilterOptions();
  }, []);

  // Load map pins based on bounds and filters
  const loadMapPins = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      
      // Add map bounds if available
      if (mapRef.current) {
        const bounds = mapRef.current.getBounds();
        if (bounds) {
          const center = mapRef.current.getCenter();
          queryParams.append('region_lat', center.lat.toString());
          queryParams.append('region_lng', center.lng.toString());
          queryParams.append('region_lat_delta', Math.abs(bounds._ne.lat - center.lat).toString());
          queryParams.append('region_lng_delta', Math.abs(bounds._ne.lng - center.lng).toString());
        }
      }
      
      // Add search parameters
      if (searchQuery && searchType === 'zip') {
        queryParams.append('property_zip', searchQuery);
      } else if (searchQuery && searchType === 'county') {
        queryParams.append('property_county', searchQuery);
      } else if (searchQuery) {
        queryParams.append('search', searchQuery);
      }
      
      // Add radius search if set
      if (searchCenter && searchRadius > 0) {
        queryParams.append('lat', searchCenter[0].toString());
        queryParams.append('lng', searchCenter[1].toString());
        queryParams.append('radius', searchRadius.toString());
      }
      
      // Add all filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== '') {
          queryParams.append(key, value.toString());
        }
      });
      
      // Only get targets with lat/lng for map display
      queryParams.append('has_coordinates', 'true');
      queryParams.append('page_size', '1000'); // Get more for map view
      
      const response = await targetAPI.getTargets(`?${queryParams.toString()}`);
      const targets = (response as any).data?.results || (response as any).data || [];
      
      // Convert targets to map pins
      const pins: MapPin[] = targets
        .filter((target: TargetData) => target.latitude && target.longitude)
        .map((target: TargetData) => ({
          id: target.id,
          lat: target.latitude,
          lng: target.longitude,
          weight: target.amount_due || 1,
          target
        }));
      
      setMapPins(pins);
    } catch (error) {
      console.error('Error loading map pins:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, searchType, searchCenter, searchRadius, filters]);

  // Handle location search
  const handleLocationSearch = async () => {
    if (!searchQuery) return;
    
    try {
      // Use Mapbox Geocoding API
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${MAPBOX_TOKEN}&country=US`
      );
      const results = await response.json();
      
      if (results.features && results.features.length > 0) {
        const location = results.features[0];
        const [lng, lat] = location.center;
        
        setViewState({
          longitude: lng,
          latitude: lat,
          zoom: 12
        });
        
        if (searchType === 'radius') {
          setSearchCenter([lat, lng]);
        }
      }
    } catch (error) {
      console.error('Error geocoding location:', error);
    }
  };

  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Load pins when map moves or filters change
  useEffect(() => {
    const delayedLoad = setTimeout(() => {
      loadMapPins();
    }, 500); // Debounce map movements
    
    return () => clearTimeout(delayedLoad);
  }, [loadMapPins, viewState]);

  // Property type filter buttons
  const propertyTypeFilters = [
    { value: 'all', label: 'All Types', icon: Target, color: 'gray' },
    { value: 'residential', label: 'Residential', icon: Home, color: 'blue' },
    { value: 'commercial', label: 'Commercial', icon: Building2, color: 'purple' },
    { value: 'land', label: 'Land', icon: Mountain, color: 'yellow' }
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  // Create marker color based on property type and status
  const getMarkerColor = (target: TargetData) => {
    const isActive = target.is_active;
    const propertyType = target.property_type?.toLowerCase();
    
    if (propertyType?.includes('residential')) {
      return isActive ? '#3b82f6' : '#93c5fd'; // blue
    } else if (propertyType?.includes('commercial')) {
      return isActive ? '#8b5cf6' : '#c4b5fd'; // purple
    } else if (propertyType?.includes('land')) {
      return isActive ? '#f59e0b' : '#fbbf24'; // yellow
    }
    return isActive ? '#6b7280' : '#9ca3af'; // gray
  };

  // Create heatmap data
  const heatmapData = {
    type: 'FeatureCollection' as const,
    features: mapPins.map(pin => ({
      type: 'Feature' as const,
      properties: {
        weight: Math.log(pin.weight + 1) // Use log scale for better visualization
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [pin.lng, pin.lat]
      }
    }))
  };

  const heatmapLayer: any = {
    id: 'heatmap',
    type: 'heatmap',
    source: 'heatmap',
    maxzoom: 12,
    paint: {
      'heatmap-weight': [
        'interpolate',
        ['linear'],
        ['get', 'weight'],
        0, 0,
        8, 1
      ],
      'heatmap-intensity': [
        'interpolate',
        ['linear'],
        ['zoom'],
        0, 1,
        12, 4
      ],
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0, 'rgba(33,102,172,0)',
        0.1, 'rgba(103,169,207,0.4)',
        0.3, 'rgba(209,229,240,0.6)',
        0.5, 'rgba(253,219,199,0.8)',
        0.7, 'rgba(239,138,98,0.9)',
        1, 'rgba(178,24,43,1)'
      ],
      'heatmap-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        0, 5,
        12, 30
      ],
      'heatmap-opacity': [
        'interpolate',
        ['linear'],
        ['zoom'],
        5, 0.8,
        12, 0.6
      ]
    }
  };

  return (
    <div className="h-screen bg-slate-900 text-gray-100 flex overflow-hidden">
      {/* Sidebar */}
      <div className={`bg-slate-800 border-r border-slate-700 transition-all duration-300 ${
        showFilters ? 'w-80' : 'w-0'
      } ${showFilters ? 'overflow-y-auto' : 'overflow-hidden'} flex flex-col`}>
        <div className="p-4 flex-1 overflow-y-auto">
          <h2 className="text-lg font-bold mb-4">Map Search & Filters</h2>
          
          {/* Search Section */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">Search Type</label>
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value as 'radius' | 'zip' | 'county')}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded focus:ring-2 focus:ring-blue-500 text-gray-100"
              >
                <option value="radius">Radius Search</option>
                <option value="zip">ZIP Code</option>
                <option value="county">County</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                {searchType === 'radius' ? 'Location' : 
                 searchType === 'zip' ? 'ZIP Code' : 'County Name'}
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    searchType === 'radius' ? 'Address, city, or landmark' :
                    searchType === 'zip' ? 'Enter ZIP code' : 'Enter county name'
                  }
                  className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded focus:ring-2 focus:ring-blue-500 text-gray-100"
                />
                <button
                  onClick={handleLocationSearch}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  <Search size={16} />
                </button>
              </div>
            </div>
            
            {searchType === 'radius' && (
              <div>
                <label className="block text-sm font-medium mb-2">Radius (miles)</label>
                <select
                  value={searchRadius}
                  onChange={(e) => setSearchRadius(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded focus:ring-2 focus:ring-blue-500 text-gray-100"
                >
                  <option value={1}>1 mile</option>
                  <option value={5}>5 miles</option>
                  <option value={10}>10 miles</option>
                  <option value={25}>25 miles</option>
                  <option value={50}>50 miles</option>
                  <option value={100}>100 miles</option>
                </select>
              </div>
            )}
          </div>

          {/* Property Type Filters */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3">Property Types</label>
            <div className="grid grid-cols-2 gap-2">
              {propertyTypeFilters.map(filter => {
                const Icon = filter.icon;
                const isActive = filters.property_type_filter === filter.value;
                
                // Define button styles with inline CSS to override any conflicts
                const getButtonStyle = () => {
                  if (!isActive) {
                    return {
                      backgroundColor: '#334155',
                      color: '#d1d5db',
                      borderColor: '#334155'
                    };
                  }
                  
                  switch(filter.color) {
                    case 'blue': return {
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      borderColor: '#2563eb'
                    };
                    case 'purple': return {
                      backgroundColor: '#9333ea',
                      color: '#ffffff',
                      borderColor: '#9333ea'
                    };
                    case 'yellow': return {
                      backgroundColor: '#ca8a04',
                      color: '#ffffff',
                      borderColor: '#ca8a04'
                    };
                    default: return {
                      backgroundColor: '#4b5563',
                      color: '#ffffff',
                      borderColor: '#4b5563'
                    };
                  }
                };
                
                return (
                  <button
                    key={filter.value}
                    onClick={() => handleFilterChange('property_type_filter', filter.value)}
                    className="flex items-center space-x-2 px-3 py-2 rounded transition-all text-sm border"
                    style={getButtonStyle()}
                  >
                    <Icon size={16} />
                    <span>{filter.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Additional Filters */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <select
                value={filters.is_active}
                onChange={(e) => handleFilterChange('is_active', e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded focus:ring-2 focus:ring-blue-500 text-gray-100"
              >
                <option value="">All Status</option>
                <option value="1">Active Only</option>
                <option value="0">Inactive Only</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Amount Due Range</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.amount_due_min}
                  onChange={(e) => handleFilterChange('amount_due_min', e.target.value)}
                  className="px-3 py-2 bg-slate-700 border border-slate-600 rounded focus:ring-2 focus:ring-blue-500 text-gray-100"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.amount_due_max}
                  onChange={(e) => handleFilterChange('amount_due_max', e.target.value)}
                  className="px-3 py-2 bg-slate-700 border border-slate-600 rounded focus:ring-2 focus:ring-blue-500 text-gray-100"
                />
              </div>
            </div>

            {filterOptions && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">County</label>
                  <select
                    value={filters.property_county}
                    onChange={(e) => handleFilterChange('property_county', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded focus:ring-2 focus:ring-blue-500 text-gray-100"
                  >
                    <option value="">All Counties</option>
                    {filterOptions?.counties?.map(county => (
                      <option key={county} value={county}>{county}</option>
                    )) || []}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">State</label>
                  <select
                    value={filters.property_state}
                    onChange={(e) => handleFilterChange('property_state', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded focus:ring-2 focus:ring-blue-500 text-gray-100"
                  >
                    <option value="">All States</option>
                    {filterOptions?.states?.map(state => (
                      <option key={state} value={state}>{state}</option>
                    )) || []}
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Results Summary */}
          <div className="mt-6 p-3 bg-slate-700 rounded">
            <p className="text-sm text-gray-300">
              <span className="font-semibold">{mapPins.length}</span> targets on map
            </p>
            {loading && (
              <p className="text-sm text-blue-400 mt-1">Loading...</p>
            )}
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative overflow-hidden">
        {/* Map Controls */}
        <div className="absolute top-4 left-4 z-10 flex space-x-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center space-x-2 px-5 py-3 rounded-lg shadow-lg transition-all duration-200 border ${
              showFilters 
                ? 'bg-gradient-to-r from-orange-600 to-orange-700 text-white hover:from-orange-700 hover:to-orange-800 border-orange-600' 
                : 'bg-gradient-to-r from-slate-700 to-slate-800 text-white hover:from-orange-600 hover:to-orange-700 border-slate-600'
            }`}
          >
            <Filter size={20} />
            <span className="font-medium">{showFilters ? 'Hide' : 'Show'} Filters</span>
          </button>
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`flex items-center space-x-2 px-5 py-3 rounded-lg shadow-lg transition-all duration-200 border ${
              mapPins.length === 0 
                ? 'bg-slate-600 text-slate-400 border-slate-500 cursor-not-allowed opacity-50'
                : showHeatmap 
                  ? 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 border-red-600' 
                  : 'bg-gradient-to-r from-slate-700 to-slate-800 text-white hover:from-red-600 hover:to-red-700 border-slate-600'
            }`}
            disabled={mapPins.length === 0}
          >
            <Target size={20} />
            <span className="font-medium">
              {showHeatmap ? 'Hide' : 'Show'} Heatmap
              {mapPins.length > 0 && (
                <span className="ml-1 text-xs opacity-75">({mapPins.length})</span>
              )}
            </span>
          </button>
        </div>

        {/* Mapbox Map */}
        {MAPBOX_TOKEN ? (
          <Map
            ref={mapRef}
            {...viewState}
            onMove={evt => setViewState(evt.viewState)}
            style={{width: '100%', height: '100%'}}
            mapStyle="mapbox://styles/mapbox/dark-v11"
            mapboxAccessToken={MAPBOX_TOKEN}
          >
            {/* Heatmap Layer */}
            {showHeatmap && mapPins.length > 0 && (
              <Source id="heatmap" type="geojson" data={heatmapData}>
                <Layer {...heatmapLayer} />
              </Source>
            )}

          {/* Individual Markers (shown when zoomed in) */}
          {viewState.zoom > 9 && mapPins.map((pin) => (
            <Marker
              key={pin.id}
              longitude={pin.lng}
              latitude={pin.lat}
              anchor="bottom"
              onClick={e => {
                e.originalEvent.stopPropagation();
                setPopupInfo({target: pin.target, lat: pin.lat, lng: pin.lng});
              }}
            >
              <div
                className="w-6 h-6 rounded-full border-2 border-white cursor-pointer hover:scale-110 transition-transform shadow-lg"
                style={{
                  backgroundColor: getMarkerColor(pin.target)
                }}
              />
            </Marker>
          ))}

          {/* Radius Circle */}
          {searchCenter && searchRadius > 0 && (
            <Source
              id="radius"
              type="geojson"
              data={{
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'Point',
                  coordinates: [searchCenter[1], searchCenter[0]]
                }
              }}
            >
              <Layer
                id="radius-circle"
                type="circle"
                paint={{
                  'circle-radius': Math.max(5, searchRadius * 1609.34 / Math.pow(2, 20 - viewState.zoom)),
                  'circle-color': '#3b82f6',
                  'circle-opacity': 0.1,
                  'circle-stroke-color': '#3b82f6',
                  'circle-stroke-width': 2,
                  'circle-stroke-opacity': 0.6
                } as any}
              />
            </Source>
          )}

          {/* Popup */}
          {popupInfo && (
            <Popup
              anchor="top"
              longitude={popupInfo.lng}
              latitude={popupInfo.lat}
              onClose={() => setPopupInfo(null)}
              className="custom-popup"
            >
              <div className="text-gray-900 min-w-64 p-2">
                <h3 className="font-bold text-lg mb-2">
                  {popupInfo.target.first_name} {popupInfo.target.last_name}
                </h3>
                <div className="space-y-1 text-sm">
                  <p><strong>Address:</strong> {popupInfo.target.address}</p>
                  <p><strong>City:</strong> {popupInfo.target.city}, {popupInfo.target.state}</p>
                  <p><strong>County:</strong> {popupInfo.target.county}</p>
                  <p><strong>Property Type:</strong> {popupInfo.target.property_type}</p>
                  <p><strong>Amount Due:</strong> {formatCurrency(popupInfo.target.amount_due)}</p>
                  <p><strong>Status:</strong> 
                    <span className={`ml-1 px-2 py-1 rounded text-xs ${
                      popupInfo.target.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {popupInfo.target.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </p>
                  {popupInfo.target.email && (
                    <p><strong>Email:</strong> {popupInfo.target.email}</p>
                  )}
                  {popupInfo.target.phone && (
                    <p><strong>Phone:</strong> {popupInfo.target.phone}</p>
                  )}
                </div>
                <div className="mt-3 flex space-x-2">
                  <button 
                    onClick={() => setSelectedTarget(popupInfo.target)}
                    className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                  >
                    View Details
                  </button>
                  <button className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600">
                    Contact
                  </button>
                </div>
              </div>
            </Popup>
          )}
          </Map>
        ) : (
          <div className="flex items-center justify-center h-full bg-slate-800 text-gray-300">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Mapbox Token Required</h3>
              <p className="text-sm">Please configure REACT_APP_MAPBOX_TOKEN in your environment.</p>
            </div>
          </div>
        )}
      </div>

      {/* Target Details Modal */}
      {selectedTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000]">
          <div className="bg-slate-800 rounded-lg p-6 w-96 max-w-90vw max-h-90vh overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-white">Target Details</h3>
              <button
                onClick={() => setSelectedTarget(null)}
                className="text-gray-400 hover:text-gray-200"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-3 text-gray-100">
              <div>
                <h4 className="font-semibold text-lg">
                  {selectedTarget.first_name} {selectedTarget.last_name}
                </h4>
                <p className="text-sm text-gray-400">#{selectedTarget.account_number}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-400">Email</p>
                  <p>{selectedTarget.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-400">Phone</p>
                  <p>{selectedTarget.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-400">County</p>
                  <p>{selectedTarget.county}</p>
                </div>
                <div>
                  <p className="text-gray-400">Property Type</p>
                  <p>{selectedTarget.property_type}</p>
                </div>
                <div>
                  <p className="text-gray-400">Amount Due</p>
                  <p className="font-semibold text-yellow-400">
                    {formatCurrency(selectedTarget.amount_due)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Status</p>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    selectedTarget.is_active 
                      ? 'bg-green-800 text-green-200' 
                      : 'bg-red-800 text-red-200'
                  }`}>
                    {selectedTarget.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              
              <div>
                <p className="text-gray-400 text-sm">Address</p>
                <p>{selectedTarget.address}</p>
                <p>{selectedTarget.city}, {selectedTarget.state} {selectedTarget.zip_code}</p>
              </div>
              
              <div className="flex space-x-3 mt-6">
                <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                  View Full Details
                </button>
                <button className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors">
                  Contact Target
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapboxTargetsView;