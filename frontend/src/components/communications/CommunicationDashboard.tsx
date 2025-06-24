import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  PhoneIcon,
  MegaphoneIcon,
  ChartBarIcon,
  UserGroupIcon,
  ClockIcon,
  EyeIcon,
  CursorArrowRaysIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  PlusIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
// TODO: Implement these components
// import CampaignModal from './CampaignModal';
// import ContactModal from './ContactModal';
// import TemplateModal from './TemplateModal';
// import CommunicationAnalytics from './CommunicationAnalytics';

interface CommunicationStats {
  total_messages: number;
  messages_sent: number;
  messages_delivered: number;
  messages_opened: number;
  messages_clicked: number;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
}

interface Campaign {
  id: string;
  name: string;
  channel_type: string;
  status: string;
  total_recipients: number;
  messages_sent: number;
  messages_delivered: number;
  messages_opened: number;
  messages_clicked: number;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

interface RecentMessage {
  id: string;
  channel_type: string;
  to_email?: string;
  to_phone?: string;
  subject?: string;
  status: string;
  sent_at: string;
}

const CommunicationDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'contacts' | 'templates' | 'analytics'>('overview');
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const queryClient = useQueryClient();

  // Fetch communication analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['communication-analytics', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.start) params.append('start_date', dateRange.start);
      if (dateRange.end) params.append('end_date', dateRange.end);
      
