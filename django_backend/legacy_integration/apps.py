from django.apps import AppConfig


class LegacyIntegrationConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'legacy_integration'
