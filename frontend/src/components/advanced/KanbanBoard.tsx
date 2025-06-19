import React, { useState } from 'react';
import { PlusIcon, EllipsisVerticalIcon } from '@heroicons/react/24/outline';
import { MilitaryCard } from '../ui/MilitaryCard';
import { StatusBadge } from '../ui/StatusBadge';
import { MilitaryButton } from '../ui/MilitaryButton';

interface KanbanItem {
  id: string;
  title: string;
  description?: string;
  assignee?: {
    name: string;
    avatar?: string;
  };
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags?: string[];
  dueDate?: Date;
}

interface KanbanColumn {
  id: string;
  title: string;
  items: KanbanItem[];
  color: string;
  limit?: number;
}

interface KanbanBoardProps {
  columns: KanbanColumn[];
  onItemMove?: (itemId: string, fromColumn: string, toColumn: string) => void;
  onItemClick?: (item: KanbanItem) => void;
  onAddItem?: (columnId: string) => void;
  className?: string;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  columns,
  onItemMove,
  onItemClick,
  onAddItem,
  className
}) => {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [draggedFrom, setDraggedFrom] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, itemId: string, columnId: string) => {
    setDraggedItem(itemId);
    setDraggedFrom(columnId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    
    if (draggedItem && draggedFrom && draggedFrom !== columnId) {
      onItemMove?.(draggedItem, draggedFrom, columnId);
    }
    
    setDraggedItem(null);
    setDraggedFrom(null);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'critical-red';
      case 'high': return 'orange-500';
      case 'medium': return 'yellow-500';
      case 'low': return 'olive-green';
      default: return 'gray-500';
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const isOverdue = (date: Date) => {
    return date < new Date();
  };

  return (
    <div className={`flex gap-6 overflow-x-auto pb-4 ${className}`}>
      {columns.map((column) => (
        <div
          key={column.id}
          className="flex-shrink-0 w-80"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, column.id)}
        >
          {/* Column Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full bg-${column.color}`}
                style={{ backgroundColor: column.color }}
              />
              <h3 className="font-semibold text-white text-lg">
                {column.title}
              </h3>
              <span className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-full">
                {column.items.length}
                {column.limit && `/${column.limit}`}
              </span>
            </div>
            
            {onAddItem && (
              <MilitaryButton
                variant="secondary"
                size="sm"
                onClick={() => onAddItem(column.id)}
                className="p-1"
              >
                <PlusIcon className="w-4 h-4" />
              </MilitaryButton>
            )}
          </div>

          {/* Column Items */}
          <div className="space-y-3 min-h-[200px]">
            {column.items.map((item) => (
              <MilitaryCard
                key={item.id}
                padding="sm"
                hover
                className={`
                  cursor-pointer transition-all duration-200
                  ${draggedItem === item.id ? 'opacity-50 transform rotate-2' : ''}
                  hover:shadow-lg
                `}
                draggable
                onDragStart={(e: React.DragEvent<HTMLDivElement>) => handleDragStart(e, item.id, column.id)}
                onClick={() => onItemClick?.(item)}
              >
                {/* Item Header */}
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-white text-sm leading-5">
                    {item.title}
                  </h4>
                  <button className="text-gray-400 hover:text-white p-1">
                    <EllipsisVerticalIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Item Description */}
                {item.description && (
                  <p className="text-gray-400 text-xs mb-3 line-clamp-2">
                    {item.description}
                  </p>
                )}

                {/* Tags */}
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {item.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="bg-brand-color/20 text-brand-color text-xs px-2 py-0.5 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Item Footer */}
                <div className="flex items-center justify-between">
                  {/* Priority and Due Date */}
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      status={item.priority as any}
                      size="sm"
                    >
                      {item.priority.toUpperCase()}
                    </StatusBadge>
                    
                    {item.dueDate && (
                      <span
                        className={`text-xs ${
                          isOverdue(item.dueDate) 
                            ? 'text-critical-red' 
                            : 'text-gray-400'
                        }`}
                      >
                        {formatDate(item.dueDate)}
                      </span>
                    )}
                  </div>

                  {/* Assignee Avatar */}
                  {item.assignee && (
                    <div className="flex items-center">
                      {item.assignee.avatar ? (
                        <img
                          src={item.assignee.avatar}
                          alt={item.assignee.name}
                          className="w-6 h-6 rounded-full border border-gray-600"
                        />
                      ) : (
                        <div className="w-6 h-6 bg-brand-color rounded-full flex items-center justify-center text-xs font-medium text-white">
                          {item.assignee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </MilitaryCard>
            ))}

            {/* Empty State */}
            {column.items.length === 0 && (
              <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center">
                <p className="text-gray-500 text-sm">No items in {column.title.toLowerCase()}</p>
                {onAddItem && (
                  <MilitaryButton
                    variant="secondary"
                    size="sm"
                    onClick={() => onAddItem(column.id)}
                    className="mt-2"
                  >
                    Add Item
                  </MilitaryButton>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};