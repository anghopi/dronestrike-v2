import React, { useState, useEffect } from 'react';
import { FallbackMap } from './FallbackMap';

interface PropertyLocation {
  id: number;
  type: 'property' | 'lead' | 'mission' | 'opportunity';
  coordinates: [number, number];
  title: string;
  address: string;
  status: string;
  value?: number;
  risk_level?: 'low' | 'medium' | 'high';
  workflow_stage?: string;
  mission_status?: 'assigned' | 'in_progress' | 'completed';
  metadata?: any;
}

interface SmartMapProps {
  data: PropertyLocation[];
  center?: [number, number];
  zoom?: number;
  showHeatmap?: boolean;
  showMissions?: boolean;
  showProperties?: boolean;
  showOpportunities?: boolean;
  onLocationClick?: (location: PropertyLocation) => void;
  onMapClick?: (coordinates: [number, number]) => void;
  className?: string;
}

export const SmartMap: React.FC<SmartMapProps> = (props) => {
  const [mapMode, setMapMode] = useState<'loading' | 'mapbox' | 'fallback'>('loading');
  const [MapboxMap, setMapboxMap] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    const loadMapbox = async () => {
      try {
        // Get Mapbox token from backend API
        const { mapboxService } = await import('../../services/mapbox');
        const token = await mapboxService.getMapboxToken();
        
        if (!token) {
          console.warn('No valid Mapbox token found, using fallback map');
          setMapMode('fallback');
          return;
        }
        
        // Set the token for mapbox-gl
        if (typeof window !== 'undefined') {
          (window as any).MAPBOX_ACCESS_TOKEN = token;
        }

        // Try to dynamically import react-map-gl and our DroneStrikeMap using eval to bypass TypeScript compilation
        const importFunc = new Function('specifier', 'return import(specifier)');
        const [mapgl, droneStrikeMapModule] = await Promise.all([
          importFunc('react-map-gl').catch(() => null),
          import('./DroneStrikeMap')
        ]);

        if (!mapgl) {
          throw new Error('react-map-gl not available');
        }

        // Also try to import the CSS
        try {
          await importFunc('mapbox-gl/dist/mapbox-gl.css').catch(() => {
            console.warn('Mapbox CSS not available, continuing without it');
          });
        } catch (cssError) {
          console.warn('Mapbox CSS import failed, continuing without it');
        }

        // Create a wrapper component that passes the mapbox components
        const MapboxWrapper = (props: any) => {
          const mapComponents = {
            Map: mapgl.Map,
            Marker: mapgl.Marker,
            Popup: mapgl.Popup,
            Layer: mapgl.Layer,
            Source: mapgl.Source,
            NavigationControl: mapgl.NavigationControl,
            ScaleControl: mapgl.ScaleControl,
            GeolocateControl: mapgl.GeolocateControl,
          };
          
          return React.createElement(droneStrikeMapModule.DroneStrikeMap, {
            ...props,
            mapComponents
          });
        };

        setMapboxMap(() => MapboxWrapper);
        setMapMode('mapbox');
      } catch (error) {
        console.warn('Failed to load Mapbox map, using fallback:', error);
        setMapMode('fallback');
      }
    };

    loadMapbox();
  }, []);

  if (mapMode === 'loading') {
    return (
      <div className={`relative w-full h-full ${props.className || ''}`}>
        <div className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-lg overflow-hidden border border-gray-600/50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-color mx-auto mb-4"></div>
            <p className="text-white font-medium">Loading tactical map...</p>
            <p className="text-gray-400 text-sm mt-1">Initializing DroneStrike mapping system</p>
          </div>
        </div>
      </div>
    );
  }

  if (mapMode === 'mapbox' && MapboxMap) {
    try {
      const mapComponent = <MapboxMap {...props} />;
      // If DroneStrikeMap returns null, switch to fallback
      if (mapComponent === null) {
        console.warn('DroneStrikeMap returned null, switching to fallback');
        setMapMode('fallback');
        return <FallbackMap {...props} />;
      }
      return mapComponent;
    } catch (error) {
      console.warn('Mapbox map failed to render, switching to fallback:', error);
      setMapMode('fallback');
      return <FallbackMap {...props} />;
    }
  }

  // Use fallback map
  return <FallbackMap {...props} />;
};