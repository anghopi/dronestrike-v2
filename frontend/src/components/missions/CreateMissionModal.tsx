import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  XMarkIcon,
  MapPinIcon,
  UserIcon,
  CalendarIcon,
  ClockIcon,
  CameraIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';

interface CreateMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface Lead {
  id: number;
  full_name: string;
  property_address: string;
  phone: string;
  email: string;
  property_value: number;
  lead_source: string;
}

interface Agent {
  id: number;
  name: string;
  phone: string;
  email: string;
  active_missions: number;
  success_rate: number;
  specialties: string[];
}

// Mock services - replace with actual API calls
const mockServices = {
  getAvailableLeads: async (): Promise<Lead[]> => {
    return [
      {
        id: 1,
        full_name: 'John Smith',
        property_address: '123 Main St, Dallas, TX 75201',
        phone: '+1-555-0123',
        email: 'john.smith@email.com',
        property_value: 250000,
        lead_source: 'online_inquiry'
      },
      {
        id: 2,
        full_name: 'Sarah Johnson',
        property_address: '456 Oak Ave, Dallas, TX 75202',
        phone: '+1-555-0124',
        email: 'sarah.j@email.com',
        property_value: 180000,
        lead_source: 'referral'
      },
      {
        id: 3,
        full_name: 'Mike Wilson',
        property_address: '789 Pine St, Dallas, TX 75203',
        phone: '+1-555-0125',
        email: 'mike.wilson@email.com',
        property_value: 320000,
        lead_source: 'marketing_campaign'
      }
    ];
  },

  getAvailableAgents: async (): Promise<Agent[]> => {
    return [
      {
        id: 1,
        name: 'Agent Rodriguez',
        phone: '+1-555-0201',
        email: 'rodriguez@dronestrike.com',
        active_missions: 2,
        success_rate: 92,
        specialties: ['property_assessment', 'follow_up_inspection']
      },
      {
        id: 2,
        name: 'Agent Martinez',
        phone: '+1-555-0202',
        email: 'martinez@dronestrike.com',
        active_missions: 1,
        success_rate: 88,
        specialties: ['property_assessment', 'documentation']
      },
      {
        id: 3,
        name: 'Agent Thompson',
        phone: '+1-555-0203',
        email: 'thompson@dronestrike.com',
        active_missions: 0,
        success_rate: 95,
        specialties: ['follow_up_inspection', 'client_relations']
      }
    ];
  },

  createMission: async (missionData: any) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      success: true,
      mission_id: `M-2025-${String(Date.now()).slice(-3)}`,
      message: 'Mission created successfully'
    };
  }
};

