import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  CurrencyDollarIcon,
  DocumentChartBarIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  EyeIcon,
  PaperAirplaneIcon,
  BanknotesIcon,
  CalculatorIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { leadService } from '../services/api';
import { notificationService } from '../services/notificationService';
import { Lead } from '../types';
import { HeaderTabs } from '../components/Layout/HeaderTabs';
import { EnhancedTable, ColumnConfig } from '../components/ui/enhanced-table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../hooks/useAuth';

// Enhanced opportunity interface based on TLC BOTG architecture
interface Opportunity {
  id: number;
  opportunity_number: string;
  lead: {
    id: number;
    full_name: string;
    email: string;
    property_address: string;
    score_value: number;
  };
  mission: {
    id: number;
    mission_number: string;
    completed_at: string;
    assessment_score: number;
    photos_count: number;
  };
  status: 'identified' | 'analyzing' | 'qualified' | 'proposal_sent' | 'negotiation' | 'approved' | 'funded' | 'tlc_transferred' | 'rejected';
  requested_loan_amount: number;
  max_loan_amount: number;
  ltv_ratio: number;
  interest_rate: number;
  term_months: number;
  monthly_payment: number;
  risk_score: number;
  risk_level: 'Low' | 'Medium' | 'High';
  property_value: number;
  created_at: string;
  updated_at: string;
  assigned_loan_officer: {
    id: number;
    name: string;
    email: string;
  };
  tlc_loan_id?: string;
  expected_funding_date?: string;
}

// Mock API service - replace with actual API calls
const opportunityService = {
  getOpportunities: async (params?: any) => {
    // Mock opportunities data based on TLC BOTG architecture
    return {
      results: [
        {
          id: 1,
          opportunity_number: 'OPP-2025-001',
          lead: {
            id: 1,
            full_name: 'John Smith',
            email: 'john.smith@email.com',
            property_address: '123 Main St, Dallas, TX 75201',
            score_value: 85
          },
          mission: {
            id: 1,
            mission_number: 'M-2025-001',
            completed_at: '2025-06-16T15:30:00Z',
            assessment_score: 92,
            photos_count: 8
          },
          status: 'qualified',
          requested_loan_amount: 75000,
          max_loan_amount: 85000,
          ltv_ratio: 0.65,
          interest_rate: 8.5,
          term_months: 24,
          monthly_payment: 3542.50,
          risk_score: 75,
          risk_level: 'Medium',
          property_value: 130000,
          created_at: '2025-06-16T16:00:00Z',
          updated_at: '2025-06-17T09:00:00Z',
          assigned_loan_officer: {
            id: 1,
            name: 'Sarah Johnson',
            email: 'sarah.johnson@tlc.com'
          }
        },
        {
          id: 2,
          opportunity_number: 'OPP-2025-002',
          lead: {
            id: 2,
            full_name: 'Maria Garcia',
            email: 'maria.garcia@email.com',
            property_address: '456 Oak Ave, Dallas, TX 75202',
            score_value: 92
          },
          mission: {
            id: 2,
            mission_number: 'M-2025-002',
            completed_at: '2025-06-15T14:00:00Z',
            assessment_score: 88,
            photos_count: 6
          },
          status: 'approved',
          requested_loan_amount: 95000,
          max_loan_amount: 100000,
          ltv_ratio: 0.70,
          interest_rate: 7.75,
          term_months: 36,
          monthly_payment: 3123.45,
          risk_score: 82,
          risk_level: 'Low',
          property_value: 145000,
          created_at: '2025-06-15T16:30:00Z',
          updated_at: '2025-06-17T08:00:00Z',
          assigned_loan_officer: {
            id: 2,
            name: 'Michael Chen',
            email: 'michael.chen@tlc.com'
          },
          tlc_loan_id: 'TLC-2025-4567',
          expected_funding_date: '2025-06-20'
        },
        {
          id: 3,
          opportunity_number: 'OPP-2025-003',
          lead: {
            id: 3,
            full_name: 'Robert Wilson',
            email: 'robert.wilson@email.com',
            property_address: '789 Pine St, Dallas, TX 75203',
            score_value: 78
          },
          mission: {
            id: 3,
            mission_number: 'M-2025-003',
            completed_at: '2025-06-14T13:45:00Z',
            assessment_score: 76,
            photos_count: 5
          },
          status: 'tlc_transferred',
          requested_loan_amount: 65000,
          max_loan_amount: 72000,
          ltv_ratio: 0.60,
          interest_rate: 9.25,
          term_months: 24,
          monthly_payment: 3078.22,
          risk_score: 68,
          risk_level: 'Medium',
          property_value: 120000,
          created_at: '2025-06-14T17:00:00Z',
          updated_at: '2025-06-17T07:30:00Z',
          assigned_loan_officer: {
            id: 1,
            name: 'Sarah Johnson',
            email: 'sarah.johnson@tlc.com'
          },
          tlc_loan_id: 'TLC-2025-4568'
        }
      ],
      count: 3,
      total_value: 235000,
      avg_ltv: 0.65,
      approval_rate: 0.67
    };
  },
  
  updateOpportunityStatus: async (opportunityId: number, status: string) => {
    return { success: true };
  },
  
  transferToTLC: async (opportunityId: number) => {
    return { success: true, tlc_loan_id: `TLC-2025-${Date.now()}` };
  }
};

