import React, { useState, useEffect } from 'react';
import {
  Users,
  Upload,
  BarChart3,
  Settings,
  FileText,
  Download,
  Plus,
  Filter,
  Search,
  TrendingUp,
  Database,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw
} from 'lucide-react';
import TLCClientDashboard from '../components/tlc/TLCClientDashboard';
import TLCClientManager from '../components/tlc/TLCClientManager';
import CSVUploadProcessor from '../components/tlc/CSVUploadProcessor';
import {
  tlcClientService,
  CSVImportJob,
  TLCClientFilters
} from '../services/tlcClientService';

const TLCClientManagement: React.FC = () => {
  const [activeView, setActiveView] = useState<'dashboard' | 'clients' | 'upload' | 'reports'>('dashboard');
  const [clientCount, setClientCount] = useState(0);
  const [recentImports, setRecentImports] = useState<CSVImportJob[]>([]);
  const [filters, setFilters] = useState<TLCClientFilters>({});
  const [showQuickStats, setShowQuickStats] = useState(true);

  useEffect(() => {
    loadRecentImports();
  }, []);

  const loadRecentImports = async () => {
    // In production, would fetch recent imports from API
    const mockImports: CSVImportJob[] = [
      {
        id: 'import_1',
        filename: 'TARRANT_LOAD_28_MAR_2025.csv',
        file_size: 38690816,
        total_rows: 4532,
        processed_rows: 4532,
        successful_rows: 4480,
        failed_rows: 52,
        status: 'completed',
        progress_percentage: 100,
        started_at: new Date(Date.now() - 3600000).toISOString(),
        completed_at: new Date(Date.now() - 3300000).toISOString(),
        errors: [],
        validation_summary: {
          duplicate_clients: 12,
          invalid_emails: 23,
          missing_required_fields: 8,
          invalid_tax_amounts: 5,
          invalid_dates: 4
        }
      },
      {
        id: 'import_2',
        filename: 'HARRIS_COUNTY_UPDATES.csv',
        file_size: 24567890,
        total_rows: 3201,
        processed_rows: 2850,
        successful_rows: 2798,
        failed_rows: 52,
        status: 'processing',
        progress_percentage: 89.0,
        started_at: new Date(Date.now() - 600000).toISOString(),
        errors: [],
        validation_summary: {
          duplicate_clients: 8,
          invalid_emails: 15,
          missing_required_fields: 3,
          invalid_tax_amounts: 2,
          invalid_dates: 1
        }
      }
    ];
    
    setRecentImports(mockImports);
  };

  const handleUploadComplete = (job: CSVImportJob) => {
    setRecentImports(prev => [job, ...prev.slice(0, 4)]);
    
    // Automatically switch to clients view after successful upload
    if (job.status === 'completed') {
      setTimeout(() => {
        setActiveView('clients');
      }, 2000);
    }
  };

  const handleDataImported = (count: number) => {
    setClientCount(prev => prev + count);
  };

  const getImportStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-500';
      case 'processing': return 'text-blue-500';
      case 'failed': return 'text-red-500';
      case 'pending': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };

  const getImportStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle;
      case 'processing': return RefreshCw;
      case 'failed': return AlertCircle;
      case 'pending': return Clock;
      default: return FileText;
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Navigation Header */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div>
                <h1 className="text-2xl font-bold text-white">TLC Client Management</h1>
                <p className="text-slate-400">Comprehensive client data management and loan processing</p>
              </div>
              
              {clientCount > 0 && (
                <div className="flex items-center space-x-2 px-4 py-2 bg-blue-600/20 rounded-lg">
                  <Database className="w-5 h-5 text-blue-400" />
                  <span className="text-blue-400 font-medium">{clientCount.toLocaleString()} clients</span>
                </div>
              )}
            </div>

            <div className="flex space-x-1">
              <button
                onClick={() => setActiveView('dashboard')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  activeView === 'dashboard'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Dashboard</span>
              </button>
              
              <button
                onClick={() => setActiveView('clients')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  activeView === 'clients'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Clients</span>
              </button>

              <button
                onClick={() => setActiveView('upload')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  activeView === 'upload'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>Import Data</span>
              </button>

              <button
                onClick={() => setActiveView('reports')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  activeView === 'reports'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Reports</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      {showQuickStats && recentImports.length > 0 && (
        <div className="bg-slate-800/50 border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="text-sm">
                  <span className="text-slate-400">Recent Imports:</span>
                </div>
                
                {recentImports.slice(0, 3).map((importJob) => {
                  const StatusIcon = getImportStatusIcon(importJob.status);
                  return (
                    <div key={importJob.id} className="flex items-center space-x-2">
                      <StatusIcon className={`w-4 h-4 ${getImportStatusColor(importJob.status)} ${
                        importJob.status === 'processing' ? 'animate-spin' : ''
                      }`} />
                      <span className="text-slate-300 text-sm">{importJob.filename}</span>
                      <span className={`text-xs ${getImportStatusColor(importJob.status)}`}>
                        {importJob.status === 'processing' 
                          ? `${importJob.progress_percentage.toFixed(0)}%`
                          : importJob.status
                        }
                      </span>
                    </div>
                  );
                })}
              </div>
              
              <button
                onClick={() => setShowQuickStats(false)}
                className="text-slate-400 hover:text-white"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeView === 'dashboard' && (
          <TLCClientDashboard onClientCountUpdate={setClientCount} />
        )}

        {activeView === 'clients' && (
          <TLCClientManager 
            initialFilters={filters}
            showHeader={false}
          />
        )}

        {activeView === 'upload' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Data Import</h2>
                <p className="text-slate-400 mt-1">Upload and process CSV files containing client and tax data</p>
              </div>
            </div>

            <CSVUploadProcessor
              onUploadComplete={handleUploadComplete}
              onDataImported={handleDataImported}
            />

            {/* Recent Imports */}
            {recentImports.length > 0 && (
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4">Recent Imports</h3>
                <div className="space-y-4">
                  {recentImports.map((importJob) => {
                    const StatusIcon = getImportStatusIcon(importJob.status);
                    return (
                      <div key={importJob.id} className="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <StatusIcon className={`w-6 h-6 ${getImportStatusColor(importJob.status)} ${
                            importJob.status === 'processing' ? 'animate-spin' : ''
                          }`} />
                          <div>
                            <div className="font-medium text-white">{importJob.filename}</div>
                            <div className="text-sm text-slate-400">
                              {formatFileSize(importJob.file_size)} • {importJob.total_rows.toLocaleString()} rows
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-6">
                          <div className="text-center">
                            <div className="text-lg font-semibold text-green-400">
                              {importJob.successful_rows.toLocaleString()}
                            </div>
                            <div className="text-xs text-slate-400">Successful</div>
                          </div>
                          
                          {importJob.failed_rows > 0 && (
                            <div className="text-center">
                              <div className="text-lg font-semibold text-red-400">
                                {importJob.failed_rows.toLocaleString()}
                              </div>
                              <div className="text-xs text-slate-400">Failed</div>
                            </div>
                          )}
                          
                          <div className="text-center">
                            <div className={`text-lg font-semibold ${getImportStatusColor(importJob.status)}`}>
                              {importJob.status === 'processing' 
                                ? `${importJob.progress_percentage.toFixed(0)}%`
                                : importJob.status.toUpperCase()
                              }
                            </div>
                            <div className="text-xs text-slate-400">Status</div>
                          </div>

                          {importJob.completed_at && (
                            <div className="text-sm text-slate-400">
                              {new Date(importJob.completed_at).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeView === 'reports' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Reports & Analytics</h2>
                <p className="text-slate-400 mt-1">Generate detailed reports and analyze client data</p>
              </div>
              
              <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
                <span>New Report</span>
              </button>
            </div>

            {/* Report Templates */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Users className="w-6 h-6 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Client Portfolio Report</h3>
                </div>
                <p className="text-slate-400 mb-4">Comprehensive overview of all clients, statuses, and loan performance</p>
                <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors">
                  Generate Report
                </button>
              </div>

              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-green-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Performance Analytics</h3>
                </div>
                <p className="text-slate-400 mb-4">Loan approval rates, processing times, and profitability metrics</p>
                <button className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors">
                  Generate Report
                </button>
              </div>

              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <FileText className="w-6 h-6 text-yellow-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Tax Data Summary</h3>
                </div>
                <p className="text-slate-400 mb-4">Tax amounts, counties, and property valuation analysis</p>
                <button className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded transition-colors">
                  Generate Report
                </button>
              </div>

              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Download className="w-6 h-6 text-purple-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Data Export</h3>
                </div>
                <p className="text-slate-400 mb-4">Export client data in various formats for external analysis</p>
                <button className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors">
                  Export Data
                </button>
              </div>

              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-red-500/20 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Risk Assessment</h3>
                </div>
                <p className="text-slate-400 mb-4">Identify high-risk loans and potential default indicators</p>
                <button className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors">
                  Generate Report
                </button>
              </div>

              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-orange-500/20 rounded-lg">
                    <Settings className="w-6 h-6 text-orange-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Custom Report</h3>
                </div>
                <p className="text-slate-400 mb-4">Build custom reports with specific filters and metrics</p>
                <button className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors">
                  Create Custom
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TLCClientManagement;