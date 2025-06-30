import React, { useState, useCallback, useRef } from 'react';
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  Download,
  Eye,
  Play,
  RotateCcw,
  Activity,
  Clock,
  AlertTriangle,
  FileCheck
} from 'lucide-react';
import {
  tlcClientService,
  CSVImportJob,
  CSVFieldMapping
} from '../../services/tlcClientService';

interface CSVUploadProcessorProps {
  onUploadComplete?: (job: CSVImportJob) => void;
  onDataImported?: (clientCount: number) => void;
}

const CSVUploadProcessor: React.FC<CSVUploadProcessorProps> = ({
  onUploadComplete,
  onDataImported
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [importJob, setImportJob] = useState<CSVImportJob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [fieldMappings, setFieldMappings] = useState<CSVFieldMapping[]>([]);
  const [showMappingConfig, setShowMappingConfig] = useState(false);
  const [processingErrors, setProcessingErrors] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Default field mappings for Tarrant County CSV format
  const defaultFieldMappings: CSVFieldMapping[] = [
    { csv_column: 'Owner Name', database_field: 'full_name', is_required: true, data_type: 'string' },
    { csv_column: 'Mailing Address', database_field: 'mailing_address.street_1', is_required: true, data_type: 'string' },
    { csv_column: 'Mailing City', database_field: 'mailing_address.city', is_required: true, data_type: 'string' },
    { csv_column: 'Mailing State', database_field: 'mailing_address.state', is_required: true, data_type: 'string' },
    { csv_column: 'Mailing ZIP', database_field: 'mailing_address.zip_code', is_required: true, data_type: 'string' },
    { csv_column: 'Property Address', database_field: 'property_address.street_1', is_required: true, data_type: 'string' },
    { csv_column: 'Property City', database_field: 'property_address.city', is_required: true, data_type: 'string' },
    { csv_column: 'Property ZIP', database_field: 'property_address.zip_code', is_required: true, data_type: 'string' },
    { csv_column: 'Account Number', database_field: 'tax_info.account_number', is_required: true, data_type: 'string' },
    { csv_column: 'Tax Year', database_field: 'tax_info.tax_year', is_required: true, data_type: 'number' },
    { csv_column: 'Tax Amount', database_field: 'tax_info.original_tax_amount', is_required: true, data_type: 'currency' },
    { csv_column: 'Penalties', database_field: 'tax_info.penalties_interest', is_required: false, data_type: 'currency' },
    { csv_column: 'Total Due', database_field: 'tax_info.total_amount_due', is_required: true, data_type: 'currency' },
    { csv_column: 'Market Value', database_field: 'property_valuation.market_total_value', is_required: false, data_type: 'currency' },
    { csv_column: 'Assessed Value', database_field: 'property_valuation.assessed_total_value', is_required: false, data_type: 'currency' },
    { csv_column: 'Lawsuit', database_field: 'tax_info.lawsuit_status', is_required: false, data_type: 'string' }
  ];

  const handleFileSelect = useCallback((file: File) => {
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setProcessingErrors(['Please select a valid CSV file']);
      return;
    }

    // Validate file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      setProcessingErrors(['File size too large. Maximum size is 100MB']);
      return;
    }

    setUploadedFile(file);
    setProcessingErrors([]);
    
    // Preview file content
    previewCSVFile(file);
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, [handleFileSelect]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const previewCSVFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').slice(0, 6); // Preview first 5 rows + header
      const headers = lines[0]?.split(',').map(h => h.trim().replace(/"/g, ''));
      
      const preview = lines.slice(1, 6).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        return headers.reduce((obj, header, index) => {
          obj[header] = values[index] || '';
          return obj;
        }, {} as any);
      });

      setPreviewData(preview);
      
      // Auto-configure field mappings based on headers
      const autoMappings = defaultFieldMappings.filter(mapping => 
        headers.some(header => 
          header.toLowerCase().includes(mapping.csv_column.toLowerCase()) ||
          mapping.csv_column.toLowerCase().includes(header.toLowerCase())
        )
      );
      
      setFieldMappings(autoMappings);
    };
    reader.readAsText(file);
  };

  const startProcessing = async () => {
    if (!uploadedFile) return;

    setIsProcessing(true);
    setProcessingErrors([]);

    try {
      const job = await tlcClientService.uploadCSV(uploadedFile, fieldMappings);
      setImportJob(job);
      
      // Start polling for job status
      pollIntervalRef.current = setInterval(async () => {
        try {
          const updatedJob = await tlcClientService.getImportJobStatus(job.id);
          setImportJob(updatedJob);
          
          if (updatedJob.status === 'completed' || updatedJob.status === 'failed') {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }
            setIsProcessing(false);
            
            if (updatedJob.status === 'completed') {
              onUploadComplete?.(updatedJob);
              onDataImported?.(updatedJob.successful_rows);
            }
          }
        } catch (error) {
          console.error('Failed to poll job status:', error);
        }
      }, 2000);

    } catch (error) {
      console.error('Upload failed:', error);
      setProcessingErrors(['Upload failed. Please try again.']);
      setIsProcessing(false);
    }
  };

  const resetUpload = () => {
    setUploadedFile(null);
    setImportJob(null);
    setIsProcessing(false);
    setPreviewData([]);
    setFieldMappings([]);
    setShowMappingConfig(false);
    setProcessingErrors([]);
    
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadErrorReport = () => {
    if (!importJob || importJob.errors.length === 0) return;

    const errorData = importJob.errors.map(error => ({
      'Row Number': error.row_number,
      'Column': error.column,
      'Error': error.error_message,
      'Raw Data': error.raw_data
    }));

    const csv = [
      Object.keys(errorData[0]).join(','),
      ...errorData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import_errors_${importJob.id}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-500';
      case 'failed': return 'text-red-500';
      case 'processing': return 'text-blue-500';
      case 'pending': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle;
      case 'failed': return AlertCircle;
      case 'processing': return Activity;
      case 'pending': return Clock;
      default: return FileText;
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-white mb-1">CSV Data Import</h3>
          <p className="text-slate-400">Upload and process TLC client data from CSV files</p>
        </div>
        {uploadedFile && (
          <button
            onClick={resetUpload}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all duration-300 border border-slate-600/50"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {processingErrors.length > 0 && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h4 className="text-red-500 font-medium">Upload Errors</h4>
          </div>
          <ul className="text-red-400 text-sm space-y-1">
            {processingErrors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {!uploadedFile ? (
        <div
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-slate-600 hover:border-slate-500'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-white mb-2">Upload CSV File</h4>
          <p className="text-slate-400 mb-4">
            Drag and drop your CSV file here, or click to browse
          </p>
          <p className="text-sm text-slate-500 mb-6">
            Supports files up to 100MB. Expected format: Tarrant County tax data
          </p>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all duration-300 border border-blue-500/50 shadow-lg hover:shadow-xl"
          >
            Choose File
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* File Information */}
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileCheck className="w-8 h-8 text-green-500" />
                <div>
                  <h4 className="font-medium text-white">{uploadedFile.name}</h4>
                  <p className="text-sm text-slate-400">
                    {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              
              {!importJob && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowMappingConfig(!showMappingConfig)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all duration-300 border border-slate-600/50"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={startProcessing}
                    disabled={isProcessing}
                    className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-lg transition-all duration-300 border border-green-500/50 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="w-4 h-4" />
                    <span>Process File</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Data Preview */}
          {previewData.length > 0 && showMappingConfig && (
            <div className="bg-slate-700 rounded-lg p-4">
              <h4 className="font-medium text-white mb-4">Data Preview</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-600">
                      {Object.keys(previewData[0]).slice(0, 8).map(header => (
                        <th key={header} className="text-left py-2 px-3 text-slate-300">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.slice(0, 3).map((row, index) => (
                      <tr key={index} className="border-b border-slate-600">
                        {Object.values(row).slice(0, 8).map((value: any, colIndex) => (
                          <td key={colIndex} className="py-2 px-3 text-slate-300">
                            {String(value).substring(0, 30)}
                            {String(value).length > 30 ? '...' : ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Showing first 3 rows and 8 columns
              </p>
            </div>
          )}

          {/* Import Job Status */}
          {importJob && (
            <div className="bg-slate-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {React.createElement(getStatusIcon(importJob.status), {
                    className: `w-6 h-6 ${getStatusColor(importJob.status)}`
                  })}
                  <div>
                    <h4 className="font-medium text-white">Import Status</h4>
                    <p className={`text-sm ${getStatusColor(importJob.status)}`}>
                      {importJob.status.toUpperCase()}
                    </p>
                  </div>
                </div>
                
                {importJob.errors.length > 0 && (
                  <button
                    onClick={downloadErrorReport}
                    className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-lg transition-all duration-300 border border-red-500/50 shadow-lg hover:shadow-xl"
                  >
                    <Download className="w-4 h-4" />
                    <span>Error Report</span>
                  </button>
                )}
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm text-slate-300 mb-2">
                  <span>Progress</span>
                  <span>{importJob.progress_percentage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-600 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${importJob.progress_percentage}%` }}
                  ></div>
                </div>
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">{importJob.total_rows.toLocaleString()}</div>
                  <div className="text-xs text-slate-400">Total Rows</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{importJob.successful_rows.toLocaleString()}</div>
                  <div className="text-xs text-slate-400">Successful</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">{importJob.failed_rows.toLocaleString()}</div>
                  <div className="text-xs text-slate-400">Failed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">{importJob.processed_rows.toLocaleString()}</div>
                  <div className="text-xs text-slate-400">Processed</div>
                </div>
              </div>

              {/* Validation Summary */}
              {importJob.status === 'completed' && (
                <div className="bg-slate-600 rounded-lg p-4">
                  <h5 className="font-medium text-white mb-3">Validation Summary</h5>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Duplicates:</span>
                      <span className="text-white ml-2">{importJob.validation_summary.duplicate_clients}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Invalid Emails:</span>
                      <span className="text-white ml-2">{importJob.validation_summary.invalid_emails}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Missing Fields:</span>
                      <span className="text-white ml-2">{importJob.validation_summary.missing_required_fields}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Invalid Tax Amounts:</span>
                      <span className="text-white ml-2">{importJob.validation_summary.invalid_tax_amounts}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Invalid Dates:</span>
                      <span className="text-white ml-2">{importJob.validation_summary.invalid_dates}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Time Information */}
              <div className="flex justify-between text-xs text-slate-400 mt-4">
                {importJob.started_at && (
                  <span>Started: {new Date(importJob.started_at).toLocaleString()}</span>
                )}
                {importJob.completed_at && (
                  <span>Completed: {new Date(importJob.completed_at).toLocaleString()}</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CSVUploadProcessor;