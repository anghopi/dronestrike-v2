// Document Management Service
// Comprehensive document management with upload, processing, and lifecycle management

import axios, { AxiosProgressEvent, AxiosError } from 'axios';

// Error handling interfaces
export interface ServiceError {
  message: string;
  code?: string;
  details?: any;
  retryable?: boolean;
}

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryableErrors: string[];
}

export interface Document {
  id: string;
  name: string;
  filename: string;
  file_path?: string;
  file_url?: string;
  file_size: number;
  file_type: string;
  mime_type: string;
  document_type: 'contract' | 'proposal' | 'report' | 'template' | 'legal' | 'invoice' | 'receipt' | 'tax_document' | 'other';
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'signed' | 'sent' | 'delivered' | 'viewed' | 'completed' | 'archived';
  folder_id?: string;
  folder_name?: string;
  tags: string[];
  version: number;
  latest_version?: number;
  parent_document_id?: string;
  version_notes?: string;
  is_merged?: boolean;
  is_template: boolean;
  is_shared: boolean;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  last_modified_by: string;
  metadata: Record<string, any>;
  attachments?: DocumentAttachment[];
  linked_entities?: LinkedEntity[];
  permissions: DocumentPermissions;
}

export interface DocumentAttachment {
  id: string;
  name: string;
  file_size: number;
  file_type: string;
  file_url: string;
  created_at: string;
}

export interface LinkedEntity {
  entity_type: 'lead' | 'client' | 'property' | 'mission';
  entity_id: string;
  entity_name: string;
  linked_at: string;
}

export interface DocumentPermissions {
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_share: boolean;
  can_download: boolean;
}

export interface DocumentFolder {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  document_count: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  template_type: string;
  file_url: string;
  variables: TemplateVariable[];
  is_active: boolean;
  created_at: string;
}

export interface TemplateVariable {
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean';
  required: boolean;
  default_value?: string;
  description?: string;
}

export interface DocumentUploadOptions {
  folder_id?: string;
  document_type?: Document['document_type'];
  tags?: string[];
  is_template?: boolean;
  metadata?: Record<string, any>;
  onProgress?: (progress: number) => void;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version: number;
  filename: string;
  file_size: number;
  file_url: string;
  version_notes?: string;
  created_at: string;
  created_by: string;
  changes_summary?: string;
  diff_url?: string;
}

export interface VersionComparisonResult {
  document_id: string;
  version_a: number;
  version_b: number;
  differences: DocumentDifference[];
  similarity_score: number;
}

export interface DocumentDifference {
  type: 'added' | 'removed' | 'modified';
  section: string;
  content: string;
  line_number?: number;
  position?: number;
}

export interface DocumentSearchFilters {
  search?: string;
  document_type?: string;
  status?: string;
  folder_id?: string;
  tags?: string[];
  created_after?: string;
  created_before?: string;
  file_type?: string;
  is_template?: boolean;
  is_shared?: boolean;
  page?: number;
  page_size?: number;
  sort_by?: 'name' | 'created_at' | 'updated_at' | 'file_size';
  sort_order?: 'asc' | 'desc';
}

export interface DocumentSearchResponse {
  documents: Document[];
  total_count: number;
  page: number;
  page_size: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface DocumentGenerationRequest {
  template_id: string;
  variables: Record<string, any>;
  output_name: string;
  output_format?: 'pdf' | 'docx';
}

export interface DocumentMergeRequest {
  document_ids: string[];
  output_name: string;
  merge_type: 'concatenate' | 'overlay';
}

export interface DocumentActivity {
  id: string;
  document_id: string;
  activity_type: 'created' | 'updated' | 'viewed' | 'downloaded' | 'shared' | 'signed' | 'commented';
  description: string;
  user_name: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface DocumentStats {
  total_documents: number;
  total_size: number;
  documents_by_type: Record<string, number>;
  documents_by_status: Record<string, number>;
  recent_activity_count: number;
  shared_documents_count: number;
  template_documents_count: number;
}

class DocumentService {
  private baseURL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000';
  private apiURL = `${this.baseURL}/api/documents`;
  
  // Enhanced error handling configuration
  private retryConfig: RetryConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    retryableErrors: ['NETWORK_ERROR', 'TIMEOUT', 'SERVER_ERROR', '502', '503', '504']
  };

  // Enhanced error handling methods
  private async withRetry<T>(
    operation: () => Promise<T>,
    context: string,
    retries: number = this.retryConfig.maxRetries
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const serviceError = this.handleError(error, context);
      
      if (serviceError.retryable && retries > 0) {
        console.warn(`Retrying ${context} (${retries} attempts left)`, serviceError);
        await this.delay(this.retryConfig.retryDelay);
        return this.withRetry(operation, context, retries - 1);
      }
      
      throw serviceError;
    }
  }

