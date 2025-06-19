"""
Advanced integration layer for DroneStrike v2 third-party services.

Provides comprehensive integrations for payment processing, communications,
mapping, document signing, and cloud services with advanced features.
"""

from .base import (
    BaseIntegration,
    HTTPIntegration,
    IntegrationConfig,
    IntegrationError,
    ValidationError,
    AuthenticationError,
    RateLimitError,
    CircuitBreakerError,
    WebhookHandler,
    BatchProcessor,
    MetricsCollector,
    CacheManager,
    CircuitBreaker,
    RateLimiter
)

# Import abstract base classes with error handling
try:
    from .communication import CommunicationIntegration
except ImportError:
    CommunicationIntegration = None

try:
    from .payment import PaymentIntegration
except ImportError:
    PaymentIntegration = None

# Import advanced integrations
try:
    from .mapbox import (
        AdvancedMapbox,
        MapboxConfig,
        MapboxProfile,
        MapboxGeometry,
        MapboxOverview,
        MapboxLanguage,
        Coordinate,
        GeocodeRequest,
        RouteRequest,
        IsochroneRequest,
        MapMatchingRequest,
        SearchRequest
    )
except ImportError:
    AdvancedMapbox = None

try:
    from .voipms import (
        AdvancedVoipMS,
        VoipMSConfig,
        VoipMSWebhookHandler,
        VoipMSCallStatus,
        VoipMSSMSStatus,
        VoipMSCallType,
        VoipMSRecordingFormat,
        PhoneNumber,
        CallRequest,
        SMSRequest,
        CallRouting,
        VoicemailSettings,
        ConferenceSettings
    )
except ImportError:
    AdvancedVoipMS = None

try:
    from .mailgun import (
        AdvancedMailgun,
        MailgunConfig,
        MailgunWebhookHandler,
        MailgunEventType,
        MailgunSeverity,
        MailgunListAccess,
        MailgunValidationStatus,
        EmailMessage,
        EmailAttachment,
        MailingListMember,
        MailingList,
        EmailTemplate,
        ABTestSettings
    )
except ImportError:
    AdvancedMailgun = None

try:
    from .stripe import (
        AdvancedStripe,
        StripeConfig,
        StripeWebhookHandler,
        StripeEventType,
        StripeCurrency,
        StripeInterval,
        StripePaymentMethodType,
        Money,
        CustomerRequest,
        PaymentIntentRequest,
        SubscriptionRequest,
        ProductRequest,
        PriceRequest,
        InvoiceRequest,
        RefundRequest
    )
except ImportError:
    AdvancedStripe = None

try:
    from .hipaatizer import (
        AdvancedHIPAATIZER,
        HIPAATIZERConfig,
        HIPAATIZERWebhookHandler,
        DocumentStatus,
        SignerStatus,
        AuthenticationMethod,
        DocumentType,
        DocumentField,
        Signer,
        Template,
        DocumentRequest,
        BulkDocumentRequest,
        AuditTrailRequest
    )
except ImportError:
    AdvancedHIPAATIZER = None

try:
    from .aws_s3 import (
        AdvancedAWSS3,
        AWSS3Config,
        S3StorageClass,
        S3Permission,
        S3LifecycleAction,
        S3Object,
        UploadRequest,
        PresignedUrlRequest,
        LifecycleRule,
        BucketPolicy
    )
except ImportError:
    AdvancedAWSS3 = None

# Legacy imports for backward compatibility
try:
    from .payment import StripeIntegration, PayPalIntegration
except ImportError:
    StripeIntegration = PayPalIntegration = None

try:
    from .communication import TwilioIntegration, SendGridIntegration, SESIntegration, GmailIntegration
except ImportError:
    TwilioIntegration = SendGridIntegration = SESIntegration = GmailIntegration = None

try:
    from .mapping import GoogleMapsIntegration, MapboxIntegration
except ImportError:
    GoogleMapsIntegration = MapboxIntegration = None

try:
    from .documents import DocuSignIntegration, PandaDocIntegration
except ImportError:
    DocuSignIntegration = PandaDocIntegration = None

try:
    from .storage import S3Integration, GoogleCloudStorageIntegration
except ImportError:
    S3Integration = GoogleCloudStorageIntegration = None

try:
    from .analytics import GoogleAnalyticsIntegration, MixpanelIntegration
except ImportError:
    GoogleAnalyticsIntegration = MixpanelIntegration = None

__all__ = [
    # Base classes
    "BaseIntegration",
    "HTTPIntegration",
    "IntegrationConfig",
    "IntegrationError",
    "ValidationError",
    "AuthenticationError",
    "RateLimitError",
    "CircuitBreakerError",
    "WebhookHandler",
    "BatchProcessor",
    "MetricsCollector",
    "CacheManager",
    "CircuitBreaker",
    "RateLimiter",
    
    # Abstract integrations
    "CommunicationIntegration",
    "PaymentIntegration",
    
    # Advanced integrations
    "AdvancedMapbox",
    "AdvancedVoipMS", 
    "AdvancedMailgun",
    "AdvancedStripe",
    "AdvancedHIPAATIZER",
    "AdvancedAWSS3",
    
    # Advanced integration configs
    "MapboxConfig",
    "VoipMSConfig",
    "MailgunConfig",
    "StripeConfig",
    "HIPAATIZERConfig",
    "AWSS3Config",
    
    # Advanced webhook handlers
    "VoipMSWebhookHandler",
    "MailgunWebhookHandler",
    "StripeWebhookHandler",
    "HIPAATIZERWebhookHandler",
    
    # Mapbox exports
    "MapboxProfile",
    "MapboxGeometry",
    "MapboxOverview",
    "MapboxLanguage",
    "Coordinate",
    "GeocodeRequest",
    "RouteRequest",
    "IsochroneRequest",
    "MapMatchingRequest",
    "SearchRequest",
    
    # VoipMS exports
    "VoipMSCallStatus",
    "VoipMSSMSStatus",
    "VoipMSCallType",
    "VoipMSRecordingFormat",
    "PhoneNumber",
    "CallRequest",
    "SMSRequest",
    "CallRouting",
    "VoicemailSettings",
    "ConferenceSettings",
    
    # Mailgun exports
    "MailgunEventType",
    "MailgunSeverity",
    "MailgunListAccess",
    "MailgunValidationStatus",
    "EmailMessage",
    "EmailAttachment",
    "MailingListMember",
    "MailingList",
    "EmailTemplate",
    "ABTestSettings",
    
    # Stripe exports
    "StripeEventType",
    "StripeCurrency",
    "StripeInterval",
    "StripePaymentMethodType",
    "Money",
    "CustomerRequest",
    "PaymentIntentRequest",
    "SubscriptionRequest",
    "ProductRequest",
    "PriceRequest",
    "InvoiceRequest",
    "RefundRequest",
    
    # HIPAATIZER exports
    "DocumentStatus",
    "SignerStatus",
    "AuthenticationMethod",
    "DocumentType",
    "DocumentField",
    "Signer",
    "Template",
    "DocumentRequest",
    "BulkDocumentRequest",
    "AuditTrailRequest",
    
    # AWS S3 exports
    "S3StorageClass",
    "S3Permission",
    "S3LifecycleAction",
    "S3Object",
    "UploadRequest",
    "PresignedUrlRequest",
    "LifecycleRule",
    "BucketPolicy",
    
    # Legacy integrations (backward compatibility)
    "StripeIntegration",
    "PayPalIntegration",
    "TwilioIntegration",
    "SendGridIntegration",
    "SESIntegration",
    "GmailIntegration",
    "GoogleMapsIntegration",
    "MapboxIntegration",
    "DocuSignIntegration",
    "PandaDocIntegration",
    "S3Integration",
    "GoogleCloudStorageIntegration",
    "GoogleAnalyticsIntegration",
    "MixpanelIntegration",
]