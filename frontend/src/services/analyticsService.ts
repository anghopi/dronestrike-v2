// Advanced Analytics and Reporting Service
// Comprehensive analytics for mission performance, agent productivity, and business metrics

import { Agent } from './missionDistributionService';
import { Mission } from '../types/mission';
import { Target } from '../types/target';

export interface AnalyticsTimeframe {
  start: string;
  end: string;
  period: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
}

export interface PerformanceMetrics {
  mission_completion_rate: number;
  average_completion_time: number;
  agent_utilization_rate: number;
  target_conversion_rate: number;
  route_efficiency_score: number;
  cost_per_mission: number;
  revenue_per_mission: number;
  roi_percentage: number;
}

export interface AgentPerformanceData {
  agent_id: string;
  agent_name: string;
  missions_completed: number;
  missions_assigned: number;
  completion_rate: number;
  average_time: number;
  distance_traveled: number;
  success_rate: number;
  decline_rate: number;
  productivity_score: number;
  revenue_generated: number;
  ranking: number;
}

export interface MissionAnalytics {
  total_missions: number;
  completed_missions: number;
  failed_missions: number;
  pending_missions: number;
  average_duration: number;
  success_rate: number;
  geographic_distribution: Array<{
    county: string;
    count: number;
    success_rate: number;
  }>;
  priority_breakdown: Array<{
    priority: string;
    count: number;
    completion_rate: number;
  }>;
  daily_trends: Array<{
    date: string;
    missions: number;
    completions: number;
    efficiency: number;
  }>;
}

export interface RevenueAnalytics {
  total_revenue: number;
  revenue_growth: number;
  cost_breakdown: {
    agent_costs: number;
    operational_costs: number;
    technology_costs: number;
    overhead_costs: number;
  };
  profit_margin: number;
  revenue_by_county: Array<{
    county: string;
    revenue: number;
    profit: number;
  }>;
  monthly_trends: Array<{
    month: string;
    revenue: number;
    costs: number;
    profit: number;
  }>;
}

export interface CustomReportData {
  id: string;
  name: string;
  description: string;
  type: 'performance' | 'financial' | 'operational' | 'agent' | 'geographic';
  filters: {
    date_range: AnalyticsTimeframe;
    agents?: string[];
    counties?: string[];
    mission_types?: string[];
    priorities?: string[];
  };
  metrics: string[];
  chart_type: 'line' | 'bar' | 'pie' | 'area' | 'table' | 'map';
  created_at: string;
  last_updated: string;
}

export interface AnalyticsDashboardData {
  overview: PerformanceMetrics;
  missions: MissionAnalytics;
  agents: AgentPerformanceData[];
  revenue: RevenueAnalytics;
  geographic_data: Array<{
    county: string;
    lat: number;
    lng: number;
    missions: number;
    success_rate: number;
    revenue: number;
  }>;
  real_time_metrics: {
    active_agents: number;
    ongoing_missions: number;
    completion_rate_today: number;
    efficiency_score: number;
  };
}

export interface ComparisonAnalytics {
  current_period: PerformanceMetrics;
  previous_period: PerformanceMetrics;
  growth_rates: {
    missions: number;
    completion_rate: number;
    efficiency: number;
    revenue: number;
  };
  trends: Array<{
    metric: string;
    direction: 'up' | 'down' | 'stable';
    percentage: number;
  }>;
}

class AnalyticsService {
  private apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

