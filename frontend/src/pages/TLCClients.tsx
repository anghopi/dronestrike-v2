import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  UserIcon,
  CreditCardIcon,
  DocumentTextIcon,
  PhoneIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  BanknotesIcon,
  ChartBarIcon,
  PlusIcon,
  EyeIcon,
  CloudArrowUpIcon,
  BuildingOfficeIcon,
  XMarkIcon,
  ArrowUpTrayIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline';
import { HeaderTabs } from '../components/Layout/HeaderTabs';
import { EnhancedTable, ColumnConfig } from '../components/ui/enhanced-table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { notificationService } from '../services/notificationService';
import TLCClientDashboard from '../components/tlc/TLCClientDashboard';
import CSVUploadProcessor from '../components/tlc/CSVUploadProcessor';
import { tlcClientService, CSVImportJob, TLCClient as ServiceTLCClient } from '../services/tlcClientService';

// Legacy TLC Client interface - keeping for compatibility
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface LegacyTLCClient {
  id: number;
  client_number: string;
  personal_info: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address: string;
    date_of_birth: string;
  };
  loan_info: {
    loan_id: string;
    original_amount: number;
    current_balance: number;
    interest_rate: number;
    term_months: number;
    monthly_payment: number;
    payment_due_date: string;
    next_payment_amount: number;
    payments_made: number;
    payments_remaining: number;
  };
  property_info: {
    address: string;
    estimated_value: number;
    tax_amount: number;
    county: string;
    state: string;
  };
  account_status: 'active' | 'delinquent' | 'paid_off' | 'default' | 'in_modification';
  payment_status: 'current' | 'late_1_30' | 'late_31_60' | 'late_61_90' | 'late_90_plus';
  last_payment_date?: string;
  last_payment_amount?: number;
  communication_preferences: {
    email_enabled: boolean;
    sms_enabled: boolean;
    phone_enabled: boolean;
    mail_enabled: boolean;
  };
  documents: {
    loan_agreement: boolean;
    payment_history: boolean;
    tax_documents: boolean;
    insurance_docs: boolean;
  };
  created_at: string;
  updated_at: string;
  assigned_servicer: {
    id: number;
    name: string;
    email: string;
    phone: string;
  };
}

// Use the service TLCClient interface
type TLCClient = ServiceTLCClient;

// Removed old mock service - now using proper tlcClientService

type ClientStatus = 'prospect' | 'lead' | 'applicant' | 'client' | 'inactive';
type PaymentStatus = 'current' | 'late_1_30' | 'late_31_60' | 'late_61_90' | 'late_90_plus';

