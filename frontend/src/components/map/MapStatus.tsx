import React, { useState, useEffect } from 'react';
import { CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface MapStatusProps {
  className?: string;
}

export const MapStatus: React.FC<MapStatusProps> = ({ className = '' }) => {
  const [status, setStatus] = useState<'checking' | 'ready' | 'fallback' | 'error'>('checking');
  const [details, setDetails] = useState<string>('');

  useEffect(() => {
    const checkMapStatus = async () => {
      try {
        // Check Mapbox token
        const token = process.env.REACT_APP_MAPBOX_TOKEN;
        if (!token || token === 'pk.demo-token-replace-with-real-mapbox-token') {
          setStatus('fallback');
          setDetails('No valid Mapbox token - using fallback map');
          return;
        }

        // Check if react-map-gl can be loaded
        try {
          // Use eval to bypass TypeScript module resolution
          const importFunc = new Function('specifier', 'return import(specifier)');
          
          const [reactMapGlModule, mapboxGlModule] = await Promise.all([
            importFunc('react-map-gl').catch(() => null),
            importFunc('mapbox-gl').catch(() => null)
          ]);
          
          if (reactMapGlModule && mapboxGlModule) {
            setStatus('ready');
            setDetails('Mapbox GL ready');
          } else {
            setStatus('fallback');
            setDetails('Mapbox packages not fully available - using fallback');
          }
        } catch (error) {
          setStatus('fallback');
          setDetails('Mapbox packages not available - using fallback');
        }
      } catch (error) {
        setStatus('error');
        setDetails(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    checkMapStatus();
  }, []);

  const getStatusIcon = () => {
    switch (status) {
      case 'ready':
        return <CheckCircleIcon className="h-5 w-5 text-green-400" />;
      case 'fallback':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />;
      case 'error':
        return <XCircleIcon className="h-5 w-5 text-red-400" />;
      default:
        return <div className="h-5 w-5 border-2 border-brand-color border-t-transparent rounded-full animate-spin" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'ready':
        return 'bg-green-900/20 border-green-500/30 text-green-300';
      case 'fallback':
        return 'bg-yellow-900/20 border-yellow-500/30 text-yellow-300';
      case 'error':
        return 'bg-red-900/20 border-red-500/30 text-red-300';
      default:
        return 'bg-blue-900/20 border-blue-500/30 text-blue-300';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'ready':
        return 'Map Ready';
      case 'fallback':
        return 'Fallback Mode';
      case 'error':
        return 'Map Error';
      default:
        return 'Checking...';
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border backdrop-blur-sm ${getStatusColor()} ${className}`}>
      {getStatusIcon()}
      <div>
        <div className="text-sm font-medium">{getStatusText()}</div>
        {details && (
          <div className="text-xs opacity-75">{details}</div>
        )}
      </div>
    </div>
  );
};