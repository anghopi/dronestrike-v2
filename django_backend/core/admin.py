"""
DroneStrike v2 Admin Interface
Configure Django admin for core models
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from .models import Company, UserProfile, County, Property, Lead


class UserProfileInline(admin.StackedInline):
    """Inline UserProfile in Django User admin"""
    model = UserProfile
    can_delete = False
    verbose_name_plural = 'Profile'


class UserAdmin(BaseUserAdmin):
    """Extended User admin with profile"""
    inlines = (UserProfileInline,)


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    """Company admin interface"""
    list_display = ['name', 'website', 'created_at']
    search_fields = ['name']
    list_filter = ['created_at']


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    """UserProfile admin interface"""
    list_display = ['user', 'company', 'role', 'tokens', 'mail_tokens', 'monthly_subscription_active']
    list_filter = ['role', 'monthly_subscription_active', 'company']
    search_fields = ['user__username', 'user__email', 'company__name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(County)
class CountyAdmin(admin.ModelAdmin):
    """County admin interface"""
    list_display = ['name', 'state', 'fips_code', 'tax_sale_date', 'interest_rate']
    list_filter = ['state', 'tax_sale_date']
    search_fields = ['name', 'state', 'fips_code']


@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    """Property admin interface"""
    list_display = ['address1', 'city', 'state', 'property_type', 'total_value', 'ple_amount_due', 'is_active']
    list_filter = ['property_type', 'disposition', 'state', 'existing_tax_loan', 'in_foreclosure', 'is_active']
    search_fields = ['address1', 'city', 'account_number', 'ple_lawsuit_no']
    readonly_fields = ['created_at', 'updated_at', 'total_value']
    
    fieldsets = (
        ('Address Information', {
            'fields': ('county', 'address1', 'address2', 'city', 'state', 'zip_code')
        }),
        ('Property Details', {
            'fields': ('property_type', 'disposition', 'square_feet', 'bedrooms', 'bathrooms', 'year_built', 'lot_size')
        }),
        ('Financial Information', {
            'fields': ('improvement_value', 'land_value', 'total_value', 'market_value')
        }),
        ('Tax Information', {
            'fields': ('account_number', 'ple_amount_due', 'ple_amount_tax', 'ple_lawsuit_no', 'ple_date')
        }),
        ('Status', {
            'fields': ('existing_tax_loan', 'in_foreclosure', 'is_active')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    """Lead admin interface"""
    list_display = ['first_name', 'last_name', 'mailing_city', 'mailing_state', 'lead_status', 'workflow_stage', 'score_value', 'owner']
    list_filter = ['lead_status', 'workflow_stage', 'owner_type', 'mailing_state', 'owner']
    search_fields = ['first_name', 'last_name', 'email', 'mailing_city', 'phone_cell']
    readonly_fields = ['created_at', 'updated_at', 'scored_at']
    
    fieldsets = (
        ('Personal Information', {
            'fields': ('first_name', 'last_name', 'owner_type', 'email', 'phone_cell', 'birth_date')
        }),
        ('Mailing Address', {
            'fields': ('mailing_address_1', 'mailing_address_2', 'mailing_city', 'mailing_state', 'mailing_zip5', 'mailing_zip4')
        }),
        ('Lead Management', {
            'fields': ('owner', 'property', 'lead_status', 'workflow_stage', 'score_value', 'notes')
        }),
        ('Communication Preferences', {
            'fields': ('do_not_email', 'do_not_mail', 'en', 'es'),
            'classes': ('collapse',)
        }),
        ('Safety & Flags', {
            'fields': ('is_business', 'is_dangerous', 'safety_concerns_notes'),
            'classes': ('collapse',)
        }),
        ('Integration', {
            'fields': ('botg_mission_id', 'tlc_loan_id', 'sent_to_botg', 'sent_to_tlc'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'botg_assigned_at', 'tlc_sent_at'),
            'classes': ('collapse',)
        })
    )


# Re-register User admin with profile
admin.site.unregister(User)
admin.site.register(User, UserAdmin)