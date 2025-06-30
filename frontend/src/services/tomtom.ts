/**
 * TomTom API Service for DroneStrike v2
 * Provides advanced route optimization and GPS navigation
 * Integrates with existing Mapbox service for comprehensive mapping
 */

import apiClient from './api';
import { Coordinate } from './mapbox';

export interface TomTomRoutePoint {
  latitude: number;
  longitude: number;
  address?: string;
  order?: number;
}

export interface TomTomOptimizationResult {
  success: boolean;
  data?: {
    optimizedOrder: number[];
    routes: Array<{
      points: TomTomRoutePoint[];
      summary: {
        lengthInMeters: number;
        travelTimeInSeconds: number;
        trafficDelayInSeconds: number;
        departureTime: string;
        arrivalTime: string;
      };
      legs: Array<{
        summary: {
          lengthInMeters: number;
          travelTimeInSeconds: number;
          trafficDelayInSeconds: number;
        };
        points: Array<{
          latitude: number;
          longitude: number;
        }>;
      }>;
    }>;
    totalDistance: number;
    totalTime: number;
    savings: {
      distanceSaved: number;
      timeSaved: number;
      percentageImprovement: number;
    };
  };
  error?: string;
}

export interface TomTomNavigationResult {
  success: boolean;
  data?: {
    route: {
      summary: {
        lengthInMeters: number;
        travelTimeInSeconds: number;
        trafficDelayInSeconds: number;
        liveTrafficIncidentsTravelTimeInSeconds: number;
        historicTrafficTravelTimeInSeconds: number;
      };
      legs: Array<{
        summary: {
          lengthInMeters: number;
          travelTimeInSeconds: number;
          trafficDelayInSeconds: number;
        };
        points: Array<{
          latitude: number;
          longitude: number;
        }>;
      }>;
      sections: Array<{
        startPointIndex: number;
        endPointIndex: number;
        sectionType: string;
        travelMode: string;
      }>;
      guidance: {
        instructions: Array<{
          routeOffsetInMeters: number;
          travelTimeInSeconds: number;
          point: {
            latitude: number;
            longitude: number;
          };
          pointIndex: number;
          instructionType: string;
          roadNumbers: string[];
          message: string;
          combinedMessage: string;
        }>;
        instructionGroups: Array<{
          firstInstructionIndex: number;
          lastInstructionIndex: number;
          groupLengthInMeters: number;
          groupMessage: string;
        }>;
      };
    };
  };
  error?: string;
}

export interface TomTomTrafficResult {
  success: boolean;
  data?: {
    incidents: Array<{
      id: string;
      iconCategory: number;
      magnitudeOfDelay: number;
      events: Array<{
        description: string;
        code: number;
        iconCategory: number;
      }>;
      startTime: string;
      endTime: string;
      from: string;
      to: string;
      length: number;
      delay: number;
      roadNumbers: string[];
      timeValidity: string;
      probabilityOfOccurrence: string;
      numberOfReports: number;
      lastReportTime: string;
      unitOfMeasurement: string;
    }>;
    flowSegments: Array<{
      coordinates: {
        coordinate: Array<{
          latitude: number;
          longitude: number;
        }>;
      };
      freeFlowSpeed: {
        value: number;
        unit: string;
      };
      currentSpeed: {
        value: number;
        unit: string;
      };
      currentTravelTime: number;
      freeFlowTravelTime: number;
      confidence: number;
      roadClosure: boolean;
    }>;
  };
  error?: string;
}

export interface MissionRouteOptimization {
  missionId?: number;
  routeId?: number;
  waypoints: TomTomRoutePoint[];
  constraints?: {
    vehicleType?: 'car' | 'truck' | 'van' | 'bicycle' | 'motorcycle';
    maxTravelTime?: number; // seconds
    maxDistance?: number; // meters
    departureTime?: string; // ISO string
    avoidTolls?: boolean;
    avoidMotorways?: boolean;
    avoidFerries?: boolean;
    avoidUnpavedRoads?: boolean;
  };
  preferences?: {
    routeType?: 'fastest' | 'shortest' | 'eco' | 'thrilling';
    traffic?: 'live' | 'historic' | 'none';
    optimizeFor?: 'time' | 'distance' | 'fuel';
  };
}

class TomTomService {
  /**
   * Check TomTom service health and configuration
   */
  async healthCheck(): Promise<{ status: string; integration: string; features: string[] }> {
    return apiClient.get('/tomtom/health');
  }

  /**
   * Optimize route for multiple mission waypoints using TomTom's advanced algorithms
   */
  async optimizeMissionRoute(optimization: MissionRouteOptimization): Promise<TomTomOptimizationResult> {
    if (optimization.waypoints.length < 2) {
      throw new Error('At least 2 waypoints required for route optimization');
    }

    if (optimization.waypoints.length > 150) {
      throw new Error('Maximum 150 waypoints allowed for optimization');
    }

    return apiClient.post('/tomtom/optimize-route', optimization);
  }

  /**
   * Get detailed navigation instructions for a route
   */
  async getNavigationInstructions(
    waypoints: TomTomRoutePoint[],
    options: {
      instructionType?: 'text' | 'coded';
      language?: string;
      vehicleType?: string;
      avoidTolls?: boolean;
      avoidMotorways?: boolean;
    } = {}
  ): Promise<TomTomNavigationResult> {
    return apiClient.post('/tomtom/navigation', {
      waypoints,
      instructionType: options.instructionType || 'text',
      language: options.language || 'en-US',
      vehicleType: options.vehicleType || 'car',
      avoidTolls: options.avoidTolls || false,
      avoidMotorways: options.avoidMotorways || false,
    });
  }

  /**
   * Get real-time traffic information for a route
   */
  async getTrafficInfo(
    waypoints: TomTomRoutePoint[],
    options: {
      zoom?: number;
      trafficModelId?: string;
    } = {}
  ): Promise<TomTomTrafficResult> {
    return apiClient.post('/tomtom/traffic', {
      waypoints,
      zoom: options.zoom || 12,
      trafficModelId: options.trafficModelId,
    });
  }

  /**
   * Calculate optimal route matrix for multiple origins and destinations
   */
  async calculateRouteMatrix(
    origins: TomTomRoutePoint[],
    destinations: TomTomRoutePoint[],
    options: {
      routeType?: 'fastest' | 'shortest';
      traffic?: boolean;
      departureTime?: string;
    } = {}
  ): Promise<{
    success: boolean;
    data?: {
      matrix: Array<Array<{
        response: {
          routeSummary: {
            lengthInMeters: number;
            travelTimeInSeconds: number;
            trafficDelayInSeconds: number;
          };
        };
      }>>;
      effectiveSettings: any;
    };
    error?: string;
  }> {
    return apiClient.post('/tomtom/route-matrix', {
      origins,
      destinations,
      routeType: options.routeType || 'fastest',
      traffic: options.traffic !== false,
      departureTime: options.departureTime,
    });
  }

  /**
   * Plan multi-day mission routes with overnight stops
   */
  async planMultiDayMission(
    waypoints: TomTomRoutePoint[],
    options: {
      maxDrivingTimePerDay?: number; // seconds
      maxDistancePerDay?: number; // meters
      overnightStops?: TomTomRoutePoint[];
      departureTime?: string;
      preferences?: {
        hotelChains?: string[];
        fuelStations?: boolean;
        restaurants?: boolean;
      };
    } = {}
  ): Promise<{
    success: boolean;
    data?: {
      days: Array<{
        dayNumber: number;
        routes: TomTomOptimizationResult['data'];
        accommodations?: Array<{
          name: string;
          address: string;
          coordinates: TomTomRoutePoint;
          rating?: number;
          amenities?: string[];
        }>;
        fuelStops?: Array<{
          name: string;
          coordinates: TomTomRoutePoint;
          fuelTypes?: string[];
        }>;
      }>;
      totalDistance: number;
      totalTime: number;
      estimatedCost: {
        fuel: number;
        accommodation: number;
        total: number;
      };
    };
    error?: string;
  }> {
    return apiClient.post('/tomtom/plan-multi-day', {
      waypoints,
      maxDrivingTimePerDay: options.maxDrivingTimePerDay || 28800, // 8 hours
      maxDistancePerDay: options.maxDistancePerDay || 800000, // 800 km
      overnightStops: options.overnightStops || [],
      departureTime: options.departureTime,
      preferences: options.preferences || {},
    });
  }

  /**
   * Get real-time vehicle tracking and ETA updates
   */
  async trackVehicle(
    vehicleId: string,
    currentLocation: TomTomRoutePoint,
    destination: TomTomRoutePoint,
    routeId?: string
  ): Promise<{
    success: boolean;
    data?: {
      vehicle: {
        id: string;
        currentLocation: TomTomRoutePoint;
        speed: number; // km/h
        heading: number; // degrees
        lastUpdate: string;
      };
      route: {
        remainingDistance: number;
        remainingTime: number;
        estimatedArrival: string;
        progress: number; // percentage
        nextWaypoint: TomTomRoutePoint;
        deviationFromRoute: boolean;
      };
      traffic: {
        hasDelays: boolean;
        totalDelay: number;
        incidents: Array<{
          severity: string;
          description: string;
          location: string;
        }>;
      };
    };
    error?: string;
  }> {
    return apiClient.post('/tomtom/track-vehicle', {
      vehicleId,
      currentLocation,
      destination,
      routeId,
    });
  }

  /**
   * Generate turn-by-turn navigation for mobile devices
   */
  async generateTurnByTurnNavigation(
    start: TomTomRoutePoint,
    end: TomTomRoutePoint,
    options: {
      language?: string;
      units?: 'metric' | 'imperial';
      voiceInstructions?: boolean;
      alternativeRoutes?: number;
    } = {}
  ): Promise<{
    success: boolean;
    data?: {
      routes: Array<{
        summary: {
          lengthInMeters: number;
          travelTimeInSeconds: number;
          trafficDelayInSeconds: number;
        };
        guidance: {
          instructions: Array<{
            maneuver: {
              instruction: string;
              type: string;
            };
            point: TomTomRoutePoint;
            routeOffsetInMeters: number;
            travelTimeInSeconds: number;
            streetName: string;
            countryCode: string;
            stateCode: string;
            signpostText?: string;
            exitNumber?: string;
          }>;
        };
        sections: any[];
      }>;
      voiceInstructions?: Array<{
        ssmlAnnouncement: string;
        plainTextAnnouncement: string;
        distanceAlongGeometry: number;
      }>;
    };
    error?: string;
  }> {
    return apiClient.post('/tomtom/turn-by-turn', {
      start,
      end,
      language: options.language || 'en-US',
      units: options.units || 'metric',
      voiceInstructions: options.voiceInstructions || false,
      alternativeRoutes: options.alternativeRoutes || 0,
    });
  }

  /**
   * Analyze route efficiency and suggest improvements
   */
  async analyzeRouteEfficiency(
    routePoints: TomTomRoutePoint[],
    actualTravelTimes?: number[]
  ): Promise<{
    success: boolean;
    data?: {
      efficiency: {
        score: number; // 0-100
        rating: 'excellent' | 'good' | 'fair' | 'poor';
      };
      analysis: {
        optimalRoute: TomTomRoutePoint[];
        currentRoute: TomTomRoutePoint[];
        improvements: Array<{
          type: string;
          description: string;
          potentialSavings: {
            time: number;
            distance: number;
            fuel: number;
          };
        }>;
      };
      recommendations: Array<{
        priority: 'high' | 'medium' | 'low';
        action: string;
        benefit: string;
        implementationCost: string;
      }>;
    };
    error?: string;
  }> {
    return apiClient.post('/tomtom/analyze-efficiency', {
      routePoints,
      actualTravelTimes,
    });
  }

  /**
   * Helper: Convert mission route to TomTom waypoints
   */
  convertMissionRouteToWaypoints(
    missions: Array<{
      id: number;
      prospect: {
        property_address?: string;
        mailing_address?: string;
        lat?: number;
        lng?: number;
      };
      lat_created?: number;
      lng_created?: number;
    }>
  ): TomTomRoutePoint[] {
    return missions.map((mission, index) => ({
      latitude: mission.lat_created || mission.prospect.lat || 0,
      longitude: mission.lng_created || mission.prospect.lng || 0,
      address: mission.prospect.property_address || mission.prospect.mailing_address,
      order: index,
    }));
  }

  /**
   * Helper: Calculate savings from route optimization
   */
  calculateOptimizationSavings(
    originalRoute: TomTomRoutePoint[],
    optimizedRoute: TomTomRoutePoint[],
    originalTime: number,
    optimizedTime: number,
    originalDistance: number,
    optimizedDistance: number
  ): {
    timeSaved: number;
    distanceSaved: number;
    fuelSaved: number;
    costSaved: number;
    percentageImprovement: number;
  } {
    const timeSaved = originalTime - optimizedTime;
    const distanceSaved = originalDistance - optimizedDistance;
    const fuelSaved = distanceSaved * 0.1; // Estimate: 0.1L per km saved
    const costSaved = fuelSaved * 1.5 + (timeSaved / 3600) * 25; // Fuel cost + time cost

    return {
      timeSaved,
      distanceSaved,
      fuelSaved,
      costSaved,
      percentageImprovement: ((originalTime - optimizedTime) / originalTime) * 100,
    };
  }

  /**
   * Helper: Format route summary for display
   */
  formatRouteSummary(route: any): string {
    const hours = Math.floor(route.travelTimeInSeconds / 3600);
    const minutes = Math.floor((route.travelTimeInSeconds % 3600) / 60);
    const distanceKm = (route.lengthInMeters / 1000).toFixed(1);
    
    return `${distanceKm} km, ${hours}h ${minutes}m`;
  }

  /**
   * Helper: Get route color based on traffic conditions
   */
  getRouteColor(trafficDelay: number): string {
    if (trafficDelay < 300) return '#4CAF50'; // Green - good traffic
    if (trafficDelay < 900) return '#FF9800'; // Orange - moderate traffic
    return '#F44336'; // Red - heavy traffic
  }
}

export const tomtomService = new TomTomService();
export default tomtomService;