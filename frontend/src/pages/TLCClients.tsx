import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  UserIcon,
  CreditCardIcon,
  DocumentTextIcon,
  PhoneIcon,
  EnvelopeIcon,
  CalendarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  BanknotesIcon,
  ChartBarIcon,
  PlusIcon,
  EyeIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { HeaderTabs } from '../components/Layout/HeaderTabs';
import { EnhancedTable, ColumnConfig } from '../components/ui/enhanced-table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../hooks/useAuth';
import { notificationService } from '../services/notificationService';

// TLC Client interface based on architecture
interface TLCClient {
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

// Mock TLC Client API service
const tlcClientService = {
  getClients: async (params?: any) => {
    // Mock client data based on TLC architecture
    return {
      results: [
        {
          id: 1,
          client_number: 'TLC-2025-4567',
          personal_info: {
            first_name: 'Maria',
            last_name: 'Garcia',
            email: 'maria.garcia@email.com',
            phone: '+1-555-0123',
            address: '456 Oak Ave, Dallas, TX 75202',
            date_of_birth: '1985-03-15'
          },
          loan_info: {
            loan_id: 'TLC-LOAN-001',
            original_amount: 95000,
            current_balance: 87500,
            interest_rate: 7.75,
            term_months: 36,
            monthly_payment: 3123.45,
            payment_due_date: '2025-07-01',
            next_payment_amount: 3123.45,
            payments_made: 3,
            payments_remaining: 33
          },
          property_info: {
            address: '456 Oak Ave, Dallas, TX 75202',
            estimated_value: 145000,
            tax_amount: 3200,
            county: 'Dallas',
            state: 'TX'
          },
          account_status: 'active',
          payment_status: 'current',
          last_payment_date: '2025-06-01',
          last_payment_amount: 3123.45,
          communication_preferences: {
            email_enabled: true,
            sms_enabled: true,
            phone_enabled: false,
            mail_enabled: true
          },
          documents: {
            loan_agreement: true,
            payment_history: true,
            tax_documents: true,
            insurance_docs: true
          },
          created_at: '2025-03-15T10:00:00Z',
          updated_at: '2025-06-17T09:00:00Z',
          assigned_servicer: {
            id: 1,
            name: 'Jennifer Adams',
            email: 'jennifer.adams@tlc.com',
            phone: '+1-555-0200'
          }
        },
        {
          id: 2,
          client_number: 'TLC-2025-4568',
          personal_info: {
            first_name: 'Robert',
            last_name: 'Wilson',
            email: 'robert.wilson@email.com',
            phone: '+1-555-0124',
            address: '789 Pine St, Dallas, TX 75203',
            date_of_birth: '1978-11-22'
          },
          loan_info: {
            loan_id: 'TLC-LOAN-002',
            original_amount: 65000,
            current_balance: 58900,
            interest_rate: 9.25,
            term_months: 24,
            monthly_payment: 3078.22,
            payment_due_date: '2025-06-25',
            next_payment_amount: 3078.22,
            payments_made: 2,
            payments_remaining: 22
          },
          property_info: {
            address: '789 Pine St, Dallas, TX 75203',
            estimated_value: 120000,
            tax_amount: 2800,
            county: 'Dallas',
            state: 'TX'
          },
          account_status: 'active',
          payment_status: 'late_1_30',
          last_payment_date: '2025-05-20',
          last_payment_amount: 3078.22,
          communication_preferences: {
            email_enabled: true,
            sms_enabled: false,
            phone_enabled: true,
            mail_enabled: false
          },
          documents: {
            loan_agreement: true,
            payment_history: true,
            tax_documents: false,
            insurance_docs: true
          },
          created_at: '2025-04-10T14:30:00Z',
          updated_at: '2025-06-17T08:30:00Z',
          assigned_servicer: {
            id: 2,
            name: 'David Kim',
            email: 'david.kim@tlc.com',
            phone: '+1-555-0201'
          }
        },
        {
          id: 3,
          client_number: 'TLC-2025-4569',
          personal_info: {
            first_name: 'Sarah',
            last_name: 'Johnson',
            email: 'sarah.johnson@email.com',
            phone: '+1-555-0125',
            address: '321 Elm St, Dallas, TX 75204',
            date_of_birth: '1990-07-08'
          },
          loan_info: {
            loan_id: 'TLC-LOAN-003',
            original_amount: 82000,
            current_balance: 0,
            interest_rate: 8.50,
            term_months: 24,
            monthly_payment: 3890.15,
            payment_due_date: '',
            next_payment_amount: 0,
            payments_made: 24,
            payments_remaining: 0
          },
          property_info: {
            address: '321 Elm St, Dallas, TX 75204',
            estimated_value: 135000,
            tax_amount: 3100,
            county: 'Dallas',
            state: 'TX'
          },
          account_status: 'paid_off',
          payment_status: 'current',
          last_payment_date: '2025-06-15',
          last_payment_amount: 3890.15,
          communication_preferences: {
            email_enabled: true,
            sms_enabled: true,
            phone_enabled: false,
            mail_enabled: true
          },
          documents: {
            loan_agreement: true,
            payment_history: true,
            tax_documents: true,
            insurance_docs: true
          },
          created_at: '2023-06-15T12:00:00Z',
          updated_at: '2025-06-15T16:45:00Z',
          assigned_servicer: {
            id: 1,
            name: 'Jennifer Adams',
            email: 'jennifer.adams@tlc.com',
            phone: '+1-555-0200'
          }
        }
      ],
      count: 3,
      total_portfolio_value: 242000,
      total_outstanding: 146400,
      avg_payment_rate: 0.92
    };
  },
  
  processPayment: async (clientId: number, amount: number) => {
    return { success: true, transaction_id: `TXN-${Date.now()}` };
  },
  
  updateCommunicationPreferences: async (clientId: number, preferences: any) => {
    return { success: true };
  }
};

type ClientStatus = TLCClient['account_status'];
type PaymentStatus = TLCClient['payment_status'];

const TLCClients: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'all'>('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | 'all'>('all');
  const [selectedClient, setSelectedClient] = useState<TLCClient | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch clients data
  const { data: clientsData, isLoading, error } = useQuery({
    queryKey: ['tlc-clients', searchTerm, statusFilter, paymentFilter],
    queryFn: () => tlcClientService.getClients({
      search: searchTerm || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      payment_status: paymentFilter !== 'all' ? paymentFilter : undefined,
    }),
  });

  const safeClients = clientsData?.results || [];

  // Process payment mutation
  const processPaymentMutation = useMutation({
    mutationFn: ({ clientId, amount }: { clientId: number; amount: number }) => 
      tlcClientService.processPayment(clientId, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tlc-clients'] });
      notificationService.success('Payment Processed', 'Payment has been processed successfully');
      setShowPaymentModal(false);
      setSelectedClient(null);
      setPaymentAmount('');
    },
  });

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
    const statusMap = {
      'active': 'success',
      'delinquent': 'warning',
      'paid_off': 'info',
      'default': 'danger',
      'in_modification': 'warning'
    };
    return statusMap[status] || 'pending';
  };

  const getPaymentStatusColor = (status: PaymentStatus) => {
    const colors = {
      'current': 'bg-green-500/20 text-green-300 border-green-500/30',
      'late_1_30': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      'late_31_60': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      'late_61_90': 'bg-red-500/20 text-red-300 border-red-500/30',
      'late_90_plus': 'bg-red-600/20 text-red-200 border-red-600/30'
    };
    return colors[status] || colors['current'];
  };

  const getPaymentStatusLabel = (status: PaymentStatus) => {
    const labels = {
      'current': 'Current',
      'late_1_30': '1-30 Days Late',
      'late_31_60': '31-60 Days Late',
      'late_61_90': '61-90 Days Late',
      'late_90_plus': '90+ Days Late'
    };
    return labels[status] || status;
  };

  const columns: ColumnConfig<TLCClient>[] = useMemo(() => [
    {
      key: 'client_number',
      title: 'Client ID',
      dataIndex: 'client_number',
      sortable: true,
      render: (value: string, record: TLCClient) => (
        <div className="space-y-1">
          <div className="font-mono font-bold text-white">{value}</div>
          <div className="text-xs text-gray-400">{formatDate(record.created_at)}</div>
        </div>
      )
    },
    {
      key: 'personal_info',
      title: 'Client Information',
      render: (value: any, record: TLCClient) => (
        <div className="space-y-1 max-w-xs">
          <div className="font-semibold text-white">
            {record.personal_info.first_name} {record.personal_info.last_name}
          </div>
          <div className="text-sm text-gray-400">{record.personal_info.email}</div>
          <div className="text-sm text-gray-400 font-mono">{record.personal_info.phone}</div>
        </div>
      )
    },
    {
      key: 'loan_info',
      title: 'Loan Details',
      render: (value: any, record: TLCClient) => (
        <div className="space-y-1">
          <div className="font-semibold text-white">{formatCurrency(record.loan_info.current_balance)}</div>
          <div className="text-sm text-gray-400">
            of {formatCurrency(record.loan_info.original_amount)}
          </div>
          <div className="text-xs text-gray-400">
            {record.loan_info.interest_rate}% • {record.loan_info.payments_remaining} payments left
          </div>
        </div>
      )
    },
    {
      key: 'monthly_payment',
      title: 'Monthly Payment',
      render: (value: any, record: TLCClient) => (
        <div className="space-y-1">
          <div className="font-semibold text-white">{formatCurrency(record.loan_info.monthly_payment)}</div>
          <div className="text-sm text-gray-400">
            Due: {formatDate(record.loan_info.payment_due_date)}
          </div>
        </div>
      )
    },
    {
      key: 'account_status',
      title: 'Account Status',
      render: (value: ClientStatus) => (
        <Badge variant={getAccountStatusBadgeType(value) as any}>
          {value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </Badge>
      )
    },
    {
      key: 'payment_status',
      title: 'Payment Status',
      render: (value: PaymentStatus) => (
        <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border backdrop-blur-sm ${getPaymentStatusColor(value)}`}>
          {getPaymentStatusLabel(value)}
        </div>
      )
    },
    {
      key: 'last_payment',
      title: 'Last Payment',
      render: (value: any, record: TLCClient) => (
        <div className="space-y-1">
          <div className="font-semibold text-white">
            {record.last_payment_amount ? formatCurrency(record.last_payment_amount) : 'N/A'}
          </div>
          <div className="text-sm text-gray-400">{formatDate(record.last_payment_date || '')}</div>
        </div>
      )
    },
    {
      key: 'assigned_servicer',
      title: 'Loan Servicer',
      render: (value: any, record: TLCClient) => (
        <div className="space-y-1">
          <div className="text-sm font-medium text-white">{record.assigned_servicer.name}</div>
          <div className="text-xs text-gray-400">{record.assigned_servicer.email}</div>
        </div>
      )
    }
  ], []);

  const tabs = [
    { id: 'all', name: 'All Clients', count: safeClients.length },
    { id: 'active', name: 'Active', count: safeClients.filter(c => c.account_status === 'active').length },
    { id: 'delinquent', name: 'Delinquent', count: safeClients.filter(c => c.account_status === 'delinquent').length },
    { id: 'paid_off', name: 'Paid Off', count: safeClients.filter(c => c.account_status === 'paid_off').length },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-color"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
        <p className="text-red-300">Error loading TLC clients. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <HeaderTabs 
        title="TLC Client Management" 
        searchPlaceholder="Search clients..."
        onSearch={(query) => setSearchTerm(query)}
        onNew={() => {/* Navigate to onboard new client */}}
        tabs={tabs}
        activeTab={statusFilter === 'all' ? 'all' : statusFilter}
        onTabChange={(tabId) => setStatusFilter(tabId as ClientStatus | 'all')}
      />
      
      <div className="flex-1 p-8 space-y-8 overflow-auto bg-gradient-to-br from-navy-blue-dark/50 to-navy-blue/30">
        {/* Portfolio Metrics Cards - Compact Containers */}
        <div className="flex gap-3 max-w-4xl">
          <div className="enhanced-card p-3 bg-gradient-to-br from-green-600/20 to-green-800/30 border border-green-500/30 min-w-fit">
            <div className="flex items-center gap-2">
              <BanknotesIcon className="h-4 w-4 text-green-400" />
              <div>
                <p className="text-green-300 text-xs font-medium">Portfolio</p>
                <p className="text-lg font-bold text-white">
                  ${((clientsData?.total_portfolio_value || 0) / 1000000).toFixed(1)}M
                </p>
              </div>
            </div>
          </div>

          <div className="enhanced-card p-3 bg-gradient-to-br from-blue-600/20 to-blue-800/30 border border-blue-500/30 min-w-fit">
            <div className="flex items-center gap-2">
              <CreditCardIcon className="h-4 w-4 text-blue-400" />
              <div>
                <p className="text-blue-300 text-xs font-medium">Outstanding</p>
                <p className="text-lg font-bold text-white">
                  ${((clientsData?.total_outstanding || 0) / 1000).toFixed(0)}K
                </p>
              </div>
            </div>
          </div>

          <div className="enhanced-card p-3 bg-gradient-to-br from-purple-600/20 to-purple-800/30 border border-purple-500/30 min-w-fit">
            <div className="flex items-center gap-2">
              <ChartBarIcon className="h-4 w-4 text-purple-400" />
              <div>
                <p className="text-purple-300 text-xs font-medium">Payment Rate</p>
                <p className="text-lg font-bold text-white">
                  {Math.round((clientsData?.avg_payment_rate || 0) * 100)}%
                </p>
              </div>
            </div>
          </div>

          <div className="enhanced-card p-3 bg-gradient-to-br from-orange-600/20 to-orange-800/30 border border-orange-500/30 min-w-fit">
            <div className="flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-orange-400" />
              <div>
                <p className="text-orange-300 text-xs font-medium">Active</p>
                <p className="text-lg font-bold text-white">
                  {safeClients.filter(c => c.account_status === 'active').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="enhanced-card p-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1">
              <div className="relative flex-1 max-w-md">
                <Input
                  placeholder="Search clients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-military pl-4 pr-4 py-3 text-white placeholder-gray-400 bg-gray-800/60 border-gray-600/50 rounded-xl focus:ring-2 focus:ring-brand-color/50 focus:border-brand-color/50 backdrop-blur-sm"
                />
              </div>
              <Select value={paymentFilter} onValueChange={(value) => setPaymentFilter(value as PaymentStatus | 'all')}>
                <SelectTrigger className="w-52 input-military bg-gray-800/60 border-gray-600/50 text-white rounded-xl backdrop-blur-sm">
                  <SelectValue placeholder="Payment status" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600 rounded-xl backdrop-blur-md">
                  <SelectItem value="all" className="text-white hover:bg-gray-700">All Payment Status</SelectItem>
                  <SelectItem value="current" className="text-white hover:bg-gray-700">Current</SelectItem>
                  <SelectItem value="late_1_30" className="text-white hover:bg-gray-700">1-30 Days Late</SelectItem>
                  <SelectItem value="late_31_60" className="text-white hover:bg-gray-700">31-60 Days Late</SelectItem>
                  <SelectItem value="late_61_90" className="text-white hover:bg-gray-700">61-90 Days Late</SelectItem>
                  <SelectItem value="late_90_plus" className="text-white hover:bg-gray-700">90+ Days Late</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button className="btn-primary px-6 py-2 rounded-xl bg-gradient-to-r from-brand-color to-brand-color-light hover:from-brand-color-hover hover:to-brand-color shadow-lg hover:shadow-xl transition-all duration-300">
                <PlusIcon className="h-4 w-4 mr-2" />
                Onboard Client
              </Button>
              <Button
                variant="outline"
                className="btn-secondary px-4 py-2 rounded-xl backdrop-blur-sm hover:bg-green-600/20 hover:border-green-500/50 transition-all duration-300"
              >
                <DocumentTextIcon className="h-4 w-4 mr-2" />
                Generate Report
              </Button>
            </div>
          </div>
        </div>

        {/* Clients Table */}
        <div className="enhanced-card">
          <EnhancedTable
            data={safeClients as any}
            columns={columns}
            onRowClick={(record) => setSelectedClient(record as TLCClient)}
            className="enhanced-table"
            scroll={{ x: 1400 }}
          />
        </div>

        {/* Payment Processing Modal */}
        {showPaymentModal && selectedClient && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="enhanced-card max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slideIn">
              <div className="p-8">
                <div className="flex items-start justify-between mb-8">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                      Process Payment
                    </h2>
                    <p className="text-gray-400">
                      Process payment for {selectedClient.personal_info.first_name} {selectedClient.personal_info.last_name}
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
                    ✕
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="form-label">Current Balance</label>
                      <p className="text-white bg-gray-800/30 px-3 py-2 rounded-lg font-mono">
                        {formatCurrency(selectedClient.loan_info.current_balance)}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="form-label">Next Payment Due</label>
                      <p className="text-white bg-gray-800/30 px-3 py-2 rounded-lg">
                        {formatCurrency(selectedClient.loan_info.next_payment_amount)} on {formatDate(selectedClient.loan_info.payment_due_date)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="form-label">Payment Amount</label>
                    <Input
                      type="number"
                      placeholder="Enter payment amount"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="input-military text-white bg-gray-800/60"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row justify-end gap-4 pt-6 border-t border-gray-700/50">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowPaymentModal(false);
                        setSelectedClient(null);
                        setPaymentAmount('');
                      }}
                      className="btn-secondary px-6 py-3 rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => processPaymentMutation.mutate({
                        clientId: selectedClient.id,
                        amount: parseFloat(paymentAmount)
                      })}
                      disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
                      isLoading={processPaymentMutation.isPending}
                      className="btn-primary px-6 py-3 rounded-xl bg-gradient-to-r from-brand-color to-brand-color-light hover:from-brand-color-hover hover:to-brand-color shadow-lg hover:shadow-xl"
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
      </div>
    </div>
  );
};

export default TLCClients;