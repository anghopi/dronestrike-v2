import React, { useState, useMemo } from 'react';
import { ChevronUpIcon, ChevronDownIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline';
import { MilitaryCard } from '../ui/MilitaryCard';
import { StatusBadge } from '../ui/StatusBadge';
import { MilitaryButton } from '../ui/MilitaryButton';

interface Column {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (value: any, row: any) => React.ReactNode;
  width?: string;
}

interface AdvancedDataTableProps {
  data: any[];
  columns: Column[];
  loading?: boolean;
  emptyMessage?: string;
  pageSize?: number;
  onRowClick?: (row: any) => void;
  onBulkAction?: (selectedRows: any[], action: string) => void;
  bulkActions?: { key: string; label: string; variant?: 'primary' | 'danger' }[];
  searchable?: boolean;
  onSearch?: (query: string) => void;
}

export const AdvancedDataTable: React.FC<AdvancedDataTableProps> = ({
  data = [],
  columns,
  loading = false,
  emptyMessage = 'No data available',
  pageSize = 10,
  onRowClick,
  onBulkAction,
  bulkActions = [],
  searchable = false,
  onSearch
}) => {
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  // Memoized filtered and sorted data
  const processedData = useMemo(() => {
    let result = [...data];

    // Apply search filter
    if (searchQuery.trim()) {
      result = result.filter(row =>
        columns.some(col => {
          const value = row[col.key];
          return value?.toString().toLowerCase().includes(searchQuery.toLowerCase());
        })
      );
    }

    // Apply sorting
    if (sortField) {
      result.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        const modifier = sortDirection === 'asc' ? 1 : -1;
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return (aVal - bVal) * modifier;
        }
        
        return aVal.toString().localeCompare(bVal.toString()) * modifier;
      });
    }

    return result;
  }, [data, searchQuery, sortField, sortDirection, columns]);

  // Paginated data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return processedData.slice(startIndex, startIndex + pageSize);
  }, [processedData, currentPage, pageSize]);

  const totalPages = Math.ceil(processedData.length / pageSize);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = () => {
    if (selectedRows.size === paginatedData.length && paginatedData.length > 0) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedData.map((_, index) => (currentPage - 1) * pageSize + index)));
    }
  };

  const handleRowSelect = (index: number) => {
    const actualIndex = (currentPage - 1) * pageSize + index;
    const newSelected = new Set(selectedRows);
    if (newSelected.has(actualIndex)) {
      newSelected.delete(actualIndex);
    } else {
      newSelected.add(actualIndex);
    }
    setSelectedRows(newSelected);
  };

  const handleBulkAction = (action: string) => {
    const selectedData = Array.from(selectedRows).map(index => data[index]);
    onBulkAction?.(selectedData, action);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page
    onSearch?.(query);
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ChevronUpDownIcon className="w-4 h-4 text-gray-400" />;
    }
    return sortDirection === 'asc' ? 
      <ChevronUpIcon className="w-4 h-4 text-brand-color" /> :
      <ChevronDownIcon className="w-4 h-4 text-brand-color" />;
  };

  if (loading) {
    return (
      <MilitaryCard className="animate-pulse">
        <div className="space-y-4">
          <div className="h-4 bg-gray-700 rounded w-1/4"></div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </MilitaryCard>
    );
  }

  return (
    <MilitaryCard className="overflow-hidden">
      {/* Header with search and bulk actions */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          {searchable && (
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full bg-navy-blue border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-color focus:border-transparent"
              />
            </div>
          )}
          
          {selectedRows.size > 0 && bulkActions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-300">
                {selectedRows.size} selected
              </span>
              {bulkActions.map(action => (
                <MilitaryButton
                  key={action.key}
                  variant={action.variant || 'primary'}
                  size="sm"
                  onClick={() => handleBulkAction(action.key)}
                >
                  {action.label}
                </MilitaryButton>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-navy-blue border-b border-gray-700">
            <tr>
              {(onBulkAction || bulkActions.length > 0) && (
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === paginatedData.length && paginatedData.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-600 bg-navy-blue text-brand-color focus:ring-brand-color focus:ring-offset-gray-900"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider ${column.width || ''}`}
                >
                  {column.sortable ? (
                    <button
                      onClick={() => handleSort(column.key)}
                      className="flex items-center gap-1 hover:text-white transition-colors"
                    >
                      {column.header}
                      {getSortIcon(column.key)}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-navy-blue-dark divide-y divide-gray-700">
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (bulkActions.length > 0 ? 1 : 0)}
                  className="px-6 py-12 text-center text-gray-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => {
                const actualIndex = (currentPage - 1) * pageSize + index;
                const isSelected = selectedRows.has(actualIndex);
                
                return (
                  <tr
                    key={actualIndex}
                    onClick={() => onRowClick?.(row)}
                    className={`
                      transition-colors duration-150
                      ${onRowClick ? 'cursor-pointer hover:bg-navy-blue/50' : ''}
                      ${isSelected ? 'bg-brand-color/10' : ''}
                    `}
                  >
                    {(onBulkAction || bulkActions.length > 0) && (
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleRowSelect(index)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-gray-600 bg-navy-blue text-brand-color focus:ring-brand-color focus:ring-offset-gray-900"
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td key={column.key} className={`px-6 py-4 text-sm text-gray-300 ${column.width || ''}`}>
                        {column.render ? 
                          column.render(row[column.key], row) : 
                          (row[column.key]?.toString() || '-')
                        }
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-gray-700 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, processedData.length)} of {processedData.length} results
          </div>
          <div className="flex items-center gap-2">
            <MilitaryButton
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </MilitaryButton>
            
            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                if (pageNum > totalPages) return null;
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`
                      px-3 py-1 text-sm rounded-md transition-colors
                      ${pageNum === currentPage 
                        ? 'bg-brand-color text-white' 
                        : 'text-gray-400 hover:text-white hover:bg-navy-blue'
                      }
                    `}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <MilitaryButton
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </MilitaryButton>
          </div>
        </div>
      )}
    </MilitaryCard>
  );
};