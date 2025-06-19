import { apiClient } from './api';

// TLC BOTG DroneStrike integrated API service
// This service integrates the three main systems: DroneStrike (backend), BOTG (field ops), and TLC (client management)

export interface WorkflowTransition {
  from_stage: string;
  to_stage: string;
  lead_id: number;
  transition_data?: any;
}

export interface MissionCreationData {
  lead_id: number;
  property_id?: number;
  mission_type: 'property_assessment' | 'follow_up_inspection' | 'documentation' | 'client_contact';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  scheduled_date: string;
  estimated_duration: number;
  special_instructions?: string;
  safety_level: 'green' | 'yellow' | 'red';
  assigned_soldier_id?: number;
}

export interface OpportunityCreationData {
  lead_id: number;
  mission_id: number;
  requested_loan_amount: number;
  property_value: number;
  ltv_ratio: number;
  interest_rate: number;
  term_months: number;
  risk_assessment: {
    score: number;
    level: 'Low' | 'Medium' | 'High';
    factors: string[];
  };
}

export interface TLCTransferData {
  opportunity_id: number;
  client_data: {
    personal_info: any;
    financial_info: any;
    property_info: any;
  };
  loan_terms: {
    amount: number;
    interest_rate: number;
    term_months: number;
    monthly_payment: number;
  };
}

export interface CommunicationData {
  recipient_type: 'lead' | 'client' | 'soldier' | 'loan_officer';
  recipient_id: number;
  channel: 'email' | 'sms' | 'phone' | 'mail';
  message_type: 'notification' | 'reminder' | 'update' | 'marketing';
  content: {
    subject?: string;
    message: string;
    template_id?: string;
    variables?: Record<string, any>;
  };
}

class TLCBOTGService {
  // ===========================================
  // WORKFLOW INTEGRATION METHODS
  // ===========================================

  /**
   * Advance a lead through the complete TLC BOTG DroneStrike workflow
   */
  async advanceWorkflow(transition: WorkflowTransition) {
    return apiClient.post('/api/workflow/advance/', transition);
  }

  /**
   * Get the complete workflow pipeline status
   */
  async getWorkflowPipeline() {
    return apiClient.get('/api/workflow/pipeline/');
  }

  /**
   * Get workflow statistics and metrics
   */
  async getWorkflowMetrics(timeframe?: string) {
    return apiClient.get('/api/workflow/metrics/', { params: { timeframe } });
  }

  // ===========================================
  // LEAD TO MISSION WORKFLOW
  // ===========================================

  /**
   * Create BOTG mission from qualified lead
   */
  async createMissionFromLead(missionData: MissionCreationData) {
    return apiClient.post('/api/missions/create-from-lead/', missionData);
  }

  /**
   * Auto-assign missions to available soldiers based on location and workload
   */
  async autoAssignMissions(mission_ids: number[]) {
    return apiClient.post('/api/missions/auto-assign/', { mission_ids });
  }

  /**
   * Update mission status and trigger workflow advancement
   */
  async updateMissionStatus(mission_id: number, status: string, completion_data?: any) {
    return apiClient.patch(`/api/missions/${mission_id}/status/`, { 
      status, 
      completion_data,
      trigger_workflow: true 
    });
  }

  // ===========================================
  // MISSION TO OPPORTUNITY WORKFLOW
  // ===========================================

  /**
   * Create investment opportunity from completed mission
   */
  async createOpportunityFromMission(opportunityData: OpportunityCreationData) {
    return apiClient.post('/api/opportunities/create-from-mission/', opportunityData);
  }

  /**
   * Run automated qualification checks on opportunity
   */
  async qualifyOpportunity(opportunity_id: number) {
    return apiClient.post(`/api/opportunities/${opportunity_id}/qualify/`);
  }

  /**
   * Generate loan proposal documents
   */
  async generateLoanProposal(opportunity_id: number) {
    return apiClient.post(`/api/opportunities/${opportunity_id}/generate-proposal/`);
  }

  // ===========================================
  // OPPORTUNITY TO TLC CLIENT WORKFLOW
  // ===========================================

  /**
   * Transfer approved opportunity to TLC for loan origination
   */
  async transferToTLC(transferData: TLCTransferData) {
    return apiClient.post('/api/tlc/transfer-opportunity/', transferData);
  }

  /**
   * Create TLC client account from opportunity
   */
  async createTLCClient(opportunity_id: number, client_data: any) {
    return apiClient.post('/api/tlc/clients/create-from-opportunity/', {
      opportunity_id,
      client_data
    });
  }

  /**
   * Setup loan servicing and payment processing
   */
  async setupLoanServicing(client_id: number, loan_data: any) {
    return apiClient.post(`/api/tlc/clients/${client_id}/setup-servicing/`, loan_data);
  }

  // ===========================================
  // COMMUNICATION INTEGRATION
  // ===========================================

  /**
   * Send automated communications based on workflow stage
   */
  async sendWorkflowCommunication(communication: CommunicationData) {
    return apiClient.post('/api/communications/send/', communication);
  }

  /**
   * Setup automated communication sequences
   */
  async setupCommunicationSequence(sequence_data: any) {
    return apiClient.post('/api/communications/sequences/', sequence_data);
  }

  /**
   * Get communication history for a contact
   */
  async getCommunicationHistory(contact_type: string, contact_id: number) {
    return apiClient.get(`/api/communications/history/${contact_type}/${contact_id}/`);
  }

  // ===========================================
  // ANALYTICS AND REPORTING
  // ===========================================

  /**
   * Get comprehensive dashboard metrics for all three systems
   */
  async getDashboardMetrics() {
    return apiClient.get('/api/analytics/dashboard/');
  }

  /**
   * Get conversion funnel analytics
   */
  async getConversionFunnel(timeframe?: string) {
    return apiClient.get('/api/analytics/funnel/', { params: { timeframe } });
  }

  /**
   * Get ROI and performance metrics
   */
  async getPerformanceMetrics(timeframe?: string) {
    return apiClient.get('/api/analytics/performance/', { params: { timeframe } });
  }

  /**
   * Generate comprehensive reports
   */
  async generateReport(report_type: string, parameters: any) {
    return apiClient.post('/api/reports/generate/', { report_type, parameters });
  }

  // ===========================================
  // BULK OPERATIONS
  // ===========================================

  /**
   * Process multiple leads through workflow stages
   */
  async bulkAdvanceWorkflow(lead_ids: number[], target_stage: string) {
    return apiClient.post('/api/workflow/bulk-advance/', { lead_ids, target_stage });
  }

  /**
   * Create multiple missions from lead batch
   */
  async bulkCreateMissions(mission_data_list: MissionCreationData[]) {
    return apiClient.post('/api/missions/bulk-create/', { missions: mission_data_list });
  }

  /**
   * Bulk update client payment information
   */
  async bulkUpdatePayments(payment_updates: any[]) {
    return apiClient.post('/api/tlc/clients/bulk-update-payments/', { updates: payment_updates });
  }

  // ===========================================
  // SYSTEM INTEGRATION HELPERS
  // ===========================================

  /**
   * Sync data between DroneStrike, BOTG, and TLC systems
   */
  async syncSystems() {
    return apiClient.post('/api/system/sync/');
  }

  /**
   * Check system health across all three platforms
   */
  async checkSystemHealth() {
    return apiClient.get('/api/system/health/');
  }

  /**
   * Get integration status and any sync issues
   */
  async getIntegrationStatus() {
    return apiClient.get('/api/system/integration-status/');
  }

  // ===========================================
  // MOBILE BOTG INTEGRATION
  // ===========================================

  /**
   * Get missions for mobile BOTG app
   */
  async getMobileMissions(soldier_id: number) {
    return apiClient.get(`/api/mobile/soldiers/${soldier_id}/missions/`);
  }

