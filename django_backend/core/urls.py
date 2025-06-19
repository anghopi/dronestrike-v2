"""
DroneStrike v2 Core URLs
API endpoint routing for core models
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from . import csv_views
from . import targets_views

# Create a router and register our viewsets with it
router = DefaultRouter()
router.register(r'companies', views.CompanyViewSet)
router.register(r'profiles', views.UserProfileViewSet)
router.register(r'counties', views.CountyViewSet)
router.register(r'properties', views.PropertyViewSet)
router.register(r'leads', views.LeadViewSet)

# The API URLs are now determined automatically by the router
urlpatterns = [
    path('api/', include(router.urls)),
    path('api/upload/csv/', views.CSVUploadView.as_view(), name='csv_upload'),
    
    # CSV-based endpoints for development (using real Tarrant County data)
    path('api/csv/dashboard/', csv_views.CSVDashboardView.as_view(), name='csv_dashboard'),
    path('api/csv/properties/', csv_views.CSVPropertiesView.as_view(), name='csv_properties'),
    path('api/csv/leads/', csv_views.CSVLeadsView.as_view(), name='csv_leads'),
    path('api/csv/opportunities/', csv_views.CSVOpportunitiesView.as_view(), name='csv_opportunities'),
    path('api/csv/missions/', csv_views.CSVMissionsView.as_view(), name='csv_missions'),
    
    # Targets API endpoints (like old DroneStrike system)
    path('api/targets/', targets_views.targets_api, name='targets_list'),
    path('api/targets/<int:target_id>/', targets_views.target_detail_api, name='target_detail'),
    path('api/targets/actions/', targets_views.target_actions_api, name='target_actions'),
    path('api/targets/<int:target_id>/history/', targets_views.target_history_api, name='target_history'),
]