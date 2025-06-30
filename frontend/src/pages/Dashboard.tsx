import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ChartBarIcon,
  UsersIcon,
  BuildingOfficeIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { HeaderTabs } from '../components/Layout/HeaderTabs';
import { useAuth } from '../hooks/useAuth';
import { leadService, propertyService, tokenAPI } from '../services/api';
import { DashboardStats } from '../types';
import { useWebSocket, useRealTimeNotifications } from '../hooks/useWebSocket';

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
    primary: 'bg-gradient-to-br from-brand-color to-brand-color-light',
    success: 'bg-gradient-to-br from-olive-green to-success-600',
    warning: 'bg-gradient-to-br from-alert-yellow to-warning-600',
    danger: 'bg-gradient-to-br from-critical-red to-danger-600',
  };

  const content = (
    <div className="enhanced-card p-6 hover:bg-military-700 transition-all duration-300 hover:shadow-lg hover:scale-105 group cursor-pointer">
      <div className="flex items-center">
        <div className={`${colorClasses[color]} p-4 rounded-xl shadow-lg group-hover:shadow-xl transition-all duration-300`}>
          <Icon className="h-8 w-8 text-white" />
        </div>
        <div className="ml-6 flex-1">
          <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">{title}</p>
          <div className="flex items-baseline mt-2">
            <p className="text-3xl font-bold text-white">{value}</p>
            {change !== undefined && (
              <div className="ml-3 flex items-center text-sm">
                {change >= 0 ? (
                  <>
                    <ArrowTrendingUpIcon className="h-4 w-4 text-success-400 mr-1" />
                    <span className="text-success-400 font-semibold">+{change}%</span>
                  </>
                ) : (
                  <>
                    <ArrowTrendingDownIcon className="h-4 w-4 text-danger-300 mr-1" />
                    <span className="text-danger-300 font-semibold">{change}%</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
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
    primary: 'border-primary-600 hover:bg-primary-600',
    success: 'border-success-600 hover:bg-success-600',
    warning: 'border-warning-600 hover:bg-warning-600',
    danger: 'border-danger-600 hover:bg-danger-600',
  };

  return (
    <Link
      to={href}
      className={`block p-4 border-2 border-dashed rounded-lg transition-colors duration-200 ${colorClasses[color]} hover:bg-opacity-10`}
    >
      <div className="flex items-center">
        <Icon className="h-8 w-8 text-military-300" />
        <div className="ml-3">
          <h3 className="text-sm font-medium text-white">{title}</h3>
          <p className="text-xs text-military-400">{description}</p>
        </div>
      </div>
    </Link>
  );
};

export const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState<{ regular_tokens: number; mail_tokens: number } | null>(null);

  // WebSocket hooks for real-time updates
  const { isConnected, connectionStatus } = useWebSocket();
  const { notifications, unreadCount } = useRealTimeNotifications();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [dashboardStats, balance] = await Promise.all([
          leadService.getDashboardStats(),
          tokenAPI.getBalance()
        ]);
        setStats(dashboardStats);
        setTokenBalance(balance);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Listen for real-time updates
  useEffect(() => {
    const tokenUpdateNotifications = notifications.filter(n => 
      n.type === 'token_balance_update'
    );
    
    if (tokenUpdateNotifications.length > 0) {
      // Refresh token balance when we get updates
      tokenAPI.getBalance().then(setTokenBalance).catch(console.error);
    }
  }, [notifications]);

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
      <div className="flex flex-col h-full">
        <HeaderTabs 
          title="War Room" 
          searchPlaceholder="Search operations..."
          showNewButton={false}
          showImportButton={false}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-400">Loading mission data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full space-y-8">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">War Room</h1>
        <p className="page-subtitle">Command and control center for all operations</p>
      </div>
      {/* Command Header */}
      <div className="enhanced-card p-8 border border-military-600 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-brand-color to-brand-color-light flex items-center justify-center shadow-lg">
                <span className="text-2xl">⭐</span>
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white mb-2">
                  {getGreeting()}, {user?.first_name || user?.username}
                </h1>
                <div className="flex items-center space-x-4">
                  <span className="px-3 py-1 bg-brand-color rounded-lg text-sm font-semibold text-white">
                    {getRoleDisplay(profile?.role || 'user')}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span className="text-gray-300">DroneStrike Command Center</span>
                  
                  {/* Real-time status */}
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className={`text-sm ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                      {isConnected ? 'LIVE' : 'OFFLINE'}
                    </span>
                  </div>
                  
                  {/* Notification counter */}
                  {unreadCount > 0 && (
                    <div className="flex items-center space-x-1 px-2 py-1 bg-red-600 rounded-full text-xs text-white">
                      <span>🔔</span>
                      <span>{unreadCount}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-right">
                <p className="text-sm text-gray-400 uppercase tracking-wider font-semibold">System Status</p>
                <div className="flex items-center mt-1">
                  <div className="w-3 h-3 bg-success-400 rounded-full mr-2 animate-pulse"></div>
                  <span className="text-success-400 font-bold text-lg">OPERATIONAL</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400 uppercase tracking-wider font-semibold">Local Time</p>
                <p className="text-white font-bold text-lg">
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
      <div className="stats-grid">
          <StatCard
            title="Total Leads"
            value={stats?.total_leads || 0}
            change={12}
            icon={UsersIcon}
            color="primary"
            href="/leads"
          />
          <StatCard
            title="Active Properties"
            value="1,247"
            change={8}
            icon={BuildingOfficeIcon}
            color="success"
            href="/properties"
          />
          <StatCard
            title="Pipeline Value"
            value="$2.4M"
            change={-3}
            icon={CurrencyDollarIcon}
            color="warning"
            href="/opportunities"
          />
          <StatCard
            title="Regular Tokens"
            value={tokenBalance?.regular_tokens?.toLocaleString() || '0'}
            icon={CurrencyDollarIcon}
            color="primary"
            href="/tokens"
          />
          <StatCard
            title="Mail Tokens"
            value={tokenBalance?.mail_tokens?.toLocaleString() || '0'}
            icon={CurrencyDollarIcon}
            color="success"
            href="/tokens"
          />
          <StatCard
            title="High Score Leads"
            value={stats?.high_score_leads || 0}
            icon={ChartBarIcon}
            color="success"
            href="/leads?score=high"
          />
        </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
        <div className="dashboard-grid">
            <QuickAction
              title="New Lead"
              description="Add new target to pipeline"
              icon={UsersIcon}
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
              icon={ExclamationTriangleIcon}
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
      <div className="two-column-grid">
        {/* Lead Status Breakdown */}
        <div className="enhanced-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Lead Status Overview</h3>
            <div className="space-y-3">
              {stats?.by_status.slice(0, 5).map((status, index) => (
                <div key={status.lead_status} className="flex items-center justify-between">
                  <span className="text-military-300 capitalize">
                    {status.lead_status.replace('_', ' ')}
                  </span>
                  <div className="flex items-center space-x-3">
                    <div className="w-32 bg-military-700 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full"
                        style={{
                          width: `${((status.count / stats.total_leads) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-white font-medium w-8 text-right">
                      {status.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        {/* Workflow Pipeline */}
        <div className="enhanced-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Workflow Pipeline</h3>
            <div className="space-y-3">
              {stats?.by_workflow_stage.slice(0, 5).map((stage) => (
                <div key={stage.workflow_stage} className="flex items-center justify-between">
                  <span className="text-military-300 capitalize text-sm">
                    {stage.workflow_stage.replace('_', ' ')}
                  </span>
                  <div className="flex items-center space-x-3">
                    <div className="w-24 bg-military-700 rounded-full h-2">
                      <div
                        className="bg-success-600 h-2 rounded-full"
                        style={{
                          width: `${((stage.count / stats.total_leads) * 100)}%`,
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
        <div className="enhanced-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Token Balance</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary-400">{profile.tokens.toLocaleString()}</p>
                <p className="text-military-400 text-sm">Regular Tokens</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-warning-400">{profile.mail_tokens}</p>
                <p className="text-military-400 text-sm">Mail Tokens</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-success-400">${profile.monthly_rate}</p>
                <p className="text-military-400 text-sm">Monthly Rate</p>
              </div>
            </div>
        </div>
      )}
    </div>
  );
};