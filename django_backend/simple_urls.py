"""
Simplified URLs for testing - bypasses complex imports
"""

from django.contrib import admin
from django.urls import path
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import simple_auth

@csrf_exempt
def api_login(request):
    return simple_auth.simple_login(request)

@csrf_exempt 
def api_test(request):
    return simple_auth.test_endpoint(request)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', api_test, name='test'),
    path('api/auth/login/', api_login, name='login'),
    path('api/test/', api_test, name='test_api'),
]