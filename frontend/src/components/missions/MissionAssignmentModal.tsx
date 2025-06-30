import React, { useState, useEffect } from 'react';
import { X, MapPin, Clock, AlertTriangle, Users, Navigation } from 'lucide-react';
import { Target } from '../../types/target';
import { Mission } from '../../types/mission';

interface Agent {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'available' | 'busy' | 'offline';
  current_location?: {
    lat: number;
    lng: number;
    address?: string;
  };
  active_missions: number;
  completed_missions: number;
  success_rate: number;
  distance?: number;
}

interface MissionAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  targets: Target[];
  onAssignMissions: (assignments: MissionAssignment[]) => void;
}

interface MissionAssignment {
  targetId: number;
  agentId: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimatedDuration: number;
  deadline: string;
  notes?: string;
}

const MissionAssignmentModal: React.FC<MissionAssignmentModalProps> = ({
  isOpen,
  onClose,
  targets,
  onAssignMissions
}) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [assignments, setAssignments] = useState<MissionAssignment[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [bulkSettings, setBulkSettings] = useState({
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    estimatedDuration: 30,
    deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAgents();
      initializeAssignments();
    }
  }, [isOpen, targets]);

  const loadAgents = async () => {
    setIsLoading(true);
    try {
      // Mock agent data - in real app this would come from API
      const mockAgents: Agent[] = [
        {
          id: 'agent-001',
          name: 'John Martinez',
          email: 'j.martinez@dronestrike.com',
          phone: '(555) 123-4567',
          status: 'available',
          current_location: {
            lat: 29.7604,
            lng: -95.3698,
            address: 'Downtown Houston, TX'
          },
          active_missions: 2,
          completed_missions: 47,
          success_rate: 94.2
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
            address: 'The Heights, Houston, TX'
          },
          active_missions: 1,
          completed_missions: 32,
          success_rate: 96.8
        },
        {
          id: 'agent-003',
          name: 'Mike Rodriguez',
          email: 'm.rodriguez@dronestrike.com', 
          phone: '(555) 456-7890',
          status: 'busy',
          current_location: {
            lat: 29.7280,
            lng: -95.3951,
            address: 'Westside Houston, TX'
          },
          active_missions: 4,
          completed_missions: 28,
          success_rate: 89.3
        }
      ];

      // Calculate distances for each agent to each target
      const agentsWithDistances = mockAgents.map(agent => ({
        ...agent,
        distance: agent.current_location ? 
          calculateDistance(
            agent.current_location.lat,
            agent.current_location.lng,
            targets[0]?.latitude || 29.7604,
            targets[0]?.longitude || -95.3698
          ) : undefined
      }));

      setAgents(agentsWithDistances);
    } catch (error) {
      console.error('Failed to load agents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c * 10) / 10; // Round to 1 decimal
  };

  const initializeAssignments = () => {
    const initialAssignments = targets.map(target => ({
      targetId: target.id,
      agentId: '',
      priority: bulkSettings.priority,
      estimatedDuration: bulkSettings.estimatedDuration,
      deadline: bulkSettings.deadline,
      notes: ''
    }));
    setAssignments(initialAssignments);
  };

  const updateAssignment = (targetId: number, field: keyof MissionAssignment, value: any) => {
    setAssignments(prev => prev.map(assignment =>
      assignment.targetId === targetId
        ? { ...assignment, [field]: value }
        : assignment
    ));
  };

  const applyBulkSettings = () => {
    setAssignments(prev => prev.map(assignment => ({
      ...assignment,
      priority: bulkSettings.priority,
      estimatedDuration: bulkSettings.estimatedDuration,
      deadline: bulkSettings.deadline
    })));
  };

  const assignToSelectedAgent = () => {
    if (!selectedAgent) return;
    
    setAssignments(prev => prev.map(assignment => ({
      ...assignment,
      agentId: selectedAgent
    })));
  };

  const handleSubmit = () => {
    const validAssignments = assignments.filter(a => a.agentId);
    if (validAssignments.length === 0) {
      alert('Please assign at least one target to an agent.');
      return;
    }
    
    onAssignMissions(validAssignments);
    onClose();
  };

  const getAgentStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'text-green-500';
      case 'busy': return 'text-yellow-500';
      case 'offline': return 'text-red-500';
      default: return 'text-gray-500';
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className="text-2xl font-bold text-white">Assign Missions</h2>
            <p className="text-slate-300 text-sm mt-1">
              Assigning {targets.length} target{targets.length !== 1 ? 's' : ''} to field agents
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex h-[calc(90vh-120px)]">
          {/* Agent Selection Panel */}
          <div className="w-1/3 border-r border-slate-700 p-6 overflow-y-auto">
            <h3 className="text-lg font-semibold text-white mb-4">Available Agents</h3>
            
            {/* Bulk Actions */}
            <div className="bg-slate-700/50 rounded-lg p-4 mb-6">
              <h4 className="text-sm font-medium text-white mb-3">Bulk Settings</h4>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Priority</label>
                  <select
                    value={bulkSettings.priority}
                    onChange={(e) => setBulkSettings(prev => ({ ...prev, priority: e.target.value as any }))}
                    className="w-full bg-slate-600 border border-slate-500 rounded px-3 py-2 text-white text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Duration (min)</label>
                  <input
                    type="number"
                    value={bulkSettings.estimatedDuration}
                    onChange={(e) => setBulkSettings(prev => ({ ...prev, estimatedDuration: parseInt(e.target.value) }))}
                    className="w-full bg-slate-600 border border-slate-500 rounded px-3 py-2 text-white text-sm"
                    min="15"
                    max="180"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Deadline</label>
                  <input
                    type="datetime-local"
                    value={bulkSettings.deadline}
                    onChange={(e) => setBulkSettings(prev => ({ ...prev, deadline: e.target.value }))}
                    className="w-full bg-slate-600 border border-slate-500 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
                
                <button
                  onClick={applyBulkSettings}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded text-sm font-medium transition-colors"
                >
                  Apply to All
                </button>
              </div>
            </div>

            {/* Agent List */}
            <div className="space-y-3">
              {agents.map(agent => (
                <div
                  key={agent.id}
                  className={`bg-slate-700/50 rounded-lg p-4 border-2 cursor-pointer transition-colors ${
                    selectedAgent === agent.id ? 'border-blue-500' : 'border-transparent hover:border-slate-600'
                  }`}
                  onClick={() => setSelectedAgent(agent.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-white">{agent.name}</h4>
                    <span className={`text-xs font-medium ${getAgentStatusColor(agent.status)}`}>
                      {agent.status.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="text-xs text-slate-300 space-y-1">
                    <div className="flex items-center space-x-1">
                      <MapPin size={12} />
                      <span>{agent.current_location?.address || 'Location unknown'}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span>Active: {agent.active_missions}</span>
                      <span>Success: {agent.success_rate}%</span>
                    </div>
                    
                    {agent.distance && (
                      <div className="flex items-center space-x-1">
                        <Navigation size={12} />
                        <span>{agent.distance} mi away</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {selectedAgent && (
              <button
                onClick={assignToSelectedAgent}
                className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded font-medium transition-colors"
              >
                Assign All to {agents.find(a => a.id === selectedAgent)?.name}
              </button>
            )}
          </div>

          {/* Mission Assignment Panel */}
          <div className="flex-1 p-6 overflow-y-auto">
            <h3 className="text-lg font-semibold text-white mb-4">Mission Assignments</h3>
            
            <div className="space-y-4">
              {targets.map((target, index) => {
                const assignment = assignments.find(a => a.targetId === target.id);
                const assignedAgent = agents.find(a => a.id === assignment?.agentId);
                
                return (
                  <div key={target.id} className="bg-slate-700/50 rounded-lg p-4">
                    {/* Target Info */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-white">
                          {target.first_name} {target.last_name}
                        </h4>
                        <p className="text-sm text-slate-300">
                          {target.mailing_address_1}, {target.mailing_city}, {target.mailing_state}
                        </p>
                      </div>
                      
                      {target.is_dangerous && (
                        <AlertTriangle className="text-red-500" size={20} />
                      )}
                    </div>

                    {/* Assignment Controls */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs text-slate-300 mb-1">Agent</label>
                        <select
                          value={assignment?.agentId || ''}
                          onChange={(e) => updateAssignment(target.id, 'agentId', e.target.value)}
                          className="w-full bg-slate-600 border border-slate-500 rounded px-3 py-2 text-white text-sm"
                        >
                          <option value="">Select Agent</option>
                          {agents.filter(a => a.status === 'available').map(agent => (
                            <option key={agent.id} value={agent.id}>
                              {agent.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs text-slate-300 mb-1">Priority</label>
                        <select
                          value={assignment?.priority || 'medium'}
                          onChange={(e) => updateAssignment(target.id, 'priority', e.target.value)}
                          className="w-full bg-slate-600 border border-slate-500 rounded px-3 py-2 text-white text-sm"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs text-slate-300 mb-1">Duration</label>
                        <input
                          type="number"
                          value={assignment?.estimatedDuration || 30}
                          onChange={(e) => updateAssignment(target.id, 'estimatedDuration', parseInt(e.target.value))}
                          className="w-full bg-slate-600 border border-slate-500 rounded px-3 py-2 text-white text-sm"
                          min="15"
                          max="180"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs text-slate-300 mb-1">Deadline</label>
                        <input
                          type="datetime-local"
                          value={assignment?.deadline || bulkSettings.deadline}
                          onChange={(e) => updateAssignment(target.id, 'deadline', e.target.value)}
                          className="w-full bg-slate-600 border border-slate-500 rounded px-3 py-2 text-white text-sm"
                        />
                      </div>
                    </div>

                    {/* Assignment Status */}
                    {assignedAgent && (
                      <div className="mt-3 p-3 bg-slate-600/50 rounded border border-slate-600">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${getPriorityColor(assignment?.priority || 'medium')}`}></div>
                            <span className="text-sm text-white">Assigned to {assignedAgent.name}</span>
                          </div>
                          <div className="text-xs text-slate-300">
                            {assignment?.estimatedDuration}min • {assignment?.priority}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-700">
          <div className="text-slate-300 text-sm">
            {assignments.filter(a => a.agentId).length} of {targets.length} targets assigned
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={assignments.filter(a => a.agentId).length === 0}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:text-slate-400 text-white rounded-lg font-medium transition-colors"
            >
              Create Missions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MissionAssignmentModal;