type OpportunityStatus = Opportunity['status'];

const OpportunitiesEnhanced: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<OpportunityStatus | 'all'>('all');
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [showTLCTransferModal, setShowTLCTransferModal] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch opportunities data
  const { data: opportunitiesData, isLoading, error } = useQuery({
    queryKey: ['opportunities', searchTerm, statusFilter],
    queryFn: () => opportunityService.getOpportunities({
      search: searchTerm || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    }),
  });

  const safeOpportunities = opportunitiesData?.results || [];

  // Update opportunity status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => 
      opportunityService.updateOpportunityStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      notificationService.success('Status Updated', 'Opportunity status updated successfully');
    },
  });

  // Transfer to TLC mutation
  const transferToTLCMutation = useMutation({
    mutationFn: (opportunityId: number) => opportunityService.transferToTLC(opportunityId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      notificationService.success(
        'Transferred to TLC', 
        `Opportunity transferred with loan ID: ${result.tlc_loan_id}`
      );
      setShowTLCTransferModal(false);
      setSelectedOpportunity(null);
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadgeType = (status: OpportunityStatus) => {
    const statusMap = {
      'identified': 'info',
      'analyzing': 'warning',
      'qualified': 'success',
      'proposal_sent': 'warning',
      'negotiation': 'warning',
      'approved': 'success',
      'funded': 'success',
      'tlc_transferred': 'info',
      'rejected': 'danger'
    };
    return statusMap[status] || 'pending';
  };

  const getRiskLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      'Low': 'bg-green-500/20 text-green-300 border-green-500/30',
      'Medium': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      'High': 'bg-red-500/20 text-red-300 border-red-500/30'
    };
    return colors[level] || colors['Medium'];
  };

  const getNextStatus = (currentStatus: OpportunityStatus): OpportunityStatus | null => {
    const workflow: Record<OpportunityStatus, OpportunityStatus | null> = {
      'identified': 'analyzing',
      'analyzing': 'qualified',
      'qualified': 'proposal_sent',
      'proposal_sent': 'negotiation',
      'negotiation': 'approved',
      'approved': 'funded',
      'funded': 'tlc_transferred',
      'tlc_transferred': null,
      'rejected': null
    };
    return workflow[currentStatus] || null;
  };

  const columns: ColumnConfig<Opportunity>[] = useMemo(() => [
    {
      key: 'opportunity_number',
      title: ' Opportunity ID',
      dataIndex: 'opportunity_number',
      sortable: true,
      render: (value: string, record: Opportunity) => (
        <div className="space-y-1">
          <div className="font-mono font-bold text-white">{value}</div>
          <div className="text-xs text-gray-400">{formatDate(record.created_at)}</div>
        </div>
      )
    },
    {
      key: 'lead',
      title: '👤 Lead Information',
      render: (value: any, record: Opportunity) => (
        <div className="space-y-1 max-w-xs">
          <div className="font-semibold text-white">{record.lead.full_name}</div>
          <div className="text-sm text-gray-400">{record.lead.email}</div>
          <div className="flex items-center gap-2">
            <div className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
              Score: {record.lead.score_value}
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'loan_details',
      title: ' Loan Details',
      render: (value: any, record: Opportunity) => (
        <div className="space-y-1">
          <div className="font-semibold text-white">{formatCurrency(record.requested_loan_amount)}</div>
          <div className="text-sm text-gray-400">Max: {formatCurrency(record.max_loan_amount)}</div>
          <div className="text-xs text-gray-400">
            {record.interest_rate}% • {record.term_months}mo
          </div>
        </div>
      )
    },
    {
      key: 'property_value',
      title: '🏠 Property Value',
      render: (value: any, record: Opportunity) => (
        <div className="space-y-1">
          <div className="font-semibold text-white">{formatCurrency(record.property_value)}</div>
          <div className="text-sm text-gray-400">LTV: {Math.round(record.ltv_ratio * 100)}%</div>
        </div>
      )
    },
    {
      key: 'status',
      title: ' Status',
      render: (value: OpportunityStatus) => (
        <Badge variant={getStatusBadgeType(value) as any}>
          {value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </Badge>
      )
    },
    {
      key: 'risk_level',
      title: ' Risk Assessment',
      render: (value: any, record: Opportunity) => (
        <div className="space-y-1">
          <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border backdrop-blur-sm ${getRiskLevelColor(record.risk_level)}`}>
            {record.risk_level} Risk
          </div>
          <div className="text-xs text-gray-400">Score: {record.risk_score}</div>
        </div>
      )
    },
    {
      key: 'assigned_loan_officer',
      title: '👨‍💼 Loan Officer',
      render: (value: any, record: Opportunity) => (
        <div className="space-y-1">
          <div className="text-sm font-medium text-white">{record.assigned_loan_officer.name}</div>
          <div className="text-xs text-gray-400">{record.assigned_loan_officer.email}</div>
        </div>
      )
    },
    {
      key: 'monthly_payment',
      title: '💳 Monthly Payment',
      render: (value: any, record: Opportunity) => (
        <div className="space-y-1">
          <div className="font-semibold text-white">{formatCurrency(record.monthly_payment)}</div>
          <div className="text-xs text-gray-400">/month</div>
        </div>
      )
    }
  ], []);

  const tabs = [
    { id: 'all', name: 'All Opportunities', count: safeOpportunities.length },
    { id: 'qualified', name: 'Qualified', count: safeOpportunities.filter(o => o.status === 'qualified').length },
    { id: 'approved', name: 'Approved', count: safeOpportunities.filter(o => o.status === 'approved').length },
    { id: 'funded', name: 'Funded', count: safeOpportunities.filter(o => o.status === 'funded').length },
    { id: 'tlc_transferred', name: 'TLC Active', count: safeOpportunities.filter(o => o.status === 'tlc_transferred').length },
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
        <p className="text-red-300">Error loading opportunities. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <HeaderTabs 
        title="Investment Opportunities" 
        searchPlaceholder="Search opportunities..."
        onSearch={(query) => setSearchTerm(query)}
        onNew={() => {/* Navigate to create opportunity */}}
        tabs={tabs}
        activeTab={statusFilter === 'all' ? 'all' : statusFilter}
        onTabChange={(tabId) => setStatusFilter(tabId as OpportunityStatus | 'all')}
      />
      
      <div className="flex-1 p-8 space-y-8 overflow-auto bg-gradient-to-br from-navy-blue-dark/50 to-navy-blue/30">
        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="enhanced-card p-6 bg-gradient-to-br from-green-600/20 to-green-800/30 border border-green-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-300 text-sm font-medium">Total Value</p>
                <p className="text-3xl font-bold text-white">
                  {formatCurrency(opportunitiesData?.total_value || 0)}
                </p>
              </div>
              <CurrencyDollarIcon className="h-8 w-8 text-green-400" />
            </div>
          </div>

          <div className="enhanced-card p-6 bg-gradient-to-br from-blue-600/20 to-blue-800/30 border border-blue-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-300 text-sm font-medium">Avg LTV Ratio</p>
                <p className="text-3xl font-bold text-white">
                  {Math.round((opportunitiesData?.avg_ltv || 0) * 100)}%
                </p>
              </div>
              <CalculatorIcon className="h-8 w-8 text-blue-400" />
            </div>
          </div>

          <div className="enhanced-card p-6 bg-gradient-to-br from-purple-600/20 to-purple-800/30 border border-purple-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-300 text-sm font-medium">Approval Rate</p>
                <p className="text-3xl font-bold text-white">
                  {Math.round((opportunitiesData?.approval_rate || 0) * 100)}%
                </p>
              </div>
              <CheckCircleIcon className="h-8 w-8 text-purple-400" />
            </div>
          </div>

          <div className="enhanced-card p-6 bg-gradient-to-br from-orange-600/20 to-orange-800/30 border border-orange-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-300 text-sm font-medium">Active Opportunities</p>
                <p className="text-3xl font-bold text-white">
                  {safeOpportunities.filter(o => !['rejected', 'tlc_transferred'].includes(o.status)).length}
                </p>
              </div>
              <ArrowTrendingUpIcon className="h-8 w-8 text-orange-400" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="enhanced-card p-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1">
              <div className="relative flex-1 max-w-md">
                <Input
                  placeholder="🔍 Search opportunities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-military pl-4 pr-4 py-3 text-white placeholder-gray-400 bg-gray-800/60 border-gray-600/50 rounded-xl focus:ring-2 focus:ring-brand-color/50 focus:border-brand-color/50 backdrop-blur-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button className="btn-primary px-6 py-2 rounded-xl bg-gradient-to-r from-brand-color to-brand-color-light hover:from-brand-color-hover hover:to-brand-color shadow-lg hover:shadow-xl transition-all duration-300">
                <PlusIcon className="h-4 w-4 mr-2" />
                Create Opportunity
              </Button>
              <Button
                variant="outline"
                className="btn-secondary px-4 py-2 rounded-xl backdrop-blur-sm hover:bg-green-600/20 hover:border-green-500/50 transition-all duration-300"
              >
                <DocumentChartBarIcon className="h-4 w-4 mr-2" />
                Analytics Report
              </Button>
            </div>
          </div>
        </div>

        {/* Opportunities Table */}
        <div className="enhanced-card">
          <EnhancedTable
            data={safeOpportunities as any}
            columns={columns}
            onRowClick={(record) => setSelectedOpportunity(record as Opportunity)}
            className="enhanced-table"
            scroll={{ x: 1400 }}
          />
        </div>

        {/* TLC Transfer Modal */}
        {showTLCTransferModal && selectedOpportunity && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="enhanced-card max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slideIn">
              <div className="p-8">
                <div className="flex items-start justify-between mb-8">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                      🏦 Transfer to TLC
                    </h2>
                    <p className="text-gray-400">
                      Transfer approved opportunity to The Lending Company for loan origination
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowTLCTransferModal(false);
                      setSelectedOpportunity(null);
                    }}
                    className="text-gray-400 hover:text-white hover:bg-gray-700/50 p-2 rounded-lg transition-all duration-200"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="form-label">👤 Borrower</label>
                      <p className="text-white bg-gray-800/30 px-3 py-2 rounded-lg">{selectedOpportunity.lead.full_name}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="form-label"> Loan Amount</label>
                      <p className="text-white bg-gray-800/30 px-3 py-2 rounded-lg font-mono">{formatCurrency(selectedOpportunity.requested_loan_amount)}</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="form-label"> Interest Rate</label>
                      <p className="text-white bg-gray-800/30 px-3 py-2 rounded-lg">{selectedOpportunity.interest_rate}%</p>
                    </div>
                    <div className="space-y-2">
                      <label className="form-label">📅 Term</label>
                      <p className="text-white bg-gray-800/30 px-3 py-2 rounded-lg">{selectedOpportunity.term_months} months</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="form-label"> Risk Assessment</label>
                    <div className="bg-gray-800/30 px-4 py-3 rounded-lg border border-gray-600/30">
                      <div className="flex items-center justify-between">
                        <span className="text-white">{selectedOpportunity.risk_level} Risk</span>
                        <span className="text-gray-400">Score: {selectedOpportunity.risk_score}/100</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-end gap-4 pt-6 border-t border-gray-700/50">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowTLCTransferModal(false);
                        setSelectedOpportunity(null);
                      }}
                      className="btn-secondary px-6 py-3 rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => transferToTLCMutation.mutate(selectedOpportunity.id)}
                      isLoading={transferToTLCMutation.isPending}
                      className="btn-primary px-6 py-3 rounded-xl bg-gradient-to-r from-brand-color to-brand-color-light hover:from-brand-color-hover hover:to-brand-color shadow-lg hover:shadow-xl"
                    >
                      <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                      Transfer to TLC
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

export default OpportunitiesEnhanced;