// Report Generation Functions
const generateComprehensiveReport = (clients: TLCClient[]) => {
  const totalValue = clients.reduce((sum, client) => sum + (client.tax_info?.total_amount_due || 0), 0);
  const averageValue = clients.length > 0 ? totalValue / clients.length : 0;
  
  const statusCounts = clients.reduce((acc, client) => {
    const status = client.status || 'prospect';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const countyCounts = clients.reduce((acc, client) => {
    const county = client.property_address?.county || 'Unknown';
    acc[county] = (acc[county] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return {
    summary: {
      totalClients: clients.length,
      totalPortfolioValue: totalValue,
      averageTaxAmount: averageValue,
      reportGeneratedAt: new Date().toISOString()
    },
    statusDistribution: statusCounts,
    countyDistribution: countyCounts,
    clients: clients.map(client => ({
      id: client.id,
      name: `${client.first_name} ${client.last_name}`,
      email: client.email,
      phone: client.phone_primary || 'N/A',
      county: client.property_address?.county,
      taxAmount: client.tax_info?.total_amount_due,
      status: client.status,
      workflowStage: client.workflow_stage,
      createdAt: client.created_at
    }))
  };
};

const generateClientPortfolioReport = (clients: TLCClient[]) => {
  return {
    title: 'Client Portfolio Report',
    generatedAt: new Date().toISOString(),
    summary: {
      totalClients: clients.length,
      totalValue: clients.reduce((sum, client) => sum + (client.tax_info?.total_amount_due || 0), 0),
      statusBreakdown: clients.reduce((acc, client) => {
        const status = client.status || 'prospect';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    },
    clients: clients.map(client => ({
      clientNumber: client.client_number,
      name: `${client.first_name} ${client.last_name}`,
      status: client.status,
      taxAmount: client.tax_info?.total_amount_due,
      county: client.property_address?.county,
      propertyValue: client.property_valuation?.market_total_value,
      lastContact: client.last_contact,
      assignedAgent: client.assigned_agent
    }))
  };
};

const generatePerformanceReport = (clients: TLCClient[]) => {
  const totalClients = clients.length;
  const activeClients = clients.filter(c => c.status === 'client').length;
  const conversionRate = totalClients > 0 ? (activeClients / totalClients) * 100 : 0;
  
  return {
    title: 'Performance Analytics Report',
    generatedAt: new Date().toISOString(),
    metrics: {
      totalClients,
      activeClients,
      conversionRate: conversionRate.toFixed(2) + '%',
      averageProcessingTime: '14 days', // Mock data
      clientSatisfactionScore: '4.2/5', // Mock data
    },
    workflowStageAnalysis: clients.reduce((acc, client) => {
      const stage = client.workflow_stage || 'initial_contact';
      acc[stage] = (acc[stage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    monthlyTrends: [
      { month: 'Jan', newClients: 45, conversions: 12 },
      { month: 'Feb', newClients: 52, conversions: 15 },
      { month: 'Mar', newClients: 38, conversions: 18 },
      { month: 'Apr', newClients: 61, conversions: 22 },
      { month: 'May', newClients: 49, conversions: 19 },
      { month: 'Jun', newClients: 55, conversions: 25 }
    ]
  };
};

const generateTaxDataReport = (clients: TLCClient[]) => {
  const taxAmounts = clients.map(c => c.tax_info?.total_amount_due || 0);
  const totalTaxValue = taxAmounts.reduce((sum, amount) => sum + amount, 0);
  const averageTaxAmount = taxAmounts.length > 0 ? totalTaxValue / taxAmounts.length : 0;
  const medianTaxAmount = taxAmounts.length > 0 ? taxAmounts.sort((a, b) => a - b)[Math.floor(taxAmounts.length / 2)] : 0;
  
  return {
    title: 'Tax Data Summary Report',
    generatedAt: new Date().toISOString(),
    summary: {
      totalPortfolioValue: totalTaxValue,
      averageTaxAmount,
      medianTaxAmount,
      highestTaxAmount: Math.max(...taxAmounts),
      lowestTaxAmount: Math.min(...taxAmounts.filter(a => a > 0))
    },
    countyAnalysis: clients.reduce((acc, client) => {
      const county = client.property_address?.county || 'Unknown';
      if (!acc[county]) {
        acc[county] = { count: 0, totalValue: 0 };
      }
      acc[county].count++;
      acc[county].totalValue += client.tax_info?.total_amount_due || 0;
      return acc;
    }, {} as Record<string, { count: number; totalValue: number }>),
    taxRangeDistribution: {
      'Under $1,000': clients.filter(c => (c.tax_info?.total_amount_due || 0) < 1000).length,
      '$1,000-$5,000': clients.filter(c => {
        const amount = c.tax_info?.total_amount_due || 0;
        return amount >= 1000 && amount < 5000;
      }).length,
      '$5,000-$10,000': clients.filter(c => {
        const amount = c.tax_info?.total_amount_due || 0;
        return amount >= 5000 && amount < 10000;
      }).length,
      '$10,000-$25,000': clients.filter(c => {
        const amount = c.tax_info?.total_amount_due || 0;
        return amount >= 10000 && amount < 25000;
      }).length,
      '$25,000+': clients.filter(c => (c.tax_info?.total_amount_due || 0) >= 25000).length
    }
  };
};

const downloadReport = (reportData: any, filename: string) => {
  const jsonString = JSON.stringify(reportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const TLCClients: React.FC = () => {
  const [activeView, setActiveView] = useState<'dashboard' | 'clients' | 'upload' | 'reports'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'all'>('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | 'all'>('all');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showClientDetails, setShowClientDetails] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showManualEntryModal, setShowManualEntryModal] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingData, setOnboardingData] = useState({
    // Personal Information
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    // Property Information
    propertyAddress: '',
    propertyCity: '',
    propertyState: 'TX',
    propertyZip: '',
    propertyCounty: '',
    // Tax Information
    taxAmount: '',
    accountNumber: '',
    propertyValue: '',
    // Photos
    propertyPhotos: [] as File[],
    documentPhotos: [] as File[],
  });
  const [paymentAmount, setPaymentAmount] = useState('');
  const [clientCount, setClientCount] = useState(0);
  const [, setRecentImports] = useState<CSVImportJob[]>([]);
  const [showFilters, setShowFilters] = useState(true);
  const [countyFilter, setCountyFilter] = useState<string>('all');
  const [workflowFilter, setWorkflowFilter] = useState<string>('all');
  const [amountRange, setAmountRange] = useState<{min: string; max: string}>({min: '', max: ''});
  const [savedSearches, setSavedSearches] = useState<Array<{id: string, name: string, filters: any}>>([]);
  const [currentSearchName, setCurrentSearchName] = useState('');
  const [showSaveSearchModal, setShowSaveSearchModal] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(true);
  const [bulkActions, setBulkActions] = useState<string[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showBulkActionsModal, setShowBulkActionsModal] = useState(false);

  // Clear all filters
  const clearFilters = () => {
    setCountyFilter('all');
    setWorkflowFilter('all');
    setAmountRange({min: '', max: ''});
    setStatusFilter('all');
    setPaymentFilter('all');
  };

  // Save current search
  const saveCurrentSearch = () => {
    if (!currentSearchName.trim()) return;
    
    const searchFilters = {
      searchTerm,
      countyFilter,
      workflowFilter,
      paymentFilter,
      amountRange,
      statusFilter
    };
    
    const newSearch = {
      id: Date.now().toString(),
      name: currentSearchName,
      filters: searchFilters
    };
    
    setSavedSearches(prev => [...prev, newSearch]);
    setCurrentSearchName('');
    setShowSaveSearchModal(false);
    notificationService.success('Search Saved', `Search "${currentSearchName}" has been saved`);
  };

  // Load saved search
  const loadSavedSearch = (search: any) => {
    setSearchTerm(search.filters.searchTerm || '');
    setCountyFilter(search.filters.countyFilter || 'all');
    setWorkflowFilter(search.filters.workflowFilter || 'all');
    setPaymentFilter(search.filters.paymentFilter || 'all');
    setAmountRange(search.filters.amountRange || {min: '', max: ''});
    setStatusFilter(search.filters.statusFilter || 'all');
    notificationService.info('Search Loaded', `Applied search "${search.name}"`);
  };

  // Bulk actions
  const handleBulkAction = async (action: string) => {
    const selectedIds = Array.from(selectedRows);
    if (selectedIds.length === 0) {
      notificationService.warning('No Selection', 'Please select clients to perform bulk actions');
      return;
    }

    try {
      switch (action) {
        case 'export':
          notificationService.info('Export Started', `Exporting ${selectedIds.length} selected clients...`);
          break;
        case 'update_status':
          notificationService.info('Status Update', `Updating status for ${selectedIds.length} clients...`);
          break;
        case 'send_email':
          notificationService.info('Email Campaign', `Sending emails to ${selectedIds.length} clients...`);
          break;
        case 'assign_agent':
          notificationService.info('Agent Assignment', `Assigning agent to ${selectedIds.length} clients...`);
          break;
      }
      
      setSelectedRows(new Set());
      setShowBulkActionsModal(false);
    } catch (error) {
      console.error('Bulk action error:', error);
      notificationService.error('Action Failed', 'Failed to perform bulk action');
    }
  };

  // Row selection
  const toggleRowSelection = (clientId: string) => {
    const newSelection = new Set(selectedRows);
    if (newSelection.has(clientId)) {
      newSelection.delete(clientId);
    } else {
      newSelection.add(clientId);
    }
    setSelectedRows(newSelection);
  };

  const selectAllRows = () => {
    if (selectedRows.size === safeClients.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(safeClients.map(client => client.id)));
    }
  };
  const queryClient = useQueryClient();

  // Fetch clients data using proper service
  const { data: clientsData, isLoading, error } = useQuery({
    queryKey: ['tlc-clients', searchTerm, statusFilter, paymentFilter, countyFilter, workflowFilter, amountRange],
    queryFn: () => tlcClientService.getClients(
      {
        search_term: searchTerm || undefined,
        status: statusFilter !== 'all' ? [statusFilter] : undefined,
        workflow_stage: workflowFilter !== 'all' ? [workflowFilter] : undefined,
        counties: countyFilter !== 'all' ? [countyFilter] : undefined,
        amount_range: (amountRange.min || amountRange.max) ? {
          min: amountRange.min ? parseFloat(amountRange.min) : 0,
          max: amountRange.max ? parseFloat(amountRange.max) : 999999999,
          field: 'tax_amount' as const
        } : undefined,
      },
      1,
      50
    ),
  });

  const safeClients = clientsData?.clients || [];

  // Process payment mutation
  const processPaymentMutation = useMutation({
    mutationFn: ({ clientId, amount }: { clientId: string; amount: number }) => {
      // In production, would call actual payment API
      console.log(`Processing payment for client ${clientId}: $${amount}`);
      return Promise.resolve({ success: true, transaction_id: `TXN-${Date.now()}` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tlc-clients'] });
      notificationService.success('Payment Processed', 'Payment has been processed successfully');
      setShowPaymentModal(false);
      setSelectedClient(null);
      setPaymentAmount('');
    },
  });

  const handleUploadComplete = (job: CSVImportJob) => {
    setRecentImports(prev => [job, ...prev.slice(0, 4)]);
    
    // Automatically switch to clients view after successful upload
    if (job.status === 'completed') {
      setTimeout(() => {
        setActiveView('clients');
      }, 2000);
    }
  };

  const handleDataImported = (count: number) => {
    setClientCount(prev => prev + count);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getAccountStatusBadgeType = (status: ClientStatus) => {
    const statusMap: Record<ClientStatus, string> = {
      'prospect': 'info',
      'lead': 'warning',
      'applicant': 'pending',
      'client': 'success',
      'inactive': 'danger'
    };
    return statusMap[status] || 'pending';
  };

  // Removed unused payment status functions since we're using workflow_stage now

  const columns: ColumnConfig<any>[] = useMemo(() => [
    {
      key: 'client_number',
      title: 'Client ID',
      dataIndex: 'client_number',
      sortable: true,
      render: (value: string, record: any) => (
        <div className="space-y-1">
          <div className="font-mono font-bold text-white">{value || 'N/A'}</div>
          <div className="text-xs text-gray-400">{formatDate(record.created_at || '')}</div>
        </div>
      )
    },
    {
      key: 'personal_info',
      title: 'Client Information',
      render: (value: any, record: any) => (
        <div className="space-y-1 max-w-xs">
          <div className="font-semibold text-white">
            {record.first_name || 'N/A'} {record.last_name || ''}
          </div>
          <div className="text-sm text-gray-400">{record.email || 'No email'}</div>
          <div className="text-sm text-gray-400 font-mono">{record.phone_primary || 'No phone'}</div>
        </div>
      )
    },
    {
      key: 'loan_info',
      title: 'Loan Details',
      render: (value: any, record: any) => (
        <div className="space-y-1">
          <div className="font-semibold text-white">{formatCurrency(record.tax_info?.total_amount_due || 0)}</div>
          <div className="text-sm text-gray-400">
            Tax Year: {record.tax_info?.tax_year || 'N/A'}
          </div>
          <div className="text-xs text-gray-400">
            {record.property_address?.county || 'Unknown'}          </div>
        </div>
      )
    },
    {
      key: 'monthly_payment',
      title: 'Monthly Payment',
      render: (value: any, record: any) => (
        <div className="space-y-1">
          <div className="font-semibold text-white">{formatCurrency(record.property_valuation?.market_total_value || 0)}</div>
          <div className="text-sm text-gray-400">
            Market Value
          </div>
        </div>
      )
    },
    {
      key: 'account_status',
      title: 'Account Status',
      render: (value: any, record: any) => {
        const status = record.status || value || 'prospect';
        return (
          <Badge variant={getAccountStatusBadgeType(status) as any}>
            {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Prospect'}
          </Badge>
        );
      }
    },
    {
      key: 'payment_status',
      title: 'Payment Status',
      render: (value: any, record: any) => (
        <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border backdrop-blur-sm bg-blue-500/20 text-blue-400 border-blue-500/30`}>
          {record.workflow_stage || 'New'}
        </div>
      )
    },
    {
      key: 'last_payment',
      title: 'Last Payment',
      render: (value: any, record: any) => (
        <div className="space-y-1">
          <div className="font-semibold text-white">
            {record.last_contact ? formatDate(record.last_contact) : 'Never'}
          </div>
          <div className="text-sm text-gray-400">Last Contact</div>
        </div>
      )
    },
    {
      key: 'assigned_servicer',
      title: 'Loan Servicer',
      render: (value: any, record: any) => (
        <div className="space-y-1">
          <div className="text-sm font-medium text-white">{record.assigned_agent || 'Unassigned'}</div>
          <div className="text-xs text-gray-400">{record.lead_source?.replace('_', ' ') || 'Unknown'}</div>
        </div>
      )
    },
    {
      key: 'actions',
      title: 'Actions',
      width: 120,
      render: (value: any, record: any) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedClient(record);
              setShowClientDetails(true);
            }}
            className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/20 rounded-lg transition-all duration-200 border border-transparent hover:border-blue-500/30"
            title="View Details"
          >
            <EyeIcon className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedClient(record);
              setShowPaymentModal(true);
            }}
            className="p-2 text-slate-400 hover:text-green-400 hover:bg-green-500/20 rounded-lg transition-all duration-200 border border-transparent hover:border-green-500/30"
            title="Process Payment"
          >
            <CreditCardIcon className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Send email to client
              if (record.email) {
                const emailSubject = encodeURIComponent('TLC Account Update');
                const emailBody = encodeURIComponent(`Dear ${record.first_name || 'Client'},\\n\\nWe hope this message finds you well. Please contact us regarding your account ${record.client_number || 'your account'}.\\n\\nBest regards,\\nTLC Team`);
                window.open(`mailto:${record.email}?subject=${emailSubject}&body=${emailBody}`);
              } else {
                notificationService.warning('No Email', 'No email address available for this client');
              }
            }}
            className="p-2 text-slate-400 hover:text-yellow-400 hover:bg-yellow-500/20 rounded-lg transition-all duration-200 border border-transparent hover:border-yellow-500/30"
            title="Send Email"
          >
            <EnvelopeIcon className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Call client
              if (record.phone_primary) {
                window.open(`tel:${record.phone_primary}`);
              } else {
                notificationService.warning('No Phone', 'No phone number available for this client');
              }
            }}
            className="p-2 text-slate-400 hover:text-purple-400 hover:bg-purple-500/20 rounded-lg transition-all duration-200 border border-transparent hover:border-purple-500/30"
            title="Call Client"
          >
            <PhoneIcon className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ], []);

  const tabs = [
    { id: 'all', name: 'All Clients', count: safeClients.length },
    { id: 'client', name: 'Active Clients', count: safeClients.filter(c => c.status === 'client').length },
    { id: 'applicant', name: 'Applicants', count: safeClients.filter(c => c.status === 'applicant').length },
    { id: 'lead', name: 'Leads', count: safeClients.filter(c => c.status === 'lead').length },
  ];

  if (isLoading && activeView === 'clients') {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-color"></div>
      </div>
    );
  }

  if (error && activeView === 'clients') {
    return (
      <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
        <p className="text-red-300">Error loading TLC clients. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Enhanced Navigation Header */}
      <div className="bg-slate-800/70 backdrop-blur-sm border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div>
                <h1 className="text-xl font-bold text-white">
                  TLC Client Management
                </h1>
              </div>
              
              {clientCount > 0 && (
                <div className="flex items-center space-x-2 px-4 py-2 bg-blue-600/20 rounded-full border border-blue-500/30 backdrop-blur-sm">
                  <BuildingOfficeIcon className="w-5 h-5 text-blue-400" />
                  <span className="text-blue-400 font-medium">{clientCount.toLocaleString()} clients</span>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                </div>
              )}
            </div>

            <div className="flex bg-slate-700/50 rounded-xl overflow-hidden border border-slate-600/50 backdrop-blur-sm shadow-lg">
              <button
                onClick={() => setActiveView('dashboard')}
                className={`flex items-center space-x-2 px-6 py-3 transition-all duration-200 ${ 
                  activeView === 'dashboard'
                    ? 'bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-lg'
                    : 'text-slate-300 hover:text-white hover:bg-gradient-to-r hover:from-slate-600 hover:to-slate-700'
                }`}
              >
                <ChartBarIcon className="w-4 h-4" />
                <span>Dashboard</span>
              </button>
              
              <button
                onClick={() => setActiveView('clients')}
                className={`flex items-center space-x-2 px-6 py-3 transition-all duration-200 ${
                  activeView === 'clients'
                    ? 'bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-lg'
                    : 'text-slate-300 hover:text-white hover:bg-gradient-to-r hover:from-slate-600 hover:to-slate-700'
                }`}
              >
                <UserIcon className="w-4 h-4" />
                <span>Clients</span>
              </button>

              <button
                onClick={() => setActiveView('upload')}
                className={`flex items-center space-x-2 px-6 py-3 transition-all duration-200 ${
                  activeView === 'upload'
                    ? 'bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-lg'
                    : 'text-slate-300 hover:text-white hover:bg-gradient-to-r hover:from-slate-600 hover:to-slate-700'
                }`}
              >
                <CloudArrowUpIcon className="w-4 h-4" />
                <span>Import Data</span>
              </button>

              <button
                onClick={() => setActiveView('reports')}
                className={`flex items-center space-x-2 px-6 py-3 transition-all duration-200 ${
                  activeView === 'reports'
                    ? 'bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-lg'
                    : 'text-slate-300 hover:text-white hover:bg-gradient-to-r hover:from-slate-600 hover:to-slate-700'
                }`}
              >
                <DocumentTextIcon className="w-4 h-4" />
                <span>Reports</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Main Content */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {activeView === 'dashboard' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 shadow-2xl">
              <div className="p-6">
                <TLCClientDashboard onClientCountUpdate={setClientCount} />
              </div>
            </div>
          </div>
        )}

        {activeView === 'clients' && (
          <div className="flex flex-col h-full">
            <HeaderTabs 
              title="Client Portfolio Management" 
              searchPlaceholder="Search clients..."
              onSearch={(query) => setSearchTerm(query)}
              onNew={() => setShowNewClientModal(true)}
              showImportButton={false}
              showFilters={true}
              onFiltersToggle={() => setShowFilters(!showFilters)}
              tabs={tabs}
              activeTab={statusFilter === 'all' ? 'all' : statusFilter}
              onTabChange={(tabId) => setStatusFilter(tabId as ClientStatus | 'all')}
            />
            
            <div className="flex-1 p-8 space-y-8 overflow-auto bg-gradient-to-br from-navy-blue-dark/50 to-navy-blue/30">
              {/* Compact Portfolio Metrics Cards */}
              <div className="flex flex-wrap gap-3 mb-6">
                <div className="bg-gradient-to-br from-green-600/20 via-green-700/20 to-green-800/30 border border-green-500/30 rounded-lg p-3 backdrop-blur-sm flex-1 min-w-[200px]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500/20 rounded-lg">
                      <BanknotesIcon className="h-4 w-4 text-green-400" />
                    </div>
                    <div>
                      <p className="text-green-300 text-xs font-medium">Total Portfolio</p>
                      <p className="text-lg font-bold text-white">
                        ${((clientsData?.total || 0) / 1000).toFixed(0)}K
                      </p>
                      <p className="text-green-400 text-xs">+12.5% this month</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-blue-600/20 via-blue-700/20 to-blue-800/30 border border-blue-500/30 rounded-lg p-3 backdrop-blur-sm flex-1 min-w-[200px]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <UserIcon className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-blue-300 text-xs font-medium">Active Clients</p>
                      <p className="text-lg font-bold text-white">
                        {safeClients.filter(c => c.status === 'client').length}
                      </p>
                      <p className="text-blue-400 text-xs">+8 new this week</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-yellow-600/20 via-yellow-700/20 to-yellow-800/30 border border-yellow-500/30 rounded-lg p-3 backdrop-blur-sm flex-1 min-w-[200px]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-500/20 rounded-lg">
                      <DocumentTextIcon className="h-4 w-4 text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-yellow-300 text-xs font-medium">Pending Apps</p>
                      <p className="text-lg font-bold text-white">
                        {safeClients.filter(c => c.status === 'applicant').length}
                      </p>
                      <p className="text-yellow-400 text-xs">Avg 5 days review</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-purple-600/20 via-purple-700/20 to-purple-800/30 border border-purple-500/30 rounded-lg p-3 backdrop-blur-sm flex-1 min-w-[200px]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <CheckCircleIcon className="h-4 w-4 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-purple-300 text-xs font-medium">Success Rate</p>
                      <p className="text-lg font-bold text-white">87.3%</p>
                      <p className="text-purple-400 text-xs">Above industry avg</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Filters with Smooth Animation */}
              <div className={`transition-all duration-500 ease-in-out overflow-hidden ${
                showFilters 
                  ? 'max-h-[800px] opacity-100 transform translate-y-0' 
                  : 'max-h-0 opacity-0 transform -translate-y-4'
              }`}>
                <div className="bg-gradient-to-br from-slate-800/95 via-slate-850/95 to-slate-900/95 backdrop-blur-xl border border-slate-600/30 rounded-3xl p-8 space-y-8 shadow-2xl mb-6 relative overflow-hidden">
                  {/* Animated Background Pattern */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-green-500/5 opacity-50"></div>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-green-500/10 to-blue-500/10 rounded-full blur-2xl"></div>
                  
                  {/* Header with Enhanced Visual Appeal */}
                  <div className="relative flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full animate-pulse shadow-lg"></div>
                        <div className="absolute inset-0 w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full animate-ping opacity-30"></div>
                      </div>
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-white via-blue-100 to-purple-200 bg-clip-text text-transparent tracking-tight">
                        Advanced Client Filters
                      </h3>
                      <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-700/50 rounded-full border border-slate-600/50">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                        <span className="text-xs text-slate-300 font-medium">Live Filtering</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="px-4 py-2 bg-gradient-to-r from-slate-700/60 to-slate-800/60 rounded-xl border border-slate-600/40 backdrop-blur-sm">
                        <span className="text-sm font-semibold text-white">{safeClients.length}</span>
                        <span className="text-xs text-slate-400 ml-1">clients found</span>
                      </div>
                      <button
                        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                        className="p-2 hover:bg-slate-700/50 rounded-xl transition-all duration-200 text-slate-400 hover:text-white group"
                        title={showAdvancedFilters ? "Hide Filters" : "Show Filters"}
                      >
                        <svg 
                          className={`w-5 h-5 transform group-hover:scale-110 transition-all duration-200 ${showAdvancedFilters ? 'rotate-180' : ''}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {/* Filter Grid Layout */}
                  <div className={`grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 ${showAdvancedFilters ? 'block' : 'hidden'}`}>
                      {/* Search Input */}
                      <div className="xl:col-span-2">
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Search Clients
                        </label>
                        <div className="relative">
                          <Input
                            placeholder="Name, email, client number..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-4 pr-4 py-3 text-white placeholder-gray-400 bg-slate-700/80 border-slate-600/50 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
                          />
                        </div>
                      </div>
                    
                      {/* County Filter */}
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Texas Counties
                        </label>
                        <Select value={countyFilter} onValueChange={setCountyFilter}>
                          <SelectTrigger className="w-full bg-slate-700/80 border-slate-600/50 text-white rounded-xl focus:ring-2 focus:ring-blue-500/50 hover:bg-slate-600/80 transition-colors duration-200 cursor-pointer shadow-sm min-h-[44px] flex items-center justify-between px-4 py-2">
                            <SelectValue placeholder="All Counties" />
                          </SelectTrigger>
                        <SelectContent className="bg-gradient-to-br from-slate-800/98 via-slate-900/95 to-slate-800/98 backdrop-blur-xl border border-slate-500/40 rounded-2xl max-h-80 shadow-2xl z-[60] overflow-hidden animate-in slide-in-from-top-2 duration-200">
                          <SelectItem value="all" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 font-medium border-b border-slate-600/30 mb-2 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">All Counties</SelectItem>
                          <SelectItem value="Anderson" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Anderson</SelectItem>
                          <SelectItem value="Andrews" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Andrews</SelectItem>
                          <SelectItem value="Angelina" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Angelina</SelectItem>
                          <SelectItem value="Aransas" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Aransas</SelectItem>
                          <SelectItem value="Archer" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Archer</SelectItem>
                          <SelectItem value="Armstrong" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Armstrong</SelectItem>
                          <SelectItem value="Atascosa" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Atascosa</SelectItem>
                          <SelectItem value="Austin" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Austin</SelectItem>
                          <SelectItem value="Bailey" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Bailey</SelectItem>
                          <SelectItem value="Bandera" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Bandera</SelectItem>
                          <SelectItem value="Bastrop" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Bastrop</SelectItem>
                          <SelectItem value="Baylor" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Baylor</SelectItem>
                          <SelectItem value="Bee" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Bee</SelectItem>
                          <SelectItem value="Bell" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Bell</SelectItem>
                          <SelectItem value="Bexar" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Bexar</SelectItem>
                          <SelectItem value="Blanco" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Blanco</SelectItem>
                          <SelectItem value="Borden" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Borden</SelectItem>
                          <SelectItem value="Bosque" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Bosque</SelectItem>
                          <SelectItem value="Bowie" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Bowie</SelectItem>
                          <SelectItem value="Brazoria" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Brazoria</SelectItem>
                          <SelectItem value="Brazos" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Brazos</SelectItem>
                          <SelectItem value="Brewster" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Brewster</SelectItem>
                          <SelectItem value="Briscoe" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Briscoe</SelectItem>
                          <SelectItem value="Brooks" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Brooks</SelectItem>
                          <SelectItem value="Brown" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Brown</SelectItem>
                          <SelectItem value="Burleson" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Burleson</SelectItem>
                          <SelectItem value="Burnet" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Burnet</SelectItem>
                          <SelectItem value="Caldwell" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Caldwell</SelectItem>
                          <SelectItem value="Calhoun" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Calhoun</SelectItem>
                          <SelectItem value="Callahan" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Callahan</SelectItem>
                          <SelectItem value="Cameron" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Cameron</SelectItem>
                          <SelectItem value="Camp" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Camp</SelectItem>
                          <SelectItem value="Carson" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Carson</SelectItem>
                          <SelectItem value="Cass" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Cass</SelectItem>
                          <SelectItem value="Castro" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Castro</SelectItem>
                          <SelectItem value="Chambers" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Chambers</SelectItem>
                          <SelectItem value="Cherokee" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Cherokee</SelectItem>
                          <SelectItem value="Childress" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Childress</SelectItem>
                          <SelectItem value="Clay" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Clay</SelectItem>
                          <SelectItem value="Cochran" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Cochran</SelectItem>
                          <SelectItem value="Coke" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Coke</SelectItem>
                          <SelectItem value="Coleman" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Coleman</SelectItem>
                          <SelectItem value="Collin" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Collin</SelectItem>
                          <SelectItem value="Collingsworth" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Collingsworth</SelectItem>
                          <SelectItem value="Colorado" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Colorado</SelectItem>
                          <SelectItem value="Comal" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Comal</SelectItem>
                          <SelectItem value="Comanche" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Comanche</SelectItem>
                          <SelectItem value="Concho" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Concho</SelectItem>
                          <SelectItem value="Cooke" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Cooke</SelectItem>
                          <SelectItem value="Coryell" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Coryell</SelectItem>
                          <SelectItem value="Cottle" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Cottle</SelectItem>
                          <SelectItem value="Crane" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Crane</SelectItem>
                          <SelectItem value="Crockett" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Crockett</SelectItem>
                          <SelectItem value="Crosby" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Crosby</SelectItem>
                          <SelectItem value="Culberson" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Culberson</SelectItem>
                          <SelectItem value="Dallam" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Dallam</SelectItem>
                          <SelectItem value="Dallas" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Dallas</SelectItem>
                          <SelectItem value="Dawson" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Dawson</SelectItem>
                          <SelectItem value="Deaf Smith" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Deaf Smith</SelectItem>
                          <SelectItem value="Delta" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Delta</SelectItem>
                          <SelectItem value="Denton" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Denton</SelectItem>
                          <SelectItem value="DeWitt" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">DeWitt</SelectItem>
                          <SelectItem value="Dickens" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Dickens</SelectItem>
                          <SelectItem value="Dimmit" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Dimmit</SelectItem>
                          <SelectItem value="Donley" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Donley</SelectItem>
                          <SelectItem value="Duval" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Duval</SelectItem>
                          <SelectItem value="Eastland" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Eastland</SelectItem>
                          <SelectItem value="Ector" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Ector</SelectItem>
                          <SelectItem value="Edwards" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Edwards</SelectItem>
                          <SelectItem value="Ellis" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Ellis</SelectItem>
                          <SelectItem value="El Paso" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">El Paso</SelectItem>
                          <SelectItem value="Erath" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Erath</SelectItem>
                          <SelectItem value="Falls" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Falls</SelectItem>
                          <SelectItem value="Fannin" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Fannin</SelectItem>
                          <SelectItem value="Fayette" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Fayette</SelectItem>
                          <SelectItem value="Fisher" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Fisher</SelectItem>
                          <SelectItem value="Floyd" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Floyd</SelectItem>
                          <SelectItem value="Foard" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Foard</SelectItem>
                          <SelectItem value="Fort Bend" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Fort Bend</SelectItem>
                          <SelectItem value="Franklin" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Franklin</SelectItem>
                          <SelectItem value="Freestone" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Freestone</SelectItem>
                          <SelectItem value="Frio" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Frio</SelectItem>
                          <SelectItem value="Gaines" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Gaines</SelectItem>
                          <SelectItem value="Galveston" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Galveston</SelectItem>
                          <SelectItem value="Garza" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Garza</SelectItem>
                          <SelectItem value="Gillespie" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Gillespie</SelectItem>
                          <SelectItem value="Glasscock" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Glasscock</SelectItem>
                          <SelectItem value="Goliad" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Goliad</SelectItem>
                          <SelectItem value="Gonzales" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Gonzales</SelectItem>
                          <SelectItem value="Gray" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Gray</SelectItem>
                          <SelectItem value="Grayson" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Grayson</SelectItem>
                          <SelectItem value="Gregg" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Gregg</SelectItem>
                          <SelectItem value="Grimes" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Grimes</SelectItem>
                          <SelectItem value="Guadalupe" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Guadalupe</SelectItem>
                          <SelectItem value="Hale" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Hale</SelectItem>
                          <SelectItem value="Hall" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Hall</SelectItem>
                          <SelectItem value="Hamilton" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Hamilton</SelectItem>
                          <SelectItem value="Hansford" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Hansford</SelectItem>
                          <SelectItem value="Hardeman" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Hardeman</SelectItem>
                          <SelectItem value="Hardin" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Hardin</SelectItem>
                          <SelectItem value="Harris" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Harris</SelectItem>
                          <SelectItem value="Harrison" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Harrison</SelectItem>
                          <SelectItem value="Hartley" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Hartley</SelectItem>
                          <SelectItem value="Haskell" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Haskell</SelectItem>
                          <SelectItem value="Hays" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Hays</SelectItem>
                          <SelectItem value="Hemphill" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Hemphill</SelectItem>
                          <SelectItem value="Henderson" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Henderson</SelectItem>
                          <SelectItem value="Hidalgo" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Hidalgo</SelectItem>
                          <SelectItem value="Hill" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Hill</SelectItem>
                          <SelectItem value="Hockley" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Hockley</SelectItem>
                          <SelectItem value="Hood" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Hood</SelectItem>
                          <SelectItem value="Hopkins" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Hopkins</SelectItem>
                          <SelectItem value="Houston" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Houston</SelectItem>
                          <SelectItem value="Howard" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Howard</SelectItem>
                          <SelectItem value="Hudspeth" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Hudspeth</SelectItem>
                          <SelectItem value="Hunt" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Hunt</SelectItem>
                          <SelectItem value="Hutchinson" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Hutchinson</SelectItem>
                          <SelectItem value="Irion" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Irion</SelectItem>
                          <SelectItem value="Jack" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Jack</SelectItem>
                          <SelectItem value="Jackson" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Jackson</SelectItem>
                          <SelectItem value="Jasper" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Jasper</SelectItem>
                          <SelectItem value="Jeff Davis" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Jeff Davis</SelectItem>
                          <SelectItem value="Jefferson" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Jefferson</SelectItem>
                          <SelectItem value="Jim Hogg" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Jim Hogg</SelectItem>
                          <SelectItem value="Jim Wells" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Jim Wells</SelectItem>
                          <SelectItem value="Johnson" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Johnson</SelectItem>
                          <SelectItem value="Jones" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Jones</SelectItem>
                          <SelectItem value="Karnes" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Karnes</SelectItem>
                          <SelectItem value="Kaufman" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Kaufman</SelectItem>
                          <SelectItem value="Kendall" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Kendall</SelectItem>
                          <SelectItem value="Kenedy" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Kenedy</SelectItem>
                          <SelectItem value="Kent" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Kent</SelectItem>
                          <SelectItem value="Kerr" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Kerr</SelectItem>
                          <SelectItem value="Kimble" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Kimble</SelectItem>
                          <SelectItem value="King" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">King</SelectItem>
                          <SelectItem value="Kinney" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Kinney</SelectItem>
                          <SelectItem value="Kleberg" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Kleberg</SelectItem>
                          <SelectItem value="Knox" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Knox</SelectItem>
                          <SelectItem value="Lamar" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Lamar</SelectItem>
                          <SelectItem value="Lamb" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Lamb</SelectItem>
                          <SelectItem value="Lampasas" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Lampasas</SelectItem>
                          <SelectItem value="La Salle" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">La Salle</SelectItem>
                          <SelectItem value="Lavaca" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Lavaca</SelectItem>
                          <SelectItem value="Lee" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Lee</SelectItem>
                          <SelectItem value="Leon" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Leon</SelectItem>
                          <SelectItem value="Liberty" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Liberty</SelectItem>
                          <SelectItem value="Limestone" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Limestone</SelectItem>
                          <SelectItem value="Lipscomb" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Lipscomb</SelectItem>
                          <SelectItem value="Live Oak" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Live Oak</SelectItem>
                          <SelectItem value="Llano" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Llano</SelectItem>
                          <SelectItem value="Loving" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Loving</SelectItem>
                          <SelectItem value="Lubbock" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Lubbock</SelectItem>
                          <SelectItem value="Lynn" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Lynn</SelectItem>
                          <SelectItem value="McCulloch" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">McCulloch</SelectItem>
                          <SelectItem value="McLennan" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">McLennan</SelectItem>
                          <SelectItem value="McMullen" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">McMullen</SelectItem>
                          <SelectItem value="Madison" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Madison</SelectItem>
                          <SelectItem value="Marion" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Marion</SelectItem>
                          <SelectItem value="Martin" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Martin</SelectItem>
                          <SelectItem value="Mason" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Mason</SelectItem>
                          <SelectItem value="Matagorda" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Matagorda</SelectItem>
                          <SelectItem value="Maverick" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Maverick</SelectItem>
                          <SelectItem value="Medina" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Medina</SelectItem>
                          <SelectItem value="Menard" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Menard</SelectItem>
                          <SelectItem value="Midland" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Midland</SelectItem>
                          <SelectItem value="Milam" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Milam</SelectItem>
                          <SelectItem value="Mills" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Mills</SelectItem>
                          <SelectItem value="Mitchell" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Mitchell</SelectItem>
                          <SelectItem value="Montague" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Montague</SelectItem>
                          <SelectItem value="Montgomery" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Montgomery</SelectItem>
                          <SelectItem value="Moore" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Moore</SelectItem>
                          <SelectItem value="Morris" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Morris</SelectItem>
                          <SelectItem value="Motley" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Motley</SelectItem>
                          <SelectItem value="Nacogdoches" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Nacogdoches</SelectItem>
                          <SelectItem value="Navarro" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Navarro</SelectItem>
                          <SelectItem value="Newton" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Newton</SelectItem>
                          <SelectItem value="Nolan" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Nolan</SelectItem>
                          <SelectItem value="Nueces" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Nueces</SelectItem>
                          <SelectItem value="Ochiltree" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Ochiltree</SelectItem>
                          <SelectItem value="Oldham" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Oldham</SelectItem>
                          <SelectItem value="Orange" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Orange</SelectItem>
                          <SelectItem value="Palo Pinto" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Palo Pinto</SelectItem>
                          <SelectItem value="Panola" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Panola</SelectItem>
                          <SelectItem value="Parker" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Parker</SelectItem>
                          <SelectItem value="Parmer" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Parmer</SelectItem>
                          <SelectItem value="Pecos" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Pecos</SelectItem>
                          <SelectItem value="Polk" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Polk</SelectItem>
                          <SelectItem value="Potter" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Potter</SelectItem>
                          <SelectItem value="Presidio" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Presidio</SelectItem>
                          <SelectItem value="Rains" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Rains</SelectItem>
                          <SelectItem value="Randall" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Randall</SelectItem>
                          <SelectItem value="Reagan" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Reagan</SelectItem>
                          <SelectItem value="Real" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Real</SelectItem>
                          <SelectItem value="Red River" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Red River</SelectItem>
                          <SelectItem value="Reeves" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Reeves</SelectItem>
                          <SelectItem value="Refugio" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Refugio</SelectItem>
                          <SelectItem value="Roberts" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Roberts</SelectItem>
                          <SelectItem value="Robertson" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Robertson</SelectItem>
                          <SelectItem value="Rockwall" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Rockwall</SelectItem>
                          <SelectItem value="Runnels" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Runnels</SelectItem>
                          <SelectItem value="Rusk" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Rusk</SelectItem>
                          <SelectItem value="Sabine" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Sabine</SelectItem>
                          <SelectItem value="San Augustine" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">San Augustine</SelectItem>
                          <SelectItem value="San Jacinto" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">San Jacinto</SelectItem>
                          <SelectItem value="San Patricio" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">San Patricio</SelectItem>
                          <SelectItem value="San Saba" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">San Saba</SelectItem>
                          <SelectItem value="Schleicher" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Schleicher</SelectItem>
                          <SelectItem value="Scurry" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Scurry</SelectItem>
                          <SelectItem value="Shackelford" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Shackelford</SelectItem>
                          <SelectItem value="Shelby" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Shelby</SelectItem>
                          <SelectItem value="Sherman" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Sherman</SelectItem>
                          <SelectItem value="Smith" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Smith</SelectItem>
                          <SelectItem value="Somervell" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Somervell</SelectItem>
                          <SelectItem value="Starr" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Starr</SelectItem>
                          <SelectItem value="Stephens" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Stephens</SelectItem>
                          <SelectItem value="Sterling" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Sterling</SelectItem>
                          <SelectItem value="Stonewall" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Stonewall</SelectItem>
                          <SelectItem value="Sutton" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Sutton</SelectItem>
                          <SelectItem value="Swisher" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Swisher</SelectItem>
                          <SelectItem value="Tarrant" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Tarrant</SelectItem>
                          <SelectItem value="Taylor" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Taylor</SelectItem>
                          <SelectItem value="Terrell" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Terrell</SelectItem>
                          <SelectItem value="Terry" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Terry</SelectItem>
                          <SelectItem value="Throckmorton" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Throckmorton</SelectItem>
                          <SelectItem value="Titus" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Titus</SelectItem>
                          <SelectItem value="Tom Green" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Tom Green</SelectItem>
                          <SelectItem value="Travis" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Travis</SelectItem>
                          <SelectItem value="Trinity" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Trinity</SelectItem>
                          <SelectItem value="Tyler" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Tyler</SelectItem>
                          <SelectItem value="Upshur" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Upshur</SelectItem>
                          <SelectItem value="Upton" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Upton</SelectItem>
                          <SelectItem value="Uvalde" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Uvalde</SelectItem>
                          <SelectItem value="Val Verde" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Val Verde</SelectItem>
                          <SelectItem value="Van Zandt" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Van Zandt</SelectItem>
                          <SelectItem value="Victoria" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Victoria</SelectItem>
                          <SelectItem value="Walker" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Walker</SelectItem>
                          <SelectItem value="Waller" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Waller</SelectItem>
                          <SelectItem value="Ward" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Ward</SelectItem>
                          <SelectItem value="Washington" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Washington</SelectItem>
                          <SelectItem value="Webb" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Webb</SelectItem>
                          <SelectItem value="Wharton" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Wharton</SelectItem>
                          <SelectItem value="Wheeler" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Wheeler</SelectItem>
                          <SelectItem value="Wichita" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Wichita</SelectItem>
                          <SelectItem value="Wilbarger" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Wilbarger</SelectItem>
                          <SelectItem value="Willacy" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Willacy</SelectItem>
                          <SelectItem value="Williamson" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Williamson</SelectItem>
                          <SelectItem value="Wilson" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Wilson</SelectItem>
                          <SelectItem value="Winkler" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Winkler</SelectItem>
                          <SelectItem value="Wise" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Wise</SelectItem>
                          <SelectItem value="Wood" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Wood</SelectItem>
                          <SelectItem value="Yoakum" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Yoakum</SelectItem>
                          <SelectItem value="Young" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Young</SelectItem>
                          <SelectItem value="Zapata" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Zapata</SelectItem>
                          <SelectItem value="Zavala" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Zavala</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Workflow Stage Filter */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Workflow Stage
                      </label>
                      <Select value={workflowFilter} onValueChange={setWorkflowFilter}>
                        <SelectTrigger className="w-full bg-slate-700/80 border-slate-600/50 text-white rounded-xl focus:ring-2 focus:ring-blue-500/50 hover:bg-slate-600/80 transition-colors duration-200 cursor-pointer shadow-sm min-h-[44px] flex items-center justify-between px-4 py-2">
                          <SelectValue placeholder="All Stages" />
                        </SelectTrigger>
                        <SelectContent className="bg-gradient-to-br from-slate-800/98 via-slate-900/95 to-slate-800/98 backdrop-blur-xl border border-slate-500/40 rounded-2xl max-h-80 shadow-2xl z-[60] overflow-hidden animate-in slide-in-from-top-2 duration-200">
                          <SelectItem value="all" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 font-medium border-b border-slate-600/30 mb-2 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">All Stages</SelectItem>
                          <SelectItem value="initial_contact" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Initial Contact</SelectItem>
                          <SelectItem value="qualification" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Qualification</SelectItem>
                          <SelectItem value="application_review" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Application Review</SelectItem>
                          <SelectItem value="underwriting" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Underwriting</SelectItem>
                          <SelectItem value="loan_approval" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Loan Approval</SelectItem>
                          <SelectItem value="funding" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Funding</SelectItem>
                          <SelectItem value="servicing" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Servicing</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Second Row - Amount Range and Payment Status */}
                  <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${showAdvancedFilters ? 'block' : 'hidden'}`}>
                    {/* Tax Amount Range */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Tax Amount Range
                      </label>
                      <div className="flex gap-3 items-center">
                        <div className="flex-1">
                          <Input
                            placeholder="Min Amount"
                            value={amountRange.min}
                            onChange={(e) => setAmountRange(prev => ({...prev, min: e.target.value}))}
                            className="py-3 text-white placeholder-gray-400 bg-slate-700/80 border-slate-600/50 rounded-xl focus:ring-2 focus:ring-blue-500/50"
                            type="number"
                          />
                        </div>
                        <div className="px-3 py-2 bg-slate-700/50 rounded-lg">
                          <span className="text-slate-400 font-medium">to</span>
                        </div>
                        <div className="flex-1">
                          <Input
                            placeholder="Max Amount"
                            value={amountRange.max}
                            onChange={(e) => setAmountRange(prev => ({...prev, max: e.target.value}))}
                            className="py-3 text-white placeholder-gray-400 bg-slate-700/80 border-slate-600/50 rounded-xl focus:ring-2 focus:ring-blue-500/50"
                            type="number"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Payment Status */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Payment Status
                      </label>
                      <Select value={paymentFilter} onValueChange={(value) => setPaymentFilter(value as PaymentStatus | 'all')}>
                        <SelectTrigger className="w-full bg-slate-700/80 border-slate-600/50 text-white rounded-xl focus:ring-2 focus:ring-blue-500/50 hover:bg-slate-600/80 transition-colors duration-200 cursor-pointer shadow-sm min-h-[44px] flex items-center justify-between px-4 py-2">
                          <SelectValue placeholder="All Payment Status" />
                        </SelectTrigger>
                        <SelectContent className="bg-gradient-to-br from-slate-800/98 via-slate-900/95 to-slate-800/98 backdrop-blur-xl border border-slate-500/40 rounded-2xl max-h-80 shadow-2xl z-[60] overflow-hidden animate-in slide-in-from-top-2 duration-200">
                          <SelectItem value="all" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 font-medium border-b border-slate-600/30 mb-2 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">All Payment Status</SelectItem>
                          <SelectItem value="current" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Current</SelectItem>
                          <SelectItem value="late_1_30" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">1-30 Days Late</SelectItem>
                          <SelectItem value="late_31_60" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">31-60 Days Late</SelectItem>
                          <SelectItem value="late_61_90" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">61-90 Days Late</SelectItem>
                          <SelectItem value="late_90_plus" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">90+ Days Late</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Action Buttons */}
              <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-3 items-center">
                  {showFilters && (
                    <Button 
                      onClick={clearFilters}
                      variant="outline"
                      className="px-4 py-2 text-slate-300 border-slate-600/50 hover:bg-slate-700 hover:text-white hover:border-slate-500 transition-all duration-200 rounded-xl"
                    >
                      <XMarkIcon className="h-4 w-4 mr-2" />
                      Clear Filters
                    </Button>
                  )}
                  
                  <Button 
                    onClick={() => setShowNewClientModal(true)}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Onboard New Client
                  </Button>
                </div>
                
                <Button
                  onClick={() => {
                    // Generate and download CSV report
                    const csvData = safeClients.map(client => ({
                      'Client Number': client.client_number,
                      'Name': `${client.first_name} ${client.last_name}`,
                      'Email': client.email,
                      'Phone': client.phone_primary,
                      'Tax Amount': client.tax_info?.total_amount_due || 0,
                      'Property Value': client.property_valuation?.market_total_value || 0,
                      'Status': client.status,
                      'Workflow Stage': client.workflow_stage,
                      'County': client.property_address?.county || '',
                      'Created': client.created_at,
                      'Agent': client.assigned_agent || 'Unassigned'
                    }));
                    
                    const csv = [
                      Object.keys(csvData[0]).join(','),
                      ...csvData.map(row => Object.values(row).map(val => `"${val}"`).join(','))
                    ].join('\n');
                    
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `tlc_clients_${new Date().toISOString().split('T')[0]}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    
                    notificationService.success('Report Generated', 'Client report has been downloaded');
                  }}
                  variant="outline"
                  className="px-4 py-3 rounded-xl bg-slate-700/50 hover:bg-slate-600 text-white border-slate-600/50 hover:border-slate-500 transition-all duration-200"
                >
                  <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                  Export Report
                </Button>
              </div>

              {/* Enhanced Clients Table */}
              <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm border border-slate-600/50 rounded-2xl overflow-hidden shadow-2xl">
                <EnhancedTable
                  data={safeClients as any}
                  columns={columns}
                  onRowClick={(record) => {
                    setSelectedClient(record as TLCClient);
                    setShowClientDetails(true);
                  }}
                  className="enhanced-table"
                  scroll={{ x: 1400 }}
                />
              </div>
            </div>
          </div>
        )}

        {activeView === 'upload' && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Data Import Center
              </h2>
              <p className="text-slate-400 mt-2 text-lg">Upload and process CSV files containing client and tax data</p>
              <div className="flex items-center justify-center space-x-4 mt-4">
                <div className="flex items-center space-x-2 px-4 py-2 bg-green-600/20 rounded-full border border-green-500/30">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-green-400 text-sm">Secure Processing</span>
                </div>
                <div className="flex items-center space-x-2 px-4 py-2 bg-blue-600/20 rounded-full border border-blue-500/30">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-blue-400 text-sm">Auto-Validation</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 shadow-2xl">
              <div className="p-8">
                <CSVUploadProcessor
                  onUploadComplete={handleUploadComplete}
                  onDataImported={handleDataImported}
                />
              </div>
            </div>
          </div>
        )}

        {activeView === 'reports' && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Reports & Analytics Center
              </h2>
              <p className="text-slate-400 mt-2 text-lg">Generate detailed reports and analyze client data</p>
              <div className="flex justify-center mt-6">
                <button 
                  onClick={() => {
                    // Generate comprehensive analytics report
                    const report = generateComprehensiveReport(safeClients);
                    downloadReport(report, 'TLC_Comprehensive_Report');
                    notificationService.success('Report Generated', 'Comprehensive client report has been downloaded');
                  }}
                  className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-xl hover:from-slate-800 hover:to-slate-900 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <DocumentArrowDownIcon className="w-5 h-5" />
                  <span>Export Full Report</span>
                </button>
              </div>
            </div>

            {/* Real-time Analytics Dashboard */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Client Status Distribution Chart */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl">
                <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
                  <div className="p-2 bg-blue-500/20 rounded-lg mr-3">
                    <ChartBarIcon className="w-6 h-6 text-blue-500" />
                  </div>
                  Client Status Distribution
                </h3>
                <div className="space-y-4">
                  {(() => {
                    const statusCounts = safeClients.reduce((acc: Record<string, number>, client: TLCClient) => {
                      const status = client.status || 'prospect';
                      acc[status] = (acc[status] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>);
                    
                    const total = safeClients.length;
                    const statusColors: Record<string, string> = {
                      prospect: 'bg-blue-500',
                      lead: 'bg-yellow-500', 
                      applicant: 'bg-orange-500',
                      client: 'bg-green-500',
                      inactive: 'bg-gray-500'
                    };

                    return Object.entries(statusCounts).map(([status, count]) => {
                      const percentage = total > 0 ? ((count as number) / total) * 100 : 0;
                      return (
                        <div key={status} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-300 capitalize">{status.replace('_', ' ')}</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-white font-semibold">{count as number}</span>
                              <span className="text-slate-400 text-sm">({percentage.toFixed(1)}%)</span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-700 rounded-full h-2">
                            <div 
                              className={`${statusColors[status] || 'bg-gray-500'} h-2 rounded-full transition-all duration-1000`}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Tax Amount Distribution */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl">
                <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
                  <div className="p-2 bg-green-500/20 rounded-lg mr-3">
                    <BanknotesIcon className="w-6 h-6 text-green-500" />
                  </div>
                  Tax Amount Ranges
                </h3>
                <div className="space-y-4">
                  {(() => {
                    const ranges = [
                      { label: '$0 - $1,000', min: 0, max: 1000, color: 'bg-blue-500' },
                      { label: '$1,001 - $5,000', min: 1001, max: 5000, color: 'bg-yellow-500' },
                      { label: '$5,001 - $10,000', min: 5001, max: 10000, color: 'bg-orange-500' },
                      { label: '$10,001 - $25,000', min: 10001, max: 25000, color: 'bg-red-500' },
                      { label: '$25,001+', min: 25001, max: Infinity, color: 'bg-purple-500' }
                    ];

                    const total = safeClients.length;
                    
                    return ranges.map(range => {
                      const count = safeClients.filter((client: TLCClient) => {
                        const amount = client.tax_info?.total_amount_due || 0;
                        return amount >= range.min && amount <= range.max;
                      }).length;
                      
                      const percentage = total > 0 ? (count / total) * 100 : 0;
                      
                      return (
                        <div key={range.label} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-300">{range.label}</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-white font-semibold">{count}</span>
                              <span className="text-slate-400 text-sm">({percentage.toFixed(1)}%)</span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-700 rounded-full h-2">
                            <div 
                              className={`${range.color} h-2 rounded-full transition-all duration-1000`}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            {/* County Distribution */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
                <div className="p-2 bg-purple-500/20 rounded-lg mr-3">
                  <BuildingOfficeIcon className="w-6 h-6 text-purple-500" />
                </div>
                Top Counties by Client Count
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(() => {
                  const countyCounts = safeClients.reduce((acc: Record<string, number>, client: TLCClient) => {
                    const county = client.property_address?.county || 'Unknown';
                    acc[county] = (acc[county] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>);
                  
                  const sortedCounties = Object.entries(countyCounts)
                    .sort(([,a], [,b]) => (b as number) - (a as number))
                    .slice(0, 9);
                  
                  const maxCount = Math.max(...sortedCounties.map(([,count]) => count as number));
                  
                  return sortedCounties.map(([county, count], index) => {
                    const percentage = maxCount > 0 ? ((count as number) / maxCount) * 100 : 0;
                    const colors = [
                      'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 
                      'bg-purple-500', 'bg-red-500', 'bg-indigo-500',
                      'bg-pink-500', 'bg-teal-500', 'bg-orange-500'
                    ];
                    
                    return (
                      <div key={county} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-300 font-medium">{county}</span>
                          <span className="text-white font-semibold">{count as number}</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div 
                            className={`${colors[index]} h-2 rounded-full transition-all duration-1000`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Financial Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl text-center">
                <div className="p-3 bg-green-500/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <BanknotesIcon className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Total Portfolio Value</h3>
                <p className="text-3xl font-bold text-green-400">
                  {formatCurrency(safeClients.reduce((sum: number, client: TLCClient) => sum + (client.tax_info?.total_amount_due || 0), 0))}
                </p>
              </div>
              
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl text-center">
                <div className="p-3 bg-blue-500/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <UserIcon className="w-8 h-8 text-blue-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Total Clients</h3>
                <p className="text-3xl font-bold text-blue-400">{safeClients.length.toLocaleString()}</p>
              </div>
              
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl text-center">
                <div className="p-3 bg-purple-500/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <ChartBarIcon className="w-8 h-8 text-purple-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Average Tax Amount</h3>
                <p className="text-3xl font-bold text-purple-400">
                  {formatCurrency(safeClients.length > 0 ? 
                    safeClients.reduce((sum: number, client: TLCClient) => sum + (client.tax_info?.total_amount_due || 0), 0) / safeClients.length : 0
                  )}
                </p>
              </div>
            </div>

            {/* Enhanced Report Templates */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:transform hover:scale-105">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <UserIcon className="w-6 h-6 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Client Portfolio Report</h3>
                </div>
                <p className="text-slate-400 mb-4">Comprehensive overview of all clients, statuses, and loan performance</p>
                <button 
                  onClick={() => {
                    const report = generateClientPortfolioReport(safeClients);
                    downloadReport(report, 'Client_Portfolio_Report');
                    notificationService.success('Report Generated', 'Client portfolio report has been downloaded');
                  }}
                  className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Generate Report
                </button>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:transform hover:scale-105">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <ChartBarIcon className="w-6 h-6 text-green-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Performance Analytics</h3>
                </div>
                <p className="text-slate-400 mb-4">Loan approval rates, processing times, and profitability metrics</p>
                <button 
                  onClick={() => {
                    const report = generatePerformanceReport(safeClients);
                    downloadReport(report, 'Performance_Analytics_Report');
                    notificationService.success('Report Generated', 'Performance analytics report has been downloaded');
                  }}
                  className="w-full px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Generate Report
                </button>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:transform hover:scale-105">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <DocumentTextIcon className="w-6 h-6 text-yellow-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Tax Data Summary</h3>
                </div>
                <p className="text-slate-400 mb-4">Tax amounts, counties, and property valuation analysis</p>
                <button 
                  onClick={() => {
                    const report = generateTaxDataReport(safeClients);
                    downloadReport(report, 'Tax_Data_Summary_Report');
                    notificationService.success('Report Generated', 'Tax data summary report has been downloaded');
                  }}
                  className="w-full px-4 py-2 bg-gradient-to-r from-yellow-600 to-yellow-700 text-white rounded-lg hover:from-yellow-700 hover:to-yellow-800 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Generate Report
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payment Processing Modal */}
        {showPaymentModal && selectedClient && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-slate-800 border border-slate-600 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slideIn">
              <div className="p-8">
                <div className="flex items-start justify-between mb-8">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                      <CreditCardIcon className="h-7 w-7 text-green-400" />
                      Process Payment
                    </h2>
                    <p className="text-gray-400">
                      Process payment for {selectedClient?.first_name || 'N/A'} {selectedClient?.last_name || ''}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowPaymentModal(false);
                      setSelectedClient(null);
                      setPaymentAmount('');
                    }}
                    className="text-gray-400 hover:text-white hover:bg-gray-700/50 p-2 rounded-lg transition-all duration-200"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">Current Balance</label>
                      <p className="text-white bg-slate-700 px-3 py-2 rounded-lg font-mono">
                        {formatCurrency(selectedClient?.tax_info?.total_amount_due || 0)}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">Next Payment Due</label>
                      <p className="text-white bg-slate-700 px-3 py-2 rounded-lg">
                        {formatCurrency(selectedClient?.loan_info?.monthly_payment || 0)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Payment Amount</label>
                    <Input
                      type="number"
                      placeholder="Enter payment amount"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="text-white bg-slate-700 border-slate-600"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row justify-end gap-4 pt-6 border-t border-gray-700/50">
                    <Button
                      onClick={() => {
                        setShowPaymentModal(false);
                        setSelectedClient(null);
                        setPaymentAmount('');
                      }}
                      className="px-6 py-3 rounded-xl bg-slate-600 hover:bg-slate-500 text-white border border-slate-500 transition-all duration-200"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => processPaymentMutation.mutate({
                        clientId: selectedClient.id.toString(),
                        amount: parseFloat(paymentAmount)
                      })}
                      disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      <CreditCardIcon className="h-4 w-4 mr-2" />
                      Process Payment
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Client Details Modal */}
        {showClientDetails && selectedClient && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-slate-800 border border-slate-600 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-slideIn">
              <div className="p-8">
                <div className="flex items-start justify-between mb-8">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                      <UserIcon className="h-7 w-7 text-blue-400" />
                      {selectedClient?.first_name || 'N/A'} {selectedClient?.last_name || ''}
                    </h2>
                    <p className="text-gray-400">Client ID: {selectedClient?.client_number || 'N/A'}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowClientDetails(false);
                      setSelectedClient(null);
                    }}
                    className="text-gray-400 hover:text-white hover:bg-gray-700/50 p-2 rounded-lg transition-all duration-200"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  {/* Personal Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white border-b border-gray-600 pb-2">Personal Information</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Email:</span>
                        <span className="text-white">{selectedClient?.email || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Phone:</span>
                        <span className="text-white">{selectedClient?.phone_primary || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Address:</span>
                        <span className="text-white text-right">{selectedClient?.mailing_address?.street_1 || 'N/A'}, {selectedClient?.mailing_address?.city || 'N/A'}, {selectedClient?.mailing_address?.state || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Date of Birth:</span>
                        <span className="text-white">{formatDate(selectedClient?.date_of_birth || '')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Loan Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white border-b border-gray-600 pb-2">Loan Information</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Loan ID:</span>
                        <span className="text-white font-mono">{selectedClient?.tax_info?.account_number || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Original Amount:</span>
                        <span className="text-white">{formatCurrency(selectedClient?.tax_info?.original_tax_amount || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Current Balance:</span>
                        <span className="text-white font-semibold">{formatCurrency(selectedClient?.tax_info?.total_amount_due || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Interest Rate:</span>
                        <span className="text-white">{selectedClient.loan_info?.interest_rate || 0}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Monthly Payment:</span>
                        <span className="text-white">{formatCurrency(selectedClient.loan_info?.monthly_payment || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Payments Made:</span>
                        <span className="text-white">{selectedClient.loan_info?.term_months || 0} months</span>
                      </div>
                    </div>
                  </div>

                  {/* Property Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white border-b border-gray-600 pb-2">Property Information</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Address:</span>
                        <span className="text-white text-right">{selectedClient.property_address?.street_1}, {selectedClient.property_address?.city}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Estimated Value:</span>
                        <span className="text-white">{formatCurrency(selectedClient.property_valuation?.market_total_value || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Tax Amount:</span>
                        <span className="text-white">{formatCurrency(selectedClient.tax_info?.total_amount_due || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">County:</span>
                        <span className="text-white">{selectedClient.property_address?.county}, {selectedClient.property_address?.state}</span>
                      </div>
                    </div>
                  </div>

                  {/* Account Status */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white border-b border-gray-600 pb-2">Account Status</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Account Status:</span>
                        <Badge variant={getAccountStatusBadgeType(selectedClient.status || 'prospect') as any}>
                          {selectedClient.status ? selectedClient.status.charAt(0).toUpperCase() + selectedClient.status.slice(1) : 'Prospect'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Payment Status:</span>
                        <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border backdrop-blur-sm bg-blue-500/20 text-blue-400 border-blue-500/30`}>
                          {selectedClient.workflow_stage || 'New'}
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Last Payment:</span>
                        <span className="text-white">
                          {selectedClient.last_contact ? formatDate(selectedClient.last_contact) : 'No contact yet'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Assigned Servicer:</span>
                        <span className="text-white">{selectedClient.assigned_agent || 'Unassigned'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-4 pt-8 border-t border-gray-700/50 mt-8">
                  <Button
                    onClick={() => {
                      setShowClientDetails(false);
                      setSelectedClient(null);
                    }}
                    className="px-6 py-3 rounded-xl bg-slate-600 hover:bg-slate-500 text-white border border-slate-500 transition-all duration-200"
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      setShowClientDetails(false);
                      setShowPaymentModal(true);
                    }}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-slate-700 to-slate-800 text-white hover:from-slate-800 hover:to-slate-900 shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <CreditCardIcon className="h-4 w-4 mr-2" />
                    Process Payment
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* New Client Modal */}
        {showNewClientModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-slate-800 border border-slate-600 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slideIn">
              <div className="p-8">
                <div className="flex items-start justify-between mb-8">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                      <PlusIcon className="h-7 w-7 text-green-400" />
                      Onboard New Client
                    </h2>
                    <p className="text-gray-400">Add a new client to the TLC system</p>
                  </div>
                  <button
                    onClick={() => setShowNewClientModal(false)}
                    className="text-gray-400 hover:text-white hover:bg-gray-700/50 p-2 rounded-lg transition-all duration-200"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <CheckCircleIcon className="w-5 h-5 text-blue-500" />
                      <h4 className="text-blue-500 font-medium">Client Onboarding Process</h4>
                    </div>
                    <p className="text-blue-400 text-sm">
                      Use the Import Data section to upload CSV files with client information, or create clients manually through the detailed onboarding workflow.
                    </p>
                  </div>

                  <div className="text-center py-8">
                    <UserIcon className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">Multiple Onboarding Options</h3>
                    <p className="text-gray-400 mb-6">
                      Choose how you'd like to add new clients to the system.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <Button
                        onClick={() => {
                          setShowNewClientModal(false);
                          setActiveView('upload');
                        }}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-slate-700 to-slate-800 text-white hover:from-slate-800 hover:to-slate-900 shadow-lg hover:shadow-xl transition-all duration-200"
                      >
                        <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                        Import from CSV
                      </Button>
                      <Button
                        onClick={() => {
                          setShowNewClientModal(false);
                          setShowManualEntryModal(true);
                          setOnboardingStep(1);
                        }}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all duration-200"
                      >
                        <UserIcon className="h-4 w-4 mr-2" />
                        Manual Entry
                      </Button>
                      <Button
                        onClick={() => setShowNewClientModal(false)}
                        className="px-6 py-3 rounded-xl bg-slate-600 hover:bg-slate-500 text-white border border-slate-500 transition-all duration-200"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Manual Entry Onboarding Modal */}
        {showManualEntryModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-slate-800 border border-slate-600 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-slideIn">
              <div className="p-8">
                {/* Header */}
                <div className="flex items-start justify-between mb-8">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                      <UserIcon className="h-7 w-7 text-blue-400" />
                      Client Onboarding - Step {onboardingStep} of 3
                    </h2>
                    <p className="text-gray-400">
                      {onboardingStep === 1 && "Personal & Contact Information"}
                      {onboardingStep === 2 && "Property & Tax Information"}
                      {onboardingStep === 3 && "Property Photos & Documentation"}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowManualEntryModal(false);
                      setOnboardingStep(1);
                      setOnboardingData({
                        firstName: '', lastName: '', email: '', phone: '',
                        propertyAddress: '', propertyCity: '', propertyState: 'TX',
                        propertyZip: '', propertyCounty: '', taxAmount: '',
                        accountNumber: '', propertyValue: '',
                        propertyPhotos: [], documentPhotos: []
                      });
                    }}
                    className="text-gray-400 hover:text-white hover:bg-gray-700/50 p-2 rounded-lg transition-all duration-200"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">Progress</span>
                    <span className="text-sm text-slate-400">{Math.round((onboardingStep / 3) * 100)}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(onboardingStep / 3) * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* Step Content */}
                <div className="space-y-6">
                  {/* Step 1: Personal Information */}
                  {onboardingStep === 1 && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-300">First Name *</label>
                          <Input
                            type="text"
                            placeholder="Enter first name"
                            value={onboardingData.firstName}
                            onChange={(e) => setOnboardingData(prev => ({...prev, firstName: e.target.value}))}
                            className="text-white bg-slate-700 border-slate-600 focus:border-blue-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-300">Last Name *</label>
                          <Input
                            type="text"
                            placeholder="Enter last name"
                            value={onboardingData.lastName}
                            onChange={(e) => setOnboardingData(prev => ({...prev, lastName: e.target.value}))}
                            className="text-white bg-slate-700 border-slate-600 focus:border-blue-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-300">Email Address *</label>
                          <Input
                            type="email"
                            placeholder="Enter email address"
                            value={onboardingData.email}
                            onChange={(e) => setOnboardingData(prev => ({...prev, email: e.target.value}))}
                            className="text-white bg-slate-700 border-slate-600 focus:border-blue-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-300">Phone Number *</label>
                          <Input
                            type="tel"
                            placeholder="(555) 123-4567"
                            value={onboardingData.phone}
                            onChange={(e) => setOnboardingData(prev => ({...prev, phone: e.target.value}))}
                            className="text-white bg-slate-700 border-slate-600 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Property Information */}
                  {onboardingStep === 2 && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-300">Property Address *</label>
                          <Input
                            type="text"
                            placeholder="1234 Main Street"
                            value={onboardingData.propertyAddress}
                            onChange={(e) => setOnboardingData(prev => ({...prev, propertyAddress: e.target.value}))}
                            className="text-white bg-slate-700 border-slate-600 focus:border-blue-500"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">City *</label>
                            <Input
                              type="text"
                              placeholder="Dallas"
                              value={onboardingData.propertyCity}
                              onChange={(e) => setOnboardingData(prev => ({...prev, propertyCity: e.target.value}))}
                              className="text-white bg-slate-700 border-slate-600 focus:border-blue-500"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">State</label>
                            <Input
                              type="text"
                              value="TX"
                              disabled
                              className="text-white bg-slate-700 border-slate-600"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">ZIP Code *</label>
                            <Input
                              type="text"
                              placeholder="75201"
                              value={onboardingData.propertyZip}
                              onChange={(e) => setOnboardingData(prev => ({...prev, propertyZip: e.target.value}))}
                              className="text-white bg-slate-700 border-slate-600 focus:border-blue-500"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-300">County *</label>
                          <Select value={onboardingData.propertyCounty} onValueChange={(value) => setOnboardingData(prev => ({...prev, propertyCounty: value}))}>
                            <SelectTrigger className="w-full bg-slate-700 border-slate-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500/50">
                              <SelectValue placeholder="Select County" />
                            </SelectTrigger>
                            <SelectContent className="bg-gradient-to-br from-slate-800/98 via-slate-900/95 to-slate-800/98 backdrop-blur-xl border border-slate-500/40 rounded-2xl max-h-80 shadow-2xl z-[60] overflow-hidden animate-in slide-in-from-top-2 duration-200">
                              <SelectItem value="Anderson" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Anderson</SelectItem>
                              <SelectItem value="Dallas" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Dallas</SelectItem>
                              <SelectItem value="Harris" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Harris</SelectItem>
                              <SelectItem value="Tarrant" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Tarrant</SelectItem>
                              <SelectItem value="Travis" className="text-slate-200 hover:bg-gradient-to-r hover:from-blue-500/30 hover:via-purple-500/25 hover:to-cyan-500/20 hover:text-white hover:shadow-lg hover:shadow-blue-500/20 focus:bg-blue-600/40 focus:text-white cursor-pointer transition-all duration-300 rounded-lg mx-1 my-0.5 px-4 py-2.5 border border-transparent hover:border-blue-400/30 backdrop-blur-sm">Travis</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Tax Amount Owed *</label>
                            <Input
                              type="number"
                              placeholder="15000"
                              value={onboardingData.taxAmount}
                              onChange={(e) => setOnboardingData(prev => ({...prev, taxAmount: e.target.value}))}
                              className="text-white bg-slate-700 border-slate-600 focus:border-blue-500"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Account Number</label>
                            <Input
                              type="text"
                              placeholder="TX-123456789"
                              value={onboardingData.accountNumber}
                              onChange={(e) => setOnboardingData(prev => ({...prev, accountNumber: e.target.value}))}
                              className="text-white bg-slate-700 border-slate-600 focus:border-blue-500"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Property Value</label>
                            <Input
                              type="number"
                              placeholder="250000"
                              value={onboardingData.propertyValue}
                              onChange={(e) => setOnboardingData(prev => ({...prev, propertyValue: e.target.value}))}
                              className="text-white bg-slate-700 border-slate-600 focus:border-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Photo Upload */}
                  {onboardingStep === 3 && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Property Photos */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-white">Property Photos</h3>
                          <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                setOnboardingData(prev => ({...prev, propertyPhotos: [...prev.propertyPhotos, ...files]}));
                              }}
                              className="hidden"
                              id="property-photos"
                            />
                            <label htmlFor="property-photos" className="cursor-pointer">
                              <div className="space-y-2">
                                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto">
                                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                                <p className="text-white font-medium">Upload Property Photos</p>
                                <p className="text-slate-400 text-sm">Front, back, and side views of the property</p>
                              </div>
                            </label>
                          </div>
                          {onboardingData.propertyPhotos.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-sm text-slate-300">{onboardingData.propertyPhotos.length} photos uploaded</p>
                              <div className="grid grid-cols-2 gap-2">
                                {onboardingData.propertyPhotos.slice(0, 4).map((file, index) => (
                                  <div key={index} className="relative">
                                    <img
                                      src={URL.createObjectURL(file)}
                                      alt={`Property ${index + 1}`}
                                      className="w-full h-20 object-cover rounded-lg"
                                    />
                                    <button
                                      onClick={() => {
                                        const newPhotos = onboardingData.propertyPhotos.filter((_, i) => i !== index);
                                        setOnboardingData(prev => ({...prev, propertyPhotos: newPhotos}));
                                      }}
                                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Document Photos */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-white">Tax Documents</h3>
                          <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center hover:border-green-500 transition-colors">
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              multiple
                              onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                setOnboardingData(prev => ({...prev, documentPhotos: [...prev.documentPhotos, ...files]}));
                              }}
                              className="hidden"
                              id="document-photos"
                            />
                            <label htmlFor="document-photos" className="cursor-pointer">
                              <div className="space-y-2">
                                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto">
                                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </div>
                                <p className="text-white font-medium">Upload Tax Documents</p>
                                <p className="text-slate-400 text-sm">Tax statements, lien documents, etc.</p>
                              </div>
                            </label>
                          </div>
                          {onboardingData.documentPhotos.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-sm text-slate-300">{onboardingData.documentPhotos.length} documents uploaded</p>
                              <div className="space-y-1">
                                {onboardingData.documentPhotos.map((file, index) => (
                                  <div key={index} className="flex items-center justify-between bg-slate-700 p-2 rounded">
                                    <span className="text-sm text-white truncate">{file.name}</span>
                                    <button
                                      onClick={() => {
                                        const newDocs = onboardingData.documentPhotos.filter((_, i) => i !== index);
                                        setOnboardingData(prev => ({...prev, documentPhotos: newDocs}));
                                      }}
                                      className="w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 ml-2"
                                    >
                                      ×
                                    </button>
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

                {/* Navigation Buttons */}
                <div className="flex justify-between pt-8 border-t border-slate-700">
                  <Button
                    onClick={() => {
                      if (onboardingStep > 1) {
                        setOnboardingStep(onboardingStep - 1);
                      } else {
                        setShowManualEntryModal(false);
                      }
                    }}
                    className="px-6 py-3 rounded-xl bg-slate-600 hover:bg-slate-500 text-white border border-slate-500 transition-all duration-200"
                  >
                    {onboardingStep === 1 ? 'Cancel' : 'Previous'}
                  </Button>
                  
                  <Button
                    onClick={() => {
                      if (onboardingStep < 3) {
                        setOnboardingStep(onboardingStep + 1);
                      } else {
                        // Submit the form
                        console.log('Submitting onboarding data:', onboardingData);
                        notificationService.success('Client Created', 'New client has been successfully onboarded!');
                        setShowManualEntryModal(false);
                        setOnboardingStep(1);
                        setOnboardingData({
                          firstName: '', lastName: '', email: '', phone: '',
                          propertyAddress: '', propertyCity: '', propertyState: 'TX',
                          propertyZip: '', propertyCounty: '', taxAmount: '',
                          accountNumber: '', propertyValue: '',
                          propertyPhotos: [], documentPhotos: []
                        });
                      }
                    }}
                    disabled={
                      (onboardingStep === 1 && (!onboardingData.firstName || !onboardingData.lastName || !onboardingData.email || !onboardingData.phone)) ||
                      (onboardingStep === 2 && (!onboardingData.propertyAddress || !onboardingData.propertyCity || !onboardingData.propertyZip || !onboardingData.propertyCounty || !onboardingData.taxAmount))
                    }
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {onboardingStep === 3 ? 'Create Client' : 'Next'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TLCClients;