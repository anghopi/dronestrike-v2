import React, { useState } from 'react';
import { 
  Bars3Icon, 
  MagnifyingGlassIcon,
  MicrophoneIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';
import NotificationCenter from '../advanced/NotificationCenter';

interface HeaderProps {
  toggleSidebar: () => void;
  title: string;
}

export const Header: React.FC<HeaderProps> = ({ toggleSidebar, title }) => {
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="h-full bg-navy-blue border-b border-gray-700 flex items-center justify-between px-6 shadow-lg">
      {/* Left Section */}
      <div className="flex items-center space-x-6">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-navy-blue-light text-gray-300 hover:text-white transition-colors duration-200"
        >
          <Bars3Icon className="h-5 w-5" />
        </button>
        
        <div className="border-l border-gray-700/50 pl-6">
          <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
        </div>
      </div>

      {/* Center Section - Search */}
      <div className="flex-1 max-w-2xl mx-8">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" />
          </div>
          <input
            type="text"
            placeholder="Search targets, missions, opportunities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-gray-800/80 transition-all duration-300 shadow-inner backdrop-blur-sm"
          />
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center space-x-4">
        {/* Token Display */}
        {profile && (
          <div className="hidden sm:flex items-center space-x-3">
            <div className="flex items-center space-x-3 bg-gradient-to-r from-green-600/20 to-green-700/20 px-4 py-2.5 rounded-xl shadow-lg border border-green-500/30 backdrop-blur-sm">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-sm"></div>
              <span className="text-xs text-green-300 font-bold tracking-wider">TOKENS</span>
              <span className="text-sm font-bold text-white drop-shadow-sm">{profile.tokens.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Voice Commands */}
        <button className="p-2 rounded-lg hover:bg-military-700 text-gray-300 hover:text-white transition-colors duration-200">
          <MicrophoneIcon className="h-5 w-5" />
        </button>

        {/* Notifications */}
        <div className="border-l border-gray-700/50 pl-4">
          <NotificationCenter />
        </div>

        {/* User Profile */}
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-color to-brand-color-light flex items-center justify-center">
            <span className="text-white text-sm font-bold">
              {profile?.user?.first_name?.[0] || profile?.user?.username?.[0] || 'U'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};