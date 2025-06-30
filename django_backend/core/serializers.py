"""
DroneStrike v2 API Serializers
DRF serializers for core models with business logic integration
"""

from rest_framework import serializers
from django.contrib.auth.models import User
from decimal import Decimal
from .models import (
    Company, UserProfile, County, Property, Lead, 
    Mission, MissionRoute, MissionRoutePoint, MissionLog, MissionPhoto,
    Device, MissionDeclineReason,
    TLCClient, TLCClientAddress, TLCTaxInfo, TLCPropertyValuation,
    TLCLoanInfo, TLCClientNote, TLCImportJob, TLCImportError
)
from .services import FinancialCalculationService, PropertyScoringService


class CompanySerializer(serializers.ModelSerializer):
    """Company serializer"""
    employee_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Company
        fields = ['id', 'name', 'logo', 'primary_color', 'website', 'employee_count', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
    
    def get_employee_count(self, obj):
        return obj.employees.count()


class UserSerializer(serializers.ModelSerializer):
    """Basic user serializer"""
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_active', 'date_joined']
        read_only_fields = ['id', 'date_joined']


class UserProfileSerializer(serializers.ModelSerializer):
    """UserProfile serializer with computed fields"""
    user = UserSerializer(read_only=True)
    company = CompanySerializer(read_only=True)
    monthly_rate = serializers.SerializerMethodField()
    is_premium_user = serializers.SerializerMethodField()
    
    class Meta:
        model = UserProfile
        fields = [
            'id', 'user', 'company', 'company_name', 'logo_url', 'color_scheme', 'role',
            'tokens', 'mail_tokens', 'stripe_customer_id', 'stripe_subscription_id',
            'subscription_plan', 'monthly_subscription_active', 'subscription_start_date',
            'beta_months_remaining', 'onboarding_completed', 'last_activity',
            'voice_commands_enabled', 'voice_wake_term', 'preferences',
            'monthly_rate', 'is_premium_user', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'monthly_rate', 'is_premium_user']
    
    def get_monthly_rate(self, obj):
        base_rate = Decimal('799.00')
        if obj.role == 'five_star_general':
            return float(base_rate * Decimal('0.5'))
        elif obj.role == 'beta_infantry' and obj.beta_months_remaining > 0:
            return float(base_rate * Decimal('0.5'))
        return float(base_rate)
    
    def get_is_premium_user(self, obj):
        return obj.monthly_subscription_active or obj.role in ['five_star_general', 'beta_infantry']


class CountySerializer(serializers.ModelSerializer):
    """County serializer"""
    property_count = serializers.SerializerMethodField()
    
    class Meta:
        model = County
        fields = [
            'id', 'name', 'state', 'fips_code', 'tax_sale_date', 
            'redemption_period_months', 'interest_rate', 'property_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_property_count(self, obj):
        return obj.properties.count()


class PropertySerializer(serializers.ModelSerializer):
    """Property serializer with financial calculations"""
    county = CountySerializer(read_only=True)
    county_id = serializers.IntegerField(write_only=True)
    full_address = serializers.SerializerMethodField()
    property_score = serializers.SerializerMethodField()
    max_loan_amount = serializers.SerializerMethodField()
    ltv_45_percent = serializers.SerializerMethodField()
    
    class Meta:
        model = Property
        fields = [
            'id', 'county', 'county_id', 'address1', 'address2', 'city', 'state', 'zip_code',
            'original_address1', 'original_city', 'original_state', 'original_zip', 'address1_corrected',
            'latitude', 'longitude', 'place_id', 'improvement_value', 'land_value', 'total_value',
            'market_value', 'property_type', 'disposition', 'square_feet', 'bedrooms', 'bathrooms',
            'year_built', 'lot_size', 'account_number', 'tax_url', 'cad_url', 'ple_property_id',
            'ple_amount_due', 'ple_amount_tax', 'ple_lawsuit_no', 'ple_date', 'ple_rate', 'ple_apr',
            'existing_tax_loan', 'existing_tax_loan_amount', 'existing_tax_loan_lender',
            'in_foreclosure', 'last_known_lawsuit_date', 'last_known_lawsuit_no',
            'last_payment', 'last_payment_date', 'last_payer', 'term', 'description',
            'street', 'exemptions', 'notes', 'is_active',
            'full_address', 'property_score', 'max_loan_amount', 'ltv_45_percent',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'total_value']
    
    def get_full_address(self, obj):
        parts = [obj.address1]
        if obj.address2:
            parts.append(obj.address2)
        parts.append(f"{obj.city}, {obj.state} {obj.zip_code}")
        return ', '.join(parts)
    
    def get_property_score(self, obj):
        scoring_service = PropertyScoringService()
        score_data = scoring_service.calculate_property_score(obj)
        return score_data
    
    def get_max_loan_amount(self, obj):
        financial_service = FinancialCalculationService()
        market_value = obj.market_value or obj.total_value
        max_loan = financial_service.calculate_max_loan_amount(market_value)
        return float(max_loan)
    
    def get_ltv_45_percent(self, obj):
        """Calculate what loan amount would be 45% LTV"""
        market_value = obj.market_value or obj.total_value
        return float(market_value * Decimal('0.45'))


class LeadSerializer(serializers.ModelSerializer):
    """Lead serializer with workflow management"""
    owner = UserSerializer(read_only=True)
    property = PropertySerializer(read_only=True)
    property_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    full_name = serializers.SerializerMethodField()
    formatted_zip = serializers.SerializerMethodField()
    full_mailing_address = serializers.SerializerMethodField()
    workflow_status = serializers.SerializerMethodField()
    
    class Meta:
        model = Lead
        fields = [
            'id', 'owner', 'property', 'property_id', 'first_name', 'last_name', 'owner_type',
            'email', 'phone_cell', 'phone_other', 'birth_date', 'mailing_address_1',
            'mailing_address_2', 'mailing_street', 'mailing_city', 'mailing_state',
            'mailing_zip5', 'mailing_zip4', 'mailing_place_id', 'mailing_address_1_corrected',
            'is_bad_address', 'geocoding', 'do_not_email', 'do_not_email_added', 'do_not_mail',
            'email_added', 'email_added_date', 'returned_postcard', 'returned_postcard_date',
            'returned_postcard_reason', 'is_business', 'is_dangerous', 'safety_concerns_notes',
            'safety_concern_types', 'en', 'es', 'has_mortgage', 'monthly_income',
            'lead_status', 'last_contact', 'notes', 'latitude', 'longitude', 'score_value',
            'scored_at', 'workflow_stage', 'botg_mission_id', 'tlc_loan_id', 'tlc_borrower_id',
            'sent_to_botg', 'botg_response_received', 'sent_to_tlc', 'tlc_loan_created',
            'source_batch', 'imported_from', 'full_name', 'formatted_zip', 'full_mailing_address',
            'workflow_status', 'created_at', 'updated_at', 'botg_assigned_at', 'botg_completed_at',
            'tlc_sent_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()
    
    def get_formatted_zip(self, obj):
        zip_code = obj.mailing_zip5
        if obj.mailing_zip4:
            zip_code += f"-{obj.mailing_zip4}"
        return zip_code
    
    def get_full_mailing_address(self, obj):
        parts = [obj.mailing_address_1]
        if obj.mailing_address_2:
            parts.append(obj.mailing_address_2)
        parts.append(f"{obj.mailing_city}, {obj.mailing_state} {self.get_formatted_zip(obj)}")
        return ', '.join(parts)
    
    def get_workflow_status(self, obj):
        """Get human-readable workflow status with progress"""
        stage_progress = {
            'lead_identified': {'step': 1, 'total': 8, 'description': 'Lead Identified'},
            'botg_assigned': {'step': 2, 'total': 8, 'description': 'BOTG Mission Assigned'},
            'botg_in_progress': {'step': 3, 'total': 8, 'description': 'BOTG Mission In Progress'},
            'botg_completed': {'step': 4, 'total': 8, 'description': 'BOTG Assessment Complete'},
            'opportunity_created': {'step': 5, 'total': 8, 'description': 'Opportunity Created'},
            'tlc_loan_originated': {'step': 6, 'total': 8, 'description': 'TLC Loan Originated'},
            'tlc_client_onboarded': {'step': 7, 'total': 8, 'description': 'TLC Client Onboarded'},
            'loan_servicing': {'step': 8, 'total': 8, 'description': 'TLC Loan Servicing'},
        }
        
        progress = stage_progress.get(obj.workflow_stage, {
            'step': 1, 'total': 8, 'description': 'Unknown Stage'
        })
        
        return {
            'current_stage': obj.workflow_stage,
            'step': progress['step'],
            'total_steps': progress['total'],
            'description': progress['description'],
            'progress_percentage': round((progress['step'] / progress['total']) * 100, 1)
        }


class LeadCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating leads"""
    class Meta:
        model = Lead
        fields = [
            'first_name', 'last_name', 'owner_type', 'email', 'phone_cell', 'phone_other',
            'birth_date', 'mailing_address_1', 'mailing_address_2', 'mailing_city',
            'mailing_state', 'mailing_zip5', 'mailing_zip4', 'property_id', 'notes',
            'source_batch', 'imported_from'
        ]
    
    def create(self, validated_data):
        # Set the owner to the current user
        validated_data['owner'] = self.context['request'].user
        return super().create(validated_data)


class LoanCalculationSerializer(serializers.Serializer):
    """Serializer for loan calculation requests"""
    property_id = serializers.IntegerField()
    loan_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    interest_rate = serializers.DecimalField(max_digits=5, decimal_places=4, default=Decimal('0.08'))
    term_months = serializers.IntegerField(default=24)
    
    def validate_loan_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Loan amount must be positive")
        return value
    
    def validate_term_months(self, value):
        if value <= 0 or value > 360:
            raise serializers.ValidationError("Term must be between 1 and 360 months")
        return value


class TokenTransactionSerializer(serializers.Serializer):
    """Serializer for token consumption requests"""
    action_type = serializers.ChoiceField(choices=[
        ('postcard_send', 'Postcard Send'),
        ('email_send', 'Email Send'),
        ('sms_send', 'SMS Send'),
        ('phone_verification', 'Phone Verification'),
        ('address_verification', 'Address Verification'),
        ('property_lookup', 'Property Lookup'),
        ('lead_export', 'Lead Export'),
        ('api_call', 'API Call'),
    ])
    quantity = serializers.IntegerField(default=1, min_value=1)
    reference_id = serializers.CharField(required=False, allow_blank=True)


class DeviceSerializer(serializers.ModelSerializer):
    """Device serializer for mission creation"""
    class Meta:
        model = Device
        fields = ['id', 'device_id', 'device_name', 'device_type', 'push_token', 'is_active', 'last_seen', 'created_at']
        read_only_fields = ['created_at', 'last_seen']


class MissionDeclineReasonSerializer(serializers.ModelSerializer):
    """Mission decline reason serializer"""
    class Meta:
        model = MissionDeclineReason
        fields = ['id', 'reason', 'is_safety_related', 'is_active', 'display_order']


class MissionPhotoSerializer(serializers.ModelSerializer):
    """Mission photo serializer with GPS validation"""
    class Meta:
        model = MissionPhoto
        fields = ['id', 'photo', 'lat', 'lng', 'is_valid_location', 'distance_from_target', 'caption', 'created_at']
        read_only_fields = ['created_at', 'is_valid_location', 'distance_from_target']


class MissionLogSerializer(serializers.ModelSerializer):
    """Mission log serializer"""
    class Meta:
        model = MissionLog
        fields = ['id', 'lat', 'lng', 'radius', 'filters', 'amount_due_min', 'amount_due_max', 'results_count', 'created_at']
        read_only_fields = ['created_at']


class MissionRoutePointSerializer(serializers.ModelSerializer):
    """Route point serializer with prospect details"""
    prospect = LeadSerializer(read_only=True)
    prospect_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = MissionRoutePoint
        fields = [
            'id', 'prospect', 'prospect_id', 'lat', 'lng', 'provided_index', 'optimized_index',
            'length_in_meters', 'travel_time_in_seconds', 'points', 'status', 'visited_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class MissionRouteSerializer(serializers.ModelSerializer):
    """Mission route serializer with optimization data"""
    route_points = MissionRoutePointSerializer(many=True, read_only=True)
    user = UserSerializer(read_only=True)
    total_points = serializers.SerializerMethodField()
    
    class Meta:
        model = MissionRoute
        fields = [
            'id', 'user', 'status', 'optimization_url', 'is_optimized',
            'total_distance_meters', 'total_time_seconds', 'route_points', 'total_points',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_total_points(self, obj):
        return obj.route_points.count()


class MissionSerializer(serializers.ModelSerializer):
    """Mission serializer with full business logic"""
    user = UserSerializer(read_only=True)
    prospect = LeadSerializer(read_only=True)
    prospect_id = serializers.IntegerField(write_only=True)
    device = DeviceSerializer(read_only=True)
    device_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    decline_reason = MissionDeclineReasonSerializer(read_only=True)
    decline_reason_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    
    # Related data
    photos = MissionPhotoSerializer(many=True, read_only=True)
    logs = MissionLogSerializer(many=True, read_only=True)
    
    # Computed fields
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    distance_traveled = serializers.SerializerMethodField()
    can_be_declined = serializers.ReadOnlyField()
    can_be_paused = serializers.ReadOnlyField()
    is_active = serializers.ReadOnlyField()
    
    class Meta:
        model = Mission
        fields = [
            'id', 'user', 'prospect', 'prospect_id', 'device', 'device_id', 'status', 'status_display',
            'decline_reason', 'decline_reason_id', 'lat_created', 'lng_created', 'lat_completed',
            'lng_completed', 'completed_at', 'linked_with', 'link_type', 'is_ongoing', 'go_to_lead',
            'purchase_offer', 'initial_amount_due', 'photos', 'logs', 'distance_traveled',
            'can_be_declined', 'can_be_paused', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_distance_traveled(self, obj):
        return obj.get_distance_traveled()


class MissionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating missions"""
    prospect_id = serializers.IntegerField()
    device_id = serializers.IntegerField(required=False, allow_null=True)
    
    class Meta:
        model = Mission
        fields = [
            'prospect_id', 'device_id', 'lat_created', 'lng_created', 'linked_with', 'link_type',
            'go_to_lead', 'purchase_offer', 'initial_amount_due'
        ]
    
    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class MissionUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating missions"""
    class Meta:
        model = Mission
        fields = [
            'status', 'decline_reason_id', 'lat_completed', 'lng_completed', 'completed_at',
            'purchase_offer', 'initial_amount_due', 'is_ongoing'
        ]


class MissionSearchSerializer(serializers.Serializer):
    """Serializer for mission search parameters"""
    lat = serializers.DecimalField(max_digits=17, decimal_places=14)
    lng = serializers.DecimalField(max_digits=17, decimal_places=14)
    radius = serializers.IntegerField(min_value=100, max_value=50000)  # meters
    
    # Property filters
    property_type = serializers.ChoiceField(
        choices=['single_family', 'multi_family', 'condo', 'townhouse', 'commercial', 'land', 'mobile_home'],
        required=False
    )
    amount_due_min = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    amount_due_max = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    
    # Lead filters
    exclude_dangerous = serializers.BooleanField(default=True)
    exclude_business = serializers.BooleanField(default=False)
    exclude_do_not_contact = serializers.BooleanField(default=True)
    
    # Limit results
    limit = serializers.IntegerField(default=50, min_value=1, max_value=200)


class RouteOptimizationRequestSerializer(serializers.Serializer):
    """Serializer for route optimization requests"""
    prospect_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=2,
        max_length=25
    )
    start_lat = serializers.DecimalField(max_digits=17, decimal_places=14, required=False)
    start_lng = serializers.DecimalField(max_digits=17, decimal_places=14, required=False)
    
    def validate_prospect_ids(self, value):
        # Check that all prospects exist and belong to user
        user = self.context['request'].user
        from .models import Lead
        existing_prospects = Lead.objects.filter(
            id__in=value,
            owner=user
        ).values_list('id', flat=True)
        
        missing_prospects = set(value) - set(existing_prospects)
        if missing_prospects:
            raise serializers.ValidationError(
                f"Prospects not found or not owned by user: {list(missing_prospects)}"
            )
        
        return value


# TLC Serializers
# Serializers for Tax Lien Capital client management

class TLCClientAddressSerializer(serializers.ModelSerializer):
    """Serializer for TLC client addresses"""
    class Meta:
        model = TLCClientAddress
        fields = ['address_type', 'street_1', 'street_2', 'city', 'state', 'zip_code', 'county']


class TLCTaxInfoSerializer(serializers.ModelSerializer):
    """Serializer for TLC tax information"""
    class Meta:
        model = TLCTaxInfo
        fields = [
            'account_number', 'tax_year', 'original_tax_amount', 'penalties_interest',
            'attorney_fees', 'total_amount_due', 'tax_sale_date', 'lawsuit_status'
        ]


class TLCPropertyValuationSerializer(serializers.ModelSerializer):
    """Serializer for TLC property valuation"""
    class Meta:
        model = TLCPropertyValuation
        fields = [
            'assessed_land_value', 'assessed_improvement_value', 'assessed_total_value',
            'market_land_value', 'market_improvement_value', 'market_total_value',
            'estimated_purchase_price'
        ]


class TLCLoanInfoSerializer(serializers.ModelSerializer):
    """Serializer for TLC loan information"""
    class Meta:
        model = TLCLoanInfo
        fields = [
            'loan_amount', 'interest_rate', 'apr', 'term_months', 'monthly_payment',
            'total_payment', 'loan_to_value_ratio', 'status', 'application_date',
            'funding_date', 'payoff_date'
        ]


class TLCClientNoteSerializer(serializers.ModelSerializer):
    """Serializer for TLC client notes"""
    class Meta:
        model = TLCClientNote
        fields = ['id', 'content', 'note_type', 'created_by', 'created_at']
        read_only_fields = ['id', 'created_at']


class TLCClientSerializer(serializers.ModelSerializer):
    """Comprehensive TLC client serializer"""
    # Related data
    mailing_address = serializers.SerializerMethodField()
    property_address = serializers.SerializerMethodField()
    tax_info = TLCTaxInfoSerializer(read_only=True)
    property_valuation = TLCPropertyValuationSerializer(read_only=True)
    loan_info = TLCLoanInfoSerializer(read_only=True)
    notes = TLCClientNoteSerializer(many=True, read_only=True)
    
    class Meta:
        model = TLCClient
        fields = [
            'id', 'client_number', 'first_name', 'last_name', 'email',
            'phone_primary', 'phone_secondary', 'ssn_last_four', 'date_of_birth',
            'status', 'workflow_stage', 'lead_source', 'assigned_agent',
            'mailing_address', 'property_address', 'tax_info', 'property_valuation',
            'loan_info', 'notes', 'created_at', 'updated_at', 'last_contact', 'last_activity'
        ]
        read_only_fields = ['id', 'client_number', 'created_at', 'updated_at']
    
    def get_mailing_address(self, obj):
        mailing = obj.addresses.filter(address_type='mailing').first()
        return TLCClientAddressSerializer(mailing).data if mailing else None
    
    def get_property_address(self, obj):
        property_addr = obj.addresses.filter(address_type='property').first()
        return TLCClientAddressSerializer(property_addr).data if property_addr else None


class TLCClientCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating TLC clients with nested data"""
    mailing_address = TLCClientAddressSerializer()
    property_address = TLCClientAddressSerializer()
    tax_info = TLCTaxInfoSerializer()
    property_valuation = TLCPropertyValuationSerializer(required=False)
    loan_info = TLCLoanInfoSerializer(required=False)
    
    class Meta:
        model = TLCClient
        fields = [
            'first_name', 'last_name', 'email', 'phone_primary', 'phone_secondary',
            'ssn_last_four', 'date_of_birth', 'status', 'workflow_stage',
            'lead_source', 'assigned_agent', 'mailing_address', 'property_address',
            'tax_info', 'property_valuation', 'loan_info'
        ]
    
    def create(self, validated_data):
        # Extract nested data
        mailing_data = validated_data.pop('mailing_address')
        property_data = validated_data.pop('property_address')
        tax_data = validated_data.pop('tax_info')
        valuation_data = validated_data.pop('property_valuation', None)
        loan_data = validated_data.pop('loan_info', None)
        
        # Create client
        client = TLCClient.objects.create(**validated_data)
        
        # Create related records
        TLCClientAddress.objects.create(client=client, address_type='mailing', **mailing_data)
        TLCClientAddress.objects.create(client=client, address_type='property', **property_data)
        TLCTaxInfo.objects.create(client=client, **tax_data)
        
        if valuation_data:
            TLCPropertyValuation.objects.create(client=client, **valuation_data)
        
        if loan_data:
            TLCLoanInfo.objects.create(client=client, **loan_data)
        
        return client


class TLCImportErrorSerializer(serializers.ModelSerializer):
    """Serializer for TLC import errors"""
    class Meta:
        model = TLCImportError
        fields = ['row_number', 'column', 'error_message', 'raw_data']


class TLCImportJobSerializer(serializers.ModelSerializer):
    """Serializer for TLC import jobs"""
    errors = TLCImportErrorSerializer(many=True, read_only=True)
    validation_summary = serializers.SerializerMethodField()
    
    class Meta:
        model = TLCImportJob
        fields = [
            'id', 'filename', 'file_size', 'total_rows', 'processed_rows',
            'successful_rows', 'failed_rows', 'status', 'progress_percentage',
            'started_at', 'completed_at', 'created_at', 'errors', 'validation_summary'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_validation_summary(self, obj):
        return {
            'duplicate_clients': obj.duplicate_clients,
            'invalid_emails': obj.invalid_emails,
            'missing_required_fields': obj.missing_required_fields,
            'invalid_tax_amounts': obj.invalid_tax_amounts,
            'invalid_dates': obj.invalid_dates,
        }