import React, { useState } from 'react';
import CSVUpload from '../components/advanced/CSVUpload';
import { notificationService } from '../services/notificationService';

const ImportPageSimple: React.FC = () => {
  const [uploadType, setUploadType] = useState<'leads' | 'properties'>('leads');
  const [uploadHistory, setUploadHistory] = useState<Array<{
    id: string;
    type: 'leads' | 'properties';
    fileName: string;
    recordCount: number;
    timestamp: Date;
    status: 'success' | 'error';
  }>>([]);

  const handleUploadSuccess = (result: { created_count: number; message: string }) => {
    notificationService.csvUploadSuccess(result.created_count, uploadType);
    
    // Add to upload history
    const newUpload = {
      id: Math.random().toString(36).substr(2, 9),
      type: uploadType,
      fileName: 'uploaded_file.csv', // We could enhance this to get the actual filename
      recordCount: result.created_count,
      timestamp: new Date(),
      status: 'success' as const
    };
    setUploadHistory(prev => [newUpload, ...prev]);
  };

  const handleUploadError = (error: string) => {
    notificationService.csvUploadError(error);
    
    // Add to upload history
    const newUpload = {
      id: Math.random().toString(36).substr(2, 9),
      type: uploadType,
      fileName: 'uploaded_file.csv',
      recordCount: 0,
      timestamp: new Date(),
      status: 'error' as const
    };
    setUploadHistory(prev => [newUpload, ...prev]);
  };

  const generateSampleCSV = (type: 'leads' | 'properties') => {
    if (type === 'leads') {
      const csvContent = `first_name,last_name,email,phone,address,city,state,zip,status,score
John,Doe,john.doe@example.com,555-1234,123 Main St,Dallas,TX,75001,new,85
Jane,Smith,jane.smith@example.com,555-5678,456 Oak Ave,Austin,TX,78701,contacted,92
Bob,Johnson,bob.johnson@example.com,555-9012,789 Pine Rd,Houston,TX,77001,qualified,78
Alice,Brown,alice.brown@example.com,555-3456,321 Elm St,San Antonio,TX,78201,new,65`;
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sample_leads.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } else {
      const csvContent = `address,city,state,zip,county,value,market_value,bedrooms,bathrooms,sqft,year_built,taxes_due
123 Oak St,Austin,TX,78701,Travis,250000,275000,3,2,1500,2010,3500
456 Pine Ave,Dallas,TX,75201,Dallas,350000,385000,4,3,2100,2015,4200
789 Elm Dr,Houston,TX,77001,Harris,180000,195000,2,1,900,2005,2800
321 Maple Ln,San Antonio,TX,78201,Bexar,220000,240000,3,2,1300,2008,3100`;
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sample_properties.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4">CSV Import Center</h1>
          <p className="text-gray-300 max-w-2xl mx-auto">
            Import leads and properties data from CSV files. Upload your data to quickly populate your DroneStrike database.
          </p>
        </div>

        {/* Upload Type Selector */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Select Data Type</h2>
          <div className="flex space-x-4">
            <button
              onClick={() => setUploadType('leads')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                uploadType === 'leads'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
               Leads
            </button>
            <button
              onClick={() => setUploadType('properties')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                uploadType === 'properties'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              🏠 Properties
            </button>
          </div>
        </div>

        {/* Sample CSV Download */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Need a Sample CSV?</h3>
              <p className="text-gray-300">
                Download a sample CSV file with the correct format for {uploadType}.
              </p>
            </div>
            <button
              onClick={() => generateSampleCSV(uploadType)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              📥 Download Sample
            </button>
          </div>
        </div>

        {/* CSV Upload Component */}
        <CSVUpload
          type={uploadType}
          onUploadSuccess={handleUploadSuccess}
          onUploadError={handleUploadError}
        />

        {/* Upload History */}
        {uploadHistory.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Upload History</h3>
            <div className="space-y-3">
              {uploadHistory.slice(0, 5).map((upload) => (
                <div
                  key={upload.id}
                  className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">
                      {upload.type === 'leads' ? '' : '🏠'}
                    </span>
                    <div>
                      <p className="text-white font-medium">
                        {upload.fileName} ({upload.type})
                      </p>
                      <p className="text-sm text-gray-400">
                        {upload.timestamp.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      upload.status === 'success' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {upload.status === 'success' ? '✅ Success' : '❌ Error'}
                    </div>
                    {upload.status === 'success' && (
                      <p className="text-sm text-gray-400 mt-1">
                        {upload.recordCount} records
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportPageSimple;