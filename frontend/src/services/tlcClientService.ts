// TLC Client Management Service
// Python-backend ready service for managing TLC clients, CSV imports, and loan processing
// Translates and improves Laravel TLC functionality

export interface TLCClient {
  id: string;
  client_number: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone_primary?: string;
  phone_secondary?: string;
  ssn_last_four?: string;
  date_of_birth?: string;
  
  // Address Information
  mailing_address: {
    street_1: string;
    street_2?: string;
    city: string;
    state: string;
    zip_code: string;
    county: string;
  };
  
  // Property Information
  property_address: {
    street_1: string;
    street_2?: string;
    city: string;
    state: string;
    zip_code: string;
    county: string;
  };
  
  // Tax Information
  tax_info: {
    account_number: string;
    tax_year: number;
    original_tax_amount: number;
    penalties_interest: number;
    total_amount_due: number;
    tax_sale_date?: string;
    lawsuit_status?: string;
    attorney_fees?: number;
  };
  
  // Property Valuation
  property_valuation: {
    assessed_land_value: number;
    assessed_improvement_value: number;
    assessed_total_value: number;
    market_land_value: number;
    market_improvement_value: number;
    market_total_value: number;
    estimated_purchase_price?: number;
  };
  
  // Loan Information
  loan_info?: {
    loan_amount: number;
    interest_rate: number;
    apr: number;
    term_months: number;
    monthly_payment: number;
    total_payment: number;
    loan_to_value_ratio: number;
    status: 'pending' | 'approved' | 'funded' | 'declined' | 'paid_off';
    application_date: string;
    funding_date?: string;
    payoff_date?: string;
  };
  
  // Client Status & Workflow
  status: 'prospect' | 'lead' | 'applicant' | 'client' | 'inactive';
  workflow_stage: string;
  lead_source: string;
  assigned_agent?: string;
  notes: Array<{
    id: string;
    content: string;
    created_by: string;
    created_at: string;
    type: 'general' | 'call' | 'email' | 'meeting' | 'document';
  }>;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  last_contact?: string;
  last_activity?: string;
}

export interface CSVImportJob {
  id: string;
  filename: string;
  file_size: number;
  total_rows: number;
  processed_rows: number;
  successful_rows: number;
  failed_rows: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress_percentage: number;
  started_at?: string;
  completed_at?: string;
  errors: Array<{
    row_number: number;
    column: string;
    error_message: string;
    raw_data: string;
  }>;
  validation_summary: {
    duplicate_clients: number;
    invalid_emails: number;
    missing_required_fields: number;
    invalid_tax_amounts: number;
    invalid_dates: number;
  };
}

export interface CSVFieldMapping {
  csv_column: string;
  database_field: string;
  is_required: boolean;
  data_type: 'string' | 'number' | 'date' | 'email' | 'phone' | 'currency';
  validation_rules?: string[];
  default_value?: any;
  transform_function?: string;
}

export interface TLCClientFilters {
  status?: string[];
  workflow_stage?: string[];
  counties?: string[];
  tax_year?: number[];
  loan_status?: string[];
  date_range?: {
    start: string;
    end: string;
    field: 'created_at' | 'last_contact' | 'tax_sale_date';
  };
  amount_range?: {
    min: number;
    max: number;
    field: 'tax_amount' | 'loan_amount' | 'property_value';
  };
  search_term?: string;
  assigned_agent?: string;
  lead_source?: string;
}

export interface TLCDashboardStats {
  total_clients: number;
  active_loans: number;
  total_loan_amount: number;
  pending_applications: number;
  clients_by_status: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  loans_by_county: Array<{
    county: string;
    count: number;
    total_amount: number;
    avg_amount: number;
  }>;
  monthly_trends: Array<{
    month: string;
    new_clients: number;
    loans_funded: number;
    total_funded_amount: number;
  }>;
  performance_metrics: {
    avg_processing_time_days: number;
    approval_rate: number;
    default_rate: number;
    avg_loan_amount: number;
    avg_ltv_ratio: number;
  };
}

class TLCClientService {
  private apiBaseUrl = process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