export const CreateMissionModal: React.FC<CreateMissionModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    selectedLead: null as Lead | null,
    selectedAgent: null as Agent | null,
    missionType: 'property_assessment',
    priority: 'medium',
    scheduledDate: '',
    scheduledTime: '',
    estimatedDuration: 45,
    photosRequired: 4,
    safetyLevel: 'green',
    specialInstructions: '',
    notes: ''
  });

  const [currentStep, setCurrentStep] = useState(1);
  const queryClient = useQueryClient();

  // Fetch available leads and agents
  const { data: availableLeads = [] } = useQuery({
    queryKey: ['available-leads'],
    queryFn: mockServices.getAvailableLeads,
    enabled: isOpen
  });

  const { data: availableAgents = [] } = useQuery({
    queryKey: ['available-agents'],
    queryFn: mockServices.getAvailableAgents,
    enabled: isOpen
  });

  // Create mission mutation
  const createMissionMutation = useMutation({
    mutationFn: mockServices.createMission,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      onSuccess?.();
      onClose();
      // Reset form
      setFormData({
        selectedLead: null,
        selectedAgent: null,
        missionType: 'property_assessment',
        priority: 'medium',
        scheduledDate: '',
        scheduledTime: '',
        estimatedDuration: 45,
        photosRequired: 4,
        safetyLevel: 'green',
        specialInstructions: '',
        notes: ''
      });
      setCurrentStep(1);
    }
  });

  const handleSubmit = () => {
    if (!formData.selectedLead || !formData.selectedAgent) return;

    const missionData = {
      target_lead_id: formData.selectedLead.id,
      assigned_agent_id: formData.selectedAgent.id,
      mission_type: formData.missionType,
      priority: formData.priority,
      scheduled_date: formData.scheduledDate,
      scheduled_time: formData.scheduledTime,
      estimated_duration: formData.estimatedDuration,
      photos_required: formData.photosRequired,
      safety_level: formData.safetyLevel,
      special_instructions: formData.specialInstructions,
      notes: formData.notes
    };

    createMissionMutation.mutate(missionData);
  };

  const canProceedToStep2 = formData.selectedLead !== null;
  const canProceedToStep3 = canProceedToStep2 && formData.selectedAgent !== null;
  const canSubmit = canProceedToStep3 && formData.scheduledDate && formData.scheduledTime;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-gray-600/50 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50 bg-gradient-to-r from-brand-color/10 to-brand-color-light/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-color/20 rounded-lg border border-brand-color/30">
              <MapPinIcon className="h-6 w-6 text-brand-color" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Create New Mission</h2>
              <p className="text-sm text-gray-400">Deploy BOTG agent for property assessment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="p-6 border-b border-gray-700/50">
          <div className="flex items-center justify-between mb-4">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 ${
                  currentStep >= step 
                    ? 'bg-brand-color border-brand-color text-white' 
                    : 'border-gray-600 text-gray-400'
                }`}>
                  {currentStep > step ? <CheckCircleIcon className="h-5 w-5" /> : step}
                </div>
                {step < 3 && (
                  <div className={`flex-1 h-0.5 mx-4 transition-all duration-300 ${
                    currentStep > step ? 'bg-brand-color' : 'bg-gray-600'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm">
            <span className={currentStep >= 1 ? 'text-white' : 'text-gray-400'}>Select Target</span>
            <span className={currentStep >= 2 ? 'text-white' : 'text-gray-400'}>Assign Agent</span>
            <span className={currentStep >= 3 ? 'text-white' : 'text-gray-400'}>Mission Details</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Select Target Lead */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">Select Target Property</h3>
                <p className="text-gray-400 text-sm">Choose a qualified lead for the BOTG mission</p>
              </div>

              <div className="grid gap-4">
                {availableLeads.map((lead) => (
                  <div
                    key={lead.id}
                    onClick={() => setFormData(prev => ({ ...prev, selectedLead: lead }))}
                    className={`p-4 rounded-xl border cursor-pointer transition-all duration-300 hover:shadow-lg ${
                      formData.selectedLead?.id === lead.id
                        ? 'border-brand-color bg-brand-color/10 shadow-lg'
                        : 'border-gray-600/50 bg-gray-800/30 hover:border-gray-500/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-2 bg-blue-500/20 rounded-lg">
                            <UserIcon className="h-5 w-5 text-blue-400" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-white">{lead.full_name}</h4>
                            <p className="text-sm text-gray-400">{lead.email}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Property Address</p>
                            <p className="text-sm text-white">{lead.property_address}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Property Value</p>
                            <p className="text-sm text-green-400 font-semibold">
                              ${lead.property_value.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Lead Source</p>
                            <Badge variant="secondary" className="text-xs">
                              {lead.lead_source.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      {formData.selectedLead?.id === lead.id && (
                        <CheckCircleIcon className="h-6 w-6 text-brand-color ml-4" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Select Agent */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">Assign BOTG Agent</h3>
                <p className="text-gray-400 text-sm">Select the best available agent for this mission</p>
              </div>

              <div className="grid gap-4">
                {availableAgents.map((agent) => (
                  <div
                    key={agent.id}
                    onClick={() => setFormData(prev => ({ ...prev, selectedAgent: agent }))}
                    className={`p-4 rounded-xl border cursor-pointer transition-all duration-300 hover:shadow-lg ${
                      formData.selectedAgent?.id === agent.id
                        ? 'border-brand-color bg-brand-color/10 shadow-lg'
                        : 'border-gray-600/50 bg-gray-800/30 hover:border-gray-500/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-2 bg-green-500/20 rounded-lg">
                            <UserIcon className="h-5 w-5 text-green-400" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-white">{agent.name}</h4>
                            <p className="text-sm text-gray-400">{agent.email}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Active Missions</p>
                            <p className="text-sm text-white font-semibold">{agent.active_missions}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Success Rate</p>
                            <p className="text-sm text-green-400 font-semibold">{agent.success_rate}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Phone</p>
                            <p className="text-sm text-white font-mono">{agent.phone}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Specialties</p>
                            <div className="flex flex-wrap gap-1">
                              {agent.specialties.slice(0, 2).map((specialty, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {specialty.replace(/_/g, ' ')}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      {formData.selectedAgent?.id === agent.id && (
                        <CheckCircleIcon className="h-6 w-6 text-brand-color ml-4" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Mission Details */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">Mission Configuration</h3>
                <p className="text-gray-400 text-sm">Configure mission parameters and schedule</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Mission Type</label>
                    <select
                      value={formData.missionType}
                      onChange={(e) => setFormData(prev => ({ ...prev, missionType: e.target.value }))}
                      className="w-full p-3 bg-gray-800/60 border border-gray-600/50 rounded-lg text-white focus:ring-2 focus:ring-brand-color/50 focus:border-brand-color/50"
                    >
                      <option value="property_assessment">🏠 Property Assessment</option>
                      <option value="follow_up_inspection">🔍 Follow-up Inspection</option>
                      <option value="documentation">📋 Documentation</option>
                      <option value="client_meeting">🤝 Client Meeting</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Priority Level</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                      className="w-full p-3 bg-gray-800/60 border border-gray-600/50 rounded-lg text-white focus:ring-2 focus:ring-brand-color/50 focus:border-brand-color/50"
                    >
                      <option value="low">🟢 Low Priority</option>
                      <option value="medium">🟡 Medium Priority</option>
                      <option value="high">🟠 High Priority</option>
                      <option value="urgent">🔴 Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Safety Level</label>
                    <select
                      value={formData.safetyLevel}
                      onChange={(e) => setFormData(prev => ({ ...prev, safetyLevel: e.target.value }))}
                      className="w-full p-3 bg-gray-800/60 border border-gray-600/50 rounded-lg text-white focus:ring-2 focus:ring-brand-color/50 focus:border-brand-color/50"
                    >
                      <option value="green">🟢 Green - Safe Area</option>
                      <option value="yellow">🟡 Yellow - Caution Required</option>
                      <option value="red">🔴 Red - High Risk Area</option>
                    </select>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        <CalendarIcon className="h-4 w-4 inline mr-1" />
                        Scheduled Date
                      </label>
                      <Input
                        type="date"
                        value={formData.scheduledDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                        className="w-full p-3 bg-gray-800/60 border border-gray-600/50 rounded-lg text-white focus:ring-2 focus:ring-brand-color/50 focus:border-brand-color/50"
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        <ClockIcon className="h-4 w-4 inline mr-1" />
                        Scheduled Time
                      </label>
                      <Input
                        type="time"
                        value={formData.scheduledTime}
                        onChange={(e) => setFormData(prev => ({ ...prev, scheduledTime: e.target.value }))}
                        className="w-full p-3 bg-gray-800/60 border border-gray-600/50 rounded-lg text-white focus:ring-2 focus:ring-brand-color/50 focus:border-brand-color/50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        <ClockIcon className="h-4 w-4 inline mr-1" />
                        Duration (minutes)
                      </label>
                      <Input
                        type="number"
                        value={formData.estimatedDuration}
                        onChange={(e) => setFormData(prev => ({ ...prev, estimatedDuration: parseInt(e.target.value) }))}
                        className="w-full p-3 bg-gray-800/60 border border-gray-600/50 rounded-lg text-white focus:ring-2 focus:ring-brand-color/50 focus:border-brand-color/50"
                        min="15"
                        max="240"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        <CameraIcon className="h-4 w-4 inline mr-1" />
                        Photos Required
                      </label>
                      <Input
                        type="number"
                        value={formData.photosRequired}
                        onChange={(e) => setFormData(prev => ({ ...prev, photosRequired: parseInt(e.target.value) }))}
                        className="w-full p-3 bg-gray-800/60 border border-gray-600/50 rounded-lg text-white focus:ring-2 focus:ring-brand-color/50 focus:border-brand-color/50"
                        min="1"
                        max="20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      <DocumentTextIcon className="h-4 w-4 inline mr-1" />
                      Special Instructions
                    </label>
                    <textarea
                      value={formData.specialInstructions}
                      onChange={(e) => setFormData(prev => ({ ...prev, specialInstructions: e.target.value }))}
                      className="w-full p-3 bg-gray-800/60 border border-gray-600/50 rounded-lg text-white focus:ring-2 focus:ring-brand-color/50 focus:border-brand-color/50 resize-none"
                      rows={3}
                      placeholder="Enter any special instructions for the agent..."
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-700/50 bg-gray-800/30">
          <div className="flex items-center gap-4">
            {currentStep > 1 && (
              <Button
                variant="outline"
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="px-4 py-2"
              >
                Previous
              </Button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="px-4 py-2"
            >
              Cancel
            </Button>
            
            {currentStep < 3 ? (
              <Button
                onClick={() => setCurrentStep(prev => prev + 1)}
                disabled={
                  (currentStep === 1 && !canProceedToStep2) ||
                  (currentStep === 2 && !canProceedToStep3)
                }
                className="btn-primary px-6 py-2"
              >
                Next Step
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || createMissionMutation.isPending}
                className="btn-primary px-6 py-2"
              >
                {createMissionMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </>
                ) : (
                  'Deploy Mission'
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};