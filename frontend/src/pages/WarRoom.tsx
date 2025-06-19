import React, { useState } from 'react';
import { 
  ChatBubbleLeftRightIcon, 
  InboxIcon, 
  MegaphoneIcon,
  CheckCircleIcon,
  EyeIcon,
  ArchiveBoxIcon,
  TrashIcon,
  PaperAirplaneIcon,
  FlagIcon,
  UserIcon,
  CalendarIcon,
  PlayIcon,
  PauseIcon,
  StopIcon
} from '@heroicons/react/24/outline';

interface InboxMessage {
  id: string;
  missionId: string;
  status: 'unread' | 'read' | 'replied' | 'archived';
  missionStage: string;
  lead: string;
  subject: string;
  from: string;
  receivedAt: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

interface MarketingCampaign {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'completed' | 'draft';
  description: string;
  expectedResponse: string;
  date: string;
  responseRate: number;
  totalSent: number;
  totalResponses: number;
}

const WarRoom: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'inbox' | 'campaigns'>('inbox');
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());

  // Mock data - replace with actual API calls
  const [inboxMessages] = useState<InboxMessage[]>([
    {
      id: '1',
      missionId: 'TGT-2024-001',
      status: 'unread',
      missionStage: 'Initial Contact',
      lead: 'John Anderson',
      subject: 'Property Tax Information Request',
      from: 'j.anderson@email.com',
      receivedAt: '2024-01-15T10:30:00Z',
      priority: 'high'
    },
    {
      id: '2',
      missionId: 'TGT-2024-002',
      status: 'read',
      missionStage: 'Qualification',
      lead: 'Sarah Martinez',
      subject: 'Re: Tax Loan Options',
      from: 's.martinez@email.com',
      receivedAt: '2024-01-15T09:15:00Z',
      priority: 'medium'
    },
    {
      id: '3',
      missionId: 'TGT-2024-003',
      status: 'replied',
      missionStage: 'Documentation',
      lead: 'Mike Johnson',
      subject: 'Document Upload Confirmation',
      from: 'm.johnson@email.com',
      receivedAt: '2024-01-14T16:45:00Z',
      priority: 'low'
    }
  ]);

  const [marketingCampaigns] = useState<MarketingCampaign[]>([
    {
      id: '1',
      name: 'Q1 Property Tax Relief Campaign',
      status: 'active',
      description: 'Targeted outreach to property owners with pending tax obligations',
      expectedResponse: '12-15%',
      date: '2024-01-10',
      responseRate: 13.2,
      totalSent: 2500,
      totalResponses: 330
    },
    {
      id: '2',
      name: 'Homestead Exemption Awareness',
      status: 'paused',
      description: 'Educational campaign about homestead exemption benefits',
      expectedResponse: '8-10%',
      date: '2024-01-05',
      responseRate: 9.1,
      totalSent: 1800,
      totalResponses: 164
    },
    {
      id: '3',
      name: 'Commercial Property Focus',
      status: 'completed',
      description: 'Commercial property tax loan promotional campaign',
      expectedResponse: '18-22%',
      date: '2023-12-20',
      responseRate: 19.7,
      totalSent: 850,
      totalResponses: 167
    }
  ]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'unread':
        return <div className="w-2 h-2 bg-brand-color rounded-full animate-pulse" />;
      case 'read':
        return <EyeIcon className="w-4 h-4 text-gray-400" />;
      case 'replied':
        return <CheckCircleIcon className="w-4 h-4 text-success-green" />;
      default:
        return <ArchiveBoxIcon className="w-4 h-4 text-gray-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-500';
      case 'high':
        return 'text-orange-500';
      case 'medium':
        return 'text-yellow-500';
      default:
        return 'text-gray-400';
    }
  };

  const getCampaignStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <PlayIcon className="w-4 h-4 text-success-green" />;
      case 'paused':
        return <PauseIcon className="w-4 h-4 text-yellow-500" />;
      case 'completed':
        return <CheckCircleIcon className="w-4 h-4 text-gray-400" />;
      default:
        return <StopIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toggleMessageSelection = (messageId: string) => {
    const newSelected = new Set(selectedMessages);
    if (newSelected.has(messageId)) {
      newSelected.delete(messageId);
    } else {
      newSelected.add(messageId);
    }
    setSelectedMessages(newSelected);
  };

  const toggleCampaignSelection = (campaignId: string) => {
    const newSelected = new Set(selectedCampaigns);
    if (newSelected.has(campaignId)) {
      newSelected.delete(campaignId);
    } else {
      newSelected.add(campaignId);
    }
    setSelectedCampaigns(newSelected);
  };

  return (
    <div className="min-h-screen bg-navy-blue text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-navy-blue via-navy-blue-light to-brand-color p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <ChatBubbleLeftRightIcon className="w-8 h-8 text-brand-color" />
            <h1 className="text-4xl font-bold text-white">War Room</h1>
          </div>
          <p className="text-xl text-gray-300 max-w-3xl">
            Mission communications center and marketing campaign operations
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Tab Navigation */}
        <div className="enhanced-card p-0 mb-6 overflow-hidden">
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab('inbox')}
              className={`flex-1 px-6 py-4 text-center font-medium transition-all duration-200 ${
                activeTab === 'inbox'
                  ? 'bg-brand-color text-white border-b-2 border-brand-color'
                  : 'text-white hover:text-gray-300 hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <InboxIcon className="w-5 h-5" />
                <span>Inbox</span>
                {inboxMessages.filter(m => m.status === 'unread').length > 0 && (
                  <span className="bg-brand-color/20 text-brand-color px-2 py-1 rounded-full text-xs">
                    {inboxMessages.filter(m => m.status === 'unread').length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('campaigns')}
              className={`flex-1 px-6 py-4 text-center font-medium transition-all duration-200 ${
                activeTab === 'campaigns'
                  ? 'bg-brand-color text-white border-b-2 border-brand-color'
                  : 'text-white hover:text-gray-300 hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <MegaphoneIcon className="w-5 h-5" />
                <span>Marketing Campaigns</span>
                {marketingCampaigns.filter(c => c.status === 'active').length > 0 && (
                  <span className="bg-success-green/20 text-success-green px-2 py-1 rounded-full text-xs">
                    {marketingCampaigns.filter(c => c.status === 'active').length}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Inbox Tab */}
        {activeTab === 'inbox' && (
          <div className="space-y-6">
            {/* Inbox Filters */}
            <div className="enhanced-card p-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search messages..."
                    className="input-military w-full"
                  />
                </div>
                <div className="flex gap-3">
                  <select className="input-military">
                    <option>All Status</option>
                    <option>Unread</option>
                    <option>Read</option>
                    <option>Replied</option>
                  </select>
                  <select className="input-military">
                    <option>All Priorities</option>
                    <option>Urgent</option>
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                  <select className="input-military">
                    <option>All Stages</option>
                    <option>Initial Contact</option>
                    <option>Qualification</option>
                    <option>Documentation</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Inbox Table */}
            <div className="enhanced-card p-0 overflow-hidden">
              {/* Inbox Actions */}
              <div className="p-4 border-b border-gray-700 bg-navy-blue-light">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-300">
                      {selectedMessages.size} selected
                    </span>
                    {selectedMessages.size > 0 && (
                      <div className="flex gap-2">
                        <button className="btn-secondary px-3 py-1 text-sm">
                          <EyeIcon className="w-4 h-4 mr-1" />
                          Mark Read
                        </button>
                        <button className="btn-secondary px-3 py-1 text-sm">
                          <ArchiveBoxIcon className="w-4 h-4 mr-1" />
                          Archive
                        </button>
                        <button className="btn-danger px-3 py-1 text-sm">
                          <TrashIcon className="w-4 h-4 mr-1" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                  <button className="btn-primary">
                    <PaperAirplaneIcon className="w-4 h-4 mr-2" />
                    Compose
                  </button>
                </div>
              </div>

            {/* Inbox Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-navy-blue-light border-b border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        className="rounded border-gray-600 bg-gray-700 text-brand-color focus:ring-brand-color"
                        onChange={() => {/* Toggle all */}}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Mission ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Mission Stage</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Lead</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Subject</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">From</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Received At</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {inboxMessages.map((message) => (
                    <tr 
                      key={message.id} 
                      className={`hover:bg-navy-blue-light transition-colors ${
                        message.status === 'unread' ? 'bg-brand-color/5' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedMessages.has(message.id)}
                          onChange={() => toggleMessageSelection(message.id)}
                          className="rounded border-gray-600 bg-gray-700 text-brand-color focus:ring-brand-color"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(message.status)}
                          <FlagIcon className={`w-4 h-4 ${getPriorityColor(message.priority)}`} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="status-badge bg-brand-color/20 text-brand-color">
                          {message.missionId}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{message.missionStage}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <UserIcon className="w-4 h-4 text-gray-400" />
                          <span className="text-white font-medium">{message.lead}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`${message.status === 'unread' ? 'text-white font-medium' : 'text-gray-300'}`}>
                          {message.subject}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{message.from}</td>
                      <td className="px-4 py-3 text-gray-400">{formatDate(message.receivedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button className="text-brand-color hover:text-brand-color-light">
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          <button className="text-success-green hover:text-green-300">
                            <PaperAirplaneIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          </div>
        )}

        {/* Marketing Campaigns Tab */}
        {activeTab === 'campaigns' && (
          <div className="space-y-6">
            {/* Campaign Filters */}
            <div className="enhanced-card p-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search campaigns..."
                    className="input-military w-full"
                  />
                </div>
                <div className="flex gap-3">
                  <select className="input-military">
                    <option>All Status</option>
                    <option>Active</option>
                    <option>Paused</option>
                    <option>Completed</option>
                    <option>Draft</option>
                  </select>
                  <select className="input-military">
                    <option>Sort by Date</option>
                    <option>Sort by Name</option>
                    <option>Sort by Response Rate</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Campaigns Table */}
            <div className="enhanced-card p-0 overflow-hidden">
              {/* Campaign Actions */}
              <div className="p-4 border-b border-gray-700 bg-navy-blue-light">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-300">
                      {selectedCampaigns.size} selected
                    </span>
                    {selectedCampaigns.size > 0 && (
                      <div className="flex gap-2">
                        <button className="btn-secondary px-3 py-1 text-sm">
                          <PlayIcon className="w-4 h-4 mr-1" />
                          Activate
                        </button>
                        <button className="btn-secondary px-3 py-1 text-sm">
                          <PauseIcon className="w-4 h-4 mr-1" />
                          Pause
                        </button>
                        <button className="btn-danger px-3 py-1 text-sm">
                          <TrashIcon className="w-4 h-4 mr-1" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                  <button className="btn-primary">
                    <MegaphoneIcon className="w-4 h-4 mr-2" />
                    New Campaign
                  </button>
                </div>
              </div>

            {/* Campaigns Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-navy-blue-light border-b border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        className="rounded border-gray-600 bg-gray-700 text-brand-color focus:ring-brand-color"
                        onChange={() => {/* Toggle all */}}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Expected Response</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actual Response</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {marketingCampaigns.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-navy-blue-light transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedCampaigns.has(campaign.id)}
                          onChange={() => toggleCampaignSelection(campaign.id)}
                          className="rounded border-gray-600 bg-gray-700 text-brand-color focus:ring-brand-color"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-white font-medium">{campaign.name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getCampaignStatusIcon(campaign.status)}
                          <span className={`status-badge ${
                            campaign.status === 'active' ? 'bg-success-green/20 text-success-green' :
                            campaign.status === 'paused' ? 'bg-yellow-500/20 text-yellow-500' :
                            campaign.status === 'completed' ? 'bg-gray-500/20 text-gray-400' :
                            'bg-gray-600/20 text-gray-500'
                          }`}>
                            {campaign.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-300 max-w-xs truncate">
                        {campaign.description}
                      </td>
                      <td className="px-4 py-3 text-gray-300">{campaign.expectedResponse}</td>
                      <td className="px-4 py-3">
                        <div className="text-white font-medium">
                          {campaign.responseRate}%
                        </div>
                        <div className="text-xs text-gray-400">
                          {campaign.totalResponses} / {campaign.totalSent}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="w-4 h-4" />
                          {new Date(campaign.date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button className="text-brand-color hover:text-brand-color-light">
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          {campaign.status === 'active' ? (
                            <button className="text-yellow-500 hover:text-yellow-300">
                              <PauseIcon className="w-4 h-4" />
                            </button>
                          ) : (
                            <button className="text-success-green hover:text-green-300">
                              <PlayIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WarRoom;