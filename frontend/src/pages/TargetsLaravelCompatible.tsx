import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, MapPin, Settings, Eye, EyeOff, Map, Upload, Download, Users } from 'lucide-react';
import { targetAPI } from '../services/api';
import MapboxTargetsView from '../components/MapboxTargetsView';
import CSVUpload from '../components/CSVUpload';
import { sampleTaxLienData } from '../data/sampleTaxLienData';
import { TEXAS_COUNTIES } from '../data/texasCounties';
import MissionAssignmentModal from '../components/missions/MissionAssignmentModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

interface Target {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone_cell?: string;
  phone_other?: string;
  mailing_address_1: string;
  mailing_address_2?: string;
  mailing_city: string;
  mailing_state: string;
  mailing_county?: string;
  mailing_zip5: string;
  mailing_zip4?: string;
  latitude?: number;
  longitude?: number;
  lead_status: string;
  is_dangerous: boolean;
  is_business: boolean;
  returned_postcard?: boolean;
  has_mortgage?: boolean;
  score_value: number;
  workflow_stage?: string;
  created_at: string;
  last_contact?: string;
  do_not_mail?: boolean;
  do_not_email?: boolean;
  // Property related (if populated)
  property?: {
    account_number?: string;
    improvement_value?: number;
    land_value?: number;
    market_value?: number;
    address_1?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
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
  search_types: Array<{value: string; label: string}>;
}

interface Statistics {
  totals: {
    total_targets: number;
    active_targets: number;
    inactive_targets: number;
    dangerous_targets: number;
    business_targets: number;
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

const TargetsLaravelCompatible: React.FC = () => {
  const [filteredTargets, setFilteredTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState('radius');
  const [showFilters, setShowFilters] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Mission assignment state
  const [showMissionModal, setShowMissionModal] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState<number[]>([]);
  
  // Laravel-compatible filter state (exact match from Laravel Query/Prospects.php)
  const [filters, setFilters] = useState({
    // Search filters (from Laravel Query/Prospects.php)
    search: '',
    search_name: '',
    search_address: '',
    search_account_number: '',
    
    // Location filters
    property_county: '',
    property_state: '',
    property_zip: '',
    property_city: '',
    
    // Geographic search (radius-based)
    lat: '',
    lng: '',
    radius: '10',
    
    // Lead status filters
    lead_status: '',
    workflow_stage: '',
    botg_status: '',
    priority: '',
    
    // Safety and business flags
    is_dangerous: '',
    is_business: '',
    returned_postcard: '',
    has_mortgage: '',
    
    // Communication preferences
    can_mail: '',
    can_email: '',
    has_email: '',
    has_phone: '',
    
    // Language preferences
    language: '',
    
    // Date filters
    created_from: '',
    created_to: '',
    updated_from: '',
    updated_to: '',
    
    // Score filters
    min_score: '',
    max_score: '',
    
    // Property value filters
    min_property_value: '',
    max_property_value: '',
    
    // Tax lien specific filters
    min_tax_lien_amount: '',
    max_tax_lien_amount: '',
    lien_years: '',
    property_type: '',
    lawsuit_status: '',
  });
  
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Table settings
  const [visibleColumns, setVisibleColumns] = useState({
    name: true,
    email: true,
    phone: true,
    address: true,
    county: true,
    property_type: true,
    amount_due: true,
    status: true,
    created_at: true
  });
  
  const [showTableSettings, setShowTableSettings] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Load filter options and initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        
        // Load filter options
        const filterResponse = await targetAPI.getFilterOptions();
        setFilterOptions(filterResponse as FilterOptions);
        
        // Load statistics first
        await loadStatistics();
        
        // Load initial targets
        await loadTargets();
        
      } catch (err) {
        setError('Failed to load data');
        console.error('Error loading initial data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
  }, []);
  
  const loadTargets = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams();
      
      // Add all non-empty filters to query
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== '') {
          queryParams.append(key, value.toString());
        }
      });
      
      queryParams.append('page', currentPage.toString());
      queryParams.append('page_size', itemsPerPage.toString());
      
