import React, { useState } from 'react';
import { 
  XMarkIcon, 
  DocumentDuplicateIcon,
  ArrowsUpDownIcon,
  DocumentTextIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { 
  Document, 
  DocumentMergeRequest
} from '../../services/documentService';

interface DocumentMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMerge: (request: DocumentMergeRequest) => Promise<void>;
  availableDocuments: Document[];
  preselectedDocuments?: string[];
}

export const DocumentMergeModal: React.FC<DocumentMergeModalProps> = ({
  isOpen,
  onClose,
  onMerge,
  availableDocuments,
  preselectedDocuments = [],
}) => {
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>(preselectedDocuments);
  const [outputName, setOutputName] = useState('Merged Document');
  const [mergeType, setMergeType] = useState<'concatenate' | 'overlay'>('concatenate');
  const [merging, setMerging] = useState(false);

  const handleDocumentToggle = (documentId: string) => {
    setSelectedDocuments(prev => {
      if (prev.includes(documentId)) {
        return prev.filter(id => id !== documentId);
      } else {
        return [...prev, documentId];
      }
    });
  };

  const moveDocument = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...selectedDocuments];
    if (direction === 'up' && index > 0) {
      [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
    } else if (direction === 'down' && index < newOrder.length - 1) {
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    }
    setSelectedDocuments(newOrder);
  };

  const removeDocument = (documentId: string) => {
    setSelectedDocuments(prev => prev.filter(id => id !== documentId));
  };

  const handleMerge = async () => {
    if (selectedDocuments.length < 2) return;

    setMerging(true);
    try {
      const request: DocumentMergeRequest = {
        document_ids: selectedDocuments,
        output_name: outputName,
        merge_type: mergeType,
      };

      await onMerge(request);
      onClose();
    } catch (error) {
      console.error('Error merging documents:', error);
    } finally {
      setMerging(false);
    }
  };

  const getDocumentById = (id: string) => {
    return availableDocuments.find(doc => doc.id === id);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-2xl border border-slate-700/50 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <div className="flex items-center space-x-3">
            <DocumentDuplicateIcon className="h-6 w-6 text-orange-400" />
            <h2 className="text-xl font-bold text-white">Merge Documents</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Merge Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Output Name
              </label>
              <Input
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                placeholder="Merged document name"
                className="bg-slate-700/50 border-slate-600 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Merge Type
              </label>
              <select
                value={mergeType}
                onChange={(e) => setMergeType(e.target.value as 'concatenate' | 'overlay')}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
              >
                <option value="concatenate">Concatenate (End-to-end)</option>
                <option value="overlay">Overlay (Layered)</option>
              </select>
            </div>
          </div>

          {/* Merge Type Description */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
            <h4 className="text-sm font-semibold text-white mb-2">Merge Type Information</h4>
            {mergeType === 'concatenate' ? (
              <p className="text-sm text-slate-400">
                Documents will be joined end-to-end in the order specified. Each document will appear as separate pages in the final output.
              </p>
            ) : (
              <p className="text-sm text-slate-400">
                Documents will be layered on top of each other. This is useful for combining forms with different information or adding watermarks.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Available Documents */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Available Documents</h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {availableDocuments
                  .filter(doc => !selectedDocuments.includes(doc.id))
                  .map(document => (
                    <div
                      key={document.id}
                      onClick={() => handleDocumentToggle(document.id)}
                      className="p-3 rounded-lg border border-slate-600 hover:border-slate-500 hover:bg-slate-700/30 cursor-pointer transition-all duration-200"
                    >
                      <div className="flex items-center space-x-3">
                        <DocumentTextIcon className="h-5 w-5 text-slate-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-white truncate">
                            {document.name}
                          </h4>
                          <p className="text-xs text-slate-400">
                            {document.document_type} • {document.file_size} bytes
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Selected Documents (Merge Order) */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">
                Merge Order ({selectedDocuments.length} documents)
              </h3>
              {selectedDocuments.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <DocumentDuplicateIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Select documents to merge</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {selectedDocuments.map((documentId, index) => {
                    const document = getDocumentById(documentId);
                    if (!document) return null;

                    return (
                      <div
                        key={documentId}
                        className="p-3 rounded-lg bg-slate-700/30 border border-orange-500/30"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="flex flex-col space-y-1">
                            <button
                              onClick={() => moveDocument(index, 'up')}
                              disabled={index === 0}
                              className="p-1 hover:bg-slate-600/50 rounded disabled:opacity-30 disabled:cursor-not-allowed text-slate-400 hover:text-white transition-colors"
                            >
                              <ChevronUpIcon className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => moveDocument(index, 'down')}
                              disabled={index === selectedDocuments.length - 1}
                              className="p-1 hover:bg-slate-600/50 rounded disabled:opacity-30 disabled:cursor-not-allowed text-slate-400 hover:text-white transition-colors"
                            >
                              <ChevronDownIcon className="h-3 w-3" />
                            </button>
                          </div>
                          
                          <div className="flex items-center justify-center w-6 h-6 bg-orange-500/20 rounded-full text-xs font-semibold text-orange-400">
                            {index + 1}
                          </div>
                          
                          <DocumentTextIcon className="h-5 w-5 text-orange-400 flex-shrink-0" />
                          
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-white truncate">
                              {document.name}
                            </h4>
                            <p className="text-xs text-slate-400">
                              {document.document_type} • {document.file_size} bytes
                            </p>
                          </div>
                          
                          <button
                            onClick={() => removeDocument(documentId)}
                            className="p-1 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400 transition-colors"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Merge Preview */}
          {selectedDocuments.length > 1 && (
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
              <h4 className="text-sm font-semibold text-white mb-3">Merge Preview</h4>
              <div className="flex items-center space-x-2">
                {selectedDocuments.map((documentId, index) => {
                  const document = getDocumentById(documentId);
                  return (
                    <React.Fragment key={documentId}>
                      <div className="text-xs text-slate-300 bg-slate-700/50 px-2 py-1 rounded">
                        {document?.name || 'Unknown'}
                      </div>
                      {index < selectedDocuments.length - 1 && (
                        <ArrowsUpDownIcon className="h-4 w-4 text-slate-500" />
                      )}
                    </React.Fragment>
                  );
                })}
                <span className="text-slate-400 text-sm">→</span>
                <div className="text-sm text-orange-400 font-semibold">
                  {outputName}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-700/50">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={merging}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handleMerge}
            disabled={selectedDocuments.length < 2 || merging || !outputName}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {merging ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Merging...
              </>
            ) : (
              <>
                <DocumentDuplicateIcon className="h-4 w-4 mr-2" />
                Merge {selectedDocuments.length} Documents
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};