"""
Advanced Mapbox integration for DroneStrike v2.

Provides comprehensive geospatial services including geocoding, routing,
isochrone analysis, map matching, and custom map styles.
"""

import asyncio
import json
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union
from enum import Enum
from dataclasses import dataclass

import httpx
from pydantic import BaseModel, validator

from .base import HTTPIntegration, IntegrationConfig, IntegrationError, ValidationError, BatchProcessor


class MapboxProfile(Enum):
    """Mapbox routing profiles."""
    DRIVING = "driving"
    WALKING = "walking"
    CYCLING = "cycling"
    DRIVING_TRAFFIC = "driving-traffic"


class MapboxGeometry(Enum):
    """Geometry types for responses."""
    GEOJSON = "geojson"
    POLYLINE = "polyline"
    POLYLINE6 = "polyline6"


class MapboxOverview(Enum):
    """Route overview detail levels."""
    FULL = "full"
    SIMPLIFIED = "simplified"
    FALSE = "false"


class MapboxLanguage(Enum):
    """Supported languages for instructions."""
    EN = "en"
    ES = "es"
    FR = "fr"
    DE = "de"
    IT = "it"
    PT = "pt"
    RU = "ru"
    ZH = "zh"


class MapboxConfig(IntegrationConfig):
    """Mapbox-specific configuration."""
    base_url: str = "https://api.mapbox.com"
    places_url: str = "https://api.mapbox.com/geocoding/v5/mapbox.places"
    directions_url: str = "https://api.mapbox.com/directions/v5/mapbox"
    matrix_url: str = "https://api.mapbox.com/directions-matrix/v1/mapbox"
    isochrone_url: str = "https://api.mapbox.com/isochrone/v1/mapbox"
    matching_url: str = "https://api.mapbox.com/matching/v5/mapbox"
    styles_url: str = "https://api.mapbox.com/styles/v1"
    tilesets_url: str = "https://api.mapbox.com/tilesets/v1"
    
    # Rate limits (per minute)
    geocoding_limit: int = 600
    directions_limit: int = 300
    matrix_limit: int = 60
    isochrone_limit: int = 300
    
    # Default settings
    default_country: str = "us"
    default_language: str = "en"
    max_results: int = 10
    
    class Config:
        extra = "allow"


@dataclass
class Coordinate:
    """Geographic coordinate."""
    longitude: float
    latitude: float
    
    def __str__(self) -> str:
        return f"{self.longitude},{self.latitude}"
    
    @classmethod
    def from_string(cls, coord_str: str) -> 'Coordinate':
        """Create coordinate from string format 'lon,lat'."""
        lon, lat = map(float, coord_str.split(','))
        return cls(longitude=lon, latitude=lat)


class GeocodeRequest(BaseModel):
    """Geocoding request parameters."""
    query: str
    country: Optional[str] = None
    proximity: Optional[Coordinate] = None
    types: Optional[List[str]] = None
    autocomplete: bool = True
    limit: int = 5
    language: str = "en"
    bbox: Optional[List[float]] = None  # [min_lon, min_lat, max_lon, max_lat]
    
    @validator('bbox')
    def validate_bbox(cls, v):
        if v and len(v) != 4:
            raise ValueError('bbox must have exactly 4 coordinates')
        return v


class RouteRequest(BaseModel):
    """Routing request parameters."""
    coordinates: List[Coordinate]
    profile: MapboxProfile = MapboxProfile.DRIVING
    alternatives: bool = False
    geometries: MapboxGeometry = MapboxGeometry.GEOJSON
    overview: MapboxOverview = MapboxOverview.FULL
    steps: bool = False
    continue_straight: Optional[bool] = None
    waypoint_snapping: Optional[List[str]] = None
    annotations: Optional[List[str]] = None
    language: MapboxLanguage = MapboxLanguage.EN
    banner_instructions: bool = False
    voice_instructions: bool = False
    voice_units: str = "imperial"
    
    @validator('coordinates')
    def validate_coordinates(cls, v):
        if len(v) < 2:
            raise ValueError('At least 2 coordinates required')
        if len(v) > 25:
            raise ValueError('Maximum 25 coordinates allowed')
        return v


