import React, { useState } from 'react';
import { 
  MegaphoneIcon, 
  EnvelopeIcon, 
  PhoneIcon,
  ChartBarIcon,
  UserGroupIcon,
  PlusIcon,
  PlayIcon,
  PauseIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';

interface Campaign {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'direct_mail' | 'voice';
  status: 'draft' | 'active' | 'paused' | 'completed';
  targets: number;
  sent: number;
  opens?: number;
  clicks?: number;
  responses: number;
  created: string;
  budget: number;
  spent: number;
}

const mockCampaigns: Campaign[] = [
  {
    id: '1',
    name: 'Property Owner Outreach - Q4',
    type: 'email',
    status: 'active',
    targets: 2500,
    sent: 1850,
    opens: 740,
    clicks: 148,
    responses: 23,
    created: '2025-06-10',
    budget: 500,
    spent: 185
  },
  {
    id: '2', 
    name: 'High-Value Target SMS',
    type: 'sms',
    status: 'active',
    targets: 500,
    sent: 500,
    responses: 45,
    created: '2025-06-12',
    budget: 200,
    spent: 120
  },
  {
    id: '3',
    name: 'Direct Mail - Luxury Homes',
    type: 'direct_mail',
    status: 'paused',
    targets: 1000,
    sent: 250,
    responses: 8,
    created: '2025-06-08',
    budget: 1000,
    spent: 280
  }
];

const Marketing: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>(mockCampaigns);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'campaigns' | 'templates' | 'analytics'>('overview');

  const getStatusColor = (status: Campaign['status']) => {
    switch (status) {
      case 'active': return 'text-olive-green';
      case 'paused': return 'text-alert-yellow';
      case 'completed': return 'text-gray-400';
      default: return 'text-gray-300';
    }
  };

  const getTypeIcon = (type: Campaign['type']) => {
    switch (type) {
      case 'email': return EnvelopeIcon;
      case 'sms': return PhoneIcon;
      case 'direct_mail': return DocumentTextIcon;
      case 'voice': return PhoneIcon;
      default: return MegaphoneIcon;
    }
  };

  const toggleCampaignStatus = (id: string) => {
    setCampaigns(campaigns.map(campaign => {
      if (campaign.id === id) {
        return {
          ...campaign,
          status: campaign.status === 'active' ? 'paused' : 'active'
        };
      }
      return campaign;
    }));
  };

  const totalStats = campaigns.reduce((acc, campaign) => ({
    targets: acc.targets + campaign.targets,
    sent: acc.sent + campaign.sent,
    responses: acc.responses + campaign.responses,
    spent: acc.spent + campaign.spent,
    budget: acc.budget + campaign.budget
  }), { targets: 0, sent: 0, responses: 0, spent: 0, budget: 0 });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Marketing Command</h1>
          <p className="text-gray-300">Coordinate multi-channel campaigns and strategic outreach</p>
        </div>
        <button className="btn-primary">
          <PlusIcon className="w-5 h-5 mr-2" />
          New Campaign
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-navy-blue-light">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: ChartBarIcon },
            { id: 'campaigns', label: 'Campaigns', icon: MegaphoneIcon },
            { id: 'templates', label: 'Templates', icon: DocumentTextIcon },
            { id: 'analytics', label: 'Analytics', icon: ChartBarIcon }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as any)}
              className={`flex items-center px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                selectedTab === tab.id
                  ? 'border-brand-color text-white'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {selectedTab === 'overview' && (
        <div className="space-y-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card-military p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-medium uppercase">Total Targets</p>
                  <p className="text-2xl font-bold text-white">{totalStats.targets.toLocaleString()}</p>
                </div>
                <UserGroupIcon className="h-8 w-8 text-brand-color" />
              </div>
            </div>

            <div className="card-military p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-medium uppercase">Messages Sent</p>
                  <p className="text-2xl font-bold text-white">{totalStats.sent.toLocaleString()}</p>
                </div>
                <MegaphoneIcon className="h-8 w-8 text-olive-green" />
              </div>
            </div>

            <div className="card-military p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-medium uppercase">Total Responses</p>
                  <p className="text-2xl font-bold text-white">{totalStats.responses}</p>
                </div>
                <ChartBarIcon className="h-8 w-8 text-alert-yellow" />
              </div>
            </div>

            <div className="card-military p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-medium uppercase">Budget Used</p>
                  <p className="text-2xl font-bold text-white">
                    ${totalStats.spent} / ${totalStats.budget}
                  </p>
                </div>
                <ChartBarIcon className="h-8 w-8 text-critical-red" />
              </div>
            </div>
          </div>

          {/* Active Campaigns */}
          <div className="card-military p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Active Campaigns</h3>
            <div className="space-y-4">
              {campaigns.filter(c => c.status === 'active').map(campaign => {
                const Icon = getTypeIcon(campaign.type);
                return (
                  <div key={campaign.id} className="flex items-center justify-between p-4 bg-navy-blue-light rounded-lg">
                    <div className="flex items-center space-x-4">
                      <Icon className="h-6 w-6 text-brand-color" />
                      <div>
                        <h4 className="font-medium text-white">{campaign.name}</h4>
                        <p className="text-sm text-gray-400">
                          {campaign.sent} / {campaign.targets} sent • {campaign.responses} responses
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className={`text-sm font-medium ${getStatusColor(campaign.status)}`}>
                        {campaign.status.toUpperCase()}
                      </span>
                      <button
                        onClick={() => toggleCampaignStatus(campaign.id)}
                        className="p-2 rounded hover:bg-navy-blue transition-colors"
                      >
                        <PauseIcon className="h-4 w-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {selectedTab === 'campaigns' && (
        <div className="space-y-6">
          {/* Campaign Filters */}
          <div className="flex items-center space-x-4">
            <select className="bg-navy-blue-light border border-navy-blue-light rounded px-3 py-2 text-white">
              <option>All Types</option>
              <option>Email</option>
              <option>SMS</option>
              <option>Direct Mail</option>
              <option>Voice</option>
            </select>
            <select className="bg-navy-blue-light border border-navy-blue-light rounded px-3 py-2 text-white">
              <option>All Status</option>
              <option>Active</option>
              <option>Paused</option>
              <option>Draft</option>
              <option>Completed</option>
            </select>
          </div>

          {/* Campaigns Table */}
          <div className="card-military overflow-hidden">
            <table className="w-full">
              <thead className="bg-navy-blue-light">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Campaign</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Progress</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Response Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Budget</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-blue-light">
                {campaigns.map(campaign => {
                  const Icon = getTypeIcon(campaign.type);
                  const responseRate = campaign.sent > 0 ? ((campaign.responses / campaign.sent) * 100).toFixed(1) : '0';
                  const progress = campaign.targets > 0 ? ((campaign.sent / campaign.targets) * 100).toFixed(0) : '0';
                  
                  return (
                    <tr key={campaign.id} className="hover:bg-navy-blue-light/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <Icon className="h-5 w-5 text-brand-color mr-3" />
                          <div>
                            <div className="text-sm font-medium text-white">{campaign.name}</div>
                            <div className="text-sm text-gray-400">Created {campaign.created}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300 capitalize">{campaign.type.replace('_', ' ')}</td>
                      <td className="px-6 py-4">
                        <span className={`text-sm font-medium ${getStatusColor(campaign.status)}`}>
                          {campaign.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-16 bg-navy-blue rounded-full h-2 mr-3">
                            <div
                              className="bg-brand-color h-2 rounded-full"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-300">{campaign.sent} / {campaign.targets}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">{responseRate}%</td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        ${campaign.spent} / ${campaign.budget}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => toggleCampaignStatus(campaign.id)}
                            className="p-1 rounded hover:bg-navy-blue transition-colors"
                          >
                            {campaign.status === 'active' ? (
                              <PauseIcon className="h-4 w-4 text-gray-400" />
                            ) : (
                              <PlayIcon className="h-4 w-4 text-gray-400" />
                            )}
                          </button>
                          <button className="p-1 rounded hover:bg-navy-blue transition-colors">
                            <ChartBarIcon className="h-4 w-4 text-gray-400" />
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

      {(selectedTab === 'templates' || selectedTab === 'analytics') && (
        <div className="card-military p-8">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-white mb-2">
              {selectedTab === 'templates' ? 'Message Templates' : 'Campaign Analytics'}
            </h3>
            <p className="text-gray-400">
              {selectedTab === 'templates' 
                ? 'Template management system coming soon...'
                : 'Advanced analytics dashboard coming soon...'
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Marketing;