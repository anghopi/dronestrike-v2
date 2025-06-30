import React, { useState, useEffect } from 'react';
import { campaignService } from '../../services/api';
import { Campaign, CampaignAnalytics } from '../../types';
import { useWebSocket, useRealTimeNotifications, useCampaignUpdates } from '../../hooks/useWebSocket';

export const CampaignDashboard: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // WebSocket hooks for real-time updates
  const { isConnected, connectionStatus } = useWebSocket();
  const { notifications, unreadCount } = useRealTimeNotifications();
  const { campaignData, progress } = useCampaignUpdates();

  useEffect(() => {
    loadData();
  }, []);

  // Update campaigns when real-time data changes
  useEffect(() => {
    if (campaignData) {
      setCampaigns(prev => 
        prev.map(campaign => 
          campaign.id === campaignData.campaign_id 
            ? { ...campaign, ...campaignData }
            : campaign
        )
      );
    }
  }, [campaignData]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [campaignsResponse, analyticsResponse] = await Promise.all([
        campaignService.getCampaigns({ limit: 10 }),
        campaignService.getAnalytics()
      ]);
      
      setCampaigns(campaignsResponse.campaigns || []);
      setAnalytics(analyticsResponse);
    } catch (err: any) {
      setError(err.message || 'Failed to load campaign data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    const colors = {
      'draft': 'bg-gray-100 text-gray-800',
      'scheduled': 'bg-blue-100 text-blue-800',
      'active': 'bg-green-100 text-green-800',
      'paused': 'bg-yellow-100 text-yellow-800',
      'completed': 'bg-purple-100 text-purple-800',
      'failed': 'bg-red-100 text-red-800',
      'cancelled': 'bg-gray-100 text-gray-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getCommunicationTypeIcon = (type: string) => {
    const icons = {
      'email': '📧',
      'sms': '💬',
      'postcard': '📮',
      'letter': '✉️',
      'phone': '📞'
    };
    return icons[type as keyof typeof icons] || '📄';
  };

  if (loading) {
    return (
      <div className="campaign-dashboard bg-white p-6 rounded-lg shadow">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="campaign-dashboard bg-white p-6 rounded-lg shadow">
        <div className="text-red-600">
          <h3 className="text-lg font-semibold mb-2">Error Loading Campaigns</h3>
          <p>{error}</p>
          <button 
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="campaign-dashboard">
      {/* Analytics Overview */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Total Campaigns</h3>
            <p className="text-2xl font-bold text-gray-900">
              {analytics.overview.summary.total_campaigns}
            </p>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Active Campaigns</h3>
            <p className="text-2xl font-bold text-green-600">
              {analytics.overview.summary.active_campaigns}
            </p>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Total Sent</h3>
            <p className="text-2xl font-bold text-blue-600">
              {analytics.aggregate_metrics.total_sent.toLocaleString()}
            </p>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Avg Response Rate</h3>
            <p className="text-2xl font-bold text-purple-600">
              {analytics.aggregate_metrics.average_response_rate.toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {/* Recent Campaigns */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Campaigns</h2>
              
              {/* Real-time status indicator */}
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className={`text-sm font-medium ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                  {isConnected ? 'Live' : 'Offline'}
                </span>
              </div>

              {/* Notifications counter */}
              {unreadCount > 0 && (
                <div className="flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                  <span>🔔</span>
                  <span>{unreadCount} updates</span>
                </div>
              )}
            </div>
            
            <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
              Create Campaign
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Campaign
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{campaign.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="mr-2">{getCommunicationTypeIcon(campaign.communication_type)}</span>
                      <span className="capitalize">{campaign.communication_type}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(campaign.status)}`}>
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center space-x-2">
                      <div>
                        <div>{campaign.total_sent.toLocaleString()}</div>
                        {campaign.total_failed > 0 && (
                          <div className="text-red-500 text-xs">
                            {campaign.total_failed} failed
                          </div>
                        )}
                      </div>
                      {/* Real-time progress indicator for active campaigns */}
                      {campaign.status === 'active' && progress && Object.keys(progress).length > 0 && (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          <span className="text-xs text-blue-600">Live</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {campaign.tokens_consumed} tokens
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(campaign.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {campaigns.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-500">
                <p className="text-lg mb-2">No campaigns yet</p>
                <p className="text-sm">Create your first campaign to get started with targeted outreach.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampaignDashboard;