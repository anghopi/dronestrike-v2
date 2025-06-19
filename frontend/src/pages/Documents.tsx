import React, { useState } from 'react';
import { 
  DocumentTextIcon, 
  FolderIcon,
  CloudArrowDownIcon,
  ShareIcon,
  TrashIcon,
  EyeIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  DocumentArrowUpIcon,
  CalendarIcon,
  UserIcon,
  Squares2X2Icon,
  ListBulletIcon
} from '@heroicons/react/24/outline';
import {
  DocumentTextIcon as DocumentTextIconSolid,
  FolderIcon as FolderIconSolid
} from '@heroicons/react/24/solid';

interface Document {
  id: string;
  name: string;
  type: 'contract' | 'proposal' | 'report' | 'template' | 'legal';
  size: string;
  lastModified: string;
  createdBy: string;
  folder: string;
  shared: boolean;
  tags: string[];
}

const mockDocuments: Document[] = [
  {
    id: '1',
    name: 'Property Purchase Agreement - Oak Street',
    type: 'contract',
    size: '2.4 MB',
    lastModified: '2025-06-15',
    createdBy: 'John Smith',
    folder: 'Contracts',
    shared: true,
    tags: ['urgent', 'signed']
  },
  {
    id: '2',
    name: 'Market Analysis Report Q2 2025',
    type: 'report',
    size: '5.1 MB',
    lastModified: '2025-06-14',
    createdBy: 'Sarah Johnson',
    folder: 'Reports',
    shared: false,
    tags: ['quarterly', 'analysis']
  },
  {
    id: '3',
    name: 'Investment Proposal Template',
    type: 'template',
    size: '1.2 MB',
    lastModified: '2025-06-10',
    createdBy: 'Mike Davis',
    folder: 'Templates',
    shared: true,
    tags: ['template', 'proposal']
  },
  {
    id: '4',
    name: 'Legal Compliance Checklist',
    type: 'legal',
    size: '856 KB',
    lastModified: '2025-06-08',
    createdBy: 'Legal Team',
    folder: 'Legal',
    shared: true,
    tags: ['compliance', 'checklist']
  }
];

const folders = ['All Documents', 'Contracts', 'Reports', 'Templates', 'Legal', 'Proposals'];

