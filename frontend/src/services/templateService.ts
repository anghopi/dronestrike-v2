export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: 'contract' | 'proposal' | 'report' | 'legal' | 'invoice' | 'other';
  fields: TemplateField[];
  content: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  is_active: boolean;
  usage_count: number;
}

export interface TemplateField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[]; // for select type
  default_value?: string;
}

export interface TemplateGenerationRequest {
  template_id: string;
  field_values: Record<string, any>;
  output_format: 'pdf' | 'docx' | 'html';
  filename?: string;
}

class TemplateService {
  private baseUrl = '/api/templates';

  async getTemplates(category?: string): Promise<DocumentTemplate[]> {
    try {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      
      const response = await fetch(`${this.baseUrl}?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch templates');
      return await response.json();
    } catch (error) {
      console.error('Error fetching templates:', error);
      // Return mock data for development
      return this.getMockTemplates(category);
    }
  }

  async getTemplate(id: string): Promise<DocumentTemplate> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`);
      if (!response.ok) throw new Error('Failed to fetch template');
      return await response.json();
    } catch (error) {
      console.error('Error fetching template:', error);
      return this.getMockTemplates().find(t => t.id === id) || this.getMockTemplates()[0];
    }
  }

  async generateDocument(request: TemplateGenerationRequest): Promise<{ download_url: string; document_id: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/${request.template_id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!response.ok) throw new Error('Failed to generate document');
      return await response.json();
    } catch (error) {
      console.error('Error generating document:', error);
      // Mock response for development
      return {
        download_url: '/mock-download-url',
        document_id: `doc_${Date.now()}`
      };
    }
  }

  async createTemplate(template: Omit<DocumentTemplate, 'id' | 'created_at' | 'updated_at' | 'usage_count'>): Promise<DocumentTemplate> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });
      if (!response.ok) throw new Error('Failed to create template');
      return await response.json();
    } catch (error) {
      console.error('Error creating template:', error);
      throw error;
    }
  }

  async updateTemplate(id: string, updates: Partial<DocumentTemplate>): Promise<DocumentTemplate> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update template');
      return await response.json();
    } catch (error) {
      console.error('Error updating template:', error);
      throw error;
    }
  }

  async deleteTemplate(id: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete template');
    } catch (error) {
      console.error('Error deleting template:', error);
      throw error;
    }
  }

  private getMockTemplates(category?: string): DocumentTemplate[] {
    const templates: DocumentTemplate[] = [
      {
        id: 'template_contract_1',
        name: 'Service Contract Template',
        description: 'Standard service agreement template',
        category: 'contract',
        fields: [
          {
            id: 'client_name',
            name: 'client_name',
            type: 'text',
            label: 'Client Name',
            required: true,
            placeholder: 'Enter client name'
          },
          {
            id: 'service_description',
            name: 'service_description',
            type: 'textarea',
            label: 'Service Description',
            required: true,
            placeholder: 'Describe the services to be provided'
          },
          {
            id: 'contract_value',
            name: 'contract_value',
            type: 'number',
            label: 'Contract Value',
            required: true,
            placeholder: '0.00'
          },
          {
            id: 'start_date',
            name: 'start_date',
            type: 'date',
            label: 'Start Date',
            required: true
          }
        ],
        content: 'SERVICE AGREEMENT\n\nThis agreement is between {{client_name}} and our company...',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        created_by: 'System Admin',
        is_active: true,
        usage_count: 15
      },
      {
        id: 'template_proposal_1',
        name: 'Project Proposal Template',
        description: 'Professional project proposal template',
        category: 'proposal',
        fields: [
          {
            id: 'project_title',
            name: 'project_title',
            type: 'text',
            label: 'Project Title',
            required: true,
            placeholder: 'Enter project title'
          },
          {
            id: 'client_company',
            name: 'client_company',
            type: 'text',
            label: 'Client Company',
            required: true,
            placeholder: 'Enter company name'
          },
          {
            id: 'project_scope',
            name: 'project_scope',
            type: 'textarea',
            label: 'Project Scope',
            required: true,
            placeholder: 'Define project scope and deliverables'
          },
          {
            id: 'timeline',
            name: 'timeline',
            type: 'select',
            label: 'Timeline',
            required: true,
            options: ['2 weeks', '1 month', '3 months', '6 months', '1 year']
          }
        ],
        content: 'PROJECT PROPOSAL\n\nProposal for: {{project_title}}\nClient: {{client_company}}...',
        created_at: '2024-01-20T14:30:00Z',
        updated_at: '2024-01-20T14:30:00Z',
        created_by: 'Marketing Team',
        is_active: true,
        usage_count: 8
      },
      {
        id: 'template_report_1',
        name: 'Monthly Report Template',
        description: 'Standard monthly progress report',
        category: 'report',
        fields: [
          {
            id: 'report_month',
            name: 'report_month',
            type: 'text',
            label: 'Report Month',
            required: true,
            placeholder: 'January 2024'
          },
          {
            id: 'key_achievements',
            name: 'key_achievements',
            type: 'textarea',
            label: 'Key Achievements',
            required: true,
            placeholder: 'List major accomplishments'
          },
          {
            id: 'metrics_summary',
            name: 'metrics_summary',
            type: 'textarea',
            label: 'Metrics Summary',
            required: false,
            placeholder: 'Performance metrics and KPIs'
          }
        ],
        content: 'MONTHLY REPORT - {{report_month}}\n\nKEY ACHIEVEMENTS:\n{{key_achievements}}...',
        created_at: '2024-02-01T09:00:00Z',
        updated_at: '2024-02-01T09:00:00Z',
        created_by: 'Operations Team',
        is_active: true,
        usage_count: 12
      }
    ];

    return category ? templates.filter(t => t.category === category) : templates;
  }
}

export const templateService = new TemplateService();