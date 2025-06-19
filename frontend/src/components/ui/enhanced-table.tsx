import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table';
import { Button } from './button';
import { Input } from './input';
import { Checkbox } from './checkbox';
import { 
  PencilIcon as Edit, 
  CheckIcon as Save, 
  XMarkIcon as X, 
  ArrowDownTrayIcon as Download, 
  TrashIcon as Trash2 
} from '@heroicons/react/24/outline';
import { cn } from '../../lib/utils';

export interface ColumnConfig<T> {
  key: keyof T | string;
  title: string;
  dataIndex?: keyof T;
  render?: (value: any, record: T, index: number) => React.ReactNode;
  editable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  width?: number;
}

export interface EnhancedTableProps<T = Record<string, any>> {
  data: T[];
  columns: ColumnConfig<T>[];
  loading?: boolean;
  rowSelection?: {
    selectedRowKeys: string[];
    onChange: (selectedRowKeys: string[]) => void;
  };
  onEdit?: (record: T, key: string) => void;
  onSave?: (record: T) => void;
  onCancel?: (key: string) => void;
  onDelete?: (record: T) => void;
  onDownload?: (record: T) => void;
  editingKeys?: string[];
  rowKey?: keyof T | ((record: T) => string);
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    onChange: (page: number, pageSize: number) => void;
  };
  className?: string;
  scroll?: { x?: number; y?: number };
  onRowClick?: (record: T) => void;
}

export function EnhancedTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  rowSelection,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onDownload,
  editingKeys = [],
  rowKey = 'id',
  pagination,
  className,
  scroll,
  onRowClick,
}: EnhancedTableProps<T>) {
  const getRowKey = (record: T): string => {
    if (typeof rowKey === 'function') {
      return rowKey(record);
    }
    return String(record[rowKey]);
  };

  const isEditing = (record: T): boolean => {
    return editingKeys.includes(getRowKey(record));
  };

  const renderCell = (column: ColumnConfig<T>, record: T, index: number) => {
    const key = getRowKey(record);
    const editing = isEditing(record);
    const value = column.dataIndex ? record[column.dataIndex] : record[column.key as keyof T];

    if (column.editable && editing) {
      return (
        <Input
          defaultValue={value}
          onBlur={(e) => {
            if (onEdit) {
              onEdit({ ...record, [column.dataIndex || column.key]: e.target.value }, key);
            }
          }}
          className="h-8"
        />
      );
    }

    if (column.render) {
      return column.render(value, record, index);
    }

    return value;
  };

  const renderActionColumn = (record: T, index: number) => {
    const key = getRowKey(record);
    const editing = isEditing(record);

    return (
      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onSave?.(record)}
              className="h-8 w-8 p-0"
            >
              <Save className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onCancel?.(key)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            {onEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onEdit(record, key)}
                className="h-8 w-8 p-0"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {onDownload && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDownload(record)}
                className="h-8 w-8 p-0"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(record)}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
      </div>
    );
  };

  const hasActions = onEdit || onSave || onDelete || onDownload;

  return (
    <div className={cn('w-full', className)}>
      <div className="rounded-md border" style={{ overflowX: scroll?.x ? 'auto' : 'visible' }}>
        <Table>
          <TableHeader>
            <TableRow>
              {rowSelection && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={rowSelection.selectedRowKeys.length === data.length}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        rowSelection.onChange(data.map(getRowKey));
                      } else {
                        rowSelection.onChange([]);
                      }
                    }}
                  />
                </TableHead>
              )}
              {columns.map((column) => (
                <TableHead key={String(column.key)} style={{ width: column.width }}>
                  {column.title}
                </TableHead>
              ))}
              {hasActions && <TableHead className="w-32">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell 
                  colSpan={columns.length + (rowSelection ? 1 : 0) + (hasActions ? 1 : 0)}
                  className="text-center py-8"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell 
                  colSpan={columns.length + (rowSelection ? 1 : 0) + (hasActions ? 1 : 0)}
                  className="text-center py-8"
                >
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              data.map((record, index) => {
                const key = getRowKey(record);
                return (
                  <TableRow key={key}>
                    {rowSelection && (
                      <TableCell>
                        <Checkbox
                          checked={rowSelection.selectedRowKeys.includes(key)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              rowSelection.onChange([...rowSelection.selectedRowKeys, key]);
                            } else {
                              rowSelection.onChange(
                                rowSelection.selectedRowKeys.filter((k) => k !== key)
                              );
                            }
                          }}
                        />
                      </TableCell>
                    )}
                    {columns.map((column) => (
                      <TableCell key={String(column.key)}>
                        {renderCell(column, record, index)}
                      </TableCell>
                    ))}
                    {hasActions && (
                      <TableCell>
                        {renderActionColumn(record, index)}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}