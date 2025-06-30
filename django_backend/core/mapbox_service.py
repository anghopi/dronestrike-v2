"""
Mapbox Integration Service
Handles route optimization, geocoding, and mapping functionality
Replaces Google Maps from the Laravel implementation
"""

import requests
from django.conf import settings
from decimal import Decimal
import json
from typing import List, Dict, Tuple, Optional


class MapboxService:
    """Mapbox API integration service"""
    
    def __init__(self):
        self.access_token = getattr(settings, 'MAPBOX_ACCESS_TOKEN', None)
        if not self.access_token:
            raise ValueError("MAPBOX_ACCESS_TOKEN is required in settings")
        
        self.base_url = "https://api.mapbox.com"
    
    def optimize_route(self, coordinates: List[Tuple[float, float]], 
                      start_coordinate: Optional[Tuple[float, float]] = None) -> Dict:
        """
        Optimize route for multiple waypoints using Mapbox Optimization API
        Replaces Laravel's TomTom routing service
        
        Args:
            coordinates: List of (longitude, latitude) tuples for waypoints
            start_coordinate: Optional starting point (longitude, latitude)
        
        Returns:
            Dictionary with optimized route data
        """
        if len(coordinates) < 2:
            raise ValueError("At least 2 coordinates required for route optimization")
        
        if len(coordinates) > 25:
            raise ValueError("Maximum 25 waypoints allowed")
        
        # Prepare coordinates string for Mapbox API
        if start_coordinate:
            all_coordinates = [start_coordinate] + coordinates
        else:
            all_coordinates = coordinates
        
        # Format: "lng,lat;lng,lat;..."
        coords_string = ";".join([f"{lng},{lat}" for lng, lat in all_coordinates])
        
        # Mapbox Optimization API endpoint
        url = f"{self.base_url}/optimized-trips/v1/mapbox/driving/{coords_string}"
        
        params = {
            'access_token': self.access_token,
            'overview': 'full',  # Include full route geometry
            'geometries': 'geojson',  # Return as GeoJSON
            'steps': 'true',  # Include turn-by-turn directions
            'annotations': 'duration,distance'  # Include timing and distance
        }
        
        try:
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get('code') != 'Ok':
                raise ValueError(f"Mapbox API error: {data.get('message', 'Unknown error')}")
            
            # Extract the optimized trip
            trip = data['trips'][0] if data.get('trips') else None
            if not trip:
                raise ValueError("No optimized trip returned")
            
            # Process waypoints with optimized order
            waypoints = data.get('waypoints', [])
            optimized_order = []
            
            for waypoint in waypoints:
                optimized_order.append({
                    'waypoint_index': waypoint.get('waypoint_index'),
                    'coordinate': waypoint.get('location'),
                    'name': waypoint.get('name', ''),
                })
            
            return {
                'success': True,
                'total_duration': trip.get('duration', 0),  # seconds
                'total_distance': trip.get('distance', 0),  # meters
                'geometry': trip.get('geometry'),  # GeoJSON geometry
                'legs': trip.get('legs', []),  # Individual route segments
                'optimized_order': optimized_order,
                'waypoints': waypoints
            }
            
        except requests.RequestException as e:
            return {
                'success': False,
                'error': f"Request failed: {str(e)}"
            }
        except Exception as e:
            return {
                'success': False,
                'error': f"Route optimization failed: {str(e)}"
            }
    
    def get_directions(self, start: Tuple[float, float], end: Tuple[float, float],
                      waypoints: Optional[List[Tuple[float, float]]] = None) -> Dict:
        """
        Get turn-by-turn directions between points
        
        Args:
            start: Starting coordinate (longitude, latitude)
            end: Ending coordinate (longitude, latitude)
            waypoints: Optional intermediate waypoints
        
        Returns:
            Dictionary with route directions
        """
        coordinates = [start]
        if waypoints:
            coordinates.extend(waypoints)
        coordinates.append(end)
        
        coords_string = ";".join([f"{lng},{lat}" for lng, lat in coordinates])
        
        url = f"{self.base_url}/directions/v5/mapbox/driving/{coords_string}"
        
        params = {
            'access_token': self.access_token,
            'overview': 'full',
            'geometries': 'geojson',
            'steps': 'true',
            'banner_instructions': 'true',
            'voice_instructions': 'true',
            'annotations': 'duration,distance,speed'
        }
        
        try:
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get('code') != 'Ok':
                raise ValueError(f"Mapbox API error: {data.get('message', 'Unknown error')}")
            
            route = data['routes'][0] if data.get('routes') else None
            if not route:
                raise ValueError("No route found")
            
            return {
                'success': True,
                'duration': route.get('duration', 0),
                'distance': route.get('distance', 0),
                'geometry': route.get('geometry'),
                'legs': route.get('legs', []),
                'instructions': self._extract_instructions(route)
            }
            
        except requests.RequestException as e:
            return {
                'success': False,
                'error': f"Directions request failed: {str(e)}"
            }
        except Exception as e:
            return {
                'success': False,
                'error': f"Failed to get directions: {str(e)}"
            }
    
    def geocode_address(self, address: str, proximity: Optional[Tuple[float, float]] = None) -> Dict:
        """
        Geocode an address to coordinates
        
        Args:
            address: Address string to geocode
            proximity: Optional (longitude, latitude) for proximity bias
        
        Returns:
            Dictionary with geocoding results
        """
        url = f"{self.base_url}/geocoding/v5/mapbox.places/{requests.utils.quote(address)}.json"
        
        params = {
            'access_token': self.access_token,
            'limit': 5,  # Return top 5 results
            'types': 'address,poi'  # Focus on addresses and points of interest
        }
        
        if proximity:
            params['proximity'] = f"{proximity[0]},{proximity[1]}"
        
        try:
            response = requests.get(url, params=params, timeout=15)
            response.raise_for_status()
            
            data = response.json()
            
            features = data.get('features', [])
            results = []
            
            for feature in features:
                geometry = feature.get('geometry', {})
                properties = feature.get('properties', {})
                
                results.append({
                    'address': feature.get('place_name', ''),
                    'coordinates': geometry.get('coordinates', []),  # [lng, lat]
                    'place_type': feature.get('place_type', []),
                    'relevance': feature.get('relevance', 0),
                    'context': feature.get('context', [])
                })
            
            return {
                'success': True,
                'results': results,
                'query': address
            }
            
        except requests.RequestException as e:
            return {
                'success': False,
                'error': f"Geocoding request failed: {str(e)}"
            }
        except Exception as e:
            return {
                'success': False,
                'error': f"Geocoding failed: {str(e)}"
            }
    
    def reverse_geocode(self, longitude: float, latitude: float) -> Dict:
        """
        Reverse geocode coordinates to address
        
        Args:
            longitude: Longitude coordinate
            latitude: Latitude coordinate
        
        Returns:
            Dictionary with reverse geocoding results
        """
        url = f"{self.base_url}/geocoding/v5/mapbox.places/{longitude},{latitude}.json"
        
        params = {
            'access_token': self.access_token,
            'types': 'address',
            'limit': 1
        }
        
        try:
            response = requests.get(url, params=params, timeout=15)
            response.raise_for_status()
            
            data = response.json()
            
            features = data.get('features', [])
            if features:
                feature = features[0]
                return {
                    'success': True,
                    'address': feature.get('place_name', ''),
                    'coordinates': feature.get('geometry', {}).get('coordinates', []),
                    'context': feature.get('context', [])
                }
            
            return {
                'success': False,
                'error': 'No address found for coordinates'
            }
            
        except requests.RequestException as e:
            return {
                'success': False,
                'error': f"Reverse geocoding request failed: {str(e)}"
            }
        except Exception as e:
            return {
                'success': False,
                'error': f"Reverse geocoding failed: {str(e)}"
            }
    
    def calculate_distance(self, coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
        """
        Calculate distance between two coordinates using Haversine formula
        
        Args:
            coord1: First coordinate (longitude, latitude)
            coord2: Second coordinate (longitude, latitude)
        
        Returns:
            Distance in meters
        """
        from math import radians, cos, sin, asin, sqrt
        
        lon1, lat1 = coord1
        lon2, lat2 = coord2
        
        # Convert to radians
        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
        
        # Haversine formula
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * asin(sqrt(a))
        
        # Earth radius in meters
        r = 6371000
        
        return c * r
    
    def get_isochrone(self, center: Tuple[float, float], time_minutes: int, 
                     profile: str = 'driving') -> Dict:
        """
        Get isochrone (travel time polygon) for a location
        
        Args:
            center: Center coordinate (longitude, latitude)
            time_minutes: Travel time in minutes
            profile: Travel profile ('driving', 'walking', 'cycling')
        
        Returns:
            Dictionary with isochrone data
        """
        url = f"{self.base_url}/isochrone/v1/mapbox/{profile}/{center[0]},{center[1]}"
        
        params = {
            'access_token': self.access_token,
            'contours_minutes': time_minutes,
            'polygons': 'true',
            'denoise': '1'
        }
        
        try:
            response = requests.get(url, params=params, timeout=15)
            response.raise_for_status()
            
            data = response.json()
            
            return {
                'success': True,
                'features': data.get('features', []),
                'center': center,
                'time_minutes': time_minutes,
                'profile': profile
            }
            
        except requests.RequestException as e:
            return {
                'success': False,
                'error': f"Isochrone request failed: {str(e)}"
            }
        except Exception as e:
            return {
                'success': False,
                'error': f"Failed to get isochrone: {str(e)}"
            }
    
    def _extract_instructions(self, route: Dict) -> List[Dict]:
        """
        Extract turn-by-turn instructions from route
        
        Args:
            route: Route data from Mapbox API
        
        Returns:
            List of instruction dictionaries
        """
        instructions = []
        
        for leg in route.get('legs', []):
            for step in leg.get('steps', []):
                instruction = {
                    'text': step.get('maneuver', {}).get('instruction', ''),
                    'distance': step.get('distance', 0),
                    'duration': step.get('duration', 0),
                    'type': step.get('maneuver', {}).get('type', ''),
                    'modifier': step.get('maneuver', {}).get('modifier', ''),
                    'geometry': step.get('geometry')
                }
                
                # Add voice instruction if available
                if step.get('voiceInstructions'):
                    instruction['voice'] = step['voiceInstructions'][0].get('announcement', '')
                
                instructions.append(instruction)
        
        return instructions


# Singleton instance
mapbox_service = MapboxService()