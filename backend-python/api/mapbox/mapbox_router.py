"""
Mapbox API Router for DroneStrike v2
Provides geospatial services with comprehensive functionality
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from api.dependencies import get_current_user
from core.config import settings
# Direct import to avoid integration __init__ issues
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from integrations.mapbox import AdvancedMapbox, MapboxConfig, Coordinate

router = APIRouter(prefix="/mapbox", tags=["mapbox"])

# Initialize Mapbox integration
mapbox_config = MapboxConfig(
    api_key=settings.MAPBOX_ACCESS_TOKEN,
    timeout=30.0,
    max_retries=3
)
mapbox_client = AdvancedMapbox(mapbox_config)


class GeocodeResponse(BaseModel):
    """Geocoding response model"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class RouteResponse(BaseModel):
    """Routing response model"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class SearchResponse(BaseModel):
    """Search response model"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@router.get("/health", response_model=Dict[str, Any])
async def health_check(current_user = Depends(get_current_user)):
    """Check Mapbox API health status"""
    try:
        await mapbox_client.health_check()
        return {"status": "healthy", "integration": "mapbox"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Mapbox service unavailable: {str(e)}")


@router.get("/geocode", response_model=GeocodeResponse)
async def geocode_address(
    query: str = Query(..., description="Address or place name to geocode"),
    country: Optional[str] = Query("us", description="Country code"),
    limit: Optional[int] = Query(5, description="Maximum number of results"),
    proximity: Optional[str] = Query(None, description="Proximity bias as 'lon,lat'"),
    current_user = Depends(get_current_user)
):
    """
    Forward geocoding - convert address to coordinates
    """
    try:
        kwargs = {
            "country": country,
            "limit": limit
        }
        
        if proximity:
            try:
                lon, lat = map(float, proximity.split(','))
                kwargs["proximity"] = Coordinate(longitude=lon, latitude=lat)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid proximity format. Use 'lon,lat'")
        
        result = await mapbox_client.geocode(query, **kwargs)
        
        return GeocodeResponse(success=True, data=result)
    except Exception as e:
        return GeocodeResponse(success=False, error=str(e))


@router.get("/reverse-geocode", response_model=GeocodeResponse)
async def reverse_geocode(
    lon: float = Query(..., description="Longitude"),
    lat: float = Query(..., description="Latitude"),
    limit: Optional[int] = Query(5, description="Maximum number of results"),
    current_user = Depends(get_current_user)
):
    """
    Reverse geocoding - convert coordinates to address
    """
    try:
        coordinate = Coordinate(longitude=lon, latitude=lat)
        result = await mapbox_client.reverse_geocode(coordinate, limit=limit)
        
        return GeocodeResponse(success=True, data=result)
    except Exception as e:
        return GeocodeResponse(success=False, error=str(e))


@router.post("/directions", response_model=RouteResponse)
async def get_directions(
    coordinates: List[List[float]] = Field(..., description="Array of [longitude, latitude] pairs"),
    profile: str = Field("driving", description="Routing profile: driving, walking, cycling, driving-traffic"),
    alternatives: bool = Field(False, description="Return alternative routes"),
    steps: bool = Field(False, description="Include step-by-step instructions"),
    current_user = Depends(get_current_user)
):
    """
    Get directions between multiple waypoints
    """
    try:
        if len(coordinates) < 2:
            raise HTTPException(status_code=400, detail="At least 2 coordinates required")
        
        coord_objects = [Coordinate(longitude=coord[0], latitude=coord[1]) for coord in coordinates]
        
        from integrations.mapbox import MapboxProfile
        profile_enum = MapboxProfile(profile)
        
        result = await mapbox_client.get_directions(
            coord_objects,
            profile=profile_enum,
            alternatives=alternatives,
            steps=steps
        )
        
        return RouteResponse(success=True, data=result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid profile: {profile}")
    except Exception as e:
        return RouteResponse(success=False, error=str(e))


@router.post("/isochrone", response_model=RouteResponse)
async def get_isochrone(
    longitude: float = Field(..., description="Center longitude"),
    latitude: float = Field(..., description="Center latitude"),
    contours_minutes: Optional[List[int]] = Field(None, description="Time contours in minutes"),
    contours_meters: Optional[List[int]] = Field(None, description="Distance contours in meters"),
    profile: str = Field("driving", description="Transportation profile"),
    current_user = Depends(get_current_user)
):
    """
    Generate service area isochrones
    """
    try:
        coordinate = Coordinate(longitude=longitude, latitude=latitude)
        
        from integrations.mapbox import MapboxProfile
        profile_enum = MapboxProfile(profile)
        
        kwargs = {}
        if contours_minutes:
            kwargs["contours_minutes"] = contours_minutes
        elif contours_meters:
            kwargs["contours_meters"] = contours_meters
        else:
            kwargs["contours_minutes"] = [5, 10, 15]  # Default
        
        result = await mapbox_client.get_isochrone(
            coordinate,
            profile=profile_enum,
            **kwargs
        )
        
        return RouteResponse(success=True, data=result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid profile: {profile}")
    except Exception as e:
        return RouteResponse(success=False, error=str(e))


@router.get("/search", response_model=SearchResponse)
async def advanced_search(
    query: str = Query(..., description="Search query"),
    proximity: Optional[str] = Query(None, description="Proximity bias as 'lon,lat'"),
    category: Optional[str] = Query(None, description="Place category filter"),
    limit: Optional[int] = Query(10, description="Maximum number of results"),
    country: Optional[str] = Query("us", description="Country code"),
    current_user = Depends(get_current_user)
):
    """
    Advanced place search with filtering
    """
    try:
        kwargs = {
            "limit": limit,
            "country": country
        }
        
        if proximity:
            try:
                lon, lat = map(float, proximity.split(','))
                kwargs["proximity"] = Coordinate(longitude=lon, latitude=lat)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid proximity format. Use 'lon,lat'")
        
        if category:
            kwargs["category"] = category
        
        result = await mapbox_client.advanced_search(query, **kwargs)
        
        return SearchResponse(success=True, data=result)
    except Exception as e:
        return SearchResponse(success=False, error=str(e))


@router.post("/batch-geocode", response_model=GeocodeResponse)
async def batch_geocode(
    queries: List[str] = Field(..., description="List of addresses to geocode"),
    country: Optional[str] = Field("us", description="Country code"),
    limit: Optional[int] = Field(5, description="Maximum results per query"),
    current_user = Depends(get_current_user)
):
    """
    Batch geocode multiple addresses
    """
    try:
        if len(queries) > 25:
            raise HTTPException(status_code=400, detail="Maximum 25 queries allowed per batch")
        
        result = await mapbox_client.batch_geocode(
            queries,
            country=country,
            limit=limit
        )
        
        return GeocodeResponse(success=True, data={"results": result})
    except Exception as e:
        return GeocodeResponse(success=False, error=str(e))


@router.post("/route-matrix", response_model=RouteResponse)
async def get_route_matrix(
    coordinates: List[List[float]] = Field(..., description="Array of [longitude, latitude] pairs"),
    profile: str = Field("driving", description="Routing profile"),
    sources: Optional[List[int]] = Field(None, description="Source point indices"),
    destinations: Optional[List[int]] = Field(None, description="Destination point indices"),
    current_user = Depends(get_current_user)
):
    """
    Get travel time/distance matrix between points
    """
    try:
        if len(coordinates) > 25:
            raise HTTPException(status_code=400, detail="Maximum 25 coordinates allowed")
        
        coord_objects = [Coordinate(longitude=coord[0], latitude=coord[1]) for coord in coordinates]
        
        from integrations.mapbox import MapboxProfile
        profile_enum = MapboxProfile(profile)
        
        result = await mapbox_client.get_route_matrix(
            coord_objects,
            profile=profile_enum,
            sources=sources,
            destinations=destinations
        )
        
        return RouteResponse(success=True, data=result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid profile: {profile}")
    except Exception as e:
        return RouteResponse(success=False, error=str(e))


@router.post("/optimize-route", response_model=RouteResponse)
async def optimize_route(
    coordinates: List[List[float]] = Field(..., description="Array of [longitude, latitude] pairs"),
    profile: str = Field("driving", description="Routing profile"),
    source: str = Field("first", description="Starting point: first, last, any, or index"),
    destination: str = Field("last", description="Ending point: first, last, any, or index"),
    roundtrip: bool = Field(True, description="Return to starting point"),
    current_user = Depends(get_current_user)
):
    """
    Optimize route for multiple waypoints (Traveling Salesperson Problem)
    """
    try:
        if len(coordinates) < 3:
            raise HTTPException(status_code=400, detail="At least 3 coordinates required for optimization")
        
        coord_objects = [Coordinate(longitude=coord[0], latitude=coord[1]) for coord in coordinates]
        
        from integrations.mapbox import MapboxProfile
        profile_enum = MapboxProfile(profile)
        
        result = await mapbox_client.optimize_route(
            coord_objects,
            profile=profile_enum,
            source=source,
            destination=destination,
            roundtrip=roundtrip
        )
        
        return RouteResponse(success=True, data=result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid profile: {profile}")
    except Exception as e:
        return RouteResponse(success=False, error=str(e))


@router.get("/distance", response_model=Dict[str, Any])
async def calculate_distance(
    lon1: float = Query(..., description="First point longitude"),
    lat1: float = Query(..., description="First point latitude"),
    lon2: float = Query(..., description="Second point longitude"),
    lat2: float = Query(..., description="Second point latitude"),
    unit: str = Query("km", description="Distance unit: km, miles, meters"),
    current_user = Depends(get_current_user)
):
    """
    Calculate distance between two points
    """
    try:
        point1 = Coordinate(longitude=lon1, latitude=lat1)
        point2 = Coordinate(longitude=lon2, latitude=lat2)
        
        distance = await mapbox_client.calculate_distance(point1, point2, unit)
        
        return {
            "success": True,
            "distance": distance,
            "unit": unit,
            "point1": {"longitude": lon1, "latitude": lat1},
            "point2": {"longitude": lon2, "latitude": lat2}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config", response_model=Dict[str, Any])
async def get_mapbox_config(current_user = Depends(get_current_user)):
    """
    Get Mapbox configuration for frontend
    """
    # Return public token (not the secret token)
    return {
        "mapbox_token": settings.MAPBOX_ACCESS_TOKEN,
        "default_center": [-96.7970, 32.7767],  # Dallas, TX
        "default_zoom": 11,
        "style": "mapbox://styles/mapbox/dark-v11",
        "features": [
            "geocoding",
            "routing", 
            "isochrones",
            "search",
            "optimization"
        ]
    }


@router.get("/stats", response_model=Dict[str, Any])
async def get_usage_stats(current_user = Depends(get_current_user)):
    """
    Get Mapbox integration usage statistics
    """
    try:
        stats = await mapbox_client.get_usage_stats()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))