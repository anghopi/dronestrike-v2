import React, { useState } from 'react';
import { 
  XMarkIcon, 
  CloudArrowUpIcon,
  FolderIcon,
  TagIcon
} from '@heroicons/react/24/outline';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { UploadDocuments } from '../ui/upload-documents';
import { DocumentFolder, DocumentUploadOptions } from '../../services/documentService';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: File[], options: DocumentUploadOptions) => Promise<void>;
  folders: DocumentFolder[];
}

const DOCUMENT_TYPES = [
  { value: 'contract', label: 'Contract' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'report', label: 'Report' },
  { value: 'template', label: 'Template' },
  { value: 'legal', label: 'Legal Document' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'tax_document', label: 'Tax Document' },
  { value: 'other', label: 'Other' },
];

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  onUpload,
  folders,
}) => {
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [documentType, setDocumentType] = useState<string>('other');
  const [tags, setTags] = useState<string>('');
  const [isTemplate, setIsTemplate] = useState(false);
  const [uploading, setUploading] = useState(false);

  if (!isOpen) return null;

  const handleUpload = async (files: File[]) => {
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadOptions: DocumentUploadOptions = {
        folder_id: selectedFolder || undefined,
        document_type: documentType as any,
        tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
        is_template: isTemplate,
      };

      await onUpload(files, uploadOptions);
      onClose();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-2xl border border-slate-700/50 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <div className="flex items-center space-x-3">
            <CloudArrowUpIcon className="h-6 w-6 text-blue-400" />
            <h2 className="text-xl font-bold text-white">Upload Documents</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Upload Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Folder Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <FolderIcon className="inline h-4 w-4 mr-1" />
                Folder
              </label>
              <select
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                <option value="">Root Folder</option>
                {folders.map(folder => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Document Type */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Document Type
              </label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                {DOCUMENT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              <TagIcon className="inline h-4 w-4 mr-1" />
              Tags (comma-separated)
            </label>
            <Input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="urgent, signed, quarterly, etc."
              className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400"
            />
          </div>

          {/* Template Option */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isTemplate"
              checked={isTemplate}
              onChange={(e) => setIsTemplate(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="isTemplate" className="text-sm text-slate-300">
              Save as template for future use
            </label>
          </div>

          {/* Upload Component */}
          <div className="border border-slate-700/50 rounded-lg p-4 bg-slate-800/30">
            <UploadDocuments onUpload={handleUpload} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-700/50">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={uploading}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};