  // Get auth headers for API requests
  private getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    };
  }

  /**
   * Upload and process CSV file
   * Connects to Django backend TLC CSV upload endpoint
   */
  async uploadCSV(file: File, fieldMappings?: CSVFieldMapping[]): Promise<CSVImportJob> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      if (fieldMappings) {
        formData.append('field_mappings', JSON.stringify(fieldMappings));
      }

      // Upload to Django backend
      const response = await fetch(`${this.apiBaseUrl}/api/tlc/upload/csv/`, {
        method: 'POST',
        headers: {
          'Authorization': localStorage.getItem('access_token') ? `Bearer ${localStorage.getItem('access_token')}` : '',
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const importJob: CSVImportJob = await response.json();
      return importJob;
      
    } catch (error) {
      console.error('CSV upload failed:', error);
      throw new Error('Failed to upload CSV file');
    }
  }

  /**
   * Get CSV import job status
   */
  async getImportJobStatus(jobId: string): Promise<CSVImportJob> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/tlc/import-jobs/${jobId}/`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to fetch import job status');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get import job status:', error);
      throw new Error('Import job status unavailable');
    }
  }

  /**
   * Transform Django client data to frontend format
   */
  private transformDjangoClient(djangoClient: any): TLCClient {
    // Get property address
    const propertyAddress = djangoClient.addresses?.find((addr: any) => addr.address_type === 'property');
    const mailingAddress = djangoClient.addresses?.find((addr: any) => addr.address_type === 'mailing');

    return {
      id: djangoClient.id,
      client_number: djangoClient.client_number,
      first_name: djangoClient.first_name,
      last_name: djangoClient.last_name,
      email: djangoClient.email,
      phone_primary: djangoClient.phone_primary,
      phone_secondary: djangoClient.phone_secondary,
      ssn_last_four: djangoClient.ssn_last_four,
      date_of_birth: djangoClient.date_of_birth,
      
      // Address Information
      mailing_address: mailingAddress ? {
        street_1: mailingAddress.street_1,
        street_2: mailingAddress.street_2,
        city: mailingAddress.city,
        state: mailingAddress.state,
        zip_code: mailingAddress.zip_code,
        county: mailingAddress.county,
      } : {
        street_1: '', city: '', state: 'TX', zip_code: '', county: ''
      },
      
      // Property Information
      property_address: propertyAddress ? {
        street_1: propertyAddress.street_1,
        street_2: propertyAddress.street_2,
        city: propertyAddress.city,
        state: propertyAddress.state,
        zip_code: propertyAddress.zip_code,
        county: propertyAddress.county,
      } : {
        street_1: '', city: '', state: 'TX', zip_code: '', county: ''
      },
      
      // Tax Information
      tax_info: djangoClient.tax_info ? {
        account_number: djangoClient.tax_info.account_number,
        tax_year: djangoClient.tax_info.tax_year,
        original_tax_amount: parseFloat(djangoClient.tax_info.original_tax_amount),
        penalties_interest: parseFloat(djangoClient.tax_info.penalties_interest),
        total_amount_due: parseFloat(djangoClient.tax_info.total_amount_due),
        tax_sale_date: djangoClient.tax_info.tax_sale_date,
        lawsuit_status: djangoClient.tax_info.lawsuit_status,
        attorney_fees: parseFloat(djangoClient.tax_info.attorney_fees || '0'),
      } : {
        account_number: '', tax_year: new Date().getFullYear(), 
        original_tax_amount: 0, penalties_interest: 0, total_amount_due: 0
      },
      
      // Property Valuation
      property_valuation: djangoClient.property_valuation ? {
        assessed_land_value: parseFloat(djangoClient.property_valuation.assessed_land_value),
        assessed_improvement_value: parseFloat(djangoClient.property_valuation.assessed_improvement_value),
        assessed_total_value: parseFloat(djangoClient.property_valuation.assessed_total_value),
        market_land_value: parseFloat(djangoClient.property_valuation.market_land_value),
        market_improvement_value: parseFloat(djangoClient.property_valuation.market_improvement_value),
        market_total_value: parseFloat(djangoClient.property_valuation.market_total_value),
        estimated_purchase_price: djangoClient.property_valuation.estimated_purchase_price ? 
          parseFloat(djangoClient.property_valuation.estimated_purchase_price) : undefined,
      } : {
        assessed_land_value: 0, assessed_improvement_value: 0, assessed_total_value: 0,
        market_land_value: 0, market_improvement_value: 0, market_total_value: 0
      },
      
      // Loan Information (optional)
      loan_info: djangoClient.loan_info ? {
        loan_amount: parseFloat(djangoClient.loan_info.loan_amount),
        interest_rate: parseFloat(djangoClient.loan_info.interest_rate),
        apr: parseFloat(djangoClient.loan_info.apr),
        term_months: djangoClient.loan_info.term_months,
        monthly_payment: parseFloat(djangoClient.loan_info.monthly_payment),
        total_payment: parseFloat(djangoClient.loan_info.total_payment),
        loan_to_value_ratio: parseFloat(djangoClient.loan_info.loan_to_value_ratio),
        status: djangoClient.loan_info.status,
        application_date: djangoClient.loan_info.application_date,
        funding_date: djangoClient.loan_info.funding_date,
        payoff_date: djangoClient.loan_info.payoff_date,
      } : undefined,
      
      // Client Status & Workflow
      status: djangoClient.status,
      workflow_stage: djangoClient.workflow_stage,
      lead_source: djangoClient.lead_source,
      assigned_agent: djangoClient.assigned_agent,
      notes: djangoClient.notes || [],
      
      // Timestamps
      created_at: djangoClient.created_at,
      updated_at: djangoClient.updated_at,
      last_contact: djangoClient.last_contact,
      last_activity: djangoClient.last_activity,
    };
  }

  /**
   * Get TLC clients with advanced filtering
   * Connects to Django backend with advanced filtering
   */
  async getClients(
    filters: TLCClientFilters = {},
    page: number = 1,
    pageSize: number = 50,
    sortBy: string = 'created_at',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<{
    clients: TLCClient[];
    total: number;
    page: number;
    totalPages: number;
    hasMore: boolean;
  }> {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('page_size', pageSize.toString());
      params.append('ordering', sortOrder === 'desc' ? `-${sortBy}` : sortBy);
      
      // Add filter parameters - Django DRF style
      if (filters.status && filters.status.length > 0) {
        filters.status.forEach(status => params.append('status', status));
      }
      if (filters.workflow_stage && filters.workflow_stage.length > 0) {
        filters.workflow_stage.forEach(stage => params.append('workflow_stage', stage));
      }
      if (filters.search_term) {
        params.append('search', filters.search_term);
      }
      if (filters.assigned_agent) {
        params.append('assigned_agent', filters.assigned_agent);
      }
      
      // Use development endpoint for now (no auth required)
      const response = await fetch(`${this.apiBaseUrl}/api/dev/tlc/clients/?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch clients');
      }
      
      const data = await response.json();
      
      // Transform Django data to frontend format
      const transformedClients = data.results?.map((client: any) => this.transformDjangoClient(client)) || [];
      
      return {
        clients: transformedClients,
        total: data.count || 0,
        page,
        totalPages: Math.ceil((data.count || 0) / pageSize),
        hasMore: data.next !== null
      };
    } catch (error) {
      console.error('Failed to fetch clients:', error);
      throw new Error('Client data unavailable');
    }
  }

  /**
   * Get individual client details
   */
  async getClient(clientId: string): Promise<TLCClient> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/tlc/clients/${clientId}/`, {
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Client not found');
      }
      
      const clientData = await response.json();
      return this.transformDjangoClient(clientData);
    } catch (error) {
      console.error('Failed to fetch client:', error);
      throw new Error('Client not found');
    }
  }

  /**
   * Update client information
   */
  async updateClient(clientId: string, updates: Partial<TLCClient>): Promise<TLCClient> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/tlc/clients/${clientId}/`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        throw new Error('Client update failed');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to update client:', error);
      throw new Error('Client update failed');
    }
  }

  /**
   * Get dashboard statistics
   * Connects to Django backend dashboard stats endpoint
   */
  async getDashboardStats(): Promise<TLCDashboardStats> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/tlc/clients/dashboard_stats/`, {
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      throw new Error('Dashboard data unavailable');
    }
  }

  /**
   * Process loan application
   * Connects to Django backend loan processing
   */
  async processLoanApplication(clientId: string, loanData: any): Promise<TLCClient> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/tlc/clients/${clientId}/process_loan/`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(loanData)
      });
      
      if (!response.ok) {
        throw new Error('Loan application processing failed');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to process loan application:', error);
      throw new Error('Loan application processing failed');
    }
  }

  /**
   * Export clients data
   * Connects to Django backend export functionality
   */
  async exportClients(
    filters: TLCClientFilters,
    format: 'csv' | 'excel' | 'pdf'
  ): Promise<Blob> {
    try {
      // Build query parameters for filters
      const params = new URLSearchParams();
      params.append('format', format);
      
      if (filters.status && filters.status.length > 0) {
        filters.status.forEach(status => params.append('status[]', status));
      }
      if (filters.workflow_stage && filters.workflow_stage.length > 0) {
        filters.workflow_stage.forEach(stage => params.append('workflow_stage[]', stage));
      }
      if (filters.counties && filters.counties.length > 0) {
        filters.counties.forEach(county => params.append('counties[]', county));
      }
      if (filters.search_term) {
        params.append('search_term', filters.search_term);
      }
      
      const response = await fetch(`${this.apiBaseUrl}/api/tlc/clients/export/?${params}`, {
        headers: {
          'Authorization': localStorage.getItem('access_token') ? `Bearer ${localStorage.getItem('access_token')}` : '',
        }
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      return await response.blob();
    } catch (error) {
      console.error('Export failed:', error);
      throw new Error('Data export failed');
    }
  }

  /**
   * Add note to client
   */
  async addClientNote(clientId: string, noteData: {
    content: string;
    type: 'general' | 'call' | 'email' | 'meeting' | 'document';
  }): Promise<any> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/tlc/clients/${clientId}/add_note/`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          content: noteData.content,
          note_type: noteData.type
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to add note');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to add note:', error);
      throw new Error('Failed to add note');
    }
  }

  /**
   * Update client workflow stage
   */
  async updateWorkflowStage(clientId: string, workflowStage: string): Promise<any> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/tlc/clients/${clientId}/update_workflow_stage/`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          workflow_stage: workflowStage
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update workflow stage');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to update workflow stage:', error);
      throw new Error('Failed to update workflow stage');
    }
  }

  // Private helper methods for mock data and processing

  private async simulateCSVProcessing(job: CSVImportJob): Promise<void> {
    // Simulate file parsing to get total rows
    setTimeout(() => {
      job.total_rows = Math.floor(Math.random() * 5000) + 1000;
      job.status = 'processing';
      job.started_at = new Date().toISOString();
    }, 1000);

    // Simulate row-by-row processing
    const processRows = async () => {
      while (job.processed_rows < job.total_rows && job.status === 'processing') {
        await new Promise(resolve => setTimeout(resolve, 50));
        
        job.processed_rows += Math.floor(Math.random() * 10) + 1;
        job.successful_rows += Math.floor(Math.random() * 8) + 1;
        job.failed_rows = job.processed_rows - job.successful_rows;
        job.progress_percentage = Math.min(100, (job.processed_rows / job.total_rows) * 100);

        // Add occasional errors
        if (Math.random() < 0.05) {
          job.errors.push({
            row_number: job.processed_rows,
            column: 'email',
            error_message: 'Invalid email format',
            raw_data: 'invalid@email'
          });
        }
      }

      job.status = 'completed';
      job.completed_at = new Date().toISOString();
      job.progress_percentage = 100;
    };

    processRows();
  }

  private mockImportJobStatus(jobId: string): CSVImportJob {
    return {
      id: jobId,
      filename: 'TARRANT_LOAD_28_MAR_2025.csv',
      file_size: 38690816,
      total_rows: 4532,
      processed_rows: 4532,
      successful_rows: 4480,
      failed_rows: 52,
      status: 'completed',
      progress_percentage: 100,
      started_at: new Date(Date.now() - 300000).toISOString(),
      completed_at: new Date(Date.now() - 60000).toISOString(),
      errors: [
        {
          row_number: 145,
          column: 'email',
          error_message: 'Invalid email format',
          raw_data: 'john.doe@invalid'
        },
        {
          row_number: 678,
          column: 'tax_amount',
          error_message: 'Tax amount cannot be negative',
          raw_data: '-1500.00'
        }
      ],
      validation_summary: {
        duplicate_clients: 12,
        invalid_emails: 23,
        missing_required_fields: 8,
        invalid_tax_amounts: 5,
        invalid_dates: 4
      }
    };
  }

  private generateMockClients(count: number): TLCClient[] {
    const clients: TLCClient[] = [];

    for (let i = 0; i < count; i++) {
      clients.push(this.generateMockClient(`client_${i + 1}`));
    }

    return clients;
  }

  private generateMockClient(id: string): TLCClient {
    const counties = ['Tarrant', 'Harris', 'Dallas', 'Collin', 'Denton'];
    const statuses = ['prospect', 'lead', 'applicant', 'client', 'inactive'];
    const loanStatuses = ['pending', 'approved', 'funded', 'declined', 'paid_off'];
    const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Lisa', 'Robert', 'Maria', 'James', 'Jennifer'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
    
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const loanAmount = Math.floor(Math.random() * 100000) + 10000;
    
    return {
      id,
      client_number: `TLC${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`,
      first_name: firstName,
      last_name: lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      phone_primary: `(${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
      phone_secondary: Math.random() > 0.5 ? `(${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}` : undefined,
      ssn_last_four: String(Math.floor(Math.random() * 9000) + 1000),
      date_of_birth: new Date(Date.now() - Math.random() * 50 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      
      mailing_address: {
        street_1: `${Math.floor(Math.random() * 9999) + 1} Main St`,
        city: 'Fort Worth',
        state: 'TX',
        zip_code: String(Math.floor(Math.random() * 90000) + 10000),
        county: counties[Math.floor(Math.random() * counties.length)]
      },
      property_address: {
        street_1: `${Math.floor(Math.random() * 9999) + 1} Property Ave`,
        city: 'Fort Worth',
        state: 'TX',
        zip_code: String(Math.floor(Math.random() * 90000) + 10000),
        county: counties[Math.floor(Math.random() * counties.length)]
      },
      tax_info: {
        account_number: `${Math.floor(Math.random() * 900000) + 100000}`,
        tax_year: 2024,
        original_tax_amount: Math.floor(Math.random() * 50000) + 5000,
        penalties_interest: Math.floor(Math.random() * 10000) + 500,
        total_amount_due: Math.floor(Math.random() * 60000) + 6000,
        tax_sale_date: Math.random() > 0.6 ? new Date(Date.now() + Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : undefined,
        lawsuit_status: Math.random() > 0.7 ? 'pending' : 'none',
        attorney_fees: Math.random() > 0.8 ? Math.floor(Math.random() * 5000) + 1000 : undefined
      },
      property_valuation: {
        assessed_land_value: Math.floor(Math.random() * 100000) + 50000,
        assessed_improvement_value: Math.floor(Math.random() * 200000) + 100000,
        assessed_total_value: Math.floor(Math.random() * 300000) + 150000,
        market_land_value: Math.floor(Math.random() * 120000) + 60000,
        market_improvement_value: Math.floor(Math.random() * 250000) + 120000,
        market_total_value: Math.floor(Math.random() * 400000) + 200000,
        estimated_purchase_price: Math.random() > 0.5 ? Math.floor(Math.random() * 500000) + 200000 : undefined
      },
      
      // Add loan info for some clients
      loan_info: Math.random() > 0.3 ? {
        loan_amount: loanAmount,
        interest_rate: Math.round((Math.random() * 5 + 5) * 100) / 100, // 5-10%
        apr: Math.round((Math.random() * 6 + 6) * 100) / 100, // 6-12%
        term_months: [12, 18, 24, 36][Math.floor(Math.random() * 4)],
        monthly_payment: Math.round((loanAmount / 24) * 100) / 100,
        total_payment: Math.round((loanAmount * 1.2) * 100) / 100,
        loan_to_value_ratio: Math.round((Math.random() * 30 + 50) * 100) / 100, // 50-80%
        status: loanStatuses[Math.floor(Math.random() * loanStatuses.length)] as any,
        application_date: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString(),
        funding_date: Math.random() > 0.5 ? new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString() : undefined,
        payoff_date: Math.random() > 0.9 ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString() : undefined
      } : undefined,
      
      status: statuses[Math.floor(Math.random() * statuses.length)] as any,
      workflow_stage: ['initial_contact', 'qualification', 'application_review', 'underwriting', 'loan_approval', 'funding', 'servicing'][Math.floor(Math.random() * 7)],
      lead_source: ['tax_sale_list', 'website', 'referral', 'cold_call', 'direct_mail', 'social_media'][Math.floor(Math.random() * 6)],
      assigned_agent: Math.random() > 0.3 ? ['John Smith', 'Sarah Johnson', 'Mike Davis', 'Lisa Anderson'][Math.floor(Math.random() * 4)] : undefined,
      notes: [],
      created_at: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      last_contact: Math.random() > 0.4 ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString() : undefined,
      last_activity: Math.random() > 0.5 ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString() : undefined
    };
  }

  private generateMonthlyTrends() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    return months.map(month => ({
      month,
      new_clients: Math.floor(Math.random() * 100) + 50,
      loans_funded: Math.floor(Math.random() * 50) + 20,
      total_funded_amount: Math.floor(Math.random() * 2000000) + 500000
    }));
  }

  private generateCSVExport(clients: TLCClient[]): Blob {
    const headers = ['Client Number', 'Name', 'Email', 'Phone', 'County', 'Tax Amount', 'Status'];
    const rows = clients.map(client => [
      client.client_number,
      `${client.first_name} ${client.last_name}`,
      client.email || '',
      client.phone_primary || '',
      client.property_address.county,
      client.tax_info.total_amount_due.toFixed(2),
      client.status
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    return new Blob([csvContent], { type: 'text/csv' });
  }

  private generateExcelExport(clients: TLCClient[]): Blob {
    // In production, would use a library like xlsx
    return new Blob([JSON.stringify(clients)], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
  }

  private generatePDFExport(clients: TLCClient[]): Blob {
    // In production, would use a library like jsPDF
    return new Blob([JSON.stringify(clients)], { type: 'application/pdf' });
  }
}

export const tlcClientService = new TLCClientService();