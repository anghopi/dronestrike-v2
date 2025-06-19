import React, { useState } from 'react';
import { uploadService } from '../../services/api';

interface CSVUploadProps {
  type: 'leads' | 'properties';
  onUploadSuccess?: (result: { created_count: number; message: string }) => void;
  onUploadError?: (error: string) => void;
}

const CSVUpload: React.FC<CSVUploadProps> = ({ type, onUploadSuccess, onUploadError }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message: string;
    created_count: number;
    errors: string[];
  } | null>(null);

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      const error = 'Please select a CSV file';
      setUploadResult({ success: false, message: error, created_count: 0, errors: [error] });
      onUploadError?.(error);
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    try {
      const result = await uploadService.uploadCSV(file, type);
      setUploadResult(result);
      
      if (result.success) {
        onUploadSuccess?.(result);
      } else {
        onUploadError?.(result.message || 'Upload failed');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Upload failed';
      setUploadResult({ 
        success: false, 
        message: errorMessage, 
        created_count: 0, 
        errors: [errorMessage] 
      });
      onUploadError?.(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const getColumnExamples = () => {
    if (type === 'leads') {
      return [
        'first_name, last_name, email, phone, address, city, state, zip, status, score',
        'John, Doe, john@example.com, 555-1234, 123 Main St, Dallas, TX, 75001, new, 75'
      ];
    } else {
      return [
        'address, city, state, zip, county, value, market_value, bedrooms, bathrooms, sqft, year_built, taxes_due',
        '123 Oak St, Austin, TX, 78701, Travis, 250000, 275000, 3, 2, 1500, 2010, 3500'
      ];
    }
  };

  const examples = getColumnExamples();

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Upload {type === 'leads' ? 'Leads' : 'Properties'} CSV
        </h3>
        <p className="text-sm text-gray-600">
          Upload a CSV file to import {type} data. The file should contain the following columns:
        </p>
      </div>

      {/* Column Examples */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Expected CSV Format:</h4>
        <div className="space-y-2">
          <div className="text-xs font-mono bg-white p-2 rounded border overflow-x-auto">
            {examples[0]}
          </div>
          <div className="text-xs font-mono bg-white p-2 rounded border overflow-x-auto text-gray-600">
            {examples[1]}
          </div>
        </div>
      </div>

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="space-y-4">
          <div className="text-4xl text-gray-400">📁</div>
          <div>
            <label htmlFor="csv-file-input" className="cursor-pointer">
              <span className="text-blue-600 hover:text-blue-500 font-medium">
                Click to upload
              </span>
              <span className="text-gray-600"> or drag and drop</span>
            </label>
            <input
              id="csv-file-input"
              type="file"
              accept=".csv"
              onChange={handleInputChange}
              className="hidden"
              disabled={isUploading}
            />
          </div>
          <p className="text-sm text-gray-500">CSV files only</p>
          
          {isUploading && (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm text-gray-600">Processing...</span>
            </div>
          )}
        </div>
      </div>

      {/* Upload Result */}
      {uploadResult && (
        <div className={`mt-4 p-4 rounded-lg ${
          uploadResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className={`flex items-center space-x-2 ${
            uploadResult.success ? 'text-green-800' : 'text-red-800'
          }`}>
            <span className="text-lg">
              {uploadResult.success ? '✅' : '❌'}
            </span>
            <span className="font-medium">{uploadResult.message}</span>
          </div>
          
          {uploadResult.success && uploadResult.created_count > 0 && (
            <p className="text-green-700 text-sm mt-1">
              Successfully imported {uploadResult.created_count} records
            </p>
          )}
          
          {uploadResult.errors && uploadResult.errors.length > 0 && (
            <div className="mt-3">
              <p className="text-red-700 text-sm font-medium">Errors:</p>
              <ul className="text-red-600 text-xs mt-1 space-y-1 max-h-20 overflow-y-auto">
                {uploadResult.errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CSVUpload;