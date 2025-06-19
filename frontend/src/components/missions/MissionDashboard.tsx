import React from 'react';
import { 
  MapIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  UserIcon,
  CameraIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';

interface Mission {
  id: number;
  status: string;
  priority: string;
  estimated_duration: number;
  photos_uploaded: number;
  photos_required: number;
  safety_level: string;
}

interface MissionDashboardProps {
  missions: Mission[];
}

export const MissionDashboard: React.FC<MissionDashboardProps> = ({ missions }) => {
  const stats = {
    total: missions.length,
    active: missions.filter(m => ['assigned', 'in_progress'].includes(m.status)).length,
    completed: missions.filter(m => m.status === 'completed').length,
    highPriority: missions.filter(m => ['high', 'urgent'].includes(m.priority)).length,
    avgDuration: Math.round(missions.reduce((acc, m) => acc + m.estimated_duration, 0) / missions.length || 0),
    photoProgress: missions.length > 0 ? 
      Math.round((missions.reduce((acc, m) => acc + (m.photos_uploaded / m.photos_required), 0) / missions.length) * 100) : 0,
    safetyGreen: missions.filter(m => m.safety_level === 'green').length,
    safetyYellow: missions.filter(m => m.safety_level === 'yellow').length,
    safetyRed: missions.filter(m => m.safety_level === 'red').length
  };

  const completionRate = missions.length > 0 ? Math.round((stats.completed / missions.length) * 100) : 0;
  const isCompletionUp = completionRate >= 75; // Mock trend logic

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Active Missions */}
      <div className="enhanced-card p-6 bg-gradient-to-br from-blue-600/20 to-blue-800/30 border border-blue-500/30 hover:shadow-lg transition-all duration-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-300 text-sm font-medium mb-1">Active Missions</p>
            <p className="text-3xl font-bold text-white">{stats.active}</p>
            <p className="text-xs text-blue-400 mt-1">
              {stats.total - stats.active} pending deployment
            </p>
          </div>
          <div className="p-3 bg-blue-500/20 rounded-lg">
            <MapIcon className="h-8 w-8 text-blue-400" />
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-blue-500/20">
          <div className="flex items-center gap-2">
            <div className="w-full bg-blue-900/30 rounded-full h-2">
              <div 
                className="bg-blue-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(stats.active / stats.total) * 100}%` }}
              />
            </div>
            <span className="text-xs text-blue-300 font-medium">
              {Math.round((stats.active / stats.total) * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Completed Today */}
      <div className="enhanced-card p-6 bg-gradient-to-br from-green-600/20 to-green-800/30 border border-green-500/30 hover:shadow-lg transition-all duration-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-300 text-sm font-medium mb-1">Completed Today</p>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-bold text-white">{stats.completed}</p>
              {isCompletionUp ? (
                <ArrowTrendingUpIcon className="h-5 w-5 text-green-400" />
              ) : (
                <ArrowTrendingDownIcon className="h-5 w-5 text-red-400" />
              )}
            </div>
            <p className="text-xs text-green-400 mt-1">
              {completionRate}% completion rate
            </p>
          </div>
          <div className="p-3 bg-green-500/20 rounded-lg">
            <CheckCircleIcon className="h-8 w-8 text-green-400" />
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-green-500/20">
          <div className="flex items-center gap-2">
            <div className="w-full bg-green-900/30 rounded-full h-2">
              <div 
                className="bg-green-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${completionRate}%` }}
              />
            </div>
            <span className="text-xs text-green-300 font-medium">{completionRate}%</span>
          </div>
        </div>
      </div>

      {/* High Priority Alerts */}
      <div className="enhanced-card p-6 bg-gradient-to-br from-orange-600/20 to-orange-800/30 border border-orange-500/30 hover:shadow-lg transition-all duration-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-orange-300 text-sm font-medium mb-1">High Priority</p>
            <p className="text-3xl font-bold text-white">{stats.highPriority}</p>
            <p className="text-xs text-orange-400 mt-1">
              Requires immediate attention
            </p>
          </div>
          <div className="p-3 bg-orange-500/20 rounded-lg">
            <ExclamationTriangleIcon className="h-8 w-8 text-orange-400" />
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-orange-500/20">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-gray-400">Urgent</div>
              <div className="text-sm font-semibold text-red-400">
                {missions.filter(m => m.priority === 'urgent').length}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400">High</div>
              <div className="text-sm font-semibold text-orange-400">
                {missions.filter(m => m.priority === 'high').length}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Medium</div>
              <div className="text-sm font-semibold text-yellow-400">
                {missions.filter(m => m.priority === 'medium').length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Photo Progress */}
      <div className="enhanced-card p-6 bg-gradient-to-br from-purple-600/20 to-purple-800/30 border border-purple-500/30 hover:shadow-lg transition-all duration-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-purple-300 text-sm font-medium mb-1">Photo Progress</p>
            <p className="text-3xl font-bold text-white">{stats.photoProgress}%</p>
            <p className="text-xs text-purple-400 mt-1">
              Documentation complete
            </p>
          </div>
          <div className="p-3 bg-purple-500/20 rounded-lg">
            <CameraIcon className="h-8 w-8 text-purple-400" />
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-purple-500/20">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Total Photos</span>
              <span className="text-white font-medium">
                {missions.reduce((acc, m) => acc + m.photos_uploaded, 0)}/
                {missions.reduce((acc, m) => acc + m.photos_required, 0)}
              </span>
            </div>
            <div className="w-full bg-purple-900/30 rounded-full h-2">
              <div 
                className="bg-purple-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${stats.photoProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Safety Status Overview */}
      <div className="enhanced-card p-6 bg-gradient-to-br from-gray-600/20 to-gray-800/30 border border-gray-500/30 hover:shadow-lg transition-all duration-300 md:col-span-2 lg:col-span-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Safety Status Overview</h3>
            <p className="text-sm text-gray-400">Real-time safety assessment of active missions</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{missions.length}</div>
              <div className="text-xs text-gray-400">Total Missions</div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
            <div className="flex-1">
              <div className="text-green-400 font-medium">Safe Areas</div>
              <div className="text-sm text-gray-400">{stats.safetyGreen} missions in green zones</div>
            </div>
            <div className="text-2xl font-bold text-green-400">{stats.safetyGreen}</div>
          </div>
          
          <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
            <div className="flex-1">
              <div className="text-yellow-400 font-medium">Caution Required</div>
              <div className="text-sm text-gray-400">{stats.safetyYellow} missions with elevated risk</div>
            </div>
            <div className="text-2xl font-bold text-yellow-400">{stats.safetyYellow}</div>
          </div>
          
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <div className="flex-1">
              <div className="text-red-400 font-medium">High Risk</div>
              <div className="text-sm text-gray-400">{stats.safetyRed} missions in red zones</div>
            </div>
            <div className="text-2xl font-bold text-red-400">{stats.safetyRed}</div>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-600/30">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Average Mission Duration</span>
            <div className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4 text-gray-400" />
              <span className="text-white font-medium">{stats.avgDuration} minutes</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};