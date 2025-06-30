import React, { useState, useEffect } from 'react';
import { 
  XMarkIcon, 
  DocumentTextIcon,
  SparklesIcon,
  PlusIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { 
  DocumentTemplate, 
  DocumentGenerationRequest, 
  documentService 
} from '../../services/documentService';

interface DocumentGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (request: DocumentGenerationRequest) => Promise<void>;
}

export const DocumentGenerationModal: React.FC<DocumentGenerationModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
}) => {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [outputName, setOutputName] = useState('');
  const [outputFormat, setOutputFormat] = useState<'pdf' | 'docx'>('pdf');
  const [variables, setVariables] = useState<Record<string, any>>({});
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedTemplate) {
      // Initialize variables with default values
      const initialVariables: Record<string, any> = {};
      selectedTemplate.variables.forEach(variable => {
        initialVariables[variable.name] = variable.default_value || '';
      });
      setVariables(initialVariables);
      setOutputName(`${selectedTemplate.name} - ${new Date().toLocaleDateString()}`);
    }
  }, [selectedTemplate]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const templatesData = await documentService.getTemplates();
      setTemplates(templatesData);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedTemplate) return;

    setGenerating(true);
    try {
      const request: DocumentGenerationRequest = {
        template_id: selectedTemplate.id,
        variables,
        output_name: outputName,
        output_format: outputFormat,
      };

      await onGenerate(request);
      onClose();
    } catch (error) {
      console.error('Error generating document:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleVariableChange = (variableName: string, value: any) => {
    setVariables(prev => ({
      ...prev,
      [variableName]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-2xl border border-slate-700/50 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <div className="flex items-center space-x-3">
            <SparklesIcon className="h-6 w-6 text-purple-400" />
            <h2 className="text-xl font-bold text-white">Generate Document</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Template Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Select Template
            </label>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-400"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map(template => (
                  <div
                    key={template.id}
                    onClick={() => setSelectedTemplate(template)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                      selectedTemplate?.id === template.id
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <DocumentTextIcon className="h-6 w-6 text-purple-400 flex-shrink-0 mt-1" />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-white mb-1">
                          {template.name}
                        </h3>
                        <p className="text-xs text-slate-400 mb-2">
                          {template.description}
                        </p>
                        <div className="text-xs text-slate-500">
                          {template.variables.length} variable{template.variables.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedTemplate && (
            <>
              {/* Output Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Output Name
                  </label>
                  <Input
                    value={outputName}
                    onChange={(e) => setOutputName(e.target.value)}
                    placeholder="Document name"
                    className="bg-slate-700/50 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Output Format
                  </label>
                  <select
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value as 'pdf' | 'docx')}
                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                  >
                    <option value="pdf">PDF</option>
                    <option value="docx">Word Document</option>
                  </select>
                </div>
              </div>

              {/* Template Variables */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Template Variables
                </label>
                <div className="space-y-4">
                  {selectedTemplate.variables.map(variable => (
                    <div key={variable.name} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                      <div>
                        <label className="block text-sm font-medium text-white mb-1">
                          {variable.name}
                          {variable.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                        {variable.description && (
                          <p className="text-xs text-slate-400">{variable.description}</p>
                        )}
                      </div>
                      <div className="md:col-span-2">
                        {variable.type === 'text' && (
                          <Input
                            value={variables[variable.name] || ''}
                            onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                            placeholder={variable.default_value || `Enter ${variable.name}`}
                            className="bg-slate-700/50 border-slate-600 text-white"
                            required={variable.required}
                          />
                        )}
                        {variable.type === 'number' && (
                          <Input
                            type="number"
                            value={variables[variable.name] || ''}
                            onChange={(e) => handleVariableChange(variable.name, Number(e.target.value))}
                            placeholder={variable.default_value || `Enter ${variable.name}`}
                            className="bg-slate-700/50 border-slate-600 text-white"
                            required={variable.required}
                          />
                        )}
                        {variable.type === 'date' && (
                          <Input
                            type="date"
                            value={variables[variable.name] || ''}
                            onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                            className="bg-slate-700/50 border-slate-600 text-white"
                            required={variable.required}
                          />
                        )}
                        {variable.type === 'boolean' && (
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={variables[variable.name] || false}
                              onChange={(e) => handleVariableChange(variable.name, e.target.checked)}
                              className="w-4 h-4 text-purple-600 bg-slate-700 border-slate-600 rounded focus:ring-purple-500"
                            />
                            <span className="text-sm text-slate-300">
                              {variable.description || 'Enable this option'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview Variables */}
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                <h4 className="text-sm font-semibold text-white mb-3">Variable Preview</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(variables).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">{key}:</span>
                      <span className="text-white font-medium">
                        {value?.toString() || 'Not set'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-700/50">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={generating}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!selectedTemplate || generating || !outputName}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {generating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Generating...
              </>
            ) : (
              <>
                <SparklesIcon className="h-4 w-4 mr-2" />
                Generate Document
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};