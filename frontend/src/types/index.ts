// DroneStrike v2 Frontend Types
// TypeScript interfaces matching Django backend models

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  date_joined: string;
}

export interface Company {
  id: number;
  name: string;
  logo?: string;
  primary_color: string;
  website?: string;
  employee_count: number;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: number;
  user: User;
  company?: Company;
  company_name?: string;
  logo_url?: string;
  color_scheme: string;
  role: 'user' | 'admin' | 'manager' | 'agent' | 'soldier' | 'officer' | 'five_star_general' | 'beta_infantry';
  tokens: number;
  mail_tokens: number;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_plan?: string;
  monthly_subscription_active: boolean;
  subscription_start_date?: string;
  beta_months_remaining: number;
  onboarding_completed: boolean;
  last_activity?: string;
  voice_commands_enabled: boolean;
  voice_wake_term: string;
  preferences: Record<string, any>;
  monthly_rate: number;
  is_premium_user: boolean;
  created_at: string;
  updated_at: string;
}

export interface County {
  id: number;
  name: string;
  state: string;
  fips_code: string;
  tax_sale_date?: string;
  redemption_period_months: number;
  interest_rate: string;
  property_count: number;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: number;
  county: County;
  county_id: number;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip_code: string;
  original_address1: string;
  original_city: string;
  original_state: string;
  original_zip: string;
  address1_corrected: boolean;
  latitude?: string;
  longitude?: string;
  place_id?: string;
  improvement_value: string;
  land_value: string;
  total_value: string;
  market_value?: string;
  property_type: 'single_family' | 'multi_family' | 'condo' | 'townhouse' | 'commercial' | 'land' | 'mobile_home';
  disposition: 'active' | 'sold' | 'foreclosure' | 'pending' | 'withdrawn';
  square_feet?: number;
  bedrooms?: number;
  bathrooms?: string;
  year_built?: number;
  lot_size?: string;
  account_number: string;
  tax_url?: string;
  cad_url?: string;
  ple_property_id?: number;
  ple_amount_due?: string;
  ple_amount_tax?: string;
  ple_lawsuit_no?: string;
  ple_date?: string;
  ple_rate?: string;
  ple_apr?: string;
  existing_tax_loan: boolean;
  existing_tax_loan_amount?: string;
  existing_tax_loan_lender?: string;
  in_foreclosure: boolean;
  last_known_lawsuit_date?: string;
  last_known_lawsuit_no?: string;
  last_payment?: string;
  last_payment_date?: string;
  last_payer?: string;
  term?: number;
  description?: string;
  street?: string;
  exemptions?: string;
  notes?: string;
  is_active: boolean;
  full_address: string;
  property_score: PropertyScore;
  max_loan_amount: number;
  ltv_45_percent: number;
  created_at: string;
  updated_at: string;
}

export interface PropertyScore {
  score: number;
  grade: string;
  score_factors: Array<[string, number]>;
  market_value: number;
  investment_potential: string;
}

export interface Lead {
  id: number;
  owner: User;
  property?: Property;
  property_id?: number;
  first_name: string;
  last_name: string;
  owner_type?: 'absentee' | 'out_of_state' | 'local' | 'investor' | 'estate' | 'entity' | 'individual';
  email?: string;
  phone_cell?: string;
  phone_other?: string;
  birth_date?: string;
  mailing_address_1: string;
  mailing_address_2?: string;
  mailing_street?: string;
  mailing_city: string;
  mailing_state: string;
  mailing_zip5: string;
  mailing_zip4?: string;
  mailing_place_id?: string;
  mailing_address_1_corrected: boolean;
  is_bad_address: boolean;
  geocoding?: Record<string, any>;
  do_not_email: boolean;
  do_not_email_added: boolean;
  do_not_mail: boolean;
  email_added?: string;
  email_added_date?: string;
  returned_postcard: boolean;
  returned_postcard_date?: string;
  returned_postcard_reason?: string;
  is_business: boolean;
  is_dangerous: boolean;
  safety_concerns_notes?: string;
  safety_concern_types: string[];
  en: boolean;
  es: boolean;
  has_mortgage: boolean;
  monthly_income?: string;
  lead_status: 'target_acquired' | 'initial_contact' | 'interested' | 'not_interested' | 'do_not_contact' | 'qualified' | 'negotiation' | 'closed_won' | 'closed_lost';
  last_contact?: string;
  notes?: string;
  latitude?: string;
  longitude?: string;
  score_value: number;
  scored_at?: string;
  workflow_stage: 'lead_identified' | 'botg_assigned' | 'botg_in_progress' | 'botg_completed' | 'opportunity_created' | 'tlc_loan_originated' | 'tlc_client_onboarded' | 'loan_servicing';
  botg_mission_id?: string;
  tlc_loan_id?: string;
  tlc_borrower_id?: string;
  sent_to_botg: boolean;
  botg_response_received: boolean;
  sent_to_tlc: boolean;
  tlc_loan_created: boolean;
  source_batch?: string;
  imported_from?: string;
  full_name: string;
  formatted_zip: string;
  full_mailing_address: string;
  workflow_status: WorkflowStatus;
  created_at: string;
  updated_at: string;
  botg_assigned_at?: string;
  botg_completed_at?: string;
  tlc_sent_at?: string;
}

export type WorkflowStatus = 'new' | 'contacted' | 'qualified' | 'opportunity' | 'closed';

