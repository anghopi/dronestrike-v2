import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MapIcon, 
  MagnifyingGlassIcon,
  PlusIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  EyeIcon,
  ChevronDownIcon,
  FunnelIcon,
  PhotoIcon,
  MapPinIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  ArrowRightIcon as NavigationIcon,
  PauseIcon,
  PlayIcon,
  StopIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { apiClient } from '../services/api';

// Configure Mapbox token
mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN || '';

interface Prospect {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone_cell?: string;
  mailing_address_1: string;
  mailing_city: string;
  mailing_state: string;
  mailing_zip5: string;
  latitude?: number;
  longitude?: number;
  lead_status: string;
  score_value: number;
  is_dangerous: boolean;
  is_business: boolean;
  do_not_email: boolean;
  do_not_mail: boolean;
  property?: {
    property_type: string;
    total_value: number;
    ple_amount_due?: number;
  };
  distance_meters?: number;
}

interface Mission {
  id: number;
  prospect: Prospect;
  status: number;
  status_display: string;
  lat_created?: number;
  lng_created?: number;
  lat_completed?: number;
  lng_completed?: number;
  completed_at?: string;
  distance_traveled?: number;
  can_be_declined: boolean;
  can_be_paused: boolean;
  is_active: boolean;
  photos: MissionPhoto[];
  created_at: string;
}

interface MissionPhoto {
  id: number;
  photo: string;
  lat?: number;
  lng?: number;
  is_valid_location: boolean;
  distance_from_target?: number;
  caption?: string;
  created_at: string;
}

interface MissionRoute {
  id: number;
  status: number;
  is_optimized: boolean;
  total_distance_meters?: number;
  total_time_seconds?: number;
  route_points: RoutePoint[];
  total_points: number;
}

interface RoutePoint {
  id: number;
  prospect: Prospect;
  lat: number;
  lng: number;
  provided_index: number;
  optimized_index?: number;
  status: number;
  visited_at?: string;
}

interface DeclineReason {
  id: number;
  reason: string;
  is_safety_related: boolean;
}

