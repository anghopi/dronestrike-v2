import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Clock, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Navigation,
  Phone,
  MessageSquare,
  Filter,
  RefreshCw,
  BarChart3,
  TrendingUp,
  Target as TargetIcon,
  Zap
} from 'lucide-react';
import { Mission } from '../../types/mission';
import AutomatedDistributionPanel from './AutomatedDistributionPanel';
import { Agent, MissionAssignmentResult } from '../../services/missionDistributionService';
import { Target } from '../../types/target';

interface DashboardStats {
  total_missions: number;
  active_missions: number;
  completed_today: number;
  failed_today: number;
  agents_available: number;
  agents_busy: number;
  average_completion_time: number;
  success_rate: number;
}

const MissionDashboard: React.FC = () => {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showDistributionPanel, setShowDistributionPanel] = useState(false);

  useEffect(() => {
    loadDashboardData();
    
    // Auto refresh every 30 seconds if enabled
    const interval = autoRefresh ? setInterval(loadDashboardData, 30000) : null;
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const loadDashboardData = async () => {
    setRefreshing(true);
    try {
      // Mock data - in real app this would come from API
      const mockMissions: Mission[] = [
        {
          id: 1,
          target: {
            name: 'John Smith',
            address: '123 Main St, Houston, TX 77001',
            phone: '(555) 123-4567',
            notes: 'Ring doorbell twice. Friendly contact.',
            is_dangerous: false
          },
          status: 'assigned',
          priority: 'high',
          estimated_duration: 30,
          assigned_at: '2024-01-15T09:00:00Z',
          deadline: '2024-01-15T17:00:00Z',
          distance: 2.3
        },
        {
          id: 2,
          target: {
            name: 'Sarah Johnson',
            address: '456 Oak Ave, Houston, TX 77002',
            phone: '(555) 987-6543',
            notes: 'Apartment 2B. Beware of large dog.',
            is_dangerous: true
          },
          status: 'en_route',
          priority: 'medium',
          estimated_duration: 45,
          assigned_at: '2024-01-15T10:00:00Z',
          deadline: '2024-01-15T18:00:00Z',
          distance: 4.7
        },
        {
          id: 3,
          target: {
            name: 'Mike Rodriguez',
            address: '789 Pine St, Houston, TX 77003',
            phone: '(555) 456-7890',
            notes: 'Business hours only. Ask for manager.',
            is_dangerous: false
          },
          status: 'on_site',
          priority: 'urgent',
          estimated_duration: 60,
          assigned_at: '2024-01-15T11:00:00Z',
          deadline: '2024-01-15T19:00:00Z',
          distance: 1.8
        },
        {
          id: 4,
          target: {
            name: 'Lisa Chen',
            address: '321 Elm St, Houston, TX 77004',
            phone: '(555) 321-0987',
            notes: 'Completed successfully. Contact was cooperative.',
            is_dangerous: false
          },
          status: 'completed',
          priority: 'low',
          estimated_duration: 25,
          assigned_at: '2024-01-15T08:00:00Z',
          deadline: '2024-01-15T16:00:00Z',
          distance: 3.2
        }
      ];

      const mockAgents: Agent[] = [
        {
          id: 'agent-001',
          name: 'John Martinez',
          email: 'j.martinez@dronestrike.com',
          phone: '(555) 123-4567',
          status: 'busy',
          current_location: {
            lat: 29.7604,
            lng: -95.3698,
            address: 'Downtown Houston, TX',
            last_updated: '2024-01-15T12:30:00Z'
          },
          max_radius: 15,
          max_hold: 5,
          max_decline: 5,
          optimal_route_points: 10,
          devices_allowed: 1,
          missions_completed: 47,
          missions_declined: 3,
          success_rate: 94.2,
          average_completion_time: 28,
          monthly_declines: 2,
          last_decline_reset: '2024-01-01T00:00:00Z',
          active_missions: 2,
          missions_on_hold: 0,
          property_type_filters: ['residential', 'commercial'],
          language_preference: 'english',
          handles_dangerous: true,
          territory_preference: {
            counties: ['harris', 'montgomery'],
            cities: ['houston', 'spring']
          }
        },
        {
          id: 'agent-002', 
          name: 'Sarah Chen',
          email: 's.chen@dronestrike.com',
          phone: '(555) 987-6543',
          status: 'available',
          current_location: {
            lat: 29.8167,
            lng: -95.3400,
            address: 'The Heights, Houston, TX',
            last_updated: '2024-01-15T12:45:00Z'
          },
          max_radius: 20,
          max_hold: 6,
          max_decline: 5,
          optimal_route_points: 12,
          devices_allowed: 1,
          missions_completed: 32,
          missions_declined: 1,
          success_rate: 96.8,
          average_completion_time: 25,
          monthly_declines: 0,
          last_decline_reset: '2024-01-01T00:00:00Z',
          active_missions: 0,
          missions_on_hold: 0,
          property_type_filters: ['residential', 'land'],
          language_preference: 'both',
          handles_dangerous: false,
          territory_preference: {
            counties: ['harris'],
            cities: ['houston']
          }
        },
        {
          id: 'agent-003',
          name: 'Mike Rodriguez',
          email: 'm.rodriguez@dronestrike.com',
          phone: '(555) 456-7890',
          status: 'available',
          current_location: {
            lat: 29.7280,
            lng: -95.3951,
            address: 'Westside Houston, TX',
            last_updated: '2024-01-15T12:20:00Z'
          },
          max_radius: 12,
          max_hold: 4,
          max_decline: 5,
          optimal_route_points: 8,
          devices_allowed: 1,
          missions_completed: 28,
          missions_declined: 2,
          success_rate: 89.3,
          average_completion_time: 32,
          monthly_declines: 1,
          last_decline_reset: '2024-01-01T00:00:00Z',
          active_missions: 1,
          missions_on_hold: 0,
          property_type_filters: ['commercial', 'mobile_home'],
          language_preference: 'spanish',
          handles_dangerous: true
        }
      ];

      const mockTargets: Target[] = [
        {
          id: 1,
          first_name: 'Robert',
          last_name: 'Johnson',
          email: 'robert.johnson@email.com',
          phone_cell: '(555) 111-2222',
          mailing_address_1: '1500 Main St',
          mailing_city: 'Houston',
          mailing_state: 'TX',
          mailing_county: 'Harris',
          mailing_zip5: '77001',
          latitude: 29.7589,
          longitude: -95.3677,
          lead_status: 'new',
          is_dangerous: false,
          is_business: false,
          score_value: 85,
          created_at: '2024-01-15T08:00:00Z',
          property: {
            account_number: 'TX001',
            market_value: 250000,
            address_1: '1500 Main St',
            city: 'Houston',
            state: 'TX',
            zip: '77001'
          }
        },
        {
          id: 2,
          first_name: 'Maria',
          last_name: 'Garcia',
          email: 'maria.garcia@email.com',
          phone_cell: '(555) 333-4444',
          mailing_address_1: '2100 Oak Ave',
          mailing_city: 'Houston',
          mailing_state: 'TX',
          mailing_county: 'Harris',
          mailing_zip5: '77002',
          latitude: 29.8100,
          longitude: -95.3400,
          lead_status: 'new',
          is_dangerous: true,
          is_business: false,
          score_value: 92,
          created_at: '2024-01-15T09:00:00Z',
          property: {
            account_number: 'TX002',
            market_value: 180000,
            address_1: '2100 Oak Ave',
            city: 'Houston',
            state: 'TX',
            zip: '77002'
          }
        },
        {
          id: 3,
          first_name: 'David',
          last_name: 'Wilson',
          email: 'david.wilson@email.com',
          phone_cell: '(555) 555-6666',
          mailing_address_1: '3200 Pine St',
          mailing_city: 'Houston',
          mailing_state: 'TX',
          mailing_county: 'Harris',
          mailing_zip5: '77003',
          latitude: 29.7200,
          longitude: -95.3900,
          lead_status: 'new',
          is_dangerous: false,
          is_business: true,
          score_value: 78,
          created_at: '2024-01-15T10:00:00Z',
          property: {
            account_number: 'TX003',
            market_value: 320000,
            address_1: '3200 Pine St',
            city: 'Houston',
            state: 'TX',
            zip: '77003'
          }
        }
      ];

      const mockStats: DashboardStats = {
        total_missions: 47,
        active_missions: 3,
        completed_today: 12,
        failed_today: 1,
        agents_available: 1,
        agents_busy: 2,
        average_completion_time: 32,
        success_rate: 92.8
      };

      setMissions(mockMissions);
      setAgents(mockAgents);
      setTargets(mockTargets);
      setStats(mockStats);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-500 bg-green-500/10';
      case 'failed': return 'text-red-500 bg-red-500/10';
      case 'on_site': return 'text-blue-500 bg-blue-500/10';
      case 'en_route': return 'text-yellow-500 bg-yellow-500/10';
      case 'assigned': return 'text-purple-500 bg-purple-500/10';
      default: return 'text-gray-500 bg-gray-500/10';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getAgentStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'text-green-500';
      case 'busy': return 'text-yellow-500';
      case 'offline': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const filteredMissions = missions.filter(mission => {
    if (selectedStatus !== 'all' && mission.status !== selectedStatus) return false;
    if (selectedAgent !== 'all') {
      // In real app, missions would have assigned agent ID
      return true; // For now, show all missions
    }
    return true;
  });

  const handleDistributionComplete = (result: MissionAssignmentResult) => {
    console.log('Distribution completed:', result);
    // In a real app, this would update the missions list and refresh data
    loadDashboardData();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Mission Control Dashboard</h1>
          <p className="text-slate-300 mt-1">Real-time field operations overview</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="autoRefresh"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-slate-500 bg-slate-600 text-green-600 focus:ring-green-500"
            />
            <label htmlFor="autoRefresh" className="text-slate-300 text-sm">Auto Refresh</label>
          </div>
          
          <button
            onClick={() => setShowDistributionPanel(!showDistributionPanel)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Zap className="w-4 h-4" />
            <span>Auto Distribute</span>
          </button>

          <button
            onClick={loadDashboardData}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center space-x-2 mb-2">
              <TargetIcon className="w-5 h-5 text-blue-500" />
              <h3 className="text-slate-300 text-sm font-medium">Total Missions</h3>
            </div>
            <p className="text-2xl font-bold text-white">{stats.total_missions}</p>
            <p className="text-sm text-slate-400 mt-1">{stats.active_missions} active</p>
          </div>
          
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center space-x-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <h3 className="text-slate-300 text-sm font-medium">Completed Today</h3>
            </div>
            <p className="text-2xl font-bold text-white">{stats.completed_today}</p>
            <p className="text-sm text-slate-400 mt-1">{stats.failed_today} failed</p>
          </div>
          
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center space-x-2 mb-2">
              <Users className="w-5 h-5 text-purple-500" />
              <h3 className="text-slate-300 text-sm font-medium">Agents</h3>
            </div>
            <p className="text-2xl font-bold text-white">{stats.agents_available + stats.agents_busy}</p>
            <p className="text-sm text-slate-400 mt-1">{stats.agents_available} available</p>
          </div>
          
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-5 h-5 text-yellow-500" />
              <h3 className="text-slate-300 text-sm font-medium">Success Rate</h3>
            </div>
            <p className="text-2xl font-bold text-white">{stats.success_rate}%</p>
            <p className="text-sm text-slate-400 mt-1">{stats.average_completion_time}min avg</p>
          </div>
        </div>
      )}

      {/* Automated Distribution Panel */}
      {showDistributionPanel && (
        <div className="mb-8">
          <AutomatedDistributionPanel
            targets={targets}
            agents={agents}
            onDistributionComplete={handleDistributionComplete}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Missions Panel */}
        <div className="lg:col-span-2">
          <div className="bg-slate-800 rounded-lg border border-slate-700">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Active Missions</h2>
                
                <div className="flex items-center space-x-4">
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="assigned">Assigned</option>
                    <option value="en_route">En Route</option>
                    <option value="on_site">On Site</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </select>
                  
                  <select
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                  >
                    <option value="all">All Agents</option>
                    {agents.map(agent => (
                      <option key={agent.id} value={agent.id}>{agent.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                {filteredMissions.map(mission => (
                  <div key={mission.id} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${getPriorityColor(mission.priority)}`}></div>
                        <h3 className="font-medium text-white">{mission.target.name}</h3>
                        {mission.target.is_dangerous && (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(mission.status)}`}>
                        {mission.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 text-slate-300">
                          <MapPin className="w-4 h-4" />
                          <span>{mission.target.address}</span>
                        </div>
                        
                        {mission.target.phone && (
                          <div className="flex items-center space-x-2 text-slate-300">
                            <Phone className="w-4 h-4" />
                            <span>{mission.target.phone}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 text-slate-300">
                          <Clock className="w-4 h-4" />
                          <span>{mission.estimated_duration}min estimated</span>
                        </div>
                        
                        <div className="flex items-center space-x-2 text-slate-300">
                          <Navigation className="w-4 h-4" />
                          <span>{mission.distance} miles away</span>
                        </div>
                      </div>
                    </div>
                    
                    {mission.target.notes && (
                      <div className="mt-3 p-2 bg-slate-600/50 rounded border border-slate-600">
                        <p className="text-sm text-slate-300 italic">{mission.target.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Agents Panel */}
        <div>
          <div className="bg-slate-800 rounded-lg border border-slate-700">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-xl font-semibold text-white">Field Agents</h2>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                {agents.map(agent => (
                  <div key={agent.id} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-white">{agent.name}</h3>
                      <span className={`text-sm font-medium ${getAgentStatusColor(agent.status)}`}>
                        {agent.status.toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center space-x-2 text-slate-300">
                        <MapPin className="w-4 h-4" />
                        <span>{agent.current_location?.address || 'Location unknown'}</span>
                      </div>
                      
                      <div className="flex items-center space-x-2 text-slate-300">
                        <Phone className="w-4 h-4" />
                        <span>{agent.phone}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mt-3 pt-2 border-t border-slate-600">
                        <div>
                          <span className="text-slate-400">Active:</span>
                          <span className="text-white ml-1">{agent.active_missions}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Success:</span>
                          <span className="text-white ml-1">{agent.success_rate}%</span>
                        </div>
                      </div>
                      
                      <div className="text-xs text-slate-400 mt-2">
                        Last seen: {new Date(agent.current_location.last_updated).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MissionDashboard;