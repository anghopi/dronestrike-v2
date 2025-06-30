"""
Enhanced User Role & Permission System for DroneStrike v2
Based on Laravel DroneStrike original with bitwise role flags
"""

from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import PermissionDenied
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


class UserRole:
    """
    User role constants using bitwise flags (matching Laravel original)
    Allows users to have multiple roles simultaneously
    """
    # Core field roles
    SOLDIER = 0x1              # Field agents who visit properties
    LOAN_OFFICER = 0x2         # Process loans and documentation
    MANAGER = 0x4              # Supervise operations and teams
    DISPATCHER = 0x8           # Assign missions and coordinate
    ADMIN = 0x10               # System administration
    PROCESSOR = 0x12           # Document processing specialist
    SERVICER = 0x14            # Customer service and support
    LEGAL = 0x16               # Legal affairs and compliance
    EXTERNAL_AUDITOR = 0x18    # External audit access
    INTERNAL_AUDITOR = 0x19    # Internal audit access
    OCCC = 0x20                # Regulatory compliance (OCCC)
    NMLS = 0x22                # NMLS compliance specialist
    
    # Special roles
    FIVE_STAR_GENERAL = 0x100  # Lifetime 50% discount
    BETA_INFANTRY = 0x200      # 3-month 50% discount
    
    # Role groups for easy management
    FIELD_ROLES = SOLDIER | DISPATCHER
    OFFICE_ROLES = LOAN_OFFICER | PROCESSOR | SERVICER
    MANAGEMENT_ROLES = MANAGER | ADMIN
    COMPLIANCE_ROLES = LEGAL | EXTERNAL_AUDITOR | INTERNAL_AUDITOR | OCCC | NMLS
    SPECIAL_ROLES = FIVE_STAR_GENERAL | BETA_INFANTRY
    
    # Role names for display
    ROLE_NAMES = {
        SOLDIER: 'BOTG Soldier',
        LOAN_OFFICER: 'Loan Officer',
        MANAGER: 'Manager',
        DISPATCHER: 'Dispatcher',
        ADMIN: 'Administrator',
        PROCESSOR: 'Processor',
        SERVICER: 'Servicer',
        LEGAL: 'Legal Affairs',
        EXTERNAL_AUDITOR: 'External Auditor',
        INTERNAL_AUDITOR: 'Internal Auditor',
        OCCC: 'OCCC Compliance',
        NMLS: 'NMLS Specialist',
        FIVE_STAR_GENERAL: 'Five Star General',
        BETA_INFANTRY: 'Beta Infantry'
    }
    
    @classmethod
    def get_role_name(cls, role_flag):
        """Get human-readable name for role flag"""
        return cls.ROLE_NAMES.get(role_flag, f'Unknown Role ({role_flag})')
    
    @classmethod
    def get_user_roles(cls, role_flags):
        """Get list of role names for user's role flags"""
        roles = []
        for role_flag, role_name in cls.ROLE_NAMES.items():
            if role_flags & role_flag:
                roles.append(role_name)
        return roles


class UserPermission:
    """
    Permission constants for fine-grained access control
    """
    # Mission permissions
    CAN_CREATE_MISSIONS = 'create_missions'
    CAN_ACCEPT_MISSIONS = 'accept_missions'
    CAN_DECLINE_MISSIONS = 'decline_missions'
    CAN_ASSIGN_MISSIONS = 'assign_missions'
    CAN_VIEW_ALL_MISSIONS = 'view_all_missions'
    CAN_DELETE_MISSIONS = 'delete_missions'
    
    # Lead/Property permissions
    CAN_VIEW_LEADS = 'view_leads'
    CAN_CREATE_LEADS = 'create_leads'
    CAN_EDIT_LEADS = 'edit_leads'
    CAN_DELETE_LEADS = 'delete_leads'
    CAN_EXPORT_LEADS = 'export_leads'
    CAN_IMPORT_LEADS = 'import_leads'
    
    # User management permissions
    CAN_MANAGE_USERS = 'manage_users'
    CAN_VIEW_USER_ANALYTICS = 'view_user_analytics'
    CAN_SUSPEND_USERS = 'suspend_users'
    
    # Financial permissions
    CAN_VIEW_FINANCIAL_DATA = 'view_financial_data'
    CAN_PROCESS_PAYMENTS = 'process_payments'
    CAN_VIEW_TOKEN_ANALYTICS = 'view_token_analytics'
    
    # System permissions
    CAN_ACCESS_ADMIN = 'access_admin'
    CAN_MANAGE_SETTINGS = 'manage_settings'
    CAN_VIEW_AUDIT_LOGS = 'view_audit_logs'
    
    # Role-based permission mapping
    ROLE_PERMISSIONS = {
        UserRole.SOLDIER: [
            CAN_CREATE_MISSIONS, CAN_ACCEPT_MISSIONS, CAN_DECLINE_MISSIONS,
            CAN_VIEW_LEADS, CAN_CREATE_LEADS, CAN_EDIT_LEADS
        ],
        UserRole.LOAN_OFFICER: [
            CAN_VIEW_LEADS, CAN_EDIT_LEADS, CAN_VIEW_FINANCIAL_DATA,
            CAN_PROCESS_PAYMENTS
        ],
        UserRole.MANAGER: [
            CAN_VIEW_ALL_MISSIONS, CAN_ASSIGN_MISSIONS, CAN_VIEW_LEADS,
            CAN_CREATE_LEADS, CAN_EDIT_LEADS, CAN_EXPORT_LEADS,
            CAN_VIEW_USER_ANALYTICS, CAN_VIEW_FINANCIAL_DATA,
            CAN_VIEW_TOKEN_ANALYTICS
        ],
        UserRole.DISPATCHER: [
            CAN_CREATE_MISSIONS, CAN_ASSIGN_MISSIONS, CAN_VIEW_ALL_MISSIONS,
            CAN_VIEW_LEADS, CAN_EXPORT_LEADS
        ],
        UserRole.ADMIN: [
            # All permissions
            CAN_CREATE_MISSIONS, CAN_ACCEPT_MISSIONS, CAN_DECLINE_MISSIONS,
            CAN_ASSIGN_MISSIONS, CAN_VIEW_ALL_MISSIONS, CAN_DELETE_MISSIONS,
            CAN_VIEW_LEADS, CAN_CREATE_LEADS, CAN_EDIT_LEADS, CAN_DELETE_LEADS,
            CAN_EXPORT_LEADS, CAN_IMPORT_LEADS, CAN_MANAGE_USERS,
            CAN_VIEW_USER_ANALYTICS, CAN_SUSPEND_USERS, CAN_VIEW_FINANCIAL_DATA,
            CAN_PROCESS_PAYMENTS, CAN_VIEW_TOKEN_ANALYTICS, CAN_ACCESS_ADMIN,
            CAN_MANAGE_SETTINGS, CAN_VIEW_AUDIT_LOGS
        ],
        UserRole.LEGAL: [
            CAN_VIEW_LEADS, CAN_VIEW_ALL_MISSIONS, CAN_VIEW_AUDIT_LOGS,
            CAN_VIEW_USER_ANALYTICS
        ],
        UserRole.EXTERNAL_AUDITOR: [
            CAN_VIEW_AUDIT_LOGS, CAN_VIEW_USER_ANALYTICS, CAN_VIEW_FINANCIAL_DATA
        ]
    }


