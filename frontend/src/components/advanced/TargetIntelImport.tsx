import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { csvService, FieldMapping, CSVParseResult } from '../../services/csvService';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { 
  ArrowUpTrayIcon as Upload, 
  DocumentTextIcon as FileText, 
  CheckCircleIcon as CheckCircle, 
  ExclamationTriangleIcon as AlertCircle, 
  ArrowDownTrayIcon as Download, 
  XMarkIcon as X,
  ViewfinderCircleIcon as Target 
} from '@heroicons/react/24/outline';

interface TargetIntelImportProps {
  operationType: 'target' | 'property';
  onIntelProcessed: (data: any[]) => Promise<void>;
  onMissionAbort: () => void;
  predefinedIntelFields?: FieldMapping[];
}

interface ImportData {
  headers: string[];
  preview: any[];
  totalRecords: number;
  errors: any[];
}

const FIELD_OPTIONS = {
  target: [
    { value: 'full_name', label: 'Full Name *', required: true },
    { value: 'email', label: 'Email' },
    { value: 'phone_cell', label: 'Phone' },
    { value: 'mailing_address1', label: 'Address' },
    { value: 'mailing_city', label: 'City' },
    { value: 'mailing_state', label: 'State' },
    { value: 'mailing_zipcode', label: 'ZIP Code' },
    { value: 'workflow_stage', label: 'Status' }
  ],
  property: [
    { value: 'address1', label: 'Address *', required: true },
    { value: 'city', label: 'City *', required: true },
    { value: 'state', label: 'State *', required: true },
    { value: 'zip_code', label: 'ZIP Code *', required: true },
    { value: 'property_type', label: 'Property Type' },
    { value: 'market_value', label: 'Market Value' }
  ]
};

