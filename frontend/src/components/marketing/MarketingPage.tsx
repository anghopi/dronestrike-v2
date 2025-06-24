import React, { useState, useEffect } from 'react';
import {
  Plus,
  BarChart3,
  Mail,
  Zap,
  Users,
  Settings,
  TrendingUp,
  Calendar,
  Target as TargetIcon,
  Eye,
  Edit,
  Trash2,
  Play,
  Pause,
  Copy,
  Download
} from 'lucide-react';
import MarketingDashboard from './MarketingDashboard';
import CampaignBuilder from './CampaignBuilder';
import {
  marketingAutomationService,
  Campaign,
  MarketingDashboardData
} from '../../services/marketingAutomationService';

const MarketingPage: React.FC = () => {
  const [activeView, setActiveView] = useState<'dashboard' | 'campaigns' | 'automation' | 'leads'>('dashboard');
  const [showCampaignBuilder, setShowCampaignBuilder] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [dashboardData, setDashboardData] = useState<MarketingDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMarketingData();
  }, []);

  const loadMarketingData = async () => {
    setLoading(true);
    try {
      const [dashboard, recentCampaigns] = await Promise.all([
        marketingAutomationService.getMarketingDashboard(),
        loadCampaigns()
      ]);
      
      setDashboardData(dashboard);
      setCampaigns(recentCampaigns);
    } catch (error) {
      console.error('Failed to load marketing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCampaigns = async (): Promise<Campaign[]> => {
    // In production, this would fetch from API
    return [
      {
        id: 'camp_001',
        name: 'Q1 Property Outreach',
        description: 'Quarterly property owner outreach campaign',
        type: 'email',
        status: 'active',
        target_audience: {
          segments: ['high_value'],
          filters: {
            counties: ['Harris', 'Montgomery'],
            lead_scores: { min: 70, max: 100 }
          },
          estimated_reach: 2500
        },
        content: {
          subject: 'Unlock Your Property\'s Hidden Value',
          message: 'Dear {{first_name}}, did you know your property at {{property_address}} could be worth more than you think?',
          call_to_action: {
            text: 'Get Free Assessment',
            url: 'https://example.com/assessment',
            tracking_enabled: true
          },
          personalization_tokens: ['first_name', 'property_address']
        },
        schedule: {
          type: 'scheduled',
          send_at: new Date(Date.now() + 86400000).toISOString(),
          timezone: 'America/Chicago'
        },
        utm_tracking: {
          source: 'dronestrike_app',
          medium: 'email',
          campaign: 'q1_property_outreach',
          content: 'newsletter'
        },
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'admin'
      },
      {
        id: 'camp_002',
        name: 'High Equity Targets',
        description: 'Focused campaign for high-equity properties',
        type: 'sms',
        status: 'draft',
        target_audience: {
          segments: ['high_equity'],
          filters: {
            equity_ranges: { min: 100000, max: 500000 },
            counties: ['Harris', 'Dallas']
          },
          estimated_reach: 1200
        },
        content: {
          message: 'Hi {{first_name}}! Your property has significant equity. We can help you access it. Reply STOP to opt out.',
          call_to_action: {
            text: 'Learn More',
            url: 'https://example.com/equity',
            tracking_enabled: true
          },
          personalization_tokens: ['first_name']
        },
        schedule: {
          type: 'immediate',
          timezone: 'America/Chicago'
        },
        utm_tracking: {
          source: 'dronestrike_app',
          medium: 'sms',
          campaign: 'high_equity_targets',
          content: 'direct'
        },
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'admin'
      }
    ];
  };

  const handleSaveCampaign = (campaign: Campaign) => {
    if (editingCampaign) {
      setCampaigns(prev => prev.map(c => c.id === campaign.id ? campaign : c));
    } else {
      setCampaigns(prev => [...prev, campaign]);
    }
    
    setShowCampaignBuilder(false);
    setEditingCampaign(null);
  };

  const handleEditCampaign = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setShowCampaignBuilder(true);
  };

  const handleDeleteCampaign = (campaignId: string) => {
    if (confirm('Are you sure you want to delete this campaign?')) {
      setCampaigns(prev => prev.filter(c => c.id !== campaignId));
    }
  };

  const handleDuplicateCampaign = (campaign: Campaign) => {
    const duplicatedCampaign: Campaign = {
      ...campaign,
      id: `campaign_${Date.now()}`,
      name: `${campaign.name} (Copy)`,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setCampaigns(prev => [...prev, duplicatedCampaign]);
  };

  const handleCampaignAction = async (campaignId: string, action: 'launch' | 'pause' | 'archive') => {
    try {
      switch (action) {
        case 'launch':
          await marketingAutomationService.launchCampaign(campaignId);
          setCampaigns(prev => prev.map(c => 
            c.id === campaignId ? { ...c, status: 'active' } : c
          ));
          break;
        case 'pause':
          setCampaigns(prev => prev.map(c => 
            c.id === campaignId ? { ...c, status: 'paused' } : c
          ));
          break;
        case 'archive':
          setCampaigns(prev => prev.map(c => 
            c.id === campaignId ? { ...c, status: 'archived' } : c
          ));
          break;
      }
    } catch (error) {
      console.error(`Failed to ${action} campaign:`, error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-500 bg-green-500/20';
      case 'paused': return 'text-yellow-500 bg-yellow-500/20';
      case 'completed': return 'text-blue-500 bg-blue-500/20';
      case 'draft': return 'text-gray-500 bg-gray-500/20';
      case 'archived': return 'text-slate-500 bg-slate-500/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getCampaignTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return Mail;
      case 'sms': return Mail; // Using Mail as placeholder
      case 'push': return Zap;
      default: return Mail;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-slate-300">Loading marketing automation...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Navigation */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveView('dashboard')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  activeView === 'dashboard'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Dashboard</span>
              </button>
              
              <button
                onClick={() => setActiveView('campaigns')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  activeView === 'campaigns'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Mail className="w-4 h-4" />
                <span>Campaigns</span>
              </button>

              <button
                onClick={() => setActiveView('automation')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  activeView === 'automation'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Zap className="w-4 h-4" />
                <span>Automation</span>
              </button>

              <button
                onClick={() => setActiveView('leads')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  activeView === 'leads'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <TargetIcon className="w-4 h-4" />
                <span>Lead Scoring</span>
              </button>
            </div>

            <button
              onClick={() => setShowCampaignBuilder(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Campaign</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {activeView === 'dashboard' && (
        <MarketingDashboard />
      )}

      {activeView === 'campaigns' && (
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white">Marketing Campaigns</h1>
              <p className="text-slate-300 mt-1">Create and manage your marketing campaigns</p>
            </div>
            <div className="text-slate-400">
              {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} total
            </div>
          </div>

          {campaigns.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Campaigns</h3>
              <p className="text-slate-400 mb-6">Create your first marketing campaign to get started</p>
              <button
                onClick={() => setShowCampaignBuilder(true)}
                className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors mx-auto"
              >
                <Plus className="w-5 h-5" />
                <span>Create Campaign</span>
              </button>
            </div>
          ) : (
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Campaign</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Audience</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Schedule</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {campaigns.map((campaign) => {
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
                            <div className="text-sm text-slate-400">estimated reach</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-white capitalize">{campaign.schedule.type}</div>
                            {campaign.schedule.send_at && (
                              <div className="text-sm text-slate-400">
                                {new Date(campaign.schedule.send_at).toLocaleDateString()}
                              </div>
                            )}
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
                              <button
                                onClick={() => handleEditCampaign(campaign)}
                                className="p-1 text-slate-400 hover:text-white transition-colors"
                                title="Edit Campaign"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDuplicateCampaign(campaign)}
                                className="p-1 text-slate-400 hover:text-white transition-colors"
                                title="Duplicate Campaign"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteCampaign(campaign.id)}
                                className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                                title="Delete Campaign"
                              >
                                <Trash2 className="w-4 h-4" />
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
        </div>
      )}

      {activeView === 'automation' && (
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center py-12">
            <Zap className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Marketing Automation</h3>
            <p className="text-slate-400 mb-6">Set up automated workflows to nurture leads and optimize campaigns</p>
            <button className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors mx-auto">
              <Plus className="w-5 h-5" />
              <span>Create Automation Rule</span>
            </button>
          </div>
        </div>
      )}

      {activeView === 'leads' && dashboardData && (
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white">Lead Scoring</h1>
              <p className="text-slate-300 mt-1">AI-powered lead qualification and scoring</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="text-3xl font-bold text-blue-400">{dashboardData.overview.avg_lead_score.toFixed(1)}</div>
              <div className="text-slate-300">Average Score</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="text-3xl font-bold text-green-400">
                {dashboardData.lead_scoring_distribution.filter(s => parseInt(s.score_range.split('-')[0]) >= 80).reduce((sum, s) => sum + s.count, 0)}
              </div>
              <div className="text-slate-300">High Quality Leads</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="text-3xl font-bold text-yellow-400">
                {dashboardData.lead_scoring_distribution.find(s => s.score_range === '90-100')?.conversion_rate.toFixed(1)}%
              </div>
              <div className="text-slate-300">Top Tier Conversion</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="text-3xl font-bold text-purple-400">
                {dashboardData.lead_scoring_distribution.reduce((sum, s) => sum + s.count, 0).toLocaleString()}
              </div>
              <div className="text-slate-300">Total Scored Leads</div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Score Distribution</h3>
            <div className="space-y-4">
              {dashboardData.lead_scoring_distribution.map((segment) => (
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
                      {((segment.count / dashboardData.lead_scoring_distribution.reduce((sum, s) => sum + s.count, 0)) * 100).toFixed(1)}% of total
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Campaign Builder Modal */}
      {showCampaignBuilder && (
        <CampaignBuilder
          onSave={handleSaveCampaign}
          onCancel={() => {
            setShowCampaignBuilder(false);
            setEditingCampaign(null);
          }}
          existingCampaign={editingCampaign || undefined}
        />
      )}
    </div>
  );
};

export default MarketingPage;