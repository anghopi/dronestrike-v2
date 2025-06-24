import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  MapPin,
  Clock,
  DollarSign,
  Target as TargetIcon,
  Calendar,
  Download,
  Filter,
  RefreshCw,
  Settings,
  Eye,
  FileText,
  Activity
} from 'lucide-react';
import {
  analyticsService,
  AnalyticsDashboardData,
  AnalyticsTimeframe,
  ComparisonAnalytics
} from '../../services/analyticsService';

interface AnalyticsDashboardProps {
  timeframe?: AnalyticsTimeframe;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ timeframe }) => {
  const [data, setData] = useState<AnalyticsDashboardData | null>(null);
  const [comparison, setComparison] = useState<ComparisonAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState<AnalyticsTimeframe>(
    timeframe || {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date().toISOString(),
      period: 'day'
    }
  );
  const [activeView, setActiveView] = useState<'overview' | 'agents' | 'missions' | 'revenue' | 'geographic'>('overview');
  const [showFilters, setShowFilters] = useState(false);
  const [realTimeMode, setRealTimeMode] = useState(true);

  useEffect(() => {
    loadAnalyticsData();
  }, [selectedTimeframe]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (realTimeMode) {
      interval = setInterval(() => {
        updateRealTimeMetrics();
      }, 30000); // Update every 30 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [realTimeMode]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      const [dashboardData, comparisonData] = await Promise.all([
        analyticsService.getDashboardAnalytics(selectedTimeframe),
        analyticsService.getComparisonAnalytics(
          selectedTimeframe,
          getPreviousPeriod(selectedTimeframe)
        )
      ]);
      
      setData(dashboardData);
      setComparison(comparisonData);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateRealTimeMetrics = async () => {
    try {
      const realTimeData = await analyticsService.getRealTimeMetrics();
      if (data) {
        setData(prev => prev ? {
          ...prev,
          real_time_metrics: realTimeData
        } : null);
      }
    } catch (error) {
      console.error('Failed to update real-time metrics:', error);
    }
  };

  const getPreviousPeriod = (current: AnalyticsTimeframe): AnalyticsTimeframe => {
    const currentStart = new Date(current.start);
    const currentEnd = new Date(current.end);
    const duration = currentEnd.getTime() - currentStart.getTime();
    
    return {
      start: new Date(currentStart.getTime() - duration).toISOString(),
      end: current.start,
      period: current.period
    };
  };

  const handleTimeframeChange = (period: string) => {
    const now = new Date();
    let start: Date;
    
    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    setSelectedTimeframe({
      start: start.toISOString(),
      end: now.toISOString(),
      period: period as any
    });
  };

  const exportData = async (format: 'csv' | 'excel' | 'pdf') => {
    try {
      if (!data) return;
      
      const blob = await analyticsService.exportAnalytics(data, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics_${selectedTimeframe.period}_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const getGrowthIndicator = (value: number) => {
    if (value > 0) {
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    } else if (value < 0) {
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    }
    return <div className="w-4 h-4" />;
  };

  const getGrowthColor = (value: number) => {
    return value > 0 ? 'text-green-500' : value < 0 ? 'text-red-500' : 'text-gray-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-300">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-xl">Failed to load analytics data</p>
          <button 
            onClick={loadAnalyticsData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Analytics Dashboard</h1>
          <p className="text-slate-300 mt-1">Comprehensive performance insights and reporting</p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Real-time Toggle */}
          <div className="flex items-center space-x-2">
            <Activity className={`w-4 h-4 ${realTimeMode ? 'text-green-500' : 'text-gray-500'}`} />
            <input
              type="checkbox"
              id="realTime"
              checked={realTimeMode}
              onChange={(e) => setRealTimeMode(e.target.checked)}
              className="rounded border-slate-500 bg-slate-600 text-green-600 focus:ring-green-500"
            />
            <label htmlFor="realTime" className="text-slate-300 text-sm">Real-time</label>
          </div>

          {/* Export Options */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => exportData('csv')}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => exportData('excel')}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
            >
              <FileText className="w-4 h-4" />
            </button>
          </div>

          {/* Filters */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
          </button>

          {/* Refresh */}
          <button
            onClick={loadAnalyticsData}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Time Period Selector */}
      <div className="flex items-center space-x-4 mb-8">
        <Calendar className="w-5 h-5 text-slate-400" />
        <div className="flex space-x-2">
          {['today', 'week', 'month', 'quarter', 'year'].map((period) => (
            <button
              key={period}
              onClick={() => handleTimeframeChange(period)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedTimeframe.period === period
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 mb-8 bg-slate-800 rounded-lg p-1">
        {[
          { key: 'overview', label: 'Overview', icon: BarChart3 },
          { key: 'agents', label: 'Agents', icon: Users },
          { key: 'missions', label: 'Missions', icon: TargetIcon },
          { key: 'revenue', label: 'Revenue', icon: DollarSign },
          { key: 'geographic', label: 'Geographic', icon: MapPin }
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveView(key as any)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              activeView === key
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Overview Stats Cards */}
      {activeView === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <TargetIcon className="w-6 h-6 text-blue-500" />
                </div>
                {comparison && getGrowthIndicator(comparison.growth_rates.missions)}
              </div>
              <h3 className="text-2xl font-bold text-white">{data.overview.mission_completion_rate.toFixed(1)}%</h3>
              <p className="text-slate-300">Mission Completion Rate</p>
              {comparison && (
                <p className={`text-sm mt-1 ${getGrowthColor(comparison.growth_rates.completion_rate)}`}>
                  {comparison.growth_rates.completion_rate > 0 ? '+' : ''}{comparison.growth_rates.completion_rate.toFixed(1)}% vs previous period
                </p>
              )}
            </div>

            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Users className="w-6 h-6 text-green-500" />
                </div>
                {comparison && getGrowthIndicator(comparison.growth_rates.efficiency)}
              </div>
              <h3 className="text-2xl font-bold text-white">{data.overview.agent_utilization_rate.toFixed(1)}%</h3>
              <p className="text-slate-300">Agent Utilization</p>
              {comparison && (
                <p className={`text-sm mt-1 ${getGrowthColor(comparison.growth_rates.efficiency)}`}>
                  {comparison.growth_rates.efficiency > 0 ? '+' : ''}{comparison.growth_rates.efficiency.toFixed(1)}% vs previous period
                </p>
              )}
            </div>

            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <Clock className="w-6 h-6 text-yellow-500" />
                </div>
                <div className="w-4 h-4" />
              </div>
              <h3 className="text-2xl font-bold text-white">{data.overview.average_completion_time.toFixed(1)}</h3>
              <p className="text-slate-300">Avg Completion Time (min)</p>
              <p className="text-sm text-slate-400 mt-1">Target: 30 minutes</p>
            </div>

            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <DollarSign className="w-6 h-6 text-purple-500" />
                </div>
                {comparison && getGrowthIndicator(comparison.growth_rates.revenue)}
              </div>
              <h3 className="text-2xl font-bold text-white">${data.overview.revenue_per_mission.toFixed(0)}</h3>
              <p className="text-slate-300">Revenue per Mission</p>
              {comparison && (
                <p className={`text-sm mt-1 ${getGrowthColor(comparison.growth_rates.revenue)}`}>
                  {comparison.growth_rates.revenue > 0 ? '+' : ''}{comparison.growth_rates.revenue.toFixed(1)}% vs previous period
                </p>
              )}
            </div>
          </div>

          {/* Charts and Additional Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Mission Trends Chart */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">Mission Trends</h3>
              <div className="h-64 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2" />
                  <p>Chart component would be rendered here</p>
                  <p className="text-sm">Daily mission completion trends</p>
                </div>
              </div>
            </div>

            {/* Performance Breakdown */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">Performance Breakdown</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Route Efficiency</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-24 bg-slate-700 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{ width: `${data.overview.route_efficiency_score}%` }}
                      ></div>
                    </div>
                    <span className="text-white font-medium">{data.overview.route_efficiency_score.toFixed(1)}%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Target Conversion</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-24 bg-slate-700 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ width: `${data.overview.target_conversion_rate}%` }}
                      ></div>
                    </div>
                    <span className="text-white font-medium">{data.overview.target_conversion_rate.toFixed(1)}%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-300">ROI</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-24 bg-slate-700 rounded-full h-2">
                      <div 
                        className="bg-purple-500 h-2 rounded-full" 
                        style={{ width: `${Math.min(data.overview.roi_percentage / 5, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-white font-medium">{data.overview.roi_percentage.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Metrics */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Real-time Status</h3>
              <div className={`flex items-center space-x-2 ${realTimeMode ? 'text-green-400' : 'text-gray-400'}`}>
                <Activity className="w-4 h-4" />
                <span className="text-sm">Live</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{data.real_time_metrics.active_agents}</div>
                <div className="text-slate-300 text-sm">Active Agents</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">{data.real_time_metrics.ongoing_missions}</div>
                <div className="text-slate-300 text-sm">Ongoing Missions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">{data.real_time_metrics.completion_rate_today.toFixed(1)}%</div>
                <div className="text-slate-300 text-sm">Today's Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">{data.real_time_metrics.efficiency_score.toFixed(1)}%</div>
                <div className="text-slate-300 text-sm">Efficiency Score</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Agent Performance View */}
      {activeView === 'agents' && (
        <div className="space-y-8">
          <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">Agent Performance Leaderboard</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Rank</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Agent</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Missions</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Success Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Avg Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Revenue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {data.agents.map((agent) => (
                    <tr key={agent.agent_id} className="hover:bg-slate-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            agent.ranking === 1 ? 'bg-yellow-500 text-black' :
                            agent.ranking === 2 ? 'bg-gray-400 text-black' :
                            agent.ranking === 3 ? 'bg-orange-600 text-white' :
                            'bg-slate-600 text-white'
                          }`}>
                            {agent.ranking}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-white">{agent.agent_name}</div>
                        <div className="text-sm text-slate-400">{agent.agent_id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-white">{agent.missions_completed}/{agent.missions_assigned}</div>
                        <div className="text-sm text-slate-400">{agent.completion_rate.toFixed(1)}%</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-white">{agent.success_rate.toFixed(1)}%</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-white">{agent.average_time.toFixed(1)}min</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-white">${agent.revenue_generated.toLocaleString()}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-white">{agent.productivity_score.toFixed(1)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Other views would be implemented similarly */}
      {activeView !== 'overview' && activeView !== 'agents' && (
        <div className="bg-slate-800 rounded-lg p-12 border border-slate-700 text-center">
          <BarChart3 className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">{activeView.charAt(0).toUpperCase() + activeView.slice(1)} Analytics</h3>
          <p className="text-slate-400">This view is under development. Advanced {activeView} analytics and visualizations will be available here.</p>
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;