class EnhancedUserProfile(models.Model):
    """
    Enhanced user profile with sophisticated role and permission system
    Based on Laravel DroneStrike original
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='enhanced_profile')
    
    # Role system using bitwise flags
    role_flags = models.IntegerField(default=UserRole.SOLDIER)
    
    # Geographic restrictions
    allowed_states = models.JSONField(default=list, blank=True)  # ['TX', 'OK']
    allowed_counties = models.JSONField(default=list, blank=True)  # County restrictions
    max_radius_miles = models.IntegerField(default=50)  # Geographic operation radius
    
    # Mission restrictions
    max_active_missions = models.IntegerField(default=1)  # Concurrent mission limit
    max_daily_missions = models.IntegerField(default=10)  # Daily mission limit
    can_create_routes = models.BooleanField(default=True)
    max_route_points = models.IntegerField(default=20)  # TomTom optimization limit
    
    # Safety and compliance
    safety_decline_count = models.IntegerField(default=0)  # Track safety declines
    is_suspended = models.BooleanField(default=False)
    suspension_reason = models.TextField(blank=True)
    suspended_until = models.DateTimeField(null=True, blank=True)
    last_safety_decline = models.DateTimeField(null=True, blank=True)
    
    # Device restrictions
    max_devices = models.IntegerField(default=3)  # Device registration limit
    require_device_registration = models.BooleanField(default=True)
    
    # Special privileges
    can_access_dangerous_properties = models.BooleanField(default=False)
    can_override_business_hours = models.BooleanField(default=False)
    can_view_competitor_data = models.BooleanField(default=False)
    
    # Timestamps and tracking
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_mission_at = models.DateTimeField(null=True, blank=True)
    last_login_device = models.CharField(max_length=100, blank=True)
    
    class Meta:
        db_table = 'enhanced_user_profiles'
        verbose_name = 'Enhanced User Profile'
        verbose_name_plural = 'Enhanced User Profiles'
    
    def __str__(self):
        return f"{self.user.username} - {self.get_primary_role_display()}"
    
    # Role management methods
    def has_role(self, role):
        """Check if user has specific role"""
        return bool(self.role_flags & role)
    
    def add_role(self, role):
        """Add role to user"""
        self.role_flags |= role
        self.save()
        logger.info(f"Added role {UserRole.get_role_name(role)} to user {self.user.username}")
    
    def remove_role(self, role):
        """Remove role from user"""
        self.role_flags &= ~role
        self.save()
        logger.info(f"Removed role {UserRole.get_role_name(role)} from user {self.user.username}")
    
    def get_roles(self):
        """Get list of user's roles"""
        return UserRole.get_user_roles(self.role_flags)
    
    def get_primary_role_display(self):
        """Get primary role for display"""
        roles = self.get_roles()
        return roles[0] if roles else 'No Role'
    
    # Permission methods
    def has_permission(self, permission):
        """Check if user has specific permission"""
        for role_flag, permissions in UserPermission.ROLE_PERMISSIONS.items():
            if self.has_role(role_flag) and permission in permissions:
                return True
        return False
    
    def get_permissions(self):
        """Get all permissions for user based on roles"""
        permissions = set()
        for role_flag, role_permissions in UserPermission.ROLE_PERMISSIONS.items():
            if self.has_role(role_flag):
                permissions.update(role_permissions)
        return list(permissions)
    
    # Business logic methods
    def can_accept_missions(self):
        """Check if user can accept new missions"""
        if self.is_suspended:
            return False, "User is suspended"
        
        if not self.has_permission(UserPermission.CAN_ACCEPT_MISSIONS):
            return False, "No permission to accept missions"
        
        # Check active mission limit
        from .models import Mission  # Avoid circular import
        active_count = Mission.objects.filter(
            user=self.user,
            status__in=[Mission.STATUS_NEW, Mission.STATUS_ACCEPTED, Mission.STATUS_ON_HOLD]
        ).count()
        
        if active_count >= self.max_active_missions:
            return False, f"Maximum active missions reached ({self.max_active_missions})"
        
        return True, "Can accept missions"
    
    def can_create_mission_in_location(self, latitude, longitude):
        """Check if user can create missions in specific location"""
        # Geographic restrictions would be implemented here
        # For now, return True
        return True, "Location allowed"
    
    def record_safety_decline(self, reason=""):
        """Record a safety decline and check for suspension"""
        self.safety_decline_count += 1
        self.last_safety_decline = timezone.now()
        
        # Auto-suspend after 3 safety declines in 30 days
        if self.safety_decline_count >= 3:
            recent_declines = (
                timezone.now() - (self.last_safety_decline or timezone.now())
            ).days <= 30
            
            if recent_declines:
                self.suspend_user(f"Auto-suspended: {self.safety_decline_count} safety declines. {reason}")
        
        self.save()
        logger.warning(f"Safety decline recorded for user {self.user.username}: {reason}")
    
    def suspend_user(self, reason, duration_days=7):
        """Suspend user for specified duration"""
        self.is_suspended = True
        self.suspension_reason = reason
        self.suspended_until = timezone.now() + timedelta(days=duration_days)
        self.save()
        
        logger.critical(f"User {self.user.username} suspended: {reason}")
    
    def unsuspend_user(self):
        """Remove user suspension"""
        self.is_suspended = False
        self.suspension_reason = ""
        self.suspended_until = None
        self.save()
        
        logger.info(f"User {self.user.username} unsuspended")
    
    def check_suspension_expiry(self):
        """Check if suspension has expired and auto-unsuspend"""
        if self.is_suspended and self.suspended_until:
            if timezone.now() >= self.suspended_until:
                self.unsuspend_user()
                return True
        return False
    
    # Analytics methods
    def get_mission_stats(self):
        """Get user's mission statistics"""
        from .models import Mission  # Avoid circular import
        
        missions = Mission.objects.filter(user=self.user)
        return {
            'total_missions': missions.count(),
            'completed_missions': missions.filter(status=Mission.STATUS_CLOSED).count(),
            'declined_missions': missions.filter(
                status__in=[Mission.STATUS_DECLINED, Mission.STATUS_DECLINED_SAFETY]
            ).count(),
            'safety_declines': self.safety_decline_count,
            'success_rate': 0  # Would calculate based on conversions
        }


