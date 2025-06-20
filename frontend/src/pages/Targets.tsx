import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MapIcon, 
  AdjustmentsHorizontalIcon, 
  FunnelIcon,
  ViewColumnsIcon,
  MapPinIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  PhoneIcon,
  EnvelopeIcon,
  BuildingOfficeIcon,
  UserIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  DocumentTextIcon,
  ClipboardDocumentCheckIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  StarIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import {
  StarIcon as StarIconSolid,
  ExclamationTriangleIcon as ExclamationTriangleIconSolid
} from '@heroicons/react/24/solid';
import { apiClient, propertyService } from '../services/api';

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
  created_at: string;
  updated_at: string;
}

interface Target {
  id: number;
  property_id: number;
  lead_id: number;
  status: string;
  priority: string;
  lead_score: number;
  property: Property;
  lead: Lead;
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
  soldier_name: string;
  status: string;
  mission_type: string;
  scheduled_date: string;
  completed_date?: string;
  notes: string;
}

interface Opportunity {
  id: number;
  prospect_id: number;
  type: string;
  amount: number;
  status: string;
  assignee: string;
  created_at: string;
}

interface HeatMapPin {
  lat: number;
  lng: number;
  weight: number;
}

const Targets: React.FC = () => {
  // State management
  const [targets, setTargets] = useState<Target[]>([]);
  const [filteredTargets, setFilteredTargets] = useState<Target[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTargets, setSelectedTargets] = useState<number[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<Target | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'view' | 'edit' | 'create' | 'actions' | 'mission' | 'opportunity'>('view');
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [countyFilter, setCountyFilter] = useState('All');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('All');
  const [leadStatusFilter, setLeadStatusFilter] = useState('All');
  
  // Sort states
  const [sortField, setSortField] = useState('lead_score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // View states
  const [currentView, setCurrentView] = useState<'grid' | 'heatmap' | 'map'>('grid');
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Heat map states
  const mapCanvasRef = useRef<HTMLCanvasElement>(null);
  const [heatmapData, setHeatmapData] = useState<HeatMapPin[]>([]);
  const [mapCenter, setMapCenter] = useState({ lat: 29.282045, lng: -98.602588 });
  const [mapZoom, setMapZoom] = useState(10);

  // Statistics
  const [stats, setStats] = useState({
    totalTargets: 0,
    activeTargets: 0,
    highPriority: 0,
    newLeads: 0,
    inProgress: 0,
    opportunities: 0,
    totalValue: 0,
    avgLeadScore: 0
  });

  // Load targets data
  const loadTargets = async () => {
    setIsLoading(true);
    try {
      // Load properties and create targets
      const propsResponse = await propertyService.getProperties({ limit: 1000 });
      
      const properties = propsResponse.results || [];
      
      // Create mock targets from properties
      const mockTargets: Target[] = properties.map((prop: Property, index: number) => ({
        id: prop.id,
        property_id: prop.id,
        lead_id: prop.id,
        status: ['New', 'Contacted', 'Interested', 'Not Interested', 'Follow Up'][Math.floor(Math.random() * 5)],
        priority: ['Low', 'Medium', 'High', 'Critical'][Math.floor(Math.random() * 4)],
        lead_score: Math.floor(Math.random() * 100) + 1,
        property: prop,
        lead: {
          id: prop.id,
          first_name: ['John', 'Jane', 'Bob', 'Alice', 'Mike', 'Sarah'][Math.floor(Math.random() * 6)],
          last_name: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia'][Math.floor(Math.random() * 6)],
          email: `owner${prop.id}@example.com`,
          phone_cell: `(${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
          language_preference: Math.random() > 0.8 ? 'Spanish' : 'English',
          lead_status: ['qualified', 'unqualified', 'contacted', 'new'][Math.floor(Math.random() * 4)],
          do_not_contact: Math.random() > 0.9,
          created_at: prop.created_at,
          updated_at: prop.updated_at
        },
        contact_attempts: Math.floor(Math.random() * 5),
        assigned_to: ['Agent Smith', 'Agent Johnson', 'Agent Brown'][Math.floor(Math.random() * 3)],
        tags: Math.random() > 0.5 ? ['High Value', 'Foreclosure'] : ['Standard'],
        created_at: prop.created_at,
        updated_at: prop.updated_at
      }));
      
      setTargets(mockTargets);
      setFilteredTargets(mockTargets);
      calculateStats(mockTargets);
      
    } catch (error) {
      console.error('Error loading targets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load heat map data
  const loadHeatmapData = async () => {
    try {
      const response = await propertyService.getProperties({
        lat: mapCenter.lat,
        lng: mapCenter.lng,
        limit: 100
      });
      setHeatmapData(response.results || []);
    } catch (error) {
      console.error('Error loading heat map data:', error);
    }
  };

  // Calculate statistics
  const calculateStats = (targetList: Target[]) => {
    const stats = {
      totalTargets: targetList.length,
      activeTargets: targetList.filter(t => t.status !== 'Not Interested' && t.status !== 'Closed').length,
      highPriority: targetList.filter(t => t.priority === 'High' || t.priority === 'Critical').length,
      newLeads: targetList.filter(t => t.status === 'New').length,
      inProgress: targetList.filter(t => t.status === 'Contacted' || t.status === 'Follow Up').length,
      opportunities: targetList.filter(t => t.status === 'Interested').length,
      totalValue: targetList.reduce((sum, t) => sum + t.property.property_value, 0),
      avgLeadScore: targetList.length > 0 ? targetList.reduce((sum, t) => sum + t.lead_score, 0) / targetList.length : 0
    };
    setStats(stats);
  };

  // Filter and search targets
  useEffect(() => {
    let filtered = [...targets];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(target =>
        target.lead.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        target.lead.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        target.property.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        target.property.county.toLowerCase().includes(searchTerm.toLowerCase()) ||
        target.property.account_number.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'All') {
      filtered = filtered.filter(target => target.status === statusFilter);
    }

    // Apply priority filter
    if (priorityFilter !== 'All') {
      filtered = filtered.filter(target => target.priority === priorityFilter);
    }

    // Apply county filter
    if (countyFilter !== 'All') {
      filtered = filtered.filter(target => target.property.county === countyFilter);
    }

    // Apply property type filter
    if (propertyTypeFilter !== 'All') {
      filtered = filtered.filter(target => target.property.property_type === propertyTypeFilter);
    }

    // Apply lead status filter
    if (leadStatusFilter !== 'All') {
      filtered = filtered.filter(target => target.lead.lead_status === leadStatusFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortField as keyof Target];
      let bValue: any = b[sortField as keyof Target];

      // Handle nested properties
      if (sortField === 'property_value') {
        aValue = a.property.property_value;
        bValue = b.property.property_value;
      } else if (sortField === 'lead_name') {
        aValue = `${a.lead.first_name} ${a.lead.last_name}`;
        bValue = `${b.lead.first_name} ${b.lead.last_name}`;
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    setFilteredTargets(filtered);
    calculateStats(filtered);
  }, [targets, searchTerm, statusFilter, priorityFilter, countyFilter, propertyTypeFilter, leadStatusFilter, sortField, sortDirection]);

  // Initialize data
  useEffect(() => {
    loadTargets();
    loadHeatmapData();
  }, []);

  // Helper functions
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      'New': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      'Contacted': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      'Interested': 'bg-green-500/20 text-green-300 border-green-500/30',
      'Not Interested': 'bg-red-500/20 text-red-300 border-red-500/30',
      'Closed': 'bg-gray-500/20 text-gray-300 border-gray-500/30',
      'Follow Up': 'bg-purple-500/20 text-purple-300 border-purple-500/30'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusClasses[status as keyof typeof statusClasses]}`}>
        {status}
      </span>
    );
  };

  const getPriorityIcon = (priority: string) => {
    if (priority === 'Critical') {
      return <ExclamationTriangleIconSolid className="h-4 w-4 text-red-400" />;
    } else if (priority === 'High') {
      return <StarIconSolid className="h-4 w-4 text-yellow-400" />;
    } else if (priority === 'Medium') {
      return <StarIcon className="h-4 w-4 text-blue-400" />;
    }
    return <div className="h-4 w-4" />;
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleSelectTarget = (targetId: number) => {
    setSelectedTargets(prev => 
      prev.includes(targetId) 
        ? prev.filter(id => id !== targetId)
        : [...prev, targetId]
    );
  };

  const handleSelectAll = () => {
    if (selectedTargets.length === filteredTargets.length) {
      setSelectedTargets([]);
    } else {
      setSelectedTargets(filteredTargets.map(t => t.id));
    }
  };

  const openModal = (type: typeof modalType, target?: Target) => {
    setModalType(type);
    setSelectedTarget(target || null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedTarget(null);
  };

  // Pagination
  const paginatedTargets = filteredTargets.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalPages = Math.ceil(filteredTargets.length / pageSize);

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-6 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <MapIcon className="h-8 w-8 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Targets</h1>
              <p className="text-gray-400">Property Management & Lead Conversion</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* View Switcher */}
          <div className="flex bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setCurrentView('grid')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                currentView === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-600'
              }`}
            >
              <ViewColumnsIcon className="h-4 w-4 inline mr-1" />
              Grid
            </button>
            <button
              onClick={() => setCurrentView('heatmap')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                currentView === 'heatmap'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-600'
              }`}
            >
              <MapIcon className="h-4 w-4 inline mr-1" />
              Heat Map
            </button>
          </div>
          
          <button
            onClick={() => openModal('create')}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            <span>Add Target</span>
          </button>
          
          {selectedTargets.length > 0 && (
            <button
              onClick={() => openModal('actions')}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <ClipboardDocumentCheckIcon className="h-4 w-4" />
              <span>Actions ({selectedTargets.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Statistics Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-800 border-b border-gray-700">
        <div className="grid grid-cols-4 md:grid-cols-8 gap-6">
          <div className="text-center">
            <div className="text-xl font-bold text-blue-400">{stats.totalTargets}</div>
            <div className="text-xs text-gray-400">Total</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-green-400">{stats.activeTargets}</div>
            <div className="text-xs text-gray-400">Active</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-red-400">{stats.highPriority}</div>
            <div className="text-xs text-gray-400">High Priority</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-yellow-400">{stats.newLeads}</div>
            <div className="text-xs text-gray-400">New</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-purple-400">{stats.inProgress}</div>
            <div className="text-xs text-gray-400">In Progress</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-indigo-400">{stats.opportunities}</div>
            <div className="text-xs text-gray-400">Opportunities</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-emerald-400">{formatCurrency(stats.totalValue / 1000000)}M</div>
            <div className="text-xs text-gray-400">Total Value</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-cyan-400">{stats.avgLeadScore.toFixed(0)}</div>
            <div className="text-xs text-gray-400">Avg Score</div>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <button 
            onClick={loadTargets}
            className="flex items-center space-x-2 px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            disabled={isLoading}
          >
            <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="p-6 bg-gray-800 border-b border-gray-700">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row flex-1 gap-4 items-start sm:items-center w-full lg:w-auto">
            <div className="relative flex-1 max-w-lg w-full">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search targets by name, address, county, or account..."
                className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors border border-gray-600"
            >
              <FunnelIcon className="h-5 w-5" />
              <span>Filters</span>
              {showFilters ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
            
            <div className="text-sm text-gray-300">
              {filteredTargets.length} targets
            </div>
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                <select
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="All">All Statuses</option>
                  <option value="New">New</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Interested">Interested</option>
                  <option value="Not Interested">Not Interested</option>
                  <option value="Follow Up">Follow Up</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Priority</label>
                <select
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                >
                  <option value="All">All Priorities</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">County</label>
                <select
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={countyFilter}
                  onChange={(e) => setCountyFilter(e.target.value)}
                >
                  <option value="All">All Counties</option>
                  <option value="Bexar">Bexar</option>
                  <option value="Harris">Harris</option>
                  <option value="Travis">Travis</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Property Type</label>
                <select
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={propertyTypeFilter}
                  onChange={(e) => setPropertyTypeFilter(e.target.value)}
                >
                  <option value="All">All Types</option>
                  <option value="Single Family">Single Family</option>
                  <option value="Condo">Condo</option>
                  <option value="Townhouse">Townhouse</option>
                  <option value="Multi-Family">Multi-Family</option>
                  <option value="Commercial">Commercial</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Sort By</label>
                <select
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value)}
                >
                  <option value="lead_score">Lead Score</option>
                  <option value="lead_name">Name</option>
                  <option value="property_value">Property Value</option>
                  <option value="tax_amount_due">Tax Amount</option>
                  <option value="created_at">Date Added</option>
                  <option value="status">Status</option>
                  <option value="priority">Priority</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {currentView === 'grid' ? (
          /* Grid View */
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-300 uppercase bg-gray-700">
                  <tr>
                    <th className="p-4">
                      <input
                        type="checkbox"
                        checked={filteredTargets.length > 0 && selectedTargets.length === filteredTargets.length}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                      />
                    </th>
                    <th 
                      className="px-6 py-3 cursor-pointer hover:bg-gray-600"
                      onClick={() => handleSort('lead_score')}
                    >
                      Score {sortField === 'lead_score' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 cursor-pointer hover:bg-gray-600"
                      onClick={() => handleSort('lead_name')}
                    >
                      Lead Info {sortField === 'lead_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3">Property</th>
                    <th className="px-6 py-3">Contact</th>
                    <th 
                      className="px-6 py-3 cursor-pointer hover:bg-gray-600"
                      onClick={() => handleSort('status')}
                    >
                      Status {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 cursor-pointer hover:bg-gray-600"
                      onClick={() => handleSort('priority')}
                    >
                      Priority {sortField === 'priority' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3">Financial</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center">
                          <ArrowPathIcon className="h-8 w-8 text-blue-500 animate-spin mb-2" />
                          <span className="text-gray-400">Loading targets...</span>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedTargets.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-gray-400">
                        No targets found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedTargets.map((target) => (
                      <tr key={target.id} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-750">
                        <td className="p-4">
                          <input
                            type="checkbox"
                            checked={selectedTargets.includes(target.id)}
                            onChange={() => handleSelectTarget(target.id)}
                            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-white">{target.lead_score}</div>
                            <div className="text-xs text-gray-400">Score</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2">
                              {getPriorityIcon(target.priority)}
                              <UserIcon className="h-8 w-8 text-gray-400 bg-gray-700 rounded-full p-1" />
                            </div>
                            <div>
                              <div className="font-semibold text-white">
                                {target.lead.first_name} {target.lead.last_name}
                              </div>
                              <div className="text-sm text-gray-400">
                                ID: {target.id} • {target.lead.language_preference}
                              </div>
                              {target.tags && target.tags.length > 0 && (
                                <div className="flex gap-1 mt-1">
                                  {target.tags.slice(0, 2).map((tag, index) => (
                                    <span key={index} className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-white">{target.property.property_type}</div>
                            <div className="text-sm text-gray-300">{formatCurrency(target.property.property_value)}</div>
                            <div className="text-xs text-gray-400">
                              <MapPinIcon className="h-3 w-3 inline mr-1" />
                              {target.property.address}, {target.property.city}
                            </div>
                            <div className="text-xs text-gray-400">
                              Account: {target.property.account_number}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="text-sm text-gray-300 flex items-center gap-1">
                              <EnvelopeIcon className="h-3 w-3" />
                              {target.lead.email}
                            </div>
                            <div className="text-sm text-gray-300 flex items-center gap-1">
                              <PhoneIcon className="h-3 w-3" />
                              {target.lead.phone_cell}
                            </div>
                            <div className="text-xs text-gray-400">
                              Attempts: {target.contact_attempts}
                            </div>
                            {target.lead.do_not_contact && (
                              <div className="text-xs text-red-400">Do Not Contact</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(target.status)}
                          <div className="text-xs text-gray-400 mt-1">
                            {target.assigned_to}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            {getPriorityIcon(target.priority)}
                            <span className="text-sm text-gray-300">{target.priority}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-white">
                              {formatCurrency(target.property.tax_amount_due)}
                            </div>
                            <div className="text-xs text-gray-400">Tax Due</div>
                            {target.property.in_foreclosure && (
                              <div className="text-xs text-red-400 mt-1">In Foreclosure</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-1">
                            <button
                              onClick={() => openModal('view', target)}
                              className="p-2 rounded hover:bg-blue-500/20 text-blue-400 transition-colors"
                              title="View Details"
                            >
                              <EyeIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openModal('edit', target)}
                              className="p-2 rounded hover:bg-yellow-500/20 text-yellow-400 transition-colors"
                              title="Edit Target"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openModal('mission', target)}
                              className="p-2 rounded hover:bg-green-500/20 text-green-400 transition-colors"
                              title="Create Mission"
                            >
                              <ClockIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openModal('opportunity', target)}
                              className="p-2 rounded hover:bg-purple-500/20 text-purple-400 transition-colors"
                              title="Create Opportunity"
                            >
                              <BanknotesIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 bg-gray-800 border-t border-gray-700">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-gray-400">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                <div className="text-sm text-gray-400">
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredTargets.length)} of {filteredTargets.length} results
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Heat Map View */
          <div className="h-full relative">
            <canvas 
              ref={mapCanvasRef}
              className="w-full h-full"
              style={{ background: '#1f2937' }}
            />
            {/* Heat map controls and legend would go here */}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">
                {modalType === 'view' && 'Target Details'}
                {modalType === 'edit' && 'Edit Target'}
                {modalType === 'create' && 'Create New Target'}
                {modalType === 'actions' && 'Bulk Actions'}
                {modalType === 'mission' && 'Create Mission'}
                {modalType === 'opportunity' && 'Create Opportunity'}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="p-6">
              {modalType === 'view' && selectedTarget && (
                <div className="space-y-6">
                  {/* Lead Information */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Lead Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300">Name</label>
                        <p className="text-white">{selectedTarget.lead.first_name} {selectedTarget.lead.last_name}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300">Email</label>
                        <p className="text-white">{selectedTarget.lead.email}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300">Phone</label>
                        <p className="text-white">{selectedTarget.lead.phone_cell}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300">Language</label>
                        <p className="text-white">{selectedTarget.lead.language_preference}</p>
                      </div>
                    </div>
                  </div>

                  {/* Property Information */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Property Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300">Address</label>
                        <p className="text-white">{selectedTarget.property.address}, {selectedTarget.property.city}, {selectedTarget.property.state} {selectedTarget.property.zip_code}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300">Property Type</label>
                        <p className="text-white">{selectedTarget.property.property_type}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300">Property Value</label>
                        <p className="text-white">{formatCurrency(selectedTarget.property.property_value)}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300">Tax Amount Due</label>
                        <p className="text-white">{formatCurrency(selectedTarget.property.tax_amount_due)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Target Status */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Target Status</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300">Status</label>
                        {getStatusBadge(selectedTarget.status)}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300">Priority</label>
                        <div className="flex items-center gap-1">
                          {getPriorityIcon(selectedTarget.priority)}
                          <span className="text-white">{selectedTarget.priority}</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300">Lead Score</label>
                        <p className="text-white text-xl font-bold">{selectedTarget.lead_score}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300">Assigned To</label>
                        <p className="text-white">{selectedTarget.assigned_to}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {modalType === 'actions' && selectedTargets.length > 0 && (
                <div className="space-y-4">
                  <p className="text-gray-300">Select an action for {selectedTargets.length} target(s):</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button className="p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                      Send Email Campaign
                    </button>
                    <button className="p-4 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
                      Create Missions
                    </button>
                    <button className="p-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
                      Update Status
                    </button>
                    <button className="p-4 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors">
                      Assign to Agent
                    </button>
                    <button className="p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
                      Export Data
                    </button>
                    <button className="p-4 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
                      Mark Do Not Contact
                    </button>
                  </div>
                </div>
              )}

              {(modalType === 'create' || modalType === 'edit' || modalType === 'mission' || modalType === 'opportunity') && (
                <div className="text-gray-300">
                  <p>Form for {modalType} will be implemented here.</p>
                </div>
              )}
            </div>
            
            <div className="flex gap-3 p-6 border-t border-gray-700 justify-end">
              <button onClick={closeModal} className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors">
                Close
              </button>
              {modalType !== 'view' && (
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  {modalType === 'create' ? 'Create' : 'Save'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Targets;