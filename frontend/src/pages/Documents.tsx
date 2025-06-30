import React, { useState, useEffect, useCallback } from 'react';
import { 
  DocumentTextIcon, 
  FolderIcon,
  CloudArrowDownIcon,
  ShareIcon,
  TrashIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  DocumentArrowUpIcon,
  CalendarIcon,
  UserIcon,
  Squares2X2Icon,
  ListBulletIcon,
  SparklesIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';
import {
  FolderIcon as FolderIconSolid
} from '@heroicons/react/24/solid';
import { DocumentUploadModal } from '../components/documents/DocumentUploadModal';
import { DocumentAdvancedTable } from '../components/documents/DocumentAdvancedTable';
import { DocumentGenerationModal } from '../components/documents/DocumentGenerationModal';
import { DocumentTemplateModal } from '../components/documents/DocumentTemplateModal';
import { DocumentMergeModal } from '../components/documents/DocumentMergeModal';
import { 
  Document as DocumentType, 
  DocumentFolder, 
  DocumentSearchFilters,
  DocumentUploadOptions,
  documentService 
} from '../services/documentService';
import { templateService, TemplateGenerationRequest } from '../services/templateService';
import { notificationService } from '../services/notificationService';

// Use DocumentType from service instead of local interface

// Mock data removed - using real API data

// Folders loaded from API

const Documents: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'table'>('table');
  const [hoveredDocument, setHoveredDocument] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showGenerationModal, setShowGenerationModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [documentFilters, setDocumentFilters] = useState<DocumentSearchFilters>({});
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedDocumentsForMerge, setSelectedDocumentsForMerge] = useState<string[]>([]);
  
  // Advanced Filters
  const [advancedFilters, setAdvancedFilters] = useState({
    hideMerged: false,
    latestVersionOnly: false,
    showDeleted: false,
    withAttachments: false,
    templateId: null as string | null
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [bulkSelecting, setBulkSelecting] = useState(false);
  const [selectedBulkDocuments, setSelectedBulkDocuments] = useState<Set<string>>(new Set());
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Enhanced bulk operation progress tracking
  const [bulkProgress, setBulkProgress] = useState<{
    action: string;
    total: number;
    completed: number;
    current?: string;
    errors: string[];
  } | null>(null);

  // Load documents and folders on component mount
  useEffect(() => {
    loadDocuments();
    loadFolders();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in input fields
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }
      
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'k':
            e.preventDefault();
            (document.querySelector('input[placeholder*="Search"]') as HTMLInputElement)?.focus();
            break;
          case 'u':
            e.preventDefault();
            setShowUploadModal(true);
            break;
          case 'g':
            e.preventDefault();
            setShowTemplateModal(true);
            break;
          case '/':
            e.preventDefault();
            setShowKeyboardHelp(true);
            break;
        }
      }
      
      if (e.key === 'Escape') {
        setShowKeyboardHelp(false);
        setShowUploadModal(false);
        setShowGenerationModal(false);
        setShowTemplateModal(false);
        setShowMergeModal(false);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Drag and drop for file upload
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(true);
    };
    
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
    };
    
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length > 0) {
        const options: DocumentUploadOptions = {
          folder_id: selectedFolder || undefined,
          document_type: 'other',
          tags: []
        };
        handleUpload(files, options);
      }
    };
    
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);
    
    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
    };
  }, [selectedFolder]);

  // Debounced search
  useEffect(() => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    
    const timer = setTimeout(() => {
      loadDocuments();
    }, 300);
    
    setSearchDebounceTimer(timer);
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [searchQuery]);

  // Reload documents when filters change (except search)
  useEffect(() => {
    loadDocuments();
  }, [selectedFolder, selectedDocumentType, selectedStatus, documentFilters]);

  const loadDocuments = useCallback(async () => {
    if (searchQuery) {
      setIsSearching(true);
    } else {
      setLoading(true);
    }
    try {
      const filters: DocumentSearchFilters = {
        ...documentFilters,
        search: searchQuery || undefined,
        folder_id: selectedFolder || undefined,
        document_type: selectedDocumentType || undefined,
        status: selectedStatus || undefined,
        page_size: 50,
      };
      
      const response = await documentService.getDocuments(filters);
      setDocuments(response.documents);
    } catch (error) {
      console.error('Error loading documents:', error);
      notificationService.error('Failed to load documents');
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  }, [searchQuery, selectedFolder, selectedDocumentType, selectedStatus, documentFilters]);

  const loadFolders = useCallback(async () => {
    try {
      const foldersData = await documentService.getFolders();
      setFolders(foldersData);
    } catch (error) {
      console.error('Error loading folders:', error);
    }
  }, []);

  const handleUpload = async (files: File[], options: DocumentUploadOptions) => {
    const uploadPromises = files.map(async (file, index) => {
      const fileId = `${file.name}-${Date.now()}-${index}`;
      
      try {
        setUploadProgress(prev => ({ ...prev, [fileId]: 0 }));
        
        // Simulate progress for demo (replace with actual progress tracking)
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            const currentProgress = prev[fileId] || 0;
            if (currentProgress < 90) {
              return { ...prev, [fileId]: currentProgress + 10 };
            }
            return prev;
          });
        }, 200);
        
        await documentService.uploadDocuments([file], options);
        
        clearInterval(progressInterval);
        setUploadProgress(prev => ({ ...prev, [fileId]: 100 }));
        
        // Remove from progress after a delay
        setTimeout(() => {
          setUploadProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[fileId];
            return newProgress;
          });
        }, 2000);
        
      } catch (error) {
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[fileId];
          return newProgress;
        });
        throw error;
      }
    });
    
    try {
      await Promise.all(uploadPromises);
      notificationService.success(`Successfully uploaded ${files.length} document(s)`);
      loadDocuments();
    } catch (error) {
      console.error('Error uploading documents:', error);
      notificationService.error('Failed to upload documents');
    }
  };

  const handleDocumentUpdate = async (id: string, updates: Partial<DocumentType>) => {
    try {
      await documentService.updateDocument(id, updates);
      notificationService.success('Document updated successfully');
      loadDocuments();
    } catch (error) {
      console.error('Error updating document:', error);
      notificationService.error('Failed to update document');
    }
  };

  const handleDocumentDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        await documentService.deleteDocument(id);
        notificationService.success('Document deleted successfully');
        loadDocuments();
      } catch (error) {
        console.error('Error deleting document:', error);
        notificationService.error('Failed to delete document');
      }
    }
  };

  const handleDocumentDownload = async (id: string) => {
    try {
      const blob = await documentService.downloadDocument(id);
      const document = documents.find(doc => doc.id === id);
      if (document) {
        const url = window.URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = url;
        a.download = document.filename;
        window.document.body.appendChild(a);
        a.click();
        window.document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      notificationService.error('Failed to download document');
    }
  };

  const handleDocumentShare = async (id: string) => {
    const email = prompt('Enter email address to share with:');
    if (email) {
      try {
        await documentService.shareDocument(id, email, { can_view: true });
        notificationService.success('Document shared successfully');
      } catch (error) {
        console.error('Error sharing document:', error);
        notificationService.error('Failed to share document');
      }
    }
  };

  const handleDocumentDuplicate = async (id: string) => {
    try {
      await documentService.duplicateDocument(id);
      notificationService.success('Document duplicated successfully');
      loadDocuments();
    } catch (error) {
      console.error('Error duplicating document:', error);
      notificationService.error('Failed to duplicate document');
    }
  };

  const handleDocumentGeneration = async (request: any) => {
    try {
      await documentService.generateDocument(request);
      notificationService.success('Document generated successfully');
      loadDocuments();
    } catch (error) {
      console.error('Error generating document:', error);
      notificationService.error('Failed to generate document');
    }
  };

  const handleTemplateGeneration = async (request: TemplateGenerationRequest) => {
    try {
      const result = await templateService.generateDocument(request);
      notificationService.success('Document generated from template successfully');
      
      // Refresh documents list to show the new document
      loadDocuments();
      
      // Optionally download the generated document
      if (result.download_url && result.download_url !== '/mock-download-url') {
        const link = document.createElement('a');
        link.href = result.download_url;
        link.download = request.filename || 'generated-document';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error generating document from template:', error);
      notificationService.error('Failed to generate document from template');
    }
  };

  const handleDocumentMerge = async (request: any) => {
    try {
      await documentService.mergeDocuments(request);
      notificationService.success('Documents merged successfully');
      loadDocuments();
    } catch (error) {
      console.error('Error merging documents:', error);
      notificationService.error('Failed to merge documents');
    }
  };

  const handleBulkAction = async (action: string, selectedIds: string[]) => {
    setBulkSelecting(true);
    setBulkProgress({
      action,
      total: selectedIds.length,
      completed: 0,
      errors: []
    });

    try {
      switch (action) {
        case 'download':
          notificationService.info('Preparing download...');
          
          // Sequential download with progress
          const downloadedBlobs: Blob[] = [];
          for (let i = 0; i < selectedIds.length; i++) {
            const documentId = selectedIds[i];
            const document = documents.find(d => d.id === documentId);
            
            setBulkProgress(prev => prev ? {
              ...prev,
              completed: i,
              current: document?.name || `Document ${i + 1}`
            } : null);
            
            try {
              const blob = await documentService.downloadDocument(documentId);
              downloadedBlobs.push(blob);
            } catch (error) {
              setBulkProgress(prev => prev ? {
                ...prev,
                errors: [...prev.errors, `Failed to download ${document?.name || documentId}`]
              } : null);
            }
          }
          
          // If multiple files, create zip (simplified for now)
          if (downloadedBlobs.length === 1) {
            const url = window.URL.createObjectURL(downloadedBlobs[0]);
            const a = window.document.createElement('a');
            a.href = url;
            a.download = documents.find(d => d.id === selectedIds[0])?.filename || 'document';
            window.document.body.appendChild(a);
            a.click();
            window.document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          } else {
            // For multiple files, use the service method for zip creation
            const blob = await documentService.downloadDocuments(selectedIds);
            const url = window.URL.createObjectURL(blob);
            const a = window.document.createElement('a');
            a.href = url;
            a.download = `documents-${new Date().toISOString().split('T')[0]}.zip`;
            window.document.body.appendChild(a);
            a.click();
            window.document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          }
          
          notificationService.success(`Downloaded ${downloadedBlobs.length} of ${selectedIds.length} documents`);
          break;
          
        case 'merge':
          setSelectedDocumentsForMerge(selectedIds);
          setShowMergeModal(true);
          setBulkProgress(null); // Clear progress for merge (modal handles it)
          setBulkSelecting(false);
          return;
          
        case 'delete':
          const confirmDelete = window.confirm(
            `Are you sure you want to delete ${selectedIds.length} document${selectedIds.length > 1 ? 's' : ''}? This action cannot be undone.`
          );
          if (!confirmDelete) {
            setBulkProgress(null);
            setBulkSelecting(false);
            return;
          }
          
          // Sequential delete with progress
          let deleteErrors = 0;
          for (let i = 0; i < selectedIds.length; i++) {
            const documentId = selectedIds[i];
            const document = documents.find(d => d.id === documentId);
            
            setBulkProgress(prev => prev ? {
              ...prev,
              completed: i,
              current: document?.name || `Document ${i + 1}`
            } : null);
            
            try {
              await documentService.deleteDocument(documentId);
            } catch (error) {
              deleteErrors++;
              setBulkProgress(prev => prev ? {
                ...prev,
                errors: [...prev.errors, `Failed to delete ${document?.name || documentId}`]
              } : null);
            }
          }
          
          const successCount = selectedIds.length - deleteErrors;
          if (successCount > 0) {
            notificationService.success(`Successfully deleted ${successCount} of ${selectedIds.length} document${selectedIds.length > 1 ? 's' : ''}`);
            loadDocuments();
          }
          if (deleteErrors > 0) {
            notificationService.error(`Failed to delete ${deleteErrors} document${deleteErrors > 1 ? 's' : ''}`);
          }
          break;
          
        case 'share':
          const email = prompt('Enter email address to share documents with:');
          if (!email || !email.includes('@')) {
            if (email) notificationService.error('Please enter a valid email address');
            setBulkProgress(null);
            setBulkSelecting(false);
            return;
          }
          
          // Sequential share with progress
          let shareErrors = 0;
          for (let i = 0; i < selectedIds.length; i++) {
            const documentId = selectedIds[i];
            const document = documents.find(d => d.id === documentId);
            
            setBulkProgress(prev => prev ? {
              ...prev,
              completed: i,
              current: document?.name || `Document ${i + 1}`
            } : null);
            
            try {
              await documentService.shareDocument(documentId, email, { can_view: true });
            } catch (error) {
              shareErrors++;
              setBulkProgress(prev => prev ? {
                ...prev,
                errors: [...prev.errors, `Failed to share ${document?.name || documentId}`]
              } : null);
            }
          }
          
          const sharedCount = selectedIds.length - shareErrors;
          if (sharedCount > 0) {
            notificationService.success(`Shared ${sharedCount} of ${selectedIds.length} document${selectedIds.length > 1 ? 's' : ''} with ${email}`);
          }
          if (shareErrors > 0) {
            notificationService.error(`Failed to share ${shareErrors} document${shareErrors > 1 ? 's' : ''}`);
          }
          break;
      }
    } catch (error) {
      console.error('Error performing bulk action:', error);
      notificationService.error(`Failed to ${action} documents`);
    } finally {
      setBulkProgress(null);
      setBulkSelecting(false);
    }
  };

  const getTypeIcon = (type: DocumentType['document_type']) => {
    switch (type) {
      case 'contract': return DocumentTextIcon;
      case 'proposal': return DocumentTextIcon;
      case 'report': return DocumentTextIcon;
      case 'template': return DocumentTextIcon;
      case 'legal': return DocumentTextIcon;
      default: return DocumentTextIcon;
    }
  };

  const getTypeColor = (type: DocumentType['document_type']) => {
    switch (type) {
      case 'contract': return 'text-brand-color';
      case 'proposal': return 'text-olive-green';
      case 'report': return 'text-alert-yellow';
      case 'template': return 'text-gray-400';
      case 'legal': return 'text-critical-red';
      default: return 'text-gray-400';
    }
  };

  // Advanced client-side filtering
  const filteredDocuments = documents.filter(doc => {
    // Hide merged documents filter
    if (advancedFilters.hideMerged && doc.is_merged) {
      return false;
    }
    
    // Latest version only filter
    if (advancedFilters.latestVersionOnly && doc.version !== doc.latest_version) {
      return false;
    }
    
    // Show deleted filter (using status instead of deleted_at)
    if (!advancedFilters.showDeleted && doc.status === 'archived') {
      return false;
    }
    
    // With attachments filter
    if (advancedFilters.withAttachments && (!doc.attachments || doc.attachments.length === 0)) {
      return false;
    }
    
    // Template filter (use metadata or different field structure)
    if (advancedFilters.templateId && doc.metadata?.template_id !== advancedFilters.templateId) {
      return false;
    }
    
    return true;
  });

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="flex-1 overflow-auto">
        {/* Modern Header */}
        <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/30 backdrop-blur-sm border-b border-slate-700/50">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg">
                  <DocumentTextIcon className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                    Documents
                  </h1>
                  <p className="text-slate-400 mt-1">Manage contracts, reports, and mission-critical documents</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => setShowTemplateModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl group flex items-center space-x-2"
                  title="Generate document (Ctrl+G)"
                >
                  <SparklesIcon className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                  <span>Generate</span>
                </button>
                <button 
                  onClick={() => setShowUploadModal(true)}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl group flex items-center space-x-2"
                  title="Upload documents (Ctrl+U)"
                >
                  <PlusIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span>Upload</span>
                </button>
                <button 
                  onClick={() => setShowKeyboardHelp(true)}
                  className="p-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white rounded-xl transition-all duration-200 border border-slate-600/50"
                  title="Keyboard shortcuts (Ctrl+/)"
                >
                  <span className="text-lg font-mono">?</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Progress - Modern Design */}
        {Object.keys(uploadProgress).length > 0 && (
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl border border-blue-500/20 p-4 backdrop-blur-sm">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                <DocumentArrowUpIcon className="h-5 w-5 mr-2 text-blue-400" />
                Uploading Files
              </h3>
              <div className="space-y-3">
                {Object.entries(uploadProgress).map(([fileId, progress]) => {
                  const fileName = fileId.split('-')[0];
                  return (
                    <div key={fileId} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-white font-medium truncate">{fileName}</span>
                        <span className="text-blue-400 font-semibold">{progress}%</span>
                      </div>
                      <div className="w-full bg-slate-700/50 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-300 shadow-sm"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Bulk Operation Progress */}
        {bulkProgress && (
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl border border-blue-500/20 p-4 backdrop-blur-sm">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                <DocumentArrowUpIcon className="h-5 w-5 mr-2 text-blue-400" />
                {bulkProgress.action.charAt(0).toUpperCase() + bulkProgress.action.slice(1)}ing Documents
              </h3>
              
              <div className="space-y-3">
                {/* Progress bar */}
                <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-white font-medium">
                      {bulkProgress.current || `Processing ${bulkProgress.completed + 1} of ${bulkProgress.total}`}
                    </span>
                    <span className="text-blue-400 font-semibold">
                      {Math.round(((bulkProgress.completed) / bulkProgress.total) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-700/50 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-300 shadow-sm"
                      style={{ width: `${(bulkProgress.completed / bulkProgress.total) * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* Errors */}
                {bulkProgress.errors.length > 0 && (
                  <div className="bg-red-500/10 rounded-xl p-3 border border-red-500/20">
                    <h4 className="text-sm font-medium text-red-400 mb-2">Errors ({bulkProgress.errors.length})</h4>
                    <div className="space-y-1 max-h-20 overflow-y-auto">
                      {bulkProgress.errors.map((error, index) => (
                        <p key={index} className="text-xs text-red-300">{error}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modern Search and Filters */}
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5 relative">
              <div className="relative group">
                <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                <input
                  type="text"
                  placeholder="Search documents... (Ctrl+K)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-12 py-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-white placeholder-slate-400 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 backdrop-blur-sm"
                />
                {isSearching && (
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-400 border-t-transparent"></div>
                  </div>
                )}
              </div>
            </div>
            <div className="lg:col-span-3 relative">
              <div className="relative group">
                <FolderIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                <select
                  value={selectedFolder}
                  onChange={(e) => setSelectedFolder(e.target.value)}
                  className="w-full pl-12 pr-10 py-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-white appearance-none cursor-pointer focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 backdrop-blur-sm"
                >
                  <option value="">All Folders ({documents.length})</option>
                  {folders.map(folder => {
                    const count = documents.filter(d => d.folder_id === folder.id).length;
                    return (
                      <option key={folder.id} value={folder.id}>
                        {folder.name} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
            <div className="lg:col-span-3 relative">
              <div className="relative group">
                <DocumentTextIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                <select
                  value={selectedDocumentType}
                  onChange={(e) => setSelectedDocumentType(e.target.value)}
                  className="w-full pl-12 pr-10 py-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-white appearance-none cursor-pointer focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 backdrop-blur-sm"
                >
                  <option value="">All Types ({documents.length})</option>
                  {[
                    { value: 'contract', label: 'Contracts' },
                    { value: 'proposal', label: 'Proposals' },
                    { value: 'report', label: 'Reports' },
                    { value: 'template', label: 'Templates' },
                    { value: 'legal', label: 'Legal Documents' },
                    { value: 'invoice', label: 'Invoices' },
                    { value: 'receipt', label: 'Receipts' },
                    { value: 'tax_document', label: 'Tax Documents' },
                    { value: 'other', label: 'Other' }
                  ].map(type => {
                    const count = documents.filter(d => d.document_type === type.value).length;
                    return (
                      <option key={type.value} value={type.value}>
                        {type.label} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
            <div className="lg:col-span-1">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-4 py-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-white appearance-none cursor-pointer focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 backdrop-blur-sm"
              >
                <option value="">All Status</option>
                {[
                  { value: 'draft', label: 'Draft' },
                  { value: 'pending_review', label: 'Review' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'signed', label: 'Signed' }
                ].map(status => {
                  const count = documents.filter(d => d.status === status.value).length;
                  return (
                    <option key={status.value} value={status.value}>
                      {status.label} ({count})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
      
          
          {/* Filter Chips and Controls */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center space-x-3">
              {(selectedFolder || selectedDocumentType || selectedStatus || searchQuery) && (
                <button
                  onClick={() => {
                    setSelectedFolder('');
                    setSelectedDocumentType('');
                    setSelectedStatus('');
                    setSearchQuery('');
                  }}
                  className="px-3 py-1 bg-red-500/20 text-red-300 border border-red-500/30 rounded-full hover:bg-red-500/30 transition-colors text-sm font-medium"
                >
                  Clear All Filters
                </button>
              )}
              <div className="flex items-center space-x-2">
                {selectedFolder && (
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-sm">
                    📁 {folders.find(f => f.id === selectedFolder)?.name}
                  </span>
                )}
                {selectedDocumentType && (
                  <span className="px-3 py-1 bg-green-500/20 text-green-300 border border-green-500/30 rounded-full text-sm">
                    📄 {selectedDocumentType}
                  </span>
                )}
                {selectedStatus && (
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full text-sm">
                    🏷️ {selectedStatus}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Advanced Filters Toggle */}
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-white rounded-xl transition-all duration-200 border border-slate-600/50"
                title="Advanced Filters"
              >
                <AdjustmentsHorizontalIcon className="h-4 w-4" />
                <span className="text-sm">Advanced</span>
                {showAdvancedFilters ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />}
              </button>
              
              {/* View Toggle */}
              <div className="flex items-center bg-slate-800/50 rounded-xl p-1 border border-slate-700/50">
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2 rounded-lg transition-all duration-200 ${
                    viewMode === 'table'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                  title="Table View"
                >
                  <ListBulletIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all duration-200 ${
                    viewMode === 'list'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                  title="Grid View"
                >
                  <Squares2X2Icon className="h-4 w-4" />
                </button>
              </div>
              
              {/* Stats */}
              <div className="text-sm text-slate-400 flex items-center space-x-2">
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-400 border-t-transparent"></div>
                    <span>Loading...</span>
                  </>
                ) : (
                  <span className="font-medium">{filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''}</span>
                )}
              </div>
            </div>
          </div>
          
          {/* Advanced Filters Panel */}
          {showAdvancedFilters && (
            <div className="mt-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50 backdrop-blur-sm">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <AdjustmentsHorizontalIcon className="h-4 w-4" />
                Advanced Filters
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={advancedFilters.hideMerged}
                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, hideMerged: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="text-sm text-slate-300">Hide Merged</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={advancedFilters.latestVersionOnly}
                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, latestVersionOnly: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="text-sm text-slate-300">Latest Version Only</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={advancedFilters.showDeleted}
                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, showDeleted: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="text-sm text-slate-300">Show Deleted</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={advancedFilters.withAttachments}
                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, withAttachments: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="text-sm text-slate-300">With Attachments</span>
                </label>
                
                <div className="relative">
                  <select
                    value={advancedFilters.templateId || ''}
                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, templateId: e.target.value || null }))}
                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm appearance-none cursor-pointer focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                  >
                    <option value="">All Templates</option>
                    <option value="contract">Contract Template</option>
                    <option value="proposal">Proposal Template</option>
                    <option value="report">Report Template</option>
                    <option value="legal">Legal Template</option>
                  </select>
                </div>
              </div>
              
              {/* Clear Advanced Filters */}
              {(advancedFilters.hideMerged || advancedFilters.latestVersionOnly || advancedFilters.showDeleted || advancedFilters.withAttachments || advancedFilters.templateId) && (
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <button
                    onClick={() => setAdvancedFilters({
                      hideMerged: false,
                      latestVersionOnly: false,
                      showDeleted: false,
                      withAttachments: false,
                      templateId: null
                    })}
                    className="px-3 py-1 bg-red-500/20 text-red-300 border border-red-500/30 rounded-full hover:bg-red-500/30 transition-colors text-sm font-medium"
                  >
                    Clear Advanced Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Horizontal Metrics */}
        <div className="max-w-7xl mx-auto px-6 pb-4">
          <div className="flex gap-6 items-center">
            <div className="bg-slate-800/50 rounded-lg px-4 py-3 border border-white/20 backdrop-blur-sm flex items-center gap-4">
              <DocumentTextIcon className="h-4 w-4 text-blue-400" />
              <span className="text-white font-semibold">{documents.length}</span>
              <span className="text-blue-400 text-sm">Total</span>
            </div>
            
            <div className="bg-slate-800/50 rounded-lg px-4 py-3 border border-white/20 backdrop-blur-sm flex items-center gap-4">
              <ShareIcon className="h-4 w-4 text-green-400" />
              <span className="text-white font-semibold">{documents.filter(d => d.is_shared).length}</span>
              <span className="text-green-400 text-sm">Shared</span>
            </div>
            
            <div className="bg-slate-800/50 rounded-lg px-4 py-3 border border-white/20 backdrop-blur-sm flex items-center gap-4">
              <SparklesIcon className="h-4 w-4 text-purple-400" />
              <span className="text-white font-semibold">{documents.filter(d => d.is_template).length}</span>
              <span className="text-purple-400 text-sm">Templates</span>
            </div>
            
            <div className="bg-slate-800/50 rounded-lg px-4 py-3 border border-white/20 backdrop-blur-sm flex items-center gap-4">
              <UserIcon className="h-4 w-4 text-yellow-400" />
              <span className="text-white font-semibold">{documents.filter(d => d.status === 'signed').length}</span>
              <span className="text-yellow-400 text-sm">Signed</span>
            </div>
          </div>
        </div>

        {/* Main Content Layout */}
        <div className="max-w-7xl mx-auto px-6 pb-8">
          <div className="grid grid-cols-1 gap-6">

            {/* Modern Main Content */}
            <div className="w-full">
              <div className="bg-slate-800/30 rounded-2xl border border-slate-700/50 backdrop-blur-sm overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/50 to-slate-700/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        {selectedFolder ? folders.find(f => f.id === selectedFolder)?.name : 'All Documents'}
                      </h2>
                      <p className="text-slate-400 mt-1">
                        {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''} • 
                        Total size: {documentService.formatFileSize(
                          filteredDocuments.reduce((sum, doc) => sum + doc.file_size, 0)
                        )}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="bg-slate-700/50 rounded-xl px-3 py-2">
                        <span className="text-sm text-slate-300">Last updated: </span>
                        <span className="text-sm font-medium text-white">Today</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content Area */}
                <div className="p-6">
                  {viewMode === 'table' ? (
                    <DocumentAdvancedTable
                      documents={filteredDocuments}
                      onDocumentUpdate={handleDocumentUpdate}
                      onDocumentDelete={handleDocumentDelete}
                      onDocumentDownload={handleDocumentDownload}
                      onDocumentShare={handleDocumentShare}
                      onDocumentDuplicate={handleDocumentDuplicate}
                      onBulkAction={handleBulkAction}
                      loading={loading}
                    />
                  ) : (
                    /* Modern Grid View */
                    <div>
                      {filteredDocuments.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                          {filteredDocuments.map(document => {
                            const Icon = getTypeIcon(document.document_type);
                            const typeColor = getTypeColor(document.document_type);
                            
                            return (
                              <div 
                                key={document.id}
                                className="group bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50 hover:border-blue-500/50 transition-all duration-200 backdrop-blur-sm hover:bg-slate-800/80"
                                onMouseEnter={() => setHoveredDocument(document.id)}
                                onMouseLeave={() => setHoveredDocument(null)}
                              >
                                {/* Document Header */}
                                <div className="flex items-start justify-between mb-4">
                                  <div className="flex items-center space-x-3">
                                    <div className={`p-3 rounded-xl bg-gradient-to-br ${typeColor.includes('blue') ? 'from-blue-500/20 to-cyan-500/20 border-blue-500/30' : typeColor.includes('green') ? 'from-green-500/20 to-emerald-500/20 border-green-500/30' : typeColor.includes('purple') ? 'from-purple-500/20 to-pink-500/20 border-purple-500/30' : 'from-slate-500/20 to-slate-600/20 border-slate-500/30'} border`}>
                                      <Icon className={`h-6 w-6 ${typeColor}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h3 className="font-semibold text-white truncate group-hover:text-blue-300 transition-colors">
                                        {document.name}
                                      </h3>
                                      <p className="text-sm text-slate-400 capitalize">
                                        {document.document_type.replace('_', ' ')}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                      onClick={() => handleDocumentDownload(document.id)}
                                      className="p-2 rounded-lg hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 transition-all"
                                      title="Download"
                                    >
                                      <CloudArrowDownIcon className="h-4 w-4" />
                                    </button>
                                    <button 
                                      onClick={() => handleDocumentShare(document.id)}
                                      className="p-2 rounded-lg hover:bg-green-500/20 text-slate-400 hover:text-green-400 transition-all"
                                      title="Share"
                                    >
                                      <ShareIcon className="h-4 w-4" />
                                    </button>
                                    <button 
                                      onClick={() => handleDocumentDelete(document.id)}
                                      className="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all"
                                      title="Delete"
                                    >
                                      <TrashIcon className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>

                                {/* Document Details */}
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-400">Size</span>
                                    <span className="text-white font-medium">{documentService.formatFileSize(document.file_size)}</span>
                                  </div>
                                  
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-400">Modified</span>
                                    <span className="text-white font-medium">{new Date(document.updated_at).toLocaleDateString()}</span>
                                  </div>
                                  
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-400">Created by</span>
                                    <span className="text-white font-medium">{document.created_by}</span>
                                  </div>
                                  
                                  {document.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-3">
                                      {document.tags.slice(0, 3).map(tag => (
                                        <span key={tag} className="px-2 py-1 bg-slate-700/50 text-slate-300 text-xs rounded-lg border border-slate-600/50">
                                          {tag}
                                        </span>
                                      ))}
                                      {document.tags.length > 3 && (
                                        <span className="px-2 py-1 text-slate-400 text-xs">+{document.tags.length - 3}</span>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Status Badge */}
                                  <div className="flex items-center justify-between pt-2">
                                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                                      document.status === 'signed' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                      document.status === 'draft' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                      'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                    }`}>
                                      {document.status.replace('_', ' ')}
                                    </div>
                                    {document.is_shared && (
                                      <div className="flex items-center space-x-1 text-green-400">
                                        <ShareIcon className="h-3 w-3" />
                                        <span className="text-xs">Shared</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* Empty State */
                        <div className="text-center py-16">
                          <div className="p-6 bg-gradient-to-br from-slate-800/50 to-slate-700/30 rounded-3xl w-32 h-32 mx-auto mb-6 flex items-center justify-center border border-slate-700/50">
                            <DocumentTextIcon className="h-16 w-16 text-slate-500" />
                          </div>
                          <h3 className="text-2xl font-bold text-white mb-3">No documents found</h3>
                          <p className="text-slate-400 max-w-md mx-auto mb-6">
                            Try adjusting your search criteria or upload some documents to get started.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      
      {/* Modals */}
      <DocumentUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleUpload}
        folders={folders}
      />
      
      <DocumentGenerationModal
        isOpen={showGenerationModal}
        onClose={() => setShowGenerationModal(false)}
        onGenerate={handleDocumentGeneration}
      />
      
      <DocumentTemplateModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onGenerate={handleTemplateGeneration}
        category={selectedDocumentType || undefined}
      />
      
      <DocumentMergeModal
        isOpen={showMergeModal}
        onClose={() => {
          setShowMergeModal(false);
          setSelectedDocumentsForMerge([]);
        }}
        onMerge={handleDocumentMerge}
        availableDocuments={documents}
        preselectedDocuments={selectedDocumentsForMerge}
      />
      
      {/* Drag and Drop Overlay */}
      {isDragOver && (
        <div className="fixed inset-0 bg-blue-500/20 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="bg-slate-800/90 rounded-xl p-8 border-2 border-dashed border-blue-400 text-center">
            <DocumentArrowUpIcon className="h-16 w-16 text-blue-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Drop files to upload</h3>
            <p className="text-slate-300">Release to upload to the current folder</p>
          </div>
        </div>
      )}
      
      {/* Keyboard Help Modal */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-2xl border border-slate-700/50 w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
              <h2 className="text-xl font-bold text-white">Keyboard Shortcuts</h2>
              <button
                onClick={() => setShowKeyboardHelp(false)}
                className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-white"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { keys: 'Ctrl+K', action: 'Focus search' },
                { keys: 'Ctrl+U', action: 'Upload documents' },
                { keys: 'Ctrl+G', action: 'Generate document' },
                { keys: 'Ctrl+/', action: 'Show this help' },
                { keys: 'Escape', action: 'Close modals / Cancel editing' },
                { keys: 'Enter', action: 'Save when editing' }
              ].map(({ keys, action }, index) => (
                <div key={`${keys}-${index}`} className="flex items-center justify-between">
                  <span className="text-slate-300">{action}</span>
                  <kbd className="px-2 py-1 bg-slate-700/50 border border-slate-600 rounded text-xs font-mono text-slate-200">
                    {keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default Documents;