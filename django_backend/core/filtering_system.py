"""
Advanced Property Filtering System for DroneStrike v2
Based on the original Node.js system's sophisticated filtering capabilities
"""

import math
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
from django.db.models import Q, F, Value, DecimalField, Case, When
from django.db.models.functions import Cast, Sqrt, Power, Sin, Cos, Radians
from django.utils import timezone
from datetime import timedelta
from .models import Lead, Property, County


class PropertyFilter:
    """
    Advanced property filtering system
    Supports geographic, financial, legal, and custom criteria filtering
    """
    
    def __init__(self, queryset=None):
        """Initialize with base queryset or default to all leads"""
        self.queryset = queryset or Lead.objects.select_related('property').all()
        self.filters_applied = []
        self.sort_criteria = []
    
    def apply_geographic_filters(self, **kwargs):
        """
        Apply geographic filtering
        """
        # State filtering
        if 'states' in kwargs and kwargs['states']:
            states = kwargs['states'] if isinstance(kwargs['states'], list) else [kwargs['states']]
            self.queryset = self.queryset.filter(mailing_state__in=states)
            self.filters_applied.append(f"States: {', '.join(states)}")
        
        # County filtering
        if 'counties' in kwargs and kwargs['counties']:
            counties = kwargs['counties'] if isinstance(kwargs['counties'], list) else [kwargs['counties']]
            self.queryset = self.queryset.filter(
                Q(mailing_county__in=counties) |
                Q(property__county__name__in=counties)
            )
            self.filters_applied.append(f"Counties: {', '.join(counties)}")
        
        # City filtering
        if 'cities' in kwargs and kwargs['cities']:
            cities = kwargs['cities'] if isinstance(kwargs['cities'], list) else [kwargs['cities']]
            self.queryset = self.queryset.filter(mailing_city__in=cities)
            self.filters_applied.append(f"Cities: {', '.join(cities)}")
        
        # ZIP code filtering
        if 'zip_codes' in kwargs and kwargs['zip_codes']:
            zip_codes = kwargs['zip_codes'] if isinstance(kwargs['zip_codes'], list) else [kwargs['zip_codes']]
            self.queryset = self.queryset.filter(mailing_zip5__in=zip_codes)
            self.filters_applied.append(f"ZIP Codes: {', '.join(zip_codes)}")
        
        # Radius filtering (from center point)
        if all(k in kwargs for k in ['center_lat', 'center_lng', 'radius_miles']):
            self.queryset = self._apply_radius_filter(
                kwargs['center_lat'], 
                kwargs['center_lng'], 
                kwargs['radius_miles']
            )
            self.filters_applied.append(f"Within {kwargs['radius_miles']} miles of {kwargs['center_lat']}, {kwargs['center_lng']}")
        
        return self
    
    def apply_financial_filters(self, **kwargs):
        """
        Apply financial criteria filtering
        """
        # Property value range
        if 'min_property_value' in kwargs and kwargs['min_property_value']:
            self.queryset = self.queryset.filter(
                property__total_value__gte=Decimal(str(kwargs['min_property_value']))
            )
            self.filters_applied.append(f"Min Property Value: ${kwargs['min_property_value']:,}")
        
        if 'max_property_value' in kwargs and kwargs['max_property_value']:
            self.queryset = self.queryset.filter(
                property__total_value__lte=Decimal(str(kwargs['max_property_value']))
            )
            self.filters_applied.append(f"Max Property Value: ${kwargs['max_property_value']:,}")
        
        # Tax amount due range
        if 'min_taxes_due' in kwargs and kwargs['min_taxes_due']:
            self.queryset = self.queryset.filter(
                property__ple_amount_due__gte=Decimal(str(kwargs['min_taxes_due']))
            )
            self.filters_applied.append(f"Min Taxes Due: ${kwargs['min_taxes_due']:,}")
        
        if 'max_taxes_due' in kwargs and kwargs['max_taxes_due']:
            self.queryset = self.queryset.filter(
                property__ple_amount_due__lte=Decimal(str(kwargs['max_taxes_due']))
            )
            self.filters_applied.append(f"Max Taxes Due: ${kwargs['max_taxes_due']:,}")
        
        # Loan-to-Value ratio
        if 'max_ltv_ratio' in kwargs and kwargs['max_ltv_ratio']:
            # Calculate LTV as (taxes_due / property_value) * 100
            self.queryset = self.queryset.annotate(
                ltv_ratio=Case(
                    When(property__total_value__gt=0,
                         then=Cast(F('property__ple_amount_due') * 100 / F('property__total_value'), DecimalField(max_digits=5, decimal_places=2))),
                    default=Value(0),
                    output_field=DecimalField(max_digits=5, decimal_places=2)
                )
            ).filter(ltv_ratio__lte=kwargs['max_ltv_ratio'])
            self.filters_applied.append(f"Max LTV Ratio: {kwargs['max_ltv_ratio']}%")
        
        if 'min_ltv_ratio' in kwargs and kwargs['min_ltv_ratio']:
            if not hasattr(self.queryset.model, 'ltv_ratio'):
                self.queryset = self.queryset.annotate(
                    ltv_ratio=Case(
                        When(property__total_value__gt=0,
                             then=Cast(F('property__ple_amount_due') * 100 / F('property__total_value'), DecimalField(max_digits=5, decimal_places=2))),
                        default=Value(0),
                        output_field=DecimalField(max_digits=5, decimal_places=2)
                    )
                )
            self.queryset = self.queryset.filter(ltv_ratio__gte=kwargs['min_ltv_ratio'])
            self.filters_applied.append(f"Min LTV Ratio: {kwargs['min_ltv_ratio']}%")
        
        return self
    
    def apply_property_filters(self, **kwargs):
        """
        Apply property-specific filters
        """
        # Property types
        if 'property_types' in kwargs and kwargs['property_types']:
            property_types = kwargs['property_types'] if isinstance(kwargs['property_types'], list) else [kwargs['property_types']]
            self.queryset = self.queryset.filter(property__property_type__in=property_types)
            self.filters_applied.append(f"Property Types: {', '.join(property_types)}")
        
        # Square footage range
        if 'min_square_feet' in kwargs and kwargs['min_square_feet']:
            self.queryset = self.queryset.filter(property__square_feet__gte=kwargs['min_square_feet'])
            self.filters_applied.append(f"Min Square Feet: {kwargs['min_square_feet']:,}")
        
        if 'max_square_feet' in kwargs and kwargs['max_square_feet']:
            self.queryset = self.queryset.filter(property__square_feet__lte=kwargs['max_square_feet'])
            self.filters_applied.append(f"Max Square Feet: {kwargs['max_square_feet']:,}")
        
        # Year built range
        if 'min_year_built' in kwargs and kwargs['min_year_built']:
            self.queryset = self.queryset.filter(property__year_built__gte=kwargs['min_year_built'])
            self.filters_applied.append(f"Built After: {kwargs['min_year_built']}")
        
        if 'max_year_built' in kwargs and kwargs['max_year_built']:
            self.queryset = self.queryset.filter(property__year_built__lte=kwargs['max_year_built'])
            self.filters_applied.append(f"Built Before: {kwargs['max_year_built']}")
        
        # Bedrooms/Bathrooms
        if 'min_bedrooms' in kwargs and kwargs['min_bedrooms']:
            self.queryset = self.queryset.filter(property__bedrooms__gte=kwargs['min_bedrooms'])
            self.filters_applied.append(f"Min Bedrooms: {kwargs['min_bedrooms']}")
        
        if 'min_bathrooms' in kwargs and kwargs['min_bathrooms']:
            self.queryset = self.queryset.filter(property__bathrooms__gte=kwargs['min_bathrooms'])
            self.filters_applied.append(f"Min Bathrooms: {kwargs['min_bathrooms']}")
        
        return self
    
    def apply_legal_filters(self, **kwargs):
        """
        Apply legal status filters
        """
        # Foreclosure status
        if 'in_foreclosure' in kwargs:
            if kwargs['in_foreclosure']:
                self.queryset = self.queryset.filter(property__in_foreclosure=True)
                self.filters_applied.append("In Foreclosure: Yes")
            else:
                self.queryset = self.queryset.filter(property__in_foreclosure=False)
                self.filters_applied.append("In Foreclosure: No")
        
        # Lawsuit status
        if 'has_lawsuit' in kwargs:
            if kwargs['has_lawsuit']:
                self.queryset = self.queryset.filter(property__ple_lawsuit_no__isnull=False)
                self.filters_applied.append("Has Lawsuit: Yes")
            else:
                self.queryset = self.queryset.filter(property__ple_lawsuit_no__isnull=True)
                self.filters_applied.append("Has Lawsuit: No")
        
        # Existing tax loan
        if 'has_existing_tax_loan' in kwargs:
            if kwargs['has_existing_tax_loan']:
                self.queryset = self.queryset.filter(property__existing_tax_loan=True)
                self.filters_applied.append("Has Existing Tax Loan: Yes")
            else:
                self.queryset = self.queryset.filter(property__existing_tax_loan=False)
                self.filters_applied.append("Has Existing Tax Loan: No")
        
        return self
    
    def apply_lead_filters(self, **kwargs):
        """
        Apply lead-specific filters
        """
        # Lead status
        if 'lead_statuses' in kwargs and kwargs['lead_statuses']:
            statuses = kwargs['lead_statuses'] if isinstance(kwargs['lead_statuses'], list) else [kwargs['lead_statuses']]
            self.queryset = self.queryset.filter(lead_status__in=statuses)
            self.filters_applied.append(f"Lead Status: {', '.join(statuses)}")
        
        # Lead score range
        if 'min_score' in kwargs and kwargs['min_score']:
            self.queryset = self.queryset.filter(score_value__gte=kwargs['min_score'])
            self.filters_applied.append(f"Min Score: {kwargs['min_score']}")
        
        if 'max_score' in kwargs and kwargs['max_score']:
            self.queryset = self.queryset.filter(score_value__lte=kwargs['max_score'])
            self.filters_applied.append(f"Max Score: {kwargs['max_score']}")
        
        # Owner type
        if 'owner_types' in kwargs and kwargs['owner_types']:
            owner_types = kwargs['owner_types'] if isinstance(kwargs['owner_types'], list) else [kwargs['owner_types']]
            self.queryset = self.queryset.filter(owner_type__in=owner_types)
            self.filters_applied.append(f"Owner Types: {', '.join(owner_types)}")
        
        # Contact availability
        if 'has_email' in kwargs:
            if kwargs['has_email']:
                self.queryset = self.queryset.filter(email__isnull=False, email__gt='')
                self.filters_applied.append("Has Email: Yes")
            else:
                self.queryset = self.queryset.filter(Q(email__isnull=True) | Q(email=''))
                self.filters_applied.append("Has Email: No")
        
        if 'has_phone' in kwargs:
            if kwargs['has_phone']:
                self.queryset = self.queryset.filter(phone_cell__isnull=False, phone_cell__gt='')
                self.filters_applied.append("Has Phone: Yes")
            else:
                self.queryset = self.queryset.filter(Q(phone_cell__isnull=True) | Q(phone_cell=''))
                self.filters_applied.append("Has Phone: No")
        
        # Communication preferences
        if 'exclude_do_not_contact' in kwargs and kwargs['exclude_do_not_contact']:
            self.queryset = self.queryset.filter(
                do_not_email=False,
                do_not_mail=False
            )
            self.filters_applied.append("Exclude Do Not Contact: Yes")
        
        # Safety flags
        if 'exclude_dangerous' in kwargs and kwargs['exclude_dangerous']:
            self.queryset = self.queryset.filter(is_dangerous=False)
            self.filters_applied.append("Exclude Dangerous Properties: Yes")
        
        # Business properties
        if 'exclude_business' in kwargs and kwargs['exclude_business']:
            self.queryset = self.queryset.filter(is_business=False)
            self.filters_applied.append("Exclude Business Properties: Yes")
        
        return self
    
    def apply_date_filters(self, **kwargs):
        """
        Apply date-based filters
        """
        # Last contact date
        if 'last_contact_days' in kwargs and kwargs['last_contact_days']:
            cutoff_date = timezone.now() - timedelta(days=kwargs['last_contact_days'])
            self.queryset = self.queryset.filter(
                Q(last_contact__gte=cutoff_date) | Q(last_contact__isnull=True)
            )
            self.filters_applied.append(f"Last Contact Within: {kwargs['last_contact_days']} days")
        
        # Property creation date
        if 'created_since_days' in kwargs and kwargs['created_since_days']:
            cutoff_date = timezone.now() - timedelta(days=kwargs['created_since_days'])
            self.queryset = self.queryset.filter(created_at__gte=cutoff_date)
            self.filters_applied.append(f"Created Within: {kwargs['created_since_days']} days")
        
        return self
    
    def apply_custom_filters(self, custom_query: Q):
        """
        Apply custom Q object filters for advanced use cases
        """
        self.queryset = self.queryset.filter(custom_query)
        self.filters_applied.append("Custom Filter Applied")
        return self
    
    def apply_sorting(self, **kwargs):
        """
        Apply sorting criteria
        """
        sort_options = {
            'score_desc': '-score_value',
            'score_asc': 'score_value',
            'taxes_due_desc': '-property__ple_amount_due',
            'taxes_due_asc': 'property__ple_amount_due',
            'property_value_desc': '-property__total_value',
            'property_value_asc': 'property__total_value',
            'created_desc': '-created_at',
            'created_asc': 'created_at',
            'last_contact_desc': '-last_contact',
            'last_contact_asc': 'last_contact',
            'city_asc': 'mailing_city',
            'state_asc': 'mailing_state',
        }
        
        sort_by = kwargs.get('sort_by', 'score_desc')
        if sort_by in sort_options:
            self.queryset = self.queryset.order_by(sort_options[sort_by])
            self.sort_criteria.append(sort_by)
        
        return self
    
    def get_results(self):
        """
        Get the filtered queryset results
        """
        return self.queryset
    
    def get_summary(self):
        """
        Get summary of applied filters and results
        """
        return {
            'total_results': self.queryset.count(),
            'filters_applied': self.filters_applied,
            'sort_criteria': self.sort_criteria,
        }
    
    def _apply_radius_filter(self, center_lat: float, center_lng: float, radius_miles: float):
        """
        Apply geographic radius filtering using Haversine formula
        """
        # Convert radius from miles to kilometers
        radius_km = radius_miles * 1.60934
        
        # Use Haversine formula for distance calculation
        # This is an approximation but works well for most use cases
        earth_radius_km = 6371
        
        return self.queryset.annotate(
            distance=earth_radius_km * 2 * Sqrt(
                Power(
                    Sin(Radians(F('latitude') - Value(center_lat)) / 2), 2
                ) +
                Cos(Radians(Value(center_lat))) *
                Cos(Radians(F('latitude'))) *
                Power(
                    Sin(Radians(F('longitude') - Value(center_lng)) / 2), 2
                )
            )
        ).filter(distance__lte=radius_km)


class SavedFilter:
    """
    Manage saved filter configurations
    """
    
    @staticmethod
    def save_filter(user, name: str, filter_config: Dict, is_favorite: bool = False):
        """
        Save a filter configuration for reuse
        """
        from .models import UserProfile
        
        # Get or create saved filters in user profile
        profile = user.profile
        saved_filters = profile.preferences.get('saved_filters', {})
        
        saved_filters[name] = {
            'config': filter_config,
            'is_favorite': is_favorite,
            'created_at': timezone.now().isoformat(),
            'last_used': timezone.now().isoformat(),
            'use_count': saved_filters.get(name, {}).get('use_count', 0) + 1
        }
        
        profile.preferences['saved_filters'] = saved_filters
        profile.save()
        
        return saved_filters[name]
    
    @staticmethod
    def load_filter(user, name: str) -> Dict:
        """
        Load a saved filter configuration
        """
        profile = user.profile
        saved_filters = profile.preferences.get('saved_filters', {})
        
        if name not in saved_filters:
            raise ValueError(f"Saved filter '{name}' not found")
        
        # Update last used time and use count
        saved_filters[name]['last_used'] = timezone.now().isoformat()
        saved_filters[name]['use_count'] = saved_filters[name].get('use_count', 0) + 1
        
        profile.preferences['saved_filters'] = saved_filters
        profile.save()
        
        return saved_filters[name]['config']
    
    @staticmethod
    def list_saved_filters(user) -> Dict:
        """
        List all saved filters for user
        """
        profile = user.profile
        return profile.preferences.get('saved_filters', {})
    
    @staticmethod
    def delete_filter(user, name: str):
        """
        Delete a saved filter
        """
        profile = user.profile
        saved_filters = profile.preferences.get('saved_filters', {})
        
        if name in saved_filters:
            del saved_filters[name]
            profile.preferences['saved_filters'] = saved_filters
            profile.save()
            return True
        
        return False


class FilterPresets:
    """
    Predefined filter presets for common use cases
    """
    
    PRESETS = {
        'high_value_properties': {
            'name': 'High Value Properties',
            'description': 'Properties worth $100k+ with significant tax debt',
            'config': {
                'min_property_value': 100000,
                'min_taxes_due': 5000,
                'exclude_dangerous': True,
                'exclude_business': True,
                'sort_by': 'property_value_desc'
            }
        },
        'quick_wins': {
            'name': 'Quick Wins',
            'description': 'High score leads with contact info and low risk',
            'config': {
                'min_score': 70,
                'has_email': True,
                'has_phone': True,
                'exclude_dangerous': True,
                'exclude_do_not_contact': True,
                'max_ltv_ratio': 50,
                'sort_by': 'score_desc'
            }
        },
        'foreclosure_opportunities': {
            'name': 'Foreclosure Opportunities',
            'description': 'Properties in foreclosure with moderate values',
            'config': {
                'in_foreclosure': True,
                'min_property_value': 50000,
                'max_property_value': 300000,
                'exclude_dangerous': True,
                'sort_by': 'taxes_due_desc'
            }
        },
        'out_of_state_owners': {
            'name': 'Out-of-State Owners',
            'description': 'Absentee and out-of-state property owners',
            'config': {
                'owner_types': ['absentee', 'out_of_state'],
                'min_taxes_due': 2000,
                'exclude_do_not_contact': True,
                'sort_by': 'score_desc'
            }
        },
        'new_leads_this_week': {
            'name': 'New Leads This Week',
            'description': 'Recently imported leads requiring attention',
            'config': {
                'created_since_days': 7,
                'lead_statuses': ['target_acquired'],
                'sort_by': 'created_desc'
            }
        },
        'follow_up_needed': {
            'name': 'Follow-up Needed',
            'description': 'Leads not contacted in 30+ days',
            'config': {
                'last_contact_days': 30,
                'lead_statuses': ['initial_contact', 'interested'],
                'exclude_do_not_contact': True,
                'sort_by': 'last_contact_asc'
            }
        }
    }
    
    @classmethod
    def get_preset(cls, preset_name: str) -> Dict:
        """Get a specific preset configuration"""
        if preset_name not in cls.PRESETS:
            raise ValueError(f"Preset '{preset_name}' not found")
        
        return cls.PRESETS[preset_name]
    
    @classmethod
    def list_presets(cls) -> Dict:
        """List all available presets"""
        return cls.PRESETS
    
    @classmethod
    def apply_preset(cls, preset_name: str, queryset=None) -> PropertyFilter:
        """Apply a preset filter to a queryset"""
        preset = cls.get_preset(preset_name)
        
        filter_obj = PropertyFilter(queryset)
        
        # Apply all filters from the preset config
        config = preset['config']
        
        # Apply different filter categories
        filter_obj.apply_geographic_filters(**config)
        filter_obj.apply_financial_filters(**config)
        filter_obj.apply_property_filters(**config)
        filter_obj.apply_legal_filters(**config)
        filter_obj.apply_lead_filters(**config)
        filter_obj.apply_date_filters(**config)
        filter_obj.apply_sorting(**config)
        
        return filter_obj