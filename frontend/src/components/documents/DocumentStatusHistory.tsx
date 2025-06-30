import React from 'react';
import {
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  DocumentIcon,
  EyeIcon,
  ShareIcon,
  ArchiveBoxIcon
} from '@heroicons/react/24/outline';
import { Document } from '../../services/documentService';

interface DocumentStatusHistoryProps {
  document: Document;
  statusHistory?: StatusHistoryEntry[];
}

interface StatusHistoryEntry {
  id: string;
  status: Document['status'];
  timestamp: string;
  user: string;
  comment?: string;
  automatic?: boolean;
}

export const DocumentStatusHistory: React.FC<DocumentStatusHistoryProps> = ({
  document,
  statusHistory = []
}) => {
  const getStatusIcon = (status: Document['status']) => {
    switch (status) {
      case 'draft': return DocumentIcon;
      case 'pending_review': return ClockIcon;
      case 'approved': return CheckCircleIcon;
      case 'rejected': return XCircleIcon;
      case 'signed': return CheckCircleIcon;
      case 'sent': return ShareIcon;
      case 'delivered': return ShareIcon;
      case 'viewed': return EyeIcon;
      case 'completed': return CheckCircleIcon;
      case 'archived': return ArchiveBoxIcon;
      default: return DocumentIcon;
    }
  };

  const getStatusColor = (status: Document['status']) => {
    switch (status) {
      case 'draft': return 'text-gray-400 bg-gray-500/20';
      case 'pending_review': return 'text-yellow-400 bg-yellow-500/20';
      case 'approved': return 'text-green-400 bg-green-500/20';
      case 'rejected': return 'text-red-400 bg-red-500/20';
      case 'signed': return 'text-blue-400 bg-blue-500/20';
      case 'sent': return 'text-purple-400 bg-purple-500/20';
      case 'delivered': return 'text-indigo-400 bg-indigo-500/20';
      case 'viewed': return 'text-teal-400 bg-teal-500/20';
      case 'completed': return 'text-green-400 bg-green-500/20';
      case 'archived': return 'text-gray-400 bg-gray-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  // Mock status history if not provided
  const mockHistory: StatusHistoryEntry[] = statusHistory.length > 0 ? statusHistory : [
    {
      id: '1',
      status: 'draft' as Document['status'],
      timestamp: document.created_at,
      user: document.created_by,
      comment: 'Document created'
    },
    {
      id: '2',
      status: 'pending_review' as Document['status'],
      timestamp: new Date(new Date(document.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString(),
      user: document.created_by,
      comment: 'Submitted for review'
    },
    {
      id: '3',
      status: document.status,
      timestamp: document.updated_at,
      user: 'System',
      comment: `Status changed to ${document.status.replace('_', ' ')}`,
      automatic: document.status === 'sent' || document.status === 'delivered'
    }
  ].filter((entry, index, arr) => 
    // Remove duplicates and ensure current status is included
    index === arr.findIndex(e => e.status === entry.status)
  );

  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <ClockIcon className="h-4 w-4" />
        Status History
      </h3>
      
      <div className="space-y-3">
        {mockHistory.map((entry, index) => {
          const Icon = getStatusIcon(entry.status);
          const colorClasses = getStatusColor(entry.status);
          const isLatest = index === mockHistory.length - 1;
          
          return (
            <div key={entry.id} className="flex items-start space-x-3">
              {/* Timeline line */}
              <div className="flex flex-col items-center">
                <div className={`p-2 rounded-full ${colorClasses} border border-opacity-30`}>
                  <Icon className="h-3 w-3" />
                </div>
                {index < mockHistory.length - 1 && (
                  <div className="w-px h-6 bg-slate-600/50 mt-1" />
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className={`text-sm font-medium capitalize ${colorClasses.split(' ')[0]}`}>
                    {entry.status.replace('_', ' ')}
                  </span>
                  {isLatest && (
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded-full border border-blue-500/30">
                      Current
                    </span>
                  )}
                  {entry.automatic && (
                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded-full border border-purple-500/30">
                      Auto
                    </span>
                  )}
                </div>
                
                <div className="text-xs text-slate-400 mt-1">
                  <span>{entry.user}</span>
                  <span className="mx-1">•</span>
                  <span>{new Date(entry.timestamp).toLocaleDateString()}</span>
                  <span className="mx-1">•</span>
                  <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                </div>
                
                {entry.comment && (
                  <p className="text-sm text-slate-300 mt-1">{entry.comment}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Next possible actions */}
      <div className="mt-4 pt-4 border-t border-slate-700/50">
        <h4 className="text-xs font-medium text-slate-400 mb-2">Next Available Actions</h4>
        <div className="flex flex-wrap gap-1">
          {getNextStatusActions(document.status).map(action => (
            <span
              key={action}
              className="px-2 py-1 bg-slate-700/50 text-slate-300 text-xs rounded-md border border-slate-600/50"
            >
              {action.replace('_', ' ')}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

// Helper function to get next possible actions
const getNextStatusActions = (currentStatus: Document['status']): string[] => {
  const statusActions: Record<Document['status'], string[]> = {
    draft: ['Submit for Review', 'Archive'],
    pending_review: ['Approve', 'Reject', 'Return to Draft'],
    approved: ['Send', 'Sign', 'Archive'],
    rejected: ['Return to Draft', 'Archive'],
    signed: ['Mark Complete', 'Archive'],
    sent: ['Mark Delivered', 'Mark Viewed'],
    delivered: ['Mark Viewed', 'Mark Signed'],
    viewed: ['Mark Signed', 'Mark Approved'],
    completed: ['Archive'],
    archived: ['Reactivate']
  };

  return statusActions[currentStatus] || [];
};