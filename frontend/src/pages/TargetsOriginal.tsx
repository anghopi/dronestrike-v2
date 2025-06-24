import React, { useState, useEffect } from 'react';
import { 
  MagnifyingGlassIcon,
  ArrowPathIcon,
  DocumentArrowDownIcon,
  EyeIcon,
  ChevronLeftIcon,
  ChevronRightIcon
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
}

const TargetsOriginal: React.FC = () => {
  // Data state
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search and filter state (matching Laravel exactly)
  const [searchText, setSearchText] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState<string>('0'); // 0=All, 1=Active, 0=Expired
  
  // Pagination state (matching Laravel exactly)
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  // Sorting state
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetchProspects();
  }, [currentPage, perPage, searchText, isActiveFilter, sortField, sortDirection]);

  const fetchProspects = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Build query parameters exactly like Laravel API
      const params = new URLSearchParams({
        page: currentPage.toString(),
        per_page: perPage.toString(),
        sort_field: sortField,
        sort_direction: sortDirection,
      });

      // Add search filter if provided
      if (searchText.trim()) {
        params.append('search', searchText.trim());
      }

      // Add active status filter (matching Laravel logic)
      if (isActiveFilter !== '0') {
        params.append('is_active', isActiveFilter);
      }

      // Use leads endpoint as proxy for prospects (since we're using the same data structure)
      const response = await apiClient.get(`/api/leads/?${params.toString()}`) as any;
      
      // Transform leads to match Laravel prospect structure
      const transformedProspects: Prospect[] = response.data.results.map((lead: any) => ({
        id: lead.id,
        lead_full_name: `${lead.first_name} ${lead.last_name}`.trim(),
        property_address: `${lead.mailing_address_1}, ${lead.mailing_city}, ${lead.mailing_state} ${lead.mailing_zip5}`,
        property_county: lead.mailing_county || 'N/A',
        property_account_number: lead.account_number || 'N/A',
        property_date: lead.created_at ? new Date(lead.created_at).toLocaleDateString() : 'N/A',
        is_active: lead.lead_status !== 'dead' && lead.lead_status !== 'converted',
        lead_id: lead.id,
        property_id: lead.id, // Using lead ID as property ID for now
        created_at: lead.created_at,
        updated_at: lead.updated_at
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

  const handleClearSearch = () => {
    setSearchText('');
    setCurrentPage(1);
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

  const exportToCsv = () => {
    const headers = ['ID', 'Name', 'Property Address', 'County', 'Account', 'Date', 'BOTG Status'];
    const csvData = prospects.map(prospect => [
      prospect.id,
      prospect.lead_full_name,
      prospect.property_address,
      prospect.property_county,
      prospect.property_account_number,
      prospect.property_date,
      prospect.is_active ? 'Active' : 'Expired'
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

  const exportToExcel = () => {
    // For simplicity, export as CSV (in a real implementation, you'd use a library like xlsx)
    exportToCsv();
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const startIndex = (currentPage - 1) * perPage + 1;
  const endIndex = Math.min(currentPage * perPage, totalItems);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Filters Container - Exact Laravel Layout */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex justify-start items-center space-x-6">
          {/* Search Filter - Exact Laravel Implementation */}
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

          {/* BOTG Status Filter - Exact Laravel Button Group */}
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
                      isActiveFilter === option.value && !(option.label === 'Expired' && isActiveFilter === '0' && index === 2)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : option.label === 'Expired' && isActiveFilter === '0' && index === 2
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
        </div>
      </div>

      {/* Main Content - Exact Laravel Two-Column Layout */}
      <div className="p-6">
        <div className="flex space-x-6">
          {/* Left Column - Data Grid */}
          <div className="flex-1">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Toolbar - Exact Laravel Layout */}
              <div className="bg-gray-50 border-b border-gray-200 p-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-4">
                    {/* Refresh Button */}
                    <button
                      onClick={fetchProspects}
                      disabled={loading}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>

                    {/* Page Size Selector */}
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

                  {/* Export Buttons */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={exportToCsv}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                      CSV
                    </button>
                    <button
                      onClick={exportToExcel}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                      Excel
                    </button>
                  </div>
                </div>
              </div>

              {/* Data Grid - Exact Laravel Table Structure */}
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
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {prospect.lead_full_name || 'NOT SET'}
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

              {/* Pagination - Exact Laravel Layout */}
              {!loading && totalPages > 1 && (
                <div className="bg-white px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                  {/* Pagination Summary */}
                  <div className="text-sm text-gray-700">
                    Showing {startIndex} to {endIndex} of {totalItems} results
                  </div>

                  {/* Pagination Controls */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-l-md"
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                    </button>

                    {/* Page Numbers */}
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

          {/* Right Column - Logo (Exact Laravel Layout) */}
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

export default TargetsOriginal;