import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  Edit,
  Eye,
  Trash2,
  Download,
  RefreshCw,
  MapPin,
  Phone,
  Mail,
  DollarSign,
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  Building,
  User,
  CreditCard,
  TrendingUp,
  MoreVertical,
  X
} from 'lucide-react';
import {
  tlcClientService,
  TLCClient,
  TLCClientFilters
} from '../../services/tlcClientService';

interface TLCClientManagerProps {
  initialFilters?: TLCClientFilters;
  onClientSelect?: (client: TLCClient) => void;
  showHeader?: boolean;
}

const TLCClientManager: React.FC<TLCClientManagerProps> = ({
  initialFilters = {},
  onClientSelect,
  showHeader = true
}) => {
  const [clients, setClients] = useState<TLCClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalClients, setTotalClients] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<TLCClientFilters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedClient, setSelectedClient] = useState<TLCClient | null>(null);
  const [showClientDetails, setShowClientDetails] = useState(false);

  const pageSize = 25;

  useEffect(() => {
    loadClients();
  }, [currentPage, sortBy, sortOrder, filters, searchTerm]);

  const loadClients = async () => {
    setLoading(true);
    try {
      const response = await tlcClientService.getClients(
        { ...filters, search_term: searchTerm },
        currentPage,
        pageSize,
        sortBy,
        sortOrder
      );
      
      setClients(response.clients);
      setTotalPages(response.totalPages);
      setTotalClients(response.total);
    } catch (error) {
      console.error('Failed to load clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClientSelect = (client: TLCClient) => {
    setSelectedClient(client);
    setShowClientDetails(true);
    onClientSelect?.(client);
  };

  const handleStatusUpdate = async (clientId: string, newStatus: string) => {
    try {
      await tlcClientService.updateClient(clientId, { 
        status: newStatus as any,
        workflow_stage: getWorkflowStageForStatus(newStatus)
      });
      loadClients();
    } catch (error) {
      console.error('Failed to update client status:', error);
    }
  };

  const getWorkflowStageForStatus = (status: string): string => {
    switch (status) {
      case 'prospect': return 'initial_contact';
      case 'lead': return 'qualification';
      case 'applicant': return 'application_review';
      case 'client': return 'funded';
      default: return 'initial_contact';
    }
  };

  const handleBulkAction = async (action: string) => {
    const selectedIds = Array.from(selectedClients);
    if (selectedIds.length === 0) return;

    try {
      switch (action) {
        case 'delete':
          // In production, would call bulk delete API
          console.log('Bulk delete:', selectedIds);
          break;
        case 'export':
          await handleExport();
          break;
        case 'update_status':
          // Would show status update modal
          console.log('Bulk status update:', selectedIds);
          break;
      }
      
      setSelectedClients(new Set());
      loadClients();
    } catch (error) {
      console.error('Bulk action failed:', error);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await tlcClientService.exportClients(
        { ...filters, search_term: searchTerm },
        'csv'
      );
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tlc_clients_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const toggleClientSelection = (clientId: string) => {
    const newSelection = new Set(selectedClients);
    if (newSelection.has(clientId)) {
      newSelection.delete(clientId);
    } else {
      newSelection.add(clientId);
    }
    setSelectedClients(newSelection);
  };

  const selectAllClients = () => {
    if (selectedClients.size === clients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(clients.map(c => c.id)));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'client': return 'bg-green-500/20 text-green-400';
      case 'applicant': return 'bg-blue-500/20 text-blue-400';
      case 'lead': return 'bg-yellow-500/20 text-yellow-400';
      case 'prospect': return 'bg-purple-500/20 text-purple-400';
      case 'inactive': return 'bg-gray-500/20 text-gray-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getLoanStatusIcon = (status?: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'funded': return <CreditCard className="w-4 h-4 text-blue-500" />;
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'declined': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading && clients.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-slate-300">Loading clients...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Client Management</h2>
            <p className="text-slate-400 mt-1">
              {totalClients.toLocaleString()} total clients
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                showFilters ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
            </button>
            
            <button
              onClick={handleExport}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all duration-300 border border-slate-600/50"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
            
            <button
              onClick={loadClients}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all duration-300 border border-blue-500/50 shadow-lg hover:shadow-xl"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search clients by name, email, phone, or account number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex items-center space-x-2">
            <select
              value={filters.status?.[0] || ''}
              onChange={(e) => setFilters({ ...filters, status: e.target.value ? [e.target.value] : undefined })}
              className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
            >
              <option value="">All Statuses</option>
              <option value="prospect">Prospects</option>
              <option value="lead">Leads</option>
              <option value="applicant">Applicants</option>
              <option value="client">Clients</option>
              <option value="inactive">Inactive</option>
            </select>

            <select
              value={filters.counties?.[0] || ''}
              onChange={(e) => setFilters({ ...filters, counties: e.target.value ? [e.target.value] : undefined })}
              className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
            >
              <option value="">All Counties</option>
              <option value="Tarrant">Tarrant</option>
              <option value="Harris">Harris</option>
              <option value="Dallas">Dallas</option>
              <option value="Collin">Collin</option>
              <option value="Denton">Denton</option>
            </select>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-4 p-4 bg-slate-700 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Tax Amount Range</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    placeholder="Min"
                    className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Date Range</label>
                <select className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white">
                  <option value="">All Time</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="1y">Last year</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Loan Status</label>
                <select className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white">
                  <option value="">All Loan Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="funded">Funded</option>
                  <option value="declined">Declined</option>
                  <option value="paid_off">Paid Off</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end mt-4 space-x-2">
              <button
                onClick={() => setFilters({})}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all duration-300 border border-slate-600/50"
              >
                Clear All
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all duration-300 border border-blue-500/50 shadow-lg hover:shadow-xl"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedClients.size > 0 && (
        <div className="bg-blue-600/10 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-blue-400">
                {selectedClients.size} client{selectedClients.size !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => setSelectedClients(new Set())}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleBulkAction('export')}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all duration-300 border border-blue-500/50 shadow-lg hover:shadow-xl"
              >
                Export Selected
              </button>
              <button
                onClick={() => handleBulkAction('update_status')}
                className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg transition-all duration-300 border border-green-500/50 shadow-lg hover:shadow-xl"
              >
                Update Status
              </button>
              <button
                onClick={() => handleBulkAction('delete')}
                className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-lg transition-all duration-300 border border-red-500/50 shadow-lg hover:shadow-xl"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedClients.size === clients.length && clients.length > 0}
                    onChange={selectAllClients}
                    className="rounded border-slate-500 bg-slate-600 text-blue-600"
                  />
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white"
                  onClick={() => handleSort('client_number')}
                >
                  Client #
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white"
                  onClick={() => handleSort('first_name')}
                >
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Property
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white"
                  onClick={() => handleSort('status')}
                >
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Tax Info
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Loan
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white"
                  onClick={() => handleSort('created_at')}
                >
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-slate-700/50">
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedClients.has(client.id)}
                      onChange={() => toggleClientSelection(client.id)}
                      className="rounded border-slate-500 bg-slate-600 text-blue-600"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-white">{client.client_number}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">
                          {client.first_name} {client.last_name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-300">
                      {client.email && (
                        <div className="flex items-center space-x-1">
                          <Mail className="w-3 h-3" />
                          <span>{client.email}</span>
                        </div>
                      )}
                      {client.phone_primary && (
                        <div className="flex items-center space-x-1 mt-1">
                          <Phone className="w-3 h-3" />
                          <span>{client.phone_primary}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-300">
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-3 h-3" />
                        <span>{client.property_address.county}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {client.tax_info.account_number}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(client.status)}`}>
                      {client.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-300">
                      <div className="flex items-center space-x-1">
                        <DollarSign className="w-3 h-3" />
                        <span>{formatCurrency(client.tax_info.total_amount_due)}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        Year: {client.tax_info.tax_year}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {getLoanStatusIcon(client.loan_info?.status)}
                      <div className="text-sm">
                        {client.loan_info ? (
                          <div className="text-slate-300">
                            {formatCurrency(client.loan_info.loan_amount)}
                          </div>
                        ) : (
                          <div className="text-slate-500">No loan</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-300">
                      {formatDate(client.created_at)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleClientSelect(client)}
                        className="p-1 text-slate-400 hover:text-white transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1 text-slate-400 hover:text-white transition-colors"
                        title="Edit Client"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                        title="More Actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-slate-700 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-300">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalClients)} of {totalClients.toLocaleString()} clients
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-800 text-white rounded transition-colors"
            >
              Previous
            </button>
            
            <span className="text-sm text-slate-300">
              Page {currentPage} of {totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-800 text-white rounded transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Client Details Modal */}
      {showClientDetails && selectedClient && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  {selectedClient.first_name} {selectedClient.last_name}
                </h3>
                <p className="text-slate-400">{selectedClient.client_number}</p>
              </div>
              <button
                onClick={() => setShowClientDetails(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Client Information */}
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-white">Client Information</h4>
                  <div className="bg-slate-700 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Status:</span>
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(selectedClient.status)}`}>
                        {selectedClient.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Email:</span>
                      <span className="text-white">{selectedClient.email || 'Not provided'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Phone:</span>
                      <span className="text-white">{selectedClient.phone_primary || 'Not provided'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Created:</span>
                      <span className="text-white">{formatDate(selectedClient.created_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Tax Information */}
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-white">Tax Information</h4>
                  <div className="bg-slate-700 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Account #:</span>
                      <span className="text-white">{selectedClient.tax_info.account_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Tax Year:</span>
                      <span className="text-white">{selectedClient.tax_info.tax_year}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Original Amount:</span>
                      <span className="text-white">{formatCurrency(selectedClient.tax_info.original_tax_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Due:</span>
                      <span className="text-white font-semibold">{formatCurrency(selectedClient.tax_info.total_amount_due)}</span>
                    </div>
                  </div>
                </div>

                {/* Property Information */}
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-white">Property Information</h4>
                  <div className="bg-slate-700 rounded-lg p-4 space-y-3">
                    <div>
                      <span className="text-slate-400 block">Address:</span>
                      <span className="text-white">
                        {selectedClient.property_address.street_1}<br />
                        {selectedClient.property_address.city}, {selectedClient.property_address.state} {selectedClient.property_address.zip_code}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">County:</span>
                      <span className="text-white">{selectedClient.property_address.county}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Market Value:</span>
                      <span className="text-white">{formatCurrency(selectedClient.property_valuation.market_total_value)}</span>
                    </div>
                  </div>
                </div>

                {/* Loan Information */}
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-white">Loan Information</h4>
                  <div className="bg-slate-700 rounded-lg p-4">
                    {selectedClient.loan_info ? (
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Status:</span>
                          <div className="flex items-center space-x-2">
                            {getLoanStatusIcon(selectedClient.loan_info.status)}
                            <span className="text-white">{selectedClient.loan_info.status}</span>
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Loan Amount:</span>
                          <span className="text-white">{formatCurrency(selectedClient.loan_info.loan_amount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Interest Rate:</span>
                          <span className="text-white">{selectedClient.loan_info.interest_rate}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Monthly Payment:</span>
                          <span className="text-white">{formatCurrency(selectedClient.loan_info.monthly_payment)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <FileText className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                        <p className="text-slate-400">No loan information available</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TLCClientManager;