  /**
   * Get comprehensive dashboard analytics data
   */
  async getDashboardAnalytics(timeframe: AnalyticsTimeframe): Promise<AnalyticsDashboardData> {
    try {
      // In production, this would fetch from API
      // For now, generating mock data with realistic patterns
      
      const mockData: AnalyticsDashboardData = {
        overview: {
          mission_completion_rate: 87.3,
          average_completion_time: 32.5,
          agent_utilization_rate: 74.2,
          target_conversion_rate: 23.1,
          route_efficiency_score: 91.8,
          cost_per_mission: 45.75,
          revenue_per_mission: 187.50,
          roi_percentage: 309.8
        },
        missions: {
          total_missions: 1247,
          completed_missions: 1089,
          failed_missions: 84,
          pending_missions: 74,
          average_duration: 32.5,
          success_rate: 87.3,
          geographic_distribution: [
            { county: 'Harris', count: 542, success_rate: 89.1 },
            { county: 'Montgomery', count: 234, success_rate: 85.7 },
            { county: 'Fort Bend', count: 189, success_rate: 91.2 },
            { county: 'Galveston', count: 156, success_rate: 83.3 },
            { county: 'Brazoria', count: 126, success_rate: 88.9 }
          ],
          priority_breakdown: [
            { priority: 'urgent', count: 89, completion_rate: 95.5 },
            { priority: 'high', count: 312, completion_rate: 91.3 },
            { priority: 'medium', count: 567, completion_rate: 86.7 },
            { priority: 'low', count: 279, completion_rate: 82.1 }
          ],
          daily_trends: this.generateDailyTrends(timeframe)
        },
        agents: [
          {
            agent_id: 'agent-001',
            agent_name: 'John Martinez',
            missions_completed: 187,
            missions_assigned: 203,
            completion_rate: 92.1,
            average_time: 28.3,
            distance_traveled: 2847.5,
            success_rate: 94.2,
            decline_rate: 2.1,
            productivity_score: 96.7,
            revenue_generated: 35062.50,
            ranking: 1
          },
          {
            agent_id: 'agent-002',
            agent_name: 'Sarah Chen',
            missions_completed: 156,
            missions_assigned: 167,
            completion_rate: 93.4,
            average_time: 31.2,
            distance_traveled: 2234.8,
            success_rate: 96.8,
            decline_rate: 0.8,
            productivity_score: 94.3,
            revenue_generated: 29250.00,
            ranking: 2
          },
          {
            agent_id: 'agent-003',
            agent_name: 'Mike Rodriguez',
            missions_completed: 134,
            missions_assigned: 156,
            completion_rate: 85.9,
            average_time: 35.7,
            distance_traveled: 1987.3,
            success_rate: 89.3,
            decline_rate: 4.2,
            productivity_score: 87.1,
            revenue_generated: 25125.00,
            ranking: 3
          }
        ],
        revenue: {
          total_revenue: 233812.50,
          revenue_growth: 23.7,
          cost_breakdown: {
            agent_costs: 89450.00,
            operational_costs: 34250.00,
            technology_costs: 12800.00,
            overhead_costs: 21500.00
          },
          profit_margin: 32.4,
          revenue_by_county: [
            { county: 'Harris', revenue: 101625.00, profit: 32875.50 },
            { county: 'Montgomery', revenue: 43875.00, profit: 14218.75 },
            { county: 'Fort Bend', revenue: 35437.50, profit: 11491.88 },
            { county: 'Galveston', revenue: 29250.00, profit: 9481.25 },
            { county: 'Brazoria', revenue: 23625.00, profit: 7656.25 }
          ],
          monthly_trends: this.generateMonthlyRevenueTrends()
        },
        geographic_data: [
          { county: 'Harris', lat: 29.7604, lng: -95.3698, missions: 542, success_rate: 89.1, revenue: 101625.00 },
          { county: 'Montgomery', lat: 30.3199, lng: -95.4822, missions: 234, success_rate: 85.7, revenue: 43875.00 },
          { county: 'Fort Bend', lat: 29.5844, lng: -95.8238, missions: 189, success_rate: 91.2, revenue: 35437.50 },
          { county: 'Galveston', lat: 29.2691, lng: -94.8654, missions: 156, success_rate: 83.3, revenue: 29250.00 },
          { county: 'Brazoria', lat: 29.0450, lng: -95.3687, missions: 126, success_rate: 88.9, revenue: 23625.00 }
        ],
        real_time_metrics: {
          active_agents: 8,
          ongoing_missions: 23,
          completion_rate_today: 91.7,
          efficiency_score: 88.4
        }
      };

      return mockData;
    } catch (error) {
      console.error('Failed to fetch dashboard analytics:', error);
      throw new Error('Analytics data unavailable');
    }
  }

  /**
   * Get agent performance comparison analytics
   */
  async getAgentPerformanceAnalytics(
    agentIds: string[],
    timeframe: AnalyticsTimeframe
  ): Promise<AgentPerformanceData[]> {
    try {
      // Mock agent performance data with realistic metrics
      return [
        {
          agent_id: 'agent-001',
          agent_name: 'John Martinez',
          missions_completed: 187,
          missions_assigned: 203,
          completion_rate: 92.1,
          average_time: 28.3,
          distance_traveled: 2847.5,
          success_rate: 94.2,
          decline_rate: 2.1,
          productivity_score: 96.7,
          revenue_generated: 35062.50,
          ranking: 1
        }
        // Additional agents would be added here
      ];
    } catch (error) {
      console.error('Failed to fetch agent analytics:', error);
      throw new Error('Agent analytics unavailable');
    }
  }

  /**
   * Generate custom report based on user specifications
   */
  async generateCustomReport(reportConfig: CustomReportData): Promise<any> {
    try {
      // This would process the report configuration and generate appropriate data
      const reportData = {
        id: reportConfig.id,
        name: reportConfig.name,
        generated_at: new Date().toISOString(),
        data: await this.processReportFilters(reportConfig),
        chart_config: this.getChartConfiguration(reportConfig.chart_type),
        summary: this.generateReportSummary(reportConfig)
      };

      return reportData;
    } catch (error) {
      console.error('Failed to generate custom report:', error);
      throw new Error('Report generation failed');
    }
  }

