// Marketing Automation Service
// Comprehensive marketing automation with A/B testing, campaign optimization, lead scoring, and UTM tracking

import { Target } from '../types/target';

export interface Campaign {
  id: string;
  name: string;
  description: string;
  type: 'email' | 'sms' | 'push' | 'direct_mail';
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  target_audience: {
    segments: string[];
    filters: CampaignFilters;
    estimated_reach: number;
  };
  content: CampaignContent;
  schedule: CampaignSchedule;
  ab_testing?: ABTestConfig;
  utm_tracking: UTMParameters;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface CampaignFilters {
  counties?: string[];
  property_types?: string[];
  equity_ranges?: {
    min: number;
    max: number;
  };
  lead_scores?: {
    min: number;
    max: number;
  };
  demographics?: {
    age_ranges?: Array<{ min: number; max: number }>;
    income_ranges?: Array<{ min: number; max: number }>;
  };
  engagement_history?: {
    email_opened: boolean;
    sms_responded: boolean;
    website_visited: boolean;
    days_since_contact?: number;
  };
}

export interface CampaignContent {
  subject?: string;
  message: string;
  html_content?: string;
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
  }>;
  call_to_action: {
    text: string;
    url: string;
    tracking_enabled: boolean;
  };
  personalization_tokens: string[];
}

export interface CampaignSchedule {
  type: 'immediate' | 'scheduled' | 'recurring';
  send_at?: string;
  timezone: string;
  recurring_pattern?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval: number;
    end_date?: string;
  };
  optimal_send_time?: boolean;
}

export interface ABTestConfig {
  enabled: boolean;
  test_type: 'subject_line' | 'content' | 'send_time' | 'call_to_action';
  variants: Array<{
    id: string;
    name: string;
    percentage: number;
    content: Partial<CampaignContent>;
  }>;
  test_duration_hours: number;
  success_metric: 'open_rate' | 'click_rate' | 'conversion_rate' | 'response_rate';
  confidence_level: number;
}

export interface UTMParameters {
  source: string;
  medium: string;
  campaign: string;
  term?: string;
  content?: string;
  custom_parameters?: Record<string, string>;
}

export interface LeadScore {
  target_id: number;
  overall_score: number;
  demographic_score: number;
  behavioral_score: number;
  engagement_score: number;
  property_score: number;
  last_calculated: string;
  score_factors: Array<{
    factor: string;
    weight: number;
    value: number;
    contribution: number;
  }>;
}

export interface CampaignPerformance {
  campaign_id: string;
  metrics: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    converted: number;
    unsubscribed: number;
    bounced: number;
    spam_reported: number;
  };
  rates: {
    delivery_rate: number;
    open_rate: number;
    click_rate: number;
    conversion_rate: number;
    unsubscribe_rate: number;
    bounce_rate: number;
  };
  revenue: {
    total: number;
    per_recipient: number;
    roi: number;
  };
  ab_test_results?: ABTestResults;
  geographic_performance: Array<{
    county: string;
    sent: number;
    conversion_rate: number;
    revenue: number;
  }>;
  time_series: Array<{
    timestamp: string;
    opens: number;
    clicks: number;
    conversions: number;
  }>;
}

export interface ABTestResults {
  test_id: string;
  winner: string;
  confidence: number;
  lift: number;
  variants: Array<{
    id: string;
    name: string;
    sample_size: number;
    conversion_rate: number;
    statistical_significance: boolean;
  }>;
  recommendations: string[];
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: {
    type: 'lead_score_change' | 'property_update' | 'engagement_event' | 'time_based';
    conditions: Record<string, any>;
  };
  actions: Array<{
    type: 'send_campaign' | 'update_score' | 'assign_agent' | 'create_task';
    config: Record<string, any>;
    delay_minutes?: number;
  }>;
  created_at: string;
  last_triggered?: string;
  trigger_count: number;
}

export interface MarketingDashboardData {
  overview: {
    active_campaigns: number;
    total_leads: number;
    avg_lead_score: number;
    conversion_rate: number;
    total_revenue: number;
    roi: number;
  };
  recent_campaigns: Campaign[];
  top_performing_campaigns: Array<{
    campaign: Campaign;
    performance: CampaignPerformance;
  }>;
  lead_scoring_distribution: Array<{
    score_range: string;
    count: number;
    conversion_rate: number;
  }>;
  automation_stats: {
    active_rules: number;
    triggers_today: number;
    actions_executed: number;
  };
}

class MarketingAutomationService {
  private apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';
  private defaultUTMSource = 'dronestrike_app';

