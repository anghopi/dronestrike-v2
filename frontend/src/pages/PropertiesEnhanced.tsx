import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  MapPinIcon,
  CurrencyDollarIcon as DollarSignIcon,
  ChartBarIcon as TrendingUpIcon,
  BuildingOffice2Icon as BuildingIcon,
  ArrowUpTrayIcon as Upload,
  CalculatorIcon as Calculator,
  DocumentTextIcon as FileText,
  PlusIcon,
  EyeIcon,
  PencilIcon
} from '@heroicons/react/24/outline';
import { propertyService } from '../services/api';
import { notificationService } from '../services/notificationService';
import { Property, LoanCalculation } from '../types';

const PropertiesEnhanced: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [activeModal, setActiveModal] = useState<'none' | 'create' | 'upload' | 'calculator' | 'view'>('none');
  const [calculatorData, setCalculatorData] = useState({
    purchase_price: 0,
    down_payment: 0,
    interest_rate: 7.5,
    loan_term: 30,
  });

  const queryClient = useQueryClient();

  // Fetch properties
  const { data: propertiesData, isLoading, error } = useQuery({
    queryKey: ['properties', searchTerm],
    queryFn: () => propertyService.getProperties({ 
      search: searchTerm || undefined 
    }),
  });

  // Fetch investment opportunities
  const { data: opportunitiesData } = useQuery({
    queryKey: ['investment-opportunities'],
    queryFn: () => propertyService.getInvestmentOpportunities(),
  });

  const properties = propertiesData?.results || [];
  const opportunities = opportunitiesData?.opportunities || [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getPropertyTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'single_family': 'Single Family',
      'multi_family': 'Multi Family',
      'commercial': 'Commercial',
      'land': 'Land'
    };
    return labels[type] || type;
  };

  const getStatusColor = (disposition: string) => {
    const colors: Record<string, string> = {
      'active': 'bg-olive-green',
      'pending': 'bg-alert-yellow text-gray-900',
      'sold': 'bg-gray-500',
      'inactive': 'bg-gray-600'
    };
    return colors[disposition] || 'bg-gray-500';
  };

  const calculateLoan = () => {
    const loanAmount = calculatorData.purchase_price - calculatorData.down_payment;
    const monthlyRate = calculatorData.interest_rate / 100 / 12;
    const numPayments = calculatorData.loan_term * 12;
    
    const monthlyPayment = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
                          (Math.pow(1 + monthlyRate, numPayments) - 1);
    
    const ltv = (loanAmount / calculatorData.purchase_price) * 100;
    
    return {
      loanAmount,
      monthlyPayment: isNaN(monthlyPayment) ? 0 : monthlyPayment,
      ltv: isNaN(ltv) ? 0 : ltv
    };
  };

  const closeModal = () => {
    setActiveModal('none');
    setSelectedProperty(null);
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-color mx-auto mb-4"></div>
          <p className="text-gray-400">Loading properties...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-critical-red mb-4">Error Loading Properties</h1>
          <p className="text-gray-400">{(error as any)?.message || 'Unknown error occurred'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Properties Management</h1>
            <p className="page-subtitle">Manage properties and investment opportunities</p>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setActiveModal('upload')}
              className="btn-secondary"
            >
              <Upload className="h-5 w-5 mr-2" />
              Upload Documents
            </button>
            <button 
              onClick={() => setActiveModal('calculator')}
              className="btn-secondary"
            >
              <Calculator className="h-5 w-5 mr-2" />
              Loan Calculator
            </button>
            <button 
              onClick={() => setActiveModal('create')}
              className="btn-primary"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Property
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative max-w-md">
          <input
            type="text"
            placeholder="Search properties..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-military w-full pl-4 pr-4 py-3"
          />
        </div>
      </div>

      {/* Investment Opportunities */}
      {opportunities.length > 0 && (
        <div className="enhanced-card p-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
            <TrendingUpIcon className="h-6 w-6 mr-2 text-olive-green" />
            Investment Opportunities ({opportunities.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {opportunities.slice(0, 6).map((opp: any) => (
              <div key={opp.property?.id} className="enhanced-card p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <MapPinIcon className="h-4 w-4 text-brand-color" />
                    <span className="text-sm font-medium text-white">{opp.property?.city}, {opp.property?.state}</span>
                  </div>
                  <span className="status-badge bg-olive-green text-white text-xs">
                    Score: {opp.score_data?.score || 0}/100
                  </span>
                </div>
                <p className="text-gray-300 text-sm mb-2">{opp.property?.full_address}</p>
                <p className="text-brand-color font-semibold mb-3">
                  {formatCurrency(opp.property?.total_value || 0)}
                </p>
                <button
                  onClick={() => {
                    setSelectedProperty(opp.property);
                    setActiveModal('view');
                  }}
                  className="btn-primary w-full py-2 text-sm"
                >
                  View Details
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Properties Table */}
      <div className="enhanced-card">
        <div className="px-6 py-5 border-b border-navy-blue-light">
          <h3 className="text-xl font-semibold text-white">
            All Properties 
            <span className="text-gray-400 font-normal ml-2">({properties.length})</span>
          </h3>
        </div>
        
        <div className="divide-y divide-navy-blue-light">
          {properties.map((property) => (
            <div key={property.id} className="px-6 py-5 hover:bg-navy-blue-light/30 transition-all duration-200">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                {/* Property Info */}
                <div className="md:col-span-2">
                  <div className="flex items-center space-x-3 mb-2">
                    <BuildingIcon className="h-5 w-5 text-brand-color" />
                    <div>
                      <h4 className="text-base font-semibold text-white">
                        {property.address1}
                      </h4>
                      <p className="text-sm text-gray-400">
                        {property.city}, {property.state} {property.zip_code}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="status-badge bg-navy-blue-light text-gray-300 border-navy-blue-light text-xs">
                      {getPropertyTypeLabel(property.property_type)}
                    </span>
                    <span className={`status-badge text-white text-xs ${getStatusColor(property.disposition)}`}>
                      {property.disposition?.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Value */}
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <DollarSignIcon className="h-4 w-4 text-olive-green" />
                    <span className="text-sm text-gray-400">Market Value</span>
                  </div>
                  <p className="text-lg font-semibold text-white">
                    {formatCurrency(parseFloat(property.market_value || '0'))}
                  </p>
                </div>

                {/* Total Value */}
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <TrendingUpIcon className="h-4 w-4 text-brand-color" />
                    <span className="text-sm text-gray-400">Total Value</span>
                  </div>
                  <p className="text-lg font-semibold text-white">
                    {formatCurrency(parseFloat(property.total_value || '0'))}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2 justify-end">
                  <button 
                    onClick={() => {
                      setSelectedProperty(property);
                      setActiveModal('view');
                    }}
                    className="p-2 rounded-lg hover:bg-navy-blue-light text-gray-400 hover:text-brand-color transition-all duration-200"
                  >
                    <EyeIcon className="h-5 w-5" />
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedProperty(property);
                      setActiveModal('create');
                    }}
                    className="p-2 rounded-lg hover:bg-navy-blue-light text-gray-400 hover:text-olive-green transition-all duration-200"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {properties.length === 0 && (
          <div className="px-6 py-16 text-center">
            <div className="p-4 rounded-full bg-navy-blue-light w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <BuildingIcon className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">No properties found</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              Get started by adding your first property to the system.
            </p>
          </div>
        )}
      </div>

      {/* Loan Calculator Modal */}
      {activeModal === 'calculator' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="enhanced-card max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-navy-blue-light">
              <h3 className="text-xl font-semibold text-white">Loan Calculator</h3>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Purchase Price</label>
                  <input
                    type="number"
                    value={calculatorData.purchase_price || ''}
                    onChange={(e) => setCalculatorData(prev => ({ ...prev, purchase_price: parseFloat(e.target.value) || 0 }))}
                    className="input-military w-full"
                    placeholder="$0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Down Payment</label>
                  <input
                    type="number"
                    value={calculatorData.down_payment || ''}
                    onChange={(e) => setCalculatorData(prev => ({ ...prev, down_payment: parseFloat(e.target.value) || 0 }))}
                    className="input-military w-full"
                    placeholder="$0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Interest Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={calculatorData.interest_rate || ''}
                    onChange={(e) => setCalculatorData(prev => ({ ...prev, interest_rate: parseFloat(e.target.value) || 0 }))}
                    className="input-military w-full"
                    placeholder="7.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Loan Term (years)</label>
                  <input
                    type="number"
                    value={calculatorData.loan_term || ''}
                    onChange={(e) => setCalculatorData(prev => ({ ...prev, loan_term: parseInt(e.target.value) || 30 }))}
                    className="input-military w-full"
                    placeholder="30"
                  />
                </div>
              </div>

              {/* Results */}
              {calculatorData.purchase_price > 0 && (
                <div className="enhanced-card p-4">
                  <h4 className="text-lg font-semibold text-white mb-4">Calculation Results</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Loan Amount</p>
                      <p className="text-lg font-semibold text-brand-color">
                        {formatCurrency(calculateLoan().loanAmount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Monthly Payment</p>
                      <p className="text-lg font-semibold text-olive-green">
                        {formatCurrency(calculateLoan().monthlyPayment)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">LTV Ratio</p>
                      <p className="text-lg font-semibold text-alert-yellow">
                        {calculateLoan().ltv.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button onClick={closeModal} className="btn-secondary">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Property View Modal */}
      {activeModal === 'view' && selectedProperty && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="enhanced-card max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-navy-blue-light">
              <h3 className="text-xl font-semibold text-white">Property Details</h3>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-lg font-semibold text-white mb-4">Address Information</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-400">Street Address</label>
                      <p className="text-white">{selectedProperty.address1}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400">City, State, ZIP</label>
                      <p className="text-white">{selectedProperty.city}, {selectedProperty.state} {selectedProperty.zip_code}</p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-lg font-semibold text-white mb-4">Property Details</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-400">Property Type</label>
                      <p className="text-white">{getPropertyTypeLabel(selectedProperty.property_type)}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400">Status</label>
                      <span className={`status-badge text-white text-sm ${getStatusColor(selectedProperty.disposition)}`}>
                        {selectedProperty.disposition?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-sm text-gray-400">Market Value</label>
                  <p className="text-xl font-semibold text-olive-green">
                    {formatCurrency(parseFloat(selectedProperty.market_value || '0'))}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Total Value</label>
                  <p className="text-xl font-semibold text-brand-color">
                    {formatCurrency(parseFloat(selectedProperty.total_value || '0'))}
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button onClick={closeModal} className="btn-secondary">
                  Close
                </button>
                <button 
                  onClick={() => setActiveModal('calculator')}
                  className="btn-primary"
                >
                  Calculate Loan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Documents Modal */}
      {activeModal === 'upload' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="enhanced-card max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-navy-blue-light">
              <h3 className="text-xl font-semibold text-white">Upload Property Documents</h3>
            </div>
            
            <div className="p-6">
              <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-brand-color transition-colors">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-white font-medium mb-2">Click or drag files to upload</p>
                <p className="text-gray-400 text-sm">Support for single or bulk upload. Max file size: 20 MB</p>
                <p className="text-gray-400 text-xs mt-2">
                  Allowed extensions: .pdf, .doc, .docx, .xls, .xlsx, .jpg, .jpeg, .png
                </p>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button onClick={closeModal} className="btn-secondary">
                  Cancel
                </button>
                <button className="btn-primary">
                  Upload Files
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertiesEnhanced;