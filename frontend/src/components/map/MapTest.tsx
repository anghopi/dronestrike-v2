import React from 'react';

// Test basic React Map GL imports
const MapTest: React.FC = () => {
  try {
    // Test if react-map-gl can be imported
    require('react-map-gl');
    console.log('✅ react-map-gl imported successfully');
    
    // Test if mapbox-gl can be imported
    require('mapbox-gl');
    console.log('✅ mapbox-gl imported successfully');
    
    return (
      <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
        <h3 className="text-green-400 font-semibold">Map Dependencies Test</h3>
        <p className="text-white text-sm mt-2">✅ All map dependencies loaded successfully</p>
      </div>
    );
  } catch (error) {
    console.error('❌ Map import error:', error);
    return (
      <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
        <h3 className="text-red-400 font-semibold">Map Dependencies Error</h3>
        <p className="text-white text-sm mt-2">❌ Error loading map dependencies</p>
        <pre className="text-red-300 text-xs mt-2">{String(error)}</pre>
      </div>
    );
  }
};

export default MapTest;