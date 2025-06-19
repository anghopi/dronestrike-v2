# Mapbox Integration Setup

## Overview
The DroneStrike application now includes full Mapbox GL JS integration with tactical mapping capabilities, heatmaps, and real-time location tracking for TLC BOTG DroneStrike workflow operations.

## Setup Instructions

### 1. Get Mapbox Access Token
1. Go to [https://account.mapbox.com/](https://account.mapbox.com/)
2. Create a free account or log in to your existing account
3. Go to your [Account page](https://account.mapbox.com/)
4. Copy your default public token (starts with `pk.`)

### 2. Configure Environment Variables
1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Update the `.env` file with your actual Mapbox token:
   ```bash
   REACT_APP_MAPBOX_TOKEN=pk.eyJ1IjoieW91cnVzZXJuYW1lIiwiYSI6ImNrNXh4eHh4eHgwMXMza3BqeXl5eXl5eXkifQ.xxxxxxxxxxxxxxxxxxxxxx
   ```

### 3. Install Dependencies (Already Installed)
The following packages are already included in package.json:
- `mapbox-gl`: Core Mapbox GL JS library
- `react-map-gl`: React wrapper for Mapbox GL JS
- `@types/mapbox-gl`: TypeScript definitions

### 4. Features Included

#### DroneStrikeMap Component (`/src/components/map/DroneStrikeMap.tsx`)
- **Real-time Location Tracking**: Properties, missions, opportunities, and leads
- **Heatmap Overlays**: Value-based and mission density heatmaps
- **Interactive Markers**: Click to view location details
- **Layer Controls**: Toggle different data types
- **Map Style Selection**: Dark, satellite, streets, and outdoors themes
- **Navigation Controls**: Zoom, compass, and geolocation
- **Legend**: Color-coded marker meanings

#### MapView Page (`/src/pages/MapView.tsx`)
- **Tactical Map Interface**: Full-screen map with controls
- **Statistics Dashboard**: Real-time metrics and counts
- **Search & Filtering**: Find specific locations
- **Side Panel**: Location details and quick actions
- **Data Integration**: TLC BOTG DroneStrike workflow data

### 5. Usage Examples

#### Basic Map Integration
```tsx
import { DroneStrikeMap } from '../components/map/DroneStrikeMap';

const mapData = [
  {
    id: 1,
    type: 'mission',
    coordinates: [-96.7970, 32.7767],
    title: 'Mission M-2025-001',
    address: '123 Main St, Dallas, TX',
    status: 'in_progress',
    mission_status: 'in_progress'
  }
];

<DroneStrikeMap
  data={mapData}
  center={[-96.7970, 32.7767]}
  zoom={10}
  showHeatmap={true}
  onLocationClick={(location) => console.log('Selected:', location)}
/>
```

#### Access Full Map View
Navigate to `/map` in the application to view the full tactical map interface.

### 6. Map Styles Available
- **Dark** (default): Military-themed dark map
- **Satellite**: Satellite imagery
- **Streets**: Standard street map
- **Outdoors**: Topographic outdoor map

### 7. Data Types Supported
- **BOTG Missions**: 🚁 Helicopter icon, status-based colors
- **Properties**: 🏠 House icon, risk-level colors
- **Opportunities**: 💰 Money icon, purple theme
- **Leads**: 🎯 Target icon, cyan theme

### 8. Security Notes
- Never commit your actual Mapbox token to version control
- The `.env` file is already included in `.gitignore`
- Use environment-specific tokens for different deployments

### 9. Customization
The map component is fully customizable with props for:
- Custom map styles
- Data filtering
- Event handlers
- Layer visibility
- Styling and theming

### 10. Troubleshooting
- Ensure your Mapbox token is valid and has the correct permissions
- Check the browser console for any API errors
- Verify that the mapbox-gl CSS is properly loaded
- For production, consider setting up token restrictions on the Mapbox dashboard