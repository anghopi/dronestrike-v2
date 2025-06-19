import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  PhoneIcon,
  EnvelopeIcon,
  ArrowDownTrayIcon as Download, 
  ArrowUpTrayIcon as Upload, 
  FunnelIcon as Filter, 
  UserPlusIcon as UserPlus
} from '@heroicons/react/24/outline';
import { leadService } from '../services/api';
import { notificationService } from '../services/notificationService';
import { tlcBotgService, workflowHelpers } from '../services/tlcBotgService';
import { Lead } from '../types';
import { HeaderTabs } from '../components/Layout/HeaderTabs';
import { EnhancedTable, ColumnConfig } from '../components/ui/enhanced-table';
import { StatusBadge } from '../components/ui/StatusBadge';
import { MilitaryButton } from '../components/ui/MilitaryButton';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { csvService } from '../services/csvService';
import { TargetIntelImport } from '../components/advanced/TargetIntelImport';

type WorkflowStage = Lead['workflow_stage'];

const Leads = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkflowStage | 'all'>('all');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    source: '',
    dateRange: '',
    hasEmail: '',
    hasPhone: ''
  });
  const queryClient = useQueryClient();

  const { data: leadsData, isLoading, error } = useQuery({
    queryKey: ['leads', searchTerm, statusFilter],
    queryFn: () => leadService.getLeads({
      search: searchTerm || undefined,
      workflow_stage: statusFilter !== 'all' ? statusFilter : undefined,
      ordering: '-created_at'
    }),
  });

  const leads = leadsData?.results || [];
  
  // Ensure leads is always an array
  const safeLeads = Array.isArray(leads) ? leads : [];

  // Update lead mutation
  const updateLeadMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Lead> }) =>
      leadService.updateLead(id, data),
    onSuccess: (updatedLead) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      notificationService.leadUpdated(updatedLead.full_name);
    },
    onError: (error: any) => {
      notificationService.error(
        'Failed to Update Lead',
        error.message || 'Unknown error occurred'
      );
    }
  });

  // Bulk operations mutations
  const bulkUpdateMutation = useMutation({
    mutationFn: ({ leadIds, updates }: { leadIds: number[]; updates: Partial<Lead> }) =>
      Promise.all(leadIds.map(id => leadService.updateLead(id, updates))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setSelectedRows([]);
      notificationService.success('Bulk Operation Complete', 'Selected targets have been updated');
    },
    onError: (error: any) => {
      notificationService.error('Bulk Operation Failed', error.message || 'Failed to update targets');
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (leadIds: number[]) =>
      Promise.all(leadIds.map(id => leadService.deleteLead(id))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setSelectedRows([]);
      notificationService.success('Targets Removed', 'Selected targets have been removed from the system');
    },
    onError: (error: any) => {
      notificationService.error('Removal Failed', error.message || 'Failed to remove targets');
    }
  });

  // Target import mutation
  const targetImportMutation = useMutation({
    mutationFn: (data: any[]) => leadService.bulkCreateLeads(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      notificationService.success(
        'Target Intelligence Processed',
        `${result.created_count} targets successfully added to system`
      );
      setShowImportWizard(false);
    },
    onError: (error: any) => {
      notificationService.error(
        'Intelligence Import Failed',
        error.message || 'Failed to process target intelligence'
      );
    }
  });

  // CSV Export functionality
  const exportToCSV = () => {
    const exportData = selectedRows.length > 0 
      ? safeLeads.filter(lead => selectedRows.includes(lead.id.toString()))
      : safeLeads;

    const columns = [
      { key: 'full_name' as keyof Lead, header: 'Full Name' },
      { key: 'email' as keyof Lead, header: 'Email' },
      { key: 'phone_cell' as keyof Lead, header: 'Phone' },
      { key: 'mailing_address1' as keyof Lead, header: 'Address' },
      { key: 'mailing_city' as keyof Lead, header: 'City' },
      { key: 'mailing_state' as keyof Lead, header: 'State' },
      { key: 'mailing_zipcode' as keyof Lead, header: 'ZIP Code' },
      { key: 'workflow_stage' as keyof Lead, header: 'Status' },
      { key: 'imported_from' as keyof Lead, header: 'Source' },
      { 
        key: 'created_at' as keyof Lead, 
        header: 'Date Created',
        transform: (value: any) => new Date(value).toLocaleDateString()
      }
    ];

    const filename = selectedRows.length > 0 
      ? `selected_targets_${new Date().toISOString().split('T')[0]}`
      : `all_targets_${new Date().toISOString().split('T')[0]}`;

    csvService.downloadCSV(exportData, filename, columns);
  };

  // Bulk action handlers
  const handleBulkStatusUpdate = (newStatus: string) => {
    const selectedLeads = safeLeads.filter(lead => selectedRows.includes(lead.id.toString()));
    const leadIds = selectedLeads.map(lead => lead.id);
    
    bulkUpdateMutation.mutate({
      leadIds,
      updates: { workflow_stage: newStatus as WorkflowStage }
    });
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Are you sure you want to remove ${selectedRows.length} selected targets?`)) {
      const selectedLeads = safeLeads.filter(lead => selectedRows.includes(lead.id.toString()));
      const leadIds = selectedLeads.map(lead => lead.id);
      bulkDeleteMutation.mutate(leadIds);
    }
  };

  const handleIntelImport = async (data: any[]) => {
    await targetImportMutation.mutateAsync(data);
  };

  const getStatusBadgeType = (stage: WorkflowStage) => {
    switch (stage) {
      case 'lead_identified': return 'new';
      case 'botg_assigned': return 'pending';
      case 'botg_in_progress': return 'pending';
      case 'botg_completed': return 'contacted';
      case 'opportunity_created': return 'qualified';
      case 'tlc_loan_originated': return 'active';
      case 'tlc_client_onboarded': return 'active';
      case 'loan_servicing': return 'completed';
      default: return 'pending';
    }
  };

  const getNextStage = (currentStage: WorkflowStage): WorkflowStage | null => {
    switch (currentStage) {
      case 'lead_identified': return 'botg_assigned';
      case 'botg_assigned': return 'botg_in_progress';
      case 'botg_in_progress': return 'botg_completed';
      case 'botg_completed': return 'opportunity_created';
      case 'opportunity_created': return 'tlc_loan_originated';
      case 'tlc_loan_originated': return 'tlc_client_onboarded';
      case 'tlc_client_onboarded': return 'loan_servicing';
      default: return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Define table columns
  const columns: ColumnConfig<Lead>[] = useMemo(() => [
    {
      key: 'full_name',
      title: 'Target Name',
      dataIndex: 'full_name',
      sortable: true,
      render: (value: string, record: Lead) => (
        <div className="space-y-1">
          <div className="font-semibold text-white text-base">{value}</div>
          <div className="text-sm text-gray-400 flex items-center gap-1">
            <span className="w-1 h-1 bg-gray-500 rounded-full"></span>
            {record.property?.full_address || 'No address'}
          </div>
        </div>
      )
    },
    {
      key: 'workflow_stage',
      title: 'Status',
      dataIndex: 'workflow_stage',
      sortable: true,
      render: (value: WorkflowStage) => {
        const badgeType = getStatusBadgeType(value);
        const statusColors: Record<string, string> = {
          'new': 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-400/50',
          'pending': 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-yellow-400/50',
          'contacted': 'bg-gradient-to-r from-purple-500 to-purple-600 text-white border-purple-400/50',
          'qualified': 'bg-gradient-to-r from-green-500 to-green-600 text-white border-green-400/50',
          'active': 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-emerald-400/50',
          'completed': 'bg-gradient-to-r from-gray-500 to-gray-600 text-white border-gray-400/50'
        };
        return (
          <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold border backdrop-blur-sm shadow-sm ${
            statusColors[badgeType] || statusColors['pending']
          }`}>
            <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></span>
            {value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </div>
        );
      }
    },
    {
      key: 'phone_cell',
      title: 'Contact Info',
      dataIndex: 'phone_cell',
      render: (value: string, record: Lead) => (
        <div className="space-y-2">
          {value && (
            <div className="flex items-center gap-2 text-sm bg-gray-800/30 px-2 py-1 rounded-lg">
              <PhoneIcon className="w-4 h-4 text-blue-400" />
              <span className="text-white font-medium">{value}</span>
            </div>
          )}
          {record.email && (
            <div className="flex items-center gap-2 text-sm bg-gray-800/30 px-2 py-1 rounded-lg">
              <EnvelopeIcon className="w-4 h-4 text-green-400" />
              <span className="text-white font-medium">{record.email}</span>
            </div>
          )}
          {!value && !record.email && (
            <div className="text-xs text-gray-500 italic">No contact info</div>
          )}
        </div>
      )
    },
    {
      key: 'imported_from',
      title: 'Intel Source',
      dataIndex: 'imported_from',
      sortable: true,
      render: (value: string) => {
        const sourceColors: Record<string, string> = {
          'OSINT': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
          'HUMINT': 'bg-green-500/20 text-green-300 border-green-500/30',
          'SIGINT': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
          'Manual': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
        };
        const colorClass = sourceColors[value] || 'bg-gray-500/20 text-gray-300 border-gray-500/30';
        return (
          <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border backdrop-blur-sm ${colorClass}`}>
            {value || 'Unknown'}
          </div>
        );
      }
    },
    {
      key: 'created_at',
      title: 'Date Added',
      dataIndex: 'created_at',
      sortable: true,
      render: (value: string) => (
        <div className="text-sm">
          <div className="text-white font-medium">{formatDate(value)}</div>
          <div className="text-xs text-gray-400">
            {new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      )
    }
  ], []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-danger-900/50 border border-danger-700 rounded-lg p-4">
        <p className="text-danger-300">Error loading leads. Please try again.</p>
      </div>
    );
  }
  
  const tabs = [
    { id: 'all', name: 'All Targets', count: safeLeads.length },
    { id: 'lead_identified', name: 'New Leads', count: safeLeads.filter(l => l.workflow_stage === 'lead_identified').length },
    { id: 'botg_assigned', name: 'BOTG Assigned', count: safeLeads.filter(l => l.workflow_stage === 'botg_assigned').length },
    { id: 'botg_completed', name: 'BOTG Completed', count: safeLeads.filter(l => l.workflow_stage === 'botg_completed').length },
    { id: 'opportunity_created', name: 'Opportunities', count: safeLeads.filter(l => l.workflow_stage === 'opportunity_created').length },
  ];

  return (
    <div className="flex flex-col h-full">
      <HeaderTabs 
        title="Targets" 
        searchPlaceholder="Search targets..."
        onSearch={(query) => setSearchTerm(query)}
        onNew={() => {/* TODO: Implement add target modal */}}
        tabs={tabs}
        activeTab={statusFilter === 'all' ? 'all' : statusFilter}
        onTabChange={(tabId) => setStatusFilter(tabId as WorkflowStage | 'all')}
      />
      <div className="flex-1 p-8 space-y-8 overflow-auto bg-gradient-to-br from-navy-blue-dark/50 to-navy-blue/30">
        {/* Action Bar */}
        <div className="space-y-6">
          <div className="enhanced-card p-6">
            <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1">
                <div className="relative flex-1 max-w-md">
                  <Input
                    placeholder="Search targets..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input-military pl-4 pr-4 py-3 text-white placeholder-gray-400 bg-gray-800/60 border-gray-600/50 rounded-xl focus:ring-2 focus:ring-brand-color/50 focus:border-brand-color/50 backdrop-blur-sm"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as WorkflowStage | 'all')}>
                  <SelectTrigger className="w-52 input-military bg-gray-800/60 border-gray-600/50 text-white rounded-xl backdrop-blur-sm">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600 rounded-xl backdrop-blur-md">
                    <SelectItem value="all" className="text-white hover:bg-gray-700">All Statuses</SelectItem>
                    <SelectItem value="lead_identified" className="text-white hover:bg-gray-700">Lead Identified</SelectItem>
                    <SelectItem value="botg_assigned" className="text-white hover:bg-gray-700">BOTG Assigned</SelectItem>
                    <SelectItem value="botg_in_progress" className="text-white hover:bg-gray-700">BOTG In Progress</SelectItem>
                    <SelectItem value="botg_completed" className="text-white hover:bg-gray-700">BOTG Completed</SelectItem>
                    <SelectItem value="opportunity_created" className="text-white hover:bg-gray-700">Opportunity Created</SelectItem>
                    <SelectItem value="tlc_loan_originated" className="text-white hover:bg-gray-700">TLC Loan Originated</SelectItem>
                    <SelectItem value="tlc_client_onboarded" className="text-white hover:bg-gray-700">TLC Client Onboarded</SelectItem>
                    <SelectItem value="loan_servicing" className="text-white hover:bg-gray-700">Loan Servicing</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`btn-secondary px-4 py-2 rounded-xl backdrop-blur-sm transition-all duration-300 ${
                    showAdvancedFilters ? 'bg-brand-color/20 border-brand-color/50 text-white' : 'hover:bg-gray-700/50'
                  }`}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Advanced Filters
                </Button>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowImportWizard(true)}
                  className="btn-secondary px-4 py-2 rounded-xl backdrop-blur-sm hover:bg-blue-600/20 hover:border-blue-500/50 transition-all duration-300"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import Intel
                </Button>
                <Button
                  variant="outline"
                  onClick={exportToCSV}
                  className="btn-secondary px-4 py-2 rounded-xl backdrop-blur-sm hover:bg-green-600/20 hover:border-green-500/50 transition-all duration-300"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export {selectedRows.length > 0 ? `(${selectedRows.length})` : 'All'}
                </Button>
                <Button className="btn-primary px-6 py-2 rounded-xl bg-gradient-to-r from-brand-color to-brand-color-light hover:from-brand-color-hover hover:to-brand-color shadow-lg hover:shadow-xl transition-all duration-300">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Target
                </Button>
              </div>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          {selectedRows.length > 0 && (
            <div className="enhanced-card p-6 bg-gradient-to-r from-brand-color/10 to-olive-green/10 border border-brand-color/30 animate-fadeIn">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-brand-color rounded-full animate-pulse"></div>
                    <span className="text-sm font-bold text-white">
                      {selectedRows.length} targets selected
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Select onValueChange={handleBulkStatusUpdate}>
                      <SelectTrigger className="w-52 input-military bg-gray-800/60 border-gray-600/50 text-white rounded-xl">
                        <SelectValue placeholder="Update Status" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600 rounded-xl backdrop-blur-md">
                        <SelectItem value="lead_identified" className="text-white hover:bg-gray-700">Lead Identified</SelectItem>
                        <SelectItem value="botg_assigned" className="text-white hover:bg-gray-700">BOTG Assigned</SelectItem>
                        <SelectItem value="botg_in_progress" className="text-white hover:bg-gray-700">BOTG In Progress</SelectItem>
                        <SelectItem value="botg_completed" className="text-white hover:bg-gray-700">BOTG Completed</SelectItem>
                        <SelectItem value="opportunity_created" className="text-white hover:bg-gray-700">Opportunity Created</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="btn-secondary px-3 py-2 rounded-lg hover:bg-blue-600/20 hover:border-blue-500/50">
                      <EnvelopeIcon className="h-4 w-4 mr-2" />
                      Send Email
                    </Button>
                    <Button variant="outline" size="sm" className="btn-secondary px-3 py-2 rounded-lg hover:bg-green-600/20 hover:border-green-500/50">
                      <PhoneIcon className="h-4 w-4 mr-2" />
                      Call Campaign
                    </Button>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedRows([])}
                    className="text-gray-300 hover:text-white hover:bg-gray-700/50 px-3 py-2 rounded-lg transition-all duration-200"
                  >
                    Clear Selection
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={handleBulkDelete}
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-4 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    Remove Selected
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div className="enhanced-card p-6 animate-slideIn">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <Filter className="h-5 w-5 text-brand-color" />
                  Advanced Filters
                </h3>
                <p className="text-sm text-gray-400">Refine your target search with detailed criteria</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <label className="form-label">📡 Intelligence Source</label>
                  <Select value={advancedFilters.source} onValueChange={(value) => setAdvancedFilters(prev => ({ ...prev, source: value }))}>
                    <SelectTrigger className="input-military bg-gray-800/60 border-gray-600/50 text-white rounded-xl">
                      <SelectValue placeholder="Any source" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600 rounded-xl backdrop-blur-md">
                      <SelectItem value="" className="text-white hover:bg-gray-700">Any source</SelectItem>
                      <SelectItem value="OSINT" className="text-white hover:bg-gray-700">🌐 OSINT</SelectItem>
                      <SelectItem value="HUMINT" className="text-white hover:bg-gray-700">👥 HUMINT</SelectItem>
                      <SelectItem value="SIGINT" className="text-white hover:bg-gray-700">📶 SIGINT</SelectItem>
                      <SelectItem value="Manual" className="text-white hover:bg-gray-700">✍️ Manual Entry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="form-label">📧 Email Contact</label>
                  <Select value={advancedFilters.hasEmail} onValueChange={(value) => setAdvancedFilters(prev => ({ ...prev, hasEmail: value }))}>
                    <SelectTrigger className="input-military bg-gray-800/60 border-gray-600/50 text-white rounded-xl">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600 rounded-xl backdrop-blur-md">
                      <SelectItem value="" className="text-white hover:bg-gray-700">Any</SelectItem>
                      <SelectItem value="yes" className="text-white hover:bg-gray-700">✅ Has Email</SelectItem>
                      <SelectItem value="no" className="text-white hover:bg-gray-700">❌ No Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="form-label">📞 Phone Contact</label>
                  <Select value={advancedFilters.hasPhone} onValueChange={(value) => setAdvancedFilters(prev => ({ ...prev, hasPhone: value }))}>
                    <SelectTrigger className="input-military bg-gray-800/60 border-gray-600/50 text-white rounded-xl">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600 rounded-xl backdrop-blur-md">
                      <SelectItem value="" className="text-white hover:bg-gray-700">Any</SelectItem>
                      <SelectItem value="yes" className="text-white hover:bg-gray-700">✅ Has Phone</SelectItem>
                      <SelectItem value="no" className="text-white hover:bg-gray-700">❌ No Phone</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="form-label">📅 Date Range</label>
                  <Select value={advancedFilters.dateRange} onValueChange={(value) => setAdvancedFilters(prev => ({ ...prev, dateRange: value }))}>
                    <SelectTrigger className="input-military bg-gray-800/60 border-gray-600/50 text-white rounded-xl">
                      <SelectValue placeholder="Any time" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600 rounded-xl backdrop-blur-md">
                      <SelectItem value="" className="text-white hover:bg-gray-700">Any time</SelectItem>
                      <SelectItem value="today" className="text-white hover:bg-gray-700">📍 Today</SelectItem>
                      <SelectItem value="week" className="text-white hover:bg-gray-700"> This Week</SelectItem>
                      <SelectItem value="month" className="text-white hover:bg-gray-700"> This Month</SelectItem>
                      <SelectItem value="quarter" className="text-white hover:bg-gray-700"> This Quarter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Table */}
        <div className="enhanced-card p-0 overflow-hidden">
          <EnhancedTable
            data={safeLeads}
            columns={columns}
            loading={isLoading}
            rowKey="id"
            rowSelection={{
              selectedRowKeys: selectedRows,
              onChange: setSelectedRows
            }}
            onEdit={(record, key) => {
              const nextStage = getNextStage(record.workflow_stage);
              if (nextStage) {
                updateLeadMutation.mutate({
                  id: record.id,
                  data: { workflow_stage: nextStage }
                });
              }
            }}
            className="enhanced-table"
            scroll={{ x: 1000 }}
          />
        </div>

        {/* Import Wizard Modal */}
        {showImportWizard && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="enhanced-card max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl animate-slideIn">
              <TargetIntelImport
                operationType="target"
                onIntelProcessed={handleIntelImport}
                onMissionAbort={() => setShowImportWizard(false)}
              />
            </div>
          </div>
        )}

        {/* Lead Details Modal */}
        {selectedLead && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="enhanced-card max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-slideIn">
              <div className="p-8">
                <div className="flex items-start justify-between mb-8">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                       {selectedLead.full_name}
                    </h2>
                    <p className="text-gray-400 flex items-center gap-2">
                      📍 {selectedLead.property?.full_address || 'No property address'}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedLead(null)}
                    className="text-gray-400 hover:text-white hover:bg-gray-700/50 p-2 rounded-lg transition-all duration-200"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="form-label"> Current Status</label>
                      <div>
                        <StatusBadge status={getStatusBadgeType(selectedLead.workflow_stage)}>
                          {selectedLead.workflow_stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </StatusBadge>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="form-label">📡 Intelligence Source</label>
                      <p className="text-white bg-gray-800/30 px-3 py-2 rounded-lg">{selectedLead.imported_from || 'Not specified'}</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="form-label">📞 Phone Contact</label>
                      <p className="text-white bg-gray-800/30 px-3 py-2 rounded-lg font-mono">{selectedLead.phone_cell || 'Not provided'}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="form-label">📧 Email Contact</label>
                      <p className="text-white bg-gray-800/30 px-3 py-2 rounded-lg font-mono">{selectedLead.email || 'Not provided'}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="form-label"> Operational Notes</label>
                    <div className="bg-gray-800/30 px-4 py-3 rounded-lg border border-gray-600/30">
                      <p className="text-white whitespace-pre-wrap">{selectedLead.notes || 'No operational notes available'}</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-end gap-4 pt-6 border-t border-gray-700/50">
                    {getNextStage(selectedLead.workflow_stage) && (
                      <MilitaryButton
                        variant="primary"
                        onClick={() => {
                          const nextStage = getNextStage(selectedLead.workflow_stage);
                          if (nextStage) {
                            updateLeadMutation.mutate({
                              id: selectedLead.id,
                              data: { workflow_stage: nextStage }
                            });
                            setSelectedLead(null);
                          }
                        }}
                        isLoading={updateLeadMutation.isPending}
                        className="btn-primary px-6 py-3 rounded-xl bg-gradient-to-r from-brand-color to-brand-color-light hover:from-brand-color-hover hover:to-brand-color shadow-lg hover:shadow-xl"
                      >
                         Advance to {getNextStage(selectedLead.workflow_stage)?.replace(/_/g, ' ')}
                      </MilitaryButton>
                    )}
                    <MilitaryButton
                      variant="secondary"
                      onClick={() => setSelectedLead(null)}
                      className="btn-secondary px-6 py-3 rounded-xl"
                    >
                      ✖️ Close
                    </MilitaryButton>
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

export default Leads;