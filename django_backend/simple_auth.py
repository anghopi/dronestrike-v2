"""
Simple authentication views for testing
"""

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth import authenticate, login
import json

@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def simple_login(request):
    """Simple login endpoint for testing"""
    
    # Handle CORS preflight
    if request.method == "OPTIONS":
        response = JsonResponse({})
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return response
    
    try:
        data = json.loads(request.body)
        username = data.get('username', '')
        password = data.get('password', '')
        
        # For testing, accept any username/password
        if username and password:
            response_data = {
                'success': True,
                'token': 'test-jwt-token-12345',
                'user': {
                    'id': 1,
                    'username': username,
                    'email': f'{username}@dronestrike.com',
                    'first_name': username.title(),
                    'last_name': 'User'
                }
            }
            response = JsonResponse(response_data)
        else:
            response = JsonResponse({
                'success': False,
                'error': 'Username and password required'
            }, status=400)
            
        # Add CORS headers
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return response
        
    except Exception as e:
        response = JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)
        response["Access-Control-Allow-Origin"] = "*"
        return response

@csrf_exempt
def test_endpoint(request):
    """Test endpoint to verify backend is working"""
    response = JsonResponse({
        'message': 'DroneStrike v2 Backend is working!',
        'status': 'ok',
        'timestamp': '2024-12-18T12:00:00Z'
    })
    response["Access-Control-Allow-Origin"] = "*"
    return response