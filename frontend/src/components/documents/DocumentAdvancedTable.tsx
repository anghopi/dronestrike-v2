import React, { useState, useMemo } from 'react';
import {
  DocumentTextIcon,
  EyeIcon,
  CloudArrowDownIcon,
  ShareIcon,
  TrashIcon,
  PencilIcon,
  DocumentDuplicateIcon,
  TagIcon,
  CalendarIcon,
  UserIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ClockIcon,
  DocumentArrowUpIcon,
} from '@heroicons/react/24/outline';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Document, documentService } from '../../services/documentService';
import { DocumentStatusHistory } from './DocumentStatusHistory';
import { DocumentVersionModal } from './DocumentVersionModal';

interface DocumentAdvancedTableProps {
  documents: Document[];
  onDocumentSelect?: (document: Document) => void;
  onDocumentUpdate?: (id: string, updates: Partial<Document>) => void;
  onDocumentDelete?: (id: string) => void;
  onDocumentDownload?: (id: string) => void;
  onDocumentShare?: (id: string) => void;
  onDocumentDuplicate?: (id: string) => void;
  onBulkAction?: (action: string, selectedIds: string[]) => void;
  loading?: boolean;
}

type SortField = 'name' | 'created_at' | 'updated_at' | 'file_size' | 'document_type' | 'status';
type SortOrder = 'asc' | 'desc';

export const DocumentAdvancedTable: React.FC<DocumentAdvancedTableProps> = ({
  documents,
  onDocumentSelect,
  onDocumentUpdate,
  onDocumentDelete,
  onDocumentDownload,
  onDocumentShare,
  onDocumentDuplicate,
  onBulkAction,
  loading = false,
}) => {
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [editingDocument, setEditingDocument] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Document>>({});
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showStatusHistory, setShowStatusHistory] = useState<string | null>(null);
  const [showVersionModal, setShowVersionModal] = useState<string | null>(null);

  // Sorting logic
  const sortedDocuments = useMemo(() => {
    return [...documents].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'file_size') {
        aValue = Number(aValue);
        bValue = Number(bValue);
      } else if (sortField === 'created_at' || sortField === 'updated_at') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      } else {
        aValue = String(aValue).toLowerCase();
        bValue = String(bValue).toLowerCase();
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [documents, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDocuments(new Set(documents.map(doc => doc.id)));
    } else {
      setSelectedDocuments(new Set());
    }
  };

  const handleSelectDocument = (documentId: string, checked: boolean) => {
    const newSelected = new Set(selectedDocuments);
    if (checked) {
      newSelected.add(documentId);
    } else {
      newSelected.delete(documentId);
    }
    setSelectedDocuments(newSelected);
  };

  const startEditing = (document: Document) => {
    setEditingDocument(document.id);
    setEditValues({
      name: document.name,
      document_type: document.document_type,
      tags: document.tags,
      status: document.status,
    });
  };

  // Document status workflow - defines valid transitions
  const getAvailableStatusTransitions = (currentStatus: Document['status']): Document['status'][] => {
    const statusWorkflow: Record<Document['status'], Document['status'][]> = {
      draft: ['draft', 'pending_review', 'approved', 'rejected', 'archived'],
      pending_review: ['pending_review', 'approved', 'rejected', 'draft'],
      approved: ['approved', 'sent', 'signed', 'archived'],
      rejected: ['rejected', 'draft', 'archived'],
      signed: ['signed', 'completed', 'archived'],
      sent: ['sent', 'delivered', 'viewed', 'signed', 'approved'],
      delivered: ['delivered', 'viewed', 'signed', 'approved'],
      viewed: ['viewed', 'signed', 'approved'],
      completed: ['completed', 'archived'],
      archived: ['archived', 'draft'] // Allow reactivation from archive
    };

    return statusWorkflow[currentStatus] || [currentStatus];
  };

  const saveEdit = async () => {
    if (editingDocument && onDocumentUpdate) {
      try {
        await onDocumentUpdate(editingDocument, editValues);
        setEditingDocument(null);
        setEditValues({});
      } catch (error) {
        console.error('Error updating document:', error);
      }
    }
  };

  const cancelEdit = () => {
    setEditingDocument(null);
    setEditValues({});
  };

  const handleBulkAction = (action: string) => {
    if (onBulkAction && selectedDocuments.size > 0) {
      onBulkAction(action, Array.from(selectedDocuments));
      setSelectedDocuments(new Set());
    }
  };

  const getStatusBadgeColor = (status: Document['status']) => {
    const colorMap: Record<Document['status'], string> = {
      draft: 'bg-gray-500/20 text-gray-300',
      pending_review: 'bg-yellow-500/20 text-yellow-300',
      approved: 'bg-green-500/20 text-green-300',
      rejected: 'bg-red-500/20 text-red-300',
      signed: 'bg-blue-500/20 text-blue-300',
      sent: 'bg-purple-500/20 text-purple-300',
      delivered: 'bg-indigo-500/20 text-indigo-300',
      viewed: 'bg-teal-500/20 text-teal-300',
      completed: 'bg-green-500/20 text-green-300',
      archived: 'bg-gray-500/20 text-gray-400',
    };
    return colorMap[status] || 'bg-gray-500/20 text-gray-300';
  };

  const getTypeColor = (type: Document['document_type']) => {
    const colorMap: Record<Document['document_type'], string> = {
      contract: 'text-blue-400',
      proposal: 'text-green-400',
      report: 'text-yellow-400',
      template: 'text-purple-400',
      legal: 'text-red-400',
      invoice: 'text-orange-400',
      receipt: 'text-cyan-400',
      tax_document: 'text-pink-400',
      other: 'text-gray-400',
    };
    return colorMap[type] || 'text-gray-400';
  };

  const SortHeader: React.FC<{ field: SortField; children: React.ReactNode }> = ({ field, children }) => (
    <th
      className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-700/30 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {sortField === field && (
          sortOrder === 'asc' ? 
            <ChevronUpIcon className="h-4 w-4" /> : 
            <ChevronDownIcon className="h-4 w-4" />
        )}
      </div>
    </th>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Enhanced Bulk Actions */}
      {selectedDocuments.size > 0 && (
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/30 backdrop-blur-sm">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-8 h-8 bg-blue-500/20 rounded-full">
              <span className="text-sm font-bold text-blue-300">{selectedDocuments.size}</span>
            </div>
            <span className="text-slate-200 font-medium">
              {selectedDocuments.size} document{selectedDocuments.size > 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction('download')}
              className="border-blue-600 text-blue-300 hover:bg-blue-700/20 hover:border-blue-500"
            >
              <CloudArrowDownIcon className="h-4 w-4 mr-1" />
              Download
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction('share')}
              className="border-green-600 text-green-300 hover:bg-green-700/20 hover:border-green-500"
            >
              <ShareIcon className="h-4 w-4 mr-1" />
              Share
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction('merge')}
              className="border-orange-600 text-orange-300 hover:bg-orange-700/20 hover:border-orange-500"
            >
              <DocumentDuplicateIcon className="h-4 w-4 mr-1" />
              Merge
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction('delete')}
              className="border-red-600 text-red-300 hover:bg-red-700/20 hover:border-red-500"
            >
              <TrashIcon className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700/50">
            <thead className="bg-slate-700/30">
              <tr>
                <th className="px-6 py-4 w-12">
                  <Checkbox
                    checked={selectedDocuments.size === documents.length && documents.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
                <SortHeader field="name">Name</SortHeader>
                <SortHeader field="document_type">Type</SortHeader>
                <SortHeader field="status">Status</SortHeader>
                <SortHeader field="file_size">Size</SortHeader>
                <SortHeader field="updated_at">Modified</SortHeader>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Tags
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {sortedDocuments.map((document) => (
                <React.Fragment key={document.id}>
                  <tr
                    className="hover:bg-slate-700/30 transition-colors"
                    onClick={() => onDocumentSelect?.(document)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedDocuments.has(document.id)}
                        onCheckedChange={(checked) => handleSelectDocument(document.id, checked as boolean)}
                      />
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingDocument === document.id ? (
                        <div className="flex items-center space-x-2">
                          <Input
                            value={editValues.name || ''}
                            onChange={(e) => setEditValues(prev => ({ ...prev, name: e.target.value }))}
                            className="bg-slate-700/50 border-slate-600 text-white text-sm flex-1"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit();
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <div className="flex items-center space-x-3 group">
                          <div className={`p-2 rounded-lg ${getTypeColor(document.document_type).replace('text-', 'bg-').replace('-400', '-500/20')} border border-opacity-30`}>
                            <DocumentTextIcon className={`h-4 w-4 flex-shrink-0 ${getTypeColor(document.document_type)}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate max-w-xs group-hover:text-blue-300 transition-colors">
                              {document.name}
                            </div>
                            <div className="text-xs text-slate-400 flex items-center space-x-2">
                              <UserIcon className="h-3 w-3" />
                              <span>{document.created_by}</span>
                              <span>•</span>
                              <CalendarIcon className="h-3 w-3" />
                              <span>{new Date(document.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingDocument === document.id ? (
                        <select
                          value={editValues.document_type || document.document_type}
                          onChange={(e) => setEditValues(prev => ({ ...prev, document_type: e.target.value as any }))}
                          className="bg-slate-700/50 border border-slate-600 rounded text-white text-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="contract">Contract</option>
                          <option value="proposal">Proposal</option>
                          <option value="report">Report</option>
                          <option value="template">Template</option>
                          <option value="legal">Legal</option>
                          <option value="invoice">Invoice</option>
                          <option value="receipt">Receipt</option>
                          <option value="tax_document">Tax Document</option>
                          <option value="other">Other</option>
                        </select>
                      ) : (
                        <span className={`text-sm font-medium capitalize ${getTypeColor(document.document_type)}`}>
                          {document.document_type.replace('_', ' ')}
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingDocument === document.id ? (
                        <select
                          value={editValues.status || document.status}
                          onChange={(e) => setEditValues(prev => ({ ...prev, status: e.target.value as any }))}
                          className="bg-slate-700/50 border border-slate-600 rounded text-white text-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {getAvailableStatusTransitions(document.status).map(status => (
                            <option key={status} value={status}>
                              {status.replace('_', ' ').toUpperCase()}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-1">
                            <Badge className={`${getStatusBadgeColor(document.status)} border-0 text-xs font-medium px-2 py-1 rounded-full`}>
                              {document.status.replace('_', ' ')}
                            </Badge>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowStatusHistory(showStatusHistory === document.id ? null : document.id);
                              }}
                              className="p-1 hover:bg-slate-700/50 rounded text-slate-400 hover:text-blue-400 transition-colors"
                              title="Status History"
                            >
                              <ClockIcon className="h-3 w-3" />
                            </button>
                          </div>
                          {document.is_shared && (
                            <div className="flex items-center text-xs text-blue-400" title="Shared document">
                              <ShareIcon className="h-3 w-3" />
                            </div>
                          )}
                          {document.is_template && (
                            <div className="flex items-center text-xs text-purple-400" title="Template">
                              <DocumentDuplicateIcon className="h-3 w-3" />
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {documentService.formatFileSize(document.file_size)}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      <div className="flex items-center space-x-1">
                        <CalendarIcon className="h-3 w-3" />
                        <span>{new Date(document.updated_at).toLocaleDateString()}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingDocument === document.id ? (
                        <Input
                          value={editValues.tags?.join(', ') || ''}
                          onChange={(e) => setEditValues(prev => ({ 
                            ...prev, 
                            tags: e.target.value.split(',').map(tag => tag.trim()) 
                          }))}
                          placeholder="Add tags..."
                          className="bg-slate-700/50 border-slate-600 text-white text-sm"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {document.tags.slice(0, 2).map((tag, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-slate-700/50 text-slate-300 border border-slate-600/50"
                            >
                              <TagIcon className="h-3 w-3 mr-1" />
                              {tag}
                            </span>
                          ))}
                          {document.tags.length > 2 && (
                            <span className="text-xs text-slate-400">
                              +{document.tags.length - 2} more
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm" onClick={(e) => e.stopPropagation()}>
                      {editingDocument === document.id ? (
                        <div className="flex items-center justify-end space-x-2">
                          <Button size="sm" onClick={saveEdit} className="bg-green-600 hover:bg-green-700">
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEdit} className="border-slate-600">
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => startEditing(document)}
                            className="p-1 hover:bg-slate-700/50 rounded text-slate-400 hover:text-white transition-colors"
                            title="Edit"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setShowVersionModal(document.id)}
                            className="p-1 hover:bg-slate-700/50 rounded text-slate-400 hover:text-purple-400 transition-colors"
                            title="Version History"
                          >
                            <DocumentArrowUpIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onDocumentDownload?.(document.id)}
                            className="p-1 hover:bg-slate-700/50 rounded text-slate-400 hover:text-blue-400 transition-colors"
                            title="Download"
                          >
                            <CloudArrowDownIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onDocumentShare?.(document.id)}
                            className="p-1 hover:bg-slate-700/50 rounded text-slate-400 hover:text-green-400 transition-colors"
                            title="Share"
                          >
                            <ShareIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onDocumentDuplicate?.(document.id)}
                            className="p-1 hover:bg-slate-700/50 rounded text-slate-400 hover:text-yellow-400 transition-colors"
                            title="Duplicate"
                          >
                            <DocumentDuplicateIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onDocumentDelete?.(document.id)}
                            className="p-1 hover:bg-slate-700/50 rounded text-slate-400 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {/* Status History Expandable Row */}
                  {showStatusHistory === document.id && (
                    <tr>
                      <td colSpan={8} className="px-6 py-4 bg-slate-700/20 border-l-4 border-blue-500/30">
                        <DocumentStatusHistory document={document} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {documents.length === 0 && (
        <div className="text-center py-12">
          <DocumentTextIcon className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-300 mb-2">No documents found</h3>
          <p className="text-slate-400">Upload some documents to get started</p>
        </div>
      )}

      {/* Version Control Modal */}
      {showVersionModal && (
        <DocumentVersionModal
          isOpen={true}
          onClose={() => setShowVersionModal(null)}
          document={documents.find(d => d.id === showVersionModal)!}
          onVersionUpdate={(updatedDocument) => {
            if (onDocumentUpdate) {
              onDocumentUpdate(updatedDocument.id, updatedDocument);
            }
          }}
        />
      )}
    </div>
  );
};