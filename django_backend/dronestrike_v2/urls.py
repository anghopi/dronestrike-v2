"""
DroneStrike v2 URL Configuration
Main URL routing for the Django backend
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)
from core.views import UserRegistrationView, CurrentUserView

urlpatterns = [
    # Django Admin
    path('admin/', admin.site.urls),
    
    # Authentication endpoints (with API v1 prefix to match frontend)
    path('api/v1/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/v1/auth/register/', UserRegistrationView.as_view(), name='user_register'),
    path('api/v1/auth/me/', CurrentUserView.as_view(), name='current_user'),
    path('api/v1/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/v1/auth/verify/', TokenVerifyView.as_view(), name='token_verify'),
    
    # Core API endpoints
    path('', include('core.urls')),
    
    # API documentation (if we add it later)
    # path('api/docs/', include('drf_spectacular.urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
