// DroneStrike v2 API Client
// Axios-based API client for Django backend integration

import axios, { AxiosInstance } from 'axios';
import {
  UserProfile,
  Company,
  County,
  Property,
  Lead,
  LoginRequest,
  LoginResponse,
  LoanCalculation,
  LoanCalculationResult,
  DashboardStats,
  WorkflowPipeline,
  TokenConsumption,
  TokenConsumptionResult,
  PaginatedResponse,
  Campaign,
  CampaignAnalytics,
  CampaignsResponse,
  CommunicationTemplate,
  TokenBalance,
} from '../types';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

class APIClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Load token from localStorage
    this.accessToken = localStorage.getItem('access_token');
    if (this.accessToken) {
      this.setAuthToken(this.accessToken);
    }

    // Request interceptor for auth
    this.client.interceptors.request.use(
      (config) => {
        console.log('API client: request interceptor called for:', config.url);
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
          console.log('API client: added auth header to request');
        } else {
          console.log('API client: no access token available');
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && this.accessToken) {
          try {
            await this.refreshToken();
            // Retry the original request
            return this.client.request(error.config);
          } catch (refreshError) {
            this.logout();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Authentication Methods
  setAuthToken(token: string): void {
    if (!token) {
      console.error('API client: cannot set undefined/null token');
      return;
    }
    console.log('API client: setting auth token:', token.substring(0, 20) + '...');
    this.accessToken = token;
    localStorage.setItem('access_token', token);
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    console.log('API client: token stored and headers set');
  }

  clearAuthToken(): void {
    this.accessToken = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    delete this.client.defaults.headers.common['Authorization'];
  }

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    console.log('API client: sending login request to Django backend with:', credentials);
    console.log('API client: using base URL:', API_BASE_URL);
    try {
      const response = await this.client.post<{access?: string, refresh?: string, access_token?: string, token_type?: string}>('/api/v1/auth/login/', {
        username: credentials.username,
        password: credentials.password
      });
      console.log('API client: received response:', response.data);
      const access = response.data.access || response.data.access_token;
      const refresh = response.data.refresh || response.data.access_token;
      
      if (!access) {
        throw new Error('No access token received from server');
      }
      
      console.log('API client: setting auth token and waiting for it to be applied');
      this.setAuthToken(access);
      
      // Wait a moment for the token to be applied to the client
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('API client: token set successfully');
      
      return {
        access: access,
        refresh: refresh || access
      };
    } catch (error: any) {
      console.error('API client: login request failed:', error);
      console.error('API client: error response:', error.response);
      console.error('API client: full error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
        baseURL: error.config?.baseURL
      });
      throw error;
    }
  }

  async refreshToken(): Promise<void> {
    // Simple backend doesn't support refresh tokens
    // Just logout user and redirect to login
    throw new Error('Token refresh not supported by simple backend');
  }

  logout(): void {
    this.clearAuthToken();
  }

  async register(userData: {
    username: string;
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    phone?: string;
  }): Promise<any> {
    console.log('API client: sending registration request with:', userData);
    try {
      const response = await this.client.post('/api/v1/auth/register/', {
        username: userData.username,
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        company: userData.company || '',
        phone: userData.phone || ''
      });
      console.log('API client: registration successful:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('API client: registration failed:', error);
      console.error('API client: registration error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url
      });
      throw error;
    }
  }


  // User Profile Methods
  async getCurrentProfile(): Promise<UserProfile> {
    console.log('API client: requesting current profile');
    console.log('API client: current auth token exists:', !!this.accessToken);
    console.log('API client: auth header set:', !!this.client.defaults.headers.common['Authorization']);
    
    const response = await this.client.get<any>('/api/v1/auth/me/');
    // Transform the Django response to match our UserProfile interface
    const userData = response.data;
    return {
      id: userData.id || 1,
      user: {
        id: userData.id || 1,
        username: userData.username,
        email: userData.email,
        first_name: userData.firstName || '',
        last_name: userData.lastName || '',
        is_active: true,
        date_joined: new Date().toISOString()
      },
      company: { 
        id: 1, 
        name: userData.company || 'DroneStrike',
        primary_color: '#3B82F6',
        employee_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      company_name: userData.company || 'DroneStrike',
      role: userData.role || 'admin',
      tokens: userData.tokens || 10000,
      mail_tokens: 100,
      color_scheme: 'dark',
      monthly_subscription_active: false,
      beta_months_remaining: 0,
      onboarding_completed: true,
      voice_commands_enabled: false,
      voice_wake_term: 'dronestrike',
      preferences: {},
      monthly_rate: 0,
      is_premium_user: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  async updateProfile(id: number, data: Partial<UserProfile>): Promise<UserProfile> {
    const response = await this.client.patch<UserProfile>(`/api/profiles/${id}/`, data);
    return response.data;
  }

  async consumeTokens(profileId: number, consumption: TokenConsumption): Promise<TokenConsumptionResult> {
    const response = await this.client.post<TokenConsumptionResult>(
      `/api/profiles/${profileId}/consume_tokens/`,
      consumption
    );
    return response.data;
  }

  // Company Methods
  async getCompanies(): Promise<PaginatedResponse<Company>> {
    const response = await this.client.get<PaginatedResponse<Company>>('/api/companies/');
    return response.data;
  }

  async getCompany(id: number): Promise<Company> {
    const response = await this.client.get<Company>(`/api/companies/${id}/`);
    return response.data;
  }

  // County Methods
  async getCounties(params?: { state?: string; search?: string }): Promise<PaginatedResponse<County>> {
    const response = await this.client.get<PaginatedResponse<County>>('/api/counties/', { params });
    return response.data;
  }

  // Property Methods
  async getProperties(params?: {
    property_type?: string;
    disposition?: string;
    state?: string;
    search?: string;
    page?: number;
    ordering?: string;
  }): Promise<PaginatedResponse<Property>> {
    const response = await this.client.get<PaginatedResponse<Property>>('/api/properties/', { params });
    return response.data;
  }

  async getProperty(id: number): Promise<Property> {
    const response = await this.client.get<Property>(`/api/properties/${id}/`);
    return response.data;
  }

  async createProperty(data: Partial<Property>): Promise<Property> {
    const response = await this.client.post<Property>('/api/properties/', data);
    return response.data;
  }

  async bulkCreateProperties(data: any[]): Promise<{ created_count: number; message: string }> {
    const response = await this.client.post('/api/properties/bulk-create/', { properties: data });
    return response.data;
  }

  async updateProperty(id: number, data: Partial<Property>): Promise<Property> {
    const response = await this.client.patch<Property>(`/api/properties/${id}/`, data);
    return response.data;
  }

  async calculateLoan(propertyId: number, calculation: LoanCalculation): Promise<LoanCalculationResult> {
    const response = await this.client.post<LoanCalculationResult>(
      `/api/properties/${propertyId}/calculate_loan/`,
      calculation
    );
    return response.data;
  }

  async getPropertyScore(propertyId: number): Promise<{ property_id: number; score_data: any; calculated_at: string }> {
    const response = await this.client.get(`/api/properties/${propertyId}/property_score/`);
    return response.data;
  }

  async getInvestmentOpportunities(): Promise<{ count: number; opportunities: any[] }> {
    const response = await this.client.get('/api/properties/investment_opportunities/');
    return response.data;
  }

  // Lead Methods
  async getLeads(params?: {
    lead_status?: string;
    workflow_stage?: string;
    owner_type?: string;
    mailing_state?: string;
    search?: string;
    page?: number;
    ordering?: string;
  }): Promise<PaginatedResponse<Lead>> {
    const response = await this.client.get<PaginatedResponse<Lead>>('/api/leads/', { params });
    return response.data;
  }

  async getLead(id: number): Promise<Lead> {
    const response = await this.client.get<Lead>(`/api/leads/${id}/`);
    return response.data;
  }

  async createLead(data: Partial<Lead>): Promise<Lead> {
    const response = await this.client.post<Lead>('/api/leads/', data);
    return response.data;
  }

  async bulkCreateLeads(data: any[]): Promise<{ created_count: number; message: string }> {
    const response = await this.client.post('/api/leads/bulk-create/', { leads: data });
    return response.data;
  }

  async updateLead(id: number, data: Partial<Lead>): Promise<Lead> {
    const response = await this.client.patch<Lead>(`/api/leads/${id}/`, data);
    return response.data;
  }

  async deleteLead(id: number): Promise<void> {
    await this.client.delete(`/api/leads/${id}/`);
  }

  async advanceLeadWorkflow(leadId: number, currentStage?: string): Promise<{
    success: boolean;
    previous_stage?: string;
    new_stage?: string;
    message?: string;
    error?: string;
  }> {
    const response = await this.client.post(`/api/leads/${leadId}/advance_workflow/`, {
      current_stage: currentStage,
    });
    return response.data;
  }

  async createOpportunityFromLead(leadId: number, requestedAmount: number): Promise<{
    success: boolean;
    opportunity_id?: number;
    lead_id?: number;
    requested_amount?: number;
    max_loan_amount?: number;
    ltv_ratio?: number;
    risk_score?: number;
    message?: string;
    error?: string;
  }> {
    const response = await this.client.post(`/api/leads/${leadId}/create_opportunity/`, {
      requested_amount: requestedAmount,
    });
    return response.data;
  }

  async getLeadDashboardStats(): Promise<DashboardStats> {
    const response = await this.client.get<DashboardStats>('/api/leads/dashboard_stats/');
    return response.data;
  }

  async getWorkflowPipeline(): Promise<WorkflowPipeline> {
    const response = await this.client.get<WorkflowPipeline>('/api/leads/workflow_pipeline/');
    return response.data;
  }

  // Utility Methods
  async uploadFile(file: File, endpoint: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.client.post(endpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  }

  async uploadCSV(file: File, type: 'leads' | 'properties' = 'leads'): Promise<{
    success: boolean;
    message: string;
    created_count: number;
    errors: string[];
  }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    const response = await this.client.post('/api/upload/csv/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  }

  // CSV-based endpoints for development (using real Tarrant County data)
  async getCSVDashboard(): Promise<any> {
    const response = await this.client.get('/api/csv/dashboard/');
    return response.data;
  }

  async getCSVProperties(params?: { limit?: number; search?: string }): Promise<{
    count: number;
    results: any[];
  }> {
    const response = await this.client.get('/api/csv/properties/', { params });
    return response.data;
  }

  async getCSVLeads(params?: { limit?: number; search?: string }): Promise<{
    count: number;
    results: any[];
  }> {
    const response = await this.client.get('/api/csv/leads/', { params });
    return response.data;
  }

  async getCSVOpportunities(): Promise<{
    count: number;
    results: any[];
  }> {
    const response = await this.client.get('/api/csv/opportunities/');
    return response.data;
  }

  async getCSVMissions(): Promise<{
    count: number;
    results: any[];
  }> {
    const response = await this.client.get('/api/csv/missions/');
    return response.data;
  }

  // Enhanced CSV Import Methods
  async analyzeCSVStructure(file: File): Promise<{
    success: boolean;
    analysis: {
      csv_type: string;
      headers: string[];
      sample_data: any[];
      suggested_mappings: Record<string, string>;
      total_columns: number;
    };
    file_info: {
      filename: string;
      size: number;
      rows_analyzed: number;
    };
  }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.client.post('/api/csv/analyze/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async uploadCSVWithMapping(file: File, fieldMapping?: Record<string, string>): Promise<{
    valid: boolean;
    message: string;
    file_info: {
      filename: string;
      size: number;
      temp_path: string;
      total_rows: number;
      headers: string[];
      total_headers: number;
    };
    cost_estimate: {
      estimated_tokens: number;
      can_afford: boolean;
      token_message: string;
      user_balance: number;
    };
  }> {
    const formData = new FormData();
    formData.append('file', file);
    if (fieldMapping) {
      formData.append('field_mapping', JSON.stringify(fieldMapping));
    }

    const response = await this.client.post('/api/csv/upload/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async importCSVData(tempFilePath: string, options?: {
    field_mapping?: Record<string, string>;
    skip_duplicates?: boolean;
    batch_size?: number;
  }): Promise<{
    success: boolean;
    message: string;
    import_stats: {
      total_rows: number;
      successful_rows: number;
      failed_rows: number;
      duplicate_rows: number;
      tokens_used: number;
      success_rate: number;
    };
    batch_id: string;
    recommendations: Array<{
      type: string;
      message: string;
      action: string;
    }>;
  }> {
    const response = await this.client.post('/api/csv/import/', {
      temp_file_path: tempFilePath,
      options: options || {}
    });
    return response.data;
  }

  async getCSVTemplates(): Promise<{
    templates: Record<string, any>;
    supported_formats: string[];
    max_file_size_mb: number;
    encoding: string;
    delimiter: string;
    text_qualifier: string;
  }> {
    const response = await this.client.get('/api/csv/templates/');
    return response.data;
  }

  async validateCSVData(tempFilePath: string, sampleRows: number = 10): Promise<{
    valid: boolean;
    message: string;
    sample_data: any[];
    validation_issues: Array<{
      row_number: number;
      issue: string;
      data: any;
    }>;
    total_rows: number;
    headers_mapped: number;
    headers_unmapped: string[];
  }> {
    const response = await this.client.post('/api/csv/validate/', {
      temp_file_path: tempFilePath,
      sample_rows: sampleRows
    });
    return response.data;
  }

  async getCSVImportHistory(): Promise<{
    import_history: Array<{
      batch_id: string;
      import_source: string;
      lead_count: number;
      imported_at: string;
      sample_leads: any[];
    }>;
    total_imports: number;
    total_leads_imported: number;
  }> {
    const response = await this.client.get('/api/csv/import-history/');
    return response.data;
  }

  async getCSVImportStats(): Promise<{
    lead_statistics: {
      total_leads: number;
      imported_leads: number;
      manual_leads: number;
      total_import_batches: number;
    };
    token_usage: {
      total_tokens_used: number;
      import_transactions: number;
      avg_tokens_per_import: number;
    };
    recent_activity: Array<{
      batch_id: string;
      lead_count: number;
      import_date: string;
    }>;
  }> {
    const response = await this.client.get('/api/csv/import-stats/');
    return response.data;
  }

  // Generic CRUD methods for extensibility
  async get<T>(endpoint: string, params?: any): Promise<T> {
    const response = await this.client.get<T>(endpoint, { params });
    return response.data;
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    const response = await this.client.post<T>(endpoint, data);
    return response.data;
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    const response = await this.client.patch<T>(endpoint, data);
    return response.data;
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    const response = await this.client.put<T>(endpoint, data);
    return response.data;
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await this.client.delete<T>(endpoint);
    return response.data;
  }
}

// Export singleton instance
export const apiClient = new APIClient();

// Export individual service methods for convenience
export const authService = {
  login: (credentials: LoginRequest) => apiClient.login(credentials),
  logout: () => apiClient.logout(),
  getCurrentProfile: () => apiClient.getCurrentProfile(),
  register: (userData: any) => apiClient.register(userData),
};

export const propertyService = {
  getProperties: (params?: any) => apiClient.getProperties(params),
  getProperty: (id: number) => apiClient.getProperty(id),
  createProperty: (data: Partial<Property>) => apiClient.createProperty(data),
  bulkCreateProperties: (data: any[]) => apiClient.bulkCreateProperties(data),
  updateProperty: (id: number, data: Partial<Property>) => apiClient.updateProperty(id, data),
  calculateLoan: (propertyId: number, calculation: LoanCalculation) => 
    apiClient.calculateLoan(propertyId, calculation),
  getPropertyScore: (propertyId: number) => apiClient.getPropertyScore(propertyId),
  getInvestmentOpportunities: () => apiClient.getInvestmentOpportunities(),
};

export const leadService = {
  getLeads: (params?: any) => apiClient.getLeads(params),
  getLead: (id: number) => apiClient.getLead(id),
  createLead: (data: Partial<Lead>) => apiClient.createLead(data),
  bulkCreateLeads: (data: any[]) => apiClient.bulkCreateLeads(data),
  updateLead: (id: number, data: Partial<Lead>) => apiClient.updateLead(id, data),
  deleteLead: (id: number) => apiClient.deleteLead(id),
  advanceWorkflow: (leadId: number, currentStage?: string) => 
    apiClient.advanceLeadWorkflow(leadId, currentStage),
  createOpportunity: (leadId: number, requestedAmount: number) => 
    apiClient.createOpportunityFromLead(leadId, requestedAmount),
  getDashboardStats: () => apiClient.getLeadDashboardStats(),
  getWorkflowPipeline: () => apiClient.getWorkflowPipeline(),
};

export const tokenService = {
  consumeTokens: (profileId: number, consumption: TokenConsumption) => 
    apiClient.consumeTokens(profileId, consumption),
};

export const uploadService = {
  uploadCSV: (file: File, type: 'leads' | 'properties' = 'leads') => 
    apiClient.uploadCSV(file, type),
  uploadFile: (file: File, endpoint: string) => 
    apiClient.uploadFile(file, endpoint),
};

export const csvService = {
  analyzeStructure: (file: File) => apiClient.analyzeCSVStructure(file),
  uploadWithMapping: (file: File, fieldMapping?: Record<string, string>) => 
    apiClient.uploadCSVWithMapping(file, fieldMapping),
  importData: (tempFilePath: string, options?: any) => 
    apiClient.importCSVData(tempFilePath, options),
  getTemplates: () => apiClient.getCSVTemplates(),
  validateData: (tempFilePath: string, sampleRows?: number) => 
    apiClient.validateCSVData(tempFilePath, sampleRows),
  getImportHistory: () => apiClient.getCSVImportHistory(),
  getImportStats: () => apiClient.getCSVImportStats(),
  getDashboard: () => apiClient.getCSVDashboard(),
  getProperties: (params?: any) => apiClient.getCSVProperties(params),
  getLeads: (params?: any) => apiClient.getCSVLeads(params),
};

export const campaignService = {
  getCampaigns: (params?: {
    status?: string;
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<CampaignsResponse> => apiClient.get('/api/campaigns/', params),
  
  getCampaign: (campaignId: number): Promise<Campaign> => 
    apiClient.get(`/api/campaigns/${campaignId}/`),
  
  createCampaign: (campaignData: {
    name: string;
    communication_type: string;
    description?: string;
    template_id?: number;
    targeting_criteria?: Record<string, any>;
    schedule?: Record<string, any>;
  }): Promise<Campaign> => apiClient.post('/api/campaigns/', campaignData),
  
  updateCampaign: (campaignId: number, updates: Partial<Campaign>): Promise<Campaign> => 
    apiClient.patch(`/api/campaigns/${campaignId}/`, updates),
  
  deleteCampaign: (campaignId: number): Promise<void> => 
    apiClient.delete(`/api/campaigns/${campaignId}/`),
  
  launchCampaign: (campaignId: number): Promise<{ success: boolean; message: string }> => 
    apiClient.post(`/api/campaigns/${campaignId}/launch/`, {}),
  
  pauseCampaign: (campaignId: number): Promise<{ success: boolean; message: string }> => 
    apiClient.post(`/api/campaigns/${campaignId}/pause/`, {}),
  
  previewCampaign: (campaignId: number, sampleSize: number = 5): Promise<{ preview: any[] }> => 
    apiClient.post(`/api/campaigns/${campaignId}/preview/`, { sample_size: sampleSize }),
  
  testAudience: (targetingCriteria: Record<string, any>): Promise<{ count: number; sample: any[] }> => 
    apiClient.post('/api/campaigns/test-audience/', { targeting_criteria: targetingCriteria }),
  
  getTemplates: (communicationType?: string): Promise<{ templates: CommunicationTemplate[] }> => 
    apiClient.get('/api/campaigns/templates/', communicationType ? { type: communicationType } : undefined),
  
  getAnalytics: (): Promise<CampaignAnalytics> => apiClient.get('/api/campaigns/analytics/'),
  
  compareCampaigns: (campaignIds: number[]): Promise<{ comparison: any }> => 
    apiClient.post('/api/campaigns/compare/', { campaign_ids: campaignIds }),
  
  getTargetingOptions: (): Promise<{ options: Record<string, any[]> }> => 
    apiClient.get('/api/campaigns/targeting-options/'),
};

// Target API (alias for leadAPI with additional methods)
export const targetAPI = {
  ...leadService,
  getTargets: (params?: string) => {
    // Parse query string to object
    const queryParams = new URLSearchParams(params || '');
    const paramsObj: any = {};
    queryParams.forEach((value, key) => {
      paramsObj[key] = value;
    });
    return apiClient.getLeads(paramsObj);
  },
  getFilterOptions: () => apiClient.get('/api/leads/filter_options/'),
  getStatistics: (params?: string) => apiClient.get(`/api/leads/statistics/${params || ''}`),
};

// Token API services
export const tokenAPI = {
  getPackages: (): Promise<{ packages: any[] }> => apiClient.get('/api/tokens/packages/'),
  getBalance: (): Promise<TokenBalance> => apiClient.get('/api/tokens/balance/'),
  createPurchaseIntent: (packageName: string, customAmount?: number): Promise<{
    client_secret: string;
    checkout_url?: string;
  }> => 
    apiClient.post('/api/tokens/purchase/', { 
      package_name: packageName, 
      custom_amount: customAmount 
    }),
  createSubscriptionIntent: (planName: string, discountCode?: string): Promise<{
    client_secret: string;
    checkout_url?: string;
  }> =>
    apiClient.post('/api/tokens/subscribe/', {
      plan_name: planName,
      discount_code: discountCode
    }),
  getPurchaseHistory: (): Promise<{ transactions: any[] }> => apiClient.get('/api/tokens/history/'),
};

// Enhanced Stripe subscription services
export const subscriptionService = {
  getStatus: () => apiClient.get('/api/subscription/status/'),
  cancel: () => apiClient.post('/api/subscription/cancel/', {}),
  reactivate: (planName?: string) => apiClient.post('/api/subscription/reactivate/', { plan_name: planName }),
  updatePaymentMethod: (paymentMethodId: string) => 
    apiClient.post('/api/subscription/update-payment/', { payment_method_id: paymentMethodId }),
  getBillingPortalUrl: () => apiClient.get('/api/subscription/billing-portal/'),
  
  // Enhanced token and subscription management
  createSubscription: (planName: string, discountCode?: string) =>
    tokenAPI.createSubscriptionIntent(planName, discountCode),
  purchaseTokens: (packageName: string, customAmount?: number) =>
    tokenAPI.createPurchaseIntent(packageName, customAmount),
};

// Common API exports
export const api = apiClient;
export const authAPI = authService;
export const leadAPI = leadService;
export const propertyAPI = propertyService;
export const missionAPI = {};
export const companyAPI = {};
export const userAPI = authService;
export const countryAPI = {};

export default apiClient;