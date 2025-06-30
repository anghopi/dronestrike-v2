"""
Advanced Filtering API views for DroneStrike v2
Property and lead filtering with geographic, financial, and custom criteria
"""

import json
from django.http import JsonResponse
from django.core.paginator import Paginator
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import Lead, Property
from .filtering_system import PropertyFilter, SavedFilter, FilterPresets
from .user_roles import UserPermission
from .token_engine import TokenEngine


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def advanced_search_api(request):
    """
    Advanced property/lead search with complex filtering
    """
    # Check permission
    if not request.user.profile.has_permission(UserPermission.CAN_VIEW_LEADS):
        return Response({'error': 'No permission to search leads'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        data = json.loads(request.body)
        
        # Get pagination parameters
        page = data.get('page', 1)
        limit = min(data.get('limit', 50), 200)  # Max 200 results per page
        
        # Check if user has tokens for the search (if it's a complex search)
        filter_count = len([k for k in data.keys() if k not in ['page', 'limit', 'save_filter']])
        if filter_count > 5:  # Complex search
            try:
                TokenEngine.consume_tokens(
                    user=request.user,
                    action_type='property_lookup',
                    quantity=1,
                    description=f"Advanced search with {filter_count} filters"
                )
            except ValueError as e:
                return Response({'error': str(e)}, status=status.HTTP_402_PAYMENT_REQUIRED)
        
        # Create base queryset - scope to user's leads unless they can view all
        queryset = Lead.objects.select_related('property').all()
        if not request.user.profile.has_permission(UserPermission.CAN_VIEW_ALL_MISSIONS):
            queryset = queryset.filter(owner=request.user)
        
        # Initialize filter
        property_filter = PropertyFilter(queryset)
        
        # Apply geographic filters
        geographic_filters = {
            'states': data.get('states'),
            'counties': data.get('counties'),
            'cities': data.get('cities'),
            'zip_codes': data.get('zip_codes'),
            'center_lat': data.get('center_lat'),
            'center_lng': data.get('center_lng'),
            'radius_miles': data.get('radius_miles'),
        }
        property_filter.apply_geographic_filters(**{k: v for k, v in geographic_filters.items() if v is not None})
        
        # Apply financial filters
        financial_filters = {
            'min_property_value': data.get('min_property_value'),
            'max_property_value': data.get('max_property_value'),
            'min_taxes_due': data.get('min_taxes_due'),
            'max_taxes_due': data.get('max_taxes_due'),
            'min_ltv_ratio': data.get('min_ltv_ratio'),
            'max_ltv_ratio': data.get('max_ltv_ratio'),
        }
        property_filter.apply_financial_filters(**{k: v for k, v in financial_filters.items() if v is not None})
        
        # Apply property filters
        property_filters = {
            'property_types': data.get('property_types'),
            'min_square_feet': data.get('min_square_feet'),
            'max_square_feet': data.get('max_square_feet'),
            'min_year_built': data.get('min_year_built'),
            'max_year_built': data.get('max_year_built'),
            'min_bedrooms': data.get('min_bedrooms'),
            'min_bathrooms': data.get('min_bathrooms'),
        }
        property_filter.apply_property_filters(**{k: v for k, v in property_filters.items() if v is not None})
        
        # Apply legal filters
        legal_filters = {
            'in_foreclosure': data.get('in_foreclosure'),
            'has_lawsuit': data.get('has_lawsuit'),
            'has_existing_tax_loan': data.get('has_existing_tax_loan'),
        }
        property_filter.apply_legal_filters(**{k: v for k, v in legal_filters.items() if v is not None})
        
        # Apply lead filters
        lead_filters = {
            'lead_statuses': data.get('lead_statuses'),
            'min_score': data.get('min_score'),
            'max_score': data.get('max_score'),
            'owner_types': data.get('owner_types'),
            'has_email': data.get('has_email'),
            'has_phone': data.get('has_phone'),
            'exclude_do_not_contact': data.get('exclude_do_not_contact'),
            'exclude_dangerous': data.get('exclude_dangerous'),
            'exclude_business': data.get('exclude_business'),
        }
        property_filter.apply_lead_filters(**{k: v for k, v in lead_filters.items() if v is not None})
        
        # Apply date filters
        date_filters = {
            'last_contact_days': data.get('last_contact_days'),
            'created_since_days': data.get('created_since_days'),
        }
        property_filter.apply_date_filters(**{k: v for k, v in date_filters.items() if v is not None})
        
        # Apply sorting
        property_filter.apply_sorting(sort_by=data.get('sort_by', 'score_desc'))
        
        # Get results
        results_queryset = property_filter.get_results()
        summary = property_filter.get_summary()
        
        # Paginate results
        paginator = Paginator(results_queryset, limit)
        page_obj = paginator.get_page(page)
        
        # Serialize results
        leads_data = []
        for lead in page_obj:
            lead_data = {
                'id': lead.id,
                'first_name': lead.first_name,
                'last_name': lead.last_name,
                'email': lead.email,
                'phone_cell': lead.phone_cell,
                'mailing_address_1': lead.mailing_address_1,
                'mailing_city': lead.mailing_city,
                'mailing_state': lead.mailing_state,
                'mailing_zip5': lead.mailing_zip5,
                'lead_status': lead.lead_status,
                'score_value': lead.score_value,
                'owner_type': lead.owner_type,
                'is_dangerous': lead.is_dangerous,
                'is_business': lead.is_business,
                'do_not_email': lead.do_not_email,
                'created_at': lead.created_at.isoformat(),
                'last_contact': lead.last_contact.isoformat() if lead.last_contact else None,
            }
            
            # Add property data if available
            if lead.property:
                property_data = {
                    'id': lead.property.id,
                    'address1': lead.property.address1,
                    'city': lead.property.city,
                    'state': lead.property.state,
                    'zip_code': lead.property.zip_code,
                    'property_type': lead.property.property_type,
                    'total_value': str(lead.property.total_value),
                    'square_feet': lead.property.square_feet,
                    'year_built': lead.property.year_built,
                    'bedrooms': lead.property.bedrooms,
                    'bathrooms': str(lead.property.bathrooms) if lead.property.bathrooms else None,
                    'ple_amount_due': str(lead.property.ple_amount_due) if lead.property.ple_amount_due else None,
                    'in_foreclosure': lead.property.in_foreclosure,
                    'existing_tax_loan': lead.property.existing_tax_loan,
                }
                
                # Calculate LTV ratio if possible
                if lead.property.total_value and lead.property.ple_amount_due and lead.property.total_value > 0:
                    ltv_ratio = (float(lead.property.ple_amount_due) / float(lead.property.total_value)) * 100
                    property_data['ltv_ratio'] = round(ltv_ratio, 2)
                
                lead_data['property'] = property_data
            
            leads_data.append(lead_data)
        
        # Save filter if requested
        if data.get('save_filter') and data.get('filter_name'):
            try:
                # Remove pagination and save_filter params from saved config
                filter_config = {k: v for k, v in data.items() 
                               if k not in ['page', 'limit', 'save_filter', 'filter_name']}
                
                SavedFilter.save_filter(
                    user=request.user,
                    name=data['filter_name'],
                    filter_config=filter_config,
                    is_favorite=data.get('is_favorite', False)
                )
            except Exception as e:
                # Don't fail the search if saving fails
                pass
        
        return Response({
            'results': leads_data,
            'summary': summary,
            'pagination': {
                'page': page,
                'pages': paginator.num_pages,
                'per_page': limit,
                'total': paginator.count,
                'has_next': page_obj.has_next(),
                'has_previous': page_obj.has_previous(),
            },
            'search_cost': {
                'tokens_used': 1 if filter_count > 5 else 0,
                'filter_count': filter_count
            }
        })
    
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def filter_presets_api(request):
    """Get available filter presets"""
    presets = FilterPresets.list_presets()
    
    presets_data = []
    for preset_id, preset_info in presets.items():
        presets_data.append({
            'id': preset_id,
            'name': preset_info['name'],
            'description': preset_info['description'],
            'config': preset_info['config']
        })
    
    return Response({'presets': presets_data})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def apply_preset_api(request):
    """Apply a filter preset"""
    try:
        data = json.loads(request.body)
        preset_name = data.get('preset_name')
        page = data.get('page', 1)
        limit = min(data.get('limit', 50), 200)
        
        if not preset_name:
            return Response({'error': 'preset_name is required'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        # Check permission
        if not request.user.profile.has_permission(UserPermission.CAN_VIEW_LEADS):
            return Response({'error': 'No permission to search leads'}, 
                           status=status.HTTP_403_FORBIDDEN)
        
        # Create base queryset
        queryset = Lead.objects.select_related('property').all()
        if not request.user.profile.has_permission(UserPermission.CAN_VIEW_ALL_MISSIONS):
            queryset = queryset.filter(owner=request.user)
        
        # Apply preset
        try:
            property_filter = FilterPresets.apply_preset(preset_name, queryset)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get results and paginate
        results_queryset = property_filter.get_results()
        summary = property_filter.get_summary()
        
        paginator = Paginator(results_queryset, limit)
        page_obj = paginator.get_page(page)
        
        # Serialize results (same as advanced_search_api)
        leads_data = []
        for lead in page_obj:
            lead_data = {
                'id': lead.id,
                'first_name': lead.first_name,
                'last_name': lead.last_name,
                'email': lead.email,
                'phone_cell': lead.phone_cell,
                'mailing_city': lead.mailing_city,
                'mailing_state': lead.mailing_state,
                'lead_status': lead.lead_status,
                'score_value': lead.score_value,
                'owner_type': lead.owner_type,
            }
            
            if lead.property:
                lead_data['property'] = {
                    'total_value': str(lead.property.total_value),
                    'ple_amount_due': str(lead.property.ple_amount_due) if lead.property.ple_amount_due else None,
                    'property_type': lead.property.property_type,
                    'in_foreclosure': lead.property.in_foreclosure,
                }
            
            leads_data.append(lead_data)
        
        return Response({
            'results': leads_data,
            'summary': summary,
            'preset_used': preset_name,
            'pagination': {
                'page': page,
                'pages': paginator.num_pages,
                'total': paginator.count,
            }
        })
    
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def saved_filters_api(request):
    """Get user's saved filters"""
    saved_filters = SavedFilter.list_saved_filters(request.user)
    
    filters_data = []
    for filter_name, filter_info in saved_filters.items():
        filters_data.append({
            'name': filter_name,
            'config': filter_info['config'],
            'is_favorite': filter_info.get('is_favorite', False),
            'created_at': filter_info.get('created_at'),
            'last_used': filter_info.get('last_used'),
            'use_count': filter_info.get('use_count', 0)
        })
    
    # Sort by favorites first, then by last used
    filters_data.sort(key=lambda x: (not x['is_favorite'], x['last_used']), reverse=True)
    
    return Response({'saved_filters': filters_data})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_filter_api(request):
    """Save a filter configuration"""
    try:
        data = json.loads(request.body)
        
        filter_name = data.get('name')
        filter_config = data.get('config')
        is_favorite = data.get('is_favorite', False)
        
        if not filter_name or not filter_config:
            return Response({'error': 'name and config are required'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        saved_filter = SavedFilter.save_filter(
            user=request.user,
            name=filter_name,
            filter_config=filter_config,
            is_favorite=is_favorite
        )
        
        return Response({
            'message': 'Filter saved successfully',
            'filter': {
                'name': filter_name,
                'is_favorite': saved_filter['is_favorite'],
                'created_at': saved_filter['created_at']
            }
        }, status=status.HTTP_201_CREATED)
    
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def load_saved_filter_api(request):
    """Load and apply a saved filter"""
    try:
        data = json.loads(request.body)
        filter_name = data.get('filter_name')
        page = data.get('page', 1)
        limit = min(data.get('limit', 50), 200)
        
        if not filter_name:
            return Response({'error': 'filter_name is required'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        # Load filter config
        try:
            filter_config = SavedFilter.load_filter(request.user, filter_name)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        
        # Apply the saved filter (reuse advanced_search logic)
        filter_config.update({'page': page, 'limit': limit})
        
        # Create new request with saved config
        from django.http import HttpRequest
        new_request = HttpRequest()
        new_request.user = request.user
        new_request.method = 'POST'
        new_request._body = json.dumps(filter_config).encode('utf-8')
        
        # Apply the filter
        return advanced_search_api(new_request)
    
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_saved_filter_api(request, filter_name):
    """Delete a saved filter"""
    try:
        deleted = SavedFilter.delete_filter(request.user, filter_name)
        
        if deleted:
            return Response({'message': 'Filter deleted successfully'})
        else:
            return Response({'error': 'Filter not found'}, 
                           status=status.HTTP_404_NOT_FOUND)
    
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def filter_options_api(request):
    """Get available filter options for form building"""
    # Get unique values for dropdowns
    from django.db.models import Q
    
    # Base queryset for user's accessible data
    queryset = Lead.objects.select_related('property').all()
    if not request.user.profile.has_permission(UserPermission.CAN_VIEW_ALL_MISSIONS):
        queryset = queryset.filter(owner=request.user)
    
    # Get unique values
    states = list(queryset.values_list('mailing_state', flat=True).distinct().order_by('mailing_state'))
    counties = list(queryset.filter(mailing_county__isnull=False).values_list('mailing_county', flat=True).distinct().order_by('mailing_county'))
    cities = list(queryset.values_list('mailing_city', flat=True).distinct().order_by('mailing_city')[:100])  # Limit cities
    
    property_types = []
    owner_types = []
    lead_statuses = []
    
    if queryset.exists():
        property_types = list(queryset.filter(property__property_type__isnull=False).values_list('property__property_type', flat=True).distinct())
        owner_types = list(queryset.filter(owner_type__isnull=False).values_list('owner_type', flat=True).distinct())
        lead_statuses = list(queryset.values_list('lead_status', flat=True).distinct())
    
    return Response({
        'geographic_options': {
            'states': states,
            'counties': counties,
            'cities': cities,
        },
        'property_options': {
            'property_types': property_types,
        },
        'lead_options': {
            'owner_types': owner_types,
            'lead_statuses': lead_statuses,
        },
        'sort_options': [
            {'value': 'score_desc', 'label': 'Score (High to Low)'},
            {'value': 'score_asc', 'label': 'Score (Low to High)'},
            {'value': 'taxes_due_desc', 'label': 'Taxes Due (High to Low)'},
            {'value': 'taxes_due_asc', 'label': 'Taxes Due (Low to High)'},
            {'value': 'property_value_desc', 'label': 'Property Value (High to Low)'},
            {'value': 'property_value_asc', 'label': 'Property Value (Low to High)'},
            {'value': 'created_desc', 'label': 'Recently Added'},
            {'value': 'created_asc', 'label': 'Oldest First'},
        ]
    })