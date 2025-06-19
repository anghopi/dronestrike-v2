import React from 'react';
import { 
  PlusIcon,
  DocumentArrowDownIcon,
  MapIcon,
  PhoneIcon,
  ChatBubbleLeftIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  UsersIcon,
  BellIcon
} from '@heroicons/react/24/outline';
import { Button } from '../ui/button';

interface QuickActionsProps {
  onCreateMission: () => void;
  onViewMap: () => void;
  onExportReport: () => void;
  activeMissionsCount: number;
  urgentMissionsCount: number;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onCreateMission,
  onViewMap,
  onExportReport,
  activeMissionsCount,
  urgentMissionsCount
}) => {
  return (
    <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 space-y-6">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="p-2 bg-brand-color/20 rounded-lg border border-brand-color/30">
            <BellIcon className="h-5 w-5 text-brand-color" />
          </div>
          <h3 className="text-lg font-bold text-white">Quick Actions</h3>
        </div>
        <p className="text-sm text-gray-400">Fast access to mission operations</p>
      </div>

      {/* Primary Actions */}
      <div className="space-y-3">
        <Button
          onClick={onCreateMission}
          className="w-full text-left justify-start bg-gradient-to-r from-brand-color to-brand-color-light hover:from-brand-color-hover hover:to-brand-color shadow-lg hover:shadow-xl transition-all duration-300 p-4 rounded-xl"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <PlusIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-white">Deploy New Mission</div>
              <div className="text-xs text-white/80">Assign BOTG agent to property</div>
            </div>
          </div>
        </Button>

        <Button
          onClick={onViewMap}
          variant="outline"
          className="w-full text-left justify-start hover:bg-blue-600/20 hover:border-blue-500/50 transition-all duration-300 p-4 rounded-xl border-gray-600/50"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
              <MapIcon className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <div className="font-semibold text-white">Tactical Map View</div>
              <div className="text-xs text-gray-400">Real-time mission tracking</div>
            </div>
          </div>
        </Button>

        <Button
          onClick={onExportReport}
          variant="outline"
          className="w-full text-left justify-start hover:bg-green-600/20 hover:border-green-500/50 transition-all duration-300 p-4 rounded-xl border-gray-600/50"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg border border-green-500/30">
              <DocumentArrowDownIcon className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <div className="font-semibold text-white">Export Report</div>
              <div className="text-xs text-gray-400">Mission analytics & data</div>
            </div>
          </div>
        </Button>
      </div>

      {/* Status Alerts */}
      <div className="space-y-3 pt-4 border-t border-gray-600/30">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
            <BellIcon className="h-4 w-4 text-yellow-400" />
          </div>
          <div className="text-sm font-bold text-white">Mission Alerts</div>
        </div>
        
        {activeMissionsCount > 0 && (
          <div className="flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl backdrop-blur-sm">
            <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
              <MapIcon className="h-4 w-4 text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-blue-300">Active Missions</div>
              <div className="text-xs text-gray-400">{activeMissionsCount} missions in progress</div>
            </div>
            <div className="px-3 py-1 bg-blue-500/20 rounded-lg border border-blue-500/30">
              <div className="text-lg font-bold text-blue-400">{activeMissionsCount}</div>
            </div>
          </div>
        )}

        {urgentMissionsCount > 0 && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl backdrop-blur-sm animate-pulse">
            <div className="p-2 bg-red-500/20 rounded-lg border border-red-500/30">
              <ExclamationTriangleIcon className="h-4 w-4 text-red-400" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-red-300">Urgent Priority</div>
              <div className="text-xs text-gray-400">{urgentMissionsCount} missions need attention</div>
            </div>
            <div className="px-3 py-1 bg-red-500/20 rounded-lg border border-red-500/30">
              <div className="text-lg font-bold text-red-400">{urgentMissionsCount}</div>
            </div>
          </div>
        )}

        {activeMissionsCount === 0 && urgentMissionsCount === 0 && (
          <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl backdrop-blur-sm">
            <div className="p-2 bg-green-500/20 rounded-lg border border-green-500/30">
              <ClockIcon className="h-4 w-4 text-green-400" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-green-300">All Clear</div>
              <div className="text-xs text-gray-400">No urgent missions pending</div>
            </div>
            <div className="px-3 py-1 bg-green-500/20 rounded-lg border border-green-500/30">
              <div className="text-sm font-bold text-green-400">✓</div>
            </div>
          </div>
        )}
      </div>

      {/* Communication Tools */}
      <div className="space-y-3 pt-4 border-t border-gray-600/30">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-purple-500/20 rounded-lg border border-purple-500/30">
            <PhoneIcon className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-sm font-bold text-white">Communication</div>
        </div>
        
        <Button
          variant="outline"
          className="w-full text-left justify-start hover:bg-purple-600/20 hover:border-purple-500/50 transition-all duration-300 p-3 rounded-xl border-gray-600/50"
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-purple-500/20 rounded-lg border border-purple-500/30">
              <PhoneIcon className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-sm font-medium text-white">Contact Field Agents</div>
          </div>
        </Button>

        <Button
          variant="outline"
          className="w-full text-left justify-start hover:bg-blue-600/20 hover:border-blue-500/50 transition-all duration-300 p-3 rounded-xl border-gray-600/50"
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-blue-500/20 rounded-lg border border-blue-500/30">
              <ChatBubbleLeftIcon className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-sm font-medium text-white">Team Communications</div>
          </div>
        </Button>

        <Button
          variant="outline"
          className="w-full text-left justify-start hover:bg-red-600/20 hover:border-red-500/50 transition-all duration-300 p-3 rounded-xl border-gray-600/50"
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-red-500/20 rounded-lg border border-red-500/30">
              <ExclamationTriangleIcon className="h-4 w-4 text-red-400" />
            </div>
            <div className="text-sm font-medium text-white">Emergency Protocols</div>
          </div>
        </Button>
      </div>

      {/* Agent Directory */}
      <div className="pt-4 border-t border-gray-600/30">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 bg-green-500/20 rounded-lg border border-green-500/30">
            <UsersIcon className="h-4 w-4 text-green-400" />
          </div>
          <div className="text-sm font-bold text-white">Agent Directory</div>
        </div>
        
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-xl backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-300">Available Agents</span>
            </div>
            <div className="px-2 py-1 bg-green-500/20 rounded-lg border border-green-500/30">
              <span className="text-green-400 font-bold text-sm">3</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-300">On Mission</span>
            </div>
            <div className="px-2 py-1 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
              <span className="text-yellow-400 font-bold text-sm">2</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-gray-500/10 border border-gray-500/20 rounded-xl backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <span className="text-sm text-gray-300">Off Duty</span>
            </div>
            <div className="px-2 py-1 bg-gray-500/20 rounded-lg border border-gray-500/30">
              <span className="text-gray-400 font-bold text-sm">1</span>
            </div>
          </div>
        </div>
        
        <Button
          variant="outline"
          className="w-full text-sm hover:bg-gray-600/20 hover:border-gray-500/50 transition-all duration-300 p-3 rounded-xl border-gray-600/50"
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-gray-500/20 rounded-lg border border-gray-500/30">
              <UsersIcon className="h-4 w-4 text-gray-400" />
            </div>
            <div className="text-sm font-medium text-white">View All Agents</div>
          </div>
        </Button>
      </div>
    </div>
  );
};