  /**
   * Create a new marketing campaign
   */
  async createCampaign(campaignData: Partial<Campaign>): Promise<Campaign> {
    try {
      const campaign: Campaign = {
        id: `campaign_${Date.now()}`,
        name: campaignData.name || 'Untitled Campaign',
        description: campaignData.description || '',
        type: campaignData.type || 'email',
        status: 'draft',
        target_audience: campaignData.target_audience || {
          segments: [],
          filters: {},
          estimated_reach: 0
        },
        content: campaignData.content || {
          message: '',
          call_to_action: {
            text: 'Learn More',
            url: '',
            tracking_enabled: true
          },
          personalization_tokens: []
        },
        schedule: campaignData.schedule || {
          type: 'immediate',
          timezone: 'America/Chicago'
        },
        utm_tracking: campaignData.utm_tracking || this.generateDefaultUTM(campaignData.name || 'campaign'),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'current_user'
      };

      // Calculate estimated reach
      campaign.target_audience.estimated_reach = await this.calculateEstimatedReach(
        campaign.target_audience.filters
      );

      return campaign;
    } catch (error) {
      console.error('Failed to create campaign:', error);
      throw new Error('Campaign creation failed');
    }
  }

  /**
   * Set up A/B test for campaign
   */
  async setupABTest(campaignId: string, abConfig: ABTestConfig): Promise<Campaign> {
    try {
      // Validate A/B test configuration
      this.validateABTestConfig(abConfig);

      // In production, this would update the campaign in the database
      console.log(`Setting up A/B test for campaign ${campaignId}:`, abConfig);

      // Mock updated campaign
      return {
        id: campaignId,
        name: 'A/B Test Campaign',
        description: 'Campaign with A/B testing enabled',
        type: 'email',
        status: 'draft',
        target_audience: { segments: [], filters: {}, estimated_reach: 1000 },
        content: { message: '', call_to_action: { text: '', url: '', tracking_enabled: true }, personalization_tokens: [] },
        schedule: { type: 'immediate', timezone: 'America/Chicago' },
        ab_testing: abConfig,
        utm_tracking: this.generateDefaultUTM('ab_test'),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'current_user'
      };
    } catch (error) {
      console.error('Failed to setup A/B test:', error);
      throw new Error('A/B test setup failed');
    }
  }

  /**
   * Calculate lead scores for targets
   */
  async calculateLeadScores(targets: Target[]): Promise<LeadScore[]> {
    try {
      const leadScores: LeadScore[] = targets.map(target => {
        const factors = this.calculateScoringFactors(target);
        const overallScore = factors.reduce((sum, factor) => sum + factor.contribution, 0);

        return {
          target_id: target.id,
          overall_score: Math.min(100, Math.max(0, overallScore)),
          demographic_score: factors.find(f => f.factor === 'demographics')?.contribution || 0,
          behavioral_score: factors.find(f => f.factor === 'behavior')?.contribution || 0,
          engagement_score: factors.find(f => f.factor === 'engagement')?.contribution || 0,
          property_score: factors.find(f => f.factor === 'property')?.contribution || 0,
          last_calculated: new Date().toISOString(),
          score_factors: factors
        };
      });

      return leadScores;
    } catch (error) {
      console.error('Failed to calculate lead scores:', error);
      throw new Error('Lead scoring calculation failed');
    }
  }