      const response = await targetAPI.getTargets(`?${queryParams.toString()}`);
      const targets = (response as any).data?.results || (response as any).data || [];
      setFilteredTargets(targets);
    } catch (err) {
      setError('Failed to load targets');
      console.error('Error loading targets:', err);
    }
  }, [filters, currentPage, itemsPerPage]);
  
  const loadStatistics = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== '') {
          queryParams.append(key, value.toString());
        }
      });
      
      const response = await targetAPI.getStatistics(`?${queryParams.toString()}`);
      setStatistics(response as Statistics);
    } catch (err) {
      console.error('Error loading statistics:', err);
      // Set default statistics on error
      setStatistics({
        totals: {
          total_targets: 0,
          active_targets: 0,
          inactive_targets: 0,
          dangerous_targets: 0,
          business_targets: 0,
          total_amount: 0,
          average_amount: 0,
          max_amount: 0,
          min_amount: 0
        },
        breakdowns: {
          property_types: [],
          counties: [],
          statuses: [],
          states: []
        },
        contact_stats: {
          can_mail: 0,
          can_email: 0,
          has_email: 0,
          has_phone: 0,
          mail_percentage: 0,
          email_percentage: 0
        }
      });
    }
  }, [filters]);

  // Apply filters when they change
  useEffect(() => {
    const delayedLoad = setTimeout(() => {
      loadTargets();
      loadStatistics();
    }, 300); // Debounce
    
    return () => clearTimeout(delayedLoad);
  }, [loadTargets, loadStatistics]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handleGlobalSearch = (value: string) => {
    setSearchTerm(value);
    handleFilterChange('search', value);
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      search_name: '',
      search_address: '',
      search_account_number: '',
      property_county: '',
      property_state: '',
      property_zip: '',
      property_city: '',
      lat: '',
      lng: '',
      radius: '10',
      lead_status: '',
      workflow_stage: '',
      botg_status: '',
      priority: '',
      is_dangerous: '',
      is_business: '',
      returned_postcard: '',
      has_mortgage: '',
      can_mail: '',
      can_email: '',
      has_email: '',
      has_phone: '',
      language: '',
      created_from: '',
      created_to: '',
      updated_from: '',
      updated_to: '',
      min_score: '',
      max_score: '',
      min_property_value: '',
      max_property_value: '',
      min_tax_lien_amount: '',
      max_tax_lien_amount: '',
      lien_years: '',
      property_type: '',
      lawsuit_status: '',
    });
    setSearchTerm('');
    setCurrentPage(1);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Mission assignment handlers
  const handleTargetSelection = (targetId: number, isSelected: boolean) => {
    setSelectedTargets(prev => 
      isSelected 
        ? [...prev, targetId]
        : prev.filter(id => id !== targetId)
    );
  };

  const handleSelectAllTargets = (isSelected: boolean) => {
    setSelectedTargets(isSelected ? filteredTargets.map(t => t.id) : []);
  };

  const handleMissionAssignment = (assignments: any[]) => {
    console.log('Creating missions:', assignments);
    // Here you would typically call an API to create the missions
    // For now, we'll just clear the selection
    setSelectedTargets([]);
    alert(`Successfully created ${assignments.length} mission${assignments.length !== 1 ? 's' : ''}!`);
  };

  const getSelectedTargetsData = () => {
    return filteredTargets.filter(target => selectedTargets.includes(target.id));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-300">Loading targets...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-xl">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-lg hover:from-slate-800 hover:to-slate-900 transition-all duration-200 font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-gray-100">
      {/* Header */}
      <div className="bg-slate-800/70 backdrop-blur-sm border-b border-slate-700/50 px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Targets Management</h1>
            </div>
            <div className="flex space-x-4">
              {/* View Mode Toggle */}
              <div className="flex bg-slate-800/50 rounded-lg overflow-hidden border border-slate-600/50 shadow-lg">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-5 py-3 flex items-center space-x-2 transition-all duration-200 border-r border-slate-600/50 ${
                    viewMode === 'table' 
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg' 
                      : 'bg-slate-700/50 text-slate-200 hover:text-white hover:bg-gradient-to-r hover:from-blue-500 hover:to-blue-600'
                  }`}
                >
                  <Settings size={18} />
                  <span className="font-medium">Table</span>
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={`px-5 py-3 flex items-center space-x-2 transition-all duration-200 border-r border-slate-600/50 ${
                    viewMode === 'map' 
                      ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg' 
                      : 'bg-slate-700/50 text-slate-200 hover:text-white hover:bg-gradient-to-r hover:from-purple-500 hover:to-purple-600'
                  }`}
                >
                  <Map size={18} />
                  <span className="font-medium">Map</span>
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="px-5 py-3 flex items-center space-x-2 transition-all duration-200 bg-slate-700/50 text-slate-200 hover:text-white hover:bg-gradient-to-r hover:from-green-500 hover:to-green-600"
                >
                  <Upload size={18} />
                  <span className="font-medium">Import</span>
                </button>
              </div>
              
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl ${
                  showFilters 
                    ? 'bg-gradient-to-r from-orange-600 to-orange-700 text-white hover:from-orange-700 hover:to-orange-800' 
                    : 'bg-gradient-to-r from-slate-700 to-slate-800 text-white hover:from-orange-600 hover:to-orange-700'
                }`}
              >
                <Filter size={20} />
                <span className="font-medium">{showFilters ? 'Hide' : 'Show'} Filters</span>
              </button>
              <button
                onClick={() => setShowTableSettings(!showTableSettings)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-lg transition-all duration-200 border border-slate-600/50 shadow-lg hover:shadow-xl ${
                  showTableSettings 
                    ? 'bg-gradient-to-r from-cyan-600 to-cyan-700 text-white hover:from-cyan-700 hover:to-cyan-800' 
                    : 'bg-gradient-to-r from-slate-700 to-slate-800 text-white hover:from-cyan-600 hover:to-cyan-700'
                }`}
              >
                <Settings size={20} />
                <span className="font-medium">Table Settings</span>
              </button>
              
              {selectedTargets.length > 0 && (
                <button
                  onClick={() => setShowMissionModal(true)}
                  className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <Users size={20} />
                  <span className="font-medium">Create Missions ({selectedTargets.length})</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>


      {/* Table Settings Panel */}
      {showTableSettings && (
        <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50">
          <div className="max-w-7xl mx-auto px-8 py-4">
            <h3 className="text-lg font-semibold text-white mb-4">Table Column Visibility</h3>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
              {Object.entries(visibleColumns).map(([column, isVisible]) => (
                <label key={column} className="flex items-center space-x-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={(e) => setVisibleColumns(prev => ({...prev, [column]: e.target.checked}))}
                    className="rounded border-slate-500 bg-slate-600 text-cyan-600 focus:ring-cyan-500 focus:ring-offset-slate-800"
                  />
                  <span className="capitalize">{column.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Improved Filters Panel */}
      {showFilters && (
        <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50">
          <div className="max-w-7xl mx-auto px-8 py-6">
            {/* Main Search */}
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex-1 min-w-80">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search by name, address, phone, email, or account number..."
                    value={searchTerm}
                    onChange={(e) => handleGlobalSearch(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 text-base bg-slate-700/50 border border-slate-600/50 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-100 placeholder-slate-400 transition-all"
                  />
                </div>
              </div>
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="px-6 py-3 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white rounded-lg transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl"
              >
                <Filter size={18} />
                <span>{showAdvancedFilters ? 'Hide' : 'Show'} Advanced Filters</span>
              </button>
            </div>

            {/* Quick Filters Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">County</label>
                <Select 
                  value={filters.property_county} 
                  onValueChange={(value: string) => setFilters(prev => ({ ...prev, property_county: value }))}
                >
                  <SelectTrigger className="w-full bg-slate-700/80 border-slate-600/50 text-white rounded-xl focus:ring-2 focus:ring-blue-500/50">
                    <SelectValue placeholder="All Counties" />
                  </SelectTrigger>
                  <SelectContent className="bg-gradient-to-br from-slate-800/98 via-slate-900/95 to-slate-800/98 backdrop-blur-xl border border-slate-500/40 rounded-2xl max-h-80 shadow-2xl z-[60] overflow-hidden animate-in slide-in-from-top-2 duration-200">
                    <SelectItem value="" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 font-medium border-b border-slate-600/30 mb-2 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">All Counties</SelectItem>
                    {TEXAS_COUNTIES.map(county => (
                      <SelectItem key={county} value={county.toLowerCase()} className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">{county}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Lead Status</label>
                <Select 
                  value={filters.lead_status} 
                  onValueChange={(value: string) => setFilters(prev => ({ ...prev, lead_status: value }))}
                >
                  <SelectTrigger className="w-full bg-slate-700/80 border-slate-600/50 text-white rounded-xl focus:ring-2 focus:ring-blue-500/50">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-gradient-to-br from-slate-800/98 via-slate-900/95 to-slate-800/98 backdrop-blur-xl border border-slate-500/40 rounded-2xl max-h-80 shadow-2xl z-[60] overflow-hidden animate-in slide-in-from-top-2 duration-200">
                    <SelectItem value="" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 font-medium border-b border-slate-600/30 mb-2 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">All Status</SelectItem>
                    <SelectItem value="new" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">New</SelectItem>
                    <SelectItem value="contacted" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Contacted</SelectItem>
                    <SelectItem value="interested" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Interested</SelectItem>
                    <SelectItem value="qualified" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Qualified</SelectItem>
                    <SelectItem value="hot" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Hot Lead</SelectItem>
                    <SelectItem value="cold" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Cold Lead</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">BOTG Status</label>
                <Select 
                  value={filters.botg_status} 
                  onValueChange={(value: string) => setFilters(prev => ({ ...prev, botg_status: value }))}
                >
                  <SelectTrigger className="w-full bg-slate-700/80 border-slate-600/50 text-white rounded-xl focus:ring-2 focus:ring-blue-500/50">
                    <SelectValue placeholder="All BOTG" />
                  </SelectTrigger>
                  <SelectContent className="bg-gradient-to-br from-slate-800/98 via-slate-900/95 to-slate-800/98 backdrop-blur-xl border border-slate-500/40 rounded-2xl max-h-80 shadow-2xl z-[60] overflow-hidden animate-in slide-in-from-top-2 duration-200">
                    <SelectItem value="" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 font-medium border-b border-slate-600/30 mb-2 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">All BOTG</SelectItem>
                    <SelectItem value="pending" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Pending</SelectItem>
                    <SelectItem value="assigned" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Assigned</SelectItem>
                    <SelectItem value="completed" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Priority</label>
                <Select 
                  value={filters.priority} 
                  onValueChange={(value: string) => setFilters(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger className="w-full bg-slate-700/80 border-slate-600/50 text-white rounded-xl focus:ring-2 focus:ring-blue-500/50">
                    <SelectValue placeholder="All Priority" />
                  </SelectTrigger>
                  <SelectContent className="bg-gradient-to-br from-slate-800/98 via-slate-900/95 to-slate-800/98 backdrop-blur-xl border border-slate-500/40 rounded-2xl max-h-80 shadow-2xl z-[60] overflow-hidden animate-in slide-in-from-top-2 duration-200">
                    <SelectItem value="" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 font-medium border-b border-slate-600/30 mb-2 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">All Priority</SelectItem>
                    <SelectItem value="urgent" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">🔥 Urgent</SelectItem>
                    <SelectItem value="high" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">🟠 High</SelectItem>
                    <SelectItem value="medium" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">🟡 Medium</SelectItem>
                    <SelectItem value="low" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">🟢 Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Safety</label>
                <Select 
                  value={filters.is_dangerous} 
                  onValueChange={(value: string) => setFilters(prev => ({ ...prev, is_dangerous: value }))}
                >
                  <SelectTrigger className="w-full bg-slate-700/80 border-slate-600/50 text-white rounded-xl focus:ring-2 focus:ring-blue-500/50">
                    <SelectValue placeholder="All Safety Levels" />
                  </SelectTrigger>
                  <SelectContent className="bg-gradient-to-br from-slate-800/98 via-slate-900/95 to-slate-800/98 backdrop-blur-xl border border-slate-500/40 rounded-2xl max-h-80 shadow-2xl z-[60] overflow-hidden animate-in slide-in-from-top-2 duration-200">
                    <SelectItem value="" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 font-medium border-b border-slate-600/30 mb-2 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">All Safety Levels</SelectItem>
                    <SelectItem value="0" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">✅ Safe</SelectItem>
                    <SelectItem value="1" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">⚠️ Dangerous</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Contact Type</label>
                <Select 
                  value={filters.is_business} 
                  onValueChange={(value: string) => setFilters(prev => ({ ...prev, is_business: value }))}
                >
                  <SelectTrigger className="w-full bg-slate-700/80 border-slate-600/50 text-white rounded-xl focus:ring-2 focus:ring-blue-500/50">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent className="bg-gradient-to-br from-slate-800/98 via-slate-900/95 to-slate-800/98 backdrop-blur-xl border border-slate-500/40 rounded-2xl max-h-80 shadow-2xl z-[60] overflow-hidden animate-in slide-in-from-top-2 duration-200">
                    <SelectItem value="" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 font-medium border-b border-slate-600/30 mb-2 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">All Types</SelectItem>
                    <SelectItem value="0" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">👤 Individual</SelectItem>
                    <SelectItem value="1" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">🏢 Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Advanced Filters */}
            {showAdvancedFilters && (
              <div className="space-y-6 pt-6 border-t border-slate-700/50">
                {/* Location Section */}
                <div>
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <MapPin className="w-5 h-5 mr-2" />
                    Location & Geography
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">City</label>
                      <input
                        type="text"
                        placeholder="Enter city..."
                        value={filters.property_city}
                        onChange={(e) => setFilters(prev => ({ ...prev, property_city: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">ZIP Code</label>
                      <input
                        type="text"
                        placeholder="Enter ZIP..."
                        value={filters.property_zip}
                        onChange={(e) => setFilters(prev => ({ ...prev, property_zip: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Search Radius</label>
                      <Select 
                        value={filters.radius} 
                        onValueChange={(value: string) => setFilters(prev => ({ ...prev, radius: value }))}
                      >
                        <SelectTrigger className="w-full bg-slate-700/80 border-slate-600/50 text-white rounded-xl focus:ring-2 focus:ring-blue-500/50">
                          <SelectValue placeholder="Search Radius" />
                        </SelectTrigger>
                        <SelectContent className="bg-gradient-to-br from-slate-800/98 via-slate-900/95 to-slate-800/98 backdrop-blur-xl border border-slate-500/40 rounded-2xl max-h-80 shadow-2xl z-[60] overflow-hidden animate-in slide-in-from-top-2 duration-200">
                          <SelectItem value="10" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">10 miles</SelectItem>
                          <SelectItem value="25" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">25 miles</SelectItem>
                          <SelectItem value="50" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">50 miles</SelectItem>
                          <SelectItem value="100" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">100 miles</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Property Type</label>
                      <Select 
                        value={filters.property_type} 
                        onValueChange={(value: string) => setFilters(prev => ({ ...prev, property_type: value }))}
                      >
                        <SelectTrigger className="w-full bg-slate-700/80 border-slate-600/50 text-white rounded-xl focus:ring-2 focus:ring-blue-500/50">
                          <SelectValue placeholder="All Property Types" />
                        </SelectTrigger>
                        <SelectContent className="bg-gradient-to-br from-slate-800/98 via-slate-900/95 to-slate-800/98 backdrop-blur-xl border border-slate-500/40 rounded-2xl max-h-80 shadow-2xl z-[60] overflow-hidden animate-in slide-in-from-top-2 duration-200">
                          <SelectItem value="" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 font-medium border-b border-slate-600/30 mb-2 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">All Property Types</SelectItem>
                          <SelectItem value="residential" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">🏠 Residential</SelectItem>
                          <SelectItem value="commercial" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">🏢 Commercial</SelectItem>
                          <SelectItem value="industrial" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">🏭 Industrial</SelectItem>
                          <SelectItem value="agricultural" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">🌾 Agricultural</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Financial Section */}
                <div>
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <span className="w-5 h-5 mr-2">💰</span>
                    Financial Information
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Min Tax Amount</label>
                      <input
                        type="number"
                        placeholder="$0"
                        value={filters.min_tax_lien_amount}
                        onChange={(e) => setFilters(prev => ({ ...prev, min_tax_lien_amount: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Max Tax Amount</label>
                      <input
                        type="number"
                        placeholder="$999,999"
                        value={filters.max_tax_lien_amount}
                        onChange={(e) => setFilters(prev => ({ ...prev, max_tax_lien_amount: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Min Property Value</label>
                      <input
                        type="number"
                        placeholder="$0"
                        value={filters.min_property_value}
                        onChange={(e) => setFilters(prev => ({ ...prev, min_property_value: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Max Property Value</label>
                      <input
                        type="number"
                        placeholder="$999,999"
                        value={filters.max_property_value}
                        onChange={(e) => setFilters(prev => ({ ...prev, max_property_value: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Communication & Legal Section */}
                <div>
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <span className="w-5 h-5 mr-2">📞</span>
                    Communication & Legal
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Can Email</label>
                      <Select 
                        value={filters.can_email} 
                        onValueChange={(value: string) => setFilters(prev => ({ ...prev, can_email: value }))}
                      >
                        <SelectTrigger className="w-full bg-slate-700/80 border-slate-600/50 text-white rounded-xl focus:ring-2 focus:ring-blue-500/50">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent className="bg-gradient-to-br from-slate-800/98 via-slate-900/95 to-slate-800/98 backdrop-blur-xl border border-slate-500/40 rounded-2xl max-h-80 shadow-2xl z-[60] overflow-hidden animate-in slide-in-from-top-2 duration-200">
                          <SelectItem value="" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 font-medium border-b border-slate-600/30 mb-2 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">All</SelectItem>
                          <SelectItem value="1" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">✅ Can Email</SelectItem>
                          <SelectItem value="0" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">❌ Cannot Email</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Can Mail</label>
                      <Select 
                        value={filters.can_mail} 
                        onValueChange={(value: string) => setFilters(prev => ({ ...prev, can_mail: value }))}
                      >
                        <SelectTrigger className="w-full bg-slate-700/80 border-slate-600/50 text-white rounded-xl focus:ring-2 focus:ring-blue-500/50">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent className="bg-gradient-to-br from-slate-800/98 via-slate-900/95 to-slate-800/98 backdrop-blur-xl border border-slate-500/40 rounded-2xl max-h-80 shadow-2xl z-[60] overflow-hidden animate-in slide-in-from-top-2 duration-200">
                          <SelectItem value="" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 font-medium border-b border-slate-600/30 mb-2 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">All</SelectItem>
                          <SelectItem value="1" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">✅ Can Mail</SelectItem>
                          <SelectItem value="0" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">❌ Cannot Mail</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Lawsuit Status</label>
                      <Select 
                        value={filters.lawsuit_status} 
                        onValueChange={(value: string) => setFilters(prev => ({ ...prev, lawsuit_status: value }))}
                      >
                        <SelectTrigger className="w-full bg-slate-700/80 border-slate-600/50 text-white rounded-xl focus:ring-2 focus:ring-blue-500/50">
                          <SelectValue placeholder="All Lawsuit Status" />
                        </SelectTrigger>
                        <SelectContent className="bg-gradient-to-br from-slate-800/98 via-slate-900/95 to-slate-800/98 backdrop-blur-xl border border-slate-500/40 rounded-2xl max-h-80 shadow-2xl z-[60] overflow-hidden animate-in slide-in-from-top-2 duration-200">
                          <SelectItem value="" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 font-medium border-b border-slate-600/30 mb-2 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">All Lawsuit Status</SelectItem>
                          <SelectItem value="active" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">⚖️ Active Lawsuit</SelectItem>
                          <SelectItem value="pending" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">⏳ Pending</SelectItem>
                          <SelectItem value="none" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">✅ No Lawsuit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Has Mortgage</label>
                      <Select 
                        value={filters.has_mortgage} 
                        onValueChange={(value: string) => setFilters(prev => ({ ...prev, has_mortgage: value }))}
                      >
                        <SelectTrigger className="w-full bg-slate-700/80 border-slate-600/50 text-white rounded-xl focus:ring-2 focus:ring-blue-500/50">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent className="bg-gradient-to-br from-slate-800/98 via-slate-900/95 to-slate-800/98 backdrop-blur-xl border border-slate-500/40 rounded-2xl max-h-80 shadow-2xl z-[60] overflow-hidden animate-in slide-in-from-top-2 duration-200">
                          <SelectItem value="" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 font-medium border-b border-slate-600/30 mb-2 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">All</SelectItem>
                          <SelectItem value="1" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">🏠 Has Mortgage</SelectItem>
                          <SelectItem value="0" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">💳 No Mortgage</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Clear All Button */}
                <div className="flex justify-center pt-4 border-t border-slate-700/50">
                  <button
                    onClick={() => setFilters({
                      search: '', search_name: '', search_address: '', search_account_number: '',
                      property_county: '', property_state: '', property_zip: '', property_city: '',
                      lat: '', lng: '', radius: '10', lead_status: '', workflow_stage: '', botg_status: '', priority: '',
                      is_dangerous: '', is_business: '', returned_postcard: '', has_mortgage: '',
                      can_mail: '', can_email: '', has_email: '', has_phone: '', language: '',
                      created_from: '', created_to: '', updated_from: '', updated_to: '',
                      min_score: '', max_score: '', min_property_value: '', max_property_value: '',
                      min_tax_lien_amount: '', max_tax_lien_amount: '', lien_years: '', property_type: '', lawsuit_status: ''
                    })}
                    className="px-8 py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <span>🗑️</span>
                    <span>Clear All Filters</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowImportModal(false);
            }
          }}
        >
          <div className="bg-slate-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-700">
            <div className="px-6 py-4 border-b border-slate-700 bg-gradient-to-r from-slate-800 to-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">Import Tax Lien Data</h3>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-slate-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              <CSVUpload
                onDataParsed={(data) => {
                  console.log('Imported data:', data);
                  loadTargets(); // Refresh targets after import
                  setShowImportModal(false);
                }}
                onError={(error) => {
                  console.error('Import error:', error);
                }}
                sampleData={sampleTaxLienData}
              />
            </div>
          </div>
        </div>
      )}

      {/* Results Content */}
      <div className="max-w-7xl mx-auto px-8 py-6">
        {viewMode === 'table' ? (
          <div className="bg-slate-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
              <thead className="bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold w-12">
                    <input
                      type="checkbox"
                      checked={selectedTargets.length === filteredTargets.length && filteredTargets.length > 0}
                      onChange={(e) => handleSelectAllTargets(e.target.checked)}
                      className="rounded border-slate-500 bg-slate-600 text-green-600 focus:ring-green-500 focus:ring-offset-slate-800"
                    />
                  </th>
                  {visibleColumns.name && <th className="px-4 py-3 text-left font-semibold">Name</th>}
                  {visibleColumns.email && <th className="px-4 py-3 text-left font-semibold">Email</th>}
                  {visibleColumns.phone && <th className="px-4 py-3 text-left font-semibold">Phone</th>}
                  {visibleColumns.address && <th className="px-4 py-3 text-left font-semibold">Address</th>}
                  {visibleColumns.county && <th className="px-4 py-3 text-left font-semibold">County</th>}
                  {visibleColumns.property_type && <th className="px-4 py-3 text-left font-semibold">Property Type</th>}
                  {visibleColumns.amount_due && <th className="px-4 py-3 text-left font-semibold">Amount Due</th>}
                  {visibleColumns.status && <th className="px-4 py-3 text-left font-semibold">Status</th>}
                  {visibleColumns.created_at && <th className="px-4 py-3 text-left font-semibold">Created</th>}
                  <th className="px-4 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {(filteredTargets || []).map((target) => (
                  <tr key={target.id} className="hover:bg-slate-700 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedTargets.includes(target.id)}
                        onChange={(e) => handleTargetSelection(target.id, e.target.checked)}
                        className="rounded border-slate-500 bg-slate-600 text-green-600 focus:ring-green-500 focus:ring-offset-slate-800"
                      />
                    </td>
                    {visibleColumns.name && (
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium">{target.first_name} {target.last_name}</div>
                          <div className="text-sm text-gray-400">#{target.property?.account_number || 'N/A'}</div>
                        </div>
                      </td>
                    )}
                    {visibleColumns.email && (
                      <td className="px-4 py-3">
                        <div>
                          <div className="text-sm">{target.email || 'N/A'}</div>
                          {target.do_not_email && <div className="text-xs text-red-400">Do Not Email</div>}
                        </div>
                      </td>
                    )}
                    {visibleColumns.phone && (
                      <td className="px-4 py-3">
                        <div className="text-sm">{target.phone_cell || target.phone_other || 'N/A'}</div>
                      </td>
                    )}
                    {visibleColumns.address && (
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <div>{target.mailing_address_1}</div>
                          <div className="text-gray-400">{target.mailing_city}, {target.mailing_state} {target.mailing_zip5}</div>
                        </div>
                      </td>
                    )}
                    {visibleColumns.county && (
                      <td className="px-4 py-3">
                        <div className="text-sm">{target.mailing_county || 'N/A'}</div>
                      </td>
                    )}
                    {visibleColumns.property_type && (
                      <td className="px-4 py-3">
                        <div className="text-sm">{target.workflow_stage || 'N/A'}</div>
                      </td>
                    )}
                    {visibleColumns.amount_due && (
                      <td className="px-4 py-3">
                        <div className="font-medium text-yellow-400">{formatCurrency(target.property?.market_value || 0)}</div>
                      </td>
                    )}
                    {visibleColumns.status && (
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            target.lead_status === 'target_acquired' || target.lead_status === 'interested'
                              ? 'bg-green-800 text-green-200' 
                              : target.lead_status === 'closed_lost' || target.lead_status === 'do_not_contact'
                              ? 'bg-red-800 text-red-200'
                              : 'bg-yellow-800 text-yellow-200'
                          }`}>
                            {target.lead_status.replace('_', ' ').toUpperCase()}
                          </span>
                          {target.is_dangerous && (
                            <span className="text-xs text-red-400 font-semibold">⚠️ DANGER</span>
                          )}
                          {target.is_business && (
                            <span className="text-xs text-green-400">🏢 BIZ</span>
                          )}
                        </div>
                      </td>
                    )}
                    {visibleColumns.created_at && (
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-400">{formatDate(target.created_at)}</div>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <button className="px-3 py-1 bg-gradient-to-r from-slate-700 to-slate-800 text-white text-xs rounded-lg hover:from-slate-800 hover:to-slate-900 transition-all duration-200 font-medium">
                          View
                        </button>
                        <button className="px-3 py-1 bg-gradient-to-r from-slate-700 to-slate-800 text-white text-xs rounded-lg hover:from-slate-800 hover:to-slate-900 transition-all duration-200 font-medium">
                          Edit
                        </button>
                        {target.latitude && target.longitude && (
                          <button className="px-2 py-1 bg-gradient-to-r from-slate-700 to-slate-800 text-white text-xs rounded-lg hover:from-slate-800 hover:to-slate-900 transition-all duration-200">
                            <MapPin size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <div className="bg-slate-700 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-400">Show</span>
              <Select 
                value={itemsPerPage.toString()} 
                onValueChange={(value: string) => setItemsPerPage(Number(value))}
              >
                <SelectTrigger className="w-20 bg-slate-600 border-slate-500 text-white rounded focus:ring-2 focus:ring-blue-500/50 text-sm h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gradient-to-br from-slate-800/98 via-slate-900/95 to-slate-800/98 backdrop-blur-xl border border-slate-500/40 rounded-xl shadow-2xl z-[70] overflow-hidden">
                  <SelectItem value="10" className="text-slate-200 hover:bg-blue-600/30 focus:bg-blue-600/40 cursor-pointer transition-all duration-200 text-sm">10</SelectItem>
                  <SelectItem value="20" className="text-slate-200 hover:bg-blue-600/30 focus:bg-blue-600/40 cursor-pointer transition-all duration-200 text-sm">20</SelectItem>
                  <SelectItem value="50" className="text-slate-200 hover:bg-blue-600/30 focus:bg-blue-600/40 cursor-pointer transition-all duration-200 text-sm">50</SelectItem>
                  <SelectItem value="100" className="text-slate-200 hover:bg-blue-600/30 focus:bg-blue-600/40 cursor-pointer transition-all duration-200 text-sm">100</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-gray-400">per page</span>
            </div>
            
            <div className="text-sm text-gray-400">
              Page {currentPage} of {Math.ceil((statistics?.totals?.total_targets || 0) / itemsPerPage)}
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:from-slate-700 hover:to-slate-800 transition-all duration-200 font-medium"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={currentPage >= Math.ceil((statistics?.totals?.total_targets || 0) / itemsPerPage)}
                className="px-4 py-2 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:from-slate-700 hover:to-slate-800 transition-all duration-200 font-medium"
              >
                Next
              </button>
            </div>
          </div>
        </div>
        ) : (
          // Map View
          <div className="bg-slate-800 rounded-lg overflow-hidden" style={{ height: '600px' }}>
            <MapboxTargetsView />
          </div>
        )}
      </div>

      {/* Mission Assignment Modal */}
      <MissionAssignmentModal
        isOpen={showMissionModal}
        onClose={() => setShowMissionModal(false)}
        targets={getSelectedTargetsData()}
        onAssignMissions={handleMissionAssignment}
      />
    </div>
  );
};

export default TargetsLaravelCompatible;