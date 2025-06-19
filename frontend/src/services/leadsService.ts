import { apiClient } from './api';

export interface Lead {
  id: number;
  owner_id: number;
  property_id?: number;
  first_name: string;
  last_name: string;
  full_name: string;
  owner_type?: string;
  email?: string;
  phone_cell?: string;
  primary_phone?: string;
  mailing_address_1: string;
  mailing_city: string;
  mailing_state: string;
  mailing_zip5: string;
  full_mailing_address: string;
  lead_status: string;
  workflow_stage: string;
  score_value: number;
  is_qualified: boolean;
  can_contact: boolean;
  last_contact?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface LeadCreate {
  property_id?: number;
  first_name: string;
  last_name: string;
  owner_type?: string;
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
  has_mortgage?: boolean;
  monthly_income?: number;
  notes?: string;
  source_batch?: string;
}

export interface LeadUpdate {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_cell?: string;
  phone_other?: string;
  lead_status?: string;
  notes?: string;
  monthly_income?: number;
  has_mortgage?: boolean;
}

export interface LeadFilters {
  page?: number;
  size?: number;
  status?: string;
  workflow_stage?: string;
  min_score?: number;
  city?: string;
  state?: string;
  search?: string;
}

export interface LeadListResponse {
  leads: Lead[];
  total: number;
  page: number;
  size: number;
}

export const LeadStatus = {
  TARGET_ACQUIRED: 'target_acquired',
  INITIAL_CONTACT: 'initial_contact',
  INTERESTED: 'interested',
  NOT_INTERESTED: 'not_interested',
  DO_NOT_CONTACT: 'do_not_contact',
  QUALIFIED: 'qualified',
  NEGOTIATION: 'negotiation',
  CLOSED_WON: 'closed_won',
  CLOSED_LOST: 'closed_lost'
} as const;

export const WorkflowStage = {
  PROSPECTING: 'prospecting',
  CONTACTED: 'contacted',
  QUALIFIED: 'qualified',
  PROPOSAL: 'proposal',
  NEGOTIATION: 'negotiation',
  CLOSED: 'closed'
} as const;

class LeadsService {
  async getLeads(filters?: LeadFilters): Promise<LeadListResponse> {
    const params = new URLSearchParams();
    
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.size) params.append('size', filters.size.toString());
    if (filters?.status) params.append('status', filters.status);
    if (filters?.workflow_stage) params.append('workflow_stage', filters.workflow_stage);
    if (filters?.min_score) params.append('min_score', filters.min_score.toString());
    if (filters?.city) params.append('city', filters.city);
    if (filters?.state) params.append('state', filters.state);
    if (filters?.search) params.append('search', filters.search);
    
    const response = await apiClient.get<LeadListResponse>(`/api/v1/leads/?${params.toString()}`);
    return response;
  }

  async getLead(id: number): Promise<Lead> {
    const response = await apiClient.get<Lead>(`/api/v1/leads/${id}`);
    return response;
  }

  async createLead(lead: LeadCreate): Promise<Lead> {
    const response = await apiClient.post<Lead>('/api/v1/leads/', lead);
    return response;
  }

  async updateLead(id: number, updates: LeadUpdate): Promise<Lead> {
    const response = await apiClient.put<Lead>(`/api/v1/leads/${id}`, updates);
    return response;
  }

  async deleteLead(id: number): Promise<void> {
    await apiClient.delete(`/api/v1/leads/${id}`);
  }

  async updateLeadScore(id: number, score: number): Promise<any> {
    const response = await apiClient.post<any>(`/api/v1/leads/${id}/score`, { score });
    return response;
  }

  async advanceWorkflowStage(id: number, stage: string): Promise<any> {
    const response = await apiClient.post<any>(`/api/v1/leads/${id}/workflow`, { stage });
    return response;
  }

  // Helper methods
  getStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      [LeadStatus.TARGET_ACQUIRED]: 'bg-blue-500',
      [LeadStatus.INITIAL_CONTACT]: 'bg-purple-500',
      [LeadStatus.INTERESTED]: 'bg-green-500',
      [LeadStatus.NOT_INTERESTED]: 'bg-red-500',
      [LeadStatus.DO_NOT_CONTACT]: 'bg-gray-500',
      [LeadStatus.QUALIFIED]: 'bg-teal-500',
      [LeadStatus.NEGOTIATION]: 'bg-orange-500',
      [LeadStatus.CLOSED_WON]: 'bg-emerald-500',
      [LeadStatus.CLOSED_LOST]: 'bg-red-600'
    };
    return colors[status] || 'bg-gray-500';
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      [LeadStatus.TARGET_ACQUIRED]: 'Target Acquired',
      [LeadStatus.INITIAL_CONTACT]: 'Initial Contact',
      [LeadStatus.INTERESTED]: 'Interested',
      [LeadStatus.NOT_INTERESTED]: 'Not Interested',
      [LeadStatus.DO_NOT_CONTACT]: 'Do Not Contact',
      [LeadStatus.QUALIFIED]: 'Qualified',
      [LeadStatus.NEGOTIATION]: 'Negotiation',
      [LeadStatus.CLOSED_WON]: 'Closed Won',
      [LeadStatus.CLOSED_LOST]: 'Closed Lost'
    };
    return labels[status] || status;
  }

  getScoreColor(score: number): string {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  }
}

export const leadsService = new LeadsService();