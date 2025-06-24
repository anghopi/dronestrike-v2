import React, { useState, useEffect } from 'react';
import { 
  MagnifyingGlassIcon,
  ArrowPathIcon,
  DocumentArrowDownIcon,
  FunnelIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  CalendarIcon,
  AdjustmentsHorizontalIcon,
  ExclamationTriangleIcon,
  BuildingOfficeIcon,
  HomeIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { apiClient } from '../services/api';

interface Prospect {
  id: number;
  lead_full_name: string;
  property_address: string;
  property_county: string;
  property_account_number: string;
  property_date: string;
  is_active: boolean;
  lead_id: number;
  property_id: number;
  created_at: string;
  updated_at: string;
  score_value: number;
  lead_status: string;
  is_dangerous: boolean;
  is_business: boolean;
  mailing_city: string;
  mailing_state: string;
  mailing_zip5: string;
  phone_cell?: string;
  email?: string;
}

interface FilterOptions {
  counties: string[];
  zip_codes: string[];
  states: string[];
  cities: string[];
  lead_statuses: string[];
  property_types: Array<{value: string; label: string}>;
  score_ranges: Array<{value: string; label: string}>;
}

interface AdvancedFilters {
  // Search filters
  search: string;
  search_name: string;
  search_address: string;
  search_account_number: string;
  
  // Location filters
  property_state: string;
  property_city: string;
  property_zip: string;
  
  // Status filters
  is_active: string;
  lead_status: string;
  
  // Date filters
  created_at_from: string;
  created_at_to: string;
  
  // Property filters
  property_type: string;
  exclude_dangerous: boolean;
  exclude_business: boolean;
  exclude_do_not_contact: boolean;
  
  // Score filters
  score_min: string;
  score_max: string;
}

const TargetsAdvanced: React.FC = () => {
  // Data state
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [statistics, setStatistics] = useState<any>(null);
  
  // UI state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Basic filters (Laravel compatibility)
  const [searchText, setSearchText] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState<string>('0'); // 0=All, 1=Active, 0=Expired
  
  // Advanced filters
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    search: '',
    search_name: '',
    search_address: '',
    search_account_number: '',
    property_state: '',
    property_city: '',
    property_zip: '',
    is_active: '0',
    lead_status: '',
    created_at_from: '',
    created_at_to: '',
    property_type: '',
    exclude_dangerous: false,
    exclude_business: false,
    exclude_do_not_contact: false,
    score_min: '',
    score_max: ''
  });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  // Sorting state
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    loadFilterOptions();
    loadStatistics();
  }, []);

  useEffect(() => {
    fetchProspects();
  }, [currentPage, perPage, searchText, isActiveFilter, sortField, sortDirection, advancedFilters]);

  const loadFilterOptions = async () => {
    try {
      const response = await apiClient.get('/api/leads/filter_options/') as any;
      setFilterOptions(response.data);
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await apiClient.get('/api/leads/statistics/') as any;
      setStatistics(response.data);
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  const fetchProspects = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Build query parameters with all filters
      const params = new URLSearchParams({
        page: currentPage.toString(),
        per_page: perPage.toString(),
        sort_field: sortField,
        sort_direction: sortDirection,
      });

      // Add basic search
      if (searchText.trim()) {
        params.append('search', searchText.trim());
      }

      // Add active status filter
      if (isActiveFilter !== '0') {
        params.append('is_active', isActiveFilter);
      }

      // Add all advanced filters
      Object.entries(advancedFilters).forEach(([key, value]) => {
        if (value && value !== '' && value !== false) {
          if (typeof value === 'boolean') {
            params.append(key, 'true');
          } else {
            params.append(key, value.toString());
          }
        }
      });

      const response = await apiClient.get(`/api/leads/?${params.toString()}`) as any;
      
      // Transform leads to match Laravel prospect structure
      const transformedProspects: Prospect[] = response.data.results.map((lead: any) => ({
        id: lead.id,
        lead_full_name: `${lead.first_name} ${lead.last_name}`.trim(),
        property_address: `${lead.mailing_address_1}, ${lead.mailing_city}, ${lead.mailing_state} ${lead.mailing_zip5}`,
        property_county: 'N/A', // No county field in current model
        property_account_number: lead.account_number || 'N/A',
        property_date: lead.created_at ? new Date(lead.created_at).toLocaleDateString() : 'N/A',
        is_active: lead.lead_status !== 'dead' && lead.lead_status !== 'converted',
        lead_id: lead.id,
        property_id: lead.id,
        created_at: lead.created_at,
        updated_at: lead.updated_at,
        score_value: lead.score_value || 0,
        lead_status: lead.lead_status,
        is_dangerous: lead.is_dangerous,
        is_business: lead.is_business,
        mailing_city: lead.mailing_city,
        mailing_state: lead.mailing_state,
        mailing_zip5: lead.mailing_zip5,
        phone_cell: lead.phone_cell,
        email: lead.email
      }));
      
      setProspects(transformedProspects);
      setTotalItems(response.data.count || transformedProspects.length);
      setTotalPages(Math.ceil((response.data.count || transformedProspects.length) / perPage));
      
    } catch (error: any) {
      console.error('Error fetching prospects:', error);
      setError('Failed to load prospects. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchProspects();
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const handlePageSizeChange = (newPerPage: number) => {
    setPerPage(newPerPage);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(Math.max(1, Math.min(totalPages, newPage)));
  };

  const handleAdvancedFilterChange = (key: keyof AdvancedFilters, value: any) => {
    setAdvancedFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setSearchText('');
    setIsActiveFilter('0');
    setAdvancedFilters({
      search: '',
      search_name: '',
      search_address: '',
      search_account_number: '',
      property_state: '',
      property_city: '',
      property_zip: '',
      is_active: '0',
      lead_status: '',
      created_at_from: '',
      created_at_to: '',
      property_type: '',
      exclude_dangerous: false,
      exclude_business: false,
      exclude_do_not_contact: false,
      score_min: '',
      score_max: ''
    });
    setCurrentPage(1);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (searchText) count++;
    if (isActiveFilter !== '0') count++;
    Object.values(advancedFilters).forEach(value => {
      if (value && value !== '' && value !== false && value !== '0') count++;
    });
    return count;
  };

  const exportToCsv = () => {
    const headers = ['ID', 'Name', 'Property Address', 'County', 'Account', 'Date', 'BOTG Status', 'Score', 'Status', 'Phone', 'Email'];
    const csvData = prospects.map(prospect => [
      prospect.id,
      prospect.lead_full_name,
      prospect.property_address,
      prospect.property_county,
      prospect.property_account_number,
      prospect.property_date,
      prospect.is_active ? 'Active' : 'Expired',
      prospect.score_value,
      prospect.lead_status,
      prospect.phone_cell || '',
      prospect.email || ''
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prospects.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    if (score >= 25) return 'text-orange-600';
    return 'text-red-600';
  };

  const startIndex = (currentPage - 1) * perPage + 1;
  const endIndex = Math.min(currentPage * perPage, totalItems);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Statistics Bar */}
      {statistics && (
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{statistics.total_prospects}</div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{statistics.active_prospects}</div>
              <div className="text-sm text-gray-600">Active</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{statistics.expired_prospects}</div>
              <div className="text-sm text-gray-600">Expired</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{statistics.high_score_prospects}</div>
              <div className="text-sm text-gray-600">High Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{statistics.business_prospects}</div>
              <div className="text-sm text-gray-600">Business</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{statistics.dangerous_prospects}</div>
              <div className="text-sm text-gray-600">Dangerous</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600">{Math.round(statistics.average_score)}</div>
              <div className="text-sm text-gray-600">Avg Score</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters Container */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex justify-start items-center space-x-6 mb-4">
          {/* Basic Search */}
          <div className="flex items-center space-x-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search Prospect"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleSearch}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              >
                <MagnifyingGlassIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* BOTG Status Filter */}
          {searchText && (
            <div className="flex items-center">
              <div className="inline-flex rounded-md shadow-sm" role="group">
                {[
                  { value: '0', label: 'All' },
                  { value: '1', label: 'Active' },
                  { value: '0', label: 'Expired' }
                ].map((option, index) => (
                  <button
                    key={option.value + index}
                    onClick={() => setIsActiveFilter(option.value)}
                    className={`px-4 py-2 text-sm font-medium border ${
                      (isActiveFilter === option.value && !(option.label === 'Expired' && isActiveFilter === '0' && index === 2)) ||
                      (option.label === 'Expired' && isActiveFilter === '0' && index === 2)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    } ${
                      index === 0 ? 'rounded-l-md' : 
                      index === 2 ? 'rounded-r-md' : 
                      '-ml-px'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Advanced Filters Toggle */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md border transition-colors ${
              showAdvancedFilters
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FunnelIcon className="h-4 w-4" />
            <span>Advanced Filters</span>
            {getActiveFilterCount() > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[1.25rem] text-center">
                {getActiveFilterCount()}
              </span>
            )}
            <ChevronDownIcon className={`h-4 w-4 transform transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
          </button>

          {/* Clear All Filters */}
          {getActiveFilterCount() > 0 && (
            <button
              onClick={clearAllFilters}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <XMarkIcon className="h-4 w-4" />
              <span>Clear All</span>
            </button>
          )}
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && filterOptions && (
          <div className="border-t border-gray-200 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* Search Filters */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 flex items-center">
                  <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
                  Search Filters
                </h4>
                <input
                  type="text"
                  placeholder="Search by name"
                  value={advancedFilters.search_name}
                  onChange={(e) => handleAdvancedFilterChange('search_name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Search by address"
                  value={advancedFilters.search_address}
                  onChange={(e) => handleAdvancedFilterChange('search_address', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Search by account #"
                  value={advancedFilters.search_account_number}
                  onChange={(e) => handleAdvancedFilterChange('search_account_number', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Location Filters */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 flex items-center">
                  <HomeIcon className="h-4 w-4 mr-2" />
                  Location Filters
                </h4>
                <select
                  value={advancedFilters.property_state}
                  onChange={(e) => handleAdvancedFilterChange('property_state', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All States</option>
                  {filterOptions.states.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
                <select
                  value={advancedFilters.property_zip}
                  onChange={(e) => handleAdvancedFilterChange('property_zip', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All ZIP Codes</option>
                  {filterOptions.zip_codes?.map(zip => (
                    <option key={zip} value={zip}>{zip}</option>
                  ))}
                </select>
                <select
                  value={advancedFilters.property_city}
                  onChange={(e) => handleAdvancedFilterChange('property_city', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Cities</option>
                  {filterOptions.cities.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="ZIP Code"
                  value={advancedFilters.property_zip}
                  onChange={(e) => handleAdvancedFilterChange('property_zip', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Property & Lead Filters */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 flex items-center">
                  <BuildingOfficeIcon className="h-4 w-4 mr-2" />
                  Property & Lead
                </h4>
                <select
                  value={advancedFilters.property_type}
                  onChange={(e) => handleAdvancedFilterChange('property_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Property Types</option>
                  {filterOptions.property_types.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                <select
                  value={advancedFilters.lead_status}
                  onChange={(e) => handleAdvancedFilterChange('lead_status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Lead Statuses</option>
                  {filterOptions.lead_statuses.map(status => (
                    <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
                  ))}
                </select>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={advancedFilters.exclude_dangerous}
                      onChange={(e) => handleAdvancedFilterChange('exclude_dangerous', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Exclude Dangerous</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={advancedFilters.exclude_business}
                      onChange={(e) => handleAdvancedFilterChange('exclude_business', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Exclude Business</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={advancedFilters.exclude_do_not_contact}
                      onChange={(e) => handleAdvancedFilterChange('exclude_do_not_contact', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Exclude Do Not Contact</span>
                  </label>
                </div>
              </div>

              {/* Score & Date Filters */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 flex items-center">
                  <ChartBarIcon className="h-4 w-4 mr-2" />
                  Score & Date
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Min Score"
                    value={advancedFilters.score_min}
                    onChange={(e) => handleAdvancedFilterChange('score_min', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    max="100"
                  />
                  <input
                    type="number"
                    placeholder="Max Score"
                    value={advancedFilters.score_max}
                    onChange={(e) => handleAdvancedFilterChange('score_max', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    max="100"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Date Range</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={advancedFilters.created_at_from}
                      onChange={(e) => handleAdvancedFilterChange('created_at_from', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="date"
                      value={advancedFilters.created_at_to}
                      onChange={(e) => handleAdvancedFilterChange('created_at_to', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="p-6">
        <div className="flex space-x-6">
          {/* Left Column - Data Grid */}
          <div className="flex-1">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Toolbar */}
              <div className="bg-gray-50 border-b border-gray-200 p-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={fetchProspects}
                      disabled={loading}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>

                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-700">Show:</span>
                      <select
                        value={perPage}
                        onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                        className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={exportToCsv}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                      Export CSV
                    </button>
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <ArrowPathIcon className="h-8 w-8 text-blue-500 animate-spin" />
                    <span className="ml-2 text-gray-600">Loading prospects...</span>
                  </div>
                ) : error ? (
                  <div className="flex items-center justify-center h-64">
                    <span className="text-red-600">{error}</span>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {[
                          { key: 'id', label: 'ID', minWidth: '40px' },
                          { key: 'lead_full_name', label: 'Name' },
                          { key: 'property_address', label: 'Property Address' },
                          { key: 'property_county', label: 'County' },
                          { key: 'property_account_number', label: 'Account' },
                          { key: 'score_value', label: 'Score' },
                          { key: 'property_date', label: 'Date' },
                          { key: 'is_active', label: 'BOTG Status' }
                        ].map(({ key, label, minWidth }) => (
                          <th
                            key={key}
                            onClick={() => handleSort(key)}
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                            style={minWidth ? { minWidth } : {}}
                          >
                            <div className="flex items-center space-x-1">
                              <span>{label}</span>
                              <span className="text-gray-400">{getSortIcon(key)}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {prospects.map((prospect) => (
                        <tr 
                          key={prospect.id}
                          onClick={() => window.open(`/prospects/${prospect.id}`, '_blank')}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {prospect.id || 'NOT SET'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {prospect.lead_full_name || 'NOT SET'}
                                </div>
                                <div className="flex items-center space-x-2 text-xs text-gray-500">
                                  {prospect.is_dangerous && (
                                    <ExclamationTriangleIcon className="h-3 w-3 text-red-500" title="Dangerous" />
                                  )}
                                  {prospect.is_business && (
                                    <BuildingOfficeIcon className="h-3 w-3 text-blue-500" title="Business" />
                                  )}
                                  <span>{prospect.lead_status}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {prospect.property_address || 'NOT SET'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {prospect.property_county || 'NOT SET'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {prospect.property_account_number || 'NOT SET'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm font-semibold ${getScoreColor(prospect.score_value)}`}>
                              {prospect.score_value}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {prospect.property_date || 'NOT SET'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              prospect.is_active 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {prospect.is_active ? 'Active' : 'Expired'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination */}
              {!loading && totalPages > 1 && (
                <div className="bg-white px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing {startIndex} to {endIndex} of {totalItems} results
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-l-md"
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                    </button>

                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                      return (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            currentPage === page
                              ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-r-md"
                    >
                      <ChevronRightIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Logo */}
          <div className="flex-shrink-0" style={{ maxWidth: '475px' }}>
            <div className="text-center">
              <img 
                src="/img/logo.svg" 
                alt="DroneStrike Logo"
                className="max-w-60 mx-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TargetsAdvanced;