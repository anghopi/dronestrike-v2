import React, { useState } from 'react';
import { EnhancedTable, ColumnConfig } from '../components/ui/enhanced-table';
import { UploadDocuments } from '../components/ui/upload-documents';
import { CurrencyInput } from '../components/ui/currency-input';
import { PhoneInput } from '../components/ui/phone-input';
import { EnhancedForm } from '../components/ui/enhanced-form';
import { StepForm, StepConfig } from '../components/ui/step-form';

interface DemoData {
  id: string;
  name: string;
  email: string;
  phone: string;
  amount: number;
  status: 'active' | 'pending' | 'inactive';
}

const ComponentDemo: React.FC = () => {
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [editingKeys, setEditingKeys] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    amount: 0,
  });

  // Sample data for table
  const demoData: DemoData[] = [
    {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '(555) 123-4567',
      amount: 50000,
      status: 'active'
    },
    {
      id: '2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      phone: '(555) 987-6543',
      amount: 75000,
      status: 'pending'
    },
    {
      id: '3',
      name: 'Bob Johnson',
      email: 'bob@example.com',
      phone: '(555) 456-7890',
      amount: 100000,
      status: 'active'
    }
  ];

  // Table columns configuration
  const columns: ColumnConfig<DemoData>[] = [
    {
      key: 'name',
      title: 'Name',
      dataIndex: 'name',
      editable: true,
      sortable: true,
    },
    {
      key: 'email',
      title: 'Email',
      dataIndex: 'email',
      editable: true,
      render: (value: string) => (
        <span className="text-blue-600">{value}</span>
      )
    },
    {
      key: 'phone',
      title: 'Phone',
      dataIndex: 'phone',
      render: (value: string) => (
        <span className="font-mono">{value}</span>
      )
    },
    {
      key: 'amount',
      title: 'Amount',
      dataIndex: 'amount',
      render: (value: number) => (
        <span className="font-semibold text-green-600">
          ${value.toLocaleString()}
        </span>
      )
    },
    {
      key: 'status',
      title: 'Status',
      dataIndex: 'status',
      render: (value: string) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          value === 'active' ? 'bg-green-100 text-green-800' :
          value === 'pending' ? 'bg-yellow-100 text-yellow-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {value.toUpperCase()}
        </span>
      )
    }
  ];

  // Step form configuration
  const steps: StepConfig[] = [
    {
      id: 'personal',
      title: 'Personal Information',
      description: 'Enter your basic details',
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Enter your name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Enter your email"
            />
          </div>
        </div>
      )
    },
    {
      id: 'contact',
      title: 'Contact Details',
      description: 'Phone and financial information',
      content: (
        <div className="space-y-4">
          <PhoneInput
            label="Phone Number"
            value={formData.phone}
            onChange={(value) => setFormData(prev => ({ ...prev, phone: value }))}
          />
          <CurrencyInput
            label="Loan Amount"
            value={formData.amount}
            onChange={(value) => setFormData(prev => ({ ...prev, amount: value || 0 }))}
            maxValue={1000000}
            minValue={0}
          />
        </div>
      )
    },
    {
      id: 'documents',
      title: 'Upload Documents',
      description: 'Upload any supporting documents',
      optional: true,
      content: (
        <UploadDocuments
          onUpload={async (files) => {
            console.log('Demo: Files uploaded:', files);
          }}
        />
      )
    }
  ];

  const handleFileUpload = async (files: File[]) => {
    console.log('Demo: Handling file upload:', files);
    alert(`${files.length} files uploaded successfully!`);
  };

  const handleFormSubmit = async () => {
    console.log('Demo: Form submitted:', formData);
    alert('Form submitted successfully!');
  };

  const handleStepFormSubmit = async () => {
    console.log('Demo: Step form completed:', formData);
    alert('Multi-step form completed!');
  };

  return (
    <div className="container mx-auto p-6 space-y-12">
      <div>
        <h1 className="text-3xl font-bold mb-2">BWA Component Integration Demo</h1>
        <p className="text-gray-600 mb-8">
          Demonstration of advanced components extracted from the BWA application
        </p>
      </div>

      {/* Enhanced Table Demo */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Enhanced Table</h2>
        <p className="text-gray-600">
          Advanced data table with inline editing, row selection, and bulk actions
        </p>
        <div className="bg-white rounded-lg border shadow-sm">
          <EnhancedTable
            data={demoData}
            columns={columns}
            rowKey="id"
            rowSelection={{
              selectedRowKeys: selectedRows,
              onChange: setSelectedRows
            }}
            onEdit={(record, key) => {
              setEditingKeys([key]);
              console.log('Editing:', record);
            }}
            onSave={(record) => {
              setEditingKeys([]);
              console.log('Saved:', record);
            }}
            onCancel={(key) => {
              setEditingKeys([]);
              console.log('Cancelled editing:', key);
            }}
            onDelete={(record) => {
              console.log('Delete:', record);
              alert(`Delete ${record.name}?`);
            }}
            editingKeys={editingKeys}
            className="p-4"
          />
        </div>
      </section>

      {/* Upload Documents Demo */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Document Upload</h2>
        <p className="text-gray-600">
          Drag-and-drop file upload with validation and progress tracking
        </p>
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <UploadDocuments onUpload={handleFileUpload} />
        </div>
      </section>

      {/* Form Inputs Demo */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Specialized Input Components</h2>
        <p className="text-gray-600">
          Phone number and currency inputs with formatting and validation
        </p>
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <EnhancedForm
            title="Contact Information"
            onSubmit={handleFormSubmit}
            variant="default"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PhoneInput
                label="Phone Number"
                value={formData.phone}
                onChange={(value) => setFormData(prev => ({ ...prev, phone: value }))}
                format="US"
              />
              <CurrencyInput
                label="Loan Amount"
                value={formData.amount}
                onChange={(value) => setFormData(prev => ({ ...prev, amount: value || 0 }))}
                maxValue={1000000}
                minValue={0}
              />
            </div>
          </EnhancedForm>
        </div>
      </section>

      {/* Step Form Demo */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Multi-Step Form</h2>
        <p className="text-gray-600">
          Guided multi-step form with progress tracking and validation
        </p>
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <StepForm
            steps={steps}
            currentStep={currentStep}
            onStepChange={setCurrentStep}
            onSubmit={handleStepFormSubmit}
            completedSteps={[]}
          />
        </div>
      </section>
    </div>
  );
};

export default ComponentDemo;