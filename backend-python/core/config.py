"""
DroneStrike v2 FastAPI Configuration
Environment-based configuration with security defaults
"""

from typing import List, Optional, Union
from pydantic import AnyHttpUrl, EmailStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
import secrets


class Settings(BaseSettings):
    """Application settings from environment variables"""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )
    
    # Basic Application Settings
    PROJECT_NAME: str = "DroneStrike v2 API"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = False
    
    # Security
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    JWT_ALGORITHM: str = "HS256"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = [
        "http://localhost:3000",  # React development
        "http://localhost:8000",  # FastAPI development
        "https://dronestrike.app",
        "https://app.dronestrike.com"
    ]
    
    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)
    
    # Database Configuration
    DATABASE_URL: str = "sqlite:///./dronestrike_v2.db"
    
    # Redis Configuration (for caching and Celery)
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Email Configuration
    SMTP_TLS: bool = True
    SMTP_PORT: Optional[int] = None
    SMTP_HOST: Optional[str] = None
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAILS_FROM_EMAIL: Optional[EmailStr] = None
    EMAILS_FROM_NAME: Optional[str] = None
    
    # External API Keys
    STRIPE_PUBLISHABLE_KEY: str = "pk_live_9ohVxPbSmbSPGClKT0uksXFn00iU2rtutT"
    STRIPE_SECRET_KEY: str = "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"
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    
    # AWS Services
    AWS_ACCESS_KEY_ID: str = "AKIA2Q7FZWUM7ZFIC3UW"
    AWS_SECRET_ACCESS_KEY: str = "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"
    AWS_S3_BUCKET: Optional[str] = None
    AWS_REGION: str = "us-east-1"
    AWS_SES_REGION: str = "us-east-1"
    
    # Mapbox (preferred for cost and customization)
    MAPBOX_ACCESS_TOKEN: str = "sk.eyJ1IjoiZHJvbmVzdHJpa2UxIiwiYSI6ImNtYmt4bDkzaDB2bnYya3B6c3NtMDByZHkifQ.tpeux9gLlfRhXNwCQXYZZg"
    
    # Mailgun for email marketing
    MAILGUN_API_KEY: str = "fd140a8763dd073a27868d02a316bc69-5bb33252-4fd1117e"
    MAILGUN_DOMAIN: Optional[str] = None
    
    # VoIP.MS for phone calls
    VOIP_MS_BEARER_TOKEN: str = "MFJySHpPOU9VYmUxYUVOOExsbnFqNVhPa0tVOFRVdWhySnZWTU9PakFjdz0="
    
    # HIPAATIZER for document signing/HIPAA compliance
    HIPAATIZER_API_KEY: str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcGlLZXlJZCI6IjkyMWQwYjYxLWZhOTItNGU0NS04Y2E2LWU1MzE4MTc1YTkxOSIsIngtYWNjb3VudElkIjoiM2RiYmJmMmQtOWNjMS00OGMyLTljZDQtZDA0ZGM0MjdkYzg5IiwieC11c2VySWQiOiJhNzFhMjczNS04MzhlLTRmYTgtOGJjZi05Yzc4MjdkZDdmYTIiLCJpc0FkbWluIjoiZmFsc2UiLCJuYmYiOjE3NDkxNTMxNDQsImV4cCI6MTg0NjAwNzUzNiwiaWF0IjoxNzQ5MTUzMTQ0fQ.xQhupF344l1nsIfljfls3DiLtqTYInWopXdPO9ZHTLc"
    
    # Token System (from Token Values.xlsx)
    DEFAULT_TOKENS: int = 10000
    MAIL_TOKEN_COST: float = 0.80
    PROPERTY_SEARCH_TOKEN_COST: int = 25
    LEAD_ANALYSIS_TOKEN_COST: int = 50
    MARKET_RESEARCH_TOKEN_COST: int = 75
    ADVANCED_REPORT_TOKEN_COST: int = 100
    
    # Token Packages
    STARTER_PACKAGE_TOKENS: int = 500
    STARTER_PACKAGE_PRICE: float = 49.99
    PROFESSIONAL_PACKAGE_TOKENS: int = 1500
    PROFESSIONAL_PACKAGE_PRICE: float = 129.99
    ENTERPRISE_PACKAGE_TOKENS: int = 5000
    ENTERPRISE_PACKAGE_PRICE: float = 399.99
    UNLIMITED_PACKAGE_PRICE: float = 599.99
    
    # User Role Defaults
    FIVE_STAR_GENERAL_DISCOUNT: float = 0.50  # 50% off for life
    BETA_INFANTRY_DISCOUNT: float = 0.50      # 50% off first 3 months
    BETA_INFANTRY_MONTHS: int = 3
    
    # Financial Defaults 
    DEFAULT_INTEREST_RATE: float = 0.08  # 8%
    DEFAULT_TERM_MONTHS: int = 24
    DEFAULT_LTV_MAX: float = 0.75       # 75% max LTV
    
    # File Upload Settings
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_IMAGE_TYPES: List[str] = ["image/jpeg", "image/png", "image/webp"]
    ALLOWED_DOCUMENT_TYPES: List[str] = ["application/pdf", "text/plain", "application/msword"]
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    
    # Monitoring
    SENTRY_DSN: Optional[str] = None
    
    # Development Settings
    FIRST_SUPERUSER: EmailStr = "admin@dronestrike.com"
    FIRST_SUPERUSER_PASSWORD: str = "changeme"
    
    # Testing
    TESTING: bool = False


# Global settings instance
settings = Settings()