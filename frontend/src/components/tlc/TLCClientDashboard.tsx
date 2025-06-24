import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  DollarSign,
  FileText,
  TrendingUp,
  Clock,
  AlertCircle,
  BarChart3,
  PieChart,
  MapPin,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  UserPlus,
  Building,
  CreditCard,
  X,
  Search,
  ChevronDown
} from 'lucide-react';
import {
  tlcClientService,
  TLCDashboardStats
} from '../../services/tlcClientService';

interface TLCClientDashboardProps {
  onClientCountUpdate?: (count: number) => void;
}

const TLCClientDashboard: React.FC<TLCClientDashboardProps> = ({
  onClientCountUpdate
}) => {
  const [stats, setStats] = useState<TLCDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState('30d');
  const [monthlyTrendsTimeframe, setMonthlyTrendsTimeframe] = useState('6m');
  const [activeChart, setActiveChart] = useState<'status' | 'county' | 'trends'>('status');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [filters, setFilters] = useState({
    status: [] as string[],
    counties: [] as string[],
    loanAmountRange: { min: '', max: '' },
    taxAmountRange: { min: '', max: '' },
    dateRange: { start: '', end: '' },
    loanStatus: [] as string[],
    propertyStatus: [] as string[],
    searchTerm: ''
  });
  const [selectedReportType, setSelectedReportType] = useState('');
  const [reportFilters, setReportFilters] = useState({
    dateRange: { start: '', end: '' },
    format: 'pdf',
    includeDetails: true
  });

  const loadDashboardStats = useCallback(async () => {
    setLoading(true);
    try {
      const dashboardStats = await tlcClientService.getDashboardStats();
      setStats(dashboardStats);
      onClientCountUpdate?.(dashboardStats.total_clients);
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  }, [onClientCountUpdate]);

  useEffect(() => {
    loadDashboardStats();
  }, [selectedTimeframe, loadDashboardStats]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'client': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'applicant': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'lead': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'prospect': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'inactive': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-200">
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-4 text-slate-300">Loading dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="text-center py-12">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Failed to Load Dashboard</h3>
          <p className="text-slate-400 mb-6">Unable to fetch dashboard statistics</p>
          <button
            onClick={loadDashboardStats}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all duration-300 border border-blue-500/50 shadow-lg hover:shadow-xl"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Clean Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => window.open('/api/clients/export', '_blank')}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <Download className="w-4 h-4" />
            <span>Export Data</span>
          </button>
          
          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <BarChart3 className="w-4 h-4" />
            <span>Generate Report</span>
          </button>
          
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl ${
              showAdvancedFilters 
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white'
                : 'bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Advanced Filters</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>
        
        <div className="flex items-center space-x-3">
          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value)}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          
          <button
            onClick={loadDashboardStats}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Advanced Filters</h3>
            <button
              onClick={() => setShowAdvancedFilters(false)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Search Clients</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Name, email, phone..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters({...filters, searchTerm: e.target.value})}
                  className="w-full pl-10 pr-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Client Status */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Client Status</label>
              <select
                value={filters.status[0] || ''}
                onChange={(e) => setFilters({...filters, status: e.target.value ? [e.target.value] : []})}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="prospect">Prospect</option>
                <option value="lead">Lead</option>
                <option value="applicant">Applicant</option>
                <option value="client">Active Client</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Counties */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">County</label>
              <select
                value={filters.counties[0] || ''}
                onChange={(e) => setFilters({...filters, counties: e.target.value ? [e.target.value] : []})}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Counties</option>
                <option value="Tarrant">Tarrant</option>
                <option value="Harris">Harris</option>
                <option value="Dallas">Dallas</option>
                <option value="Collin">Collin</option>
                <option value="Denton">Denton</option>
                <option value="Travis">Travis</option>
                <option value="Bexar">Bexar</option>
              </select>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Date Range</label>
              <div className="flex space-x-2">
                <input
                  type="date"
                  value={filters.dateRange.start}
                  onChange={(e) => setFilters({...filters, dateRange: {...filters.dateRange, start: e.target.value}})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="date"
                  value={filters.dateRange.end}
                  onChange={(e) => setFilters({...filters, dateRange: {...filters.dateRange, end: e.target.value}})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Filter Actions */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-700">
            <div className="text-sm text-slate-400">
              Apply filters to refine your client data
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setFilters({
                  status: [] as string[],
                  counties: [] as string[],
                  loanAmountRange: { min: '', max: '' },
                  taxAmountRange: { min: '', max: '' },
                  dateRange: { start: '', end: '' },
                  loanStatus: [] as string[],
                  propertyStatus: [] as string[],
                  searchTerm: ''
                })}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
              >
                Clear All
              </button>
              <button
                onClick={() => {
                  console.log('Applying filters:', filters);
                  loadDashboardStats();
                  setShowAdvancedFilters(false);
                }}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-200">
          <div className="flex items-center space-x-3 mb-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{stats.total_clients.toLocaleString()}</div>
              <div className="text-xs text-slate-400">Total Clients</div>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <UserPlus className="w-3 h-3 text-green-500" />
            <span className="text-xs text-green-500">+12.3% this month</span>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-200">
          <div className="flex items-center space-x-3 mb-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <CreditCard className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{stats.active_loans.toLocaleString()}</div>
              <div className="text-xs text-slate-400">Active Loans</div>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <TrendingUp className="w-3 h-3 text-green-500" />
            <span className="text-xs text-green-500">+8.7% this month</span>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-200">
          <div className="flex items-center space-x-3 mb-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <DollarSign className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{formatCurrency(stats.total_loan_amount)}</div>
              <div className="text-xs text-slate-400">Total Loan Amount</div>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <TrendingUp className="w-3 h-3 text-green-500" />
            <span className="text-xs text-green-500">+15.2% this month</span>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-200">
          <div className="flex items-center space-x-3 mb-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <FileText className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{stats.pending_applications.toLocaleString()}</div>
              <div className="text-xs text-slate-400">Pending Applications</div>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <Clock className="w-3 h-3 text-yellow-500" />
            <span className="text-xs text-yellow-500">Avg. 14.5 days</span>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl">
        <h3 className="text-lg font-semibold text-white mb-4">Performance Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <div className="bg-slate-700/50 rounded-lg p-4 text-center border border-slate-600/30">
            <div className="text-3xl font-bold text-blue-400 mb-2">{formatPercentage(stats.performance_metrics.approval_rate)}</div>
            <div className="text-sm text-slate-300 font-medium">Approval Rate</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-4 text-center border border-slate-600/30">
            <div className="text-3xl font-bold text-green-400 mb-2">{stats.performance_metrics.avg_processing_time_days}</div>
            <div className="text-sm text-slate-300 font-medium">Avg. Process Days</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-4 text-center border border-slate-600/30">
            <div className="text-3xl font-bold text-yellow-400 mb-2">{formatPercentage(stats.performance_metrics.default_rate)}</div>
            <div className="text-sm text-slate-300 font-medium">Default Rate</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-4 text-center border border-slate-600/30">
            <div className="text-3xl font-bold text-purple-400 mb-2">{formatCurrency(stats.performance_metrics.avg_loan_amount)}</div>
            <div className="text-sm text-slate-300 font-medium">Avg. Loan Amount</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-4 text-center border border-slate-600/30">
            <div className="text-3xl font-bold text-red-400 mb-2">{formatPercentage(stats.performance_metrics.avg_ltv_ratio)}</div>
            <div className="text-sm text-slate-300 font-medium">Avg. LTV Ratio</div>
          </div>
        </div>
      </div>

      {/* Enhanced Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Client Status Distribution */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Client Status Distribution</h3>
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveChart('status')}
                className={`p-2 rounded-lg ${activeChart === 'status' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'} transition-colors border border-slate-600`}
              >
                <PieChart className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
          
          <div className="space-y-3">
            {stats.clients_by_status.map((item) => (
              <div key={item.status} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(item.status)}`}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </div>
                  <span className="text-white">{item.count.toLocaleString()}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${item.percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-slate-400 text-sm w-12">{formatPercentage(item.percentage)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* County Performance */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Top Counties by Loan Volume</h3>
            <MapPin className="w-5 h-5 text-slate-400" />
          </div>
          
          <div className="space-y-4">
            {stats.loans_by_county.slice(0, 5).map((county, index) => (
              <div key={county.county} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-white">{county.county} County</div>
                    <div className="text-sm text-slate-400">{county.count} loans</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-white">{formatCurrency(county.total_amount)}</div>
                  <div className="text-sm text-slate-400">Avg: {formatCurrency(county.avg_amount)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Enhanced Monthly Trends */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-8 border border-slate-700/50 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Monthly Trends</h3>
          <div className="flex items-center space-x-3">
            <Calendar className="w-5 h-5 text-slate-400" />
            <div className="relative">
              <select
                value={monthlyTrendsTimeframe}
                onChange={(e) => setMonthlyTrendsTimeframe(e.target.value)}
                className="appearance-none px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
              >
                <option value="3m">Last 3 months</option>
                <option value="6m">Last 6 months</option>
                <option value="12m">Last 12 months</option>
                <option value="24m">Last 24 months</option>
                <option value="custom">Custom range</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-4 text-slate-300 font-medium">Month</th>
                <th className="text-left py-3 px-4 text-slate-300 font-medium">New Clients</th>
                <th className="text-left py-3 px-4 text-slate-300 font-medium">Loans Funded</th>
                <th className="text-left py-3 px-4 text-slate-300 font-medium">Total Funded</th>
              </tr>
            </thead>
            <tbody>
              {stats.monthly_trends.slice(0, monthlyTrendsTimeframe === '3m' ? 3 : monthlyTrendsTimeframe === '6m' ? 6 : monthlyTrendsTimeframe === '12m' ? 12 : 24).map((month) => (
                <tr key={month.month} className="border-b border-slate-700">
                  <td className="py-3 px-4 text-white font-medium">{month.month}</td>
                  <td className="py-3 px-4 text-white">{month.new_clients.toLocaleString()}</td>
                  <td className="py-3 px-4 text-white">{month.loans_funded.toLocaleString()}</td>
                  <td className="py-3 px-4 text-white">{formatCurrency(month.total_funded_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report Generation Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h3 className="text-xl font-semibold text-white">Generate Report</h3>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Report Type Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-300">Report Type</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { id: 'client_portfolio', name: 'Client Portfolio Report', desc: 'Comprehensive client overview' },
                    { id: 'payment_summary', name: 'Payment Summary', desc: 'Payment history and analytics' },
                    { id: 'loan_activity', name: 'Loan Activity Report', desc: 'Detailed loan transaction history' },
                    { id: 'performance_metrics', name: 'Performance Metrics', desc: 'KPIs and analytics dashboard' },
                    { id: 'county_analysis', name: 'County Analysis', desc: 'Geographic performance breakdown' },
                    { id: 'monthly_trends', name: 'Monthly Trends', desc: 'Historical trend analysis' }
                  ].map((report) => (
                    <div
                      key={report.id}
                      onClick={() => setSelectedReportType(report.id)}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${ 
                        selectedReportType === report.id
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-slate-600 hover:border-slate-500 bg-slate-700/50'
                      }`}
                    >
                      <h4 className="font-medium text-white">{report.name}</h4>
                      <p className="text-sm text-slate-400 mt-1">{report.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Report Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Date Range</label>
                  <div className="space-y-2">
                    <input
                      type="date"
                      value={reportFilters.dateRange.start}
                      onChange={(e) => setReportFilters({
                        ...reportFilters,
                        dateRange: { ...reportFilters.dateRange, start: e.target.value }
                      })}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="date"
                      value={reportFilters.dateRange.end}
                      onChange={(e) => setReportFilters({
                        ...reportFilters,
                        dateRange: { ...reportFilters.dateRange, end: e.target.value }
                      })}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Format</label>
                  <select
                    value={reportFilters.format}
                    onChange={(e) => setReportFilters({ ...reportFilters, format: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="pdf">PDF Document</option>
                    <option value="excel">Excel Spreadsheet</option>
                    <option value="csv">CSV File</option>
                  </select>
                </div>
              </div>

              {/* Report Options */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-300">Report Options</label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={reportFilters.includeDetails}
                      onChange={(e) => setReportFilters({ ...reportFilters, includeDetails: e.target.checked })}
                      className="rounded bg-slate-700 border-slate-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-300">Include detailed client information</span>
                  </label>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      className="rounded bg-slate-700 border-slate-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-300">Include charts and visualizations</span>
                  </label>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      className="rounded bg-slate-700 border-slate-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-300">Apply current dashboard filters</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between p-6 border-t border-slate-700">
              <button
                onClick={() => setShowReportModal(false)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    // Preview functionality
                    console.log('Previewing report:', selectedReportType, reportFilters);
                  }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Preview
                </button>
                <button
                  onClick={() => {
                    if (!selectedReportType) {
                      alert('Please select a report type');
                      return;
                    }
                    
                    // Generate report
                    console.log('Generating report:', selectedReportType, reportFilters);
                    
                    // Simulate report generation
                    const reportName = `${selectedReportType}_${new Date().toISOString().split('T')[0]}.${reportFilters.format}`;
                    
                    // Create a temporary download link
                    const element = document.createElement('a');
                    element.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(`Report: ${selectedReportType}\nGenerated: ${new Date().toISOString()}\nFilters: ${JSON.stringify(reportFilters, null, 2)}`);
                    element.download = reportName;
                    document.body.appendChild(element);
                    element.click();
                    document.body.removeChild(element);
                    
                    setShowReportModal(false);
                  }}
                  disabled={!selectedReportType}
                  className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Generate Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TLCClientDashboard;