import React, { useState } from 'react';
import { 
  PlusIcon,
  ArrowUpTrayIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

interface HeaderTabsProps {
  title: string;
  searchPlaceholder?: string;
  showNewButton?: boolean;
  showImportButton?: boolean;
  showFilters?: boolean;
  onNew?: () => void;
  onImport?: () => void;
  onSearch?: (query: string) => void;
  onFiltersToggle?: () => void;
  tabs?: Array<{
    id: string;
    name: string;
    count?: number;
  }>;
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  extraContent?: React.ReactNode;
}

export const HeaderTabs: React.FC<HeaderTabsProps> = ({
  title,
  searchPlaceholder = "Search...",
  showNewButton = true,
  showImportButton = true,
  showFilters = true,
  onNew,
  onImport,
  onSearch,
  onFiltersToggle,
  tabs = [],
  activeTab,
  onTabChange,
  extraContent,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch?.(query);
  };

  return (
    <div className="bg-military-800 border-b border-gray-700 sticky top-16 z-30">
      {/* Main Header Section */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left Section - Title */}
          <div>
            <h1 className="text-2xl font-bold text-white">{title}</h1>
          </div>

          {/* Right Section - Actions */}
          <div className="flex items-center space-x-3">
            {/* Search */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-400 text-sm">Search</span>
              </div>
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-64 pl-9 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-color focus:border-transparent transition-all duration-200"
              />
            </div>

            {/* Filters Button */}
            {showFilters && (
              <button
                onClick={onFiltersToggle}
                className="flex items-center gap-2 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm font-medium text-white hover:text-white hover:bg-gray-600 transition-all duration-200"
              >
                <FunnelIcon className="h-4 w-4" />
                Filters
              </button>
            )}

            {/* Import Button */}
            {showImportButton && (
              <button
                onClick={onImport}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm font-medium text-white hover:text-white hover:bg-gray-600 transition-all duration-200"
              >
                <ArrowUpTrayIcon className="h-4 w-4" />
                Import
              </button>
            )}

            {/* New Button */}
            {showNewButton && (
              <button
                onClick={onNew}
                className="btn-primary flex items-center gap-2"
              >
                <PlusIcon className="h-4 w-4" />
                New
              </button>
            )}

            {/* Extra Content */}
            {extraContent && extraContent}
          </div>
        </div>
      </div>

      {/* Tabs Section */}
      {tabs.length > 0 && (
        <div className="px-6">
          <nav className="flex space-x-8 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange?.(tab.id)}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeTab === tab.id
                    ? 'border-brand-color text-brand-color'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                {tab.name}
                {tab.count !== undefined && (
                  <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                    activeTab === tab.id
                      ? 'bg-brand-color text-white'
                      : 'bg-gray-700 text-gray-300'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
};