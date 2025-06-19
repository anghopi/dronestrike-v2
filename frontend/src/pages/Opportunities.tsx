import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  CurrencyDollarIcon,
  DocumentChartBarIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  EyeIcon,
  PaperAirplaneIcon
} from '@heroicons/react/24/outline';
import { leadService } from '../services/api';
import { notificationService } from '../services/notificationService';
import { Lead } from '../types';
import { HeaderTabs } from '../components/Layout/HeaderTabs';
import { EnhancedTable, ColumnConfig } from '../components/ui/enhanced-table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../hooks/useAuth';

const Opportunities: React.FC = () => {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showCreateOpportunityForm, setShowCreateOpportunityForm] = useState(false);
  const [requestedAmount, setRequestedAmount] = useState('');

  const queryClient = useQueryClient();

  // Fetch leads that can be converted to opportunities
  const { data: leadsData, isLoading } = useQuery({
    queryKey: ['leads-for-opportunities'],
    queryFn: () => leadService.getLeads({ 
      workflow_stage: 'botg_completed,opportunity_created',
      ordering: '-score_value'
    }),
  });

  // Fetch workflow pipeline
  const { data: pipelineData } = useQuery({
    queryKey: ['workflow-pipeline'],
    queryFn: () => leadService.getWorkflowPipeline(),
  });

  // Advance workflow mutation
  const advanceWorkflowMutation = useMutation({
    mutationFn: ({ leadId, currentStage }: { leadId: number; currentStage?: string }) =>
      leadService.advanceWorkflow(leadId, currentStage),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leads-for-opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-pipeline'] });
      
      const lead = leadsData?.results.find(l => l.id === variables.leadId);
      notificationService.workflowAdvanced(
        lead?.full_name || 'Lead',
        result.new_stage || 'next stage'
      );
    },
    onError: (error: any) => {
      notificationService.error(
        'Workflow Advancement Failed',
        error.message || 'Unable to advance workflow'
      );
    },
  });

  // Create opportunity mutation
  const createOpportunityMutation = useMutation({
    mutationFn: ({ leadId, amount }: { leadId: number; amount: number }) =>
      leadService.createOpportunity(leadId, amount),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leads-for-opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-pipeline'] });
      
      const lead = leadsData?.results.find(l => l.id === variables.leadId);
      notificationService.opportunityCreated(
        lead?.full_name || 'Lead',
        variables.amount
      );
      
      setShowCreateOpportunityForm(false);
      setSelectedLead(null);
      setRequestedAmount('');
    },
    onError: (error: any) => {
      notificationService.error(
        'Opportunity Creation Failed',
        error.message || 'Unable to create opportunity'
      );
    },
  });

  const handleAdvanceWorkflow = (lead: Lead) => {
    advanceWorkflowMutation.mutate({
      leadId: lead.id,
      currentStage: lead.workflow_stage
    });
  };

  const handleCreateOpportunity = () => {
    if (!selectedLead || !requestedAmount) return;

    const amount = parseFloat(requestedAmount);
    if (isNaN(amount) || amount <= 0) {
      notificationService.error('Invalid Amount', 'Please enter a valid loan amount');
      return;
    }

    createOpportunityMutation.mutate({
      leadId: selectedLead.id,
      amount
    });
  };

  const getWorkflowStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      'lead_identified': 'bg-gray-600',
      'botg_assigned': 'bg-blue-600',
      'botg_in_progress': 'bg-yellow-600',
      'botg_completed': 'bg-green-600',
      'opportunity_created': 'bg-purple-600',
      'tlc_loan_originated': 'bg-indigo-600',
      'tlc_client_onboarded': 'bg-pink-600',
      'loan_servicing': 'bg-emerald-600',
    };
    return colors[stage] || 'bg-gray-600';
  };

  const getWorkflowStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      'lead_identified': 'Lead Identified',
      'botg_assigned': 'BOTG Assigned',
      'botg_in_progress': 'BOTG In Progress',
      'botg_completed': 'BOTG Completed',
      'opportunity_created': 'Opportunity Created',
      'tlc_loan_originated': 'TLC Loan Originated',
      'tlc_client_onboarded': 'Client Onboarded',
      'loan_servicing': 'Loan Servicing',
    };
    return labels[stage] || stage;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading opportunities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Investment Opportunities</h1>
            <p className="text-gray-400">
              Convert qualified leads into investment opportunities
            </p>
          </div>
        </div>

        {/* Workflow Pipeline Overview */}
        {pipelineData && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Workflow Pipeline</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              {pipelineData.pipeline.map((stage: any) => (
                <div key={stage.stage} className="text-center">
                  <div className={`${getWorkflowStageColor(stage.stage)} rounded-lg p-4 mb-2`}>
                    <div className="text-2xl font-bold text-white">{stage.count}</div>
                  </div>
                  <p className="text-xs text-gray-400">{getWorkflowStageLabel(stage.stage)}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-400">
                Total in Pipeline: {pipelineData.total_in_pipeline} leads
              </p>
            </div>
          </div>
        )}

        {/* Qualified Leads */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Qualified Leads</h2>
          
          {!leadsData?.results.length ? (
            <div className="text-center py-8">
              <p className="text-gray-400">No qualified leads available for opportunities</p>
              <p className="text-sm text-gray-500 mt-2">
                Leads need to complete BOTG process to be eligible
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {leadsData.results.map((lead) => (
                <div key={lead.id} className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-white font-semibold">{lead.full_name}</h3>
                      <p className="text-gray-400 text-sm">{lead.email}</p>
                      {lead.phone_cell && (
                        <p className="text-gray-400 text-sm">{lead.phone_cell}</p>
                      )}
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-400">{lead.score_value}</div>
                      <div className="text-xs text-gray-400">Score</div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getWorkflowStageColor(lead.workflow_stage)} text-white`}>
                      {getWorkflowStageLabel(lead.workflow_stage)}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {lead.workflow_stage !== 'loan_servicing' && (
                      <button
                        onClick={() => handleAdvanceWorkflow(lead)}
                        disabled={advanceWorkflowMutation.isPending}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm py-2 px-3 rounded transition-colors"
                      >
                        {advanceWorkflowMutation.isPending ? 'Processing...' : 'Advance Workflow'}
                      </button>
                    )}
                    
                    {(lead.workflow_stage === 'botg_completed' || lead.workflow_stage === 'opportunity_created') && (
                      <button
                        onClick={() => {
                          setSelectedLead(lead);
                          setShowCreateOpportunityForm(true);
                        }}
                        className="w-full bg-green-600 hover:bg-green-700 text-white text-sm py-2 px-3 rounded transition-colors"
                      >
                        Create Opportunity
                      </button>
                    )}
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Opportunity Modal */}
        {showCreateOpportunityForm && selectedLead && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white">
                    Create Investment Opportunity
                  </h2>
                  <button
                    onClick={() => {
                      setShowCreateOpportunityForm(false);
                      setSelectedLead(null);
                      setRequestedAmount('');
                    }}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-white font-medium mb-2">{selectedLead.full_name}</h3>
                    <p className="text-gray-400 text-sm">{selectedLead.email}</p>
                    <p className="text-gray-400 text-sm">Score: {selectedLead.score_value}/100</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Requested Loan Amount
                    </label>
                    <input
                      type="number"
                      value={requestedAmount}
                      onChange={(e) => setRequestedAmount(e.target.value)}
                      placeholder="Enter amount (e.g., 75000)"
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button
                      onClick={handleCreateOpportunity}
                      disabled={createOpportunityMutation.isPending || !requestedAmount}
                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-2 px-4 rounded transition-colors"
                    >
                      {createOpportunityMutation.isPending ? 'Creating...' : 'Create Opportunity'}
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateOpportunityForm(false);
                        setSelectedLead(null);
                        setRequestedAmount('');
                      }}
                      className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Opportunities;