import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Plus,
  Settings,
  BookOpen,
  Download,
  Calendar,
  Filter,
  Eye,
  Edit,
  Trash2,
  Copy,
  Share,
  Star,
  Clock
} from 'lucide-react';
import AnalyticsDashboard from './AnalyticsDashboard';
import CustomReportBuilder from './CustomReportBuilder';
import {
  CustomReportData,
  AnalyticsTimeframe,
  analyticsService
} from '../../services/analyticsService';

const AnalyticsPage: React.FC = () => {
  const [activeView, setActiveView] = useState<'dashboard' | 'reports' | 'builder'>('dashboard');
  const [savedReports, setSavedReports] = useState<CustomReportData[]>([]);
  const [showReportBuilder, setShowReportBuilder] = useState(false);
  const [editingReport, setEditingReport] = useState<CustomReportData | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<AnalyticsTimeframe>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString(),
    period: 'day'
  });

  useEffect(() => {
    loadSavedReports();
  }, []);

  const loadSavedReports = () => {
    // In production, this would load from API/localStorage
    const mockReports: CustomReportData[] = [
      {
        id: 'report_1',
        name: 'Monthly Performance Review',
        description: 'Comprehensive monthly performance analysis',
        type: 'performance',
        filters: {
          date_range: {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString(),
            period: 'month'
          },
          counties: ['Harris', 'Montgomery']
        },
        metrics: ['mission_completion_rate', 'agent_utilization_rate', 'route_efficiency_score'],
        chart_type: 'line',
        created_at: '2024-01-01T00:00:00Z',
        last_updated: '2024-01-15T10:30:00Z'
      },
      {
        id: 'report_2',
        name: 'Agent Performance Comparison',
        description: 'Compare individual agent metrics',
        type: 'agent',
        filters: {
          date_range: {
            start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString(),
            period: 'day'
          },
          agents: ['agent-001', 'agent-002', 'agent-003']
        },
        metrics: ['individual_performance', 'productivity_comparison', 'workload_distribution'],
        chart_type: 'bar',
        created_at: '2024-01-05T00:00:00Z',
        last_updated: '2024-01-15T14:20:00Z'
      },
      {
        id: 'report_3',
        name: 'Revenue Analysis by County',
        description: 'Geographic revenue distribution and trends',
        type: 'financial',
        filters: {
          date_range: {
            start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString(),
            period: 'month'
          },
          counties: ['Harris', 'Montgomery', 'Fort Bend', 'Galveston']
        },
        metrics: ['revenue_by_county', 'profit_margin', 'cost_breakdown'],
        chart_type: 'map',
        created_at: '2024-01-10T00:00:00Z',
        last_updated: '2024-01-15T16:45:00Z'
      }
    ];

    setSavedReports(mockReports);
  };

  const handleSaveReport = (report: CustomReportData) => {
    if (editingReport) {
      // Update existing report
      setSavedReports(prev => prev.map(r => r.id === report.id ? report : r));
    } else {
      // Add new report
      setSavedReports(prev => [...prev, report]);
    }
    
    setShowReportBuilder(false);
    setEditingReport(null);
  };

  const handleEditReport = (report: CustomReportData) => {
    setEditingReport(report);
    setShowReportBuilder(true);
  };

  const handleDeleteReport = (reportId: string) => {
    if (confirm('Are you sure you want to delete this report?')) {
      setSavedReports(prev => prev.filter(r => r.id !== reportId));
    }
  };

  const handleDuplicateReport = (report: CustomReportData) => {
    const duplicatedReport: CustomReportData = {
      ...report,
      id: `report_${Date.now()}`,
      name: `${report.name} (Copy)`,
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString()
    };
    setSavedReports(prev => [...prev, duplicatedReport]);
  };

  const generateReport = async (report: CustomReportData) => {
    try {
      const reportData = await analyticsService.generateCustomReport(report);
      // In production, this would open the report in a new view or download it
      console.log('Generated report:', reportData);
      alert(`Report "${report.name}" generated successfully!`);
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('Failed to generate report. Please try again.');
    }
  };

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case 'performance': return BarChart3;
      case 'financial': return BarChart3;
      case 'operational': return Settings;
      case 'agent': return BarChart3;
      case 'geographic': return BarChart3;
      default: return BarChart3;
    }
  };

  const getReportTypeColor = (type: string) => {
    switch (type) {
      case 'performance': return 'text-blue-500 bg-blue-500/20';
      case 'financial': return 'text-green-500 bg-green-500/20';
      case 'operational': return 'text-purple-500 bg-purple-500/20';
      case 'agent': return 'text-yellow-500 bg-yellow-500/20';
      case 'geographic': return 'text-red-500 bg-red-500/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Navigation */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
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
                onClick={() => setActiveView('reports')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  activeView === 'reports'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Custom Reports</span>
              </button>
            </div>

            {activeView === 'reports' && (
              <button
                onClick={() => setShowReportBuilder(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>New Report</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      {activeView === 'dashboard' && (
        <AnalyticsDashboard timeframe={selectedTimeframe} />
      )}

      {activeView === 'reports' && (
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white">Custom Reports</h1>
              <p className="text-slate-300 mt-1">Create and manage personalized analytics reports</p>
            </div>
            <div className="text-slate-400">
              {savedReports.length} report{savedReports.length !== 1 ? 's' : ''} saved
            </div>
          </div>

          {savedReports.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Custom Reports</h3>
              <p className="text-slate-400 mb-6">Create your first custom report to get started</p>
              <button
                onClick={() => setShowReportBuilder(true)}
                className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors mx-auto"
              >
                <Plus className="w-5 h-5" />
                <span>Create Report</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {savedReports.map((report) => {
                const TypeIcon = getReportTypeIcon(report.type);
                const typeColorClass = getReportTypeColor(report.type);
                
                return (
                  <div key={report.id} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-2 rounded-lg ${typeColorClass}`}>
                          <TypeIcon className="w-5 h-5" />
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleEditReport(report)}
                            className="p-1 text-slate-400 hover:text-white transition-colors"
                            title="Edit Report"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDuplicateReport(report)}
                            className="p-1 text-slate-400 hover:text-white transition-colors"
                            title="Duplicate Report"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteReport(report.id)}
                            className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                            title="Delete Report"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <h3 className="text-lg font-semibold text-white mb-2">{report.name}</h3>
                      <p className="text-slate-400 text-sm mb-4 line-clamp-2">{report.description}</p>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">Type:</span>
                          <span className="text-white capitalize">{report.type}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">Metrics:</span>
                          <span className="text-white">{report.metrics.length}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">Chart:</span>
                          <span className="text-white capitalize">{report.chart_type}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">Updated:</span>
                          <span className="text-white">
                            {new Date(report.last_updated).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        <button
                          onClick={() => generateReport(report)}
                          className="flex-1 flex items-center justify-center space-x-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Generate</span>
                        </button>
                        <button
                          onClick={() => handleEditReport(report)}
                          className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Report Builder Modal */}
      {showReportBuilder && (
        <CustomReportBuilder
          onSave={handleSaveReport}
          onCancel={() => {
            setShowReportBuilder(false);
            setEditingReport(null);
          }}
          existingReport={editingReport || undefined}
        />
      )}
    </div>
  );
};

export default AnalyticsPage;