import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  MapPinIcon,
  HomeIcon,
  CommandLineIcon,
  UserIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import { HeaderTabs } from '../components/Layout/HeaderTabs';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../hooks/useAuth';
import { SmartMap } from '../components/map/SmartMap';
import { MapStatus } from '../components/map/MapStatus';


// Mock data service
const mapDataService = {
  getMapData: async (filters: any) => {
    // Mock data based on TLC BOTG DroneStrike workflow
    return {
      leads: [
        { id: 1, type: 'lead', coordinates: [-96.7970, 32.7767], title: 'John Smith', address: '123 Main St, Dallas, TX', status: 'qualified', value: 85000, workflow_stage: 'lead_identified' },
        { id: 2, type: 'lead', coordinates: [-96.8100, 32.7900], title: 'Sarah Johnson', address: '456 Oak Ave, Dallas, TX', status: 'contacted', value: 92000, workflow_stage: 'botg_assigned' },
      ],
      missions: [
        { id: 1, type: 'mission', coordinates: [-96.7900, 32.7700], title: 'Mission M-2025-001', address: '789 Pine St, Dallas, TX', status: 'in_progress', agent: 'Agent Rodriguez', mission_number: 'M-2025-001' },
        { id: 2, type: 'mission', coordinates: [-96.8200, 32.7600], title: 'Mission M-2025-002', address: '321 Elm St, Dallas, TX', status: 'completed', agent: 'Agent Martinez', mission_number: 'M-2025-002' },
        { id: 3, type: 'mission', coordinates: [-96.7800, 32.7800], title: 'Mission M-2025-003', address: '654 Cedar Ave, Dallas, TX', status: 'assigned', agent: 'Agent Thompson', mission_number: 'M-2025-003' },
      ],
      properties: [
        { id: 1, type: 'property', coordinates: [-96.7950, 32.7750], title: 'High-Value Property', address: '987 Maple Dr, Dallas, TX', status: 'available', value: 150000, risk_level: 'low' },
        { id: 2, type: 'property', coordinates: [-96.8050, 32.7650], title: 'Investment Property', address: '147 Birch Ln, Dallas, TX', status: 'under_review', value: 120000, risk_level: 'medium' },
      ],
      opportunities: [
        { id: 1, type: 'opportunity', coordinates: [-96.8000, 32.7850], title: 'Opportunity OPP-2025-001', address: '258 Willow St, Dallas, TX', status: 'qualified', value: 95000, loan_amount: 75000 },
        { id: 2, type: 'opportunity', coordinates: [-96.7850, 32.7750], title: 'Opportunity OPP-2025-002', address: '369 Spruce Ave, Dallas, TX', status: 'approved', value: 110000, loan_amount: 88000 },
      ]
    };
  }
};

type MapDataType = 'all' | 'leads' | 'missions' | 'properties' | 'opportunities';

