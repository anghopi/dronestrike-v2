"""
Production Configuration for DroneStrike v2
Comprehensive production settings with security, performance, and monitoring configurations.
"""

import os
from typing import List, Dict, Any, Optional
from pathlib import Path

# Environment validation
def require_env(var_name: str, default: str = None) -> str:
    """Require environment variable or use default."""
    value = os.getenv(var_name, default)
    if value is None:
        raise ValueError(f"Required environment variable {var_name} is not set")
    return value

class ProductionConfig:
    """Production configuration with comprehensive settings."""
    
    # Application
    APP_NAME = "DroneStrike v2"
    VERSION = "2.0.0"
    ENVIRONMENT = "production"
    DEBUG = False
    TESTING = False
    
    # Base paths
    BASE_DIR = Path(__file__).resolve().parent.parent
    LOG_DIR = BASE_DIR / "logs"
    BACKUP_DIR = BASE_DIR / "backups"
    UPLOAD_DIR = BASE_DIR / "uploads"
    TEMP_DIR = BASE_DIR / "temp"
    KEYS_DIR = BASE_DIR / "keys"
    
    # Create directories
    for directory in [LOG_DIR, BACKUP_DIR, UPLOAD_DIR, TEMP_DIR, KEYS_DIR]:
        directory.mkdir(exist_ok=True, mode=0o755)
    
    # Security
    SECRET_KEY = require_env("SECRET_KEY")
    PASSWORD_PEPPER = require_env("PASSWORD_PEPPER")
    ENCRYPTION_KEY = require_env("ENCRYPTION_KEY")
    JWT_ALGORITHM = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS = 30
    
    # SSL/TLS
    SSL_KEYFILE = require_env("SSL_KEYFILE", None)
    SSL_CERTFILE = require_env("SSL_CERTFILE", None)
    SSL_CA_CERTS = require_env("SSL_CA_CERTS", None)
    SSL_CERT_REQS = require_env("SSL_CERT_REQS", "required")
    
    # Database
    DATABASE_HOST = require_env("DATABASE_HOST")
    DATABASE_PORT = int(require_env("DATABASE_PORT", "5432"))
    DATABASE_NAME = require_env("DATABASE_NAME")
    DATABASE_USER = require_env("DATABASE_USER")
    DATABASE_PASSWORD = require_env("DATABASE_PASSWORD")
    DATABASE_URL = f"postgresql+asyncpg://{DATABASE_USER}:{DATABASE_PASSWORD}@{DATABASE_HOST}:{DATABASE_PORT}/{DATABASE_NAME}"
    
    # Database connection pool settings
    DATABASE_POOL_SIZE = int(require_env("DATABASE_POOL_SIZE", "20"))
    DATABASE_MAX_OVERFLOW = int(require_env("DATABASE_MAX_OVERFLOW", "30"))
    DATABASE_POOL_TIMEOUT = int(require_env("DATABASE_POOL_TIMEOUT", "30"))
    DATABASE_POOL_RECYCLE = int(require_env("DATABASE_POOL_RECYCLE", "3600"))
    DATABASE_ECHO = False
    
    # Redis
    REDIS_HOST = require_env("REDIS_HOST")
    REDIS_PORT = int(require_env("REDIS_PORT", "6379"))
    REDIS_PASSWORD = require_env("REDIS_PASSWORD", None)
    REDIS_DB = int(require_env("REDIS_DB", "0"))
    REDIS_URL = f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}" if REDIS_PASSWORD else f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"
    
    # Redis connection pool
    REDIS_POOL_MAX_CONNECTIONS = int(require_env("REDIS_POOL_MAX_CONNECTIONS", "50"))
    REDIS_SOCKET_TIMEOUT = int(require_env("REDIS_SOCKET_TIMEOUT", "5"))
    REDIS_SOCKET_CONNECT_TIMEOUT = int(require_env("REDIS_SOCKET_CONNECT_TIMEOUT", "5"))
    
    # Email Configuration
    MAILGUN_API_KEY = require_env("MAILGUN_API_KEY")
    MAILGUN_DOMAIN = require_env("MAILGUN_DOMAIN")
    MAILGUN_BASE_URL = require_env("MAILGUN_BASE_URL", "https://api.mailgun.net/v3")
    EMAIL_FROM_NAME = require_env("EMAIL_FROM_NAME", APP_NAME)
    EMAIL_FROM_ADDRESS = require_env("EMAIL_FROM_ADDRESS")
    SUPPORT_EMAIL = require_env("SUPPORT_EMAIL", EMAIL_FROM_ADDRESS)
    
    # Communication Services
    VOIPMS_API_USERNAME = require_env("VOIPMS_API_USERNAME")
    VOIPMS_API_PASSWORD = require_env("VOIPMS_API_PASSWORD")
    VOIPMS_DID = require_env("VOIPMS_DID")
    
    # AWS Services
    AWS_ACCESS_KEY_ID = require_env("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY = require_env("AWS_SECRET_ACCESS_KEY")
    AWS_REGION = require_env("AWS_REGION", "us-east-1")
    AWS_S3_BUCKET = require_env("AWS_S3_BUCKET")
    AWS_CLOUDFRONT_DOMAIN = require_env("AWS_CLOUDFRONT_DOMAIN", None)
    
    # Payment Processing
    STRIPE_PUBLISHABLE_KEY = require_env("STRIPE_PUBLISHABLE_KEY")
    STRIPE_SECRET_KEY = require_env("STRIPE_SECRET_KEY")
    STRIPE_WEBHOOK_SECRET = require_env("STRIPE_WEBHOOK_SECRET")
    
    # External APIs
    MAPBOX_ACCESS_TOKEN = require_env("MAPBOX_ACCESS_TOKEN")
    HIPAATIZER_API_KEY = require_env("HIPAATIZER_API_KEY", None)
    
    # URLs
    FRONTEND_URL = require_env("FRONTEND_URL")
    BACKEND_URL = require_env("BACKEND_URL")
    API_BASE_URL = f"{BACKEND_URL}/api/v1"
    
    # CORS
    CORS_ORIGINS = [
        FRONTEND_URL,
        "https://app.dronestrike.com",
        "https://dronestrike.com"
    ]
    CORS_CREDENTIALS = True
    CORS_METHODS = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
    CORS_HEADERS = ["*"]
    
    # File Upload
    MAX_UPLOAD_SIZE = int(require_env("MAX_UPLOAD_SIZE", str(50 * 1024 * 1024)))  # 50MB
    ALLOWED_UPLOAD_EXTENSIONS = {
        'image': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
        'document': ['.pdf', '.doc', '.docx', '.txt', '.csv', '.xlsx'],
        'video': ['.mp4', '.avi', '.mov', '.wmv'],
        'audio': ['.mp3', '.wav', '.m4a']
    }
    
    # Logging
    LOG_LEVEL = require_env("LOG_LEVEL", "INFO")
    LOG_FORMAT = "json"
    LOG_ROTATION_SIZE = "100MB"
    LOG_RETENTION_DAYS = int(require_env("LOG_RETENTION_DAYS", "30"))
    STRUCTURED_LOGGING = True
    
    # Monitoring and Alerting
    METRICS_ENABLED = True
    HEALTH_CHECK_ENABLED = True
    PROMETHEUS_METRICS_PATH = "/metrics"
    
    # Sentry (Error Tracking)
    SENTRY_DSN = require_env("SENTRY_DSN", None)
    SENTRY_ENVIRONMENT = ENVIRONMENT
    SENTRY_TRACES_SAMPLE_RATE = float(require_env("SENTRY_TRACES_SAMPLE_RATE", "0.1"))
    
    # Rate Limiting
    RATE_LIMIT_ENABLED = True
    RATE_LIMIT_STORAGE_URL = REDIS_URL
    DEFAULT_RATE_LIMIT = "1000/hour"
    AUTH_RATE_LIMIT = "10/minute"
    API_RATE_LIMIT = "100/minute"
    
    # Rate limits by endpoint
    RATE_LIMITS = {
        "/api/v1/auth/login": "5/minute",
        "/api/v1/auth/register": "3/minute",
        "/api/v1/auth/reset-password": "3/minute",
        "/api/v1/leads": "50/minute",
        "/api/v1/missions": "30/minute",
        "/api/v1/communications": "20/minute",
        "/api/v1/files/upload": "10/minute",
    }
    
    # Caching
    CACHE_TYPE = "redis"
    CACHE_REDIS_URL = REDIS_URL
    CACHE_DEFAULT_TIMEOUT = 300  # 5 minutes
    CACHE_KEY_PREFIX = f"{APP_NAME}:cache:"
    
    # Cache timeouts by type
    CACHE_TIMEOUTS = {
        'user_session': 4800,      
        'api_response': 300,       # 5 minutes
        'database_query': 600,     # 10 minutes
        'file_metadata': 1800,     # 30 minutes
        'integration_data': 900,   # 15 minutes
    }
    
    # Session Management
    SESSION_TYPE = "redis"
    SESSION_REDIS = REDIS_URL
    SESSION_PERMANENT = True
    SESSION_USE_SIGNER = True
    SESSION_KEY_PREFIX = f"{APP_NAME}:session:"
    SESSION_COOKIE_NAME = "dronestrike_session"
    SESSION_COOKIE_DOMAIN = require_env("SESSION_COOKIE_DOMAIN", None)
    SESSION_COOKIE_PATH = "/"
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_SAMESITE = "Lax"
    PERMANENT_SESSION_LIFETIME = 86400 * 7  # 7 days
    
    # API Versioning
    API_VERSION = "v1"
    API_TITLE = f"{APP_NAME} API"
    API_DESCRIPTION = "Production-ready DroneStrike API with comprehensive features"
    
    # Feature Flags
    FEATURE_FLAGS = {
        'advanced_analytics': True,
        'real_time_tracking': True,
        'automated_communications': True,
        'payment_processing': True,
        'document_generation': True,
        'integration_sync': True,
        'audit_logging': True,
        'performance_monitoring': True,
        'a_b_testing': True,
        'machine_learning': True
    }
    
    # A/B Testing
    AB_TESTING_ENABLED = FEATURE_FLAGS['a_b_testing']
    AB_TESTING_SAMPLE_RATE = float(require_env("AB_TESTING_SAMPLE_RATE", "0.1"))
    
    # Background Tasks (Celery)
    CELERY_BROKER_URL = REDIS_URL
    CELERY_RESULT_BACKEND = REDIS_URL
    CELERY_TASK_SERIALIZER = "json"
    CELERY_ACCEPT_CONTENT = ["json"]
    CELERY_RESULT_SERIALIZER = "json"
    CELERY_TIMEZONE = "UTC"
    CELERY_ENABLE_UTC = True
    CELERY_WORKER_CONCURRENCY = int(require_env("CELERY_WORKER_CONCURRENCY", "4"))
    CELERY_WORKER_MAX_TASKS_PER_CHILD = int(require_env("CELERY_WORKER_MAX_TASKS_PER_CHILD", "1000"))
    CELERY_TASK_TIME_LIMIT = int(require_env("CELERY_TASK_TIME_LIMIT", "1800"))  # 30 minutes
    CELERY_TASK_SOFT_TIME_LIMIT = int(require_env("CELERY_TASK_SOFT_TIME_LIMIT", "1500"))  # 25 minutes
    
    # Performance Settings
    UVICORN_WORKERS = int(require_env("UVICORN_WORKERS", "4"))
    UVICORN_MAX_REQUESTS = int(require_env("UVICORN_MAX_REQUESTS", "1000"))
    UVICORN_MAX_REQUESTS_JITTER = int(require_env("UVICORN_MAX_REQUESTS_JITTER", "100"))
    UVICORN_TIMEOUT_KEEP_ALIVE = int(require_env("UVICORN_TIMEOUT_KEEP_ALIVE", "5"))
    
    # Security Headers
    SECURITY_HEADERS = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'Content-Security-Policy': (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https: blob:; "
            "connect-src 'self' https://api.mapbox.com https://events.mapbox.com; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        ),
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': (
            'accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), '
            'camera=(), cross-origin-isolated=(), display-capture=(), '
            'document-domain=(), encrypted-media=(), execution-while-not-rendered=(), '
            'execution-while-out-of-viewport=(), fullscreen=(), geolocation=(), '
            'gyroscope=(), keyboard-map=(), magnetometer=(), microphone=(), '
            'midi=(), navigation-override=(), payment=(), picture-in-picture=(), '
            'publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), '
            'usb=(), web-share=(), xr-spatial-tracking=()'
        )
    }
    
    # Backup Configuration
    BACKUP_ENABLED = True
    BACKUP_SCHEDULE = "0 2 * * *"  # Daily at 2 AM
    BACKUP_RETENTION_DAYS = int(require_env("BACKUP_RETENTION_DAYS", "30"))
    BACKUP_S3_BUCKET = require_env("BACKUP_S3_BUCKET", AWS_S3_BUCKET)
    BACKUP_ENCRYPTION_ENABLED = True
    
    # Data Retention
    # in days
    DATA_RETENTION_POLICIES = {
        'logs': 90,          
        'metrics': 30,        
        'user_sessions': 7,   
        'temp_files': 1,      
        'audit_logs': 365,    
        'email_logs': 90,     
        'error_logs': 180,    
    }
    
    # Webhook Configuration
    WEBHOOK_TIMEOUT = int(require_env("WEBHOOK_TIMEOUT", "30"))
    WEBHOOK_MAX_RETRIES = int(require_env("WEBHOOK_MAX_RETRIES", "3"))
    WEBHOOK_RETRY_DELAY = int(require_env("WEBHOOK_RETRY_DELAY", "60"))
    
    # Integration Sync
    INTEGRATION_SYNC_ENABLED = True
    INTEGRATION_SYNC_INTERVAL = int(require_env("INTEGRATION_SYNC_INTERVAL", "300"))  # 5 minutes
    INTEGRATION_TIMEOUT = int(require_env("INTEGRATION_TIMEOUT", "30"))
    
    # Health Check Configuration
    HEALTH_CHECK_TIMEOUT = int(require_env("HEALTH_CHECK_TIMEOUT", "30"))
    HEALTH_CHECK_INTERVAL = int(require_env("HEALTH_CHECK_INTERVAL", "60"))
    
    # Docker and Deployment
    CONTAINER_NAME = require_env("CONTAINER_NAME", "dronestrike-backend")
    HOST_PORT = int(require_env("HOST_PORT", "8000"))
    CONTAINER_PORT = int(require_env("CONTAINER_PORT", "8000"))
    
    # Kubernetes
    NAMESPACE = require_env("K8S_NAMESPACE", "dronestrike")
    REPLICA_COUNT = int(require_env("REPLICA_COUNT", "3"))
    
    # Load Balancer
    LOAD_BALANCER_HEALTH_CHECK_PATH = "/health"
    LOAD_BALANCER_HEALTH_CHECK_INTERVAL = 30
    LOAD_BALANCER_HEALTH_CHECK_TIMEOUT = 5
    
    @classmethod
    def validate_config(cls) -> List[str]:
        """Validate production configuration."""
        issues = []
        
        # Required security settings
        if not cls.SECRET_KEY or len(cls.SECRET_KEY) < 32:
            issues.append("SECRET_KEY must be at least 32 characters")
        
        if not cls.PASSWORD_PEPPER:
            issues.append("PASSWORD_PEPPER is required for production")
        
        if not cls.ENCRYPTION_KEY:
            issues.append("ENCRYPTION_KEY is required for production")
        
        # Database settings
        if not all([cls.DATABASE_HOST, cls.DATABASE_NAME, cls.DATABASE_USER, cls.DATABASE_PASSWORD]):
            issues.append("All database connection parameters are required")
        
        # External services
        if not cls.MAILGUN_API_KEY:
            issues.append("MAILGUN_API_KEY is required for email functionality")
        
        if not cls.AWS_ACCESS_KEY_ID or not cls.AWS_SECRET_ACCESS_KEY:
            issues.append("AWS credentials are required for file storage")
        
        # SSL/TLS
        if not cls.SSL_CERTFILE or not cls.SSL_KEYFILE:
            issues.append("SSL certificate and key files are required for production")
        
        # URLs
        if not cls.FRONTEND_URL.startswith('https://'):
            issues.append("FRONTEND_URL must use HTTPS in production")
        
        if not cls.BACKEND_URL.startswith('https://'):
            issues.append("BACKEND_URL must use HTTPS in production")
        
        return issues
    
    @classmethod
    def get_database_config(cls) -> Dict[str, Any]:
        """Get database configuration for SQLAlchemy."""
        return {
            'url': cls.DATABASE_URL,
            'pool_size': cls.DATABASE_POOL_SIZE,
            'max_overflow': cls.DATABASE_MAX_OVERFLOW,
            'pool_timeout': cls.DATABASE_POOL_TIMEOUT,
            'pool_recycle': cls.DATABASE_POOL_RECYCLE,
            'echo': cls.DATABASE_ECHO,
            'connect_args': {
                'server_settings': {
                    'application_name': cls.APP_NAME,
                    'jit': 'off'
                }
            }
        }
    
    @classmethod
    def get_redis_config(cls) -> Dict[str, Any]:
        """Get Redis configuration."""
        return {
            'url': cls.REDIS_URL,
            'max_connections': cls.REDIS_POOL_MAX_CONNECTIONS,
            'socket_timeout': cls.REDIS_SOCKET_TIMEOUT,
            'socket_connect_timeout': cls.REDIS_SOCKET_CONNECT_TIMEOUT,
            'health_check_interval': 30,
            'retry_on_timeout': True
        }

# Validate configuration on import
config_issues = ProductionConfig.validate_config()
if config_issues:
    raise ValueError(f"Production configuration issues: {'; '.join(config_issues)}")