      const response = await fetch(`/api/communications/analytics?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    }
  });

  // Fetch campaigns
  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: ['communication-campaigns'],
    queryFn: async () => {
      const response = await fetch('/api/communications/campaigns?limit=10', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('Failed to fetch campaigns');
      const data = await response.json();
      return data.campaigns;
    }
  });

  // Fetch contacts
  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ['communication-contacts'],
    queryFn: async () => {
      const response = await fetch('/api/communications/contacts?limit=5', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('Failed to fetch contacts');
      const data = await response.json();
      return data.contacts;
    }
  });

  // Fetch templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['communication-templates'],
    queryFn: async () => {
      const response = await fetch('/api/communications/templates', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('Failed to fetch templates');
      const data = await response.json();
      return data.templates;
    }
  });

  const getChannelIcon = (channelType: string) => {
    switch (channelType) {
      case 'email':
        return <EnvelopeIcon className="h-5 w-5" />;
      case 'sms':
        return <ChatBubbleLeftRightIcon className="h-5 w-5" />;
      case 'voice':
        return <PhoneIcon className="h-5 w-5" />;
      default:
        return <MegaphoneIcon className="h-5 w-5" />;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'scheduled': return 'bg-yellow-100 text-yellow-800';
      case 'paused': return 'bg-orange-100 text-orange-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Communication Center</h1>
          <p className="text-gray-600">Manage campaigns, contacts, and messaging across all channels</p>
        </div>

        {/* Quick Stats */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <EnvelopeIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Messages Sent</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {analytics.summary.messages_sent.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Delivery Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.summary.delivery_rate.toFixed(1)}%</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <EyeIcon className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Open Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.summary.open_rate.toFixed(1)}%</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <CursorArrowRaysIcon className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Click Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.summary.click_rate.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', name: 'Overview', icon: ChartBarIcon },
              { id: 'campaigns', name: 'Campaigns', icon: MegaphoneIcon },
              { id: 'contacts', name: 'Contacts', icon: UserGroupIcon },
              { id: 'templates', name: 'Templates', icon: DocumentTextIcon },
              { id: 'analytics', name: 'Analytics', icon: ChartBarIcon }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700 border-blue-500'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="h-5 w-5 mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm">
          {activeTab === 'overview' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Communication Overview</h2>
                <div className="flex space-x-3">
                  <Button onClick={() => setShowCampaignModal(true)}>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    New Campaign
                  </Button>
                  <Button variant="outline" onClick={() => setShowContactModal(true)}>
                    <UserGroupIcon className="h-4 w-4 mr-2" />
                    Add Contact
                  </Button>
                </div>
              </div>

              {/* Recent Campaigns */}
              <div className="mb-8">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Campaigns</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Campaign
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Channel
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Recipients
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Performance
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {campaigns.slice(0, 5).map((campaign: Campaign) => (
                        <tr key={campaign.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{campaign.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {getChannelIcon(campaign.channel_type)}
                              <span className="ml-2 text-sm text-gray-900 capitalize">
                                {campaign.channel_type}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge className={getStatusColor(campaign.status)}>
                              {campaign.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {campaign.total_recipients.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {campaign.delivery_rate.toFixed(1)}% delivery
                            </div>
                            <div className="text-sm text-gray-500">
                              {campaign.open_rate.toFixed(1)}% opens
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(campaign.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="border rounded-lg p-6">
                  <div className="flex items-center mb-4">
                    <MegaphoneIcon className="h-8 w-8 text-blue-500" />
                    <h4 className="ml-3 text-lg font-medium text-gray-900">Create Campaign</h4>
                  </div>
                  <p className="text-gray-600 mb-4">Launch email or SMS campaigns to your contacts</p>
                  <Button onClick={() => setShowCampaignModal(true)} className="w-full">
                    Create Campaign
                  </Button>
                </div>

                <div className="border rounded-lg p-6">
                  <div className="flex items-center mb-4">
                    <UserGroupIcon className="h-8 w-8 text-green-500" />
                    <h4 className="ml-3 text-lg font-medium text-gray-900">Manage Contacts</h4>
                  </div>
                  <p className="text-gray-600 mb-4">Add and organize your contact lists</p>
                  <Button onClick={() => setShowContactModal(true)} variant="outline" className="w-full">
                    Add Contacts
                  </Button>
                </div>

                <div className="border rounded-lg p-6">
                  <div className="flex items-center mb-4">
                    <DocumentTextIcon className="h-8 w-8 text-purple-500" />
                    <h4 className="ml-3 text-lg font-medium text-gray-900">Message Templates</h4>
                  </div>
                  <p className="text-gray-600 mb-4">Create reusable message templates</p>
                  <Button onClick={() => setShowTemplateModal(true)} variant="outline" className="w-full">
                    Create Template
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'campaigns' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Campaigns</h2>
                <Button onClick={() => setShowCampaignModal(true)}>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  New Campaign
                </Button>
              </div>

              <div className="space-y-4">
                {campaigns.map((campaign: Campaign) => (
                  <div key={campaign.id} className="border rounded-lg p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{campaign.name}</h3>
                          <Badge className={getStatusColor(campaign.status)}>
                            {campaign.status}
                          </Badge>
                          <div className="flex items-center text-sm text-gray-500">
                            {getChannelIcon(campaign.channel_type)}
                            <span className="ml-1 capitalize">{campaign.channel_type}</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                          <div>
                            <p className="text-sm font-medium text-gray-500">Recipients</p>
                            <p className="text-lg text-gray-900">{campaign.total_recipients.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">Sent</p>
                            <p className="text-lg text-gray-900">{campaign.messages_sent.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">Delivery Rate</p>
                            <p className="text-lg text-gray-900">{campaign.delivery_rate.toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">Open Rate</p>
                            <p className="text-lg text-gray-900">{campaign.open_rate.toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                        <Button variant="outline" size="sm">
                          <Cog6ToothIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'contacts' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Contacts</h2>
                <Button onClick={() => setShowContactModal(true)}>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Contact
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phone
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Engagement
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {contacts.map((contact: any) => (
                      <tr key={contact.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {contact.first_name} {contact.last_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {contact.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {contact.phone}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex space-x-2">
                            {contact.email_subscribed && (
                              <Badge className="bg-blue-100 text-blue-800">Email</Badge>
                            )}
                            {contact.sms_subscribed && (
                              <Badge className="bg-green-100 text-green-800">SMS</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">Score: {contact.engagement_score || 0}</div>
                          <div className="text-sm text-gray-500">
                            Last: {contact.last_engaged ? formatDate(contact.last_engaged) : 'Never'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Message Templates</h2>
                <Button onClick={() => setShowTemplateModal(true)}>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  New Template
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map((template: any) => (
                  <div key={template.id} className="border rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        {getChannelIcon(template.channel_type)}
                        <h3 className="ml-2 font-medium text-gray-900">{template.name}</h3>
                      </div>
                      <Badge className="bg-gray-100 text-gray-800 capitalize">
                        {template.channel_type}
                      </Badge>
                    </div>
                    
                    {template.subject && (
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Subject: {template.subject}
                      </p>
                    )}
                    
                    <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                      {template.body_text}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        Used {template.usage_count || 0} times
                      </span>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm">Edit</Button>
                        <Button variant="outline" size="sm">Use</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="p-6">
              {/* <CommunicationAnalytics data={analytics} loading={analyticsLoading} /> */}
              <div className="text-center text-gray-500 py-8">Analytics component placeholder</div>
            </div>
          )}
        </div>
      </div>

      {/* Modals - TODO: Implement these components */}
      {/* 
      <CampaignModal
        isOpen={showCampaignModal}
        onClose={() => setShowCampaignModal(false)}
        onSuccess={() => {
          setShowCampaignModal(false);
          queryClient.invalidateQueries({ queryKey: ['communication-campaigns'] });
        }}
      />

      <ContactModal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
        onSuccess={() => {
          setShowContactModal(false);
          queryClient.invalidateQueries({ queryKey: ['communication-contacts'] });
        }}
      />

      <TemplateModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSuccess={() => {
          setShowTemplateModal(false);
          queryClient.invalidateQueries({ queryKey: ['communication-templates'] });
        }}
      />
      */}
    </div>
  );
};

export default CommunicationDashboard;