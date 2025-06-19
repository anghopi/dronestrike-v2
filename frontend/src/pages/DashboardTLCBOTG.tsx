import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  UsersIcon,
  ArrowTrendingUpIcon,
  CommandLineIcon,
  BanknotesIcon,
  CpuChipIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import { HeaderTabs } from '../components/Layout/HeaderTabs';

// Enhanced dashboard data interface for TLC BOTG DroneStrike
interface DashboardMetrics {
  // Lead Intelligence Metrics
  total_leads: number;
  leads_this_month: number;
  leads_growth_rate: number;
  high_score_leads: number;
  
  // BOTG Mission Metrics
  active_missions: number;
  completed_missions_today: number;
  avg_mission_duration: number;
  mission_success_rate: number;
  
  // Opportunity Metrics
  total_opportunities: number;
  opportunities_value: number;
  conversion_rate: number;
  avg_loan_amount: number;
  
  // TLC Client Metrics
  active_clients: number;
  total_portfolio_value: number;
  monthly_payments_due: number;
  payment_collection_rate: number;
  
  // System Performance
  system_health: 'excellent' | 'good' | 'warning' | 'critical';
  api_response_time: number;
  user_satisfaction: number;
  
  // Recent Activity
  recent_leads: Array<{
    id: number;
    name: string;
    score: number;
    created_at: string;
  }>;
  
  recent_missions: Array<{
    id: number;
    mission_number: string;
    status: string;
    agent: string;
  }>;
  
  recent_opportunities: Array<{
    id: number;
    client_name: string;
    amount: number;
    status: string;
  }>;
}

// Mock enhanced dashboard service
const dashboardService = {
  getDashboardMetrics: async (): Promise<DashboardMetrics> => {
    // Simulate API call with comprehensive TLC BOTG data
    return {
      // Lead Intelligence
      total_leads: 1247,
      leads_this_month: 156,
      leads_growth_rate: 23.5,
      high_score_leads: 89,
      
      // BOTG Missions
      active_missions: 12,
      completed_missions_today: 8,
      avg_mission_duration: 45,
      mission_success_rate: 94.2,
      
      // Opportunities
      total_opportunities: 34,
      opportunities_value: 2850000,
      conversion_rate: 67.8,
      avg_loan_amount: 83823,
      
      // TLC Clients
      active_clients: 78,
      total_portfolio_value: 6420000,
      monthly_payments_due: 287500,
      payment_collection_rate: 96.3,
      
      // System Performance
      system_health: 'excellent',
      api_response_time: 145,
      user_satisfaction: 94,
      
      // Recent Activity
      recent_leads: [
        { id: 1, name: 'Sarah Johnson', score: 92, created_at: '2025-06-17T09:30:00Z' },
        { id: 2, name: 'Michael Chen', score: 88, created_at: '2025-06-17T09:15:00Z' },
        { id: 3, name: 'Lisa Rodriguez', score: 85, created_at: '2025-06-17T08:45:00Z' },
      ],
      
      recent_missions: [
        { id: 1, mission_number: 'M-2025-015', status: 'completed', agent: 'Agent Rodriguez' },
        { id: 2, mission_number: 'M-2025-016', status: 'in_progress', agent: 'Agent Martinez' },
        { id: 3, mission_number: 'M-2025-017', status: 'assigned', agent: 'Agent Thompson' },
      ],
      
      recent_opportunities: [
        { id: 1, client_name: 'Robert Wilson', amount: 95000, status: 'approved' },
        { id: 2, client_name: 'Maria Garcia', amount: 78000, status: 'qualified' },
        { id: 3, client_name: 'David Kim', amount: 125000, status: 'proposal_sent' },
      ]
    };
  }
};

