import React, { useState, useEffect, useRef } from 'react';
import { 
  MapIcon, 
  FunnelIcon,
  ViewColumnsIcon,
  MapPinIcon,
  EyeIcon,
  PencilIcon,
  PhoneIcon,
  EnvelopeIcon,
  UserIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  BanknotesIcon,
  ChevronDownIcon,
  StarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';
import {
  StarIcon as StarIconSolid,
  ExclamationTriangleIcon as ExclamationTriangleIconSolid
} from '@heroicons/react/24/solid';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { apiClient } from '../services/api';

// Configure Mapbox token
mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN || '';

interface Property {
  id: number;
  account_number: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  county: string;
  lat: number;
  lng: number;
  property_type: string;
  property_value: number;
  market_value: number;
  assessed_value: number;
  tax_amount_due: number;
  is_active: boolean;
  in_foreclosure: boolean;
  created_at: string;
  updated_at: string;
}

interface Lead {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone_cell: string;
  phone_other?: string;
  birth_date?: string;
  language_preference: string;
  lead_status: string;
  safety_concerns?: string;
  do_not_contact: boolean;
  is_dangerous: boolean;
  is_business: boolean;
  score_value: number;
  mailing_address_1: string;
  mailing_city: string;
  mailing_state: string;
  mailing_zip5: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
  updated_at: string;
}

interface Target {
  id: number;
  property: Property;
  lead: Lead;
  status: string;
  priority: string;
  lead_score: number;
  missions?: Mission[];
  opportunities?: Opportunity[];
  last_contact?: string;
  contact_attempts: number;
  assigned_to?: string;
  notes?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

interface Mission {
  id: number;
  prospect_id: number;
  user: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
  };
  status: string;
  status_display: string;
  lat_created?: string;
  lng_created?: string;
  lat_completed?: string;
  lng_completed?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  prospect: Lead;
  device?: any;
  decline_reason?: any;
  photos?: any[];
  can_be_declined: boolean;
  can_be_paused: boolean;
  is_active: boolean;
}

interface Opportunity {
  id: number;
  prospect_id: number;
  type: string;
  status: string;
  value: number;
  created_at: string;
}

interface FilterOptions {
  status: string;
  priority: string;
  leadStatus: string;
  propertyType: string;
  minValue: string;
  maxValue: string;
  minTaxDue: string;
  maxTaxDue: string;
  inForeclosure: boolean | null;
  safetyFlag: boolean | null;
  hasContact: boolean | null;
  assignedUser: string;
  dateRange: string;
  city: string;
  county: string;
  zipCode: string;
}

const TargetsEnhanced: React.FC = () => {
  // Core state
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // View state  
  const [viewMode, setViewMode] = useState<'list' | 'map' | 'grid'>('list');
  const [selectedTargets, setSelectedTargets] = useState<number[]>([]);
  const [sortField, setSortField] = useState('lead_score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    status: '',
    priority: '',
    leadStatus: '',
    propertyType: '',
    minValue: '',
    maxValue: '',
    minTaxDue: '',
    maxTaxDue: '',
    inForeclosure: null,
    safetyFlag: null,
    hasContact: null,
    assignedUser: '',
    dateRange: '',
    city: '',
    county: '',
    zipCode: ''
  });
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'name' | 'address' | 'phone' | 'email'>('all');
  
  // Map state
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  
  // Mission state
  const [activeMissions, setActiveMissions] = useState<Mission[]>([]);
  const [showMissionModal, setShowMissionModal] = useState(false);
  const [selectedTargetForMission, setSelectedTargetForMission] = useState<Target | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalItems, setTotalItems] = useState(0);

  // Load data on component mount
  useEffect(() => {
    loadTargets();
    loadActiveMissions();
  }, [currentPage, itemsPerPage, sortField, sortDirection, filters, searchTerm]);

  const loadTargets = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Build query parameters (translated from Laravel implementation)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        per_page: itemsPerPage.toString(),
        sort_field: sortField,
        sort_direction: sortDirection,
        search: searchTerm,
        search_type: searchType,
        ...Object.entries(filters)
          .filter(([_, value]) => value !== '' && value !== null)
          .reduce((acc, [key, value]) => ({...acc, [key]: value.toString()}), {})
      });

      const response = await apiClient.get(`/api/leads/?${params.toString()}`) as any;
      
      // Transform leads to targets format (matching Laravel structure)
      const transformedTargets = response.data.results.map((lead: Lead) => ({
        id: lead.id,
        property: {
          id: lead.id, // Using lead ID as property ID for now
          address: `${lead.mailing_address_1}`,
          city: lead.mailing_city,
          state: lead.mailing_state,
          zip_code: lead.mailing_zip5,
          lat: lead.latitude || 0,
          lng: lead.longitude || 0,
          property_type: 'unknown',
          tax_amount_due: 0
        } as Property,
        lead: lead,
        status: lead.lead_status,
        priority: lead.score_value > 80 ? 'high' : lead.score_value > 60 ? 'medium' : 'low',
        lead_score: lead.score_value,
        missions: [],
        opportunities: [],
        contact_attempts: 0,
        created_at: lead.created_at,
        updated_at: lead.updated_at
      }));
      
      setTargets(transformedTargets);
      setTotalItems(response.data.count || transformedTargets.length);
      
      // Update map if in map view
      if (viewMode === 'map' && map.current) {
        updateMapMarkers(transformedTargets);
      }
      
    } catch (error: any) {
      console.error('Error loading targets:', error);
      setError('Failed to load targets. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadActiveMissions = async () => {
    try {
      const response = await apiClient.get('/api/missions/') as any;
      setActiveMissions(response.data.results || []);
    } catch (error) {
      console.error('Error loading missions:', error);
    }
  };

  // Initialize Mapbox map
  useEffect(() => {
    if (viewMode === 'map' && mapContainer.current && !map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [-97.7431, 30.2672], // Austin, TX
        zoom: 10
      });

      map.current.on('load', () => {
        setMapLoaded(true);
        updateMapMarkers(targets);
      });
    }
  }, [viewMode]);

  const updateMapMarkers = (targetData: Target[]) => {
    if (!map.current || !mapLoaded) return;

    // Remove existing markers
    const existingMarkers = document.querySelectorAll('.target-marker');
    existingMarkers.forEach(marker => marker.remove());

    // Add new markers
    targetData.forEach(target => {
      if (target.property.lat && target.property.lng) {
        const markerEl = document.createElement('div');
        markerEl.className = 'target-marker';
        markerEl.innerHTML = `
          <div class="w-6 h-6 rounded-full border-2 border-white shadow-lg cursor-pointer transition-all hover:scale-110 ${
            target.lead.is_dangerous ? 'bg-red-500' : 
            target.priority === 'high' ? 'bg-green-500' :
            target.priority === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
          }">
            ${target.lead.is_dangerous ? 
              '<div class="w-full h-full flex items-center justify-center text-white text-xs">!</div>' : 
              `<div class="w-full h-full flex items-center justify-center text-white text-xs">${target.lead_score}</div>`
            }
          </div>
        `;

        markerEl.addEventListener('click', () => {
          setSelectedTargetForMission(target);
          setShowMissionModal(true);
        });

        new mapboxgl.Marker(markerEl)
          .setLngLat([target.property.lng, target.property.lat])
          .setPopup(new mapboxgl.Popup().setHTML(`
            <div class="p-2">
              <h3 class="font-bold">${target.lead.first_name} ${target.lead.last_name}</h3>
              <p class="text-sm">${target.property.address}</p>
              <p class="text-sm">${target.property.city}, ${target.property.state}</p>
              <p class="text-sm">Score: ${target.lead_score}</p>
              ${target.lead.is_dangerous ? '<p class="text-red-500 text-xs">⚠️ Safety Concern</p>' : ''}
            </div>
          `))
          .addTo(map.current!);
      }
    });
  };

  const createMission = async (targetId: number, missionType: string = 'visit') => {
    try {
      const target = targets.find(t => t.id === targetId);
      if (!target) return;

      const missionData = {
        prospect_id: target.id,
        lat_created: target.property.lat,
        lng_created: target.property.lng,
        go_to_lead: true,
        initial_amount_due: target.property.tax_amount_due || 0
      };

      const response = await apiClient.post('/api/missions/', missionData) as any;
      
      // Refresh data
      loadTargets();
      loadActiveMissions();
      
      alert('Mission created successfully!');
      setShowMissionModal(false);
      setSelectedTargetForMission(null);
      
    } catch (error: any) {
      console.error('Error creating mission:', error);
      alert('Failed to create mission. Please try again.');
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleFilterChange = (key: keyof FilterOptions, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setCurrentPage(1); // Reset to first page when filtering
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      priority: '',
      leadStatus: '',
      propertyType: '',
      minValue: '',
      maxValue: '',
      minTaxDue: '',
      maxTaxDue: '',
      inForeclosure: null,
      safetyFlag: null,
      hasContact: null,
      assignedUser: '',
      dateRange: '',
      city: '',
      county: '',
      zipCode: ''
    });
    setSearchTerm('');
    setCurrentPage(1);
  };

  const toggleTargetSelection = (targetId: number) => {
    setSelectedTargets(prev => 
      prev.includes(targetId) 
        ? prev.filter(id => id !== targetId)
        : [...prev, targetId]
    );
  };

  const selectAllTargets = () => {
    if (selectedTargets.length === targets.length) {
      setSelectedTargets([]);
    } else {
      setSelectedTargets(targets.map(t => t.id));
    }
  };

  const bulkCreateMissions = async () => {
    if (selectedTargets.length === 0) return;
    
    if (window.confirm(`Create missions for ${selectedTargets.length} selected targets?`)) {
      try {
        await Promise.all(
          selectedTargets.map(targetId => createMission(targetId))
        );
        setSelectedTargets([]);
        alert(`Successfully created ${selectedTargets.length} missions!`);
      } catch (error) {
        alert('Some missions failed to create. Please try again.');
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      new: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'New' },
      contacted: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Contacted' },
      qualified: { bg: 'bg-green-100', text: 'text-green-800', label: 'Qualified' },
      converted: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Converted' },
      dead: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Dead' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.new;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getPriorityIcon = (priority: string, score: number) => {
    if (priority === 'high' || score > 80) {
      return <StarIconSolid className="h-4 w-4 text-yellow-400" />;
    }
    return <StarIcon className="h-4 w-4 text-gray-400" />;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const filteredTargets = targets.filter(target => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    
    switch (searchType) {
      case 'name':
        return `${target.lead.first_name} ${target.lead.last_name}`.toLowerCase().includes(searchLower);
      case 'address':
        return target.property.address.toLowerCase().includes(searchLower);
      case 'phone':
        return target.lead.phone_cell?.toLowerCase().includes(searchLower);
      case 'email':
        return target.lead.email?.toLowerCase().includes(searchLower);
      default:
        return (
          `${target.lead.first_name} ${target.lead.last_name}`.toLowerCase().includes(searchLower) ||
          target.property.address.toLowerCase().includes(searchLower) ||
          target.lead.phone_cell?.toLowerCase().includes(searchLower) ||
          target.lead.email?.toLowerCase().includes(searchLower) ||
          target.property.city.toLowerCase().includes(searchLower)
        );
    }
  });

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Target Intelligence</h1>
              <p className="text-gray-400 mt-1">
                {totalItems.toLocaleString()} targets • {activeMissions.length} active missions
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* View Mode Toggle */}
              <div className="flex bg-gray-700 rounded-lg p-1">
                {(['list', 'map', 'grid'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      viewMode === mode
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:text-white hover:bg-gray-600'
                    }`}
                  >
                    {mode === 'list' && <ViewColumnsIcon className="h-4 w-4" />}
                    {mode === 'map' && <MapIcon className="h-4 w-4" />}
                    {mode === 'grid' && <AdjustmentsHorizontalIcon className="h-4 w-4" />}
                  </button>
                ))}
              </div>

              {/* Bulk Actions */}
              {selectedTargets.length > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-400">
                    {selectedTargets.length} selected
                  </span>
                  <button
                    onClick={bulkCreateMissions}
                    className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm font-medium transition-colors"
                  >
                    Create Missions
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mt-4 flex items-center space-x-4">
            {/* Search */}
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search targets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Search Type */}
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value as any)}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Fields</option>
              <option value="name">Name</option>
              <option value="address">Address</option>
              <option value="phone">Phone</option>
              <option value="email">Email</option>
            </select>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
                showFilters
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:text-white'
              }`}
            >
              <FunnelIcon className="h-4 w-4" />
              <span>Filters</span>
              <ChevronDownIcon className={`h-4 w-4 transform transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            {/* Clear Filters */}
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
            >
              Clear
            </button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-750 rounded-lg border border-gray-600">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Statuses</option>
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="qualified">Qualified</option>
                    <option value="converted">Converted</option>
                    <option value="dead">Dead</option>
                  </select>
                </div>

                {/* Priority Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Priority</label>
                  <select
                    value={filters.priority}
                    onChange={(e) => handleFilterChange('priority', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Priorities</option>
                    <option value="high">High (80+)</option>
                    <option value="medium">Medium (60-79)</option>
                    <option value="low">Low (0-59)</option>
                  </select>
                </div>

                {/* Safety Flag Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Safety</label>
                  <select
                    value={filters.safetyFlag?.toString() || ''}
                    onChange={(e) => handleFilterChange('safetyFlag', e.target.value === '' ? null : e.target.value === 'true')}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All</option>
                    <option value="false">Safe</option>
                    <option value="true">Safety Concern</option>
                  </select>
                </div>

                {/* City Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">City</label>
                  <input
                    type="text"
                    value={filters.city}
                    onChange={(e) => handleFilterChange('city', e.target.value)}
                    placeholder="Enter city..."
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <ArrowPathIcon className="h-8 w-8 text-blue-500 animate-spin" />
            <span className="ml-2 text-gray-400">Loading targets...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64">
            <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
            <span className="ml-2 text-red-400">{error}</span>
          </div>
        ) : viewMode === 'map' ? (
          // Map View
          <div className="h-full">
            <div ref={mapContainer} className="w-full h-screen" />
          </div>
        ) : viewMode === 'list' ? (
          // List View (Table)
          <div className="p-6">
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              {/* Table Header */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-750">
                    <tr>
                      <th className="w-12 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedTargets.length === targets.length && targets.length > 0}
                          onChange={selectAllTargets}
                          className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      {[
                        { key: 'lead_score', label: 'Score' },
                        { key: 'name', label: 'Name' },
                        { key: 'address', label: 'Address' },
                        { key: 'phone', label: 'Phone' },
                        { key: 'email', label: 'Email' },
                        { key: 'status', label: 'Status' },
                        { key: 'last_contact', label: 'Last Contact' },
                        { key: 'actions', label: 'Actions' }
                      ].map(({ key, label }) => (
                        <th
                          key={key}
                          className={`px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider ${
                            key !== 'actions' ? 'cursor-pointer hover:bg-gray-700' : ''
                          }`}
                          onClick={key !== 'actions' ? () => handleSort(key) : undefined}
                        >
                          <div className="flex items-center space-x-1">
                            <span>{label}</span>
                            {sortField === key && (
                              <ChevronDownIcon className={`h-3 w-3 transform ${sortDirection === 'asc' ? 'rotate-180' : ''}`} />
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {filteredTargets.map((target) => (
                      <tr key={target.id} className="hover:bg-gray-750 transition-colors">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedTargets.includes(target.id)}
                            onChange={() => toggleTargetSelection(target.id)}
                            className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-2">
                            {getPriorityIcon(target.priority, target.lead_score)}
                            <span className="font-medium text-white">{target.lead_score}</span>
                            {target.lead.is_dangerous && (
                              <ExclamationTriangleIconSolid className="h-4 w-4 text-red-500" title="Safety Concern" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <div className="font-medium text-white">
                              {target.lead.first_name} {target.lead.last_name}
                            </div>
                            {target.lead.is_business && (
                              <div className="text-xs text-gray-400">Business</div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-300">
                            <div>{target.property.address}</div>
                            <div className="text-gray-400">
                              {target.property.city}, {target.property.state} {target.property.zip_code}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-300">
                            {formatPhoneNumber(target.lead.phone_cell)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-300">
                            {target.lead.email || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(target.status)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-400">
                            {target.last_contact ? new Date(target.last_contact).toLocaleDateString() : 'Never'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                setSelectedTargetForMission(target);
                                setShowMissionModal(true);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                              title="Create Mission"
                            >
                              <PlusIcon className="h-4 w-4" />
                            </button>
                            <button
                              className="p-1 text-gray-400 hover:text-green-400 transition-colors"
                              title="View Details"
                            >
                              <EyeIcon className="h-4 w-4" />
                            </button>
                            <button
                              className="p-1 text-gray-400 hover:text-yellow-400 transition-colors"
                              title="Edit"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            {target.lead.phone_cell && (
                              <a
                                href={`tel:${target.lead.phone_cell}`}
                                className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                                title="Call"
                              >
                                <PhoneIcon className="h-4 w-4" />
                              </a>
                            )}
                            {target.lead.email && (
                              <a
                                href={`mailto:${target.lead.email}`}
                                className="p-1 text-gray-400 hover:text-purple-400 transition-colors"
                                title="Email"
                              >
                                <EnvelopeIcon className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="bg-gray-750 px-4 py-3 border-t border-gray-700 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-400">
                      Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} results
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
                    >
                      Previous
                    </button>
                    
                    {/* Page numbers */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-1 border rounded text-sm transition-colors ${
                            currentPage === page
                              ? 'bg-blue-600 border-blue-500 text-white'
                              : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Grid View
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredTargets.map((target) => (
                <div key={target.id} className="bg-gray-800 rounded-lg border border-gray-700 p-4 hover:border-gray-600 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      {getPriorityIcon(target.priority, target.lead_score)}
                      <span className="font-medium text-white">{target.lead_score}</span>
                      {target.lead.is_dangerous && (
                        <ExclamationTriangleIconSolid className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedTargets.includes(target.id)}
                      onChange={() => toggleTargetSelection(target.id)}
                      className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                    />
                  </div>

                  <div className="mb-3">
                    <h3 className="font-medium text-white mb-1">
                      {target.lead.first_name} {target.lead.last_name}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {target.property.address}
                    </p>
                    <p className="text-sm text-gray-400">
                      {target.property.city}, {target.property.state}
                    </p>
                  </div>

                  <div className="mb-3">
                    {getStatusBadge(target.status)}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {target.lead.phone_cell && (
                        <a
                          href={`tel:${target.lead.phone_cell}`}
                          className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                        >
                          <PhoneIcon className="h-4 w-4" />
                        </a>
                      )}
                      {target.lead.email && (
                        <a
                          href={`mailto:${target.lead.email}`}
                          className="p-1 text-gray-400 hover:text-purple-400 transition-colors"
                        >
                          <EnvelopeIcon className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedTargetForMission(target);
                        setShowMissionModal(true);
                      }}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                    >
                      Create Mission
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mission Creation Modal */}
      {showMissionModal && selectedTargetForMission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Create Mission</h2>
            
            <div className="mb-4">
              <h3 className="font-medium text-white mb-2">Target Details</h3>
              <div className="text-sm text-gray-400 space-y-1">
                <div>{selectedTargetForMission.lead.first_name} {selectedTargetForMission.lead.last_name}</div>
                <div>{selectedTargetForMission.property.address}</div>
                <div>{selectedTargetForMission.property.city}, {selectedTargetForMission.property.state}</div>
                <div>Score: {selectedTargetForMission.lead_score}</div>
                {selectedTargetForMission.lead.is_dangerous && (
                  <div className="text-red-400">⚠️ Safety Concern</div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowMissionModal(false);
                  setSelectedTargetForMission(null);
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => createMission(selectedTargetForMission.id)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                Create Mission
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TargetsEnhanced;