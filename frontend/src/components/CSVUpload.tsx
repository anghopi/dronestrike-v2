import React, { useState, useRef } from 'react';
import { 
  DocumentArrowUpIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  XMarkIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

interface CSVRow {
  [key: string]: string;
}

interface CSVUploadProps {
  onDataParsed: (data: CSVRow[]) => void;
  onError?: (error: string) => void;
  sampleData?: CSVRow[];
  acceptedFormats?: string[];
  maxFileSize?: number; // in MB
}

const CSVUpload: React.FC<CSVUploadProps> = ({
  onDataParsed,
  onError,
  sampleData,
  acceptedFormats = ['.csv', '.txt'],
  maxFileSize = 10
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<CSVRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): CSVRow[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }

    const headers = lines[0].split(',').map(header => header.trim().replace(/"/g, ''));
    const rows: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(value => value.trim().replace(/"/g, ''));
      
      if (values.length === headers.length) {
        const row: CSVRow = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        rows.push(row);
      }
    }

    return rows;
  };

  const handleFile = async (file: File) => {
    setParseError(null);
    setUploading(true);

    // Validate file size
    if (file.size > maxFileSize * 1024 * 1024) {
      const error = `File size exceeds ${maxFileSize}MB limit`;
      setParseError(error);
      onError?.(error);
      setUploading(false);
      return;
    }

    // Validate file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedFormats.includes(fileExtension)) {
      const error = `File type not supported. Please upload: ${acceptedFormats.join(', ')}`;
      setParseError(error);
      onError?.(error);
      setUploading(false);
      return;
    }

    try {
      const text = await file.text();
      const data = parseCSV(text);
      
      setUploadedFile(file);
      setPreviewData(data.slice(0, 5)); // Show first 5 rows for preview
      setShowPreview(true);
      onDataParsed(data);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse CSV file';
      setParseError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setUploading(false);
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
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const clearFile = () => {
    setUploadedFile(null);
    setPreviewData([]);
    setShowPreview(false);
    setParseError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const loadSampleData = () => {
    if (sampleData && sampleData.length > 0) {
      setPreviewData(sampleData.slice(0, 5));
      setShowPreview(true);
      onDataParsed(sampleData);
      setUploadedFile(new File(['sample'], 'sample-data.csv', { type: 'text/csv' }));
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-500/10'
            : uploadedFile
            ? 'border-green-500 bg-green-500/10'
            : parseError
            ? 'border-red-500 bg-red-500/10'
            : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedFormats.join(',')}
          onChange={handleFileInput}
          className="hidden"
        />

        {uploading ? (
          <div className="space-y-3">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-slate-300">Processing file...</p>
          </div>
        ) : uploadedFile ? (
          <div className="space-y-3">
            <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto" />
            <p className="text-green-400 font-medium">{uploadedFile.name}</p>
            <p className="text-slate-400 text-sm">
              {previewData.length} records loaded
            </p>
            <button
              onClick={clearFile}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <XMarkIcon className="h-5 w-5 mx-auto" />
            </button>
          </div>
        ) : parseError ? (
          <div className="space-y-3">
            <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto" />
            <p className="text-red-400 font-medium">Upload Error</p>
            <p className="text-slate-400 text-sm">{parseError}</p>
            <button
              onClick={openFileDialog}
              className="btn-primary px-4 py-2"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <DocumentArrowUpIcon className="h-12 w-12 text-slate-400 mx-auto" />
            <div>
              <p className="text-slate-300 font-medium mb-2">
                Drag and drop your CSV file here, or click to browse
              </p>
              <p className="text-slate-500 text-sm">
                Supports {acceptedFormats.join(', ')} files up to {maxFileSize}MB
              </p>
            </div>
            
            <div className="flex flex-col md:flex-row gap-3 items-center justify-center">
              <button
                onClick={openFileDialog}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Choose File
              </button>
              
              {sampleData && sampleData.length > 0 && (
                <button
                  onClick={loadSampleData}
                  className="px-6 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm"
                >
                  Load Sample Data
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Preview Section */}
      {showPreview && previewData.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
              <EyeIcon className="h-5 w-5" />
              <span>Data Preview</span>
            </h3>
            <span className="text-slate-400 text-sm">
              Showing first {previewData.length} rows
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {Object.keys(previewData[0] || {}).slice(0, 6).map((header) => (
                    <th key={header} className="text-left py-2 px-3 text-slate-300 font-medium">
                      {header}
                    </th>
                  ))}
                  {Object.keys(previewData[0] || {}).length > 6 && (
                    <th className="text-left py-2 px-3 text-slate-400">...</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {previewData.map((row, index) => (
                  <tr key={index} className="border-b border-slate-700/50">
                    {Object.values(row).slice(0, 6).map((value, colIndex) => (
                      <td key={colIndex} className="py-2 px-3 text-slate-300 truncate max-w-32">
                        {value}
                      </td>
                    ))}
                    {Object.keys(row).length > 6 && (
                      <td className="py-2 px-3 text-slate-400">...</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CSVUpload;