const DashboardTLCBOTG: React.FC = () => {
  const { user } = useAuth();
  const [timeRange] = useState('today');

  // Fetch dashboard metrics
  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ['dashboard-metrics', timeRange],
    queryFn: dashboardService.getDashboardMetrics,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSystemHealthColor = (health: string) => {
    const colors: Record<string, string> = {
      'excellent': 'text-green-400',
      'good': 'text-blue-400',
      'warning': 'text-yellow-400',
      'critical': 'text-red-400'
    };
    return colors[health] || colors['good'];
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'completed': 'bg-green-500/20 text-green-300',
      'in_progress': 'bg-yellow-500/20 text-yellow-300',
      'assigned': 'bg-blue-500/20 text-blue-300',
      'approved': 'bg-green-500/20 text-green-300',
      'qualified': 'bg-blue-500/20 text-blue-300',
      'proposal_sent': 'bg-purple-500/20 text-purple-300'
    };
    return colors[status] || 'bg-gray-500/20 text-gray-300';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-color mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading command center...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
        <p className="text-red-300">Error loading dashboard metrics. Please try again.</p>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', name: 'Command Overview', count: metrics?.total_leads || 0 },
    { id: 'missions', name: 'BOTG Missions', count: metrics?.active_missions || 0 },
    { id: 'opportunities', name: 'Opportunities', count: metrics?.total_opportunities || 0 },
    { id: 'portfolio', name: 'TLC Portfolio', count: metrics?.active_clients || 0 },
  ];

  return (
    <div className="flex flex-col h-full">
      <HeaderTabs 
        title="TLC BOTG DroneStrike Command Center" 
        searchPlaceholder="Search intelligence..."
        onSearch={() => {}}
        tabs={tabs}
        activeTab="overview"
        onTabChange={() => {}}
        extraContent={
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/60 border border-gray-600/50`}>
              <div className={`w-3 h-3 rounded-full ${metrics?.system_health === 'excellent' ? 'bg-green-400' : 'bg-yellow-400'} animate-pulse`}></div>
              <span className={`text-sm font-medium ${getSystemHealthColor(metrics?.system_health || 'good')}`}>
                System {metrics?.system_health?.toUpperCase()}
              </span>
            </div>
            <div className="text-gray-400 text-sm">
              Welcome back, {user?.first_name || 'Operator'}
            </div>
          </div>
        }
      />
      
      <div className="flex-1 p-6 space-y-6 overflow-auto bg-gradient-to-br from-navy-blue-dark/50 to-navy-blue/30">

      {/* Key Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {/* Lead Intelligence */}
        <div className="enhanced-card p-6 bg-gradient-to-br from-blue-600/20 to-blue-800/30 border border-blue-500/30">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <UsersIcon className="h-8 w-8 text-blue-400" />
            </div>
            <div className="text-right">
              <p className="text-blue-300 text-sm font-medium">Target Intelligence</p>
              <p className="text-3xl font-bold text-white">{metrics?.total_leads?.toLocaleString()}</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">This Month:</span>
              <span className="text-white font-medium">{metrics?.leads_this_month}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">High Score:</span>
              <span className="text-green-400 font-medium">{metrics?.high_score_leads}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Growth:</span>
              <span className="text-green-400 font-medium">+{metrics?.leads_growth_rate}%</span>
            </div>
          </div>
        </div>

        {/* BOTG Missions */}
        <div className="enhanced-card p-6 bg-gradient-to-br from-green-600/20 to-green-800/30 border border-green-500/30">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/20 rounded-lg">
              <CommandLineIcon className="h-8 w-8 text-green-400" />
            </div>
            <div className="text-right">
              <p className="text-green-300 text-sm font-medium">BOTG Missions</p>
              <p className="text-3xl font-bold text-white">{metrics?.active_missions}</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Completed Today:</span>
              <span className="text-white font-medium">{metrics?.completed_missions_today}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Avg Duration:</span>
              <span className="text-white font-medium">{metrics?.avg_mission_duration}min</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Success Rate:</span>
              <span className="text-green-400 font-medium">{metrics?.mission_success_rate}%</span>
            </div>
          </div>
        </div>

        {/* Investment Opportunities */}
        <div className="enhanced-card p-6 bg-gradient-to-br from-purple-600/20 to-purple-800/30 border border-purple-500/30">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-500/20 rounded-lg">
              <ArrowTrendingUpIcon className="h-8 w-8 text-purple-400" />
            </div>
            <div className="text-right">
              <p className="text-purple-300 text-sm font-medium">Opportunities</p>
              <p className="text-3xl font-bold text-white">{metrics?.total_opportunities}</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Total Value:</span>
              <span className="text-white font-medium">{formatCurrency(metrics?.opportunities_value || 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Avg Amount:</span>
              <span className="text-white font-medium">{formatCurrency(metrics?.avg_loan_amount || 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Conversion:</span>
              <span className="text-green-400 font-medium">{metrics?.conversion_rate}%</span>
            </div>
          </div>
        </div>

        {/* TLC Client Portfolio */}
        <div className="enhanced-card p-6 bg-gradient-to-br from-orange-600/20 to-orange-800/30 border border-orange-500/30">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-500/20 rounded-lg">
              <BanknotesIcon className="h-8 w-8 text-orange-400" />
            </div>
            <div className="text-right">
              <p className="text-orange-300 text-sm font-medium">TLC Portfolio</p>
              <p className="text-3xl font-bold text-white">{metrics?.active_clients}</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Portfolio Value:</span>
              <span className="text-white font-medium">{formatCurrency(metrics?.total_portfolio_value || 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Monthly Due:</span>
              <span className="text-white font-medium">{formatCurrency(metrics?.monthly_payments_due || 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Collection Rate:</span>
              <span className="text-green-400 font-medium">{metrics?.payment_collection_rate}%</span>
            </div>
          </div>
        </div>

        {/* System Performance - Interactive */}
        <div className="enhanced-card p-6 bg-gradient-to-br from-cyan-600/20 to-cyan-800/30 border border-cyan-500/30 hover:border-cyan-400/50 transition-all duration-200 group cursor-pointer">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-cyan-500/20 rounded-lg group-hover:bg-cyan-500/30 transition-colors">
              <CpuChipIcon className="h-8 w-8 text-cyan-400" />
            </div>
            <div className="text-right">
              <p className="text-cyan-300 text-sm font-medium">System Performance</p>
              <p className="text-3xl font-bold text-white">{metrics?.api_response_time}ms</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">API Response:</span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${(metrics?.api_response_time || 0) < 200 ? 'bg-green-400' : (metrics?.api_response_time || 0) < 500 ? 'bg-yellow-400' : 'bg-red-400'} animate-pulse`}></div>
                <span className="text-white font-medium">{metrics?.api_response_time}ms</span>
              </div>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">User Satisfaction:</span>
              <div className="flex items-center gap-2">
                <div className="w-16 bg-gray-700 rounded-full h-1.5">
                  <div 
                    className="bg-cyan-400 h-1.5 rounded-full transition-all duration-500" 
                    style={{ width: `${metrics?.user_satisfaction || 0}%` }}
                  ></div>
                </div>
                <span className="text-white font-medium w-8">{metrics?.user_satisfaction}%</span>
              </div>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">System Health:</span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${metrics?.system_health === 'excellent' ? 'bg-green-400' : metrics?.system_health === 'good' ? 'bg-blue-400' : metrics?.system_health === 'warning' ? 'bg-yellow-400' : 'bg-red-400'} animate-pulse`}></div>
                <span className={`font-bold text-xs px-2 py-1 rounded ${getSystemHealthColor(metrics?.system_health || 'good')} bg-gray-800/50`}>
                  {metrics?.system_health?.toUpperCase()}
                </span>
              </div>
            </div>
            <button className="w-full mt-2 text-xs bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-400 border border-cyan-500/30 py-1.5 px-3 rounded transition-colors">
              System Diagnostics
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Recent Leads */}
        <div className="enhanced-card p-4">
          <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
            Recent Leads
          </h3>
          <div className="space-y-2">
            {metrics?.recent_leads.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between p-2 bg-gray-800/40 rounded-lg">
                <div>
                  <div className="text-white font-medium text-sm">{lead.name}</div>
                  <div className="text-xs text-gray-400">{formatTime(lead.created_at)}</div>
                </div>
                <div className="text-right">
                  <div className="text-green-400 font-bold text-sm">{lead.score}</div>
                  <div className="text-xs text-gray-400">Score</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Missions */}
        <div className="enhanced-card p-4">
          <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
            Recent Missions
          </h3>
          <div className="space-y-2">
            {metrics?.recent_missions.map((mission) => (
              <div key={mission.id} className="flex items-center justify-between p-2 bg-gray-800/40 rounded-lg">
                <div>
                  <div className="text-white font-medium font-mono text-sm">{mission.mission_number}</div>
                  <div className="text-xs text-gray-400">{mission.agent}</div>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(mission.status)}`}>
                  {mission.status.replace(/_/g, ' ')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Opportunities */}
        <div className="enhanced-card p-4">
          <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
            Recent Opportunities
          </h3>
          <div className="space-y-2">
            {metrics?.recent_opportunities.map((opportunity) => (
              <div key={opportunity.id} className="flex items-center justify-between p-2 bg-gray-800/40 rounded-lg">
                <div>
                  <div className="text-white font-medium text-sm">{opportunity.client_name}</div>
                  <div className="text-xs text-gray-400">{formatCurrency(opportunity.amount)}</div>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(opportunity.status)}`}>
                  {opportunity.status.replace(/_/g, ' ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default DashboardTLCBOTG;