  private handleError(error: any, context: string): ServiceError {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      
      // Network errors
      if (!axiosError.response) {
        return {
          message: 'Network connection failed. Please check your internet connection.',
          code: 'NETWORK_ERROR',
          details: { context, originalError: axiosError.message },
          retryable: true
        };
      }
      
      // HTTP status errors
      const status = axiosError.response.status;
      const responseData = axiosError.response.data as any;
      
      switch (status) {
        case 400:
          return {
            message: responseData?.message || 'Invalid request. Please check your input.',
            code: 'BAD_REQUEST',
            details: { context, errors: responseData?.errors },
            retryable: false
          };
        case 401:
          return {
            message: 'Authentication required. Please log in again.',
            code: 'UNAUTHORIZED',
            details: { context },
            retryable: false
          };
        case 403:
          return {
            message: 'Access denied. You do not have permission to perform this action.',
            code: 'FORBIDDEN',
            details: { context },
            retryable: false
          };
        case 404:
          return {
            message: 'The requested resource was not found.',
            code: 'NOT_FOUND',
            details: { context },
            retryable: false
          };
        case 409:
          return {
            message: responseData?.message || 'Conflict occurred. The resource may have been modified.',
            code: 'CONFLICT',
            details: { context, conflicts: responseData?.conflicts },
            retryable: false
          };
        case 413:
          return {
            message: 'File too large. Please select a smaller file.',
            code: 'FILE_TOO_LARGE',
            details: { context, maxSize: responseData?.maxSize },
            retryable: false
          };
        case 422:
          return {
            message: responseData?.message || 'Validation failed. Please check your input.',
            code: 'VALIDATION_ERROR',
            details: { context, validationErrors: responseData?.errors },
            retryable: false
          };
        case 429:
          return {
            message: 'Too many requests. Please wait a moment and try again.',
            code: 'RATE_LIMIT',
            details: { context, retryAfter: axiosError.response.headers['retry-after'] },
            retryable: true
          };
        case 500:
          return {
            message: 'Internal server error. Please try again later.',
            code: 'SERVER_ERROR',
            details: { context },
            retryable: true
          };
        case 502:
        case 503:
        case 504:
          return {
            message: 'Service temporarily unavailable. Please try again later.',
            code: status.toString(),
            details: { context },
            retryable: true
          };
        default:
          return {
            message: responseData?.message || `Request failed with status ${status}`,
            code: 'HTTP_ERROR',
            details: { context, status },
            retryable: status >= 500
          };
      }
    }
    
    // Non-Axios errors
    if (error instanceof Error) {
      return {
        message: error.message,
        code: 'UNKNOWN_ERROR',
        details: { context, stack: error.stack },
        retryable: false
      };
    }
    
    return {
      message: 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
      details: { context, error },
      retryable: false
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private validateFile(file: File): ServiceError | null {
    const maxSize = 100 * 1024 * 1024; // 100MB
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png'
    ];

    if (file.size > maxSize) {
      return {
        message: `File size exceeds limit of ${this.formatFileSize(maxSize)}`,
        code: 'FILE_TOO_LARGE',
        details: { fileSize: file.size, maxSize },
        retryable: false
      };
    }

    if (!allowedTypes.includes(file.type)) {
      return {
        message: 'File type not supported. Please upload PDF, Word, text, or image files.',
        code: 'INVALID_FILE_TYPE',
        details: { fileType: file.type, allowedTypes },
        retryable: false
      };
    }

    return null;
  }

