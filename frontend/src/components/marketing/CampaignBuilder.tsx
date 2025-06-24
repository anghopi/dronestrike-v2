import React, { useState, useEffect } from 'react';
import {
  Plus,
  Save,
  Send,
  Users,
  Mail,
  MessageSquare,
  Calendar,
  Target as TargetIcon,
  Settings,
  X,
  Eye,
  Copy,
  BarChart3,
  Filter,
  MapPin,
  DollarSign,
  Clock,
  Zap,
  TestTube,
  Link
} from 'lucide-react';
import {
  marketingAutomationService,
  Campaign,
  CampaignFilters,
  ABTestConfig,
  UTMParameters
} from '../../services/marketingAutomationService';

interface CampaignBuilderProps {
  onSave: (campaign: Campaign) => void;
  onCancel: () => void;
  existingCampaign?: Campaign;
}

const CampaignBuilder: React.FC<CampaignBuilderProps> = ({
  onSave,
  onCancel,
  existingCampaign
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [campaignData, setCampaignData] = useState<Partial<Campaign>>(
    existingCampaign || {
      name: '',
      description: '',
      type: 'email',
      target_audience: {
        segments: [],
        filters: {},
        estimated_reach: 0
      },
      content: {
        message: '',
        call_to_action: {
          text: 'Learn More',
          url: '',
          tracking_enabled: true
        },
        personalization_tokens: []
      },
      schedule: {
        type: 'immediate',
        timezone: 'America/Chicago'
      },
      utm_tracking: {
        source: 'dronestrike_app',
        medium: 'email',
        campaign: '',
        content: 'default'
      }
    }
  );
  const [abTestEnabled, setAbTestEnabled] = useState(false);
  const [abTestConfig, setAbTestConfig] = useState<ABTestConfig>({
    enabled: false,
    test_type: 'subject_line',
    variants: [
      { id: 'a', name: 'Variant A', percentage: 50, content: {} },
      { id: 'b', name: 'Variant B', percentage: 50, content: {} }
    ],
    test_duration_hours: 24,
    success_metric: 'open_rate',
    confidence_level: 95
  });
  const [estimatedReach, setEstimatedReach] = useState(0);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    calculateEstimatedReach();
  }, [campaignData.target_audience?.filters]);

  useEffect(() => {
    // Update UTM campaign parameter when campaign name changes
    if (campaignData.name && campaignData.utm_tracking) {
      setCampaignData(prev => ({
        ...prev,
        utm_tracking: {
          ...prev.utm_tracking!,
          campaign: prev.name!.toLowerCase().replace(/\s+/g, '_')
        }
      }));
    }
  }, [campaignData.name]);

  const calculateEstimatedReach = async () => {
    // Mock calculation - in production would call API
    const baseReach = 10000;
    let reach = baseReach;

    if (campaignData.target_audience?.filters?.counties?.length) {
      reach = reach * (campaignData.target_audience.filters.counties.length / 254);
    }

    if (campaignData.target_audience?.filters?.lead_scores?.min) {
      reach = reach * (1 - campaignData.target_audience.filters.lead_scores.min / 100);
    }

    setEstimatedReach(Math.floor(reach));
  };

  const handleFilterChange = (filterType: string, value: any) => {
    setCampaignData(prev => ({
      ...prev,
      target_audience: {
        ...prev.target_audience!,
        filters: {
          ...prev.target_audience!.filters,
          [filterType]: value
        }
      }
    }));
  };

  const handleContentChange = (field: string, value: any) => {
    setCampaignData(prev => ({
      ...prev,
      content: {
        ...prev.content!,
        [field]: value
      }
    }));
  };

  const handleScheduleChange = (field: string, value: any) => {
    setCampaignData(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule!,
        [field]: value
      }
    }));
  };

  const handleUTMChange = (field: string, value: string) => {
    setCampaignData(prev => ({
      ...prev,
      utm_tracking: {
        ...prev.utm_tracking!,
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    setIsCreating(true);
    try {
      const updatedCampaignData = {
        ...campaignData,
        target_audience: {
          ...campaignData.target_audience!,
          estimated_reach: estimatedReach
        },
        ab_testing: abTestEnabled ? abTestConfig : undefined
      };

      const campaign = await marketingAutomationService.createCampaign(updatedCampaignData);
      
      if (abTestEnabled) {
        await marketingAutomationService.setupABTest(campaign.id, abTestConfig);
      }

      onSave(campaign);
    } catch (error) {
      console.error('Failed to create campaign:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const steps = [
    { title: 'Campaign Info', description: 'Basic campaign details' },
    { title: 'Audience', description: 'Target audience selection' },
    { title: 'Content', description: 'Message and design' },
    { title: 'A/B Testing', description: 'Optimization settings' },
    { title: 'Schedule', description: 'When to send' },
    { title: 'Review', description: 'Final review and launch' }
  ];

  const campaignTypes = [
    { key: 'email', label: 'Email Campaign', icon: Mail, description: 'Send targeted emails to property owners' },
    { key: 'sms', label: 'SMS Campaign', icon: MessageSquare, description: 'Direct text message outreach' },
    { key: 'push', label: 'Push Notification', icon: Zap, description: 'App push notifications' },
    { key: 'direct_mail', label: 'Direct Mail', icon: MapPin, description: 'Physical mail campaigns' }
  ];

  const availableTokens = [
    'first_name', 'last_name', 'property_address', 'city', 'county', 
    'assessed_value', 'market_value', 'equity_amount', 'tax_amount'
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg w-full max-w-7xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className="text-2xl font-bold text-white">Campaign Builder</h2>
            <p className="text-slate-300 text-sm mt-1">Create and optimize your marketing campaigns</p>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex h-[calc(95vh-140px)]">
          {/* Steps Sidebar */}
          <div className="w-64 bg-slate-900 p-6 border-r border-slate-700 overflow-y-auto">
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div
                  key={index}
                  className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    activeStep === index
                      ? 'bg-blue-600 text-white'
                      : activeStep > index
                      ? 'bg-green-600/20 text-green-400'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                  onClick={() => setActiveStep(index)}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    activeStep === index
                      ? 'bg-white text-blue-600'
                      : activeStep > index
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-600 text-white'
                  }`}>
                    {activeStep > index ? '✓' : index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{step.title}</div>
                    <div className="text-xs opacity-75">{step.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* Step 0: Campaign Info */}
            {activeStep === 0 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Campaign Information</h3>
                  <p className="text-slate-300 mb-6">Provide basic details about your campaign</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Campaign Name</label>
                    <input
                      type="text"
                      value={campaignData.name || ''}
                      onChange={(e) => setCampaignData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Q1 Property Owner Outreach"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                    <input
                      type="text"
                      value={campaignData.description || ''}
                      onChange={(e) => setCampaignData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Brief description of the campaign"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-4">Campaign Type</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {campaignTypes.map((type) => {
                      const Icon = type.icon;
                      return (
                        <div
                          key={type.key}
                          className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            campaignData.type === type.key
                              ? 'border-blue-500 bg-blue-500/10'
                              : 'border-slate-600 hover:border-slate-500'
                          }`}
                          onClick={() => setCampaignData(prev => ({ ...prev, type: type.key as any }))}
                        >
                          <div className="flex items-center space-x-3 mb-2">
                            <div className={`p-2 rounded-lg ${
                              campaignData.type === type.key
                                ? 'bg-blue-500/20'
                                : 'bg-slate-700'
                            }`}>
                              <Icon className={`w-5 h-5 ${
                                campaignData.type === type.key
                                  ? 'text-blue-400'
                                  : 'text-slate-400'
                              }`} />
                            </div>
                            <h5 className="font-medium text-white">{type.label}</h5>
                          </div>
                          <p className="text-sm text-slate-400">{type.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Audience */}
            {activeStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Target Audience</h3>
                  <p className="text-slate-300 mb-6">Define who should receive this campaign</p>
                </div>

                <div className="bg-slate-700 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">Estimated Reach</span>
                    <span className="text-2xl font-bold text-blue-400">{estimatedReach.toLocaleString()}</span>
                  </div>
                  <p className="text-slate-400 text-sm mt-1">people will receive this campaign</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Counties Filter */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Counties</label>
                    <div className="max-h-40 overflow-y-auto bg-slate-700 border border-slate-600 rounded p-3">
                      {['Harris', 'Dallas', 'Tarrant', 'Bexar', 'Travis', 'Collin', 'Fort Bend', 'Montgomery'].map(county => (
                        <label key={county} className="flex items-center space-x-2 py-1">
                          <input
                            type="checkbox"
                            checked={campaignData.target_audience?.filters?.counties?.includes(county) || false}
                            onChange={(e) => {
                              const counties = campaignData.target_audience?.filters?.counties || [];
                              const newCounties = e.target.checked
                                ? [...counties, county]
                                : counties.filter(c => c !== county);
                              handleFilterChange('counties', newCounties);
                            }}
                            className="rounded border-slate-500 bg-slate-600 text-blue-600"
                          />
                          <span className="text-white text-sm">{county}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Lead Score Filter */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Lead Score Range</label>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="number"
                          placeholder="Min score"
                          value={campaignData.target_audience?.filters?.lead_scores?.min || ''}
                          onChange={(e) => handleFilterChange('lead_scores', {
                            ...campaignData.target_audience?.filters?.lead_scores,
                            min: parseInt(e.target.value) || 0
                          })}
                          className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                        />
                        <input
                          type="number"
                          placeholder="Max score"
                          value={campaignData.target_audience?.filters?.lead_scores?.max || ''}
                          onChange={(e) => handleFilterChange('lead_scores', {
                            ...campaignData.target_audience?.filters?.lead_scores,
                            max: parseInt(e.target.value) || 100
                          })}
                          className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Property Value Range */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Property Value Range</label>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        placeholder="Min value"
                        value={campaignData.target_audience?.filters?.equity_ranges?.min || ''}
                        onChange={(e) => handleFilterChange('equity_ranges', {
                          ...campaignData.target_audience?.filters?.equity_ranges,
                          min: parseInt(e.target.value) || 0
                        })}
                        className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                      />
                      <input
                        type="number"
                        placeholder="Max value"
                        value={campaignData.target_audience?.filters?.equity_ranges?.max || ''}
                        onChange={(e) => handleFilterChange('equity_ranges', {
                          ...campaignData.target_audience?.filters?.equity_ranges,
                          max: parseInt(e.target.value) || 1000000
                        })}
                        className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                      />
                    </div>
                  </div>

                  {/* Engagement History */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Engagement History</label>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={campaignData.target_audience?.filters?.engagement_history?.email_opened || false}
                          onChange={(e) => handleFilterChange('engagement_history', {
                            ...campaignData.target_audience?.filters?.engagement_history,
                            email_opened: e.target.checked
                          })}
                          className="rounded border-slate-500 bg-slate-600 text-blue-600"
                        />
                        <span className="text-white text-sm">Previously opened emails</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={campaignData.target_audience?.filters?.engagement_history?.website_visited || false}
                          onChange={(e) => handleFilterChange('engagement_history', {
                            ...campaignData.target_audience?.filters?.engagement_history,
                            website_visited: e.target.checked
                          })}
                          className="rounded border-slate-500 bg-slate-600 text-blue-600"
                        />
                        <span className="text-white text-sm">Visited website</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Content */}
            {activeStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Campaign Content</h3>
                  <p className="text-slate-300 mb-6">Create your message and call-to-action</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {campaignData.type === 'email' && (
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Subject Line</label>
                        <input
                          type="text"
                          value={campaignData.content?.subject || ''}
                          onChange={(e) => handleContentChange('subject', e.target.value)}
                          placeholder="Enter email subject line"
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Message</label>
                      <textarea
                        rows={8}
                        value={campaignData.content?.message || ''}
                        onChange={(e) => handleContentChange('message', e.target.value)}
                        placeholder="Enter your campaign message..."
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">CTA Text</label>
                        <input
                          type="text"
                          value={campaignData.content?.call_to_action?.text || ''}
                          onChange={(e) => handleContentChange('call_to_action', {
                            ...campaignData.content?.call_to_action,
                            text: e.target.value
                          })}
                          placeholder="e.g., Get Started"
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">CTA URL</label>
                        <input
                          type="url"
                          value={campaignData.content?.call_to_action?.url || ''}
                          onChange={(e) => handleContentChange('call_to_action', {
                            ...campaignData.content?.call_to_action,
                            url: e.target.value
                          })}
                          placeholder="https://example.com"
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Personalization Tokens</label>
                    <div className="bg-slate-700 border border-slate-600 rounded-lg p-4 max-h-80 overflow-y-auto">
                      <p className="text-slate-400 text-sm mb-3">Click to add to your message:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {availableTokens.map(token => (
                          <button
                            key={token}
                            onClick={() => {
                              const currentMessage = campaignData.content?.message || '';
                              handleContentChange('message', `${currentMessage} {{${token}}}`);
                            }}
                            className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm transition-colors"
                          >
                            {token.replace(/_/g, ' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: A/B Testing */}
            {activeStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">A/B Testing</h3>
                  <p className="text-slate-300 mb-6">Optimize your campaign performance with testing</p>
                </div>

                <div className="flex items-center space-x-3 mb-6">
                  <input
                    type="checkbox"
                    id="abTestEnabled"
                    checked={abTestEnabled}
                    onChange={(e) => setAbTestEnabled(e.target.checked)}
                    className="rounded border-slate-500 bg-slate-600 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="abTestEnabled" className="text-white font-medium">Enable A/B Testing</label>
                </div>

                {abTestEnabled && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Test Type</label>
                        <select
                          value={abTestConfig.test_type}
                          onChange={(e) => setAbTestConfig(prev => ({ ...prev, test_type: e.target.value as any }))}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                        >
                          <option value="subject_line">Subject Line</option>
                          <option value="content">Message Content</option>
                          <option value="send_time">Send Time</option>
                          <option value="call_to_action">Call to Action</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Success Metric</label>
                        <select
                          value={abTestConfig.success_metric}
                          onChange={(e) => setAbTestConfig(prev => ({ ...prev, success_metric: e.target.value as any }))}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                        >
                          <option value="open_rate">Open Rate</option>
                          <option value="click_rate">Click Rate</option>
                          <option value="conversion_rate">Conversion Rate</option>
                          <option value="response_rate">Response Rate</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-lg font-medium text-white">Test Variants</h4>
                      {abTestConfig.variants.map((variant, index) => (
                        <div key={variant.id} className="p-4 bg-slate-700 rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-medium text-white">{variant.name}</span>
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                value={variant.percentage}
                                onChange={(e) => {
                                  const newVariants = [...abTestConfig.variants];
                                  newVariants[index].percentage = parseInt(e.target.value) || 0;
                                  setAbTestConfig(prev => ({ ...prev, variants: newVariants }));
                                }}
                                className="w-16 px-2 py-1 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                              />
                              <span className="text-slate-400 text-sm">%</span>
                            </div>
                          </div>
                          
                          {abTestConfig.test_type === 'subject_line' && (
                            <input
                              type="text"
                              placeholder={`Subject line for ${variant.name}`}
                              value={variant.content.subject || ''}
                              onChange={(e) => {
                                const newVariants = [...abTestConfig.variants];
                                newVariants[index].content.subject = e.target.value;
                                setAbTestConfig(prev => ({ ...prev, variants: newVariants }));
                              }}
                              className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!abTestEnabled && (
                  <div className="text-center py-12">
                    <TestTube className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">A/B Testing Disabled</h3>
                    <p className="text-slate-400">Enable A/B testing to optimize your campaign performance</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Schedule */}
            {activeStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Campaign Schedule</h3>
                  <p className="text-slate-300 mb-6">When should this campaign be sent?</p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-4">Send Type</label>
                    <div className="space-y-3">
                      <label className="flex items-center space-x-3">
                        <input
                          type="radio"
                          name="scheduleType"
                          value="immediate"
                          checked={campaignData.schedule?.type === 'immediate'}
                          onChange={(e) => handleScheduleChange('type', e.target.value)}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-white">Send immediately after creation</span>
                      </label>
                      <label className="flex items-center space-x-3">
                        <input
                          type="radio"
                          name="scheduleType"
                          value="scheduled"
                          checked={campaignData.schedule?.type === 'scheduled'}
                          onChange={(e) => handleScheduleChange('type', e.target.value)}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-white">Schedule for later</span>
                      </label>
                    </div>
                  </div>

                  {campaignData.schedule?.type === 'scheduled' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Send Date & Time</label>
                        <input
                          type="datetime-local"
                          value={campaignData.schedule?.send_at?.slice(0, 16) || ''}
                          onChange={(e) => handleScheduleChange('send_at', new Date(e.target.value).toISOString())}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Timezone</label>
                        <select
                          value={campaignData.schedule?.timezone || 'America/Chicago'}
                          onChange={(e) => handleScheduleChange('timezone', e.target.value)}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                        >
                          <option value="America/Chicago">Central Time</option>
                          <option value="America/New_York">Eastern Time</option>
                          <option value="America/Denver">Mountain Time</option>
                          <option value="America/Los_Angeles">Pacific Time</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-slate-700 rounded-lg">
                    <div className="flex items-center space-x-3 mb-2">
                      <input
                        type="checkbox"
                        id="optimalTiming"
                        checked={campaignData.schedule?.optimal_send_time || false}
                        onChange={(e) => handleScheduleChange('optimal_send_time', e.target.checked)}
                        className="rounded border-slate-500 bg-slate-600 text-blue-600"
                      />
                      <label htmlFor="optimalTiming" className="text-white font-medium">Optimize send time</label>
                    </div>
                    <p className="text-slate-400 text-sm">Automatically send at the best time based on recipient behavior</p>
                  </div>
                </div>

                {/* UTM Tracking */}
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-white flex items-center space-x-2">
                    <Link className="w-5 h-5" />
                    <span>UTM Tracking</span>
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Source</label>
                      <input
                        type="text"
                        value={campaignData.utm_tracking?.source || ''}
                        onChange={(e) => handleUTMChange('source', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Medium</label>
                      <input
                        type="text"
                        value={campaignData.utm_tracking?.medium || ''}
                        onChange={(e) => handleUTMChange('medium', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Campaign</label>
                      <input
                        type="text"
                        value={campaignData.utm_tracking?.campaign || ''}
                        onChange={(e) => handleUTMChange('campaign', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Content</label>
                      <input
                        type="text"
                        value={campaignData.utm_tracking?.content || ''}
                        onChange={(e) => handleUTMChange('content', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Review */}
            {activeStep === 5 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Review Campaign</h3>
                  <p className="text-slate-300 mb-6">Review all settings before creating your campaign</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="bg-slate-700 rounded-lg p-4">
                      <h4 className="font-medium text-white mb-3">Campaign Details</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Name:</span>
                          <span className="text-white">{campaignData.name || 'Untitled'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Type:</span>
                          <span className="text-white capitalize">{campaignData.type}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Estimated Reach:</span>
                          <span className="text-white">{estimatedReach.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">A/B Testing:</span>
                          <span className="text-white">{abTestEnabled ? 'Enabled' : 'Disabled'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-700 rounded-lg p-4">
                      <h4 className="font-medium text-white mb-3">Content Preview</h4>
                      <div className="text-sm">
                        {campaignData.content?.subject && (
                          <div className="mb-2">
                            <span className="text-slate-400">Subject: </span>
                            <span className="text-white">{campaignData.content.subject}</span>
                          </div>
                        )}
                        <div className="bg-slate-600 rounded p-3 mt-2">
                          <p className="text-white text-xs whitespace-pre-wrap">
                            {campaignData.content?.message || 'No message content'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-slate-700 rounded-lg p-4">
                      <h4 className="font-medium text-white mb-3">Schedule</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Send Type:</span>
                          <span className="text-white capitalize">{campaignData.schedule?.type}</span>
                        </div>
                        {campaignData.schedule?.send_at && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Send At:</span>
                            <span className="text-white">
                              {new Date(campaignData.schedule.send_at).toLocaleString()}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-slate-400">Timezone:</span>
                          <span className="text-white">{campaignData.schedule?.timezone}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-700 rounded-lg p-4">
                      <h4 className="font-medium text-white mb-3">Tracking</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">UTM Source:</span>
                          <span className="text-white">{campaignData.utm_tracking?.source}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">UTM Medium:</span>
                          <span className="text-white">{campaignData.utm_tracking?.medium}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">UTM Campaign:</span>
                          <span className="text-white">{campaignData.utm_tracking?.campaign}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-700">
          <div className="flex space-x-3">
            <button
              onClick={onCancel}
              className="px-6 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>

          <div className="flex space-x-3">
            {activeStep > 0 && (
              <button
                onClick={() => setActiveStep(activeStep - 1)}
                className="px-6 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                Previous
              </button>
            )}
            
            {activeStep < steps.length - 1 ? (
              <button
                onClick={() => setActiveStep(activeStep + 1)}
                disabled={
                  (activeStep === 0 && !campaignData.name) ||
                  (activeStep === 2 && !campaignData.content?.message)
                }
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={isCreating || !campaignData.name || !campaignData.content?.message}
                className="flex items-center space-x-2 px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded-lg transition-colors"
              >
                {isCreating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Create Campaign</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignBuilder;