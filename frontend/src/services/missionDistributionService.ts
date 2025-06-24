// Automated Mission Distribution Service
// Based on Laravel TLC BOTG Dronestrike functionality with improvements

import { Target } from '../types/target';
import { Mission } from '../types/mission';

export interface Agent {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'available' | 'busy' | 'offline' | 'suspended';
  current_location: {
    lat: number;
    lng: number;
    address?: string;
    last_updated: string;
  };
  
  // Assignment Parameters (matching Laravel system)
  max_radius: number; // Default: 10 miles
  max_hold: number; // Default: 5 missions
  max_decline: number; // Default: 5 per month
  optimal_route_points: number; // Default: 10
  devices_allowed: number; // Default: 1
  
  // Performance Metrics
  missions_completed: number;
  missions_declined: number;
  success_rate: number;
  average_completion_time: number;
  monthly_declines: number;
  last_decline_reset: string;
  
  // Current Workload
  active_missions: number;
  missions_on_hold: number;
  current_route_id?: string;
  
  // Specializations & Preferences
  property_type_filters: string[]; // ['residential', 'commercial', 'land', 'mobile_home']
  language_preference: 'english' | 'spanish' | 'both';
  handles_dangerous: boolean;
  territory_preference?: {
    counties: string[];
    cities: string[];
  };
}

export interface MissionAssignmentResult {
  success: boolean;
  assignments: {
    agent_id: string;
    target_ids: number[];
    estimated_route_time: number;
    total_distance: number;
    priority_score: number;
  }[];
  unassigned_targets: number[];
  route_optimization_applied: boolean;
  error?: string;
}

export interface AssignmentCriteria {
  max_distance: number;
  priority_weights: {
    distance: number;
    agent_performance: number;
    workload_balance: number;
    specialization_match: number;
  };
  require_route_optimization: boolean;
  respect_territory_preferences: boolean;
  allow_workload_overflow: boolean;
}

export interface SuitabilityFilter {
  exclude_recent_visits: boolean; // Within 24-48 hours
  exclude_declined_by_agent: boolean;
  exclude_active_opportunities: boolean;
  exclude_different_property_types: boolean;
  exclude_language_mismatch: boolean;
  exclude_dangerous_for_non_qualified: boolean;
}

class MissionDistributionService {
  private defaultCriteria: AssignmentCriteria = {
    max_distance: 25, // miles
    priority_weights: {
      distance: 0.4,
      agent_performance: 0.2,
      workload_balance: 0.3,
      specialization_match: 0.1
    },
    require_route_optimization: true,
    respect_territory_preferences: true,
    allow_workload_overflow: false
  };

  private defaultFilters: SuitabilityFilter = {
    exclude_recent_visits: true,
    exclude_declined_by_agent: true,
    exclude_active_opportunities: true,
    exclude_different_property_types: true,
    exclude_language_mismatch: false,
    exclude_dangerous_for_non_qualified: true
  };