export interface Opportunity {
  id: number;
  lead: Lead;
  property: Property;
  user: User;
  status: 'identified' | 'analyzing' | 'qualified' | 'proposal_sent' | 'negotiation' | 'approved' | 'funded' | 'closed' | 'rejected';
  title: string;
  description?: string;
  requested_loan_amount: string;
  max_loan_amount: string;
  ltv_ratio: string;
  interest_rate: string;
  term_months: number;
  monthly_payment?: string;
  total_interest?: string;
  total_payments?: string;
  risk_score: number;
  risk_factors: string[];
  property_inspection_completed: boolean;
  title_search_completed: boolean;
  financial_verification_completed: boolean;
  projected_funding_date?: string;
  tlc_opportunity_id?: string;
  sent_to_tlc: boolean;
  tlc_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface TokenTransaction {
  id: number;
  user: User;
  token_type: 'regular' | 'mail';
  transaction_type: 'purchase' | 'consumption' | 'refund' | 'bonus' | 'subscription';
  action_type?: 'postcard_send' | 'email_send' | 'sms_send' | 'phone_verification' | 'address_verification' | 'property_lookup' | 'lead_export' | 'api_call' | 'other';
  tokens_before: number;
  tokens_changed: number;
  tokens_after: number;
  cost_per_token?: string;
  total_cost?: string;
  description: string;
  reference_id?: string;
  lead?: Lead;
  stripe_payment_intent_id?: string;
  created_at: string;
}

// Campaign System Types
export interface Campaign {
  id: number;
  name: string;
  communication_type: 'email' | 'sms' | 'postcard' | 'letter' | 'phone';
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';
  description?: string;
  template_id?: number;
  targeting_criteria?: Record<string, any>;
  schedule?: Record<string, any>;
  total_sent: number;
  total_failed: number;
  total_responses: number;
  response_rate: number;
  tokens_consumed: number;
  total_cost: number;
  created_at: string;
  updated_at: string;
  user: User;
}

export interface CampaignAnalytics {
  overview: {
    summary: {
      total_campaigns: number;
      active_campaigns: number;
      completed_campaigns: number;
      draft_campaigns: number;
      scheduled_campaigns: number;
    };
    performance: {
      total_sent: number;
      total_responses: number;
      average_response_rate: number;
      total_cost: number;
      average_cost_per_lead: number;
    };
  };
  aggregate_metrics: {
    total_sent: number;
    total_responses: number;
    total_cost: number;
    average_response_rate: number;
    cost_per_response: number;
    tokens_consumed: number;
  };
  communication_breakdown: {
    email: {
      campaigns: number;
      sent: number;
      responses: number;
      cost: number;
    };
    sms: {
      campaigns: number;
      sent: number;
      responses: number;
      cost: number;
    };
    postcard: {
      campaigns: number;
      sent: number;
      responses: number;
      cost: number;
    };
  };
  recent_activity: Array<{
    campaign_id: number;
    campaign_name: string;
    action: string;
    timestamp: string;
  }>;
}

export interface CampaignsResponse {
  campaigns: Campaign[];
  total_count: number;
  page: number;
  per_page: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface CommunicationTemplate {
  id: number;
  name: string;
  communication_type: 'email' | 'sms' | 'postcard' | 'letter';
  subject?: string;
  content: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Token API Response Types
export interface TokenBalance {
  regular_tokens: number;
  mail_tokens: number;
  last_updated: string;
}

// API Response Types
export interface APIResponse<T> {
  data: T;
  status: number;
  message?: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next?: string;
  previous?: string;
  results: T[];
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
}

export interface LoanCalculation {
  property_id: number;
  loan_amount: number;
  interest_rate?: number;
  term_months?: number;
}

export interface LoanCalculationResult {
  property_id: number;
  loan_amount: number;
  monthly_payment: number;
  ltv_ratio: number;
  max_loan_amount: number;
  total_payments: number;
  total_interest: number;
  interest_percentage: number;
  risk_assessment: RiskAssessment;
  payment_schedule: PaymentScheduleItem[];
  full_schedule_available: boolean;
}

export interface PaymentScheduleItem {
  payment_number: number;
  payment_date: string;
  payment_amount: number;
  principal: number;
  interest: number;
  balance: number;
  cumulative_interest: number;
}

export interface RiskAssessment {
  risk_score: number;
  risk_level: 'Low' | 'Medium' | 'High';
  risk_factors: string[];
  ltv_ratio: number;
  recommended_approval: boolean;
}

export interface DashboardStats {
  total_leads: number;
  by_status: Array<{ lead_status: string; count: number }>;
  by_workflow_stage: Array<{ workflow_stage: string; count: number }>;
  by_state: Array<{ mailing_state: string; count: number }>;
  average_score: number;
  high_score_leads: number;
  recent_leads: number;
}

export interface WorkflowPipeline {
  pipeline: Array<{
    stage: string;
    count: number;
    leads: Lead[];
  }>;
  total_in_pipeline: number;
}

export interface TokenConsumption {
  action_type: string;
  quantity?: number;
  reference_id?: string;
}

export interface TokenConsumptionResult {
  success: boolean;
  tokens_consumed?: number;
  tokens_remaining?: number;
  token_type?: string;
  error?: string;
  tokens_needed?: number;
  tokens_available?: number;
}