  /**
   * Upload mission photos and data from mobile
   */
  async uploadMissionData(mission_id: number, form_data: FormData) {
    return apiClient.post(`/api/mobile/missions/${mission_id}/upload/`, form_data);
  }

  /**
   * Update soldier location and status
   */
  async updateSoldierStatus(soldier_id: number, status_data: any) {
    return apiClient.patch(`/api/mobile/soldiers/${soldier_id}/status/`, status_data);
  }

  // ===========================================
  // FINANCIAL INTEGRATION
  // ===========================================

  /**
   * Calculate loan terms and payments
   */
  async calculateLoanTerms(calculation_data: any) {
    return apiClient.post('/api/financial/calculate-loan-terms/', calculation_data);
  }

  /**
   * Process client payment
   */
  async processPayment(client_id: number, payment_data: any) {
    return apiClient.post(`/api/tlc/clients/${client_id}/process-payment/`, payment_data);
  }

  /**
   * Generate payment schedules
   */
  async generatePaymentSchedule(loan_data: any) {
    return apiClient.post('/api/financial/generate-schedule/', loan_data);
  }

  /**
   * Check payment status and send reminders
   */
  async checkPaymentStatus(client_id: number) {
    return apiClient.get(`/api/tlc/clients/${client_id}/payment-status/`);
  }

  // ===========================================
  // COMPLIANCE AND AUDIT
  // ===========================================

  /**
   * Get audit trail for any entity
   */
  async getAuditTrail(entity_type: string, entity_id: number) {
    return apiClient.get(`/api/audit/trail/${entity_type}/${entity_id}/`);
  }

  /**
   * Generate compliance reports
   */
  async generateComplianceReport(report_type: string, date_range: any) {
    return apiClient.post('/api/compliance/reports/', { report_type, date_range });
  }

  /**
   * Check regulatory compliance status
   */
  async checkCompliance() {
    return apiClient.get('/api/compliance/status/');
  }
}

// Export singleton instance
export const tlcBotgService = new TLCBOTGService();

// Export specific workflow helper functions
export const workflowHelpers = {
  /**
   * Get the next stage in the TLC BOTG DroneStrike workflow
   */
  getNextStage: (currentStage: string): string | null => {
    const workflow: Record<string, string> = {
      'lead_identified': 'botg_assigned',
      'botg_assigned': 'botg_in_progress', 
      'botg_in_progress': 'botg_completed',
      'botg_completed': 'opportunity_created',
      'opportunity_created': 'tlc_loan_originated',
      'tlc_loan_originated': 'tlc_client_onboarded',
      'tlc_client_onboarded': 'loan_servicing'
    };
    return workflow[currentStage] || null;
  },

  /**
   * Check if a stage transition is valid
   */
  isValidTransition: (from: string, to: string): boolean => {
    const nextStage = workflowHelpers.getNextStage(from);
    return nextStage === to;
  },

  /**
   * Get all possible stages in the workflow
   */
  getAllStages: (): string[] => {
    return [
      'lead_identified',
      'botg_assigned', 
      'botg_in_progress',
      'botg_completed',
      'opportunity_created',
      'tlc_loan_originated',
      'tlc_client_onboarded',
      'loan_servicing'
    ];
  },

  /**
   * Get stage display name
   */
  getStageDisplayName: (stage: string): string => {
    const names: Record<string, string> = {
      'lead_identified': 'Lead Identified',
      'botg_assigned': 'BOTG Assigned',
      'botg_in_progress': 'BOTG In Progress', 
      'botg_completed': 'BOTG Completed',
      'opportunity_created': 'Opportunity Created',
      'tlc_loan_originated': 'TLC Loan Originated',
      'tlc_client_onboarded': 'Client Onboarded',
      'loan_servicing': 'Loan Servicing'
    };
    return names[stage] || stage;
  }
};

export default tlcBotgService;