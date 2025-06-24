// Route Optimization Service
// Based on Laravel TLC BOTG route optimization with TomTom API integration

import { Target } from '../types/target';
import { Agent } from './missionDistributionService';

export interface RoutePoint {
  id: string;
  target_id: number;
  lat: number;
  lng: number;
  address: string;
  estimated_duration: number;
  order_index: number;
  optimized_index?: number;
  is_optimized: boolean;
}

export interface OptimizedRoute {
  id: string;
  agent_id: string;
  status: 'pending' | 'optimizing' | 'completed' | 'failed';
  points: RoutePoint[];
  total_distance: number;
  total_time: number;
  created_at: string;
  optimization_provider?: 'tomtom' | 'google' | 'internal';
  route_geometry?: string; // Encoded polyline
}

export interface RouteOptimizationRequest {
  agent_location: {
    lat: number;
    lng: number;
  };
  targets: Target[];
  constraints: {
    max_route_time: number; // minutes
    max_stops: number;
    vehicle_type: 'car' | 'truck' | 'walking';
    avoid_tolls: boolean;
    avoid_highways: boolean;
  };
  optimization_criteria: 'time' | 'distance' | 'fuel_efficiency';
}

export interface RouteOptimizationResult {
  success: boolean;
  route?: OptimizedRoute;
  original_distance: number;
  optimized_distance: number;
  time_savings: number; // minutes
  error?: string;
}

export interface TomTomApiResponse {
  formatVersion: string;
  routes: Array<{
    summary: {
      lengthInMeters: number;
      travelTimeInSeconds: number;
      trafficDelayInSeconds: number;
    };
    legs: Array<{
      summary: {
        lengthInMeters: number;
        travelTimeInSeconds: number;
      };
      points: Array<{
        latitude: number;
        longitude: number;
      }>;
    }>;
    guidance?: {
      instructions: Array<{
        routeOffsetInMeters: number;
        travelTimeInSeconds: number;
        point: {
          latitude: number;
          longitude: number;
        };
        message: string;
      }>;
    };
  }>;
  optimizedOrder?: number[];
}

class RouteOptimizationService {
  private tomtomApiKey: string = process.env.REACT_APP_TOMTOM_API_KEY || '';
  private batchSize: number = 3; // Process routes in batches like Laravel
  private maxRetries: number = 3;

  /**
   * Optimize route for agent with multiple targets
   * Implements Laravel's MissionOptimizeRoutes command functionality
   */
  async optimizeRoute(request: RouteOptimizationRequest): Promise<RouteOptimizationResult> {
    try {
      // Validate request
      if (request.targets.length === 0) {
        throw new Error('No targets provided for optimization');
      }

      if (request.targets.length === 1) {
        // Single target - no optimization needed
        return this.createSingleTargetRoute(request);
      }

      // Calculate original route metrics
      const originalMetrics = this.calculateOriginalRouteMetrics(request);

      // Attempt optimization with external API
      let optimizationResult: RouteOptimizationResult;
      
      if (this.tomtomApiKey && request.targets.length <= 25) {
        // Use TomTom API for optimization (like Laravel system)
        optimizationResult = await this.optimizeWithTomTom(request, originalMetrics);
      } else {
        // Fall back to internal optimization for large routes or missing API key
        optimizationResult = await this.optimizeInternally(request, originalMetrics);
      }

      return optimizationResult;

    } catch (error) {
      console.error('Route optimization failed:', error);
      return {
        success: false,
        original_distance: 0,
        optimized_distance: 0,
        time_savings: 0,
        error: error instanceof Error ? error.message : 'Unknown optimization error'
      };
    }
  }

  /**
   * Optimize multiple routes in batches
   * Implements Laravel's batch processing approach
   */
  async optimizeMultipleRoutes(
    requests: RouteOptimizationRequest[]
  ): Promise<RouteOptimizationResult[]> {
    const results: RouteOptimizationResult[] = [];
    
    // Process in batches to avoid API rate limits
    for (let i = 0; i < requests.length; i += this.batchSize) {
      const batch = requests.slice(i, i + this.batchSize);
      
      const batchPromises = batch.map(request => 
        this.optimizeRoute(request).catch(error => ({
          success: false,
          original_distance: 0,
          optimized_distance: 0,
          time_savings: 0,
          error: error.message
        }))
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add delay between batches to respect API limits
      if (i + this.batchSize < requests.length) {
        await this.delay(1000); // 1 second delay
      }
    }

    return results;
  }

  /**
   * Optimize route using TomTom API
   * Matches Laravel's TomTom integration
   */
  private async optimizeWithTomTom(
    request: RouteOptimizationRequest,
    originalMetrics: { distance: number; time: number }
  ): Promise<RouteOptimizationResult> {
    const waypoints = [
      request.agent_location,
      ...request.targets.map(t => ({ lat: t.latitude || 0, lng: t.longitude || 0 }))
    ];

    const url = this.buildTomTomOptimizationUrl(waypoints, request);

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`TomTom API error: ${response.status} ${response.statusText}`);
        }

        const data: TomTomApiResponse = await response.json();
        
        if (!data.routes || data.routes.length === 0) {
          throw new Error('No routes returned from TomTom API');
        }

        return this.processTomTomResponse(data, request, originalMetrics);

      } catch (error) {
        console.error(`TomTom optimization attempt ${attempt} failed:`, error);
        
        if (attempt === this.maxRetries) {
          // Fall back to internal optimization on final failure
          return this.optimizeInternally(request, originalMetrics);
        }
        
        // Wait before retry
        await this.delay(2000 * attempt);
      }
    }

    throw new Error('All TomTom optimization attempts failed');
  }

  /**
   * Build TomTom API URL for route optimization
   */
  private buildTomTomOptimizationUrl(
    waypoints: Array<{ lat: number; lng: number }>,
    request: RouteOptimizationRequest
  ): string {
    const baseUrl = 'https://api.tomtom.com/routing/1/calculateRoute';
    
    // Format waypoints for TomTom API
    const waypointString = waypoints
      .map(wp => `${wp.lat},${wp.lng}`)
      .join(':');

    const params = new URLSearchParams({
      key: this.tomtomApiKey,
      locations: waypointString,
      optimizeWaypoints: 'true',
      computeBestOrder: 'true',
      vehicleEngineType: 'combustion',
      avoid: this.buildAvoidanceString(request.constraints),
      travelMode: this.mapVehicleType(request.constraints.vehicle_type),
      traffic: 'true',
      routeType: this.mapOptimizationCriteria(request.optimization_criteria),
    });

    return `${baseUrl}/${waypointString}/json?${params.toString()}`;
  }

  /**
   * Process TomTom API response and create optimized route
   */
  private processTomTomResponse(
    data: TomTomApiResponse,
    request: RouteOptimizationRequest,
    originalMetrics: { distance: number; time: number }
  ): RouteOptimizationResult {
    const route = data.routes[0];
    const optimizedOrder = data.optimizedOrder || [];

    // Create optimized route points
    const routePoints: RoutePoint[] = request.targets.map((target, index) => {
      const optimizedIndex = optimizedOrder.indexOf(index + 1); // TomTom uses 1-based indexing
      
      return {
        id: `point_${target.id}`,
        target_id: target.id,
        lat: target.latitude || 0,
        lng: target.longitude || 0,
        address: `${target.mailing_address_1}, ${target.mailing_city}, ${target.mailing_state}`,
        estimated_duration: 15, // Default 15 minutes per stop
        order_index: index,
        optimized_index: optimizedIndex >= 0 ? optimizedIndex : index,
        is_optimized: optimizedIndex >= 0
      };
    });

    // Sort by optimized order
    routePoints.sort((a, b) => a.optimized_index! - b.optimized_index!);

    const optimizedRoute: OptimizedRoute = {
      id: `route_${Date.now()}`,
      agent_id: '', // Would be set by caller
      status: 'completed',
      points: routePoints,
      total_distance: this.metersToMiles(route.summary.lengthInMeters),
      total_time: route.summary.travelTimeInSeconds / 60, // Convert to minutes
      created_at: new Date().toISOString(),
      optimization_provider: 'tomtom'
    };

    const timeSavings = originalMetrics.time - optimizedRoute.total_time;

    return {
      success: true,
      route: optimizedRoute,
      original_distance: originalMetrics.distance,
      optimized_distance: optimizedRoute.total_distance,
      time_savings: Math.max(0, timeSavings)
    };
  }

  /**
   * Internal route optimization using genetic algorithm approach
   * Fallback when external APIs are unavailable
   */
  private async optimizeInternally(
    request: RouteOptimizationRequest,
    originalMetrics: { distance: number; time: number }
  ): Promise<RouteOptimizationResult> {
    // Implement simple nearest neighbor algorithm with 2-opt improvement
    const targets = [...request.targets];
    let currentLocation = request.agent_location;
    const optimizedOrder: number[] = [];
    const remainingTargets = [...targets];

    // Nearest neighbor construction
    while (remainingTargets.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Infinity;

      for (let i = 0; i < remainingTargets.length; i++) {
        const target = remainingTargets[i];
        const distance = this.calculateDistance(
          currentLocation.lat,
          currentLocation.lng,
          target.latitude || 0,
          target.longitude || 0
        );

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }

      const nearestTarget = remainingTargets.splice(nearestIndex, 1)[0];
      optimizedOrder.push(targets.indexOf(nearestTarget));
      currentLocation = {
        lat: nearestTarget.latitude || 0,
        lng: nearestTarget.longitude || 0
      };
    }

    // Apply 2-opt improvement
    const improvedOrder = this.apply2OptImprovement(optimizedOrder, targets, request.agent_location);

    // Create route points
    const routePoints: RoutePoint[] = improvedOrder.map((targetIndex, orderIndex) => {
      const target = targets[targetIndex];
      return {
        id: `point_${target.id}`,
        target_id: target.id,
        lat: target.latitude || 0,
        lng: target.longitude || 0,
        address: `${target.mailing_address_1}, ${target.mailing_city}, ${target.mailing_state}`,
        estimated_duration: 15,
        order_index: targetIndex,
        optimized_index: orderIndex,
        is_optimized: true
      };
    });

    // Calculate optimized metrics
    const optimizedDistance = this.calculateRouteDistance(
      request.agent_location,
      routePoints
    );
    const optimizedTime = this.estimateRouteTime(optimizedDistance, routePoints.length);

    const optimizedRoute: OptimizedRoute = {
      id: `route_${Date.now()}`,
      agent_id: '',
      status: 'completed',
      points: routePoints,
      total_distance: optimizedDistance,
      total_time: optimizedTime,
      created_at: new Date().toISOString(),
      optimization_provider: 'internal'
    };

    return {
      success: true,
      route: optimizedRoute,
      original_distance: originalMetrics.distance,
      optimized_distance: optimizedDistance,
      time_savings: Math.max(0, originalMetrics.time - optimizedTime)
    };
  }

  /**
   * Apply 2-opt improvement to route
   */
  private apply2OptImprovement(
    order: number[],
    targets: Target[],
    startLocation: { lat: number; lng: number }
  ): number[] {
    let improved = true;
    let bestOrder = [...order];
    let bestDistance = this.calculateOrderDistance(bestOrder, targets, startLocation);

    while (improved) {
      improved = false;

      for (let i = 1; i < order.length - 1; i++) {
        for (let j = i + 1; j < order.length; j++) {
          // Try swapping edges
          const newOrder = [...bestOrder];
          this.reverse2OptSegment(newOrder, i, j);

          const newDistance = this.calculateOrderDistance(newOrder, targets, startLocation);

          if (newDistance < bestDistance) {
            bestOrder = newOrder;
            bestDistance = newDistance;
            improved = true;
          }
        }
      }
    }

    return bestOrder;
  }

  /**
   * Reverse segment for 2-opt
   */
  private reverse2OptSegment(order: number[], start: number, end: number): void {
    while (start < end) {
      const temp = order[start];
      order[start] = order[end];
      order[end] = temp;
      start++;
      end--;
    }
  }

  /**
   * Calculate total distance for a given order
   */
  private calculateOrderDistance(
    order: number[],
    targets: Target[],
    startLocation: { lat: number; lng: number }
  ): number {
    let totalDistance = 0;
    let currentLocation = startLocation;

    for (const targetIndex of order) {
      const target = targets[targetIndex];
      const distance = this.calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        target.latitude || 0,
        target.longitude || 0
      );
      totalDistance += distance;
      currentLocation = { lat: target.latitude || 0, lng: target.longitude || 0 };
    }

    return totalDistance;
  }

  /**
   * Create route for single target (no optimization needed)
   */
  private createSingleTargetRoute(request: RouteOptimizationRequest): RouteOptimizationResult {
    const target = request.targets[0];
    const distance = this.calculateDistance(
      request.agent_location.lat,
      request.agent_location.lng,
      target.latitude || 0,
      target.longitude || 0
    );

    const routePoint: RoutePoint = {
      id: `point_${target.id}`,
      target_id: target.id,
      lat: target.latitude || 0,
      lng: target.longitude || 0,
      address: `${target.mailing_address_1}, ${target.mailing_city}, ${target.mailing_state}`,
      estimated_duration: 15,
      order_index: 0,
      optimized_index: 0,
      is_optimized: false
    };

    const route: OptimizedRoute = {
      id: `route_${Date.now()}`,
      agent_id: '',
      status: 'completed',
      points: [routePoint],
      total_distance: distance,
      total_time: this.estimateRouteTime(distance, 1),
      created_at: new Date().toISOString(),
      optimization_provider: 'internal'
    };

    return {
      success: true,
      route,
      original_distance: distance,
      optimized_distance: distance,
      time_savings: 0
    };
  }

  /**
   * Calculate original route metrics without optimization
   */
  private calculateOriginalRouteMetrics(
    request: RouteOptimizationRequest
  ): { distance: number; time: number } {
    const routePoints: RoutePoint[] = request.targets.map((target, index) => ({
      id: `point_${target.id}`,
      target_id: target.id,
      lat: target.latitude || 0,
      lng: target.longitude || 0,
      address: `${target.mailing_address_1}, ${target.mailing_city}, ${target.mailing_state}`,
      estimated_duration: 15,
      order_index: index,
      is_optimized: false
    }));

    const distance = this.calculateRouteDistance(request.agent_location, routePoints);
    const time = this.estimateRouteTime(distance, routePoints.length);

    return { distance, time };
  }

  /**
   * Calculate total route distance
   */
  private calculateRouteDistance(
    startLocation: { lat: number; lng: number },
    points: RoutePoint[]
  ): number {
    let totalDistance = 0;
    let currentLocation = startLocation;

    for (const point of points) {
      const distance = this.calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        point.lat,
        point.lng
      );
      totalDistance += distance;
      currentLocation = { lat: point.lat, lng: point.lng };
    }

    return totalDistance;
  }

  /**
   * Estimate route time based on distance and stops
   */
  private estimateRouteTime(distance: number, numberOfStops: number): number {
    const drivingTime = distance * 2; // 2 minutes per mile (30 mph average)
    const stopTime = numberOfStops * 15; // 15 minutes per stop
    return drivingTime + stopTime;
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private metersToMiles(meters: number): number {
    return meters * 0.000621371;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private buildAvoidanceString(constraints: RouteOptimizationRequest['constraints']): string {
    const avoidances: string[] = [];
    if (constraints.avoid_tolls) avoidances.push('tollRoads');
    if (constraints.avoid_highways) avoidances.push('motorways');
    return avoidances.join(',');
  }

  private mapVehicleType(vehicleType: string): string {
    switch (vehicleType) {
      case 'truck': return 'truck';
      case 'walking': return 'pedestrian';
      default: return 'car';
    }
  }

  private mapOptimizationCriteria(criteria: string): string {
    switch (criteria) {
      case 'distance': return 'shortest';
      case 'fuel_efficiency': return 'eco';
      default: return 'fastest';
    }
  }
}

export const routeOptimizationService = new RouteOptimizationService();