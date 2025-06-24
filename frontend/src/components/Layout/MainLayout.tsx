import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const location = useLocation();

  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  const getPageTitle = () => {
    const pathMap: Record<string, string> = {
      '/dashboard': 'War Room',
      '/leads': 'Targets',
      '/properties': 'Missions', 
      '/opportunities': 'Opportunities',
      '/mission-targets': 'BOTG Mission Targets',
      '/targets': 'Targets',
      '/targets-advanced': 'Targets Advanced',
      '/targets-map': 'Targets Map View',
      '/missions': 'Missions',
      '/marketing': 'Marketing',
      '/documents': 'Documents',
      '/map': 'Map View',
      '/tokens': 'Intelligence Tokens',
      '/settings': 'Settings',
      '/import': 'CSV Import',
      '/scheduled-imports': 'Scheduled Imports',
      '/help': 'Help & Support',
      '/analytics': 'Analytics',
      '/profile': 'Profile',
    };
    
    return pathMap[location.pathname] || 'Command Center';
  };

  return (
    <div className="flex h-screen bg-navy-blue-dark overflow-hidden">
      {/* Sidebar - Fixed 256px width */}
      {sidebarVisible && (
        <div className="w-[256px] flex-shrink-0">
          <Sidebar isVisible={sidebarVisible} />
        </div>
      )}
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-navy-blue-dark">
        {/* Header - Fixed height */}
        <div className="h-16 flex-shrink-0">
          <Header toggleSidebar={toggleSidebar} title={getPageTitle()} />
        </div>
        
        {/* Main Content */}
        <main className="flex-1 p-4 overflow-auto">
          {children}
        </main>
      </div>
      
      {/* Mobile overlay */}
      {sidebarVisible && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarVisible(false)}
        />
      )}
    </div>
  );
};