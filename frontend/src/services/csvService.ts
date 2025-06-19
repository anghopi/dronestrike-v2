import Papa from 'papaparse';
// import { Lead, Property } from '../types';

export interface CSVParseResult<T> {
  data: T[];
  errors: Papa.ParseError[];
  meta: Papa.ParseMeta;
}

export interface FieldMapping {
  csvField: string;
  targetField: string;
  required?: boolean;
  transform?: (value: string) => any;
}

export interface CSVImportOptions {
  skipFirstRow?: boolean;
  delimiter?: string;
  encoding?: string;
  maxFileSize?: number; // in bytes
}

class CSVService {
  private readonly MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB default for large datasets

  async parseCSVFile<T>(
    file: File,
    fieldMappings: FieldMapping[],
    options: CSVImportOptions = {}
  ): Promise<CSVParseResult<T>> {
    const {
      skipFirstRow = true,
      delimiter = 'auto',
      encoding = 'utf-8',
      maxFileSize = this.MAX_FILE_SIZE
    } = options;

    // Validate file size
    if (file.size > maxFileSize) {
      throw new Error(`File size exceeds limit of ${this.formatFileSize(maxFileSize)}`);
    }

    // Validate file type
    if (!this.isValidCSVFile(file)) {
      throw new Error('Invalid file type. Please upload a CSV file.');
    }

    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: skipFirstRow,
        delimiter: delimiter === 'auto' ? '' : delimiter,
        encoding: encoding,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim(),
        complete: (results) => {
          try {
            const transformedData = this.transformData<T>(results.data, fieldMappings);
            resolve({
              data: transformedData,
              errors: results.errors,
              meta: results.meta
            });
          } catch (error) {
            reject(error);
          }
        },
        error: (error: any) => {
          reject(new Error(`CSV parsing error: ${error.message}`));
        }
      });
    });
  }

  async parseCSVText<T>(
    csvText: string,
    fieldMappings: FieldMapping[],
    options: CSVImportOptions = {}
  ): Promise<CSVParseResult<T>> {
    const {
      skipFirstRow = true,
      delimiter = 'auto'
    } = options;

    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: skipFirstRow,
        delimiter: delimiter === 'auto' ? '' : delimiter,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim(),
        complete: (results) => {
          try {
            const transformedData = this.transformData<T>(results.data, fieldMappings);
            resolve({
              data: transformedData,
              errors: results.errors,
              meta: results.meta
            });
          } catch (error) {
            reject(error);
          }
        },
        error: (error: any) => {
          reject(new Error(`CSV parsing error: ${error.message}`));
        }
      });
    });
  }

  generateCSV<T extends Record<string, any>>(
    data: T[],
    columns?: Array<{key: keyof T; header: string; transform?: (value: any) => string}>
  ): string {
    if (!data.length) return '';

    const headers = columns 
      ? columns.map(col => col.header)
      : Object.keys(data[0]);

    const rows = data.map(row => {
      if (columns) {
        return columns.map(col => {
          const value = row[col.key];
          return col.transform ? col.transform(value) : String(value || '');
        });
      }
      return Object.values(row).map(value => String(value || ''));
    });

    return Papa.unparse([headers, ...rows]);
  }

  downloadCSV<T extends Record<string, any>>(
    data: T[],
    filename: string,
    columns?: Array<{key: keyof T; header: string; transform?: (value: any) => string}>
  ): void {
    const csv = this.generateCSV(data, columns);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }

  // Predefined field mappings for different entity types
  getLeadFieldMappings(): FieldMapping[] {
    return [
      { csvField: 'First Name', targetField: 'first_name', required: true },
      { csvField: 'Last Name', targetField: 'last_name', required: true },
      { csvField: 'Email', targetField: 'email' },
      { csvField: 'Phone', targetField: 'phone_cell' },
      { csvField: 'Address', targetField: 'mailing_address1' },
      { csvField: 'City', targetField: 'mailing_city' },
      { csvField: 'State', targetField: 'mailing_state' },
      { csvField: 'ZIP', targetField: 'mailing_zipcode' },
      { csvField: 'Property Address', targetField: 'property_address' },
      { csvField: 'Source', targetField: 'imported_from' },
      { 
        csvField: 'Date Created', 
        targetField: 'created_at',
        transform: (value: string) => new Date(value).toISOString()
      }
    ];
  }

  getPropertyFieldMappings(): FieldMapping[] {
    return [
      { csvField: 'Address', targetField: 'address1', required: true },
      { csvField: 'City', targetField: 'city', required: true },
      { csvField: 'State', targetField: 'state', required: true },
      { csvField: 'ZIP', targetField: 'zip_code', required: true },
      { csvField: 'County', targetField: 'county' },
      { csvField: 'Property Type', targetField: 'property_type' },
      { csvField: 'Disposition', targetField: 'disposition' },
      { csvField: 'Owner Name', targetField: 'owner_name' },
      { csvField: 'Owner Phone', targetField: 'owner_phone' },
      { csvField: 'Owner Email', targetField: 'owner_email' },
      {
        csvField: 'Estimated Value',
        targetField: 'estimated_value',
        transform: (value: string) => parseFloat(value.replace(/[$,]/g, '')) || 0
      },
      {
        csvField: 'Sqft',
        targetField: 'sqft',
        transform: (value: string) => parseInt(value.replace(/,/g, '')) || 0
      },
      {
        csvField: 'Year Built',
        targetField: 'year_built',
        transform: (value: string) => parseInt(value) || null
      }
    ];
  }

  // Smart field mapping detection
  detectFieldMappings(headers: string[], entityType: 'lead' | 'property'): FieldMapping[] {
    const predefinedMappings = entityType === 'lead' 
      ? this.getLeadFieldMappings() 
      : this.getPropertyFieldMappings();

    return predefinedMappings.map(mapping => {
      // Try to find exact match first
      let matchedHeader = headers.find(h => 
        h.toLowerCase() === mapping.csvField.toLowerCase()
      );

      // If no exact match, try fuzzy matching
      if (!matchedHeader) {
        matchedHeader = headers.find(h => {
          const normalizedHeader = h.toLowerCase().replace(/[^a-z0-9]/g, '');
          const normalizedMapping = mapping.csvField.toLowerCase().replace(/[^a-z0-9]/g, '');
          return normalizedHeader.includes(normalizedMapping) || 
                 normalizedMapping.includes(normalizedHeader);
        });
      }

      return {
        ...mapping,
        csvField: matchedHeader || mapping.csvField
      };
    });
  }

  validateCSVData<T>(data: any[], fieldMappings: FieldMapping[]): {
    validRows: T[];
    invalidRows: Array<{row: any; errors: string[]; index: number}>;
  } {
    const validRows: T[] = [];
    const invalidRows: Array<{row: any; errors: string[]; index: number}> = [];

    data.forEach((row, index) => {
      const errors: string[] = [];
      const transformedRow: any = {};

      fieldMappings.forEach(mapping => {
        const value = row[mapping.csvField];
        
        if (mapping.required && (!value || value.toString().trim() === '')) {
          errors.push(`Required field '${mapping.csvField}' is missing or empty`);
          return;
        }

        if (value !== undefined && value !== null && value !== '') {
          try {
            transformedRow[mapping.targetField] = mapping.transform 
              ? mapping.transform(value.toString()) 
              : value;
          } catch (error) {
            errors.push(`Invalid value for '${mapping.csvField}': ${error}`);
          }
        }
      });

      if (errors.length > 0) {
        invalidRows.push({ row, errors, index });
      } else {
        validRows.push(transformedRow as T);
      }
    });

    return { validRows, invalidRows };
  }

  private transformData<T>(data: any[], fieldMappings: FieldMapping[]): T[] {
    return data.map(row => {
      const transformedRow: any = {};
      
      fieldMappings.forEach(mapping => {
        const value = row[mapping.csvField];
        if (value !== undefined && value !== null && value !== '') {
          transformedRow[mapping.targetField] = mapping.transform 
            ? mapping.transform(value.toString()) 
            : value;
        }
      });

      return transformedRow as T;
    });
  }

  private isValidCSVFile(file: File): boolean {
    const validTypes = [
      'text/csv',
      'application/csv',
      'text/plain',
      'application/vnd.ms-excel'
    ];
    
    const validExtensions = ['.csv', '.txt'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    return validTypes.includes(file.type) || validExtensions.includes(fileExtension);
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export const csvService = new CSVService();