import React, { useState, useEffect } from 'react';
import {
  XMarkIcon,
  DocumentTextIcon,
  SparklesIcon,
  ArrowRightIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { templateService, DocumentTemplate, TemplateField, TemplateGenerationRequest } from '../../services/templateService';

interface DocumentTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (request: TemplateGenerationRequest) => Promise<void>;
  category?: string;
}

export const DocumentTemplateModal: React.FC<DocumentTemplateModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
  category
}) => {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [outputFormat, setOutputFormat] = useState<'pdf' | 'docx' | 'html'>('pdf');
  const [filename, setFilename] = useState('');
  const [step, setStep] = useState<'select' | 'fill' | 'preview'>('select');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen, category]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const templatesData = await templateService.getTemplates(category);
      setTemplates(templatesData);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (template: DocumentTemplate) => {
    setSelectedTemplate(template);
    // Initialize field values with defaults
    const initialValues: Record<string, any> = {};
    template.fields.forEach(field => {
      initialValues[field.name] = field.default_value || '';
    });
    setFieldValues(initialValues);
    setFilename(`${template.name}_${new Date().toISOString().split('T')[0]}`);
    setStep('fill');
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setFieldValues(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleGenerate = async () => {
    if (!selectedTemplate) return;

    setGenerating(true);
    try {
      const request: TemplateGenerationRequest = {
        template_id: selectedTemplate.id,
        field_values: fieldValues,
        output_format: outputFormat,
        filename: filename || undefined
      };

      await onGenerate(request);
      onClose();
      resetModal();
    } catch (error) {
      console.error('Error generating document:', error);
    } finally {
      setGenerating(false);
    }
  };

  const resetModal = () => {
    setStep('select');
    setSelectedTemplate(null);
    setFieldValues({});
    setFilename('');
  };

  const renderField = (field: TemplateField) => {
    const value = fieldValues[field.name] || '';

    switch (field.type) {
      case 'text':
        return (
          <Input
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            className="bg-slate-700/50 border-slate-600 text-white"
          />
        );
      
      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            className="bg-slate-700/50 border-slate-600 text-white"
          />
        );
      
      case 'date':
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            required={field.required}
            className="bg-slate-700/50 border-slate-600 text-white"
          />
        );
      
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            required={field.required}
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white appearance-none cursor-pointer focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Select {field.label}</option>
            {field.options?.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );
      
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            rows={4}
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white resize-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
          />
        );
      
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-2xl border border-slate-700/50 w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-500/30">
              <SparklesIcon className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Generate Document from Template</h2>
              <p className="text-slate-400 text-sm">
                {step === 'select' && 'Choose a template to get started'}
                {step === 'fill' && 'Fill in the required fields'}
                {step === 'preview' && 'Review and generate your document'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {step === 'select' && (
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">Available Templates</h3>
                <p className="text-slate-400">Select a template to generate your document</p>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-400 border-t-transparent"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templates.map(template => (
                    <div
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-blue-500/50 cursor-pointer transition-all duration-200 group hover:bg-slate-800/80"
                    >
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-lg border border-blue-500/30 group-hover:from-blue-500/30 group-hover:to-cyan-500/30 transition-all">
                          <DocumentTextIcon className="h-5 w-5 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white group-hover:text-blue-300 transition-colors">
                            {template.name}
                          </h4>
                          <p className="text-sm text-slate-400 mb-2">
                            {template.description}
                          </p>
                          <div className="flex items-center space-x-4 text-xs text-slate-500">
                            <span className="capitalize px-2 py-1 bg-slate-700/50 rounded-md">
                              {template.category}
                            </span>
                            <span>{template.fields.length} fields</span>
                            <span>Used {template.usage_count} times</span>
                          </div>
                        </div>
                        <ArrowRightIcon className="h-5 w-5 text-slate-400 group-hover:text-blue-400 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 'fill' && selectedTemplate && (
            <div>
              <div className="mb-6">
                <div className="flex items-center space-x-3 mb-4">
                  <button
                    onClick={() => setStep('select')}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    ← Back to templates
                  </button>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {selectedTemplate.name}
                </h3>
                <p className="text-slate-400">{selectedTemplate.description}</p>
              </div>

              <div className="space-y-6">
                {/* Template Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {selectedTemplate.fields.map(field => (
                    <div key={field.id}>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        {field.label}
                        {field.required && <span className="text-red-400 ml-1">*</span>}
                      </label>
                      {renderField(field)}
                    </div>
                  ))}
                </div>

                {/* Output Settings */}
                <div className="border-t border-slate-700/50 pt-6">
                  <h4 className="text-md font-semibold text-white mb-4">Output Settings</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Output Format
                      </label>
                      <select
                        value={outputFormat}
                        onChange={(e) => setOutputFormat(e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white appearance-none cursor-pointer focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="pdf">PDF Document</option>
                        <option value="docx">Word Document</option>
                        <option value="html">HTML Document</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Filename (optional)
                      </label>
                      <Input
                        value={filename}
                        onChange={(e) => setFilename(e.target.value)}
                        placeholder="Document filename"
                        className="bg-slate-700/50 border-slate-600 text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Generate Button */}
                <div className="flex justify-end space-x-3 pt-6">
                  <Button
                    variant="outline"
                    onClick={() => setStep('select')}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleGenerate}
                    disabled={generating || selectedTemplate.fields.some(field => 
                      field.required && !fieldValues[field.name]
                    )}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                        Generating...
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="h-4 w-4 mr-2" />
                        Generate Document
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