  /**
   * Get comparison analytics between time periods
   */
  async getComparisonAnalytics(
    currentPeriod: AnalyticsTimeframe,
    previousPeriod: AnalyticsTimeframe
  ): Promise<ComparisonAnalytics> {
    try {
      const currentData = await this.getDashboardAnalytics(currentPeriod);
      // In production, would also fetch previous period data
      
      return {
        current_period: currentData.overview,
        previous_period: {
          ...currentData.overview,
          mission_completion_rate: currentData.overview.mission_completion_rate - 5.2,
          average_completion_time: currentData.overview.average_completion_time + 3.1,
          agent_utilization_rate: currentData.overview.agent_utilization_rate - 8.4,
          revenue_per_mission: currentData.overview.revenue_per_mission - 12.75
        },
        growth_rates: {
          missions: 18.3,
          completion_rate: 6.3,
          efficiency: 12.7,
          revenue: 23.7
        },
        trends: [
          { metric: 'Mission Volume', direction: 'up', percentage: 18.3 },
          { metric: 'Completion Rate', direction: 'up', percentage: 6.3 },
          { metric: 'Agent Efficiency', direction: 'up', percentage: 12.7 },
          { metric: 'Revenue Growth', direction: 'up', percentage: 23.7 },
          { metric: 'Cost Efficiency', direction: 'up', percentage: 9.2 }
        ]
      };
    } catch (error) {
      console.error('Failed to fetch comparison analytics:', error);
      throw new Error('Comparison analytics unavailable');
    }
  }

  /**
   * Export analytics data in various formats
   */
  async exportAnalytics(
    data: any,
    format: 'csv' | 'excel' | 'pdf' | 'json'
  ): Promise<Blob> {
    try {
      switch (format) {
        case 'csv':
          return this.exportToCSV(data);
        case 'excel':
          return this.exportToExcel(data);
        case 'pdf':
          return this.exportToPDF(data);
        case 'json':
          return this.exportToJSON(data);
        default:
          throw new Error('Unsupported export format');
      }
    } catch (error) {
      console.error('Export failed:', error);
      throw new Error('Data export failed');
    }
  }

  /**
   * Get real-time metrics for live dashboard updates
   */
  async getRealTimeMetrics(): Promise<any> {
    try {
      return {
        active_agents: 8,
        ongoing_missions: 23,
        completion_rate_today: 91.7,
        efficiency_score: 88.4,
        revenue_today: 12450.00,
        missions_completed_today: 67,
        average_response_time: 14.2,
        system_health: 'excellent',
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to fetch real-time metrics:', error);
      throw new Error('Real-time metrics unavailable');
    }
  }

  // Private helper methods

  private generateDailyTrends(timeframe: AnalyticsTimeframe): Array<{
    date: string;
    missions: number;
    completions: number;
    efficiency: number;
  }> {
    const trends = [];
    const days = this.getDaysBetween(timeframe.start, timeframe.end);
    
    for (let i = 0; i < Math.min(days, 30); i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      trends.push({
        date: date.toISOString().split('T')[0],
        missions: Math.floor(Math.random() * 50) + 20,
        completions: Math.floor(Math.random() * 45) + 18,
        efficiency: Math.random() * 20 + 80
      });
    }
    
    return trends.reverse();
  }

  private generateMonthlyRevenueTrends(): Array<{
    month: string;
    revenue: number;
    costs: number;
    profit: number;
  }> {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    return months.map(month => {
      const revenue = Math.random() * 50000 + 180000;
      const costs = revenue * (Math.random() * 0.2 + 0.6);
      return {
        month,
        revenue,
        costs,
        profit: revenue - costs
      };
    });
  }

  private processReportFilters(config: CustomReportData): Promise<any> {
    // Process custom report filters and return relevant data
    return Promise.resolve({
      filtered_data: [],
      total_records: 0,
      filter_summary: config.filters
    });
  }

  private getChartConfiguration(chartType: string): any {
    const configs: Record<string, any> = {
      line: { type: 'line', responsive: true, legend: { display: true } },
      bar: { type: 'bar', responsive: true, legend: { display: true } },
      pie: { type: 'pie', responsive: true, legend: { position: 'right' } },
      area: { type: 'area', responsive: true, fill: true },
      table: { type: 'table', pagination: true, sorting: true },
      map: { type: 'map', zoom: 10, markers: true }
    };
    
    return configs[chartType] || configs.line;
  }

  private generateReportSummary(config: CustomReportData): any {
    return {
      title: config.name,
      description: config.description,
      period: config.filters.date_range,
      key_insights: [
        'Mission completion rates have improved by 12% this quarter',
        'Agent productivity is highest in Harris County',
        'Route optimization has reduced travel costs by 18%'
      ],
      recommendations: [
        'Focus recruitment efforts on high-performing regions',
        'Implement additional training for lower-performing agents',
        'Expand operations in profitable counties'
      ]
    };
  }

  private getDaysBetween(start: string, end: string): number {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const timeDiff = endDate.getTime() - startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  private exportToCSV(data: any): Blob {
    // Convert data to CSV format
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Metric,Value\n" +
      Object.entries(data).map(([key, value]) => `${key},${value}`).join('\n');
    
    return new Blob([csvContent], { type: 'text/csv' });
  }

  private exportToExcel(data: any): Blob {
    // In production, would use a library like xlsx to generate Excel files
    return new Blob([JSON.stringify(data)], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
  }

  private exportToPDF(data: any): Blob {
    // In production, would use a library like jspdf to generate PDF files
    return new Blob([JSON.stringify(data)], { type: 'application/pdf' });
  }

  private exportToJSON(data: any): Blob {
    return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  }
}

export const analyticsService = new AnalyticsService();