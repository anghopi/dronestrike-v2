import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TargetIntelImport } from '../components/advanced/TargetIntelImport';
import { EnhancedTable, ColumnConfig } from '../components/ui/enhanced-table';
import { leadService, propertyService } from '../services/api';
import { notificationService } from '../services/notificationService';
import { 
  ViewfinderCircleIcon as Target, 
  CircleStackIcon as Database, 
  DocumentTextIcon as FileText, 
  BoltIcon as Activity, 
  ShieldCheckIcon as Shield, 
  ClockIcon as Clock 
} from '@heroicons/react/24/outline';

interface IntelOperation {
  id: string;
  type: 'target' | 'property';
  fileName: string;
  recordCount: number;
  timestamp: Date;
  status: 'success' | 'failed' | 'processing';
  operatorId: string;
  compromisedCount?: number;
}

const IntelOperations: React.FC = () => {
  const [activeOperation, setActiveOperation] = useState<'target' | 'property' | null>(null);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [operationHistory, setOperationHistory] = useState<IntelOperation[]>([]);

  const queryClient = useQueryClient();

  // Fetch current dashboard stats for overview
  const { data: leadStats } = useQuery({
    queryKey: ['dashboard-lead-stats'],
    queryFn: () => leadService.getDashboardStats(),
  });

  const { data: propertyStats } = useQuery({
    queryKey: ['dashboard-property-stats'],
    queryFn: () => propertyService.getProperties({ page: 1 }),
  });

  // Import mutations
  const targetImportMutation = useMutation({
    mutationFn: (data: any[]) => leadService.bulkCreateLeads(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      notificationService.success(
        'Target Intelligence Processed',
        `${result.created_count} targets successfully added to system`
      );
      
      recordOperation('target', result.created_count, 'success');
      setShowImportWizard(false);
    },
    onError: (error: any) => {
      notificationService.error(
        'Intelligence Operation Failed',
        error.message || 'Failed to process target intelligence'
      );
      recordOperation('target', 0, 'failed');
    }
  });

  const propertyImportMutation = useMutation({
    mutationFn: (data: any[]) => propertyService.bulkCreateProperties(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      notificationService.success(
        'Property Intelligence Processed',
        `${result.created_count} properties successfully added to system`
      );
      
      recordOperation('property', result.created_count, 'success');
      setShowImportWizard(false);
    },
    onError: (error: any) => {
      notificationService.error(
        'Intelligence Operation Failed',
        error.message || 'Failed to process property intelligence'
      );
      recordOperation('property', 0, 'failed');
    }
  });

  const recordOperation = (type: 'target' | 'property', count: number, status: 'success' | 'failed') => {
    const operation: IntelOperation = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      fileName: 'intelligence_package.csv',
      recordCount: count,
      timestamp: new Date(),
      status,
      operatorId: 'current_user', // Would get from auth context
      compromisedCount: status === 'failed' ? count : 0
    };
    
    setOperationHistory(prev => [operation, ...prev.slice(0, 19)]); // Keep last 20
  };

  const handleIntelProcessed = async (data: any[]) => {
    if (activeOperation === 'target') {
      await targetImportMutation.mutateAsync(data);
    } else if (activeOperation === 'property') {
      await propertyImportMutation.mutateAsync(data);
    }
  };

  const startOperation = (operationType: 'target' | 'property') => {
    setActiveOperation(operationType);
    setShowImportWizard(true);
  };

  const abortMission = () => {
    setShowImportWizard(false);
    setActiveOperation(null);
  };

  const generateIntelTemplate = (type: 'target' | 'property') => {
    let csvContent = '';
    let fileName = '';

    if (type === 'target') {
      csvContent = `First Name,Last Name,Email,Phone,Address,City,State,ZIP,Property Address,Source,Status
John,Doe,john.doe@example.com,555-0123,123 Main St,Dallas,TX,75001,456 Oak Ave,OSINT,lead_identified
Jane,Smith,jane.smith@example.com,555-0456,789 Pine Rd,Austin,TX,78701,321 Elm St,HUMINT,botg_assigned
Mike,Johnson,mike.j@example.com,555-0789,654 Maple Dr,Houston,TX,77001,987 Cedar Ln,SIGINT,botg_completed`;
      fileName = 'target_intel_template.csv';
    } else {
      csvContent = `Address,City,State,ZIP,County,Property Type,Owner Name,Owner Phone,Owner Email,Estimated Value,SQFT,Year Built,Disposition
123 Oak St,Austin,TX,78701,Travis,single_family,John Smith,555-0123,john@email.com,250000,1500,2010,active
456 Pine Ave,Dallas,TX,75201,Dallas,multi_family,Jane Doe,555-0456,jane@email.com,350000,2100,2015,pending
789 Elm Dr,Houston,TX,77001,Harris,commercial,Bob Johnson,555-0789,bob@email.com,500000,3000,2008,active`;
      fileName = 'property_intel_template.csv';
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Operation history table columns
  const historyColumns: ColumnConfig<IntelOperation>[] = [
    {
      key: 'timestamp',
      title: 'Operation Time',
      dataIndex: 'timestamp',
      render: (value: Date) => (
        <div>
          <div className="font-medium">{value.toLocaleDateString()}</div>
          <div className="text-sm text-gray-500">{value.toLocaleTimeString()}</div>
        </div>
      )
    },
    {
      key: 'type',
      title: 'Intel Type',
      dataIndex: 'type',
      render: (value: string) => (
        <div className="flex items-center gap-2">
          {value === 'target' ? (
            <Target className="h-4 w-4 text-blue-500" />
          ) : (
            <Database className="h-4 w-4 text-green-500" />
          )}
          <span className="capitalize">{value}</span>
        </div>
      )
    },
    {
      key: 'fileName',
      title: 'Package',
      dataIndex: 'fileName',
      render: (value: string) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-400" />
          <span className="font-mono text-sm">{value}</span>
        </div>
      )
    },
    {
      key: 'status',
      title: 'Status',
      dataIndex: 'status',
      render: (value: string, record: IntelOperation) => {
        const statusConfig = {
          success: { color: 'bg-green-100 text-green-800', icon: Shield, label: 'Success' },
          failed: { color: 'bg-red-100 text-red-800', icon: Activity, label: 'Failed' },
          processing: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Processing' }
        };
        
        const config = statusConfig[value as keyof typeof statusConfig];
        const Icon = config.icon;
        
        return (
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
              <Icon className="h-3 w-3 mr-1" />
              {config.label}
            </span>
            {record.compromisedCount && record.compromisedCount > 0 && (
              <span className="text-xs text-red-600">
                {record.compromisedCount} compromised
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: 'recordCount',
      title: 'Records Processed',
      dataIndex: 'recordCount',
      render: (value: number) => (
        <span className="font-semibold text-blue-600">{value.toLocaleString()}</span>
      )
    },
    {
      key: 'operatorId',
      title: 'Operator',
      dataIndex: 'operatorId',
      render: (value: string) => (
        <span className="font-mono text-sm">{value}</span>
      )
    }
  ];

  if (showImportWizard && activeOperation) {
    return (
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">
              {activeOperation === 'target' ? 'Target' : 'Property'} Intelligence Import
            </h1>
            <p className="text-gray-400">
              Processing {activeOperation} intelligence package
            </p>
          </div>

          <TargetIntelImport
            operationType={activeOperation}
            onIntelProcessed={handleIntelProcessed}
            onMissionAbort={abortMission}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Command Center Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Intelligence Operations Center</h1>
          <p className="text-gray-300 max-w-3xl mx-auto">
            Deploy and process target intelligence packages. Import targets and properties data 
            to enhance operational capabilities and expand the mission database.
          </p>
        </div>

        {/* Current Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3">
              <Target className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-400">Total Targets</p>
                <p className="text-2xl font-bold text-white">
                  {leadStats?.total_leads?.toLocaleString() || '0'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-gray-400">Properties</p>
                <p className="text-2xl font-bold text-white">
                  {propertyStats?.count?.toLocaleString() || '0'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3">
              <Activity className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm text-gray-400">Active Ops</p>
                <p className="text-2xl font-bold text-white">
                  {Math.floor((leadStats?.total_leads || 0) * 0.3)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-gray-400">Success Rate</p>
                <p className="text-2xl font-bold text-white">
                  85%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Operation Launch Pad */}
        <div className="bg-gray-800 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-white mb-6">Launch Intelligence Operation</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-700 rounded-lg p-6 hover:bg-gray-650 transition-colors cursor-pointer border-2 border-transparent hover:border-blue-500"
                 onClick={() => startOperation('target')}>
              <div className="flex items-start gap-4">
                <Target className="h-12 w-12 text-blue-500 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-white mb-2">Target Intelligence Import</h3>
                  <p className="text-gray-300 mb-4">
                    Deploy target intelligence packages to identify and process potential subjects.
                    Import lead data with contact information and property associations.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startOperation('target');
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Launch Operation
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        generateIntelTemplate('target');
                      }}
                      className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Download Template
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-700 rounded-lg p-6 hover:bg-gray-650 transition-colors cursor-pointer border-2 border-transparent hover:border-green-500"
                 onClick={() => startOperation('property')}>
              <div className="flex items-start gap-4">
                <Database className="h-12 w-12 text-green-500 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-white mb-2">Property Intelligence Import</h3>
                  <p className="text-gray-300 mb-4">
                    Deploy property intelligence packages to expand territorial awareness.
                    Import property data with ownership details and valuation information.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startOperation('property');
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Launch Operation
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        generateIntelTemplate('property');
                      }}
                      className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Download Template
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Operation History */}
        {operationHistory.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-white mb-6">Recent Operations</h3>
            <EnhancedTable
              data={operationHistory}
              columns={historyColumns}
              rowKey="id"
              className="bg-gray-700"
            />
          </div>
        )}

        {operationHistory.length === 0 && (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <FileText className="h-16 w-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Operations Recorded</h3>
            <p className="text-gray-400">
              Launch your first intelligence operation to begin building the mission database.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default IntelOperations;