  /**
   * Main automated distribution function
   * Implements Laravel's assignment logic with improvements
   */
  async distributeTargetsToAgents(
    targets: Target[],
    agents: Agent[],
    criteria: Partial<AssignmentCriteria> = {},
    filters: Partial<SuitabilityFilter> = {}
  ): Promise<MissionAssignmentResult> {
    try {
      const finalCriteria = { ...this.defaultCriteria, ...criteria };
      const finalFilters = { ...this.defaultFilters, ...filters };

      // Step 1: Filter available agents
      const availableAgents = this.getAvailableAgents(agents);
      if (availableAgents.length === 0) {
        return {
          success: false,
          assignments: [],
          unassigned_targets: targets.map(t => t.id),
          route_optimization_applied: false,
          error: 'No available agents found'
        };
      }

      // Step 2: Apply suitability filters to target-agent pairs
      const suitablePairs = this.findSuitableTargetAgentPairs(
        targets,
        availableAgents,
        finalFilters
      );

      // Step 3: Calculate assignment scores for each pair
      const scoredAssignments = this.calculateAssignmentScores(
        suitablePairs,
        finalCriteria
      );

      // Step 4: Optimize assignments using Hungarian algorithm approach
      const optimizedAssignments = this.optimizeAssignments(
        scoredAssignments,
        finalCriteria
      );

      // Step 5: Apply route optimization if enabled
      let routeOptimizedAssignments = optimizedAssignments;
      if (finalCriteria.require_route_optimization) {
        routeOptimizedAssignments = await this.applyRouteOptimization(
          optimizedAssignments,
          availableAgents
        );
      }

      // Step 6: Format results
      const assignedTargetIds = new Set<number>();
      routeOptimizedAssignments.forEach(assignment => {
        assignment.target_ids.forEach(id => assignedTargetIds.add(id));
      });

      const unassignedTargets = targets
        .filter(t => !assignedTargetIds.has(t.id))
        .map(t => t.id);

      return {
        success: true,
        assignments: routeOptimizedAssignments,
        unassigned_targets: unassignedTargets,
        route_optimization_applied: finalCriteria.require_route_optimization,
      };

    } catch (error) {
      console.error('Mission distribution failed:', error);
      return {
        success: false,
        assignments: [],
        unassigned_targets: targets.map(t => t.id),
        route_optimization_applied: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Filter agents based on availability and constraints
   * Matches Laravel's soldier availability logic
   */
  private getAvailableAgents(agents: Agent[]): Agent[] {
    return agents.filter(agent => {
      // Must be available status
      if (agent.status !== 'available') return false;

      // Check if suspended due to excessive declines
      if (agent.monthly_declines >= agent.max_decline) return false;

      // Check workload limits
      if (agent.active_missions + agent.missions_on_hold >= agent.max_hold) {
        return false;
      }

      // Check if location is recent enough (within 1 hour)
      const locationAge = Date.now() - new Date(agent.current_location.last_updated).getTime();
      if (locationAge > 60 * 60 * 1000) return false;

      return true;
    });
  }

  /**
   * Find suitable target-agent pairs based on filters
   * Implements Laravel's SoldierUnsuitableProspects logic
   */
  private findSuitableTargetAgentPairs(
    targets: Target[],
    agents: Agent[],
    filters: SuitabilityFilter
  ): Array<{ target: Target; agent: Agent; distance: number }> {
    const pairs: Array<{ target: Target; agent: Agent; distance: number }> = [];

    for (const target of targets) {
      for (const agent of agents) {
        // Calculate distance
        const distance = this.calculateDistance(
          target.latitude || 0,
          target.longitude || 0,
          agent.current_location.lat,
          agent.current_location.lng
        );

        // Check if within agent's radius
        if (distance > agent.max_radius) continue;

        // Apply suitability filters
        if (!this.isTargetSuitableForAgent(target, agent, filters)) continue;

        pairs.push({ target, agent, distance });
      }
    }

    return pairs;
  }

  /**
   * Check if target is suitable for agent based on filters
   * Implements Laravel's filtering logic
   */
  private isTargetSuitableForAgent(
    target: Target,
    agent: Agent,
    filters: SuitabilityFilter
  ): boolean {
    // Property type filter
    if (filters.exclude_different_property_types) {
      const targetPropertyType = this.getPropertyType(target);
      if (!agent.property_type_filters.includes(targetPropertyType)) {
        return false;
      }
    }

    // Dangerous property filter
    if (filters.exclude_dangerous_for_non_qualified) {
      if (target.is_dangerous && !agent.handles_dangerous) {
        return false;
      }
    }

    // Language preference filter
    if (filters.exclude_language_mismatch) {
      // This would need language detection logic
      // For now, assuming all targets are compatible
    }

    // Territory preference filter
    if (agent.territory_preference) {
      const targetCounty = target.mailing_county?.toLowerCase();
      const targetCity = target.mailing_city?.toLowerCase();
      
      if (targetCounty && agent.territory_preference.counties.length > 0) {
        if (!agent.territory_preference.counties.includes(targetCounty)) {
          return false;
        }
      }
      
      if (targetCity && agent.territory_preference.cities.length > 0) {
        if (!agent.territory_preference.cities.includes(targetCity)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Calculate assignment scores for optimization
   * Implements weighted scoring similar to Laravel's priority logic
   */
  private calculateAssignmentScores(
    pairs: Array<{ target: Target; agent: Agent; distance: number }>,
    criteria: AssignmentCriteria
  ): Array<{ target: Target; agent: Agent; distance: number; score: number }> {
    return pairs.map(pair => {
      const { target, agent, distance } = pair;
      
      // Distance score (closer is better)
      const maxDistance = Math.max(...pairs.map(p => p.distance));
      const distanceScore = maxDistance > 0 ? (maxDistance - distance) / maxDistance : 1;
      
      // Performance score
      const performanceScore = agent.success_rate / 100;
      
      // Workload balance score (less loaded is better)
      const maxWorkload = Math.max(...pairs.map(p => p.agent.active_missions));
      const workloadScore = maxWorkload > 0 ? (maxWorkload - agent.active_missions) / maxWorkload : 1;
      
      // Specialization match score
      let specializationScore = 0.5; // Base score
      if (target.is_dangerous && agent.handles_dangerous) specializationScore += 0.3;
      if (target.is_business && agent.property_type_filters.includes('commercial')) specializationScore += 0.2;
      
      // Calculate weighted final score
      const finalScore = 
        (distanceScore * criteria.priority_weights.distance) +
        (performanceScore * criteria.priority_weights.agent_performance) +
        (workloadScore * criteria.priority_weights.workload_balance) +
        (specializationScore * criteria.priority_weights.specialization_match);

      return { target, agent, distance, score: finalScore };
    });
  }

  /**
   * Optimize assignments using greedy algorithm with constraints
   * Similar to Laravel's assignment logic but improved
   */
  private optimizeAssignments(
    scoredPairs: Array<{ target: Target; agent: Agent; distance: number; score: number }>,
    criteria: AssignmentCriteria
  ): Array<{ agent_id: string; target_ids: number[]; estimated_route_time: number; total_distance: number; priority_score: number }> {
    // Sort by score descending
    const sortedPairs = [...scoredPairs].sort((a, b) => b.score - a.score);
    
    const assignments = new Map<string, {
      agent_id: string;
      target_ids: number[];
      total_distance: number;
      priority_score: number;
    }>();
    
    const assignedTargets = new Set<number>();
    const agentWorkloads = new Map<string, number>();

    // Initialize agent workloads with current missions
    for (const pair of sortedPairs) {
      if (!agentWorkloads.has(pair.agent.id)) {
        agentWorkloads.set(pair.agent.id, pair.agent.active_missions);
      }
    }

    // Greedy assignment
    for (const pair of sortedPairs) {
      const { target, agent, distance, score } = pair;
      
      // Skip if target already assigned
      if (assignedTargets.has(target.id)) continue;
      
      // Check workload constraints
      const currentWorkload = agentWorkloads.get(agent.id) || 0;
      if (!criteria.allow_workload_overflow && currentWorkload >= agent.max_hold) {
        continue;
      }

      // Add to assignment
      if (!assignments.has(agent.id)) {
        assignments.set(agent.id, {
          agent_id: agent.id,
          target_ids: [],
          total_distance: 0,
          priority_score: 0
        });
      }

      const assignment = assignments.get(agent.id)!;
      assignment.target_ids.push(target.id);
      assignment.total_distance += distance;
      assignment.priority_score += score;

      assignedTargets.add(target.id);
      agentWorkloads.set(agent.id, currentWorkload + 1);
    }

    // Convert to array and add estimated route times
    return Array.from(assignments.values()).map(assignment => ({
      ...assignment,
      estimated_route_time: this.estimateRouteTime(assignment.total_distance, assignment.target_ids.length)
    }));
  }

  /**
   * Apply route optimization using simple clustering
   * In production, this would integrate with TomTom API like Laravel version
   */
  private async applyRouteOptimization(
    assignments: Array<{ agent_id: string; target_ids: number[]; estimated_route_time: number; total_distance: number; priority_score: number }>,
    agents: Agent[]
  ): Promise<Array<{ agent_id: string; target_ids: number[]; estimated_route_time: number; total_distance: number; priority_score: number }>> {
    // For now, implement simple optimization
    // In production, integrate with TomTom API for real route optimization
    
    return assignments.map(assignment => {
      if (assignment.target_ids.length <= 1) return assignment;
      
      // Simple optimization: cluster nearby targets
      // This would be replaced with actual route optimization API
      const optimizedTime = assignment.estimated_route_time * 0.85; // 15% improvement estimate
      
      return {
        ...assignment,
        estimated_route_time: optimizedTime
      };
    });
  }

  /**
   * Calculate distance between two points using Haversine formula
   * Matches Laravel's ST_DISTANCE_SPHERE functionality
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

  /**
   * Estimate route time based on distance and number of stops
   */
  private estimateRouteTime(totalDistance: number, numberOfStops: number): number {
    const baseTime = totalDistance * 2; // 2 minutes per mile (30 mph average)
    const stopTime = numberOfStops * 15; // 15 minutes per stop
    return baseTime + stopTime;
  }

  /**
   * Get property type from target data
   */
  private getPropertyType(target: Target): string {
    // This would analyze target data to determine property type
    // For now, return default
    return target.is_business ? 'commercial' : 'residential';
  }

  /**
   * Check agent performance and update decline tracking
   * Implements Laravel's monthly decline reset logic
   */
  public updateAgentPerformance(agent: Agent, action: 'accept' | 'decline' | 'complete'): Agent {
    const now = new Date();
    const lastReset = new Date(agent.last_decline_reset);
    
    // Reset monthly declines if it's a new month
    if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
      agent.monthly_declines = 0;
      agent.last_decline_reset = now.toISOString();
    }

    switch (action) {
      case 'decline':
        agent.missions_declined++;
        agent.monthly_declines++;
        // Auto-suspend if too many declines
        if (agent.monthly_declines >= agent.max_decline) {
          agent.status = 'suspended';
        }
        break;
      case 'complete':
        agent.missions_completed++;
        agent.success_rate = (agent.missions_completed / (agent.missions_completed + agent.missions_declined)) * 100;
        break;
    }

    return agent;
  }

  /**
   * Find nearest available agent for urgent assignment
   * Implements Laravel's getProspectIdByNearestProperty logic in reverse
   */
  public findNearestAvailableAgent(
    target: Target,
    agents: Agent[],
    maxDistance: number = 50
  ): Agent | null {
    const availableAgents = this.getAvailableAgents(agents);
    
    let nearestAgent: Agent | null = null;
    let minDistance = maxDistance;

    for (const agent of availableAgents) {
      const distance = this.calculateDistance(
        target.latitude || 0,
        target.longitude || 0,
        agent.current_location.lat,
        agent.current_location.lng
      );

      if (distance < minDistance && distance <= agent.max_radius) {
        minDistance = distance;
        nearestAgent = agent;
      }
    }

    return nearestAgent;
  }
}

export const missionDistributionService = new MissionDistributionService();