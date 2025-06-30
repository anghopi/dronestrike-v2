import React, { useState } from 'react';
import {
  Plus,
  Save,
  Play,
  BarChart3,
  LineChart,
  PieChart,
  Map,
  Table,
  Calendar,
  Filter,
  Users,
  MapPin,
  Target as TargetIcon,
  DollarSign,
  Settings,
  X,
  Copy,
  Eye
} from 'lucide-react';
import {
  CustomReportData,
  AnalyticsTimeframe,
  analyticsService
} from '../../services/analyticsService';

interface CustomReportBuilderProps {
  onSave: (report: CustomReportData) => void;
  onCancel: () => void;
  existingReport?: CustomReportData;
}

const CustomReportBuilder: React.FC<CustomReportBuilderProps> = ({
  onSave,
  onCancel,
  existingReport
}) => {
  const [reportConfig, setReportConfig] = useState<CustomReportData>(
    existingReport || {
      id: `report_${Date.now()}`,
      name: '',
      description: '',
      type: 'performance',
      filters: {
        date_range: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
          period: 'day'
        },
        agents: [],
        counties: [],
        mission_types: [],
        priorities: []
      },
      metrics: [],
      chart_type: 'line',
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString()
    }
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [activeStep, setActiveStep] = useState(0);

  const reportTypes = [
    { key: 'performance', label: 'Performance Analysis', icon: BarChart3, description: 'Mission and agent performance metrics' },
    { key: 'financial', label: 'Financial Report', icon: DollarSign, description: 'Revenue, costs, and profitability analysis' },
    { key: 'operational', label: 'Operational Metrics', icon: Settings, description: 'Efficiency and operational KPIs' },
    { key: 'agent', label: 'Agent Analytics', icon: Users, description: 'Individual agent performance and comparison' },
    { key: 'geographic', label: 'Geographic Analysis', icon: MapPin, description: 'Location-based performance insights' }
  ];

  const chartTypes = [
    { key: 'line', label: 'Line Chart', icon: LineChart, description: 'Time series and trend analysis' },
    { key: 'bar', label: 'Bar Chart', icon: BarChart3, description: 'Comparison and categorical data' },
    { key: 'pie', label: 'Pie Chart', icon: PieChart, description: 'Proportional data visualization' },
    { key: 'area', label: 'Area Chart', icon: LineChart, description: 'Cumulative trends over time' },
    { key: 'table', label: 'Data Table', icon: Table, description: 'Detailed tabular data' },
    { key: 'map', label: 'Geographic Map', icon: Map, description: 'Location-based visualization' }
  ];

  const availableMetrics = {
    performance: [
      'mission_completion_rate',
      'average_completion_time',
      'agent_utilization_rate',
      'route_efficiency_score',
      'success_rate_by_priority',
      'decline_rate_analysis'
    ],
    financial: [
      'total_revenue',
      'revenue_per_mission',
      'cost_per_mission',
      'profit_margin',
      'roi_percentage',
      'revenue_by_county'
    ],
    operational: [
      'missions_per_day',
      'average_travel_distance',
      'fuel_efficiency',
      'vehicle_utilization',
      'response_time',
      'territory_coverage'
    ],
    agent: [
      'individual_performance',
      'productivity_comparison',
      'skill_assessment',
      'training_effectiveness',
      'workload_distribution',
      'performance_trends'
    ],
    geographic: [
      'county_performance',
      'regional_comparison',
      'market_penetration',
      'travel_patterns',
      'territory_optimization',
      'geographic_revenue'
    ]
  };

  const handleReportTypeChange = (type: string) => {
    setReportConfig(prev => ({
      ...prev,
      type: type as any,
      metrics: [] // Reset metrics when type changes
    }));
  };

  const handleMetricToggle = (metric: string) => {
    setReportConfig(prev => ({
      ...prev,
      metrics: prev.metrics.includes(metric)
        ? prev.metrics.filter(m => m !== metric)
        : [...prev.metrics, metric]
    }));
  };

  const handleFilterChange = (filterType: string, value: any) => {
    setReportConfig(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        [filterType]: value
      }
    }));
  };

  const handleDateRangeChange = (start: string, end: string, period: string) => {
    setReportConfig(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        date_range: { start, end, period: period as any }
      }
    }));
  };

  const generatePreview = async () => {
    setIsGenerating(true);
    try {
      const preview = await analyticsService.generateCustomReport(reportConfig);
      setPreviewData(preview);
    } catch (error) {
      console.error('Failed to generate preview:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    const updatedReport = {
      ...reportConfig,
      last_updated: new Date().toISOString()
    };
    onSave(updatedReport);
  };

  const steps = [
    { title: 'Report Type', description: 'Choose the type of analysis' },
    { title: 'Metrics', description: 'Select metrics to include' },
    { title: 'Filters', description: 'Configure data filters' },
    { title: 'Visualization', description: 'Choose chart type' },
    { title: 'Preview', description: 'Review and save' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className="text-2xl font-bold text-white">Custom Report Builder</h2>
            <p className="text-slate-300 text-sm mt-1">Create personalized analytics reports</p>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex h-[calc(90vh-120px)]">
          {/* Steps Sidebar */}
          <div className="w-64 bg-slate-900 p-6 border-r border-slate-700">
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div
                  key={index}
                  className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    activeStep === index
                      ? 'bg-blue-600 text-white'
                      : activeStep > index
                      ? 'bg-green-600/20 text-green-400'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                  onClick={() => setActiveStep(index)}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    activeStep === index
                      ? 'bg-white text-blue-600'
                      : activeStep > index
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-600 text-white'
                  }`}>
                    {activeStep > index ? '✓' : index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{step.title}</div>
                    <div className="text-xs opacity-75">{step.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* Step 0: Report Type */}
            {activeStep === 0 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Report Information</h3>
                  <p className="text-slate-300 mb-6">Provide basic information about your report</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Report Name</label>
                    <input
                      type="text"
                      value={reportConfig.name}
                      onChange={(e) => setReportConfig(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Monthly Performance Review"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                    <input
                      type="text"
                      value={reportConfig.description}
                      onChange={(e) => setReportConfig(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Brief description of the report"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-medium text-white mb-4">Report Type</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {reportTypes.map((type) => {
                      const Icon = type.icon;
                      return (
                        <div
                          key={type.key}
                          className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            reportConfig.type === type.key
                              ? 'border-blue-500 bg-blue-500/10'
                              : 'border-slate-600 hover:border-slate-500'
                          }`}
                          onClick={() => handleReportTypeChange(type.key)}
                        >
                          <div className="flex items-center space-x-3 mb-2">
                            <div className={`p-2 rounded-lg ${
                              reportConfig.type === type.key
                                ? 'bg-blue-500/20'
                                : 'bg-slate-700'
                            }`}>
                              <Icon className={`w-5 h-5 ${
                                reportConfig.type === type.key
                                  ? 'text-blue-400'
                                  : 'text-slate-400'
                              }`} />
                            </div>
                            <h5 className="font-medium text-white">{type.label}</h5>
                          </div>
                          <p className="text-sm text-slate-400">{type.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Metrics Selection */}
            {activeStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Select Metrics</h3>
                  <p className="text-slate-300 mb-6">Choose the metrics to include in your {reportConfig.type} report</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availableMetrics[reportConfig.type]?.map((metric) => (
                    <label
                      key={metric}
                      className="flex items-center space-x-3 p-3 bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-600 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={reportConfig.metrics.includes(metric)}
                        onChange={() => handleMetricToggle(metric)}
                        className="rounded border-slate-500 bg-slate-600 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-white">
                        {metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </label>
                  ))}
                </div>

                {reportConfig.metrics.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <TargetIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Select at least one metric to continue</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Filters */}
            {activeStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Configure Filters</h3>
                  <p className="text-slate-300 mb-6">Set up data filters to focus your analysis</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Date Range */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Date Range</label>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="date"
                          value={reportConfig.filters.date_range.start.split('T')[0]}
                          onChange={(e) => {
                            const newStart = new Date(e.target.value).toISOString();
                            handleDateRangeChange(newStart, reportConfig.filters.date_range.end, reportConfig.filters.date_range.period);
                          }}
                          className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                        />
                        <input
                          type="date"
                          value={reportConfig.filters.date_range.end.split('T')[0]}
                          onChange={(e) => {
                            const newEnd = new Date(e.target.value).toISOString();
                            handleDateRangeChange(reportConfig.filters.date_range.start, newEnd, reportConfig.filters.date_range.period);
                          }}
                          className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                        />
                      </div>
                      <select
                        value={reportConfig.filters.date_range.period}
                        onChange={(e) => handleDateRangeChange(
                          reportConfig.filters.date_range.start,
                          reportConfig.filters.date_range.end,
                          e.target.value
                        )}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                      >
                        <option value="day">Daily</option>
                        <option value="week">Weekly</option>
                        <option value="month">Monthly</option>
                        <option value="quarter">Quarterly</option>
                        <option value="year">Yearly</option>
                      </select>
                    </div>
                  </div>

                  {/* Counties Filter */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Counties</label>
                    <div className="max-h-32 overflow-y-auto bg-slate-700 border border-slate-600 rounded p-2">
                      {['Harris', 'Montgomery', 'Fort Bend', 'Galveston', 'Brazoria'].map(county => (
                        <label key={county} className="flex items-center space-x-2 py-1">
                          <input
                            type="checkbox"
                            checked={reportConfig.filters.counties?.includes(county) || false}
                            onChange={(e) => {
                              const counties = reportConfig.filters.counties || [];
                              const newCounties = e.target.checked
                                ? [...counties, county]
                                : counties.filter(c => c !== county);
                              handleFilterChange('counties', newCounties);
                            }}
                            className="rounded border-slate-500 bg-slate-600 text-blue-600"
                          />
                          <span className="text-white text-sm">{county}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Chart Type */}
            {activeStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Choose Visualization</h3>
                  <p className="text-slate-300 mb-6">Select how you want to display your data</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {chartTypes.map((chart) => {
                    const Icon = chart.icon;
                    return (
                      <div
                        key={chart.key}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          reportConfig.chart_type === chart.key
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-slate-600 hover:border-slate-500'
                        }`}
                        onClick={() => setReportConfig(prev => ({ ...prev, chart_type: chart.key as any }))}
                      >
                        <div className="flex items-center space-x-3 mb-2">
                          <div className={`p-2 rounded-lg ${
                            reportConfig.chart_type === chart.key
                              ? 'bg-blue-500/20'
                              : 'bg-slate-700'
                          }`}>
                            <Icon className={`w-5 h-5 ${
                              reportConfig.chart_type === chart.key
                                ? 'text-blue-400'
                                : 'text-slate-400'
                            }`} />
                          </div>
                          <h5 className="font-medium text-white">{chart.label}</h5>
                        </div>
                        <p className="text-sm text-slate-400">{chart.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 4: Preview */}
            {activeStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Report Preview</h3>
                  <p className="text-slate-300 mb-6">Review your report configuration and generate a preview</p>
                </div>

                <div className="bg-slate-700 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Report Name:</span>
                    <span className="text-white font-medium">{reportConfig.name || 'Untitled Report'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Type:</span>
                    <span className="text-white">{reportConfig.type}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Metrics:</span>
                    <span className="text-white">{reportConfig.metrics.length} selected</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Chart Type:</span>
                    <span className="text-white">{reportConfig.chart_type}</span>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <button
                    onClick={generatePreview}
                    disabled={isGenerating || reportConfig.metrics.length === 0}
                    className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    {isGenerating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        <span>Generate Preview</span>
                      </>
                    )}
                  </button>
                </div>

                {previewData && (
                  <div className="bg-slate-700 rounded-lg p-6">
                    <h4 className="text-lg font-medium text-white mb-4">Preview</h4>
                    <div className="text-slate-300">
                      <p>Report preview would be displayed here with actual chart visualization</p>
                      <p className="text-sm mt-2">Generated at: {new Date(previewData.generated_at).toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-700">
          <div className="flex space-x-3">
            <button
              onClick={onCancel}
              className="px-6 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>

          <div className="flex space-x-3">
            {activeStep > 0 && (
              <button
                onClick={() => setActiveStep(activeStep - 1)}
                className="px-6 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                Previous
              </button>
            )}
            
            {activeStep < steps.length - 1 ? (
              <button
                onClick={() => setActiveStep(activeStep + 1)}
                disabled={
                  (activeStep === 0 && !reportConfig.name) ||
                  (activeStep === 1 && reportConfig.metrics.length === 0)
                }
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={!reportConfig.name || reportConfig.metrics.length === 0}
                className="flex items-center space-x-2 px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded-lg transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>Save Report</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomReportBuilder;