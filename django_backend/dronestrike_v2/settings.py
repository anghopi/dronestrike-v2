"""
Django settings for DroneStrike v2 production system
Enhanced configuration for TLC/BOTG/DroneStrike integration
Translated from Laravel with Clean Architecture patterns
"""

import os
from pathlib import Path
from decouple import config, Csv
from datetime import timedelta

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = config('SECRET_KEY', default='drone-strike-super-secure-session-key-2025-django-production-ready')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = config('DEBUG', default=True, cast=bool)

ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1,0.0.0.0', cast=Csv())

# Application definition
INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'channels',
    'corsheaders',
    'django_filters',
    'django_extensions',
    
    # DroneStrike apps
    'core',  # Core models and business logic
    'api',   # API endpoints
    'legacy_integration',  # TLC/BOTG integration
    # 'communication',  # Email, SMS, calls - Disabled due to JSONField issues
    'analytics',  # Business intelligence
    'workflow',   # Mission and opportunity management
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'dronestrike_v2.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'dronestrike_v2.wsgi.application'
ASGI_APPLICATION = 'dronestrike_v2.asgi.application'

# Channel layers for WebSocket support
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer'
    }
}

# Multi-Database configuration for DroneStrike + TLC + BOTG integration
DATABASE_ENGINE = config('DATABASE_ENGINE', default='sqlite3')

if DATABASE_ENGINE == 'postgresql':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': config('POSTGRES_DB', default='dronestrike_v2'),
            'USER': config('POSTGRES_USER', default='dronestrike'),
            'PASSWORD': config('POSTGRES_PASSWORD', default='secure_password'),
            'HOST': config('POSTGRES_HOST', default='localhost'),
            'PORT': config('POSTGRES_PORT', default='5432'),
            'OPTIONS': {
                'sslmode': 'prefer',
            },
        },
        # TLC Legacy Database (MySQL)
        'tlc_legacy': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': config('TLC_MYSQL_DATABASE', default='tlc_production'),
            'USER': config('TLC_MYSQL_USER', default='root'),
            'PASSWORD': config('TLC_MYSQL_PASSWORD', default='password'),
            'HOST': config('TLC_MYSQL_HOST', default='localhost'),
            'PORT': config('TLC_MYSQL_PORT', default='3306'),
            'OPTIONS': {
                'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
                'charset': 'utf8mb4',
            },
        },
        # BOTG Legacy Database (MySQL)
        'botg_legacy': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': config('BOTG_MYSQL_DATABASE', default='botg_production'),
            'USER': config('BOTG_MYSQL_USER', default='root'),
            'PASSWORD': config('BOTG_MYSQL_PASSWORD', default='password'),
            'HOST': config('BOTG_MYSQL_HOST', default='localhost'),
            'PORT': config('BOTG_MYSQL_PORT', default='3306'),
            'OPTIONS': {
                'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
                'charset': 'utf8mb4',
            },
        }
    }
elif DATABASE_ENGINE == 'mysql':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': config('DB_NAME', default='dronestrike_v2'),
            'USER': config('DB_USER', default='root'),
            'PASSWORD': config('DB_PASSWORD', default=''),
            'HOST': config('DB_HOST', default='localhost'),
            'PORT': config('DB_PORT', default='3306'),
            'OPTIONS': {
                'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
                'charset': 'utf8mb4',
            },
        }
    }
else:  # SQLite fallback
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# Database router for multi-database setup
# DATABASE_ROUTERS = ['legacy_integration.routers.DatabaseRouter']  # Will enable when app is created

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [
    BASE_DIR / 'static',
]

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Mapbox Integration (translated from Laravel config)
MAPBOX_ACCESS_TOKEN = config('MAPBOX_ACCESS_TOKEN', default='pk.your_mapbox_token_here')

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# JWT Settings (translated from Node.js config)
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=config('JWT_ACCESS_TOKEN_LIFETIME', default=1440, cast=int)),
    'REFRESH_TOKEN_LIFETIME': timedelta(minutes=config('JWT_REFRESH_TOKEN_LIFETIME', default=10080, cast=int)),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': config('JWT_SECRET_KEY', default=SECRET_KEY),
    'VERIFYING_KEY': None,
    'AUDIENCE': None,
    'ISSUER': 'DroneStrike-v2',
    
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'USER_AUTHENTICATION_RULE': 'rest_framework_simplejwt.authentication.default_user_authentication_rule',
    
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
    'TOKEN_USER_CLASS': 'rest_framework_simplejwt.models.TokenUser',
    
    'JTI_CLAIM': 'jti',
    'SLIDING_TOKEN_REFRESH_EXP_CLAIM': 'refresh_exp',
    'SLIDING_TOKEN_LIFETIME': timedelta(hours=24),
    'SLIDING_TOKEN_REFRESH_LIFETIME': timedelta(days=7),
}

# CORS settings for React frontend
CORS_ALLOW_ALL_ORIGINS = DEBUG  # Only allow all origins in development
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS', 
    default='http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173',
    cast=Csv()
)

# REST Framework settings
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
}

# API Documentation
SPECTACULAR_SETTINGS = {
    'TITLE': 'DroneStrike v2 API',
    'DESCRIPTION': 'Real Estate Investment CRM with TLC/BOTG Integration',
    'VERSION': '2.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

# Celery configuration for background tasks
CELERY_BROKER_URL = config('CELERY_BROKER_URL', default='redis://localhost:6379/1')
CELERY_RESULT_BACKEND = config('CELERY_RESULT_BACKEND', default='redis://localhost:6379/2')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE

# Redis configuration
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': config('REDIS_URL', default='redis://localhost:6379/0'),
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }
}

# Email configuration (from dronestrike-new working config)
EMAIL_BACKEND = config('EMAIL_BACKEND', default='django.core.mail.backends.smtp.EmailBackend')

if EMAIL_BACKEND == 'django.core.mail.backends.smtp.EmailBackend':
    EMAIL_HOST = config('EMAIL_HOST', default='smtp.gmail.com')
    EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
    EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='anghelina.opinca@gmail.com')
    EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
    EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
    DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='anghelina.opinca@gmail.com')

# External API configurations (from dronestrike-new working config)
STRIPE_SECRET_KEY = config('STRIPE_SECRET_KEY', default='')
STRIPE_PUBLISHABLE_KEY = config('STRIPE_PUBLISHABLE_KEY', default='')
STRIPE_WEBHOOK_SECRET = config('STRIPE_WEBHOOK_SECRET', default='')

# Communication APIs (from dronestrike-new working config)
MAILGUN_API_KEY = config('MAILGUN_API_KEY', default='')
MAILGUN_DOMAIN = config('MAILGUN_DOMAIN', default='')
MAILGUN_AUTHORIZED_EMAILS = config('MAILGUN_AUTHORIZED_EMAILS', default='', cast=Csv())
VOIP_BEARER_TOKEN = config('VOIP_BEARER_TOKEN', default='')

# Document services (from dronestrike-new working config)
HIPAATIZER_API = config('HIPAATIZER_API', default='')

# Mapping services (from dronestrike-new working config)
MAPBOX_TOKEN = config('MAPBOX_TOKEN', default='')

# AWS configuration (from dronestrike-new working config)
AWS_ACCESS_KEY_ID = config('AWS_ACCESS_KEY_ID', default='')
AWS_SECRET_ACCESS_KEY = config('AWS_SECRET_ACCESS_KEY', default='')
AWS_S3_BUCKET = config('AWS_S3_BUCKET', default='dronestrike-uploads')
AWS_S3_REGION = config('AWS_S3_REGION', default='us-east-2')

# Use S3 for file storage if AWS credentials are provided
if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
    AWS_STORAGE_BUCKET_NAME = AWS_S3_BUCKET
    AWS_S3_REGION_NAME = AWS_S3_REGION
    AWS_S3_FILE_OVERWRITE = False
    AWS_DEFAULT_ACL = None

# DroneStrike specific settings (translated from Laravel business logic)
DRONESTRIKE_SETTINGS = {
    # Token pricing (from Token Values.xlsx and dronestrike-new)
    'TOKEN_COSTS': {
        'sms': config('TOKEN_COST_PER_SMS', default=2, cast=int),
        'email': config('TOKEN_COST_PER_EMAIL', default=1, cast=int),
        'call': config('TOKEN_COST_PER_CALL', default=5, cast=int),
        'skip_trace': 800,  # 800 regular tokens
        'mail': 1,  # 1 mail token ($0.80)
    },
    
    # Subscription rates (from Laravel business logic)
    'SUBSCRIPTION_RATES': {
        'base_monthly': 799.00,
        'five_star_general_discount': 0.5,  # 50% off for life
        'beta_infantry_discount': 0.5,  # 50% off first 3 months
    },
    
    # Integration endpoints
    'INTEGRATION_ENDPOINTS': {
        'botg_api': config('BOTG_API_URL', default='http://localhost:3083'),
        'tlc_api': config('TLC_API_URL', default='http://localhost:3085'),
    },
    
    # Feature flags (from dronestrike-new working config)
    'FEATURES': {
        'enable_voice_commands': config('ENABLE_VOICE_COMMANDS', default=True, cast=bool),
        'enable_ai_scoring': config('ENABLE_AI_SCORING', default=True, cast=bool),
        'enable_token_system': config('ENABLE_TOKEN_SYSTEM', default=True, cast=bool),
        'enable_botg_integration': config('ENABLE_BOTG_INTEGRATION', default=True, cast=bool),
        'enable_tlc_integration': config('ENABLE_TLC_INTEGRATION', default=True, cast=bool),
        'enable_automation_testing': config('ENABLE_AUTOMATION_TESTING', default=True, cast=bool),
        'enable_email_rate_limiting': config('ENABLE_EMAIL_RATE_LIMITING', default=True, cast=bool),
        'enable_lead_scoring': config('ENABLE_LEAD_SCORING', default=True, cast=bool),
        'enable_sms_notifications': config('ENABLE_SMS_NOTIFICATIONS', default=True, cast=bool),
    },
    
    # Business logic configuration (from dronestrike-new working config)
    'BUSINESS_RULES': {
        'email_rate_limit_per_hour': config('EMAIL_RATE_LIMIT_PER_HOUR', default=50, cast=int),
        'max_automation_rules_per_user': config('MAX_AUTOMATION_RULES_PER_USER', default=25, cast=int),
        'max_import_size': config('MAX_IMPORT_SIZE', default=10000, cast=int),
        'auto_assign_botg': config('AUTO_ASSIGN_BOTG', default=False, cast=bool),
        'default_lead_score': config('DEFAULT_LEAD_SCORE', default=0, cast=int),
    },
    
    # Rate limiting (from dronestrike-new working config)
    'RATE_LIMITING': {
        'window_ms': config('RATE_LIMIT_WINDOW_MS', default=900000, cast=int),
        'max_requests': config('RATE_LIMIT_MAX_REQUESTS', default=100, cast=int),
    }
}

# Logging configuration
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'level': 'DEBUG',
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': config('LOG_LEVEL', default='INFO'),
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': config('DJANGO_LOG_LEVEL', default='INFO'),
            'propagate': False,
        },
    },
}

# Security settings for production
if not DEBUG:
    # SSL/HTTPS Security (disabled for IP-based deployment)
    SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=False, cast=bool)
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    
    # Security Headers
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_PRELOAD = True
    
    # Cookie Security (adjusted for HTTP deployment)
    SESSION_COOKIE_SECURE = False  # Set to True when using HTTPS
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    CSRF_COOKIE_SECURE = False  # Set to True when using HTTPS
    CSRF_COOKIE_HTTPONLY = True
    CSRF_COOKIE_SAMESITE = 'Lax'
    
    # Frame Protection
    X_FRAME_OPTIONS = 'DENY'
    
    # Referrer Policy
    SECURE_REFERRER_POLICY = 'same-origin'
    
    # Content Security Policy
    SECURE_CROSS_ORIGIN_OPENER_POLICY = 'same-origin-allow-popups'
    
    # Additional Security Settings
    ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='', cast=Csv())  # Must be set in production
    
    # Database Security
    DATABASES['default']['OPTIONS'] = {
        'sslmode': 'require',
    } if DATABASE_ENGINE == 'postgresql' else {}

# Additional Security Settings for all environments
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {
            'min_length': 8,
        }
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Rate Limiting for API
REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = [
    'rest_framework.throttling.AnonRateThrottle',
    'rest_framework.throttling.UserRateThrottle'
]
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {
    'anon': config('API_RATE_LIMIT_ANON', default='100/hour'),
    'user': config('API_RATE_LIMIT_USER', default='1000/hour')
}