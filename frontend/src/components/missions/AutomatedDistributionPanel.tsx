import React, { useState, useEffect } from 'react';
import {
  Zap,
  MapPin,
  Users,
  Settings,
  Play,
  Pause,
  BarChart3,
  Clock,
  Route,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Filter,
  Target as TargetIcon,
  Cpu
} from 'lucide-react';
import { 
  missionDistributionService, 
  Agent, 
  MissionAssignmentResult, 
  AssignmentCriteria, 
  SuitabilityFilter 
} from '../../services/missionDistributionService';
import { routeOptimizationService } from '../../services/routeOptimizationService';
import { Target } from '../../types/target';

interface DistributionStats {
  total_targets: number;
  available_agents: number;
  assigned_targets: number;
  unassigned_targets: number;
  optimized_routes: number;
  estimated_time_savings: number;
  average_efficiency_score: number;
}

interface AutomatedDistributionPanelProps {
  targets: Target[];
  agents: Agent[];
  onDistributionComplete: (result: MissionAssignmentResult) => void;
}

const AutomatedDistributionPanel: React.FC<AutomatedDistributionPanelProps> = ({
  targets,
  agents,
  onDistributionComplete
}) => {
  const [isDistributing, setIsDistributing] = useState(false);
  const [distributionResult, setDistributionResult] = useState<MissionAssignmentResult | null>(null);
  const [stats, setStats] = useState<DistributionStats | null>(null);
  const [autoMode, setAutoMode] = useState(false);
  const [lastDistribution, setLastDistribution] = useState<string | null>(null);

  // Distribution settings
  const [criteria, setCriteria] = useState<AssignmentCriteria>({
    max_distance: 25,
    priority_weights: {
      distance: 0.4,
      agent_performance: 0.2,
      workload_balance: 0.3,
      specialization_match: 0.1
    },
    require_route_optimization: true,
    respect_territory_preferences: true,
    allow_workload_overflow: false
  });

  const [filters, setFilters] = useState<SuitabilityFilter>({
    exclude_recent_visits: true,
    exclude_declined_by_agent: true,
    exclude_active_opportunities: true,
    exclude_different_property_types: true,
    exclude_language_mismatch: false,
    exclude_dangerous_for_non_qualified: true
  });

  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  useEffect(() => {
    updateStats();
  }, [targets, agents, distributionResult]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoMode) {
      // Auto-distribute every 5 minutes when enabled
      interval = setInterval(() => {
        if (!isDistributing) {
          handleAutoDistribute();
        }
      }, 5 * 60 * 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoMode, isDistributing]);

  const updateStats = () => {
    const availableAgents = agents.filter(agent => 
      agent.status === 'available' && agent.monthly_declines < agent.max_decline
    );

    const assignedCount = distributionResult ? 
      distributionResult.assignments.reduce((sum, assignment) => sum + assignment.target_ids.length, 0) : 0;

    const optimizedRoutes = distributionResult ? 
      distributionResult.assignments.filter(a => a.target_ids.length > 1).length : 0;

    const timeSavings = distributionResult ? 
      distributionResult.assignments.reduce((sum, assignment) => {
        // Estimate 15% time savings from optimization
        return sum + (assignment.estimated_route_time * 0.15);
      }, 0) : 0;

    const efficiencyScore = distributionResult && distributionResult.assignments.length > 0 ? 
      distributionResult.assignments.reduce((sum, assignment) => sum + assignment.priority_score, 0) / 
      distributionResult.assignments.length : 0;

    setStats({
      total_targets: targets.length,
      available_agents: availableAgents.length,
      assigned_targets: assignedCount,
      unassigned_targets: targets.length - assignedCount,
      optimized_routes: optimizedRoutes,
      estimated_time_savings: timeSavings,
      average_efficiency_score: efficiencyScore * 100
    });
  };

  const handleManualDistribute = async () => {
    await performDistribution();
  };

  const handleAutoDistribute = async () => {
    if (targets.length === 0 || agents.length === 0) return;
    await performDistribution();
  };

  const performDistribution = async () => {
    setIsDistributing(true);
    
    try {
      console.log('Starting automated mission distribution...');
      console.log(`Targets: ${targets.length}, Agents: ${agents.length}`);

      const result = await missionDistributionService.distributeTargetsToAgents(
        targets,
        agents,
        criteria,
        filters
      );

      console.log('Distribution result:', result);

      setDistributionResult(result);
      setLastDistribution(new Date().toISOString());
      onDistributionComplete(result);

      if (result.success) {
        console.log(`Successfully assigned ${result.assignments.length} missions`);
      } else {
        console.error('Distribution failed:', result.error);
      }

    } catch (error) {
      console.error('Distribution error:', error);
    } finally {
      setIsDistributing(false);
    }
  };

  const resetDistribution = () => {
    setDistributionResult(null);
    setLastDistribution(null);
  };

  const getStatusColor = (success: boolean) => {
    return success ? 'text-green-500' : 'text-red-500';
  };

  const getStatusIcon = (success: boolean) => {
    return success ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />;
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Cpu className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Automated Mission Distribution</h2>
            <p className="text-slate-300 text-sm">
              AI-powered assignment based on distance, performance, and workload
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="autoMode"
              checked={autoMode}
              onChange={(e) => setAutoMode(e.target.checked)}
              className="rounded border-slate-500 bg-slate-600 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="autoMode" className="text-slate-300 text-sm">Auto Mode</label>
          </div>

          <button
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center space-x-2"
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
            <div className="flex items-center space-x-2 mb-2">
              <TargetIcon className="w-4 h-4 text-blue-500" />
              <span className="text-slate-300 text-sm">Targets</span>
            </div>
            <p className="text-xl font-bold text-white">{stats.total_targets}</p>
            <p className="text-xs text-slate-400">{stats.assigned_targets} assigned</p>
          </div>

          <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
            <div className="flex items-center space-x-2 mb-2">
              <Users className="w-4 h-4 text-green-500" />
              <span className="text-slate-300 text-sm">Agents</span>
            </div>
            <p className="text-xl font-bold text-white">{stats.available_agents}</p>
            <p className="text-xs text-slate-400">available</p>
          </div>

          <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
            <div className="flex items-center space-x-2 mb-2">
              <Route className="w-4 h-4 text-purple-500" />
              <span className="text-slate-300 text-sm">Routes</span>
            </div>
            <p className="text-xl font-bold text-white">{stats.optimized_routes}</p>
            <p className="text-xs text-slate-400">optimized</p>
          </div>

          <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
            <div className="flex items-center space-x-2 mb-2">
              <BarChart3 className="w-4 h-4 text-yellow-500" />
              <span className="text-slate-300 text-sm">Efficiency</span>
            </div>
            <p className="text-xl font-bold text-white">{stats.average_efficiency_score.toFixed(1)}%</p>
            <p className="text-xs text-slate-400">score</p>
          </div>
        </div>
      )}

      {/* Advanced Settings */}
      {showAdvancedSettings && (
        <div className="bg-slate-700/30 rounded-lg p-4 mb-6 border border-slate-600">
          <h3 className="text-lg font-medium text-white mb-4">Distribution Settings</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Assignment Criteria */}
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-3">Assignment Criteria</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Max Distance (miles)</label>
                  <input
                    type="number"
                    value={criteria.max_distance}
                    onChange={(e) => setCriteria(prev => ({ ...prev, max_distance: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                    min="1"
                    max="100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Distance Weight</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={criteria.priority_weights.distance}
                      onChange={(e) => setCriteria(prev => ({
                        ...prev,
                        priority_weights: { ...prev.priority_weights, distance: parseFloat(e.target.value) }
                      }))}
                      className="w-full"
                    />
                    <span className="text-xs text-slate-400">{(criteria.priority_weights.distance * 100).toFixed(0)}%</span>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Performance Weight</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={criteria.priority_weights.agent_performance}
                      onChange={(e) => setCriteria(prev => ({
                        ...prev,
                        priority_weights: { ...prev.priority_weights, agent_performance: parseFloat(e.target.value) }
                      }))}
                      className="w-full"
                    />
                    <span className="text-xs text-slate-400">{(criteria.priority_weights.agent_performance * 100).toFixed(0)}%</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={criteria.require_route_optimization}
                      onChange={(e) => setCriteria(prev => ({ ...prev, require_route_optimization: e.target.checked }))}
                      className="rounded border-slate-500 bg-slate-600 text-blue-600"
                    />
                    <span className="text-sm text-slate-300">Route Optimization</span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={criteria.respect_territory_preferences}
                      onChange={(e) => setCriteria(prev => ({ ...prev, respect_territory_preferences: e.target.checked }))}
                      className="rounded border-slate-500 bg-slate-600 text-blue-600"
                    />
                    <span className="text-sm text-slate-300">Territory Preferences</span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={criteria.allow_workload_overflow}
                      onChange={(e) => setCriteria(prev => ({ ...prev, allow_workload_overflow: e.target.checked }))}
                      className="rounded border-slate-500 bg-slate-600 text-blue-600"
                    />
                    <span className="text-sm text-slate-300">Allow Workload Overflow</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Filtering Options */}
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-3">Suitability Filters</h4>
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filters.exclude_recent_visits}
                    onChange={(e) => setFilters(prev => ({ ...prev, exclude_recent_visits: e.target.checked }))}
                    className="rounded border-slate-500 bg-slate-600 text-blue-600"
                  />
                  <span className="text-sm text-slate-300">Exclude Recent Visits</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filters.exclude_declined_by_agent}
                    onChange={(e) => setFilters(prev => ({ ...prev, exclude_declined_by_agent: e.target.checked }))}
                    className="rounded border-slate-500 bg-slate-600 text-blue-600"
                  />
                  <span className="text-sm text-slate-300">Exclude Agent Declines</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filters.exclude_dangerous_for_non_qualified}
                    onChange={(e) => setFilters(prev => ({ ...prev, exclude_dangerous_for_non_qualified: e.target.checked }))}
                    className="rounded border-slate-500 bg-slate-600 text-blue-600"
                  />
                  <span className="text-sm text-slate-300">Safety Restrictions</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filters.exclude_different_property_types}
                    onChange={(e) => setFilters(prev => ({ ...prev, exclude_different_property_types: e.target.checked }))}
                    className="rounded border-slate-500 bg-slate-600 text-blue-600"
                  />
                  <span className="text-sm text-slate-300">Property Type Match</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filters.exclude_active_opportunities}
                    onChange={(e) => setFilters(prev => ({ ...prev, exclude_active_opportunities: e.target.checked }))}
                    className="rounded border-slate-500 bg-slate-600 text-blue-600"
                  />
                  <span className="text-sm text-slate-300">Exclude Active Opportunities</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Distribution Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleManualDistribute}
            disabled={isDistributing || targets.length === 0}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:text-slate-400 text-white rounded-lg font-medium transition-colors"
          >
            {isDistributing ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Zap className="w-5 h-5" />
            )}
            <span>{isDistributing ? 'Distributing...' : 'Start Distribution'}</span>
          </button>

          {distributionResult && (
            <button
              onClick={resetDistribution}
              className="flex items-center space-x-2 px-4 py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {lastDistribution && (
          <div className="text-sm text-slate-400">
            Last run: {new Date(lastDistribution).toLocaleTimeString()}
            {autoMode && <span className="ml-2 text-blue-400">(Auto Mode)</span>}
          </div>
        )}
      </div>

      {/* Distribution Results */}
      {distributionResult && (
        <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              {getStatusIcon(distributionResult.success)}
              <h3 className={`text-lg font-medium ${getStatusColor(distributionResult.success)}`}>
                Distribution {distributionResult.success ? 'Completed' : 'Failed'}
              </h3>
            </div>
            
            {distributionResult.route_optimization_applied && (
              <div className="flex items-center space-x-1 text-green-400 text-sm">
                <Route className="w-4 h-4" />
                <span>Route Optimized</span>
              </div>
            )}
          </div>

          {distributionResult.success ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-600/50 rounded p-3">
                  <div className="text-slate-300 text-sm">Assignments Created</div>
                  <div className="text-xl font-bold text-white">{distributionResult.assignments.length}</div>
                </div>

                <div className="bg-slate-600/50 rounded p-3">
                  <div className="text-slate-300 text-sm">Targets Assigned</div>
                  <div className="text-xl font-bold text-white">
                    {distributionResult.assignments.reduce((sum, a) => sum + a.target_ids.length, 0)}
                  </div>
                </div>

                <div className="bg-slate-600/50 rounded p-3">
                  <div className="text-slate-300 text-sm">Unassigned</div>
                  <div className="text-xl font-bold text-yellow-400">{distributionResult.unassigned_targets.length}</div>
                </div>
              </div>

              {/* Assignment Details */}
              <div className="max-h-64 overflow-y-auto space-y-2">
                {distributionResult.assignments.map((assignment, index) => (
                  <div key={index} className="bg-slate-600/30 rounded p-3 border border-slate-600">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-white">Agent {assignment.agent_id}</div>
                      <div className="text-sm text-slate-300">
                        {assignment.target_ids.length} target{assignment.target_ids.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-slate-400">Distance:</span>
                        <span className="text-white ml-1">{assignment.total_distance.toFixed(1)} mi</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Time:</span>
                        <span className="text-white ml-1">{assignment.estimated_route_time.toFixed(0)} min</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Score:</span>
                        <span className="text-white ml-1">{(assignment.priority_score * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-red-400 text-sm">{distributionResult.error}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default AutomatedDistributionPanel;