const Documents: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>(mockDocuments);
  const [selectedFolder, setSelectedFolder] = useState('All Documents');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [hoveredDocument, setHoveredDocument] = useState<string | null>(null);

  const getTypeIcon = (type: Document['type']) => {
    switch (type) {
      case 'contract': return DocumentTextIcon;
      case 'proposal': return DocumentTextIcon;
      case 'report': return DocumentTextIcon;
      case 'template': return DocumentTextIcon;
      case 'legal': return DocumentTextIcon;
      default: return DocumentTextIcon;
    }
  };

  const getTypeColor = (type: Document['type']) => {
    switch (type) {
      case 'contract': return 'text-brand-color';
      case 'proposal': return 'text-olive-green';
      case 'report': return 'text-alert-yellow';
      case 'template': return 'text-gray-400';
      case 'legal': return 'text-critical-red';
      default: return 'text-gray-400';
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesFolder = selectedFolder === 'All Documents' || doc.folder === selectedFolder;
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFolder && matchesSearch;
  });

  return (
    <div className="h-full space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Document Arsenal</h1>
            <p className="page-subtitle">Manage contracts, reports, and mission-critical documents</p>
          </div>
          <div className="flex items-center space-x-3">
            <button className="btn-secondary">
              <DocumentArrowUpIcon className="w-5 h-5 mr-2" />
              Upload
            </button>
            <button className="btn-primary">
              <PlusIcon className="w-5 h-5 mr-2" />
              New Document
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-military w-full pl-10 pr-4 py-3"
          />
        </div>
        <select
          value={selectedFolder}
          onChange={(e) => setSelectedFolder(e.target.value)}
          className="input-military px-3 py-3"
        >
          {folders.map(folder => (
            <option key={folder} value={folder}>{folder}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
        {/* Sidebar - Organized */}
        <div className="lg:col-span-1 space-y-4">
          {/* Quick Stats */}
          <div className="enhanced-card p-4">
            <h3 className="text-sm font-semibold text-white mb-4">Overview</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="text-xl font-bold text-white">{documents.length}</div>
                <div className="text-xs text-gray-400">Total</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-brand-color">{documents.filter(d => d.shared).length}</div>
                <div className="text-xs text-gray-400">Shared</div>
              </div>
            </div>
            <div className="mt-3 text-center">
              <div className="text-lg font-bold text-olive-green">12</div>
              <div className="text-xs text-gray-400">Recent</div>
            </div>
          </div>

          {/* Folders */}
          <div className="enhanced-card p-4">
            <h3 className="text-sm font-semibold text-white mb-4">Folders</h3>
            <div className="space-y-1">
              {folders.map(folder => {
                const isSelected = selectedFolder === folder;
                const Icon = isSelected ? FolderIconSolid : FolderIcon;
                const count = folder === 'All Documents' ? documents.length : documents.filter(d => d.folder === folder).length;
                
                return (
                  <button
                    key={folder}
                    onClick={() => setSelectedFolder(folder)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-200 ${
                      isSelected 
                        ? 'bg-brand-color text-white shadow-lg' 
                        : 'text-gray-300 hover:bg-navy-blue-light hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Icon className={`h-4 w-4 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
                      <span className="font-medium truncate">{folder.replace('All Documents', 'All')}</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      isSelected 
                        ? 'bg-brand-color-light text-white' 
                        : 'bg-gray-600 text-gray-300'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="enhanced-card p-4">
            <h3 className="text-sm font-semibold text-white mb-4">Activity</h3>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-olive-green rounded-full mt-2 flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium">Contract signed</p>
                  <p className="text-xs text-gray-400">2h ago</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-brand-color rounded-full mt-2 flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium">Report uploaded</p>
                  <p className="text-xs text-gray-400">5h ago</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-alert-yellow rounded-full mt-2 flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium">Template updated</p>
                  <p className="text-xs text-gray-400">1d ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Wider */}
        <div className="lg:col-span-5">
          <div className="enhanced-card">
            {/* Table Header */}
            <div className="px-6 py-5 border-b border-navy-blue-light">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">
                  {selectedFolder} 
                  <span className="text-gray-400 font-normal ml-2">({filteredDocuments.length})</span>
                </h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg transition-all duration-200 ${
                      viewMode === 'list' 
                        ? 'bg-brand-color text-white' 
                        : 'text-gray-400 hover:text-white hover:bg-navy-blue-light'
                    }`}
                  >
                    <ListBulletIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg transition-all duration-200 ${
                      viewMode === 'grid' 
                        ? 'bg-brand-color text-white' 
                        : 'text-gray-400 hover:text-white hover:bg-navy-blue-light'
                    }`}
                  >
                    <Squares2X2Icon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Documents List */}
            <div className="divide-y divide-navy-blue-light">
              {filteredDocuments.map(document => {
                const Icon = getTypeIcon(document.type);
                const typeColor = getTypeColor(document.type);
                const isHovered = hoveredDocument === document.id;
                
                return (
                  <div 
                    key={document.id} 
                    className="px-6 py-5 hover:bg-navy-blue-light/30 transition-all duration-200"
                    onMouseEnter={() => setHoveredDocument(document.id)}
                    onMouseLeave={() => setHoveredDocument(null)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1 min-w-0">
                        <div className="p-2 rounded-lg bg-navy-blue-light border border-navy-blue-light">
                          <Icon className={`h-5 w-5 ${typeColor} flex-shrink-0`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-white truncate mb-1">
                            {document.name}
                          </h4>
                          <div className="flex items-center space-x-4 mb-2">
                            <div className="flex items-center text-xs text-gray-400">
                              <UserIcon className="h-3 w-3 mr-1" />
                              {document.createdBy}
                            </div>
                            <div className="flex items-center text-xs text-gray-400">
                              <CalendarIcon className="h-3 w-3 mr-1" />
                              {document.lastModified}
                            </div>
                            <span className="text-xs text-gray-400 font-medium">{document.size}</span>
                            {document.shared && (
                              <div className="flex items-center text-xs text-brand-color">
                                <ShareIcon className="h-3 w-3 mr-1" />
                                <span className="text-xs">Shared</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-1">
                            {document.tags.map(tag => (
                              <span
                                key={tag}
                                className="text-xs px-2 py-0.5 bg-navy-blue-light text-gray-300 border border-navy-blue-light rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className={`flex items-center space-x-1 transition-all duration-200 ${
                        isHovered ? 'opacity-100' : 'opacity-60'
                      }`}>
                        <button className="p-1.5 rounded-lg hover:bg-navy-blue-light text-gray-400 hover:text-white transition-all duration-200">
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        <button className="p-1.5 rounded-lg hover:bg-navy-blue-light text-gray-400 hover:text-brand-color transition-all duration-200">
                          <CloudArrowDownIcon className="h-4 w-4" />
                        </button>
                        <button className="p-1.5 rounded-lg hover:bg-navy-blue-light text-gray-400 hover:text-olive-green transition-all duration-200">
                          <ShareIcon className="h-4 w-4" />
                        </button>
                        <button className="p-1.5 rounded-lg hover:bg-critical-red text-gray-400 hover:text-white transition-all duration-200">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredDocuments.length === 0 && (
                <div className="px-6 py-16 text-center">
                  <div className="p-4 rounded-full bg-navy-blue-light w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                    <DocumentTextIcon className="h-10 w-10 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">No documents found</h3>
                  <p className="text-gray-400 max-w-md mx-auto">
                    Try adjusting your search criteria or browse different folders to find what you're looking for.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Documents;