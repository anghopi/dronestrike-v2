"""
DroneStrike v2 Core URLs
API endpoint routing for core models
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from . import csv_views
from . import csv_import_views
from . import targets_views
from . import mission_views
from . import stripe_views
from . import tlc_views
from . import dev_views
from . import views_roles
from . import communication_views
from . import token_views
from . import filtering_views
from . import campaign_views

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

# TLC endpoints
router.register(r'tlc/clients', tlc_views.TLCClientViewSet)
router.register(r'tlc/import-jobs', tlc_views.TLCImportJobViewSet)

# Document Management endpoints
router.register(r'documents', views.DocumentViewSet)
router.register(r'documents/folders', views.DocumentFolderViewSet)
router.register(r'documents/templates', views.DocumentTemplateViewSet)

# The API URLs are now determined automatically by the router
urlpatterns = [
    path('api/', include(router.urls)),
    path('api/upload/csv/', views.CSVUploadView.as_view(), name='csv_upload'),
    path('api/tlc/upload/csv/', tlc_views.TLCCSVUploadView.as_view(), name='tlc_csv_upload'),
    
    # CSV-based endpoints for development (using real Tarrant County data)
    path('api/csv/dashboard/', csv_views.CSVDashboardView.as_view(), name='csv_dashboard'),
    path('api/csv/properties/', csv_views.CSVPropertiesView.as_view(), name='csv_properties'),
    path('api/csv/leads/', csv_views.CSVLeadsView.as_view(), name='csv_leads'),
    path('api/csv/opportunities/', csv_views.CSVOpportunitiesView.as_view(), name='csv_opportunities'),
    path('api/csv/missions/', csv_views.CSVMissionsView.as_view(), name='csv_missions'),
    
    # General CSV Import System endpoints
    path('api/csv/upload/', csv_import_views.upload_csv_file_api, name='csv_upload'),
    path('api/csv/analyze/', csv_import_views.analyze_csv_structure_api, name='csv_analyze'),
    path('api/csv/import/', csv_import_views.import_csv_api, name='csv_import'),
    path('api/csv/templates/', csv_import_views.csv_template_api, name='csv_templates'),
    path('api/csv/validate/', csv_import_views.validate_csv_data_api, name='csv_validate'),
    path('api/csv/import-history/', csv_import_views.import_history_api, name='csv_import_history'),
    path('api/csv/import-stats/', csv_import_views.import_stats_api, name='csv_import_stats'),
    
    # Targets API endpoints (like old DroneStrike system)
    path('api/targets/', targets_views.targets_api, name='targets_list'),
    path('api/targets/<int:target_id>/', targets_views.target_detail_api, name='target_detail'),
    path('api/targets/actions/', targets_views.target_actions_api, name='target_actions'),
    path('api/targets/<int:target_id>/history/', targets_views.target_history_api, name='target_history'),
    
    # Role-based API endpoints (matching original Node.js system)
    path('api/user/profile/', views_roles.user_profile_api, name='user_profile'),
    path('api/user/leads/', views_roles.leads_api, name='role_leads'),
    path('api/user/missions/', views_roles.missions_api, name='role_missions'),
    path('api/user/missions/create/', views_roles.create_mission_api, name='create_mission'),
    path('api/user/missions/<int:mission_id>/accept/', views_roles.accept_mission_api, name='accept_mission'),
    path('api/user/analytics/', views_roles.user_analytics_api, name='user_analytics'),
    path('api/user/tokens/', views_roles.token_balance_api, name='user_tokens'),
    path('api/admin/roles/', views_roles.available_roles_api, name='available_roles'),
    
    # Communication system endpoints (matching original Node.js system)
    path('api/communications/', communication_views.communications_list_api, name='communications_list'),
    path('api/communications/send/', communication_views.send_communication_api, name='send_communication'),
    path('api/communications/templates/', communication_views.communication_templates_api, name='communication_templates'),
    path('api/communications/templates/create/', communication_views.create_template_api, name='create_template'),
    path('api/communications/campaigns/', communication_views.campaigns_list_api, name='campaigns_list'),
    path('api/communications/campaigns/create/', communication_views.create_campaign_api, name='create_campaign'),
    path('api/communications/analytics/', communication_views.communication_analytics_api, name='communication_analytics'),
    path('api/communications/token-costs/', communication_views.token_costs_api, name='token_costs'),
    path('api/leads/<int:lead_id>/communications/', communication_views.lead_communication_history_api, name='lead_communications'),
    
    # Advanced Token Management endpoints
    path('api/tokens/balance/detailed/', token_views.token_balance_detailed_api, name='token_balance_detailed'),
    path('api/tokens/transactions/', token_views.token_transactions_api, name='token_transactions'),
    path('api/tokens/packages/available/', token_views.token_packages_api, name='token_packages_available'),
    path('api/tokens/estimate-cost/', token_views.estimate_token_cost_api, name='estimate_token_cost'),
    path('api/tokens/consume/', token_views.consume_tokens_api, name='consume_tokens'),
    path('api/tokens/add/', token_views.add_tokens_api, name='add_tokens'),
    path('api/tokens/refund/', token_views.refund_tokens_api, name='refund_tokens'),
    path('api/tokens/analytics/', token_views.token_analytics_api, name='token_analytics'),
    path('api/tokens/action-costs/', token_views.action_costs_api, name='action_costs'),
    path('api/tokens/property-lookup/', token_views.property_lookup_api, name='property_lookup'),
    
    # Advanced Filtering System endpoints
    path('api/search/advanced/', filtering_views.advanced_search_api, name='advanced_search'),
    path('api/search/presets/', filtering_views.filter_presets_api, name='filter_presets'),
    path('api/search/presets/apply/', filtering_views.apply_preset_api, name='apply_preset'),
    path('api/search/saved-filters/', filtering_views.saved_filters_api, name='saved_filters'),
    path('api/search/saved-filters/save/', filtering_views.save_filter_api, name='save_filter'),
    path('api/search/saved-filters/load/', filtering_views.load_saved_filter_api, name='load_saved_filter'),
    path('api/search/saved-filters/<str:filter_name>/delete/', filtering_views.delete_saved_filter_api, name='delete_saved_filter'),
    path('api/search/filter-options/', filtering_views.filter_options_api, name='filter_options'),
    
    # Campaign Management System endpoints
    path('api/campaigns/', campaign_views.campaigns_api, name='campaigns_list'),
    path('api/campaigns/<int:campaign_id>/', campaign_views.campaign_detail_api, name='campaign_detail'),
    path('api/campaigns/<int:campaign_id>/launch/', campaign_views.launch_campaign_api, name='launch_campaign'),
    path('api/campaigns/<int:campaign_id>/pause/', campaign_views.pause_campaign_api, name='pause_campaign'),
    path('api/campaigns/<int:campaign_id>/preview/', campaign_views.preview_campaign_api, name='preview_campaign'),
    path('api/campaigns/test-audience/', campaign_views.test_audience_api, name='test_audience'),
    path('api/campaigns/templates/', campaign_views.campaign_templates_api, name='campaign_templates'),
    path('api/campaigns/analytics/', campaign_views.campaign_analytics_api, name='campaign_analytics'),
    path('api/campaigns/compare/', campaign_views.compare_campaigns_api, name='compare_campaigns'),
    path('api/campaigns/targeting-options/', campaign_views.targeting_options_api, name='targeting_options'),
    
    # Document Management System endpoints
    path('api/documents/upload/', views.document_upload_api, name='document_upload'),
    path('api/documents/bulk-upload/', views.document_bulk_upload_api, name='document_bulk_upload'),
    path('api/documents/<uuid:document_id>/download/', views.document_download_api, name='document_download'),
    path('api/documents/bulk-download/', views.document_bulk_download_api, name='document_bulk_download'),
    path('api/documents/bulk-delete/', views.document_bulk_delete_api, name='document_bulk_delete'),
    path('api/documents/<uuid:document_id>/versions/', views.document_versions_api, name='document_versions'),
    path('api/documents/<uuid:document_id>/versions/<int:version>/download/', views.document_version_download_api, name='document_version_download'),
    path('api/documents/<uuid:document_id>/versions/compare/', views.document_version_compare_api, name='document_version_compare'),
    path('api/documents/<uuid:document_id>/versions/<int:version>/revert/', views.document_version_revert_api, name='document_version_revert'),
    path('api/documents/<uuid:document_id>/duplicate/', views.document_duplicate_api, name='document_duplicate'),
    path('api/documents/<uuid:document_id>/share/', views.document_share_api, name='document_share'),
    path('api/documents/<uuid:document_id>/activity/', views.document_activity_api, name='document_activity'),
    path('api/documents/<uuid:document_id>/attachments/', views.document_attachments_api, name='document_attachments'),
    path('api/documents/<uuid:document_id>/attachments/<uuid:attachment_id>/download/', views.document_attachment_download_api, name='document_attachment_download'),
    path('api/documents/<uuid:document_id>/comments/', views.document_comments_api, name='document_comments'),
    path('api/documents/generate/', views.document_generate_api, name='document_generate'),
    path('api/documents/merge/', views.document_merge_api, name='document_merge'),
    path('api/documents/stats/', views.document_stats_api, name='document_stats'),
    path('api/documents/shared/', views.shared_documents_api, name='shared_documents'),
    
    # Stripe / Token system endpoints
    path('api/tokens/packages/', stripe_views.get_token_packages, name='token_packages'),
    path('api/tokens/balance/', stripe_views.get_user_token_balance, name='token_balance'),
    path('api/tokens/purchase/', stripe_views.create_token_purchase_intent, name='create_token_purchase'),
    path('api/tokens/subscribe/', stripe_views.create_subscription_intent, name='create_subscription'),
    path('api/tokens/history/', stripe_views.get_purchase_history, name='purchase_history'),
    path('stripe/webhook/', stripe_views.stripe_webhook, name='stripe_webhook'),
    
    # Enhanced Stripe subscription management
    path('api/subscription/status/', stripe_views.get_user_subscription, name='subscription_status'),
    path('api/subscription/cancel/', stripe_views.cancel_subscription, name='cancel_subscription'),
    path('api/subscription/reactivate/', stripe_views.reactivate_subscription, name='reactivate_subscription'),
    path('api/subscription/update-payment/', stripe_views.update_payment_method, name='update_payment_method'),
    path('api/subscription/billing-portal/', stripe_views.get_billing_portal_url, name='billing_portal'),
    
    # Development endpoints (no auth required)
    path('api/dev/tlc/clients/', dev_views.dev_tlc_clients_list, name='dev_tlc_clients'),
    path('api/dev/tlc/analytics/', dev_views.dev_tlc_analytics, name='dev_tlc_analytics'),
    path('api/dev/stripe/packages/', dev_views.dev_stripe_token_packages, name='dev_stripe_packages'),
    path('api/dev/stripe/balance/', dev_views.dev_stripe_balance, name='dev_stripe_balance'),
    path('api/dev/stripe/purchase-intent/', dev_views.dev_stripe_create_purchase_intent, name='dev_stripe_purchase'),
    path('api/dev/missions/', dev_views.dev_missions_list, name='dev_missions'),
    path('api/dev/missions/analytics/', dev_views.dev_missions_analytics, name='dev_missions_analytics'),
    path('api/dev/devices/', dev_views.dev_devices_list, name='dev_devices'),
    path('api/dev/communication/email/', dev_views.dev_send_email, name='dev_send_email'),
    path('api/dev/communication/sms/', dev_views.dev_send_sms, name='dev_send_sms'),
    path('api/dev/communication/postcard/', dev_views.dev_send_postcard, name='dev_send_postcard'),
    path('api/dev/communication/analytics/', dev_views.dev_communication_analytics, name='dev_communication_analytics'),
    path('api/dev/analytics/', dev_views.dev_comprehensive_analytics, name='dev_comprehensive_analytics'),
    path('api/dev/auth/register/', dev_views.dev_register_user, name='dev_register_user'),
    path('api/dev/auth/login/', dev_views.dev_login_user, name='dev_login_user'),
    path('api/dev/auth/analytics/', dev_views.dev_auth_analytics, name='dev_auth_analytics'),
]