class IsochroneRequest(BaseModel):
    """Isochrone request parameters."""
    coordinate: Coordinate
    contours_minutes: Optional[List[int]] = None
    contours_meters: Optional[List[int]] = None
    profile: MapboxProfile = MapboxProfile.DRIVING
    polygons: bool = True
    denoise: float = 1.0
    generalize: float = 1.0
    
    @validator('contours_minutes', 'contours_meters')
    def validate_contours(cls, v):
        if v and len(v) > 4:
            raise ValueError('Maximum 4 contour values allowed')
        return v


class MapMatchingRequest(BaseModel):
    """Map matching request parameters."""
    coordinates: List[Coordinate]
    profile: MapboxProfile = MapboxProfile.DRIVING
    geometries: MapboxGeometry = MapboxGeometry.GEOJSON
    radiuses: Optional[List[int]] = None
    steps: bool = False
    overview: MapboxOverview = MapboxOverview.FULL
    timestamps: Optional[List[int]] = None
    annotations: Optional[List[str]] = None
    language: MapboxLanguage = MapboxLanguage.EN
    tidy: bool = False
    
    @validator('coordinates')
    def validate_coordinates(cls, v):
        if len(v) < 2:
            raise ValueError('At least 2 coordinates required')
        if len(v) > 100:
            raise ValueError('Maximum 100 coordinates allowed')
        return v


class SearchRequest(BaseModel):
    """Advanced search request parameters."""
    query: str
    proximity: Optional[Coordinate] = None
    country: Optional[str] = None
    types: Optional[List[str]] = None
    limit: int = 10
    autocomplete: bool = True
    fuzzyMatch: bool = True
    language: str = "en"
    bbox: Optional[List[float]] = None
    
    # Category filtering
    category: Optional[str] = None
    poi_categories: Optional[List[str]] = None
    
    # Address filtering
    address_only: bool = False
    postcode: Optional[str] = None
    place: Optional[str] = None
    region: Optional[str] = None


class AdvancedMapbox(HTTPIntegration):
    """
    Advanced Mapbox integration with comprehensive geospatial capabilities.
    
    Features:
    - Complete geocoding/reverse geocoding with batch processing
    - Advanced routing with multiple waypoints and optimization
    - Isochrone calculations for service areas
    - Map matching for GPS traces
    - Advanced search with categories and filters
    - Real-time traffic integration
    - Custom map styles and overlays
    - Comprehensive error handling and rate limiting
    """
    
    def __init__(self, config: MapboxConfig):
        super().__init__(config)
        self.config: MapboxConfig = config
        self.batch_processor = BatchProcessor(batch_size=25, max_workers=5)
    
    def _initialize_client(self) -> None:
        """Initialize Mapbox HTTP client."""
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(self.config.timeout),
            headers=self._get_default_headers(),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=100)
        )
    
    def _get_default_headers(self) -> Dict[str, str]:
        """Get default headers for Mapbox requests."""
        return {
            "User-Agent": "DroneStrike/2.0 Mapbox Integration",
            "Accept": "application/json"
        }
    
    async def _perform_health_check(self) -> None:
        """Perform Mapbox API health check."""
        try:
            await self.geocode("New York", limit=1)
        except Exception as e:
            raise IntegrationError(f"Mapbox health check failed: {e}")
    
    # Geocoding Services
    
    async def geocode(
        self, 
        query: str, 
        **kwargs
    ) -> Dict[str, Any]:
        """
        Forward geocoding - convert address/place to coordinates.
        
        Args:
            query: Address or place name to geocode
            **kwargs: Additional parameters (country, proximity, types, etc.)
        
        Returns:
            Geocoding response with features and coordinates
        """
        params = {
            "access_token": self.config.api_key,
            "limit": kwargs.get("limit", self.config.max_results),
            "country": kwargs.get("country", self.config.default_country),
            "language": kwargs.get("language", self.config.default_language),
            "autocomplete": str(kwargs.get("autocomplete", True)).lower()
        }
        
        # Add optional parameters
        if proximity := kwargs.get("proximity"):
            if isinstance(proximity, Coordinate):
                params["proximity"] = str(proximity)
            else:
                params["proximity"] = proximity
        
        if types := kwargs.get("types"):
            params["types"] = ",".join(types)
        
        if bbox := kwargs.get("bbox"):
            params["bbox"] = ",".join(map(str, bbox))
        
        endpoint = f"{self.config.places_url}/{query}.json"
        
        try:
            response = await self._make_request("GET", endpoint, params=params)
            return self._process_geocoding_response(response)
        except Exception as e:
            self._handle_error(e, f"geocoding query: {query}")
    
    async def reverse_geocode(
        self, 
        coordinate: Union[Coordinate, str], 
        **kwargs
    ) -> Dict[str, Any]:
        """
        Reverse geocoding - convert coordinates to address.
        
        Args:
            coordinate: Coordinate object or "lon,lat" string
            **kwargs: Additional parameters
        
        Returns:
            Reverse geocoding response with address information
        """
        if isinstance(coordinate, str):
            coordinate = Coordinate.from_string(coordinate)
        
        params = {
            "access_token": self.config.api_key,
            "limit": kwargs.get("limit", self.config.max_results),
            "language": kwargs.get("language", self.config.default_language)
        }
        
        if types := kwargs.get("types"):
            params["types"] = ",".join(types)
        
        endpoint = f"{self.config.places_url}/{coordinate}.json"
        
        try:
            response = await self._make_request("GET", endpoint, params=params)
            return self._process_geocoding_response(response)
        except Exception as e:
            self._handle_error(e, f"reverse geocoding: {coordinate}")
    
    async def batch_geocode(
        self, 
        queries: List[str], 
        **kwargs
    ) -> List[Dict[str, Any]]:
        """
        Batch geocoding for multiple addresses.
        
        Args:
            queries: List of addresses to geocode
            **kwargs: Additional parameters
        
        Returns:
            List of geocoding responses
        """
        async def geocode_single(query: str) -> Dict[str, Any]:
            try:
                return await self.geocode(query, **kwargs)
            except Exception as e:
                return {"error": str(e), "query": query}
        
        return await self.batch_processor.process_batch(queries, geocode_single)
    
    def _process_geocoding_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Process and enhance geocoding response."""
        features = response.get("features", [])
        
        processed_features = []
        for feature in features:
            processed_feature = {
                "id": feature.get("id"),
                "place_name": feature.get("place_name"),
                "place_type": feature.get("place_type", []),
                "relevance": feature.get("relevance"),
                "geometry": feature.get("geometry"),
                "bbox": feature.get("bbox"),
                "center": feature.get("center"),
                "properties": feature.get("properties", {}),
                "context": feature.get("context", [])
            }
            
            # Extract structured address components
            if context := feature.get("context"):
                address_components = {}
                for item in context:
                    item_id = item.get("id", "")
                    if item_id.startswith("postcode"):
                        address_components["postcode"] = item.get("text")
                    elif item_id.startswith("place"):
                        address_components["city"] = item.get("text")
                    elif item_id.startswith("region"):
                        address_components["state"] = item.get("text")
                    elif item_id.startswith("country"):
                        address_components["country"] = item.get("text")
                
                processed_feature["address_components"] = address_components
            
            processed_features.append(processed_feature)
        
        return {
            "type": response.get("type"),
            "query": response.get("query"),
            "features": processed_features,
            "attribution": response.get("attribution")
        }
    
    # Routing Services
    
    async def get_directions(
        self, 
        coordinates: List[Union[Coordinate, str]], 
        profile: MapboxProfile = MapboxProfile.DRIVING,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Get directions between multiple points.
        
        Args:
            coordinates: List of waypoints
            profile: Routing profile (driving, walking, cycling, etc.)
            **kwargs: Additional routing parameters
        
        Returns:
            Directions response with routes and instructions
        """
        # Convert coordinates to proper format
        coord_strs = []
        for coord in coordinates:
            if isinstance(coord, Coordinate):
                coord_strs.append(str(coord))
            else:
                coord_strs.append(coord)
        
        coords_param = ";".join(coord_strs)
        
        params = {
            "access_token": self.config.api_key,
            "alternatives": str(kwargs.get("alternatives", False)).lower(),
            "geometries": kwargs.get("geometries", MapboxGeometry.GEOJSON.value),
            "overview": kwargs.get("overview", MapboxOverview.FULL.value),
            "steps": str(kwargs.get("steps", False)).lower(),
            "language": kwargs.get("language", MapboxLanguage.EN.value)
        }
        
        # Add optional parameters
        if continue_straight := kwargs.get("continue_straight"):
            params["continue_straight"] = str(continue_straight).lower()
        
        if annotations := kwargs.get("annotations"):
            params["annotations"] = ",".join(annotations)
        
        if banner_instructions := kwargs.get("banner_instructions"):
            params["banner_instructions"] = str(banner_instructions).lower()
        
        if voice_instructions := kwargs.get("voice_instructions"):
            params["voice_instructions"] = str(voice_instructions).lower()
            params["voice_units"] = kwargs.get("voice_units", "imperial")
        
        if waypoint_snapping := kwargs.get("waypoint_snapping"):
            params["snapping"] = ";".join(waypoint_snapping)
        
        endpoint = f"{self.config.directions_url}/{profile.value}/{coords_param}"
        
        try:
            response = await self._make_request("GET", endpoint, params=params)
            return self._process_directions_response(response)
        except Exception as e:
            self._handle_error(e, f"directions for {len(coordinates)} waypoints")
    
    async def get_route_matrix(
        self, 
        coordinates: List[Union[Coordinate, str]], 
        profile: MapboxProfile = MapboxProfile.DRIVING,
        sources: Optional[List[int]] = None,
        destinations: Optional[List[int]] = None,
        annotations: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Get travel time/distance matrix between points.
        
        Args:
            coordinates: List of coordinates
            profile: Routing profile
            sources: Indices of source points (default: all)
            destinations: Indices of destination points (default: all)
            annotations: What to include (duration, distance, speed)
        
        Returns:
            Matrix response with durations and distances
        """
        # Convert coordinates
        coord_strs = []
        for coord in coordinates:
            if isinstance(coord, Coordinate):
                coord_strs.append(str(coord))
            else:
                coord_strs.append(coord)
        
        coords_param = ";".join(coord_strs)
        
        params = {
            "access_token": self.config.api_key,
            "annotations": ",".join(annotations or ["duration", "distance"])
        }
        
        if sources:
            params["sources"] = ";".join(map(str, sources))
        
        if destinations:
            params["destinations"] = ";".join(map(str, destinations))
        
        endpoint = f"{self.config.matrix_url}/{profile.value}/{coords_param}"
        
        try:
            response = await self._make_request("GET", endpoint, params=params)
            return self._process_matrix_response(response)
        except Exception as e:
            self._handle_error(e, f"route matrix for {len(coordinates)} points")
    
    async def optimize_route(
        self, 
        coordinates: List[Union[Coordinate, str]], 
        profile: MapboxProfile = MapboxProfile.DRIVING,
        source: str = "first",
        destination: str = "last",
        roundtrip: bool = True,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Optimize route for multiple waypoints (Traveling Salesperson Problem).
        
        Args:
            coordinates: List of waypoints to optimize
            profile: Routing profile
            source: Starting point ("first", "last", "any", or coordinate index)
            destination: Ending point ("first", "last", "any", or coordinate index)
            roundtrip: Whether to return to start
            **kwargs: Additional parameters
        
        Returns:
            Optimized route response
        """
        # Convert coordinates
        coord_strs = []
        for coord in coordinates:
            if isinstance(coord, Coordinate):
                coord_strs.append(str(coord))
            else:
                coord_strs.append(coord)
        
        coords_param = ";".join(coord_strs)
        
        params = {
            "access_token": self.config.api_key,
            "source": source,
            "destination": destination,
            "roundtrip": str(roundtrip).lower(),
            "geometries": kwargs.get("geometries", MapboxGeometry.GEOJSON.value),
            "overview": kwargs.get("overview", MapboxOverview.FULL.value),
            "steps": str(kwargs.get("steps", False)).lower()
        }
        
        endpoint = f"{self.config.base_url}/optimized-trips/v1/mapbox/{profile.value}/{coords_param}"
        
        try:
            response = await self._make_request("GET", endpoint, params=params)
            return self._process_optimization_response(response)
        except Exception as e:
            self._handle_error(e, f"route optimization for {len(coordinates)} points")
    
    def _process_directions_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Process and enhance directions response."""
        routes = response.get("routes", [])
        
        processed_routes = []
        for route in routes:
            processed_route = {
                "geometry": route.get("geometry"),
                "legs": route.get("legs", []),
                "distance": route.get("distance"),  # meters
                "duration": route.get("duration"),  # seconds
                "weight": route.get("weight"),
                "weight_name": route.get("weight_name"),
                "voice_locale": route.get("voice_locale")
            }
            
            # Add enhanced metrics
            if processed_route["duration"]:
                hours = processed_route["duration"] / 3600
                processed_route["duration_formatted"] = f"{int(hours)}h {int((hours % 1) * 60)}m"
            
            if processed_route["distance"]:
                km = processed_route["distance"] / 1000
                miles = km * 0.621371
                processed_route["distance_km"] = round(km, 2)
                processed_route["distance_miles"] = round(miles, 2)
            
            processed_routes.append(processed_route)
        
        return {
            "code": response.get("code"),
            "routes": processed_routes,
            "waypoints": response.get("waypoints", []),
            "uuid": response.get("uuid")
        }
    
    def _process_matrix_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Process matrix response with enhanced metrics."""
        durations = response.get("durations", [])
        distances = response.get("distances", [])
        
        # Add enhanced formatting
        enhanced_response = {
            "code": response.get("code"),
            "durations": durations,
            "distances": distances,
            "sources": response.get("sources", []),
            "destinations": response.get("destinations", [])
        }
        
        # Add formatted versions
        if durations:
            formatted_durations = []
            for row in durations:
                formatted_row = []
                for duration in row:
                    if duration is not None:
                        hours = duration / 3600
                        formatted_row.append(f"{int(hours)}h {int((hours % 1) * 60)}m")
                    else:
                        formatted_row.append(None)
                formatted_durations.append(formatted_row)
            enhanced_response["durations_formatted"] = formatted_durations
        
        if distances:
            distances_km = []
            distances_miles = []
            for row in distances:
                km_row = []
                miles_row = []
                for distance in row:
                    if distance is not None:
                        km = distance / 1000
                        miles = km * 0.621371
                        km_row.append(round(km, 2))
                        miles_row.append(round(miles, 2))
                    else:
                        km_row.append(None)
                        miles_row.append(None)
                distances_km.append(km_row)
                distances_miles.append(miles_row)
            
            enhanced_response["distances_km"] = distances_km
            enhanced_response["distances_miles"] = distances_miles
        
        return enhanced_response
    
    def _process_optimization_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Process route optimization response."""
        trips = response.get("trips", [])
        
        processed_trips = []
        for trip in trips:
            processed_trip = {
                "geometry": trip.get("geometry"),
                "legs": trip.get("legs", []),
                "distance": trip.get("distance"),
                "duration": trip.get("duration"),
                "weight": trip.get("weight"),
                "weight_name": trip.get("weight_name")
            }
            
            # Add waypoint order
            waypoints = response.get("waypoints", [])
            if waypoints:
                processed_trip["waypoint_order"] = [wp.get("waypoint_index") for wp in waypoints]
                processed_trip["optimized_coordinates"] = [
                    [wp.get("location")[0], wp.get("location")[1]] for wp in waypoints
                ]
            
            processed_trips.append(processed_trip)
        
        return {
            "code": response.get("code"),
            "trips": processed_trips,
            "waypoints": response.get("waypoints", [])
        }
    
    # Isochrone Services
    
    async def get_isochrone(
        self, 
        coordinate: Union[Coordinate, str], 
        profile: MapboxProfile = MapboxProfile.DRIVING,
        contours_minutes: Optional[List[int]] = None,
        contours_meters: Optional[List[int]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate isochrone (service area) polygons.
        
        Args:
            coordinate: Center point for isochrone
            profile: Transportation mode
            contours_minutes: Time-based contours (minutes)
            contours_meters: Distance-based contours (meters)
            **kwargs: Additional parameters
        
        Returns:
            Isochrone response with polygons
        """
        if isinstance(coordinate, str):
            coordinate = Coordinate.from_string(coordinate)
        
        params = {
            "access_token": self.config.api_key,
            "polygons": str(kwargs.get("polygons", True)).lower(),
            "denoise": kwargs.get("denoise", 1.0),
            "generalize": kwargs.get("generalize", 1.0)
        }
        
        if contours_minutes:
            params["contours_minutes"] = ",".join(map(str, contours_minutes))
        elif contours_meters:
            params["contours_meters"] = ",".join(map(str, contours_meters))
        else:
            params["contours_minutes"] = "5,10,15"  # Default
        
        endpoint = f"{self.config.isochrone_url}/{profile.value}/{coordinate}"
        
        try:
            response = await self._make_request("GET", endpoint, params=params)
            return self._process_isochrone_response(response)
        except Exception as e:
            self._handle_error(e, f"isochrone for {coordinate}")
    
    def _process_isochrone_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Process isochrone response with area calculations."""
        features = response.get("features", [])
        
        processed_features = []
        for feature in features:
            processed_feature = {
                "type": feature.get("type"),
                "geometry": feature.get("geometry"),
                "properties": feature.get("properties", {})
            }
            
            # Calculate area if polygon
            if (
                feature.get("geometry", {}).get("type") == "Polygon" and 
                "coordinates" in feature.get("geometry", {})
            ):
                coords = feature["geometry"]["coordinates"][0]  # Outer ring
                area_sq_meters = self._calculate_polygon_area(coords)
                area_sq_km = area_sq_meters / 1_000_000
                area_sq_miles = area_sq_km * 0.386102
                
                processed_feature["properties"]["area_sq_meters"] = area_sq_meters
                processed_feature["properties"]["area_sq_km"] = round(area_sq_km, 2)
                processed_feature["properties"]["area_sq_miles"] = round(area_sq_miles, 2)
            
            processed_features.append(processed_feature)
        
        return {
            "type": response.get("type"),
            "features": processed_features
        }
    
    def _calculate_polygon_area(self, coordinates: List[List[float]]) -> float:
        """Calculate polygon area using Shoelace formula (approximate)."""
        if len(coordinates) < 3:
            return 0
        
        area = 0
        n = len(coordinates)
        
        for i in range(n):
            j = (i + 1) % n
            area += coordinates[i][0] * coordinates[j][1]
            area -= coordinates[j][0] * coordinates[i][1]
        
        return abs(area) / 2 * 111319.9 ** 2  # Rough conversion to square meters
    
    # Map Matching Services
    
    async def match_route(
        self, 
        coordinates: List[Union[Coordinate, str]], 
        profile: MapboxProfile = MapboxProfile.DRIVING,
        timestamps: Optional[List[int]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Match GPS trace to road network.
        
        Args:
            coordinates: GPS trace points
            profile: Transportation mode
            timestamps: Unix timestamps for each point
            **kwargs: Additional parameters
        
        Returns:
            Map matching response with matched route
        """
        # Convert coordinates
        coord_strs = []
        for coord in coordinates:
            if isinstance(coord, Coordinate):
                coord_strs.append(str(coord))
            else:
                coord_strs.append(coord)
        
        coords_param = ";".join(coord_strs)
        
        params = {
            "access_token": self.config.api_key,
            "geometries": kwargs.get("geometries", MapboxGeometry.GEOJSON.value),
            "overview": kwargs.get("overview", MapboxOverview.FULL.value),
            "steps": str(kwargs.get("steps", False)).lower(),
            "tidy": str(kwargs.get("tidy", False)).lower()
        }
        
        if timestamps:
            params["timestamps"] = ";".join(map(str, timestamps))
        
        if radiuses := kwargs.get("radiuses"):
            params["radiuses"] = ";".join(map(str, radiuses))
        
        if annotations := kwargs.get("annotations"):
            params["annotations"] = ",".join(annotations)
        
        endpoint = f"{self.config.matching_url}/{profile.value}/{coords_param}"
        
        try:
            response = await self._make_request("GET", endpoint, params=params)
            return self._process_matching_response(response)
        except Exception as e:
            self._handle_error(e, f"map matching for {len(coordinates)} points")
    
    def _process_matching_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Process map matching response with confidence metrics."""
        matchings = response.get("matchings", [])
        
        processed_matchings = []
        for matching in matchings:
            processed_matching = {
                "geometry": matching.get("geometry"),
                "legs": matching.get("legs", []),
                "distance": matching.get("distance"),
                "duration": matching.get("duration"),
                "weight": matching.get("weight"),
                "weight_name": matching.get("weight_name"),
                "confidence": matching.get("confidence")
            }
            
            # Calculate matching quality metrics
            tracepoints = response.get("tracepoints", [])
            matched_points = sum(1 for tp in tracepoints if tp is not None)
            total_points = len(tracepoints)
            
            if total_points > 0:
                matching_rate = matched_points / total_points
                processed_matching["matching_rate"] = round(matching_rate, 3)
                processed_matching["matched_points"] = matched_points
                processed_matching["total_points"] = total_points
            
            processed_matchings.append(processed_matching)
        
        return {
            "code": response.get("code"),
            "matchings": processed_matchings,
            "tracepoints": response.get("tracepoints", [])
        }
    
    # Advanced Search Services
    
    async def advanced_search(
        self, 
        query: str, 
        proximity: Optional[Union[Coordinate, str]] = None,
        category: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Perform advanced place search with categories and filters.
        
        Args:
            query: Search query
            proximity: Bias search around location
            category: Place category filter
            **kwargs: Additional search parameters
        
        Returns:
            Enhanced search results
        """
        params = {
            "access_token": self.config.api_key,
            "limit": kwargs.get("limit", self.config.max_results),
            "language": kwargs.get("language", self.config.default_language),
            "autocomplete": str(kwargs.get("autocomplete", True)).lower(),
            "fuzzyMatch": str(kwargs.get("fuzzyMatch", True)).lower()
        }
        
        if proximity:
            if isinstance(proximity, Coordinate):
                params["proximity"] = str(proximity)
            else:
                params["proximity"] = proximity
        
        if category:
            params["category"] = category
        
        if poi_categories := kwargs.get("poi_categories"):
            params["poi_category"] = ",".join(poi_categories)
        
        if types := kwargs.get("types"):
            params["types"] = ",".join(types)
        
        if country := kwargs.get("country"):
            params["country"] = country
        
        if bbox := kwargs.get("bbox"):
            params["bbox"] = ",".join(map(str, bbox))
        
        # Address-specific filters
        if kwargs.get("address_only"):
            params["types"] = "address"
        
        if postcode := kwargs.get("postcode"):
            params["postcode"] = postcode
        
        if place := kwargs.get("place"):
            params["place"] = place
        
        if region := kwargs.get("region"):
            params["region"] = region
        
        endpoint = f"{self.config.places_url}/{query}.json"
        
        try:
            response = await self._make_request("GET", endpoint, params=params)
            return self._process_search_response(response, query)
        except Exception as e:
            self._handle_error(e, f"advanced search: {query}")
    
    def _process_search_response(self, response: Dict[str, Any], query: str) -> Dict[str, Any]:
        """Process search response with enhanced categorization."""
        features = response.get("features", [])
        
        # Categorize results
        categorized_results = {
            "addresses": [],
            "places": [],
            "landmarks": [],
            "regions": [],
            "postcodes": []
        }
        
        processed_features = []
        for feature in features:
            place_type = feature.get("place_type", [])
            
            processed_feature = {
                "id": feature.get("id"),
                "place_name": feature.get("place_name"),
                "place_type": place_type,
                "relevance": feature.get("relevance"),
                "geometry": feature.get("geometry"),
                "center": feature.get("center"),
                "properties": feature.get("properties", {}),
                "context": feature.get("context", []),
                "matching_text": feature.get("matching_text"),
                "matching_place_name": feature.get("matching_place_name")
            }
            
            # Enhanced properties
            properties = processed_feature["properties"]
            if "category" in properties:
                processed_feature["category"] = properties["category"]
            if "maki" in properties:
                processed_feature["icon"] = properties["maki"]
            
            # Categorization
            if "address" in place_type:
                categorized_results["addresses"].append(processed_feature)
            elif "poi" in place_type:
                categorized_results["places"].append(processed_feature)
            elif any(t in place_type for t in ["landmark", "park"]):
                categorized_results["landmarks"].append(processed_feature)
            elif any(t in place_type for t in ["region", "district", "locality"]):
                categorized_results["regions"].append(processed_feature)
            elif "postcode" in place_type:
                categorized_results["postcodes"].append(processed_feature)
            
            processed_features.append(processed_feature)
        
        return {
            "type": response.get("type"),
            "query": query,
            "features": processed_features,
            "categorized": categorized_results,
            "attribution": response.get("attribution"),
            "total_results": len(processed_features)
        }
    
    # Traffic and Real-time Data
    
    async def get_traffic_data(
        self, 
        coordinates: List[Union[Coordinate, str]], 
        **kwargs
    ) -> Dict[str, Any]:
        """
        Get real-time traffic information for route.
        
        Args:
            coordinates: Route waypoints
            **kwargs: Additional parameters
        
        Returns:
            Traffic data for route
        """
        return await self.get_directions(
            coordinates,
            profile=MapboxProfile.DRIVING_TRAFFIC,
            annotations=["congestion", "speed"],
            **kwargs
        )
    
    # Utility Methods
    
    async def calculate_distance(
        self, 
        point1: Union[Coordinate, str], 
        point2: Union[Coordinate, str],
        unit: str = "km"
    ) -> float:
        """
        Calculate distance between two points.
        
        Args:
            point1: First coordinate
            point2: Second coordinate
            unit: Distance unit (km, miles, meters)
        
        Returns:
            Distance in specified unit
        """
        if isinstance(point1, str):
            point1 = Coordinate.from_string(point1)
        if isinstance(point2, str):
            point2 = Coordinate.from_string(point2)
        
        # Haversine formula
        import math
        
        lat1, lon1 = math.radians(point1.latitude), math.radians(point1.longitude)
        lat2, lon2 = math.radians(point2.latitude), math.radians(point2.longitude)
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = (
            math.sin(dlat / 2) ** 2 +
            math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        )
        c = 2 * math.asin(math.sqrt(a))
        
        # Earth's radius in kilometers
        r = 6371
        
        distance_km = r * c
        
        if unit == "km":
            return round(distance_km, 3)
        elif unit == "miles":
            return round(distance_km * 0.621371, 3)
        elif unit == "meters":
            return round(distance_km * 1000, 2)
        else:
            return distance_km
    
    async def get_elevation(
        self, 
        coordinates: List[Union[Coordinate, str]]
    ) -> Dict[str, Any]:
        """
        Get elevation data for coordinates.
        
        Args:
            coordinates: Points to get elevation for
        
        Returns:
            Elevation data response
        """
        # Convert coordinates
        coord_strs = []
        for coord in coordinates:
            if isinstance(coord, Coordinate):
                coord_strs.append(str(coord))
            else:
                coord_strs.append(coord)
        
        coords_param = ";".join(coord_strs)
        
        params = {
            "access_token": self.config.api_key
        }
        
        endpoint = f"{self.config.base_url}/tilequery/v1/mapbox.mapbox-terrain-v2/tilequery/{coords_param}.json"
        
        try:
            response = await self._make_request("GET", endpoint, params=params)
            return self._process_elevation_response(response)
        except Exception as e:
            self._handle_error(e, f"elevation for {len(coordinates)} points")
    
    def _process_elevation_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Process elevation response."""
        features = response.get("features", [])
        
        elevations = []
        for feature in features:
            properties = feature.get("properties", {})
            elevations.append({
                "elevation": properties.get("ele"),
                "coordinate": feature.get("geometry", {}).get("coordinates")
            })
        
        return {
            "elevations": elevations,
            "total_points": len(elevations)
        }
    
    # Analytics and Reporting
    
    async def get_usage_stats(self) -> Dict[str, Any]:
        """Get integration usage statistics."""
        base_stats = await self.get_metrics()
        
        return {
            **base_stats,
            "integration_type": "mapbox",
            "features_used": [
                "geocoding",
                "routing",
                "isochrones",
                "map_matching",
                "search",
                "traffic"
            ],
            "api_endpoints": {
                "geocoding": self.config.places_url,
                "directions": self.config.directions_url,
                "matrix": self.config.matrix_url,
                "isochrone": self.config.isochrone_url,
                "matching": self.config.matching_url
            }
        }


# Export classes
__all__ = [
    "AdvancedMapbox",
    "MapboxConfig",
    "MapboxProfile",
    "MapboxGeometry",
    "MapboxOverview",
    "MapboxLanguage",
    "Coordinate",
    "GeocodeRequest",
    "RouteRequest",
    "IsochroneRequest",
    "MapMatchingRequest",
    "SearchRequest"
]