  /**
   * Launch campaign with optimization
   */
  async launchCampaign(campaignId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Pre-launch optimization
      await this.optimizeCampaignTiming(campaignId);
      await this.optimizeAudience(campaignId);

      // In production, this would actually send the campaign
      console.log(`Launching campaign ${campaignId} with optimizations`);

      return {
        success: true,
        message: 'Campaign launched successfully with optimizations applied'
      };
    } catch (error) {
      console.error('Failed to launch campaign:', error);
      return {
        success: false,
        message: 'Campaign launch failed'
      };
    }
  }

  /**
   * Get campaign performance analytics
   */
  async getCampaignPerformance(campaignId: string): Promise<CampaignPerformance> {
    try {
      // Mock performance data with realistic metrics
      const performance: CampaignPerformance = {
        campaign_id: campaignId,
        metrics: {
          sent: 5000,
          delivered: 4850,
          opened: 1455,
          clicked: 291,
          converted: 73,
          unsubscribed: 12,
          bounced: 150,
          spam_reported: 3
        },
        rates: {
          delivery_rate: 97.0,
          open_rate: 30.0,
          click_rate: 20.0,
          conversion_rate: 25.1,
          unsubscribe_rate: 0.25,
          bounce_rate: 3.0
        },
        revenue: {
          total: 18250.00,
          per_recipient: 3.65,
          roi: 450.2
        },
        geographic_performance: [
          { county: 'Harris', sent: 1500, conversion_rate: 28.3, revenue: 6200.00 },
          { county: 'Dallas', sent: 1200, conversion_rate: 24.7, revenue: 4850.00 },
          { county: 'Tarrant', sent: 800, conversion_rate: 22.1, revenue: 3100.00 }
        ],
        time_series: this.generateTimeSeriesData()
      };

      return performance;
    } catch (error) {
      console.error('Failed to get campaign performance:', error);
      throw new Error('Performance data unavailable');
    }
  }

  /**
   * Create automation rule
   */
  async createAutomationRule(ruleData: Partial<AutomationRule>): Promise<AutomationRule> {
    try {
      const rule: AutomationRule = {
        id: `rule_${Date.now()}`,
        name: ruleData.name || 'Untitled Rule',
        description: ruleData.description || '',
        enabled: ruleData.enabled ?? true,
        trigger: ruleData.trigger || {
          type: 'lead_score_change',
          conditions: { score_threshold: 75 }
        },
        actions: ruleData.actions || [
          {
            type: 'send_campaign',
            config: { campaign_id: 'high_priority_campaign' }
          }
        ],
        created_at: new Date().toISOString(),
        trigger_count: 0
      };

      return rule;
    } catch (error) {
      console.error('Failed to create automation rule:', error);
      throw new Error('Automation rule creation failed');
    }
  }

  /**
   * Get marketing dashboard data
   */
  async getMarketingDashboard(): Promise<MarketingDashboardData> {
    try {
      const dashboard: MarketingDashboardData = {
        overview: {
          active_campaigns: 12,
          total_leads: 8543,
          avg_lead_score: 67.3,
          conversion_rate: 23.8,
          total_revenue: 245673.50,
          roi: 380.2
        },
        recent_campaigns: await this.getRecentCampaigns(),
        top_performing_campaigns: await this.getTopPerformingCampaigns(),
        lead_scoring_distribution: [
          { score_range: '90-100', count: 542, conversion_rate: 78.5 },
          { score_range: '80-89', count: 834, conversion_rate: 65.2 },
          { score_range: '70-79', count: 1245, conversion_rate: 48.7 },
          { score_range: '60-69', count: 1876, conversion_rate: 32.1 },
          { score_range: '50-59', count: 2234, conversion_rate: 18.9 },
          { score_range: '0-49', count: 1812, conversion_rate: 8.3 }
        ],
        automation_stats: {
          active_rules: 8,
          triggers_today: 47,
          actions_executed: 156
        }
      };

      return dashboard;
    } catch (error) {
      console.error('Failed to get marketing dashboard:', error);
      throw new Error('Marketing dashboard data unavailable');
    }
  }

  /**
   * Generate UTM tracking URL
   */
  generateTrackingURL(baseUrl: string, utmParams: UTMParameters): string {
    const url = new URL(baseUrl);
    
    url.searchParams.set('utm_source', utmParams.source);
    url.searchParams.set('utm_medium', utmParams.medium);
    url.searchParams.set('utm_campaign', utmParams.campaign);
    
    if (utmParams.term) url.searchParams.set('utm_term', utmParams.term);
    if (utmParams.content) url.searchParams.set('utm_content', utmParams.content);
    
    // Add custom parameters
    if (utmParams.custom_parameters) {
      Object.entries(utmParams.custom_parameters).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    return url.toString();
  }

  // Private helper methods

  private validateABTestConfig(config: ABTestConfig): void {
    const totalPercentage = config.variants.reduce((sum, variant) => sum + variant.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new Error('A/B test variant percentages must sum to 100%');
    }

    if (config.variants.length < 2) {
      throw new Error('A/B test must have at least 2 variants');
    }
  }

  private async calculateEstimatedReach(filters: CampaignFilters): Promise<number> {
    // Mock calculation based on filters
    let baseReach = 10000;
    
    if (filters.counties?.length) {
      baseReach = baseReach * (filters.counties.length / 254); // Texas has 254 counties
    }
    
    if (filters.lead_scores?.min) {
      baseReach = baseReach * (1 - filters.lead_scores.min / 100);
    }

    return Math.floor(baseReach);
  }

  private calculateScoringFactors(target: Target): Array<{
    factor: string;
    weight: number;
    value: number;
    contribution: number;
  }> {
    const factors = [
      {
        factor: 'demographics',
        weight: 0.25,
        value: this.calculateDemographicScore(target),
        contribution: 0
      },
      {
        factor: 'property',
        weight: 0.35,
        value: this.calculatePropertyScore(target),
        contribution: 0
      },
      {
        factor: 'engagement',
        weight: 0.25,
        value: this.calculateEngagementScore(target),
        contribution: 0
      },
      {
        factor: 'behavior',
        weight: 0.15,
        value: this.calculateBehaviorScore(target),
        contribution: 0
      }
    ];

    // Calculate contributions
    factors.forEach(factor => {
      factor.contribution = factor.weight * factor.value;
    });

    return factors;
  }

  private calculateDemographicScore(target: Target): number {
    // Mock demographic scoring
    let score = 50; // Base score
    
    if (target.mailing_city === 'Houston') score += 15;
    if (target.mailing_state === 'TX') score += 10;
    
    return Math.min(100, score);
  }

  private calculatePropertyScore(target: Target): number {
    // Mock property scoring based on assessed value, equity, etc.
    let score = 40;
    
    if (target.property?.market_value && target.property.market_value > 100000) score += 20;
    if (target.property?.improvement_value && target.property?.land_value) {
      const totalValue = target.property.improvement_value + target.property.land_value;
      if (target.property.market_value && target.property.market_value > totalValue * 1.2) score += 15;
    }
    
    return Math.min(100, score);
  }

  private calculateEngagementScore(target: Target): number {
    // Mock engagement scoring (would be based on email opens, clicks, etc.)
    return Math.floor(Math.random() * 100);
  }

  private calculateBehaviorScore(target: Target): number {
    // Mock behavior scoring (would be based on website visits, downloads, etc.)
    return Math.floor(Math.random() * 100);
  }

  private async optimizeCampaignTiming(campaignId: string): Promise<void> {
    // Mock timing optimization based on historical data
    console.log(`Optimizing send time for campaign ${campaignId}`);
  }

  private async optimizeAudience(campaignId: string): Promise<void> {
    // Mock audience optimization
    console.log(`Optimizing audience for campaign ${campaignId}`);
  }

  private generateDefaultUTM(campaignName: string): UTMParameters {
    return {
      source: this.defaultUTMSource,
      medium: 'email',
      campaign: campaignName.toLowerCase().replace(/\s+/g, '_'),
      content: 'default'
    };
  }

  private async getRecentCampaigns(): Promise<Campaign[]> {
    // Mock recent campaigns
    return [
      {
        id: 'camp_001',
        name: 'Q1 Property Outreach',
        description: 'Quarterly property owner outreach campaign',
        type: 'email',
        status: 'active',
        target_audience: { segments: ['high_value'], filters: {}, estimated_reach: 2500 },
        content: {
          message: 'Unlock the value in your property today!',
          call_to_action: { text: 'Get Started', url: 'https://example.com', tracking_enabled: true },
          personalization_tokens: ['first_name', 'property_address']
        },
        schedule: { type: 'scheduled', timezone: 'America/Chicago', send_at: new Date().toISOString() },
        utm_tracking: this.generateDefaultUTM('q1_property_outreach'),
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'admin'
      }
    ];
  }

  private async getTopPerformingCampaigns(): Promise<Array<{
    campaign: Campaign;
    performance: CampaignPerformance;
  }>> {
    const campaigns = await this.getRecentCampaigns();
    return campaigns.map(campaign => ({
      campaign,
      performance: {
        campaign_id: campaign.id,
        metrics: { sent: 1000, delivered: 950, opened: 380, clicked: 95, converted: 24, unsubscribed: 5, bounced: 50, spam_reported: 1 },
        rates: { delivery_rate: 95.0, open_rate: 40.0, click_rate: 25.0, conversion_rate: 25.3, unsubscribe_rate: 0.5, bounce_rate: 5.0 },
        revenue: { total: 6000.00, per_recipient: 6.00, roi: 400.0 },
        geographic_performance: [],
        time_series: []
      }
    }));
  }

  private generateTimeSeriesData(): Array<{
    timestamp: string;
    opens: number;
    clicks: number;
    conversions: number;
  }> {
    const data = [];
    for (let i = 0; i < 24; i++) {
      const timestamp = new Date(Date.now() - (24 - i) * 3600000).toISOString();
      data.push({
        timestamp,
        opens: Math.floor(Math.random() * 100) + 20,
        clicks: Math.floor(Math.random() * 30) + 5,
        conversions: Math.floor(Math.random() * 10) + 1
      });
    }
    return data;
  }
}

export const marketingAutomationService = new MarketingAutomationService();