import React, { useState } from 'react';
import { 
  CalendarIcon, 
  ClockIcon,
  PlayIcon,
  PauseIcon,
  TrashIcon,
  PlusIcon,
  DocumentArrowUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

interface ScheduledImport {
  id: string;
  name: string;
  source: 'csv' | 'api' | 'ftp' | 'email';
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
    time: string;
    days?: string[];
  };
  lastRun?: string;
  nextRun: string;
  status: 'active' | 'paused' | 'error' | 'completed';
  recordsProcessed: number;
  successRate: number;
  created: string;
}

const mockImports: ScheduledImport[] = [
  {
    id: '1',
    name: 'Daily Lead Updates',
    source: 'csv',
    schedule: {
      frequency: 'daily',
      time: '06:00',
    },
    lastRun: '2025-06-16T06:00:00Z',
    nextRun: '2025-06-17T06:00:00Z',
    status: 'active',
    recordsProcessed: 1247,
    successRate: 98.5,
    created: '2025-06-01'
  },
  {
    id: '2',
    name: 'Weekly Property Data Sync',
    source: 'api',
    schedule: {
      frequency: 'weekly',
      time: '03:00',
      days: ['Monday']
    },
    lastRun: '2025-06-15T03:00:00Z',
    nextRun: '2025-06-22T03:00:00Z',
    status: 'active',
    recordsProcessed: 856,
    successRate: 95.2,
    created: '2025-05-28'
  },
  {
    id: '3',
    name: 'Contact List Import',
    source: 'email',
    schedule: {
      frequency: 'weekly',
      time: '08:00',
      days: ['Friday']
    },
    lastRun: '2025-06-14T08:00:00Z',
    nextRun: '2025-06-21T08:00:00Z',
    status: 'error',
    recordsProcessed: 0,
    successRate: 0,
    created: '2025-06-10'
  },
  {
    id: '4',
    name: 'Monthly Reports Archive',
    source: 'ftp',
    schedule: {
      frequency: 'monthly',
      time: '01:00',
    },
    nextRun: '2025-07-01T01:00:00Z',
    status: 'paused',
    recordsProcessed: 2845,
    successRate: 99.1,
    created: '2025-04-15'
  }
];

const ScheduledImports: React.FC = () => {
  const [imports, setImports] = useState<ScheduledImport[]>(mockImports);
  const [selectedTab, setSelectedTab] = useState<'active' | 'history' | 'settings'>('active');

  const getStatusIcon = (status: ScheduledImport['status']) => {
    switch (status) {
      case 'active': return CheckCircleIcon;
      case 'paused': return PauseIcon;
      case 'error': return XCircleIcon;
      case 'completed': return CheckCircleIcon;
      default: return ClockIcon;
    }
  };

  const getStatusColor = (status: ScheduledImport['status']) => {
    switch (status) {
      case 'active': return 'text-olive-green';
      case 'paused': return 'text-alert-yellow';
      case 'error': return 'text-critical-red';
      case 'completed': return 'text-olive-green';
      default: return 'text-gray-400';
    }
  };

  const getSourceIcon = (source: ScheduledImport['source']) => {
    switch (source) {
      case 'csv': return DocumentArrowUpIcon;
      case 'api': return ArrowPathIcon;
      case 'ftp': return DocumentArrowUpIcon;
      case 'email': return DocumentArrowUpIcon;
      default: return DocumentArrowUpIcon;
    }
  };

  const toggleImportStatus = (id: string) => {
    setImports(imports.map(imp => {
      if (imp.id === id) {
        return {
          ...imp,
          status: imp.status === 'active' ? 'paused' : 'active'
        };
      }
      return imp;
    }));
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatSchedule = (schedule: ScheduledImport['schedule']) => {
    const { frequency, time, days } = schedule;
    
    switch (frequency) {
      case 'daily':
        return `Daily at ${time}`;
      case 'weekly':
        return `Weekly on ${days?.join(', ')} at ${time}`;
      case 'monthly':
        return `Monthly at ${time}`;
      default:
        return 'Custom schedule';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Scheduled Operations</h1>
          <p className="text-gray-300">Automate data imports and system synchronization</p>
        </div>
        <button className="btn-primary">
          <PlusIcon className="w-5 h-5 mr-2" />
          New Schedule
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-navy-blue-light">
        <nav className="flex space-x-8">
          {[
            { id: 'active', label: 'Active Schedules', count: imports.filter(i => i.status === 'active').length },
            { id: 'history', label: 'Import History', count: null },
            { id: 'settings', label: 'Settings', count: null }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as any)}
              className={`flex items-center px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                selectedTab === tab.id
                  ? 'border-brand-color text-white'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className="ml-2 px-2 py-1 bg-navy-blue-light text-xs rounded">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {selectedTab === 'active' && (
        <div className="space-y-6">
          {/* Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card-military p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-medium uppercase">Total Schedules</p>
                  <p className="text-2xl font-bold text-white">{imports.length}</p>
                </div>
                <CalendarIcon className="h-8 w-8 text-brand-color" />
              </div>
            </div>

            <div className="card-military p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-medium uppercase">Active</p>
                  <p className="text-2xl font-bold text-white">
                    {imports.filter(i => i.status === 'active').length}
                  </p>
                </div>
                <CheckCircleIcon className="h-8 w-8 text-olive-green" />
              </div>
            </div>

            <div className="card-military p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-medium uppercase">Errors</p>
                  <p className="text-2xl font-bold text-white">
                    {imports.filter(i => i.status === 'error').length}
                  </p>
                </div>
                <XCircleIcon className="h-8 w-8 text-critical-red" />
              </div>
            </div>

            <div className="card-military p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-medium uppercase">Records/Day</p>
                  <p className="text-2xl font-bold text-white">1.2K</p>
                </div>
                <ArrowPathIcon className="h-8 w-8 text-alert-yellow" />
              </div>
            </div>
          </div>

          {/* Scheduled Imports Table */}
          <div className="card-military overflow-hidden">
            <table className="w-full">
              <thead className="bg-navy-blue-light">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Import Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Schedule</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Next Run</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Success Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-blue-light">
                {imports.map(importItem => {
                  const StatusIcon = getStatusIcon(importItem.status);
                  const SourceIcon = getSourceIcon(importItem.source);
                  const statusColor = getStatusColor(importItem.status);
                  
                  return (
                    <tr key={importItem.id} className="hover:bg-navy-blue-light/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <SourceIcon className="h-5 w-5 text-brand-color mr-3" />
                          <div>
                            <div className="text-sm font-medium text-white">{importItem.name}</div>
                            <div className="text-sm text-gray-400">
                              {importItem.recordsProcessed.toLocaleString()} records processed
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300 uppercase">{importItem.source}</td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        {formatSchedule(importItem.schedule)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-300">
                          {formatTime(importItem.nextRun)}
                        </div>
                        {importItem.lastRun && (
                          <div className="text-xs text-gray-400">
                            Last: {formatTime(importItem.lastRun)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <StatusIcon className={`h-4 w-4 mr-2 ${statusColor}`} />
                          <span className={`text-sm font-medium ${statusColor}`}>
                            {importItem.status.toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-12 bg-navy-blue rounded-full h-2 mr-2">
                            <div
                              className="bg-olive-green h-2 rounded-full"
                              style={{ width: `${importItem.successRate}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-300">{importItem.successRate}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => toggleImportStatus(importItem.id)}
                            className="p-1 rounded hover:bg-navy-blue transition-colors"
                            title={importItem.status === 'active' ? 'Pause' : 'Resume'}
                          >
                            {importItem.status === 'active' ? (
                              <PauseIcon className="h-4 w-4 text-gray-400" />
                            ) : (
                              <PlayIcon className="h-4 w-4 text-gray-400" />
                            )}
                          </button>
                          <button
                            className="p-1 rounded hover:bg-navy-blue transition-colors"
                            title="Run Now"
                          >
                            <PlayIcon className="h-4 w-4 text-gray-400" />
                          </button>
                          <button
                            className="p-1 rounded hover:bg-navy-blue transition-colors"
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4 text-gray-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Upcoming Runs */}
          <div className="card-military p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Next 24 Hours</h3>
            <div className="space-y-3">
              {imports
                .filter(imp => imp.status === 'active')
                .sort((a, b) => new Date(a.nextRun).getTime() - new Date(b.nextRun).getTime())
                .slice(0, 3)
                .map(importItem => {
                  const timeUntilRun = Math.ceil(
                    (new Date(importItem.nextRun).getTime() - new Date().getTime()) / (1000 * 60 * 60)
                  );
                  
                  return (
                    <div key={importItem.id} className="flex items-center justify-between p-3 bg-navy-blue-light rounded">
                      <div className="flex items-center space-x-3">
                        <ClockIcon className="h-5 w-5 text-brand-color" />
                        <div>
                          <div className="text-sm font-medium text-white">{importItem.name}</div>
                          <div className="text-xs text-gray-400">
                            {formatTime(importItem.nextRun)}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-300">
                        {timeUntilRun > 0 ? `in ${timeUntilRun}h` : 'Due now'}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {(selectedTab === 'history' || selectedTab === 'settings') && (
        <div className="card-military p-8">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-white mb-2">
              {selectedTab === 'history' ? 'Import History' : 'Schedule Settings'}
            </h3>
            <p className="text-gray-400">
              {selectedTab === 'history' 
                ? 'Detailed import history and logs coming soon...'
                : 'Advanced scheduling configuration coming soon...'
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduledImports;