"""
DroneStrike v2 Core URLs
API endpoint routing for core models
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from . import csv_views
from . import targets_views
from . import mission_views
from . import stripe_views

# Create a router and register our viewsets with it
router = DefaultRouter()
router.register(r'companies', views.CompanyViewSet)
router.register(r'profiles', views.UserProfileViewSet)
router.register(r'counties', views.CountyViewSet)
router.register(r'properties', views.PropertyViewSet)
router.register(r'leads', views.LeadViewSet)

# Mission endpoints (translated from Laravel)
router.register(r'missions', mission_views.MissionViewSet)
router.register(r'mission-routes', mission_views.MissionRouteViewSet)
router.register(r'devices', mission_views.DeviceViewSet)
router.register(r'decline-reasons', mission_views.MissionDeclineReasonViewSet)

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
    
    # Stripe / Token system endpoints
    path('api/tokens/packages/', stripe_views.get_token_packages, name='token_packages'),
    path('api/tokens/balance/', stripe_views.get_user_token_balance, name='token_balance'),
    path('api/tokens/purchase/', stripe_views.create_token_purchase_intent, name='create_token_purchase'),
    path('api/tokens/subscribe/', stripe_views.create_subscription_intent, name='create_subscription'),
    path('api/tokens/history/', stripe_views.get_purchase_history, name='purchase_history'),
    path('stripe/webhook/', stripe_views.stripe_webhook, name='stripe_webhook'),
]