  // Document CRUD Operations
  async getDocuments(filters: DocumentSearchFilters = {}): Promise<DocumentSearchResponse> {
    return this.withRetry(async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => params.append(key, v.toString()));
          } else {
            params.append(key, value.toString());
          }
        }
      });

      const response = await axios.get(`${this.apiURL}/`, { params });
      return response.data;
    }, 'fetching documents');
  }

  async getDocument(id: string): Promise<Document> {
    return this.withRetry(async () => {
      const response = await axios.get(`${this.apiURL}/${id}/`);
      return response.data;
    }, `fetching document ${id}`);
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document> {
    return this.withRetry(async () => {
      const response = await axios.patch(`${this.apiURL}/${id}/`, updates);
      return response.data;
    }, `updating document ${id}`);
  }

  async deleteDocument(id: string): Promise<void> {
    try {
      await axios.delete(`${this.apiURL}/${id}/`);
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  async deleteDocuments(ids: string[]): Promise<void> {
    return this.withRetry(async () => {
      const response = await axios.post(`${this.baseURL}/api/documents/bulk-delete/`, { document_ids: ids });
      return response.data;
    }, `bulk deleting ${ids.length} documents`);
  }

  // File Upload Operations
  async uploadDocuments(
    files: File[], 
    options: DocumentUploadOptions = {}
  ): Promise<Document[]> {
    // Validate all files before upload
    for (const file of files) {
      const validationError = this.validateFile(file);
      if (validationError) {
        throw validationError;
      }
    }

    return this.withRetry(async () => {
      const uploadPromises = files.map(file => this.uploadSingleDocument(file, options));
      return await Promise.all(uploadPromises);
    }, `uploading ${files.length} documents`);
  }

  private async uploadSingleDocument(
    file: File, 
    options: DocumentUploadOptions = {}
  ): Promise<Document> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      if (options.folder_id) formData.append('folder_id', options.folder_id);
      if (options.document_type) formData.append('document_type', options.document_type);
      if (options.is_template) formData.append('is_template', 'true');
      if (options.tags) formData.append('tags', JSON.stringify(options.tags));
      if (options.metadata) formData.append('metadata', JSON.stringify(options.metadata));

      const response = await axios.post(`${this.apiURL}/upload/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent: AxiosProgressEvent) => {
          if (progressEvent.total && options.onProgress) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            options.onProgress(progress);
          }
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  }

  // Document Processing Operations
  async generateDocument(request: DocumentGenerationRequest): Promise<Document> {
    try {
      const response = await axios.post(`${this.apiURL}/generate/`, request);
      return response.data;
    } catch (error) {
      console.error('Error generating document:', error);
      throw error;
    }
  }

  async mergeDocuments(request: DocumentMergeRequest): Promise<Document> {
    try {
      const response = await axios.post(`${this.apiURL}/merge/`, request);
      return response.data;
    } catch (error) {
      console.error('Error merging documents:', error);
      throw error;
    }
  }

  async duplicateDocument(id: string, name?: string): Promise<Document> {
    return this.withRetry(async () => {
      const response = await axios.post(`${this.baseURL}/api/documents/${id}/duplicate/`, {
        name: name
      });
      return response.data;
    }, `duplicating document ${id}`);
  }

  // Download Operations
  async downloadDocument(id: string): Promise<Blob> {
    try {
      const response = await axios.get(`${this.apiURL}/${id}/download/`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      console.error('Error downloading document:', error);
      throw error;
    }
  }

  async downloadDocuments(ids: string[]): Promise<Blob> {
    return this.withRetry(async () => {
      const response = await axios.post(`${this.baseURL}/api/documents/bulk-download/`, 
        { document_ids: ids },
        { responseType: 'blob' }
      );
      return response.data;
    }, `bulk downloading ${ids.length} documents`);
  }

  // Folder Operations
  async getFolders(): Promise<DocumentFolder[]> {
    try {
      const response = await axios.get(`${this.apiURL}/folders/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching folders:', error);
      throw error;
    }
  }

  async createFolder(name: string, parent_id?: string): Promise<DocumentFolder> {
    try {
      const response = await axios.post(`${this.apiURL}/folders/`, {
        name,
        parent_id,
      });
      return response.data;
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  }

  async updateFolder(id: string, updates: Partial<DocumentFolder>): Promise<DocumentFolder> {
    try {
      const response = await axios.patch(`${this.apiURL}/folders/${id}/`, updates);
      return response.data;
    } catch (error) {
      console.error('Error updating folder:', error);
      throw error;
    }
  }

  async deleteFolder(id: string): Promise<void> {
    try {
      await axios.delete(`${this.apiURL}/folders/${id}/`);
    } catch (error) {
      console.error('Error deleting folder:', error);
      throw error;
    }
  }

  // Template Operations
  async getTemplates(): Promise<DocumentTemplate[]> {
    try {
      const response = await axios.get(`${this.apiURL}/templates/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching templates:', error);
      throw error;
    }
  }

  async getTemplate(id: string): Promise<DocumentTemplate> {
    try {
      const response = await axios.get(`${this.apiURL}/templates/${id}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching template:', error);
      throw error;
    }
  }

  // Activity and Analytics
  async getDocumentActivity(document_id: string): Promise<DocumentActivity[]> {
    try {
      const response = await axios.get(`${this.apiURL}/${document_id}/activity/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching document activity:', error);
      throw error;
    }
  }

  async getDocumentStats(): Promise<DocumentStats> {
    try {
      const response = await axios.get(`${this.apiURL}/stats/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching document stats:', error);
      throw error;
    }
  }

  // Sharing Operations
  async shareDocument(id: string, email: string, permissions: Partial<DocumentPermissions>): Promise<void> {
    return this.withRetry(async () => {
      const response = await axios.post(`${this.baseURL}/api/documents/${id}/share/`, {
        email,
        permission_level: permissions.can_edit ? 'edit' : 'view'
      });
      return response.data;
    }, `sharing document ${id} with ${email}`);
  }

  async getSharedDocuments(): Promise<Document[]> {
    return this.withRetry(async () => {
      const response = await axios.get(`${this.baseURL}/api/documents/shared/`);
      return response.data;
    }, 'fetching shared documents');
  }

  // Helper Methods
  getFileTypeIcon(file_type: string): string {
    const iconMap: Record<string, string> = {
      'application/pdf': 'PDF',
      'application/msword': 'DOC',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
      'application/vnd.ms-excel': 'XLS',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
      'image/jpeg': 'JPG',
      'image/png': 'PNG',
      'image/gif': 'GIF',
      'text/plain': 'TXT',
      'text/csv': 'CSV',
    };
    return iconMap[file_type] || 'FILE';
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getStatusColor(status: Document['status']): string {
    const colorMap: Record<Document['status'], string> = {
      draft: 'gray',
      pending_review: 'yellow',
      approved: 'green',
      rejected: 'red',
      signed: 'blue',
      sent: 'purple',
      delivered: 'indigo',
      viewed: 'teal',
      completed: 'green',
      archived: 'gray',
    };
    return colorMap[status] || 'gray';
  }

  // Version Control Methods
  async getDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
    try {
      const response = await axios.get(`${this.apiURL}/${documentId}/versions/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching document versions:', error);
      // Return mock data for development
      return this.getMockVersions(documentId);
    }
  }

  async createNewVersion(documentId: string, file: File, versionNotes?: string): Promise<DocumentVersion> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (versionNotes) formData.append('version_notes', versionNotes);

      const response = await axios.post(
        `${this.apiURL}/${documentId}/versions/`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error creating new version:', error);
      throw error;
    }
  }

  async compareVersions(documentId: string, versionA: number, versionB: number): Promise<VersionComparisonResult> {
    try {
      const response = await axios.get(
        `${this.apiURL}/${documentId}/versions/compare/?version_a=${versionA}&version_b=${versionB}`
      );
      return response.data;
    } catch (error) {
      console.error('Error comparing versions:', error);
      // Return mock comparison for development
      return this.getMockComparison(documentId, versionA, versionB);
    }
  }

  async revertToVersion(documentId: string, targetVersion: number): Promise<Document> {
    try {
      const response = await axios.post(`${this.apiURL}/${documentId}/versions/${targetVersion}/revert/`);
      return response.data;
    } catch (error) {
      console.error('Error reverting to version:', error);
      throw error;
    }
  }

  async downloadVersion(documentId: string, version: number): Promise<Blob> {
    try {
      const response = await axios.get(
        `${this.apiURL}/${documentId}/versions/${version}/download/`,
        { responseType: 'blob' }
      );
      return response.data;
    } catch (error) {
      console.error('Error downloading version:', error);
      throw error;
    }
  }

  // Mock data methods for development
  private getMockVersions(documentId: string): DocumentVersion[] {
    return [
      {
        id: 'v1',
        document_id: documentId,
        version: 1,
        filename: 'document_v1.pdf',
        file_size: 1024000,
        file_url: '/mock/document_v1.pdf',
        version_notes: 'Initial version',
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        created_by: 'John Doe',
        changes_summary: 'Document created'
      },
      {
        id: 'v2',
        document_id: documentId,
        version: 2,
        filename: 'document_v2.pdf',
        file_size: 1056000,
        file_url: '/mock/document_v2.pdf',
        version_notes: 'Added executive summary',
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        created_by: 'Jane Smith',
        changes_summary: 'Added 2 pages, modified 3 sections'
      },
      {
        id: 'v3',
        document_id: documentId,
        version: 3,
        filename: 'document_v3.pdf',
        file_size: 1123000,
        file_url: '/mock/document_v3.pdf',
        version_notes: 'Updated financial projections',
        created_at: new Date().toISOString(),
        created_by: 'Mike Johnson',
        changes_summary: 'Modified 5 sections, added charts'
      }
    ];
  }

  private getMockComparison(documentId: string, versionA: number, versionB: number): VersionComparisonResult {
    return {
      document_id: documentId,
      version_a: versionA,
      version_b: versionB,
      similarity_score: 85.5,
      differences: [
        {
          type: 'added',
          section: 'Executive Summary',
          content: 'Added new executive summary section with key findings and recommendations.',
          line_number: 15
        },
        {
          type: 'modified',
          section: 'Financial Projections',
          content: 'Updated revenue projections from $1.2M to $1.8M for Q4.',
          line_number: 145
        },
        {
          type: 'removed',
          section: 'Appendix C',
          content: 'Removed outdated technical specifications from appendix.',
          line_number: 230
        }
      ]
    };
  }
}

export const documentService = new DocumentService();
export default documentService;