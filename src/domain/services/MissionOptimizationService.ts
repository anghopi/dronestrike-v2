/**
 * Mission Optimization Service
 * Translated from Laravel mission assignment and routing logic
 */

export interface MissionCoordinates {
  latitude: number;
  longitude: number;
}

export interface PropertyForMission {
  id: number;
  latitude: number;
  longitude: number;
  address: string;
  priority: number;
  estimatedDuration: number;
}

export interface RouteOptimizationResult {
  properties: PropertyForMission[];
  totalDistance: number;
  estimatedTotalTime: number;
  optimizedOrder: number[];
}

export interface MissionTimeWindow {
  start: Date;
  end: Date;
  isValid: boolean;
}

export class MissionOptimizationService {
  
  // Constants from Laravel system
  private static readonly MAX_MISSION_RADIUS = 100; // miles
  private static readonly MISSION_START_HOUR = 8; // 8 AM
  private static readonly MISSION_END_HOUR = 20; // 8 PM
  private static readonly DEFAULT_ROUTE_POINTS = 5;
  private static readonly AVERAGE_SPEED_MPH = 25; // Urban driving speed
  private static readonly EARTH_RADIUS_MILES = 3958.8;

  /**
   * Find nearest properties to a given location within radius
   * Translated from Laravel MissionService::getProspectIdByNearestProperty()
   */
  static findNearestProperties(
    centerPoint: MissionCoordinates,
    radius: number = this.MAX_MISSION_RADIUS,
    maxResults: number = this.DEFAULT_ROUTE_POINTS
  ): { properties: PropertyForMission[]; searchRadius: number } {
    // This would typically query the database
    // For now, returning the interface structure
    return {
      properties: [],
      searchRadius: radius,
    };
  }

  /**
   * Calculate distance between two geographic points using Haversine formula
   * From Laravel geographic distance calculation
   */
  static calculateDistance(point1: MissionCoordinates, point2: MissionCoordinates): number {
    const dLat = this.toRadians(point2.latitude - point1.latitude);
    const dLng = this.toRadians(point2.longitude - point1.longitude);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(point1.latitude)) *
              Math.cos(this.toRadians(point2.latitude)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return this.EARTH_RADIUS_MILES * c;
  }

  /**
   * Optimize route order using nearest neighbor algorithm
   * Simplified version of TSP for mission routing
   */
  static optimizeRoute(
    startPoint: MissionCoordinates,
    properties: PropertyForMission[]
  ): RouteOptimizationResult {
    if (properties.length === 0) {
      return {
        properties: [],
        totalDistance: 0,
        estimatedTotalTime: 0,
        optimizedOrder: [],
      };
    }

    const unvisited = [...properties];
    const optimizedOrder: number[] = [];
    let currentPoint = startPoint;
    let totalDistance = 0;
    let estimatedTotalTime = 0;

    while (unvisited.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Number.MAX_VALUE;

      // Find nearest unvisited property
      for (let i = 0; i < unvisited.length; i++) {
        const distance = this.calculateDistance(currentPoint, {
          latitude: unvisited[i].latitude,
          longitude: unvisited[i].longitude,
        });

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }

      // Add to route
      const nearestProperty = unvisited.splice(nearestIndex, 1)[0];
      optimizedOrder.push(nearestProperty.id);
      totalDistance += nearestDistance;
      estimatedTotalTime += (nearestDistance / this.AVERAGE_SPEED_MPH) * 60; // Convert to minutes
      estimatedTotalTime += nearestProperty.estimatedDuration; // Add work time

      // Update current position
      currentPoint = {
        latitude: nearestProperty.latitude,
        longitude: nearestProperty.longitude,
      };
    }

    return {
      properties: properties.filter(p => optimizedOrder.includes(p.id))
                          .sort((a, b) => optimizedOrder.indexOf(a.id) - optimizedOrder.indexOf(b.id)),
      totalDistance: Math.round(totalDistance * 100) / 100,
      estimatedTotalTime: Math.round(estimatedTotalTime),
      optimizedOrder,
    };
  }

  /**
   * Check if current time is within mission creation window
   * From Laravel CreateMissionTimeRangeChecker::canCreateMission()
   */
  static canCreateMission(date: Date = new Date()): MissionTimeWindow {
    const missionDate = new Date(date);
    const startTime = new Date(missionDate);
    startTime.setHours(this.MISSION_START_HOUR, 0, 0, 0);
    
    const endTime = new Date(missionDate);
    endTime.setHours(this.MISSION_END_HOUR, 0, 0, 0);
    
    const now = new Date();
    const isValid = now >= startTime && now <= endTime;

    return {
      start: startTime,
      end: endTime,
      isValid,
    };
  }

  /**
   * Calculate estimated mission duration based on properties and travel
   */
  static estimateMissionDuration(
    properties: PropertyForMission[],
    travelTime: number,
    setupTime: number = 15 // minutes for setup/breakdown
  ): number {
    const workTime = properties.reduce((total, prop) => total + prop.estimatedDuration, 0);
    return Math.round(workTime + travelTime + setupTime);
  }

  /**
   * Validate mission parameters
   */
  static validateMissionParameters(
    centerPoint: MissionCoordinates,
    radius: number,
    scheduledDate?: Date
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate coordinates
    if (centerPoint.latitude < -90 || centerPoint.latitude > 90) {
      errors.push('Invalid latitude: must be between -90 and 90');
    }

    if (centerPoint.longitude < -180 || centerPoint.longitude > 180) {
      errors.push('Invalid longitude: must be between -180 and 180');
    }

    // Validate radius
    if (radius <= 0 || radius > this.MAX_MISSION_RADIUS) {
      errors.push(`Radius must be between 1 and ${this.MAX_MISSION_RADIUS} miles`);
    }

    // Validate scheduled date if provided
    if (scheduledDate) {
      const timeWindow = this.canCreateMission(scheduledDate);
      if (!timeWindow.isValid) {
        errors.push(`Missions can only be scheduled between ${this.MISSION_START_HOUR}:00 AM and ${this.MISSION_END_HOUR}:00 PM`);
      }

      if (scheduledDate < new Date()) {
        errors.push('Mission cannot be scheduled in the past');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calculate mission efficiency score
   * Based on distance/time ratio and property density
   */
  static calculateMissionEfficiency(route: RouteOptimizationResult): number {
    if (route.properties.length === 0) return 0;

    const propertiesPerHour = route.properties.length / (route.estimatedTotalTime / 60);
    const milesPerProperty = route.totalDistance / route.properties.length;
    
    // Higher score for more properties per hour, lower score for more miles per property
    const efficiencyScore = (propertiesPerHour * 10) - milesPerProperty;
    
    return Math.max(0, Math.min(100, Math.round(efficiencyScore * 10) / 10));
  }

  /**
   * Generate mission route waypoints for GPS navigation
   */
  static generateWaypoints(
    startPoint: MissionCoordinates,
    optimizedRoute: RouteOptimizationResult,
    endPoint?: MissionCoordinates
  ): MissionCoordinates[] {
    const waypoints: MissionCoordinates[] = [startPoint];
    
    optimizedRoute.properties.forEach(property => {
      waypoints.push({
        latitude: property.latitude,
        longitude: property.longitude,
      });
    });

    if (endPoint) {
      waypoints.push(endPoint);
    }

    return waypoints;
  }

  /**
   * Check if two missions have overlapping geographic areas
   */
  static checkMissionOverlap(
    mission1Center: MissionCoordinates,
    mission1Radius: number,
    mission2Center: MissionCoordinates,
    mission2Radius: number
  ): { overlaps: boolean; distance: number; overlapPercentage: number } {
    const distance = this.calculateDistance(mission1Center, mission2Center);
    const radiusSum = mission1Radius + mission2Radius;
    const overlaps = distance < radiusSum;
    
    let overlapPercentage = 0;
    if (overlaps) {
      const overlapDistance = radiusSum - distance;
      const avgRadius = (mission1Radius + mission2Radius) / 2;
      overlapPercentage = Math.round((overlapDistance / avgRadius) * 100);
    }

    return {
      overlaps,
      distance: Math.round(distance * 100) / 100,
      overlapPercentage,
    };
  }

  /**
   * Calculate optimal batch size for missions
   * Based on available soldiers, time constraints, and property density
   */
  static calculateOptimalBatchSize(
    availableSoldiers: number,
    timeConstraintHours: number,
    propertiesInArea: number,
    avgPropertyDuration: number
  ): number {
    const maxPropertiesPerSoldier = Math.floor(
      (timeConstraintHours * 60) / (avgPropertyDuration + 10) // 10 min travel between properties
    );
    
    const idealBatchSize = Math.min(
      propertiesInArea,
      availableSoldiers * maxPropertiesPerSoldier
    );
    
    return Math.max(1, idealBatchSize);
  }

  /**
   * Helper method to convert degrees to radians
   */
  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Helper method to convert radians to degrees
   */
  private static toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }

  /**
   * Calculate bearing between two points
   */
  static calculateBearing(from: MissionCoordinates, to: MissionCoordinates): number {
    const dLng = this.toRadians(to.longitude - from.longitude);
    const lat1 = this.toRadians(from.latitude);
    const lat2 = this.toRadians(to.latitude);
    
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    
    const bearing = this.toDegrees(Math.atan2(y, x));
    return (bearing + 360) % 360; // Normalize to 0-360 degrees
  }
}