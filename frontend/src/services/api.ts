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
} from '../types';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL || 'http://localhost:8000';

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
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
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
    this.accessToken = token;
    localStorage.setItem('access_token', token);
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearAuthToken(): void {
    this.accessToken = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    delete this.client.defaults.headers.common['Authorization'];
  }

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    console.log('API client: sending login request to FastAPI backend with:', credentials);
    console.log('API client: using base URL:', API_BASE_URL);
    try {
      const response = await this.client.post<{access_token: string, token_type: string}>('/api/v1/auth/login/', {
        username: credentials.username,
        password: credentials.password
      });
      console.log('API client: received response:', response.data);
      const { access_token } = response.data;
      
      this.setAuthToken(access_token);
      console.log('API client: token set successfully');
      
      return {
        access: access_token,
        refresh: access_token // Using same token since simple backend doesn't have refresh tokens
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
  getPackages: () => apiClient.get('/api/tokens/packages/'),
  getBalance: () => apiClient.get('/api/tokens/balance/'),
  createPurchaseIntent: (packageName: string, customAmount?: number) => 
    apiClient.post('/api/tokens/purchase/', { 
      package_name: packageName, 
      custom_amount: customAmount 
    }),
  createSubscriptionIntent: (planName: string, discountCode?: string) =>
    apiClient.post('/api/tokens/subscribe/', {
      plan_name: planName,
      discount_code: discountCode
    }),
  getPurchaseHistory: () => apiClient.get('/api/tokens/history/'),
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