const MapView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [dataTypeFilter, setDataTypeFilter] = useState<MapDataType>('all');
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showMissions, setShowMissions] = useState(true);
  const [showProperties, setShowProperties] = useState(true);
  const [showOpportunities, setShowOpportunities] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [mapCenter] = useState<[number, number]>([-96.7970, 32.7767]); // Dallas, TX
  const [mapZoom] = useState(11);
  
  const { user } = useAuth();

  // Fetch map data
  const { data: mapData, isLoading, error } = useQuery({
    queryKey: ['map-data', dataTypeFilter, searchTerm],
    queryFn: () => mapDataService.getMapData({ type: dataTypeFilter, search: searchTerm }),
    refetchInterval: 30000, // Refresh every 30 seconds for real-time updates
  });

  // Combine all data into a single array for the map
  const allMapData = useMemo(() => {
    if (!mapData) return [];
    
    const combined = [
      ...mapData.leads,
      ...mapData.missions,
      ...mapData.properties,
      ...mapData.opportunities
    ];

    // Apply search filter
    if (searchTerm) {
      return combined.filter(item => 
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.address.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return combined;
  }, [mapData, searchTerm]);

  // Statistics for the map data
  const mapStats = useMemo(() => {
    if (!mapData) return { total: 0, missions: 0, properties: 0, opportunities: 0, leads: 0 };
    
    return {
      total: allMapData.length,
      leads: mapData.leads.length,
      missions: mapData.missions.length,
      properties: mapData.properties.length,
      opportunities: mapData.opportunities.length,
      activeMissions: mapData.missions.filter(m => m.status === 'in_progress').length,
      totalValue: allMapData.reduce((sum, item) => sum + ((item as any).value || 0), 0)
    };
  }, [mapData, allMapData]);

  const handleLocationClick = (location: any) => {
    setSelectedLocation(location);
  };

  const tabs = [
    { id: 'all', name: 'All Data', count: mapStats.total },
    { id: 'missions', name: 'BOTG Missions', count: mapStats.missions },
    { id: 'opportunities', name: 'Opportunities', count: mapStats.opportunities },
    { id: 'properties', name: 'Properties', count: mapStats.properties },
    { id: 'leads', name: 'Leads', count: mapStats.leads },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-color mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading operational map...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
        <p className="text-red-300">Error loading map data. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <HeaderTabs 
        title="Tactical Map View" 
        searchPlaceholder="Search locations..."
        onSearch={(query) => setSearchTerm(query)}
        tabs={tabs}
        activeTab={dataTypeFilter}
        onTabChange={(tabId) => setDataTypeFilter(tabId as MapDataType)}
        extraContent={<MapStatus />}
      />
      
      <div className="flex-1 p-6 space-y-6 overflow-hidden bg-gradient-to-br from-navy-blue-dark/50 to-navy-blue/30">
        {/* Map Statistics - Compact Horizontal Layout */}
        <div className="grid grid-cols-5 gap-3">
          <div className="enhanced-card p-3 bg-gradient-to-br from-blue-600/20 to-blue-800/30 border border-blue-500/30">
            <div className="flex items-center gap-2">
              <MapPinIcon className="h-4 w-4 text-blue-400" />
              <div>
                <p className="text-blue-300 text-xs font-medium">Total</p>
                <p className="text-lg font-bold text-white">{mapStats.total}</p>
              </div>
            </div>
          </div>

          <div className="enhanced-card p-3 bg-gradient-to-br from-green-600/20 to-green-800/30 border border-green-500/30">
            <div className="flex items-center gap-2">
              <CommandLineIcon className="h-4 w-4 text-green-400" />
              <div>
                <p className="text-green-300 text-xs font-medium">Active</p>
                <p className="text-lg font-bold text-white">{mapStats.activeMissions}</p>
              </div>
            </div>
          </div>

          <div className="enhanced-card p-3 bg-gradient-to-br from-purple-600/20 to-purple-800/30 border border-purple-500/30">
            <div className="flex items-center gap-2">
              <CurrencyDollarIcon className="h-4 w-4 text-purple-400" />
              <div>
                <p className="text-purple-300 text-xs font-medium">Opportunities</p>
                <p className="text-lg font-bold text-white">{mapStats.opportunities}</p>
              </div>
            </div>
          </div>

          <div className="enhanced-card p-3 bg-gradient-to-br from-orange-600/20 to-orange-800/30 border border-orange-500/30">
            <div className="flex items-center gap-2">
              <HomeIcon className="h-4 w-4 text-orange-400" />
              <div>
                <p className="text-orange-300 text-xs font-medium">Properties</p>
                <p className="text-lg font-bold text-white">{mapStats.properties}</p>
              </div>
            </div>
          </div>

          <div className="enhanced-card p-3 bg-gradient-to-br from-yellow-600/20 to-yellow-800/30 border border-yellow-500/30">
            <div className="flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-yellow-400" />
              <div>
                <p className="text-yellow-300 text-xs font-medium">Value</p>
                <p className="text-lg font-bold text-white">${((mapStats.totalValue || 0) / 1000000).toFixed(1)}M</p>
              </div>
            </div>
          </div>
        </div>

        {/* Map Controls and Filters */}
        <div className="enhanced-card p-4">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1">
              <div className="relative flex-1 max-w-md">
                <Input
                  placeholder="Search map locations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-military pl-4 pr-4 py-3 text-white placeholder-gray-400 bg-gray-800/60 border-gray-600/50 rounded-xl focus:ring-2 focus:ring-brand-color/50 focus:border-brand-color/50 backdrop-blur-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="heatmap"
                  checked={showHeatmap}
                  onChange={(e) => setShowHeatmap(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="heatmap" className="text-white text-sm">Heatmap</label>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="missions"
                  checked={showMissions}
                  onChange={(e) => setShowMissions(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="missions" className="text-white text-sm">Missions</label>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="properties"
                  checked={showProperties}
                  onChange={(e) => setShowProperties(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="properties" className="text-white text-sm">Properties</label>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="opportunities"
                  checked={showOpportunities}
                  onChange={(e) => setShowOpportunities(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="opportunities" className="text-white text-sm">Opportunities</label>
              </div>
            </div>
          </div>
        </div>

        {/* Main Map */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Map Container */}
          <div className="lg:col-span-3 enhanced-card p-0 overflow-hidden">
            <div className="h-[600px] relative">
              <SmartMap
                data={allMapData as any}
                center={mapCenter}
                zoom={mapZoom}
                showHeatmap={showHeatmap}
                showMissions={showMissions}
                showProperties={showProperties}
                showOpportunities={showOpportunities}
                onLocationClick={handleLocationClick}
                className="rounded-lg"
              />
            </div>
          </div>

          {/* Side Panel */}
          <div className="lg:col-span-1 space-y-4">
            {/* Selected Location Details */}
            {selectedLocation && (
              <div className="enhanced-card p-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  Location Details
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-white font-medium">{selectedLocation.title}</div>
                    <div className="text-sm text-gray-400">{selectedLocation.address}</div>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-400">Type:</span>
                    <Badge variant="secondary">
                      {selectedLocation.type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status:</span>
                    <span className="text-white font-medium">
                      {selectedLocation.status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </span>
                  </div>
                  
                  {selectedLocation.value && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Value:</span>
                      <span className="text-green-400 font-medium">
                        ${selectedLocation.value.toLocaleString()}
                      </span>
                    </div>
                  )}
                  
                  {selectedLocation.agent && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Agent:</span>
                      <span className="text-white font-medium">{selectedLocation.agent}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="enhanced-card p-4">
              <h3 className="text-lg font-semibold text-white mb-3">Map Legend</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                  <span className="text-white">BOTG Missions</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                  <span className="text-white">In Progress</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-green-500"></div>
                  <span className="text-white">Completed</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-purple-500"></div>
                  <span className="text-white">Properties</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-cyan-500"></div>
                  <span className="text-white">Opportunities</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="enhanced-card p-4">
              <h3 className="text-lg font-semibold text-white mb-3"> Quick Actions</h3>
              <div className="space-y-2">
                <Button className="w-full btn-primary text-sm">
                  Create New Mission
                </Button>
                <Button variant="outline" className="w-full text-sm">
                  Export Map Data
                </Button>
                <Button variant="outline" className="w-full text-sm">
                  Generate Report
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapView;