import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export interface Target {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  property_type: string;
  estimated_value: number;
  tax_delinquent: boolean;
  delinquent_amount: number;
  owner_occupied: boolean;
  last_contact: string | null;
  contact_attempts: number;
  status: 'New' | 'Contacted' | 'Interested' | 'Not Interested' | 'Closed' | 'Follow Up';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  lead_score: number;
  notes: string;
  tags: string[];
  assigned_to: string;
  created_at: string;
  updated_at: string;
}

export interface TargetFilters {
  search?: string;
  status?: string;
  priority?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface TargetStats {
  total_targets: number;
  high_priority: number;
  tax_delinquent: number;
  interested: number;
  avg_lead_score: number;
}

export interface TargetsResponse {
  count: number;
  results: Target[];
  stats: TargetStats;
}

export interface TargetHistory {
  id: number;
  type: 'email' | 'call' | 'meeting' | 'sms' | 'note';
  action: string;
  details: string;
  created_by: string;
  created_at: string;
  status: string;
}

class TargetsService {
  private getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    return {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
    };
  }

  async getTargets(filters: TargetFilters = {}): Promise<TargetsResponse> {
    try {
      const params = new URLSearchParams();
      
      if (filters.search) params.append('search', filters.search);
      if (filters.status && filters.status !== 'All') params.append('status', filters.status);
      if (filters.priority && filters.priority !== 'All') params.append('priority', filters.priority);
      if (filters.sortBy) params.append('sort_by', filters.sortBy);
      if (filters.sortDirection) params.append('sort_direction', filters.sortDirection);

      const response = await axios.get(
        `${API_BASE_URL}/api/targets/?${params.toString()}`,
        this.getAuthHeaders()
      );
      
      return response.data;
    } catch (error) {
      console.error('Error fetching targets:', error);
      throw error;
    }
  }

  async getTarget(id: number): Promise<Target> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/targets/${id}/`,
        this.getAuthHeaders()
      );
      
      return response.data;
    } catch (error) {
      console.error('Error fetching target:', error);
      throw error;
    }
  }

  async createTarget(targetData: Partial<Target>): Promise<Target> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/targets/`,
        targetData,
        this.getAuthHeaders()
      );
      
      return response.data;
    } catch (error) {
      console.error('Error creating target:', error);
      throw error;
    }
  }

  async updateTarget(id: number, targetData: Partial<Target>): Promise<Target> {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/api/targets/${id}/`,
        targetData,
        this.getAuthHeaders()
      );
      
      return response.data;
    } catch (error) {
      console.error('Error updating target:', error);
      throw error;
    }
  }

  async deleteTarget(id: number): Promise<void> {
    try {
      await axios.delete(
        `${API_BASE_URL}/api/targets/${id}/`,
        this.getAuthHeaders()
      );
    } catch (error) {
      console.error('Error deleting target:', error);
      throw error;
    }
  }

  async performTargetActions(action: string, targetIds: number[], data?: any): Promise<any> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/targets/actions/`,
        {
          action,
          target_ids: targetIds,
          ...data
        },
        this.getAuthHeaders()
      );
      
      return response.data;
    } catch (error) {
      console.error('Error performing target actions:', error);
      throw error;
    }
  }

  async getTargetHistory(id: number): Promise<TargetHistory[]> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/targets/${id}/history/`,
        this.getAuthHeaders()
      );
      
      return response.data.history;
    } catch (error) {
      console.error('Error fetching target history:', error);
      throw error;
    }
  }

  // Quick action methods (like old DroneStrike system)
  async sendEmail(targetIds: number[], emailData: any): Promise<any> {
    return this.performTargetActions('send_email', targetIds, { email_data: emailData });
  }

  async makeCall(targetIds: number[], callData: any): Promise<any> {
    return this.performTargetActions('make_call', targetIds, { call_data: callData });
  }

  async updateStatus(targetIds: number[], status: string): Promise<any> {
    return this.performTargetActions('update_status', targetIds, { status });
  }

  async assignAgent(targetIds: number[], agentId: string): Promise<any> {
    return this.performTargetActions('assign_agent', targetIds, { agent_id: agentId });
  }

  async addTags(targetIds: number[], tags: string[]): Promise<any> {
    return this.performTargetActions('add_tags', targetIds, { tags });
  }

  async exportData(targetIds: number[], format: 'csv' | 'excel' = 'csv'): Promise<any> {
    return this.performTargetActions('export_data', targetIds, { format });
  }

  async scheduleFollowup(targetIds: number[], followupDate: string, notes?: string): Promise<any> {
    return this.performTargetActions('schedule_followup', targetIds, { 
      followup_date: followupDate,
      notes 
    });
  }

  async sendSMS(targetIds: number[], message: string): Promise<any> {
    return this.performTargetActions('send_sms', targetIds, { message });
  }

  async createContract(targetIds: number[], contractData: any): Promise<any> {
    return this.performTargetActions('create_contract', targetIds, { contract_data: contractData });
  }

  async markInterested(targetIds: number[]): Promise<any> {
    return this.performTargetActions('mark_interested', targetIds);
  }

  async markNotInterested(targetIds: number[]): Promise<any> {
    return this.performTargetActions('mark_not_interested', targetIds);
  }

  async moveToClosed(targetIds: number[], reason?: string): Promise<any> {
    return this.performTargetActions('move_to_closed', targetIds, { reason });
  }
}

export const targetsService = new TargetsService();
export default targetsService;