export const TargetIntelImport: React.FC<TargetIntelImportProps> = ({
  operationType,
  onIntelProcessed,
  onMissionAbort,
  predefinedIntelFields
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<ImportData | null>(null);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [validationResults, setValidationResults] = useState<{
    valid: any[];
    invalid: Array<{row: any; errors: string[]; index: number}>;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const steps = [
    { id: 0, title: 'Upload File', completed: !!file },
    { id: 1, title: 'Map Fields', completed: fieldMappings.length > 0 && currentStep > 1 },
    { id: 2, title: 'Validate Data', completed: !!validationResults && currentStep > 2 },
    { id: 3, title: 'Complete Import', completed: currentStep > 3 }
  ];

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const selectedFile = acceptedFiles[0];
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      alert('Please select a CSV file');
      return;
    }

    setFile(selectedFile);
    setIsProcessing(true);

    try {
      // For initial parsing, just get headers and a small sample
      const result = await csvService.parseCSVFile(selectedFile, [], { 
        skipFirstRow: false,
        maxFileSize: 500 * 1024 * 1024 // 500MB max for large files
      });
      
      const headers = result.meta.fields || Object.keys(result.data[0] || {});
      const data: ImportData = {
        headers,
        preview: result.data.slice(0, 5), // Show more preview rows
        totalRecords: result.data.length,
        errors: result.errors || []
      };
      
      setImportData(data);
      autoMapFields(headers);
      setCurrentStep(1);
    } catch (error: any) {
      alert(`File parsing failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
    maxSize: 500 * 1024 * 1024 // 500MB for large datasets
  });

  const autoMapFields = (headers: string[]) => {
    const fieldOptions = FIELD_OPTIONS[operationType];
    const mappings: FieldMapping[] = [];
    
    headers.forEach(header => {
      const field = fieldOptions.find(option => 
        header.toLowerCase().includes(option.label.toLowerCase().replace(' *', '')) ||
        option.label.toLowerCase().replace(' *', '').includes(header.toLowerCase())
      );
      
      if (field) {
        mappings.push({
          csvField: header,
          targetField: field.value,
          required: field.required || false
        });
      }
    });
    
    setFieldMappings(mappings);
  };

  const validateData = async () => {
    if (!file || !fieldMappings.length) return;

    setIsProcessing(true);
    try {
      const result = await csvService.parseCSVFile(file, fieldMappings, { skipFirstRow: true });
      const validation = csvService.validateCSVData(result.data, fieldMappings);
      
      setValidationResults({
        valid: validation.validRows,
        invalid: validation.invalidRows
      });
      setCurrentStep(2);
    } catch (error: any) {
      alert(`Validation failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const executeImport = async () => {
    if (!validationResults?.valid.length) return;

    setIsProcessing(true);
    try {
      await onIntelProcessed(validationResults.valid);
      setCurrentStep(3);
    } catch (error: any) {
      alert(`Import failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderStepProgress = () => (
    <div className="flex items-center justify-between mb-6 px-2">
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              step.completed 
                ? 'bg-green-600 text-white' 
                : currentStep === step.id 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-600'
            }`}>
              {step.completed ? '✓' : step.id + 1}
            </div>
            <span className="text-xs mt-1 text-center max-w-16">{step.title}</span>
          </div>
          {index < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 ${step.completed ? 'bg-green-600' : 'bg-gray-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const renderUploadStep = () => (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm font-medium text-gray-700">
          {isDragActive ? 'Drop your CSV file here' : 'Drag & drop CSV file or click to browse'}
        </p>
        <p className="text-xs text-gray-500 mt-1">Maximum file size: 500MB • Supports large datasets</p>
      </div>
      
      {file && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-green-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800">{file.name}</p>
              <p className="text-xs text-green-600">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderMappingStep = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Target className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-blue-900">Field Mapping Configuration</h3>
        </div>
        <p className="text-sm text-blue-800">
          Map your CSV columns to system fields. Required fields are marked with *.
        </p>
      </div>
      
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          Available CSV Columns ({importData?.headers.length || 0})
        </h4>
        
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
          {importData?.headers.map((header, index) => {
            const currentMapping = fieldMappings.find(m => m.csvField === header);
            const selectedField = FIELD_OPTIONS[operationType].find(f => f.value === currentMapping?.targetField);
            
            return (
              <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-900 mb-1">
                    CSV Column:
                  </label>
                  <div className="bg-white px-3 py-2 rounded-md border border-gray-300 text-sm font-mono text-gray-700">
                    {header}
                  </div>
                </div>
                
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-900 mb-1">
                    Map to System Field:
                  </label>
                  <Select
                    value={currentMapping?.targetField || ''}
                    onValueChange={(value) => {
                      setFieldMappings(prev => {
                        const filtered = prev.filter(m => m.csvField !== header);
                        if (value) {
                          const fieldOption = FIELD_OPTIONS[operationType].find(f => f.value === value);
                          return [...filtered, { 
                            csvField: header, 
                            targetField: value, 
                            required: fieldOption?.required || false 
                          }];
                        }
                        return filtered;
                      });
                    }}
                  >
                    <SelectTrigger className={`h-10 ${currentMapping ? 'border-green-300 bg-green-50' : 'border-gray-300'}`}>
                      <SelectValue placeholder="Select field..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Skip this field</SelectItem>
                      {FIELD_OPTIONS[operationType].map(field => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedField?.required && (
                    <span className="text-xs text-orange-600 mt-1 font-medium">
                      ⚠️ Required field
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {importData && (
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-600" />
            Data Preview (first {importData.preview.length} of {importData.totalRecords.toLocaleString()} rows)
          </h4>
          <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {importData.headers.map(header => {
                    const isMapped = fieldMappings.some(m => m.csvField === header);
                    return (
                      <th key={header} className={`text-left p-3 font-semibold ${
                        isMapped ? 'text-green-700 bg-green-50' : 'text-gray-700'
                      }`}>
                        {header}
                        {isMapped && <span className="ml-1 text-green-600">✓</span>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {importData.preview.map((row: any, index: number) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    {importData.headers.map(header => {
                      const isMapped = fieldMappings.some(m => m.csvField === header);
                      return (
                        <td key={header} className={`p-3 truncate max-w-32 ${
                          isMapped ? 'bg-green-50/50' : ''
                        }`}>
                          <span className="font-mono text-gray-700">
                            {row[header] || '-'}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const renderValidationStep = () => (
    <div className="space-y-6">
      {validationResults && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 text-center shadow-sm">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-3" />
              <p className="text-2xl font-bold text-green-700 mb-1">{validationResults.valid.length.toLocaleString()}</p>
              <p className="text-sm text-green-600 font-medium">Valid records ready for import</p>
              {validationResults.valid.length > 0 && (
                <div className="mt-2 text-xs text-green-600">
                  ✓ All required fields present
                </div>
              )}
            </div>
            
            <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-xl p-6 text-center shadow-sm">
              <AlertCircle className="h-8 w-8 text-red-600 mx-auto mb-3" />
              <p className="text-2xl font-bold text-red-700 mb-1">{validationResults.invalid.length.toLocaleString()}</p>
              <p className="text-sm text-red-600 font-medium">Records with issues</p>
              {validationResults.invalid.length > 0 && (
                <div className="mt-2 text-xs text-red-600">
                  ⚠️ Will be skipped during import
                </div>
              )}
            </div>
          </div>

          {validationResults.invalid.length > 0 && (
            <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Validation Issues Found:
              </h4>
              <div className="max-h-48 overflow-y-auto bg-white rounded-lg border border-red-200 p-3">
                <div className="space-y-2 text-xs">
                  {validationResults.invalid.slice(0, 10).map((item, index) => (
                    <div key={index} className="flex items-start gap-2 p-2 bg-red-50 rounded border border-red-100">
                      <span className="font-medium text-red-800 min-w-0 flex-shrink-0">Row {item.index + 2}:</span>
                      <span className="text-red-700">{item.errors.join(', ')}</span>
                    </div>
                  ))}
                  {validationResults.invalid.length > 10 && (
                    <div className="text-center p-2 bg-red-100 rounded border border-red-200">
                      <p className="font-medium text-red-800">
                        ...and {validationResults.invalid.length - 10} more issues
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {validationResults.valid.length > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Ready for Import:
              </h4>
              <p className="text-sm text-blue-700">
                {validationResults.valid.length.toLocaleString()} {operationType === 'target' ? 'leads' : 'properties'} will be imported into your system.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderSuccessStep = () => (
    <div className="text-center py-6">
      <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
      <h3 className="text-lg font-medium text-green-800 mb-2">Import Successful!</h3>
      <p className="text-sm text-gray-600">
        {validationResults?.valid.length} {operationType === 'target' ? 'leads' : 'properties'} have been imported.
      </p>
    </div>
  );

  return (
    <div className="bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Import {operationType === 'target' ? 'Leads' : 'Properties'}
          </h2>
          <p className="text-sm text-gray-600">
            Upload and configure your CSV import
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onMissionAbort}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="p-4">
        {renderStepProgress()}
        
        <div className="mb-6">
          {currentStep === 0 && renderUploadStep()}
          {currentStep === 1 && renderMappingStep()}
          {currentStep === 2 && renderValidationStep()}
          {currentStep === 3 && renderSuccessStep()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200 rounded-b-xl">
          <div>
            {currentStep > 0 && currentStep < 3 && (
              <Button 
                variant="outline" 
                size="default"
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="flex items-center gap-2 px-6 py-2.5 bg-white hover:bg-gray-50 border-gray-300 text-gray-700 font-medium"
              >
                ← Back
              </Button>
            )}
          </div>
          
          <div className="flex gap-3">
            {currentStep === 0 && file && (
              <Button 
                size="default" 
                onClick={() => setCurrentStep(1)}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center gap-2"
              >
                Next: Map Fields →
              </Button>
            )}
            
            {currentStep === 1 && fieldMappings.length > 0 && (
              <Button 
                size="default" 
                onClick={validateData} 
                disabled={isProcessing}
                className="px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Validating...
                  </>
                ) : (
                  <>
                    ✓ Validate Data
                  </>
                )}
              </Button>
            )}
            
            {currentStep === 2 && validationResults && (
              <Button 
                size="default" 
                onClick={executeImport} 
                disabled={isProcessing || validationResults.valid.length === 0}
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-medium flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Importing...
                  </>
                ) : (
                  <>
                    ⚡ Import {validationResults.valid.length} Records
                  </>
                )}
              </Button>
            )}
            
            {currentStep === 3 && (
              <Button 
                size="default" 
                onClick={onMissionAbort}
                className="px-6 py-2.5 bg-gray-600 hover:bg-gray-700 text-white font-medium"
              >
                ✓ Close
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TargetIntelImport;