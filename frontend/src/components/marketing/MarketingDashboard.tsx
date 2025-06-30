import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Mail,
  MessageSquare,
  DollarSign,
  Target as TargetIcon,
  Eye,
  MousePointer,
  Star,
  Settings,
  Plus,
  Play,
  Pause,
  BarChart3,
  PieChart,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  Zap,
  Award,
  Activity
} from 'lucide-react';
import {
  marketingAutomationService,
  MarketingDashboardData,
  Campaign,
  CampaignPerformance
} from '../../services/marketingAutomationService';

interface MarketingDashboardProps {
  className?: string;
}

const MarketingDashboard: React.FC<MarketingDashboardProps> = ({ className = '' }) => {
  const [data, setData] = useState<MarketingDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'leads' | 'automation'>('overview');
  const [selectedTimeframe, setSelectedTimeframe] = useState('30d');

  useEffect(() => {
    loadDashboardData();
  }, [selectedTimeframe]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const dashboardData = await marketingAutomationService.getMarketingDashboard();
      setData(dashboardData);
    } catch (error) {
      console.error('Failed to load marketing dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCampaignAction = async (campaignId: string, action: 'launch' | 'pause' | 'archive') => {
    try {
      switch (action) {
        case 'launch':
          await marketingAutomationService.launchCampaign(campaignId);
          break;
        case 'pause':
          console.log(`Pausing campaign ${campaignId}`);
          break;
        case 'archive':
          console.log(`Archiving campaign ${campaignId}`);
          break;
      }
      loadDashboardData(); // Refresh data
    } catch (error) {
      console.error(`Failed to ${action} campaign:`, error);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-500 bg-green-500/20';
      case 'paused': return 'text-yellow-500 bg-yellow-500/20';
      case 'completed': return 'text-blue-500 bg-blue-500/20';
      case 'draft': return 'text-gray-500 bg-gray-500/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getCampaignTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return Mail;
      case 'sms': return MessageSquare;
      case 'push': return Activity;
      default: return Mail;
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen bg-slate-900 text-white p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-slate-300">Loading marketing dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`min-h-screen bg-slate-900 text-white p-6 ${className}`}>
        <div className="text-center py-12">
          <p className="text-red-400 text-xl">Failed to load marketing dashboard</p>
          <button 
            onClick={loadDashboardData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-900 text-white p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Marketing Dashboard</h1>
          <p className="text-slate-300 mt-1">Campaign performance, lead scoring, and automation insights</p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Timeframe Selector */}
          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value)}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>

          <button
            onClick={loadDashboardData}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>

          <button className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
            <span>New Campaign</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 mb-8 bg-slate-800 rounded-lg p-1">
        {[
          { key: 'overview', label: 'Overview', icon: BarChart3 },
          { key: 'campaigns', label: 'Campaigns', icon: Mail },
          { key: 'leads', label: 'Lead Scoring', icon: TargetIcon },
          { key: 'automation', label: 'Automation', icon: Zap }
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === key
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Mail className="w-6 h-6 text-blue-500" />
                </div>
                {getGrowthIndicator(15.3)}
              </div>
              <h3 className="text-2xl font-bold text-white">{data.overview.active_campaigns}</h3>
              <p className="text-slate-300">Active Campaigns</p>
              <p className="text-sm text-green-500 mt-1">+15.3% this month</p>
            </div>

            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Users className="w-6 h-6 text-green-500" />
                </div>
                {getGrowthIndicator(8.7)}
              </div>
              <h3 className="text-2xl font-bold text-white">{data.overview.total_leads.toLocaleString()}</h3>
              <p className="text-slate-300">Total Leads</p>
              <p className="text-sm text-green-500 mt-1">+8.7% this month</p>
            </div>

            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <Star className="w-6 h-6 text-yellow-500" />
                </div>
                {getGrowthIndicator(12.1)}
              </div>
              <h3 className="text-2xl font-bold text-white">{data.overview.avg_lead_score.toFixed(1)}</h3>
              <p className="text-slate-300">Avg Lead Score</p>
              <p className="text-sm text-green-500 mt-1">+12.1% this month</p>
            </div>

            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <MousePointer className="w-6 h-6 text-purple-500" />
                </div>
                {getGrowthIndicator(5.2)}
              </div>
              <h3 className="text-2xl font-bold text-white">{data.overview.conversion_rate.toFixed(1)}%</h3>
              <p className="text-slate-300">Conversion Rate</p>
              <p className="text-sm text-green-500 mt-1">+5.2% this month</p>
            </div>

            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-500" />
                </div>
                {getGrowthIndicator(23.8)}
              </div>
              <h3 className="text-2xl font-bold text-white">${data.overview.total_revenue.toLocaleString()}</h3>
              <p className="text-slate-300">Total Revenue</p>
              <p className="text-sm text-green-500 mt-1">+23.8% this month</p>
            </div>

            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-orange-500" />
                </div>
                {getGrowthIndicator(18.5)}
              </div>
              <h3 className="text-2xl font-bold text-white">{data.overview.roi.toFixed(1)}%</h3>
              <p className="text-slate-300">ROI</p>
              <p className="text-sm text-green-500 mt-1">+18.5% this month</p>
            </div>
          </div>

          {/* Top Performing Campaigns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">Top Performing Campaigns</h3>
              <div className="space-y-4">
                {data.top_performing_campaigns.slice(0, 5).map(({ campaign, performance }) => {
                  const TypeIcon = getCampaignTypeIcon(campaign.type);
                  return (
                    <div key={campaign.id} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${getStatusColor(campaign.status)}`}>
                          <TypeIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{campaign.name}</p>
                          <p className="text-sm text-slate-400">{campaign.type} • {performance.metrics.sent} sent</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-white">{performance.rates.conversion_rate.toFixed(1)}%</p>
                        <p className="text-sm text-slate-400">conversion</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">Lead Score Distribution</h3>
              <div className="space-y-3">
                {data.lead_scoring_distribution.map((segment) => (
                  <div key={segment.score_range} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-white font-medium">{segment.score_range}</span>
                      <div className="w-32 bg-slate-700 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full" 
                          style={{ width: `${(segment.count / Math.max(...data.lead_scoring_distribution.map(s => s.count))) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-white">{segment.count}</span>
                      <span className="text-slate-400 text-sm ml-2">({segment.conversion_rate.toFixed(1)}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Campaigns Tab */}
      {activeTab === 'campaigns' && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Recent Campaigns</h3>
              <div className="flex items-center space-x-2">
                <button className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors">
                  <Filter className="w-4 h-4" />
                </button>
                <button className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors">
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Campaign</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Reach</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Performance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {data.recent_campaigns.map((campaign) => {
                  const TypeIcon = getCampaignTypeIcon(campaign.type);
                  return (
                    <tr key={campaign.id} className="hover:bg-slate-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${getStatusColor(campaign.status)}`}>
                            <TypeIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">{campaign.name}</div>
                            <div className="text-sm text-slate-400">{campaign.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-white capitalize">{campaign.type}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(campaign.status)}`}>
                          {campaign.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-white">{campaign.target_audience.estimated_reach.toLocaleString()}</div>
                        <div className="text-sm text-slate-400">estimated</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-white">-</div>
                        <div className="text-sm text-slate-400">pending launch</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {campaign.status === 'draft' && (
                            <button
                              onClick={() => handleCampaignAction(campaign.id, 'launch')}
                              className="p-1 text-green-400 hover:text-green-300 transition-colors"
                              title="Launch Campaign"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          {campaign.status === 'active' && (
                            <button
                              onClick={() => handleCampaignAction(campaign.id, 'pause')}
                              className="p-1 text-yellow-400 hover:text-yellow-300 transition-colors"
                              title="Pause Campaign"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          )}
                          <button className="p-1 text-slate-400 hover:text-white transition-colors" title="View Details">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-1 text-slate-400 hover:text-white transition-colors" title="Settings">
                            <Settings className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Automation Tab */}
      {activeTab === 'automation' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Automation Stats */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Automation Overview</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Active Rules</span>
                <span className="text-white font-medium">{data.automation_stats.active_rules}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Triggers Today</span>
                <span className="text-white font-medium">{data.automation_stats.triggers_today}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Actions Executed</span>
                <span className="text-white font-medium">{data.automation_stats.actions_executed}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="lg:col-span-2 bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Automation Rules</h3>
            <div className="text-center py-8">
              <Zap className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-400 mb-4">No automation rules configured yet</p>
              <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors mx-auto">
                <Plus className="w-4 h-4" />
                <span>Create Automation Rule</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lead Scoring Tab */}
      {activeTab === 'leads' && (
        <div className="space-y-8">
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Lead Scoring Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400">{data.overview.avg_lead_score.toFixed(1)}</div>
                <div className="text-slate-300">Average Score</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400">
                  {data.lead_scoring_distribution.filter(s => parseInt(s.score_range.split('-')[0]) >= 80).reduce((sum, s) => sum + s.count, 0)}
                </div>
                <div className="text-slate-300">High Quality Leads</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-400">
                  {data.lead_scoring_distribution.find(s => s.score_range === '90-100')?.conversion_rate.toFixed(1)}%
                </div>
                <div className="text-slate-300">Top Tier Conversion</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-400">
                  {data.lead_scoring_distribution.reduce((sum, s) => sum + s.count, 0).toLocaleString()}
                </div>
                <div className="text-slate-300">Total Scored Leads</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Score Distribution Details</h3>
            <div className="space-y-4">
              {data.lead_scoring_distribution.map((segment) => (
                <div key={segment.score_range} className="p-4 bg-slate-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">Score Range: {segment.score_range}</span>
                    <span className="text-slate-300">{segment.count} leads</span>
                  </div>
                  <div className="w-full bg-slate-600 rounded-full h-2 mb-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${segment.conversion_rate}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Conversion Rate: {segment.conversion_rate.toFixed(1)}%</span>
                    <span className="text-slate-400">
                      {((segment.count / data.lead_scoring_distribution.reduce((sum, s) => sum + s.count, 0)) * 100).toFixed(1)}% of total
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketingDashboard;