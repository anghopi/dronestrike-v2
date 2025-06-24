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

const TLCClients: React.FC = () => {
  const [activeView, setActiveView] = useState<'dashboard' | 'clients' | 'upload' | 'reports'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'all'>('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | 'all'>('all');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showClientDetails, setShowClientDetails] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [clientCount, setClientCount] = useState(0);
  const [, setRecentImports] = useState<CSVImportJob[]>([]);
  const queryClient = useQueryClient();

  // Fetch clients data using proper service
  const { data: clientsData, isLoading, error } = useQuery({
    queryKey: ['tlc-clients', searchTerm, statusFilter, paymentFilter],
    queryFn: () => tlcClientService.getClients(
      {
        search_term: searchTerm || undefined,
        status: statusFilter !== 'all' ? [statusFilter] : undefined,
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
            {record.property_address?.county || 'Unknown'} County
          </div>
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
      render: (value: ClientStatus) => (
        <Badge variant={getAccountStatusBadgeType(value) as any}>
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </Badge>
      )
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
              tabs={tabs}
              activeTab={statusFilter === 'all' ? 'all' : statusFilter}
              onTabChange={(tabId) => setStatusFilter(tabId as ClientStatus | 'all')}
            />
            
            <div className="flex-1 p-8 space-y-8 overflow-auto bg-gradient-to-br from-navy-blue-dark/50 to-navy-blue/30">
              {/* Portfolio Metrics Cards */}
              <div className="flex gap-3 max-w-4xl">
                <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 bg-gradient-to-br from-green-600/20 to-green-800/30 border-green-500/30 min-w-fit">
                  <div className="flex items-center gap-2">
                    <BanknotesIcon className="h-4 w-4 text-green-400" />
                    <div>
                      <p className="text-green-300 text-xs font-medium">Portfolio</p>
                      <p className="text-lg font-bold text-white">
                        ${((clientsData?.total || 0) / 1000).toFixed(0)}K
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 bg-gradient-to-br from-blue-600/20 to-blue-800/30 border-blue-500/30 min-w-fit">
                  <div className="flex items-center gap-2">
                    <CreditCardIcon className="h-4 w-4 text-blue-400" />
                    <div>
                      <p className="text-blue-300 text-xs font-medium">Total Clients</p>
                      <p className="text-lg font-bold text-white">
                        {clientsData?.total || 0}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 bg-gradient-to-br from-purple-600/20 to-purple-800/30 border-purple-500/30 min-w-fit">
                  <div className="flex items-center gap-2">
                    <ChartBarIcon className="h-4 w-4 text-purple-400" />
                    <div>
                      <p className="text-purple-300 text-xs font-medium">Success Rate</p>
                      <p className="text-lg font-bold text-white">
                        95%
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 bg-gradient-to-br from-orange-600/20 to-orange-800/30 border-orange-500/30 min-w-fit">
                  <div className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4 text-orange-400" />
                    <div>
                      <p className="text-orange-300 text-xs font-medium">Active Clients</p>
                      <p className="text-lg font-bold text-white">
                        {safeClients.filter(c => c.status === 'client').length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-slate-800 border border-slate-600 rounded-lg p-6">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1">
                    <div className="relative flex-1 max-w-md">
                      <Input
                        placeholder="Search clients..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-4 pr-4 py-3 text-white placeholder-gray-400 bg-slate-700 border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                      />
                    </div>
                    <Select value={paymentFilter} onValueChange={(value) => setPaymentFilter(value as PaymentStatus | 'all')}>
                      <SelectTrigger className="w-52 bg-slate-700 border-slate-600 text-white rounded-xl">
                        <SelectValue placeholder="Payment status" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600 rounded-xl">
                        <SelectItem value="all" className="text-white hover:bg-slate-700">All Payment Status</SelectItem>
                        <SelectItem value="current" className="text-white hover:bg-slate-700">Current</SelectItem>
                        <SelectItem value="late_1_30" className="text-white hover:bg-slate-700">1-30 Days Late</SelectItem>
                        <SelectItem value="late_31_60" className="text-white hover:bg-slate-700">31-60 Days Late</SelectItem>
                        <SelectItem value="late_61_90" className="text-white hover:bg-slate-700">61-90 Days Late</SelectItem>
                        <SelectItem value="late_90_plus" className="text-white hover:bg-slate-700">90+ Days Late</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button 
                      onClick={() => setShowNewClientModal(true)}
                      className="px-6 py-2 rounded-xl bg-gradient-to-r from-slate-700 to-slate-800 text-white hover:from-slate-800 hover:to-slate-900 shadow-lg hover:shadow-xl transition-all duration-200"
                    >
                      <PlusIcon className="h-4 w-4 mr-2" />
                      Onboard Client
                    </Button>
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
                        ].join('\\n');
                        
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
                      className="px-4 py-2 rounded-xl bg-slate-600 hover:bg-slate-500 text-white border border-slate-500 transition-all duration-200"
                    >
                      <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                      Generate Report
                    </Button>
                  </div>
                </div>
              </div>

              {/* Clients Table */}
              <div className="bg-slate-800 border border-slate-600 rounded-lg">
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
                <button className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-xl hover:from-slate-800 hover:to-slate-900 transition-all duration-200 shadow-lg hover:shadow-xl">
                  <PlusIcon className="w-5 h-5" />
                  <span>Create Custom Report</span>
                </button>
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
                <button className="w-full px-4 py-2 bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-lg hover:from-slate-800 hover:to-slate-900 transition-all duration-200 shadow-lg hover:shadow-xl">
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
                <button className="w-full px-4 py-2 bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-lg hover:from-slate-800 hover:to-slate-900 transition-all duration-200 shadow-lg hover:shadow-xl">
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
                <button className="w-full px-4 py-2 bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-lg hover:from-slate-800 hover:to-slate-900 transition-all duration-200 shadow-lg hover:shadow-xl">
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
                        <Badge variant={getAccountStatusBadgeType(selectedClient.status) as any}>
                          {selectedClient.status.charAt(0).toUpperCase() + selectedClient.status.slice(1)}
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
                          notificationService.info('Manual Entry', 'Manual client entry form coming soon!');
                        }}
                        className="px-6 py-3 rounded-xl bg-slate-600 hover:bg-slate-500 text-white border border-slate-500 transition-all duration-200"
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
      </div>
    </div>
  );
};

export default TLCClients;