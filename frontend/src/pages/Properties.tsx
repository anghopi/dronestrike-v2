import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  HomeIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  PlusIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { propertyService } from '../services/api';
import { notificationService } from '../services/notificationService';
import { Property } from '../types';
import { HeaderTabs } from '../components/Layout/HeaderTabs';

const Properties: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [filters, setFilters] = useState({
    property_type: '',
    disposition: '',
    state: '',
  });

  // Fetch properties
  const { data: propertiesData, isLoading, error } = useQuery({
    queryKey: ['properties', filters, searchTerm],
    queryFn: () => propertyService.getProperties({ 
      ...filters, 
      search: searchTerm || undefined 
    }),
  });

  // Fetch investment opportunities
  const { data: opportunitiesData } = useQuery({
    queryKey: ['investment-opportunities'],
    queryFn: () => propertyService.getInvestmentOpportunities(),
  });


  const handlePropertySelect = async (property: Property) => {
    setSelectedProperty(property);
    
    // Fetch detailed property score
    try {
      const scoreData = await propertyService.getPropertyScore(property.id);
      setSelectedProperty({ ...property, property_score: scoreData.score_data });
    } catch (error) {
      console.error('Failed to fetch property score:', error);
    }
  };

  const handleCalculateLoan = async (propertyId: number) => {
    try {
      const result = await propertyService.calculateLoan(propertyId, {
        property_id: propertyId,
        loan_amount: 75000,
        interest_rate: 8.5,
        term_months: 60
      });
      
      notificationService.info(
        'Loan Calculation Complete',
        `Monthly payment: $${result.monthly_payment.toFixed(2)} | LTV: ${result.ltv_ratio.toFixed(1)}%`
      );
    } catch (error: any) {
      notificationService.error(
        'Loan Calculation Failed',
        error.message || 'Unable to calculate loan'
      );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading properties...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Error Loading Properties</h1>
          <p className="text-gray-400">{(error as any)?.message || 'Unknown error occurred'}</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'all', name: 'All Properties', count: propertiesData?.count || 0 },
    { id: 'opportunities', name: 'Investment Opportunities', count: opportunitiesData?.count || 0 },
    { id: 'active', name: 'Active Listings', count: propertiesData?.results.filter(p => p.disposition === 'active').length || 0 },
  ];

  return (
    <div className="flex flex-col h-full">
      <HeaderTabs 
        title="Property Investment Portal" 
        searchPlaceholder="Search properties..."
        onSearch={(query) => setSearchTerm(query)}
        tabs={tabs}
        activeTab="all"
        onTabChange={() => {}}
        extraContent={
          <button
            onClick={() => console.log('Add Property clicked')}
            className="btn-primary flex items-center gap-2 px-4 py-2"
          >
            <PlusIcon className="h-4 w-4" />
            Add Property
          </button>
        }
      />
      
      <div className="flex-1 p-6 space-y-6 overflow-auto bg-gradient-to-br from-navy-blue-dark/50 to-navy-blue/30">
        {/* Investment Opportunities */}
        {opportunitiesData && opportunitiesData.count > 0 && (
          <div className="bg-gradient-to-r from-green-900 to-green-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">
               Investment Opportunities ({opportunitiesData.count})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {opportunitiesData.opportunities.slice(0, 3).map((opp: any) => (
                <div key={opp.property.id} className="bg-black bg-opacity-30 rounded-lg p-4">
                  <h3 className="text-white font-medium">{opp.property.full_address}</h3>
                  <p className="text-green-300 text-sm">Score: {opp.score_data.score}/100</p>
                  <p className="text-gray-300 text-sm">Value: ${opp.property.total_value.toLocaleString()}</p>
                  <button
                    onClick={() => handlePropertySelect(opp.property)}
                    className="mt-2 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                  >
                    View Details
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search properties..."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
              <select
                value={filters.property_type}
                onChange={(e) => setFilters({ ...filters, property_type: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="single_family">Single Family</option>
                <option value="multi_family">Multi Family</option>
                <option value="commercial">Commercial</option>
                <option value="vacant_land">Vacant Land</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
              <select
                value={filters.disposition}
                onChange={(e) => setFilters({ ...filters, disposition: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="sold">Sold</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">State</label>
              <select
                value={filters.state}
                onChange={(e) => setFilters({ ...filters, state: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All States</option>
                <option value="TX">Texas</option>
                <option value="FL">Florida</option>
                <option value="CA">California</option>
              </select>
            </div>
          </div>
        </div>

        {/* Properties Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {propertiesData?.results.map((property) => (
            <div key={property.id} className="bg-gray-800 rounded-lg p-6 hover:bg-gray-750 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-white font-semibold">{property.full_address}</h3>
                  <p className="text-gray-400 text-sm">{property.property_type.replace('_', ' ')}</p>
                </div>
                {property.property_score && (
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-400">
                      {property.property_score.score}
                    </div>
                    <div className="text-xs text-gray-400">Score</div>
                  </div>
                )}
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Value:</span>
                  <span className="text-white">${property.total_value?.toLocaleString()}</span>
                </div>
                {property.market_value && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Market Value:</span>
                    <span className="text-white">${property.market_value.toLocaleString()}</span>
                  </div>
                )}
                {property.ple_amount_due && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Taxes Due:</span>
                    <span className="text-yellow-400">${property.ple_amount_due}</span>
                  </div>
                )}
                {property.bedrooms && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Bed/Bath:</span>
                    <span className="text-white">{property.bedrooms}/{property.bathrooms}</span>
                  </div>
                )}
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => handlePropertySelect(property)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-3 rounded transition-colors"
                >
                  View Details
                </button>
                <button
                  onClick={() => handleCalculateLoan(property.id)}
                  className="bg-green-600 hover:bg-green-700 text-white text-sm py-2 px-3 rounded transition-colors"
                >
                  
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {propertiesData && (
          <div className="enhanced-card p-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">
                Showing {propertiesData.results.length} of {propertiesData.count} properties
              </span>
              <div className="flex gap-2">
                <button className="bg-gray-600/40 hover:bg-gray-600/60 text-gray-300 text-sm py-2 px-3 rounded transition-colors">
                  ← Previous
                </button>
                <button className="bg-gray-600/40 hover:bg-gray-600/60 text-gray-300 text-sm py-2 px-3 rounded transition-colors">
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Property Detail Modal */}
        {selectedProperty && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="enhanced-card max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-color/20 rounded-lg">
                      <HomeIcon className="h-6 w-6 text-brand-color" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        {selectedProperty.full_address}
                      </h2>
                      <p className="text-gray-400 text-sm">{selectedProperty.property_type.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedProperty(null)}
                    className="text-gray-400 hover:text-white p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
                  >
                    ×
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-4">
                    <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        <DocumentTextIcon className="h-5 w-5 text-blue-400" />
                        Property Details
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Type:</span>
                          <span className="text-white font-medium">{selectedProperty.property_type}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Status:</span>
                          <span className="text-white font-medium">{selectedProperty.disposition}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Total Value:</span>
                          <span className="text-green-400 font-bold">${selectedProperty.total_value?.toLocaleString()}</span>
                        </div>
                        {selectedProperty.market_value && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Market Value:</span>
                            <span className="text-white font-medium">${selectedProperty.market_value.toLocaleString()}</span>
                          </div>
                        )}
                        {selectedProperty.square_feet && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Square Feet:</span>
                            <span className="text-white font-medium">{selectedProperty.square_feet.toLocaleString()}</span>
                          </div>
                        )}
                        {selectedProperty.year_built && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Year Built:</span>
                            <span className="text-white font-medium">{selectedProperty.year_built}</span>
                          </div>
                        )}
                        {selectedProperty.bedrooms && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Bedrooms:</span>
                            <span className="text-white font-medium">{selectedProperty.bedrooms}</span>
                          </div>
                        )}
                        {selectedProperty.bathrooms && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Bathrooms:</span>
                            <span className="text-white font-medium">{selectedProperty.bathrooms}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {selectedProperty.property_score && (
                      <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                          <ChartBarIcon className="h-5 w-5 text-green-400" />
                          Investment Score
                        </h3>
                        <div className="text-center mb-4">
                          <div className="text-4xl font-bold text-green-400 mb-2">
                            {selectedProperty.property_score.score}
                          </div>
                          <div className="text-sm text-gray-400">out of 100</div>
                          <div className="w-full bg-gray-700 rounded-full h-2 mt-3">
                            <div 
                              className="bg-green-400 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${selectedProperty.property_score.score}%` }}
                            ></div>
                          </div>
                        </div>
                        <div className="text-sm text-gray-300 text-center">
                          {selectedProperty.property_score.investment_potential}
                        </div>
                      </div>
                    )}

                    <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        <CurrencyDollarIcon className="h-5 w-5 text-yellow-400" />
                        Quick Actions
                      </h3>
                      <div className="space-y-2">
                        <button
                          onClick={() => handleCalculateLoan(selectedProperty.id)}
                          className="w-full bg-green-600/20 hover:bg-green-600/40 text-green-400 border border-green-500/30 py-2 px-4 rounded transition-colors"
                        >
                          Calculate Loan
                        </button>
                        <button className="w-full bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 py-2 px-4 rounded transition-colors">
                          Generate Report
                        </button>
                        <button className="w-full bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 border border-purple-500/30 py-2 px-4 rounded transition-colors">
                          View on Map
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setSelectedProperty(null)}
                    className="bg-gray-600/40 hover:bg-gray-600/60 text-gray-300 px-6 py-2 rounded transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Properties;