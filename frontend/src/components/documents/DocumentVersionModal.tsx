import React, { useState, useEffect } from 'react';
import {
  XMarkIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  ArrowPathIcon,
  CloudArrowDownIcon,
  CodeBracketIcon,
  EyeIcon,
  PlusIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Document, DocumentVersion, VersionComparisonResult, documentService } from '../../services/documentService';

interface DocumentVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document;
  onVersionUpdate?: (document: Document) => void;
}

export const DocumentVersionModal: React.FC<DocumentVersionModalProps> = ({
  isOpen,
  onClose,
  document,
  onVersionUpdate
}) => {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingNewVersion, setUploadingNewVersion] = useState(false);
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [versionNotes, setVersionNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'versions' | 'compare' | 'upload'>('versions');
  const [selectedVersions, setSelectedVersions] = useState<number[]>([]);
  const [comparison, setComparison] = useState<VersionComparisonResult | null>(null);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadVersions();
    }
  }, [isOpen, document.id]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const versionsData = await documentService.getDocumentVersions(document.id);
      setVersions(versionsData);
    } catch (error) {
      console.error('Error loading versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setNewVersionFile(file);
      setActiveTab('upload');
    }
  };

  const handleCreateNewVersion = async () => {
    if (!newVersionFile) return;

    setUploadingNewVersion(true);
    try {
      const newVersion = await documentService.createNewVersion(
        document.id,
        newVersionFile,
        versionNotes || undefined
      );
      
      setVersions(prev => [...prev, newVersion]);
      setNewVersionFile(null);
      setVersionNotes('');
      setActiveTab('versions');
      
      // Update parent document
      if (onVersionUpdate) {
        const updatedDocument = await documentService.getDocument(document.id);
        onVersionUpdate(updatedDocument);
      }
    } catch (error) {
      console.error('Error creating new version:', error);
    } finally {
      setUploadingNewVersion(false);
    }
  };

  const handleCompareVersions = async () => {
    if (selectedVersions.length !== 2) return;

    setComparing(true);
    try {
      const result = await documentService.compareVersions(
        document.id,
        selectedVersions[0],
        selectedVersions[1]
      );
      setComparison(result);
      setActiveTab('compare');
    } catch (error) {
      console.error('Error comparing versions:', error);
    } finally {
      setComparing(false);
    }
  };

  const handleRevertToVersion = async (version: number) => {
    if (!window.confirm(`Are you sure you want to revert to version ${version}? This will create a new version.`)) {
      return;
    }

    try {
      const updatedDocument = await documentService.revertToVersion(document.id, version);
      await loadVersions();
      
      if (onVersionUpdate) {
        onVersionUpdate(updatedDocument);
      }
    } catch (error) {
      console.error('Error reverting to version:', error);
    }
  };

  const handleDownloadVersion = async (version: number) => {
    try {
      const blob = await documentService.downloadVersion(document.id, version);
      const versionInfo = versions.find(v => v.version === version);
      
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = versionInfo?.filename || `${document.name}_v${version}`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading version:', error);
    }
  };

  const toggleVersionSelection = (version: number) => {
    setSelectedVersions(prev => {
      if (prev.includes(version)) {
        return prev.filter(v => v !== version);
      } else if (prev.length < 2) {
        return [...prev, version];
      } else {
        return [prev[1], version]; // Replace first with new selection
      }
    });
  };

  const getDifferenceColor = (type: string) => {
    switch (type) {
      case 'added': return 'text-green-400 bg-green-500/20 border-green-500/30';
      case 'removed': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'modified': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      default: return 'text-slate-400 bg-slate-500/20 border-slate-500/30';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-2xl border border-slate-700/50 w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg border border-blue-500/30">
              <ClockIcon className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Version History</h2>
              <p className="text-slate-400 text-sm">{document.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-700/50">
          <nav className="flex px-6">
            <button
              onClick={() => setActiveTab('versions')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'versions'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Versions ({versions.length})
            </button>
            <button
              onClick={() => setActiveTab('compare')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'compare'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
              disabled={selectedVersions.length !== 2}
            >
              Compare
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'upload'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              New Version
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'versions' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <h3 className="text-lg font-semibold text-white">Version History</h3>
                  {selectedVersions.length === 2 && (
                    <Button
                      onClick={handleCompareVersions}
                      disabled={comparing}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {comparing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                          Comparing...
                        </>
                      ) : (
                        <>
                          <CodeBracketIcon className="h-4 w-4 mr-2" />
                          Compare Selected
                        </>
                      )}
                    </Button>
                  )}
                </div>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.txt"
                  />
                  <Button size="sm" className="bg-green-600 hover:bg-green-700">
                    <PlusIcon className="h-4 w-4 mr-2" />
                    New Version
                  </Button>
                </label>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-400 border-t-transparent"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className={`p-4 bg-slate-800/50 rounded-xl border transition-all ${
                        selectedVersions.includes(version.version)
                          ? 'border-blue-500/50 bg-blue-500/5'
                          : 'border-slate-700/50 hover:border-slate-600/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <button
                            onClick={() => toggleVersionSelection(version.version)}
                            className={`w-4 h-4 rounded border-2 transition-colors ${
                              selectedVersions.includes(version.version)
                                ? 'bg-blue-500 border-blue-500'
                                : 'border-slate-600 hover:border-slate-500'
                            }`}
                          >
                            {selectedVersions.includes(version.version) && (
                              <div className="w-full h-full bg-white rounded-sm scale-50"></div>
                            )}
                          </button>
                          
                          <div>
                            <div className="flex items-center space-x-3">
                              <h4 className="font-semibold text-white">Version {version.version}</h4>
                              {version.version === document.version && (
                                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Current</Badge>
                              )}
                            </div>
                            <div className="text-sm text-slate-400 mt-1">
                              <span>{version.created_by}</span>
                              <span className="mx-2">•</span>
                              <span>{new Date(version.created_at).toLocaleDateString()}</span>
                              <span className="mx-2">•</span>
                              <span>{documentService.formatFileSize(version.file_size)}</span>
                            </div>
                            {version.version_notes && (
                              <p className="text-sm text-slate-300 mt-1">{version.version_notes}</p>
                            )}
                            {version.changes_summary && (
                              <p className="text-xs text-slate-400 mt-1">{version.changes_summary}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleDownloadVersion(version.version)}
                            className="p-2 hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-blue-400 transition-colors"
                            title="Download"
                          >
                            <CloudArrowDownIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {/* TODO: Preview version */}}
                            className="p-2 hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-green-400 transition-colors"
                            title="Preview"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          {version.version !== document.version && (
                            <button
                              onClick={() => handleRevertToVersion(version.version)}
                              className="p-2 hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-yellow-400 transition-colors"
                              title="Revert to this version"
                            >
                              <ArrowPathIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'compare' && (
            <div>
              {comparison ? (
                <div>
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Comparing Version {comparison.version_a} vs Version {comparison.version_b}
                    </h3>
                    <div className="flex items-center space-x-4">
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                        Similarity: {comparison.similarity_score}%
                      </Badge>
                      <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">
                        {comparison.differences.length} differences
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {comparison.differences.map((diff, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-xl border ${getDifferenceColor(diff.type)}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Badge className={`text-xs ${getDifferenceColor(diff.type)}`}>
                              {diff.type.toUpperCase()}
                            </Badge>
                            <span className="font-medium text-white">{diff.section}</span>
                          </div>
                          {diff.line_number && (
                            <span className="text-xs text-slate-400">Line {diff.line_number}</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-300">{diff.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <CodeBracketIcon className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-300 mb-2">No comparison available</h3>
                  <p className="text-slate-400">Select exactly 2 versions from the Versions tab to compare them.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'upload' && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-6">Upload New Version</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Select File
                  </label>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.txt"
                    />
                    <div className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center hover:border-blue-500 transition-colors">
                      {newVersionFile ? (
                        <div>
                          <DocumentDuplicateIcon className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                          <p className="text-white font-medium">{newVersionFile.name}</p>
                          <p className="text-slate-400 text-sm">
                            {documentService.formatFileSize(newVersionFile.size)}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <PlusIcon className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                          <p className="text-white font-medium">Click to select a file</p>
                          <p className="text-slate-400 text-sm">or drag and drop</p>
                        </div>
                      )}
                    </div>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Version Notes (optional)
                  </label>
                  <textarea
                    value={versionNotes}
                    onChange={(e) => setVersionNotes(e.target.value)}
                    placeholder="Describe what changed in this version..."
                    rows={4}
                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 resize-none"
                  />
                </div>

                <div className="flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                  <p className="text-sm text-yellow-300">
                    Uploading a new version will increment the version number and preserve the previous version in history.
                  </p>
                </div>

                <div className="flex justify-end space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setNewVersionFile(null);
                      setVersionNotes('');
                      setActiveTab('versions');
                    }}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateNewVersion}
                    disabled={!newVersionFile || uploadingNewVersion}
                    className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadingNewVersion ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <PlusIcon className="h-4 w-4 mr-2" />
                        Create New Version
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};