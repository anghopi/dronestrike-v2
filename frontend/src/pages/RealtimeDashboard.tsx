import React from 'react';
import RealtimeDashboard from '../components/realtime/RealtimeDashboard';
import RealtimeNotificationCenter from '../components/realtime/RealtimeNotificationCenter';

const RealtimeDashboardPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Notifications */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Real-Time Command Center</h1>
          <RealtimeNotificationCenter />
        </div>
      </div>
      
      {/* Main Dashboard */}
      <div className="p-6">
        <RealtimeDashboard />
      </div>
    </div>
  );
};

export default RealtimeDashboardPage;