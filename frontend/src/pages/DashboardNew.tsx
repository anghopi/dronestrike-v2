import React from 'react';
import { Link } from 'react-router-dom';
import {
  ChartBarIcon,
  UsersIcon,
  BuildingOfficeIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  PlusIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import { leadService, propertyService } from '../services/api';
import { useQuery } from '@tanstack/react-query';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ComponentType<{ className?: string }>;
  color: 'primary' | 'success' | 'warning' | 'danger';
  href?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, change, icon: Icon, color, href }) => {
  const colorClasses = {
    primary: 'text-brand-color',
    success: 'text-olive-green',
    warning: 'text-alert-yellow',
    danger: 'text-critical-red',
  };

  const content = (
    <div className="card-military p-6 hover:shadow-lg transition-all duration-300 group cursor-pointer">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">{title}</p>
          <div className="flex items-baseline">
            <p className="text-2xl font-bold text-white">{value}</p>
            {change !== undefined && (
              <div className="ml-2 flex items-center text-sm">
                {change >= 0 ? (
                  <>
                    <ArrowTrendingUpIcon className="h-4 w-4 text-olive-green mr-1" />
                    <span className="text-olive-green font-medium">+{change}%</span>
                  </>
                ) : (
                  <>
                    <ArrowTrendingDownIcon className="h-4 w-4 text-critical-red mr-1" />
                    <span className="text-critical-red font-medium">{change}%</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <Icon className={`h-8 w-8 ${colorClasses[color]} group-hover:scale-110 transition-transform duration-200`} />
      </div>
    </div>
  );

  return href ? <Link to={href}>{content}</Link> : content;
};

interface QuickActionProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color: 'primary' | 'success' | 'warning' | 'danger';
}

const QuickAction: React.FC<QuickActionProps> = ({ title, description, icon: Icon, href, color }) => {
  const colorClasses = {
    primary: 'border-brand-color hover:bg-brand-color',
    success: 'border-olive-green hover:bg-olive-green',
    warning: 'border-alert-yellow hover:bg-alert-yellow',
    danger: 'border-critical-red hover:bg-critical-red',
  };

  return (
    <Link
      to={href}
      className={`block p-4 border-2 border-dashed rounded-lg transition-all duration-200 ${colorClasses[color]} hover:bg-opacity-10`}
    >
      <div className="flex items-center">
        <Icon className="h-6 w-6 text-gray-300" />
        <div className="ml-3">
          <h3 className="text-sm font-medium text-white">{title}</h3>
          <p className="text-xs text-gray-400">{description}</p>
        </div>
      </div>
    </Link>
  );
};

export const DashboardNew: React.FC = () => {
  const { user, profile } = useAuth();

  // Fetch dashboard stats from all endpoints
  const { data: leadStats, isLoading: loadingLeads } = useQuery({
    queryKey: ['dashboard-lead-stats'],
    queryFn: () => leadService.getDashboardStats(),
  });

  const { data: workflowPipeline } = useQuery({
    queryKey: ['dashboard-workflow'],
    queryFn: () => leadService.getWorkflowPipeline(),
  });

  const { data: investmentOpportunities, isLoading: loadingOpportunities } = useQuery({
    queryKey: ['dashboard-opportunities'],
    queryFn: () => propertyService.getInvestmentOpportunities(),
  });

  const { data: propertiesData, isLoading: loadingProperties } = useQuery({
    queryKey: ['dashboard-properties'],
    queryFn: () => propertyService.getProperties({ page: 1 }),
  });

  const loading = loadingLeads || loadingOpportunities || loadingProperties;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getRoleDisplay = (role: string) => {
    const roleMap: Record<string, string> = {
      'admin': 'Command Center',
      'manager': 'Operations Manager',
      'agent': 'Field Agent',
      'soldier': 'BOTG Soldier',
      'officer': 'Loan Officer',
      'five_star_general': 'Five Star General',
      'beta_infantry': 'Beta Infantry',
      'user': 'Operator',
    };
    return roleMap[role] || 'Operator';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-color mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading mission data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Command Header */}
      <div className="card-military p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-brand-color to-brand-color-light flex items-center justify-center">
              <span className="text-xl"></span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {getGreeting()}, {user?.first_name || user?.username}
              </h1>
              <div className="flex items-center space-x-3 mt-1">
                <span className="px-2 py-1 bg-brand-color rounded text-xs font-medium text-white">
                  {getRoleDisplay(profile?.role || 'user')}
                </span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-400 text-sm">DroneStrike Command Center</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-xs text-gray-400 uppercase font-medium">System Status</p>
              <div className="flex items-center mt-1">
                <div className="w-2 h-2 bg-olive-green rounded-full mr-2 animate-pulse"></div>
                <span className="text-olive-green font-medium text-sm">OPERATIONAL</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 uppercase font-medium">Local Time</p>
              <p className="text-white font-medium">
                {new Date().toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: false 
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Leads"
          value={leadStats?.total_leads || 0}
          change={leadStats?.recent_leads ? Math.round((leadStats.recent_leads / leadStats.total_leads) * 100) : 0}
          icon={UsersIcon}
          color="primary"
          href="/leads"
        />
        <StatCard
          title="Active Properties"
          value={propertiesData?.count || 0}
          icon={BuildingOfficeIcon}
          color="success"
          href="/properties"
        />
        <StatCard
          title="Investment Opportunities"
          value={investmentOpportunities?.count || 0}
          icon={CurrencyDollarIcon}
          color="warning"
          href="/opportunities"
        />
        <StatCard
          title="High Score Leads"
          value={leadStats?.high_score_leads || 0}
          icon={ChartBarIcon}
          color="success"
          href="/leads?score=high"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickAction
            title="New Lead"
            description="Add new target to pipeline"
            icon={PlusIcon}
            href="/leads/new"
            color="primary"
          />
          <QuickAction
            title="Property Analysis"
            description="Run investment calculations"
            icon={BuildingOfficeIcon}
            href="/properties"
            color="success"
          />
          <QuickAction
            title="BOTG Mission"
            description="Assign field operations"
            icon={CheckIcon}
            href="/missions"
            color="warning"
          />
          <QuickAction
            title="TLC Integration"
            description="Process loan opportunities"
            icon={CurrencyDollarIcon}
            href="/opportunities"
            color="danger"
          />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Status Breakdown */}
        <div className="card-military p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Lead Status Overview</h3>
          <div className="space-y-3">
            {leadStats?.by_status?.slice(0, 5).map((status: any) => (
              <div key={status.lead_status} className="flex items-center justify-between">
                <span className="text-gray-300 capitalize text-sm">
                  {status.lead_status.replace('_', ' ')}
                </span>
                <div className="flex items-center space-x-3">
                  <div className="w-24 bg-navy-blue-light rounded-full h-2">
                    <div
                      className="bg-brand-color h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${((status.count / (leadStats?.total_leads || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-white font-medium w-6 text-right text-sm">
                    {status.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Workflow Pipeline */}
        <div className="card-military p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Workflow Pipeline</h3>
          <div className="space-y-3">
            {leadStats?.by_workflow_stage?.slice(0, 5).map((stage: any) => (
              <div key={stage.workflow_stage} className="flex items-center justify-between">
                <span className="text-gray-300 capitalize text-sm">
                  {stage.workflow_stage.replace('_', ' ')}
                </span>
                <div className="flex items-center space-x-3">
                  <div className="w-24 bg-navy-blue-light rounded-full h-2">
                    <div
                      className="bg-olive-green h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${((stage.count / (leadStats?.total_leads || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-white font-medium w-6 text-right text-sm">
                    {stage.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Token Balance */}
      {profile && (
        <div className="card-military p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Token Balance</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-brand-color">{profile.tokens.toLocaleString()}</p>
              <p className="text-gray-400 text-sm">Regular Tokens</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-alert-yellow">{profile.mail_tokens}</p>
              <p className="text-gray-400 text-sm">Mail Tokens</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-olive-green">${profile.monthly_rate}</p>
              <p className="text-gray-400 text-sm">Monthly Rate</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};