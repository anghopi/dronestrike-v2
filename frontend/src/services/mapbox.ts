/**
 * Mapbox API Service for DroneStrike v2
 * Provides geospatial functionality through backend integration
 */

import apiClient from './api';

export interface Coordinate {
  longitude: number;
  latitude: number;
}

export interface GeocodeResult {
  success: boolean;
  data?: {
    type: string;
    query: string[];
    features: Array<{
      id: string;
      place_name: string;
      place_type: string[];
      relevance: number;
      geometry: {
        type: string;
        coordinates: [number, number];
      };
      center: [number, number];
      properties: Record<string, any>;
      address_components?: {
        postcode?: string;
        city?: string;
        state?: string;
        country?: string;
      };
    }>;
  };
  error?: string;
}

export interface RouteResult {
  success: boolean;
  data?: {
    code: string;
    routes: Array<{
      geometry: any;
      legs: any[];
      distance: number;
      duration: number;
      duration_formatted?: string;
      distance_km?: number;
      distance_miles?: number;
    }>;
    waypoints: any[];
  };
  error?: string;
}

export interface SearchResult {
  success: boolean;
  data?: {
    type: string;
    query: string;
    features: any[];
    categorized: {
      addresses: any[];
      places: any[];
      landmarks: any[];
      regions: any[];
      postcodes: any[];
    };
    total_results: number;
  };
  error?: string;
}

export interface MapboxConfig {
  mapbox_token: string;
  default_center: [number, number];
  default_zoom: number;
  style: string;
  features: string[];
}

class MapboxService {
  private config: MapboxConfig | null = null;

  /**
   * Get Mapbox configuration from backend
   */
  async getConfig(): Promise<MapboxConfig> {
    if (this.config) {
      return this.config;
    }

    const response = await apiClient.get<MapboxConfig>('/mapbox/config');
    this.config = response;
    return response;
  }

  /**
   * Check Mapbox service health
   */
  async healthCheck(): Promise<{ status: string; integration: string }> {
    return apiClient.get('/mapbox/health');
  }

  /**
   * Forward geocoding - convert address to coordinates
   */
  async geocode(
    query: string,
    options: {
      country?: string;
      limit?: number;
      proximity?: string; // 'lon,lat'
    } = {}
  ): Promise<GeocodeResult> {
    const params = new URLSearchParams({
      query,
      country: options.country || 'us',
      limit: (options.limit || 5).toString(),
    });

    if (options.proximity) {
      params.append('proximity', options.proximity);
    }

    return apiClient.get(`/mapbox/geocode?${params}`);
  }

  /**
   * Reverse geocoding - convert coordinates to address
   */
  async reverseGeocode(
    longitude: number,
    latitude: number,
    limit: number = 5
  ): Promise<GeocodeResult> {
    const params = new URLSearchParams({
      lon: longitude.toString(),
      lat: latitude.toString(),
      limit: limit.toString(),
    });

    return apiClient.get(`/mapbox/reverse-geocode?${params}`);
  }

  /**
   * Get directions between multiple waypoints
   */
  async getDirections(
    coordinates: Array<[number, number]>,
    options: {
      profile?: 'driving' | 'walking' | 'cycling' | 'driving-traffic';
      alternatives?: boolean;
      steps?: boolean;
    } = {}
  ): Promise<RouteResult> {
    return apiClient.post('/mapbox/directions', {
      coordinates,
      profile: options.profile || 'driving',
      alternatives: options.alternatives || false,
      steps: options.steps || false,
    });
  }

  /**
   * Generate service area isochrones
   */
  async getIsochrone(
    longitude: number,
    latitude: number,
    options: {
      contours_minutes?: number[];
      contours_meters?: number[];
      profile?: 'driving' | 'walking' | 'cycling';
    } = {}
  ): Promise<RouteResult> {
    return apiClient.post('/mapbox/isochrone', {
      longitude,
      latitude,
      profile: options.profile || 'driving',
      contours_minutes: options.contours_minutes,
      contours_meters: options.contours_meters,
    });
  }

  /**
   * Advanced place search
   */
  async search(
    query: string,
    options: {
      proximity?: string; // 'lon,lat'
      category?: string;
      limit?: number;
      country?: string;
    } = {}
  ): Promise<SearchResult> {
    const params = new URLSearchParams({
      query,
      limit: (options.limit || 10).toString(),
      country: options.country || 'us',
    });

    if (options.proximity) {
      params.append('proximity', options.proximity);
    }

    if (options.category) {
      params.append('category', options.category);
    }

    return apiClient.get(`/mapbox/search?${params}`);
  }

  /**
   * Batch geocode multiple addresses
   */
  async batchGeocode(
    queries: string[],
    options: {
      country?: string;
      limit?: number;
    } = {}
  ): Promise<GeocodeResult> {
    if (queries.length > 25) {
      throw new Error('Maximum 25 queries allowed per batch');
    }

    return apiClient.post('/mapbox/batch-geocode', {
      queries,
      country: options.country || 'us',
      limit: options.limit || 5,
    });
  }

  /**
   * Get travel time/distance matrix
   */
  async getRouteMatrix(
    coordinates: Array<[number, number]>,
    options: {
      profile?: 'driving' | 'walking' | 'cycling';
      sources?: number[];
      destinations?: number[];
    } = {}
  ): Promise<RouteResult> {
    return apiClient.post('/mapbox/route-matrix', {
      coordinates,
      profile: options.profile || 'driving',
      sources: options.sources,
      destinations: options.destinations,
    });
  }

  /**
   * Optimize route for multiple waypoints (TSP)
   */
  async optimizeRoute(
    coordinates: Array<[number, number]>,
    options: {
      profile?: 'driving' | 'walking' | 'cycling';
      source?: string;
      destination?: string;
      roundtrip?: boolean;
    } = {}
  ): Promise<RouteResult> {
    if (coordinates.length < 3) {
      throw new Error('At least 3 coordinates required for optimization');
    }

    return apiClient.post('/mapbox/optimize-route', {
      coordinates,
      profile: options.profile || 'driving',
      source: options.source || 'first',
      destination: options.destination || 'last',
      roundtrip: options.roundtrip !== false,
    });
  }

  /**
   * Calculate distance between two points
   */
  async calculateDistance(
    point1: [number, number],
    point2: [number, number],
    unit: 'km' | 'miles' | 'meters' = 'km'
  ): Promise<{
    success: boolean;
    distance: number;
    unit: string;
    point1: { longitude: number; latitude: number };
    point2: { longitude: number; latitude: number };
  }> {
    const params = new URLSearchParams({
      lon1: point1[0].toString(),
      lat1: point1[1].toString(),
      lon2: point2[0].toString(),
      lat2: point2[1].toString(),
      unit,
    });

    return apiClient.get(`/mapbox/distance?${params}`);
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(): Promise<any> {
    return apiClient.get('/mapbox/stats');
  }

  /**
   * Helper: Get Mapbox token for frontend use
   */
  async getMapboxToken(): Promise<string> {
    const config = await this.getConfig();
    return config.mapbox_token;
  }

  /**
   * Helper: Format coordinates for display
   */
  formatCoordinates(coordinates: [number, number], precision: number = 4): string {
    const [lon, lat] = coordinates;
    return `${lat.toFixed(precision)}, ${lon.toFixed(precision)}`;
  }

  /**
   * Helper: Convert address to coordinates (simplified geocoding)
   */
  async addressToCoordinates(address: string): Promise<[number, number] | null> {
    try {
      const result = await this.geocode(address, { limit: 1 });
      if (result.success && result.data && result.data.features.length > 0) {
        return result.data.features[0].center;
      }
      return null;
    } catch (error) {
      console.error('Failed to geocode address:', error);
      return null;
    }
  }

  /**
   * Helper: Convert coordinates to address (simplified reverse geocoding)
   */
  async coordinatesToAddress(coordinates: [number, number]): Promise<string | null> {
    try {
      const [lon, lat] = coordinates;
      const result = await this.reverseGeocode(lon, lat, 1);
      if (result.success && result.data && result.data.features.length > 0) {
        return result.data.features[0].place_name;
      }
      return null;
    } catch (error) {
      console.error('Failed to reverse geocode coordinates:', error);
      return null;
    }
  }
}

export const mapboxService = new MapboxService();
export default mapboxService;