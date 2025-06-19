import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from './button';
import { Badge } from './badge';
import { Progress } from './progress';
import { EnhancedTable, ColumnConfig } from './enhanced-table';
import { 
  ArrowUpTrayIcon as Upload, 
  DocumentTextIcon as FileText, 
  ExclamationCircleIcon as AlertCircle, 
  CheckCircleIcon as CheckCircle 
} from '@heroicons/react/24/outline';
import { cn } from '../../lib/utils';

export interface UploadFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string | null;
  file: File;
}

interface UploadDocumentsProps {
  onUpload: (files: File[]) => Promise<void>;
  allowedTypes?: string[];
  maxFileSize?: number; // in bytes
  maxFiles?: number;
  className?: string;
}

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png'];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export function UploadDocuments({
  onUpload,
  allowedTypes = ALLOWED_EXTENSIONS,
  maxFileSize = MAX_FILE_SIZE,
  maxFiles = 10,
  className,
}: UploadDocumentsProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(extension)) {
      return `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`;
    }
    
    if (file.size > maxFileSize) {
      return `File size exceeds limit of ${formatFileSize(maxFileSize)}`;
    }
    
    return null;
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (files.length + acceptedFiles.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const newFiles: UploadFile[] = acceptedFiles.map(file => {
      const error = validateFile(file);
      return {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: file.size,
        type: file.type,
        status: error ? 'error' : 'pending',
        progress: 0,
        error,
        file,
      };
    });

    setFiles(prev => [...prev, ...newFiles]);
  }, [files.length, maxFiles, allowedTypes, maxFileSize, validateFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    maxFiles,
  });

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(file => file.id !== id));
  };

  const handleUpload = async () => {
    const validFiles = files.filter(file => file.status !== 'error');
    
    if (validFiles.length === 0) {
      alert('No valid files to upload');
      return;
    }

    setUploading(true);
    
    try {
      // Simulate upload progress
      for (const file of validFiles) {
        setFiles(prev => prev.map(f => 
          f.id === file.id ? { ...f, status: 'uploading' } : f
        ));

        // Simulate progress
        for (let progress = 0; progress <= 100; progress += 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          setFiles(prev => prev.map(f => 
            f.id === file.id ? { ...f, progress } : f
          ));
        }

        setFiles(prev => prev.map(f => 
          f.id === file.id ? { ...f, status: 'success', progress: 100 } : f
        ));
      }

      await onUpload(validFiles.map(f => f.file));
      alert(`${validFiles.length} files uploaded successfully`);
    } catch (error) {
      alert('Upload failed');
      setFiles(prev => prev.map(f => 
        validFiles.some(vf => vf.id === f.id) 
          ? { ...f, status: 'error', error: 'Upload failed' }
          : f
      ));
    } finally {
      setUploading(false);
    }
  };

  const columns: ColumnConfig<UploadFile>[] = [
    {
      key: 'name',
      title: 'File Name',
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{record.name}</span>
        </div>
      ),
    },
    {
      key: 'size',
      title: 'Size',
      render: (value) => formatFileSize(value),
    },
    {
      key: 'status',
      title: 'Status',
      render: (_, record) => {
        const statusConfig = {
          pending: { variant: 'secondary', icon: AlertCircle, text: 'Pending' },
          uploading: { variant: 'default', icon: Upload, text: 'Uploading' },
          success: { variant: 'default', icon: CheckCircle, text: 'Success' },
          error: { variant: 'destructive', icon: AlertCircle, text: 'Error' },
        };
        
        const config = statusConfig[record.status];
        const Icon = config.icon;
        
        return (
          <div className="flex items-center gap-2">
            <Badge variant={config.variant as any} className="flex items-center gap-1">
              <Icon className="h-3 w-3" />
              {config.text}
            </Badge>
            {record.status === 'uploading' && (
              <div className="w-20">
                <Progress value={record.progress} className="h-2" />
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'error',
      title: 'Error',
      render: (value) => value ? (
        <span className="text-destructive text-sm">{value}</span>
      ) : null,
    },
  ];

  return (
    <div className={cn('space-y-6', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
          'hover:border-primary hover:bg-primary/5'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <div className="space-y-2">
          <p className="text-lg font-medium">
            {isDragActive ? 'Drop files here' : 'Click or drag files to upload'}
          </p>
          <p className="text-sm text-muted-foreground">
            Support for single or bulk upload. Max file size: {formatFileSize(maxFileSize)}
            <br />
            Allowed extensions: <strong>{allowedTypes.join(', ')}</strong>
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Files ({files.length})</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setFiles([])}
                disabled={uploading}
              >
                Clear All
              </Button>
              <Button
                onClick={handleUpload}
                disabled={uploading || files.every(f => f.status === 'error')}
              >
                Upload Files
              </Button>
            </div>
          </div>

          <EnhancedTable
            data={files}
            columns={columns}
            rowKey="id"
            onDelete={(record) => removeFile(record.id)}
            className="border-0"
          />
        </div>
      )}
    </div>
  );
}