const MissionTargets: React.FC = () => {
  // Map and location state
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [searchCenter, setSearchCenter] = useState<{lat: number, lng: number}>({ lat: 32.7767, lng: -96.7970 });
  const [searchRadius, setSearchRadius] = useState(5000); // meters
  
  // Mission and prospect state
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedProspects, setSelectedProspects] = useState<number[]>([]);
  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [missionRoutes, setMissionRoutes] = useState<MissionRoute[]>([]);
  const [declineReasons, setDeclineReasons] = useState<DeclineReason[]>([]);
  
  // Search and filter state
  const [searchFilters, setSearchFilters] = useState({
    property_type: '',
    amount_due_min: '',
    amount_due_max: '',
    exclude_dangerous: true,
    exclude_business: false,
    exclude_do_not_contact: true,
    limit: 50
  });
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [currentView, setCurrentView] = useState<'map' | 'list'>('map');
  const [showFilters, setShowFilters] = useState(false);
  const [showMissionModal, setShowMissionModal] = useState(false);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);

  // Initialize Mapbox map
  useEffect(() => {
    if (mapContainer.current && !map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [searchCenter.lng, searchCenter.lat],
        zoom: 12,
        attributionControl: false
      });

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Add user location control
      map.current.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: {
            enableHighAccuracy: true
          },
          trackUserLocation: true,
          showUserHeading: true
        }),
        'top-right'
      );

      // Handle map clicks for search center
      map.current.on('click', (e) => {
        setSearchCenter({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      });
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Get user's current location
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setUserLocation(location);
        setSearchCenter(location);
        
        if (map.current) {
          map.current.setCenter([location.lng, location.lat]);
        }
      },
      (error) => {
        console.warn('Could not get user location:', error);
      }
    );
  }, []);

  // Load initial data
  useEffect(() => {
    loadActiveMission();
    loadDeclineReasons();
    loadMissions();
  }, []);

  // Update map markers when prospects change
  useEffect(() => {
    if (map.current) {
      updateMapMarkers();
    }
  }, [prospects, selectedProspects]);

  // Load active mission
  const loadActiveMission = async () => {
    try {
      const response = await apiClient.get('/api/missions/active_mission/') as any;
      if (response.data && response.data.id) {
        setActiveMission(response.data);
      }
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error('Error loading active mission:', error);
      }
    }
  };

  // Load mission decline reasons
  const loadDeclineReasons = async () => {
    try {
      const response = await apiClient.get('/api/decline-reasons/') as any;
      setDeclineReasons(response.data.results || response.data);
    } catch (error) {
      console.error('Error loading decline reasons:', error);
    }
  };

  // Load all missions
  const loadMissions = async () => {
    try {
      const response = await apiClient.get('/api/missions/') as any;
      setMissions(response.data.results || response.data);
    } catch (error) {
      console.error('Error loading missions:', error);
    }
  };

  // Search for prospects near location
  const searchProspects = async () => {
    setIsLoading(true);
    try {
      const searchData = {
        lat: searchCenter.lat,
        lng: searchCenter.lng,
        radius: searchRadius,
        ...searchFilters
      };

      const response = await apiClient.post('/api/missions/search_prospects/', searchData) as any;
      setProspects(response.data.prospects || []);
      
      // Update search center marker
      if (map.current) {
        addSearchCenterMarker();
      }
    } catch (error) {
      console.error('Error searching prospects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Create mission for selected prospect
  const createMission = async (prospectId: number) => {
    if (activeMission) {
      alert('You already have an active mission. Complete or decline it first.');
      return;
    }

    try {
      const missionData = {
        prospect_id: prospectId,
        lat_created: userLocation?.lat,
        lng_created: userLocation?.lng,
        go_to_lead: true
      };

      const response = await apiClient.post('/api/missions/', missionData) as any;
      setActiveMission(response.data);
      await loadMissions();
      
      alert('Mission created successfully!');
    } catch (error: any) {
      console.error('Error creating mission:', error);
      alert(error.response?.data?.detail || 'Failed to create mission');
    }
  };

  // Mission status actions
  const acceptMission = async (missionId: number) => {
    try {
      await apiClient.post(`/api/missions/${missionId}/accept/`);
      await loadActiveMission();
      await loadMissions();
    } catch (error) {
      console.error('Error accepting mission:', error);
    }
  };

  const declineMission = async (missionId: number, declineReasonId?: number) => {
    try {
      const data = declineReasonId ? { decline_reason_id: declineReasonId } : {};
      await apiClient.post(`/api/missions/${missionId}/decline/`, data);
      await loadActiveMission();
      await loadMissions();
    } catch (error) {
      console.error('Error declining mission:', error);
    }
  };

  const pauseMission = async (missionId: number) => {
    try {
      await apiClient.post(`/api/missions/${missionId}/pause/`);
      await loadActiveMission();
      await loadMissions();
    } catch (error) {
      console.error('Error pausing mission:', error);
    }
  };

  const resumeMission = async (missionId: number) => {
    try {
      await apiClient.post(`/api/missions/${missionId}/resume/`);
      await loadActiveMission();
      await loadMissions();
    } catch (error) {
      console.error('Error resuming mission:', error);
    }
  };

  const completeMission = async (missionId: number) => {
    if (!userLocation) {
      alert('Location required to complete mission');
      return;
    }

    try {
      const data = {
        lat_completed: userLocation.lat,
        lng_completed: userLocation.lng
      };
      await apiClient.post(`/api/missions/${missionId}/complete/`, data);
      await loadActiveMission();
      await loadMissions();
      
      alert('Mission completed successfully!');
    } catch (error) {
      console.error('Error completing mission:', error);
    }
  };

  // Upload photo for mission
  const uploadMissionPhoto = async (missionId: number, file: File, caption: string = '') => {
    if (!userLocation) {
      alert('Location required for photo upload');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('lat', userLocation.lat.toString());
      formData.append('lng', userLocation.lng.toString());
      formData.append('caption', caption);

      await (apiClient as any).post(`/api/missions/${missionId}/upload_photo/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      await loadActiveMission();
      alert('Photo uploaded successfully!');
    } catch (error) {
      console.error('Error uploading photo:', error);
    }
  };

  // Update map markers
  const updateMapMarkers = () => {
    if (!map.current) return;

    // Clear existing markers
    const existingMarkers = document.querySelectorAll('.prospect-marker');
    existingMarkers.forEach(marker => marker.remove());

    // Add prospect markers
    prospects.forEach(prospect => {
      if (prospect.latitude && prospect.longitude) {
        const isSelected = selectedProspects.includes(prospect.id);
        
        const el = document.createElement('div');
        el.className = `prospect-marker cursor-pointer w-8 h-8 rounded-full border-2 flex items-center justify-center text-white text-xs font-bold ${
          isSelected 
            ? 'bg-blue-600 border-blue-400' 
            : prospect.is_dangerous 
              ? 'bg-red-600 border-red-400'
              : 'bg-green-600 border-green-400'
        }`;
        el.innerHTML = prospect.score_value.toString();
        el.title = `${prospect.first_name} ${prospect.last_name} - Score: ${prospect.score_value}`;

        el.addEventListener('click', () => {
          toggleProspectSelection(prospect.id);
        });

        new mapboxgl.Marker(el)
          .setLngLat([prospect.longitude, prospect.latitude])
          .addTo(map.current!);

        // Add popup with prospect info
        const popup = new mapboxgl.Popup({
          offset: 25,
          closeButton: false,
          closeOnClick: false
        }).setHTML(`
          <div class="text-sm">
            <div class="font-bold">${prospect.first_name} ${prospect.last_name}</div>
            <div>Score: ${prospect.score_value}</div>
            <div>${prospect.mailing_address_1}, ${prospect.mailing_city}</div>
            ${prospect.distance_meters ? `<div>Distance: ${(prospect.distance_meters / 1000).toFixed(1)}km</div>` : ''}
            <button class="mt-2 px-2 py-1 bg-blue-600 text-white rounded text-xs" 
                    onclick="window.createMissionForProspect(${prospect.id})">
              Create Mission
            </button>
          </div>
        `);

        el.addEventListener('mouseenter', () => {
          popup.setLngLat([prospect.longitude!, prospect.latitude!]).addTo(map.current!);
        });

        el.addEventListener('mouseleave', () => {
          popup.remove();
        });
      }
    });
  };

  // Add search center marker
  const addSearchCenterMarker = () => {
    if (!map.current) return;

    // Remove existing search center marker
    const existingCenter = document.querySelector('.search-center-marker');
    if (existingCenter) existingCenter.remove();

    const el = document.createElement('div');
    el.className = 'search-center-marker w-4 h-4 bg-yellow-500 border-2 border-white rounded-full';
    
    new mapboxgl.Marker(el)
      .setLngLat([searchCenter.lng, searchCenter.lat])
      .addTo(map.current);

    // Add search radius circle
    if (map.current.getSource('search-radius')) {
      map.current.removeLayer('search-radius');
      map.current.removeSource('search-radius');
    }

    const radiusInKm = searchRadius / 1000;
    const circle = createCircle([searchCenter.lng, searchCenter.lat], radiusInKm);

    map.current.addSource('search-radius', {
      type: 'geojson',
      data: circle
    });

    map.current.addLayer({
      id: 'search-radius',
      type: 'line',
      source: 'search-radius',
      paint: {
        'line-color': '#fbbf24',
        'line-width': 2,
        'line-opacity': 0.8
      }
    });
  };

  // Helper function to create circle geometry
  const createCircle = (center: [number, number], radiusInKm: number) => {
    const points = 64;
    const coords: [number, number][] = [];
    
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * 2 * Math.PI;
      const dx = radiusInKm * Math.cos(angle);
      const dy = radiusInKm * Math.sin(angle);
      
      coords.push([
        center[0] + dx / (111.32 * Math.cos(center[1] * Math.PI / 180)),
        center[1] + dy / 110.54
      ]);
    }
    
    coords.push(coords[0]); // Close the circle
    
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [coords]
      }
    };
  };

  // Toggle prospect selection
  const toggleProspectSelection = (prospectId: number) => {
    setSelectedProspects(prev => 
      prev.includes(prospectId)
        ? prev.filter(id => id !== prospectId)
        : [...prev, prospectId]
    );
  };

  // Expose function to global scope for popup buttons
  React.useEffect(() => {
    (window as any).createMissionForProspect = createMission;
  }, []);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Get mission status color
  const getMissionStatusColor = (status: number) => {
    switch (status) {
      case 1: return 'bg-blue-500'; // New
      case 2: return 'bg-green-500'; // Accepted
      case 4: return 'bg-yellow-500'; // On Hold
      case 8: return 'bg-gray-500'; // Closed
      case 16: return 'bg-red-500'; // Declined
      case 32: return 'bg-red-600'; // Declined Safety
      case 1024: return 'bg-orange-500'; // Paused
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-6 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <NavigationIcon className="h-8 w-8 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Mission Targets</h1>
              <p className="text-gray-400">BOTG Field Operations & Target Management</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* View Switcher */}
          <div className="flex bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setCurrentView('map')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                currentView === 'map'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-600'
              }`}
            >
              <MapIcon className="h-4 w-4 inline mr-1" />
              Map
            </button>
            <button
              onClick={() => setCurrentView('list')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                currentView === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-600'
              }`}
            >
              List
            </button>
          </div>
          
          <button
            onClick={searchProspects}
            disabled={isLoading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
            ) : (
              <MagnifyingGlassIcon className="h-4 w-4" />
            )}
            <span>Search Area</span>
          </button>
        </div>
      </div>

      {/* Active Mission Status */}
      {activeMission && (
        <div className="p-4 bg-blue-900 border-b border-blue-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`w-3 h-3 rounded-full ${getMissionStatusColor(activeMission.status)}`}></div>
              <div>
                <div className="text-white font-medium">
                  Active Mission: {activeMission.prospect.first_name} {activeMission.prospect.last_name}
                </div>
                <div className="text-blue-200 text-sm">
                  Status: {activeMission.status_display} • Score: {activeMission.prospect.score_value}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {activeMission.status === 1 && ( // New
                <button
                  onClick={() => acceptMission(activeMission.id)}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                >
                  Accept
                </button>
              )}
              
              {activeMission.can_be_paused && (
                <button
                  onClick={() => pauseMission(activeMission.id)}
                  className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
                >
                  <PauseIcon className="h-4 w-4" />
                </button>
              )}
              
              {activeMission.status === 1024 && ( // Paused
                <button
                  onClick={() => resumeMission(activeMission.id)}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                >
                  <PlayIcon className="h-4 w-4" />
                </button>
              )}
              
              {activeMission.status === 2 && ( // Accepted
                <button
                  onClick={() => completeMission(activeMission.id)}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  Complete
                </button>
              )}
              
              {activeMission.can_be_declined && (
                <button
                  onClick={() => {
                    const reason = prompt('Decline reason (optional):');
                    const reasonId = declineReasons.find(r => r.reason.toLowerCase().includes(reason?.toLowerCase() || ''))?.id;
                    declineMission(activeMission.id, reasonId);
                  }}
                  className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                >
                  Decline
                </button>
              )}
              
              <button
                onClick={() => setSelectedMission(activeMission)}
                className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
              >
                <EyeIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Controls */}
      <div className="p-4 bg-gray-800 border-b border-gray-700">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-300">Search Radius:</label>
              <select
                value={searchRadius}
                onChange={(e) => setSearchRadius(Number(e.target.value))}
                className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              >
                <option value={1000}>1 km</option>
                <option value={2000}>2 km</option>
                <option value={5000}>5 km</option>
                <option value={10000}>10 km</option>
                <option value={25000}>25 km</option>
              </select>
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
            >
              <FunnelIcon className="h-4 w-4" />
              Filters
              <ChevronDownIcon className="h-4 w-4" />
            </button>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-gray-300">
            <span>{prospects.length} prospects found</span>
            <span>{selectedProspects.length} selected</span>
            <span>{missions.length} total missions</span>
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Property Type</label>
                <select
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  value={searchFilters.property_type}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, property_type: e.target.value }))}
                >
                  <option value="">All Types</option>
                  <option value="single_family">Single Family</option>
                  <option value="multi_family">Multi-Family</option>
                  <option value="condo">Condo</option>
                  <option value="townhouse">Townhouse</option>
                  <option value="commercial">Commercial</option>
                  <option value="land">Land</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Min Amount Due</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  placeholder="0"
                  value={searchFilters.amount_due_min}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, amount_due_min: e.target.value }))}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Max Amount Due</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  placeholder="999999"
                  value={searchFilters.amount_due_max}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, amount_due_max: e.target.value }))}
                />
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="exclude-dangerous"
                  checked={searchFilters.exclude_dangerous}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, exclude_dangerous: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
                />
                <label htmlFor="exclude-dangerous" className="ml-2 text-sm text-gray-300">
                  Exclude Dangerous
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="exclude-business"
                  checked={searchFilters.exclude_business}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, exclude_business: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
                />
                <label htmlFor="exclude-business" className="ml-2 text-sm text-gray-300">
                  Exclude Business
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="exclude-no-contact"
                  checked={searchFilters.exclude_do_not_contact}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, exclude_do_not_contact: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
                />
                <label htmlFor="exclude-no-contact" className="ml-2 text-sm text-gray-300">
                  Exclude Do Not Contact
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {currentView === 'map' ? (
          <div className="flex-1 relative">
            <div ref={mapContainer} className="w-full h-full" />
            
            {/* Map Controls Overlay */}
            <div className="absolute top-4 left-4 bg-gray-800 rounded-lg p-3 border border-gray-700">
              <div className="text-white text-sm space-y-1">
                <div>Click map to set search center</div>
                <div>Center: {searchCenter.lat.toFixed(4)}, {searchCenter.lng.toFixed(4)}</div>
                <div>Radius: {(searchRadius / 1000).toFixed(1)} km</div>
              </div>
            </div>
          </div>
        ) : (
          /* List View */
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-300 uppercase bg-gray-700 sticky top-0">
                  <tr>
                    <th className="p-4">Score</th>
                    <th className="px-6 py-3">Prospect</th>
                    <th className="px-6 py-3">Location</th>
                    <th className="px-6 py-3">Contact</th>
                    <th className="px-6 py-3">Property</th>
                    <th className="px-6 py-3">Distance</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {prospects.map((prospect) => (
                    <tr key={prospect.id} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-750">
                      <td className="p-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-white">{prospect.score_value}</div>
                          {prospect.is_dangerous && (
                            <ExclamationTriangleIcon className="h-4 w-4 text-red-400 mx-auto" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <UserIcon className="h-8 w-8 text-gray-400 bg-gray-700 rounded-full p-1" />
                          <div>
                            <div className="font-semibold text-white">
                              {prospect.first_name} {prospect.last_name}
                            </div>
                            <div className="text-sm text-gray-400">
                              ID: {prospect.id} • {prospect.lead_status}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-300">
                          <div>{prospect.mailing_address_1}</div>
                          <div>{prospect.mailing_city}, {prospect.mailing_state} {prospect.mailing_zip5}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1 text-sm text-gray-300">
                          {prospect.email && (
                            <div className="flex items-center gap-1">
                              <EnvelopeIcon className="h-3 w-3" />
                              {prospect.email}
                            </div>
                          )}
                          {prospect.phone_cell && (
                            <div className="flex items-center gap-1">
                              <PhoneIcon className="h-3 w-3" />
                              {prospect.phone_cell}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-300">
                          {prospect.property && (
                            <>
                              <div>{prospect.property.property_type}</div>
                              <div>{formatCurrency(prospect.property.total_value)}</div>
                              {prospect.property.ple_amount_due && (
                                <div className="text-red-300">Due: {formatCurrency(prospect.property.ple_amount_due)}</div>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {prospect.distance_meters && (
                          <div className="text-sm text-gray-300">
                            {(prospect.distance_meters / 1000).toFixed(1)} km
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => createMission(prospect.id)}
                            disabled={!!activeMission}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                          >
                            Create Mission
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Mission Details Modal */}
      {selectedMission && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">Mission Details</h2>
              <button
                onClick={() => setSelectedMission(null)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Mission Info */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Mission Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="block text-gray-300">Status</label>
                    <span className={`inline-block px-2 py-1 rounded text-white text-xs ${getMissionStatusColor(selectedMission.status)}`}>
                      {selectedMission.status_display}
                    </span>
                  </div>
                  <div>
                    <label className="block text-gray-300">Created</label>
                    <span className="text-white">{new Date(selectedMission.created_at).toLocaleString()}</span>
                  </div>
                  {selectedMission.completed_at && (
                    <>
                      <div>
                        <label className="block text-gray-300">Completed</label>
                        <span className="text-white">{new Date(selectedMission.completed_at).toLocaleString()}</span>
                      </div>
                      <div>
                        <label className="block text-gray-300">Distance Traveled</label>
                        <span className="text-white">{selectedMission.distance_traveled?.toFixed(2) || 'N/A'} miles</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Prospect Info */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Prospect Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="block text-gray-300">Name</label>
                    <span className="text-white">{selectedMission.prospect.first_name} {selectedMission.prospect.last_name}</span>
                  </div>
                  <div>
                    <label className="block text-gray-300">Score</label>
                    <span className="text-white text-lg font-bold">{selectedMission.prospect.score_value}</span>
                  </div>
                  <div>
                    <label className="block text-gray-300">Address</label>
                    <span className="text-white">{selectedMission.prospect.mailing_address_1}, {selectedMission.prospect.mailing_city}</span>
                  </div>
                  <div>
                    <label className="block text-gray-300">Contact</label>
                    <div className="text-white">
                      {selectedMission.prospect.phone_cell && <div>{selectedMission.prospect.phone_cell}</div>}
                      {selectedMission.prospect.email && <div>{selectedMission.prospect.email}</div>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Photos */}
              {selectedMission.photos && selectedMission.photos.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Mission Photos</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedMission.photos.map((photo) => (
                      <div key={photo.id} className="border border-gray-600 rounded-lg p-3">
                        <img 
                          src={photo.photo} 
                          alt={photo.caption || 'Mission photo'}
                          className="w-full h-32 object-cover rounded"
                        />
                        <div className="mt-2 text-sm">
                          <div className="text-gray-300">{photo.caption}</div>
                          <div className="text-gray-400">
                            {photo.is_valid_location ? (
                              <span className="text-green-400">✓ Valid location</span>
                            ) : (
                              <span className="text-red-400">✗ Invalid location</span>
                            )}
                            {photo.distance_from_target && (
                              <span className="ml-2">({photo.distance_from_target.toFixed(0)}m from target)</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MissionTargets;