class UserPermissionCheck:
    """
    Decorator and utility class for permission checking
    """
    
    @staticmethod
    def require_permission(permission):
        """Decorator to require specific permission"""
        def decorator(view_func):
            def wrapper(request, *args, **kwargs):
                if not hasattr(request.user, 'enhanced_profile'):
                    raise PermissionDenied("No user profile found")
                
                profile = request.user.enhanced_profile
                
                # Check suspension
                profile.check_suspension_expiry()
                if profile.is_suspended:
                    raise PermissionDenied("User is suspended")
                
                # Check permission
                if not profile.has_permission(permission):
                    raise PermissionDenied(f"Permission required: {permission}")
                
                return view_func(request, *args, **kwargs)
            return wrapper
        return decorator
    
    @staticmethod
    def require_role(role):
        """Decorator to require specific role"""
        def decorator(view_func):
            def wrapper(request, *args, **kwargs):
                if not hasattr(request.user, 'enhanced_profile'):
                    raise PermissionDenied("No user profile found")
                
                profile = request.user.enhanced_profile
                
                if not profile.has_role(role):
                    role_name = UserRole.get_role_name(role)
                    raise PermissionDenied(f"Role required: {role_name}")
                
                return view_func(request, *args, **kwargs)
            return wrapper
        return decorator


class UserSecurityEvent(models.Model):
    """
    Security event logging for audit trail
    """
    EVENT_TYPES = [
        ('login', 'User Login'),
        ('logout', 'User Logout'),
        ('failed_login', 'Failed Login'),
        ('permission_denied', 'Permission Denied'),
        ('role_changed', 'Role Changed'),
        ('suspended', 'User Suspended'),
        ('unsuspended', 'User Unsuspended'),
        ('safety_decline', 'Safety Decline'),
        ('mission_created', 'Mission Created'),
        ('mission_completed', 'Mission Completed'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='security_events')
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    description = models.TextField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    device_id = models.CharField(max_length=100, blank=True)
    
    # Additional context
    context_data = models.JSONField(default=dict, blank=True)
    severity = models.CharField(max_length=10, choices=[
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical')
    ], default='low')
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'user_security_events'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.event_type} - {self.created_at}"
    
    @classmethod
    def log_event(cls, user, event_type, description, request=None, severity='low', **kwargs):
        """Log a security event"""
        event_data = {
            'user': user,
            'event_type': event_type,
            'description': description,
            'severity': severity,
            'context_data': kwargs
        }
        
        if request:
            event_data.update({
                'ip_address': cls.get_client_ip(request),
                'user_agent': request.META.get('HTTP_USER_AGENT', ''),
                'device_id': request.META.get('HTTP_X_DEVICE_ID', '')
            })
        
        event = cls.objects.create(**event_data)
        logger.info(f"Security event logged: {event}")
        return event
    
    @staticmethod
    def get_client_ip(request):
        """Get client IP address from request"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip