"""
DroneStrike v2 API Views
DRF ViewSets with business logic integration
"""

from rest_framework import viewsets, status, permissions, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth.models import User
from django.db.models import Q, Count, Sum, Avg
from decimal import Decimal
from datetime import datetime, timedelta
from rest_framework_simplejwt.tokens import RefreshToken
import csv
import io
from django.core.files.uploadedfile import InMemoryUploadedFile

from .models import (
    Company, UserProfile, County, Property, Lead,
    Mission, MissionRoute, MissionRoutePoint, MissionLog, MissionPhoto,
    Device, MissionDeclineReason
)
from .serializers import (
    CompanySerializer, UserProfileSerializer, CountySerializer,
    PropertySerializer, LeadSerializer, LeadCreateSerializer,
    LoanCalculationSerializer, TokenTransactionSerializer,
    MissionSerializer, MissionCreateSerializer, MissionUpdateSerializer,
    MissionRouteSerializer, MissionPhotoSerializer, MissionSearchSerializer,
    RouteOptimizationRequestSerializer, DeviceSerializer, MissionDeclineReasonSerializer
)
from .services import (
    FinancialCalculationService, TokenService, PropertyScoringService, WorkflowService
)
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.csv_service import csv_service


class CurrentUserView(generics.RetrieveAPIView):
    """Get current authenticated user profile"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, *args, **kwargs):
        user = request.user
        profile = getattr(user, 'profile', None)
        
        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'firstName': user.first_name,
            'lastName': user.last_name,
            'company': profile.company.name if profile and profile.company else '',
            'role': profile.role if profile else 'user',
            'tokens': profile.tokens if profile else 0,
        })


class CompanyViewSet(viewsets.ModelViewSet):
    """Company management API"""
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        # Users can see their own company and companies they're managing
        if self.request.user.profile.role in ['admin', 'manager']:
            return queryset
        return queryset.filter(employees__user=self.request.user)


class UserProfileViewSet(viewsets.ModelViewSet):
    """User profile management API"""
    queryset = UserProfile.objects.select_related('user', 'company')
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        # Users can see their own profile and profiles in their company
        if self.request.user.profile.role in ['admin', 'manager']:
            return queryset.filter(company=self.request.user.profile.company)
        return queryset.filter(user=self.request.user)
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get current user's profile"""
        serializer = self.get_serializer(request.user.profile)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def consume_tokens(self, request, pk=None):
        """Consume tokens for an action"""
        profile = self.get_object()
        serializer = TokenTransactionSerializer(data=request.data)
        
        if serializer.is_valid():
            token_service = TokenService()
            result = token_service.consume_tokens(
                profile,
                serializer.validated_data['action_type'],
                serializer.validated_data.get('quantity', 1)
            )
            
            if result['success']:
                return Response({
                    'success': True,
                    'tokens_consumed': result['tokens_consumed'],
                    'tokens_remaining': result['tokens_remaining'],
                    'token_type': result['token_type']
                })
            else:
                return Response({
                    'success': False,
                    'error': result['error'],
                    'tokens_needed': result['tokens_needed'],
                    'tokens_available': result['tokens_available']
                }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CountyViewSet(viewsets.ModelViewSet):
    """County management API"""
    queryset = County.objects.all()
    serializer_class = CountySerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['state', 'name']
    search_fields = ['name', 'state', 'fips_code']
    ordering_fields = ['name', 'state', 'tax_sale_date']
    ordering = ['state', 'name']


class PropertyViewSet(viewsets.ModelViewSet):
    """Property management API with financial calculations"""
    queryset = Property.objects.select_related('county').prefetch_related('leads')
    serializer_class = PropertySerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['property_type', 'disposition', 'state', 'existing_tax_loan', 'in_foreclosure', 'is_active']
    search_fields = ['address1', 'city', 'account_number', 'ple_lawsuit_no']
    ordering_fields = ['total_value', 'ple_amount_due', 'created_at', 'city']
    ordering = ['-created_at']
    
    @action(detail=True, methods=['post'])
    def calculate_loan(self, request, pk=None):
        """Calculate loan metrics for property"""
        property_obj = self.get_object()
        serializer = LoanCalculationSerializer(data=request.data)
        
        if serializer.is_valid():
            financial_service = FinancialCalculationService()
            
            loan_amount = serializer.validated_data['loan_amount']
            interest_rate = serializer.validated_data['interest_rate']
            term_months = serializer.validated_data['term_months']
            
            # Calculate all financial metrics
            monthly_payment = financial_service.calculate_monthly_payment(
                loan_amount, interest_rate, term_months
            )
            
            ltv_ratio = financial_service.calculate_ltv_ratio(
                loan_amount, property_obj.market_value or property_obj.total_value
            )
            
            max_loan_amount = financial_service.calculate_max_loan_amount(
                property_obj.market_value or property_obj.total_value
            )
            
            total_cost = financial_service.calculate_total_loan_cost(
                loan_amount, interest_rate, term_months
            )
            
            risk_assessment = financial_service.assess_loan_risk(property_obj, loan_amount)
            
            payment_schedule = financial_service.generate_payment_schedule(
                loan_amount, interest_rate, term_months
            )
            
            return Response({
                'property_id': property_obj.id,
                'loan_amount': float(loan_amount),
                'monthly_payment': float(monthly_payment),
                'ltv_ratio': float(ltv_ratio),
                'max_loan_amount': float(max_loan_amount),
                'total_payments': float(total_cost['total_payments']),
                'total_interest': float(total_cost['total_interest']),
                'interest_percentage': float(total_cost['interest_percentage']),
                'risk_assessment': risk_assessment,
                'payment_schedule': payment_schedule[:6],  # First 6 payments for preview
                'full_schedule_available': len(payment_schedule) > 6
            })
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'])
    def property_score(self, request, pk=None):
        """Get detailed property investment score"""
        property_obj = self.get_object()
        scoring_service = PropertyScoringService()
        score_data = scoring_service.calculate_property_score(property_obj)
        
        return Response({
            'property_id': property_obj.id,
            'score_data': score_data,
            'calculated_at': datetime.now().isoformat()
        })
    
    @action(detail=False, methods=['get'])
    def investment_opportunities(self, request):
        """Get top investment opportunities"""
        queryset = self.get_queryset().filter(
            is_active=True,
            total_value__gt=0,
            ple_amount_due__isnull=False
        )
        
        # Calculate scores for filtering
        opportunities = []
        for prop in queryset[:50]:  # Limit to prevent timeout
            scoring_service = PropertyScoringService()
            score_data = scoring_service.calculate_property_score(prop)
            
            if score_data['score'] >= 70:  # Only high-scoring properties
                opportunities.append({
                    'property': PropertySerializer(prop, context={'request': request}).data,
                    'score_data': score_data
                })
        
        # Sort by score
        opportunities.sort(key=lambda x: x['score_data']['score'], reverse=True)
        
        return Response({
            'count': len(opportunities),
            'opportunities': opportunities[:20]  # Top 20
        })


class LeadViewSet(viewsets.ModelViewSet):
    """Lead management API with advanced Laravel-compatible filtering"""
    queryset = Lead.objects.select_related('owner', 'property__county').prefetch_related('property__leads')
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['lead_status', 'workflow_stage', 'owner_type', 'mailing_state', 'owner']
    search_fields = ['first_name', 'last_name', 'email', 'mailing_city', 'phone_cell', 'mailing_address_1', 'account_number']
    ordering_fields = ['score_value', 'created_at', 'last_contact', 'first_name', 'last_name', 'mailing_city', 'mailing_county']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return LeadCreateSerializer
        return LeadSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Users see their own leads or company leads if manager/admin
        if self.request.user.profile.role in ['admin', 'manager']:
            queryset = queryset.filter(owner__profile__company=self.request.user.profile.company)
        else:
            queryset = queryset.filter(owner=self.request.user)
        
        # Apply Laravel-compatible filters
        queryset = self.apply_advanced_filters(queryset)
        return queryset
    
    def apply_advanced_filters(self, queryset):
        """Apply all Laravel-compatible filters for prospects/targets"""
        params = self.request.query_params
        
        # Global search (searches across multiple fields like Laravel)
        search = params.get('search', '').strip()
        if search:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(email__icontains=search) |
                Q(mailing_address_1__icontains=search) |
                Q(account_number__icontains=search) |
                Q(phone_cell__icontains=search)
            )
        
        # Specific search fields (Laravel compatibility)
        search_name = params.get('search_name', '').strip()
        if search_name:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(first_name__icontains=search_name) | Q(last_name__icontains=search_name)
            )
        
        search_address = params.get('search_address', '').strip()
        if search_address:
            queryset = queryset.filter(mailing_address_1__icontains=search_address)
            
        search_account = params.get('search_account_number', '').strip()
        if search_account:
            queryset = queryset.filter(account_number__icontains=search_account)
        
        # Location filters
        if params.get('property_state'):
            queryset = queryset.filter(mailing_state__iexact=params['property_state'])
        if params.get('property_city'):
            queryset = queryset.filter(mailing_city__icontains=params['property_city'])
        if params.get('property_zip'):
            queryset = queryset.filter(mailing_zip5__icontains=params['property_zip'])
        
        # Status filters
        is_active = params.get('is_active')
        if is_active is not None:
            if is_active == '1':
                # Active prospects (not dead or converted)
                queryset = queryset.exclude(lead_status__in=['dead', 'converted'])
            elif is_active == '0':
                # Expired prospects (dead or converted)
                queryset = queryset.filter(lead_status__in=['dead', 'converted'])
        
        # Date range filters
        created_from = params.get('created_at_from')
        created_to = params.get('created_at_to')
        if created_from:
            try:
                from datetime import datetime
                date_from = datetime.strptime(created_from, '%Y-%m-%d').date()
                queryset = queryset.filter(created_at__date__gte=date_from)
            except ValueError:
                pass
        if created_to:
            try:
                from datetime import datetime
                date_to = datetime.strptime(created_to, '%Y-%m-%d').date()
                queryset = queryset.filter(created_at__date__lte=date_to)
            except ValueError:
                pass
        
        # Advanced prospect filters (Laravel mobile interface compatibility)
        if params.get('exclude_dangerous') == 'true':
            queryset = queryset.filter(is_dangerous=False)
        if params.get('exclude_business') == 'true':
            queryset = queryset.filter(is_business=False)
        if params.get('exclude_do_not_contact') == 'true':
            queryset = queryset.filter(do_not_email=False, do_not_mail=False)
        
        # Score range filtering
        score_min = params.get('score_min')
        score_max = params.get('score_max')
        if score_min:
            try:
                queryset = queryset.filter(score_value__gte=int(score_min))
            except ValueError:
                pass
        if score_max:
            try:
                queryset = queryset.filter(score_value__lte=int(score_max))
            except ValueError:
                pass
        
        # Property type filtering (based on lead data patterns)
        property_type = params.get('property_type')
        if property_type:
            if property_type == 'residential':
                queryset = queryset.filter(is_business=False)
            elif property_type == 'commercial':
                queryset = queryset.filter(is_business=True)
        
        # Geographic radius search
        lat = params.get('lat')
        lng = params.get('lng')
        radius = params.get('radius')
        if lat and lng and radius:
            try:
                from math import cos, radians
                lat_f = float(lat)
                lng_f = float(lng)
                radius_f = float(radius)
                
                # Rough bounding box calculation (miles)
                lat_range = radius_f / 69.0
                lng_range = radius_f / (69.0 * cos(radians(lat_f)))
                
                queryset = queryset.filter(
                    latitude__range=(lat_f - lat_range, lat_f + lat_range),
                    longitude__range=(lng_f - lng_range, lng_f + lng_range)
                )
            except (ValueError, TypeError):
                pass
        
        # Map bounds search (Laravel compatible)
        region_lat = params.get('region_lat')
        region_lng = params.get('region_lng')
        region_lat_delta = params.get('region_lat_delta')
        region_lng_delta = params.get('region_lng_delta')
        if region_lat and region_lng and region_lat_delta and region_lng_delta:
            try:
                lat_f = float(region_lat)
                lng_f = float(region_lng)
                lat_delta = float(region_lat_delta)
                lng_delta = float(region_lng_delta)
                
                queryset = queryset.filter(
                    latitude__range=(lat_f - lat_delta, lat_f + lat_delta),
                    longitude__range=(lng_f - lng_delta, lng_f + lng_delta)
                )
            except (ValueError, TypeError):
                pass
        
        # Filter for targets with coordinates (for map display)
        has_coordinates = params.get('has_coordinates')
        if has_coordinates == 'true':
            queryset = queryset.exclude(latitude__isnull=True).exclude(longitude__isnull=True)
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def filter_options(self, request):
        """Get available filter options for dropdowns"""
        queryset = self.get_queryset()
        
        # Get unique values for filter dropdowns (using available fields)
        counties = queryset.values_list('mailing_county', flat=True).distinct().exclude(mailing_county__isnull=True).exclude(mailing_county='').order_by('mailing_county')
        states = queryset.values_list('mailing_state', flat=True).distinct().exclude(mailing_state='').order_by('mailing_state')
        cities = queryset.values_list('mailing_city', flat=True).distinct().exclude(mailing_city='').order_by('mailing_city')
        zip_codes = queryset.values_list('mailing_zip5', flat=True).distinct().exclude(mailing_zip5='').order_by('mailing_zip5')
        statuses = queryset.values_list('lead_status', flat=True).distinct().exclude(lead_status='').order_by('lead_status')
        
        return Response({
            'counties': list(counties),
            'states': list(states),
            'cities': list(cities)[:100],
            'zip_codes': list(zip_codes)[:50],
            'lead_statuses': list(statuses),
            'search_types': [
                {'value': 'all', 'label': 'All Fields'},
                {'value': 'name', 'label': 'Name'},
                {'value': 'address', 'label': 'Address'},
                {'value': 'phone', 'label': 'Phone'},
                {'value': 'email', 'label': 'Email'},
                {'value': 'account', 'label': 'Account Number'}
            ],
            'property_types': [
                {'value': 'residential', 'label': 'Residential'},
                {'value': 'commercial', 'label': 'Commercial'},
                {'value': 'mixed', 'label': 'Mixed Use'}
            ],
            'property_type_filters': [
                {'value': 'residential', 'label': 'Residential'},
                {'value': 'commercial', 'label': 'Commercial'},
                {'value': 'mixed', 'label': 'Mixed Use'}
            ],
            'status_options': list(statuses),
            'score_ranges': [
                {'value': '0-25', 'label': 'Low (0-25)'},
                {'value': '26-50', 'label': 'Fair (26-50)'},
                {'value': '51-75', 'label': 'Good (51-75)'},
                {'value': '76-100', 'label': 'Excellent (76-100)'}
            ]
        })
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get prospect statistics for dashboard - Laravel compatible"""
        from django.db.models import Count, Min, Q
        queryset = self.get_queryset()
        
        # County-based statistics (matching Laravel implementation)
        county_stats = queryset.values('mailing_county').annotate(
            total_properties=Count('id'),
            active_properties=Count('id', filter=Q(lead_status__in=['new', 'contacted', 'interested'])),
            expired_properties=Count('id', filter=Q(lead_status__in=['dead', 'converted'])),
            dangerous_count=Count('id', filter=Q(is_dangerous=True)),
            business_count=Count('id', filter=Q(is_business=True)),
            returned_postcard_count=Count('id', filter=Q(returned_postcard=True)),
            last_date=Min('created_at')
        ).order_by('mailing_county')
        
        # Overall totals
        total_prospects = queryset.count()
        active_prospects = queryset.exclude(lead_status__in=['dead', 'converted']).count()
        expired_prospects = queryset.filter(lead_status__in=['dead', 'converted']).count()
        dangerous_prospects = queryset.filter(is_dangerous=True).count()
        business_prospects = queryset.filter(is_business=True).count()
        
        return Response({
            'totals': {
                'total_targets': total_prospects,
                'active_targets': active_prospects,
                'expired_targets': expired_prospects,
                'active_percentage': round((active_prospects / total_prospects * 100) if total_prospects > 0 else 0, 1),
                'dangerous_targets': dangerous_prospects,
                'business_targets': business_prospects
            },
            'by_county': list(county_stats),
            'county_counter': list(county_stats)  # Laravel compatibility
        })
    
    @action(detail=True, methods=['post'])
    def advance_workflow(self, request, pk=None):
        """Advance lead to next workflow stage"""
        lead = self.get_object()
        workflow_service = WorkflowService()
        
        try:
            new_stage = workflow_service.advance_workflow_stage(lead)
            
            return Response({
                'success': True,
                'previous_stage': request.data.get('current_stage'),
                'new_stage': new_stage,
                'message': f'Lead advanced to {new_stage}'
            })
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def create_opportunity(self, request, pk=None):
        """Create investment opportunity from lead"""
        lead = self.get_object()
        
        try:
            requested_amount = Decimal(str(request.data.get('requested_amount', 0)))
            if requested_amount <= 0:
                return Response({
                    'success': False,
                    'error': 'Valid requested_amount is required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            workflow_service = WorkflowService()
            opportunity = workflow_service.create_opportunity_from_lead(lead, requested_amount)
            
            return Response({
                'success': True,
                'opportunity_id': opportunity.id,
                'lead_id': lead.id,
                'requested_amount': float(requested_amount),
                'max_loan_amount': float(opportunity.max_loan_amount),
                'ltv_ratio': float(opportunity.ltv_ratio),
                'risk_score': opportunity.risk_score,
                'message': 'Opportunity created successfully'
            })
        
        except ValueError as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': f'Failed to create opportunity: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'])
    def dashboard_stats(self, request):
        """Get dashboard statistics for leads"""
        queryset = self.get_queryset()
        
        stats = {
            'total_leads': queryset.count(),
            'by_status': queryset.values('lead_status').annotate(
                count=Count('id')
            ).order_by('-count'),
            'by_workflow_stage': queryset.values('workflow_stage').annotate(
                count=Count('id')
            ).order_by('-count'),
            'by_state': queryset.values('mailing_state').annotate(
                count=Count('id')
            ).order_by('-count')[:10],  # Top 10 states
            'average_score': queryset.aggregate(
                avg_score=Avg('score_value')
            )['avg_score'] or 0,
            'high_score_leads': queryset.filter(score_value__gte=80).count(),
            'recent_leads': queryset.filter(
                created_at__gte=datetime.now() - timedelta(days=30)
            ).count()
        }
        
        return Response(stats)
    
    @action(detail=False, methods=['get'])
    def workflow_pipeline(self, request):
        """Get workflow pipeline view"""
        queryset = self.get_queryset()
        
        pipeline = []
        workflow_stages = [
            'lead_identified', 'botg_assigned', 'botg_in_progress', 'botg_completed',
            'opportunity_created', 'tlc_loan_originated', 'tlc_client_onboarded', 'loan_servicing'
        ]
        
        for stage in workflow_stages:
            stage_leads = queryset.filter(workflow_stage=stage)
            pipeline.append({
                'stage': stage,
                'count': stage_leads.count(),
                'leads': LeadSerializer(
                    stage_leads[:5], many=True, context={'request': request}
                ).data  # Sample of 5 leads per stage
            })
        
        return Response({
            'pipeline': pipeline,
            'total_in_pipeline': queryset.count()
        })


class UserRegistrationView(generics.CreateAPIView):
    """User registration endpoint"""
    permission_classes = [permissions.AllowAny]
    
    def create(self, request, *args, **kwargs):
        data = request.data
        
        # Validate required fields
        if not all([data.get('username'), data.get('email'), data.get('password')]):
            return Response({
                'error': 'Username, email, and password are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user exists
        if User.objects.filter(username=data.get('username')).exists():
            return Response({
                'error': 'Username already exists'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if User.objects.filter(email=data.get('email')).exists():
            return Response({
                'error': 'Email already exists'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Create user with properly hashed password
            user = User.objects.create_user(
                username=data.get('username'),
                email=data.get('email'),
                password=data.get('password'),  # Django will hash this automatically
                first_name=data.get('first_name', ''),
                last_name=data.get('last_name', '')
            )
            # Ensure user is active
            user.is_active = True
            user.save()
            
            # Create user profile
            UserProfile.objects.create(
                user=user,
                tokens=10000,  # Welcome bonus
                mail_tokens=500,  # Welcome bonus
                role='user'
            )
            
            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)
            access_token = refresh.access_token
            
            return Response({
                'access': str(access_token),
                'refresh': str(refresh),
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name
                }
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({
                'error': f'Registration failed: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)


class CSVUploadView(generics.CreateAPIView):
    """CSV file upload and processing endpoint"""
    permission_classes = [permissions.IsAuthenticated]
    
    def create(self, request, *args, **kwargs):
        try:
            # Check if file was uploaded
            if 'file' not in request.FILES:
                return Response({
                    'error': 'No file uploaded'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            file = request.FILES['file']
            data_type = request.data.get('type', 'leads')  # Default to leads
            
            # Validate file type
            if not file.name.endswith('.csv'):
                return Response({
                    'error': 'File must be a CSV file'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Read CSV file
            file_data = file.read().decode('utf-8')
            csv_reader = csv.DictReader(io.StringIO(file_data))
            
            created_count = 0
            errors = []
            
            # Process based on data type
            if data_type == 'leads':
                created_count, errors = self._process_leads_csv(csv_reader, request.user)
            elif data_type == 'properties':
                created_count, errors = self._process_properties_csv(csv_reader, request.user)
            else:
                return Response({
                    'error': f'Unsupported data type: {data_type}'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            return Response({
                'success': True,
                'message': f'Successfully processed {created_count} records',
                'created_count': created_count,
                'errors': errors[:10] if errors else []  # Show first 10 errors
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({
                'error': f'CSV processing failed: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)
    
    def _process_leads_csv(self, csv_reader, user):
        """Process leads CSV data"""
        created_count = 0
        errors = []
        
        for row_num, row in enumerate(csv_reader, start=2):
            try:
                # Map CSV columns to model fields (flexible mapping)
                lead_data = {
                    'owner': user,
                    'first_name': row.get('first_name', row.get('First Name', '')),
                    'last_name': row.get('last_name', row.get('Last Name', '')),
                    'email': row.get('email', row.get('Email', '')),
                    'phone_cell': row.get('phone', row.get('Phone', row.get('phone_cell', ''))),
                    'mailing_address1': row.get('address', row.get('Address', row.get('mailing_address1', ''))),
                    'mailing_city': row.get('city', row.get('City', row.get('mailing_city', ''))),
                    'mailing_state': row.get('state', row.get('State', row.get('mailing_state', ''))),
                    'mailing_zip': row.get('zip', row.get('ZIP', row.get('mailing_zip', ''))),
                    'owner_type': row.get('owner_type', 'individual'),
                    'lead_status': row.get('status', row.get('Status', 'new')),
                    'workflow_stage': 'lead_identified',
                    'score_value': int(row.get('score', row.get('Score', 50)))
                }
                
                # Remove empty fields
                lead_data = {k: v for k, v in lead_data.items() if v}
                
                Lead.objects.create(**lead_data)
                created_count += 1
                
            except Exception as e:
                errors.append(f'Row {row_num}: {str(e)}')
                continue
        
        return created_count, errors
    
    def _process_properties_csv(self, csv_reader, user):
        """Process properties CSV data"""
        created_count = 0
        errors = []
        
        for row_num, row in enumerate(csv_reader, start=2):
            try:
                # Get or create county
                county_name = row.get('county', row.get('County', ''))
                state = row.get('state', row.get('State', ''))
                county = None
                
                if county_name and state:
                    county, _ = County.objects.get_or_create(
                        name=county_name,
                        state=state,
                        defaults={'fips_code': f'{state}-{county_name}'}
                    )
                
                property_data = {
                    'county': county,
                    'address1': row.get('address', row.get('Address', row.get('address1', ''))),
                    'city': row.get('city', row.get('City', '')),
                    'state': state,
                    'zip_code': row.get('zip', row.get('ZIP', row.get('zip_code', ''))),
                    'property_type': row.get('property_type', row.get('Type', 'single_family')),
                    'total_value': Decimal(row.get('value', row.get('Value', row.get('total_value', '0')))) if row.get('value', row.get('Value', row.get('total_value', '0'))) else Decimal('0'),
                    'market_value': Decimal(row.get('market_value', row.get('Market Value', '0'))) if row.get('market_value', row.get('Market Value', '0')) else None,
                    'bedrooms': int(row.get('bedrooms', row.get('Bedrooms', 0))) if row.get('bedrooms', row.get('Bedrooms', 0)) else None,
                    'bathrooms': row.get('bathrooms', row.get('Bathrooms', '0')),
                    'square_feet': int(row.get('sqft', row.get('Square Feet', row.get('square_feet', 0)))) if row.get('sqft', row.get('Square Feet', row.get('square_feet', 0))) else None,
                    'year_built': int(row.get('year_built', row.get('Year Built', 0))) if row.get('year_built', row.get('Year Built', 0)) else None,
                    'account_number': row.get('account', row.get('Account', row.get('account_number', ''))),
                    'ple_amount_due': Decimal(row.get('taxes_due', row.get('Taxes Due', row.get('ple_amount_due', '0')))) if row.get('taxes_due', row.get('Taxes Due', row.get('ple_amount_due', '0'))) else None,
                    'disposition': 'active',
                    'is_active': True
                }
                
                # Remove empty/None fields
                property_data = {k: v for k, v in property_data.items() if v is not None and v != ''}
                
                Property.objects.create(**property_data)
                created_count += 1
                
            except Exception as e:
                errors.append(f'Row {row_num}: {str(e)}')
                continue
        
        return created_count, errors


# Document Management System Views
# Enterprise-level document management with version control, workflows, and templates

from rest_framework.decorators import api_view, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser
from django.http import HttpResponse, Http404, FileResponse
from django.core.files.storage import default_storage
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
import hashlib
import mimetypes
import os
import zipfile
import tempfile

from .models import (
    Document, DocumentFolder, DocumentTemplate, DocumentPermission,
    DocumentStatusHistory, DocumentActivity, DocumentAttachment,
    DocumentComment, DocumentFolderPermission
)
from .document_serializers import (
    DocumentSerializer, DocumentListSerializer, DocumentCreateSerializer,
    DocumentFolderSerializer, DocumentTemplateSerializer,
    DocumentStatsSerializer, DocumentUploadSerializer
)


class DocumentViewSet(viewsets.ModelViewSet):
    """Complete document management ViewSet"""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    queryset = Document.objects.all()  # Will be filtered in get_queryset
    serializer_class = DocumentSerializer

    def get_serializer_class(self):
        """Use different serializers for different actions"""
        if self.action == 'list':
            return DocumentListSerializer
        elif self.action == 'create':
            return DocumentCreateSerializer
        return DocumentSerializer
    
    def get_queryset(self):
        """Filter documents based on user permissions"""
        user = self.request.user
        queryset = Document.objects.filter(
            Q(created_by=user) |
            Q(shared_with=user) |
            Q(folder__shared_with=user)
        ).distinct()
        
        # Apply filters
        document_type = self.request.query_params.get('document_type')
        status = self.request.query_params.get('status')
        folder_id = self.request.query_params.get('folder_id')
        is_template = self.request.query_params.get('is_template')
        is_shared = self.request.query_params.get('is_shared')
        search = self.request.query_params.get('search')
        
        if document_type:
            queryset = queryset.filter(document_type=document_type)
        if status:
            queryset = queryset.filter(status=status)
        if folder_id:
            queryset = queryset.filter(folder_id=folder_id)
        if is_template is not None:
            queryset = queryset.filter(is_template=is_template.lower() == 'true')
        if is_shared is not None:
            queryset = queryset.filter(is_shared=is_shared.lower() == 'true')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(filename__icontains=search) |
                Q(tags__contains=[search])
            )
        
        return queryset.order_by('-updated_at')
    
    def perform_create(self, serializer):
        """Set document creator and track activity"""
        document = serializer.save(
            created_by=self.request.user,
            last_modified_by=self.request.user
        )
        
        # Create activity log
        DocumentActivity.objects.create(
            document=document,
            activity_type='created',
            description=f'Document "{document.name}" was created',
            user=self.request.user
        )


class DocumentFolderViewSet(viewsets.ModelViewSet):
    """Document folder management ViewSet"""
    permission_classes = [permissions.IsAuthenticated]
    queryset = DocumentFolder.objects.all()  # Will be filtered in get_queryset
    serializer_class = DocumentFolderSerializer
    
    def get_queryset(self):
        """Filter folders based on user permissions"""
        user = self.request.user
        return DocumentFolder.objects.filter(
            Q(created_by=user) |
            Q(shared_with=user)
        ).distinct().order_by('name')
    
    def perform_create(self, serializer):
        """Set folder creator"""
        serializer.save(created_by=self.request.user)


class DocumentTemplateViewSet(viewsets.ModelViewSet):
    """Document template management ViewSet"""
    permission_classes = [permissions.IsAuthenticated]
    queryset = DocumentTemplate.objects.all()  # Will be filtered in get_queryset
    serializer_class = DocumentTemplateSerializer
    
    def get_queryset(self):
        """Get active templates"""
        return DocumentTemplate.objects.filter(is_active=True).order_by('name')


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def document_upload_api(request):
    """Upload single document"""
    serializer = DocumentUploadSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    file = serializer.validated_data['file']
    
    # Calculate file checksum
    hasher = hashlib.sha256()
    for chunk in file.chunks():
        hasher.update(chunk)
    checksum = hasher.hexdigest()
    
    # Save file
    file_path = default_storage.save(
        f'documents/{timezone.now().year}/{timezone.now().month}/{file.name}',
        file
    )
    
    # Get folder if provided
    folder = None
    if serializer.validated_data.get('folder_id'):
        try:
            folder = DocumentFolder.objects.get(
                Q(id=serializer.validated_data['folder_id']) &
                (Q(created_by=request.user) | Q(shared_with=request.user))
            )
        except DocumentFolder.DoesNotExist:
            pass
    
    # Create document record
    document = Document.objects.create(
        name=serializer.validated_data.get('name') or file.name,
        filename=file.name,
        file_path=file_path,
        file_size=file.size,
        file_type=file.name.split('.')[-1].lower() if '.' in file.name else '',
        mime_type=file.content_type or mimetypes.guess_type(file.name)[0] or 'application/octet-stream',
        checksum=checksum,
        document_type=serializer.validated_data['document_type'],
        folder=folder,
        tags=serializer.validated_data['tags'],
        is_template=serializer.validated_data['is_template'],
        metadata=serializer.validated_data['metadata'],
        created_by=request.user,
        last_modified_by=request.user
    )
    
    # Create activity log
    DocumentActivity.objects.create(
        document=document,
        activity_type='created',
        description=f'Document "{document.name}" was uploaded',
        user=request.user
    )
    
    # Return document using serializer
    document_serializer = DocumentListSerializer(document)
    return Response(document_serializer.data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def document_download_api(request, document_id):
    """Download document file"""
    try:
        document = Document.objects.get(
            Q(id=document_id) &
            (Q(created_by=request.user) |
             Q(shared_with=request.user) |
             Q(folder__shared_with=request.user))
        )
        
        # Track download activity
        DocumentActivity.objects.create(
            document=document,
            activity_type='downloaded',
            description=f'Document "{document.name}" was downloaded',
            user=request.user
        )
        
        # Update last accessed time
        document.last_accessed_at = timezone.now()
        document.save(update_fields=['last_accessed_at'])
        
        # Return file response
        if default_storage.exists(document.file_path):
            return FileResponse(
                default_storage.open(document.file_path, 'rb'),
                as_attachment=True,
                filename=document.filename
            )
        else:
            return Response({'error': 'File not found'}, status=status.HTTP_404_NOT_FOUND)
            
    except Document.DoesNotExist:
        return Response({'error': 'Document not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def document_stats_api(request):
    """Get document statistics"""
    user_documents = Document.objects.filter(
        Q(created_by=request.user) |
        Q(shared_with=request.user)
    ).distinct()
    
    stats_data = {
        'total_documents': user_documents.count(),
        'total_size': user_documents.aggregate(total=Sum('file_size'))['total'] or 0,
        'documents_by_type': {},
        'documents_by_status': {},
        'recent_activity_count': DocumentActivity.objects.filter(
            document__in=user_documents,
            created_at__gte=timezone.now() - timedelta(days=7)
        ).count(),
        'shared_documents_count': user_documents.filter(is_shared=True).count(),
        'template_documents_count': user_documents.filter(is_template=True).count()
    }
    
    # Documents by type
    for doc_type, _ in Document.DOCUMENT_TYPE_CHOICES:
        count = user_documents.filter(document_type=doc_type).count()
        if count > 0:
            stats_data['documents_by_type'][doc_type] = count
    
    # Documents by status
    for doc_status, _ in Document.STATUS_CHOICES:
        count = user_documents.filter(status=doc_status).count()
        if count > 0:
            stats_data['documents_by_status'][doc_status] = count
    
    # Use serializer for validation and consistent output
    serializer = DocumentStatsSerializer(data=stats_data)
    serializer.is_valid(raise_exception=True)
    return Response(serializer.validated_data)


# Placeholder functions for advanced features that will be implemented later
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def document_bulk_upload_api(request):
    return Response({'message': 'Feature coming soon'}, status=status.HTTP_501_NOT_IMPLEMENTED)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def document_bulk_download_api(request):
    """Download multiple documents as ZIP"""
    document_ids = request.data.get('document_ids', [])
    
    if not document_ids:
        return Response({'error': 'No document IDs provided'}, status=status.HTTP_400_BAD_REQUEST)
    
    documents = Document.objects.filter(
        Q(id__in=document_ids) &
        (Q(created_by=request.user) |
         Q(shared_with=request.user) |
         Q(folder__shared_with=request.user))
    ).distinct()
    
    if not documents.exists():
        return Response({'error': 'No accessible documents found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Create temporary ZIP file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as tmp_file:
        with zipfile.ZipFile(tmp_file, 'w') as zip_file:
            for document in documents:
                if default_storage.exists(document.file_path):
                    with default_storage.open(document.file_path, 'rb') as doc_file:
                        zip_file.writestr(document.filename, doc_file.read())
                    
                    # Track download activity
                    DocumentActivity.objects.create(
                        document=document,
                        activity_type='downloaded',
                        description=f'Document "{document.name}" was bulk downloaded',
                        user=request.user
                    )
        
        # Return ZIP file
        response = FileResponse(
            open(tmp_file.name, 'rb'),
            as_attachment=True,
            filename=f'documents_{timezone.now().strftime("%Y%m%d_%H%M%S")}.zip'
        )
        
        # Clean up temp file after response
        def cleanup():
            try:
                os.unlink(tmp_file.name)
            except OSError:
                pass
        
        # Schedule cleanup (will happen after response is sent)
        import atexit
        atexit.register(cleanup)
        
        return response

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def document_bulk_delete_api(request):
    """Delete multiple documents"""
    document_ids = request.data.get('document_ids', [])
    
    if not document_ids:
        return Response({'error': 'No document IDs provided'}, status=status.HTTP_400_BAD_REQUEST)
    
    documents = Document.objects.filter(
        Q(id__in=document_ids) &
        Q(created_by=request.user)  # Only allow deletion by creator
    )
    
    if not documents.exists():
        return Response({'error': 'No deletable documents found'}, status=status.HTTP_404_NOT_FOUND)
    
    deleted_count = 0
    deleted_names = []
    
    for document in documents:
        # Create activity log before deletion
        DocumentActivity.objects.create(
            document=document,
            activity_type='deleted',
            description=f'Document "{document.name}" was bulk deleted',
            user=request.user
        )
        
        # Delete file from storage
        if default_storage.exists(document.file_path):
            try:
                default_storage.delete(document.file_path)
            except Exception as e:
                print(f"Error deleting file {document.file_path}: {e}")
        
        deleted_names.append(document.name)
        document.delete()
        deleted_count += 1
    
    return Response({
        'deleted_count': deleted_count,
        'deleted_documents': deleted_names,
        'message': f'Successfully deleted {deleted_count} document(s)'
    })

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def document_versions_api(request, document_id):
    return Response({'message': 'Feature coming soon'}, status=status.HTTP_501_NOT_IMPLEMENTED)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def document_version_download_api(request, document_id, version):
    return Response({'message': 'Feature coming soon'}, status=status.HTTP_501_NOT_IMPLEMENTED)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def document_version_compare_api(request, document_id):
    return Response({'message': 'Feature coming soon'}, status=status.HTTP_501_NOT_IMPLEMENTED)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def document_version_revert_api(request, document_id, version):
    return Response({'message': 'Feature coming soon'}, status=status.HTTP_501_NOT_IMPLEMENTED)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def document_duplicate_api(request, document_id):
    """Duplicate a document"""
    try:
        original = Document.objects.get(
            Q(id=document_id) &
            (Q(created_by=request.user) |
             Q(shared_with=request.user) |
             Q(folder__shared_with=request.user))
        )
        
        # Create duplicate with new name
        custom_name = request.data.get('name', f"Copy of {original.name}")
        
        duplicate = Document.objects.create(
            name=custom_name,
            filename=f"copy_{original.filename}",
            file_path=original.file_path,  # Share same file initially
            file_size=original.file_size,
            file_type=original.file_type,
            mime_type=original.mime_type,
            checksum=original.checksum,
            document_type=original.document_type,
            folder=original.folder,
            tags=original.tags.copy(),
            is_template=original.is_template,
            template_variables=original.template_variables.copy(),
            metadata=original.metadata.copy(),
            created_by=request.user,
            last_modified_by=request.user
        )
        
        # Create activity log for both documents
        DocumentActivity.objects.create(
            document=duplicate,
            activity_type='created',
            description=f'Document duplicated from "{original.name}"',
            user=request.user
        )
        
        DocumentActivity.objects.create(
            document=original,
            activity_type='updated',
            description=f'Document was duplicated as "{duplicate.name}"',
            user=request.user
        )
        
        # Return duplicated document
        serializer = DocumentListSerializer(duplicate)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
        
    except Document.DoesNotExist:
        return Response({'error': 'Document not found or access denied'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def document_share_api(request, document_id):
    """Share document with other users"""
    try:
        document = Document.objects.get(
            Q(id=document_id) &
            (Q(created_by=request.user) |
             Q(permissions__user=request.user, permissions__can_share=True))
        )
        
        email = request.data.get('email')
        permission_level = request.data.get('permission_level', 'view')
        
        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Find user by email
        try:
            user_to_share = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if already shared
        permission, created = DocumentPermission.objects.get_or_create(
            document=document,
            user=user_to_share,
            defaults={
                'permission_level': permission_level,
                'can_view': True,
                'can_edit': permission_level in ['edit', 'admin'],
                'can_delete': permission_level == 'admin',
                'can_share': permission_level == 'admin',
                'can_download': True,
                'granted_by': request.user
            }
        )
        
        if not created:
            # Update existing permission
            permission.permission_level = permission_level
            permission.can_view = True
            permission.can_edit = permission_level in ['edit', 'admin']
            permission.can_delete = permission_level == 'admin'
            permission.can_share = permission_level == 'admin'
            permission.can_download = True
            permission.granted_by = request.user
            permission.save()
        
        # Mark document as shared
        document.is_shared = True
        document.save()
        
        # Create activity log
        DocumentActivity.objects.create(
            document=document,
            activity_type='shared',
            description=f'Document shared with {user_to_share.email} ({permission_level} access)',
            user=request.user
        )
        
        return Response({
            'message': f'Document shared with {email}',
            'permission_level': permission_level,
            'created': created
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
        
    except Document.DoesNotExist:
        return Response({'error': 'Document not found or access denied'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def document_activity_api(request, document_id):
    return Response({'message': 'Feature coming soon'}, status=status.HTTP_501_NOT_IMPLEMENTED)

@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def document_attachments_api(request, document_id):
    return Response({'message': 'Feature coming soon'}, status=status.HTTP_501_NOT_IMPLEMENTED)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def document_attachment_download_api(request, document_id, attachment_id):
    return Response({'message': 'Feature coming soon'}, status=status.HTTP_501_NOT_IMPLEMENTED)

@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def document_comments_api(request, document_id):
    return Response({'message': 'Feature coming soon'}, status=status.HTTP_501_NOT_IMPLEMENTED)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def document_generate_api(request):
    return Response({'message': 'Feature coming soon'}, status=status.HTTP_501_NOT_IMPLEMENTED)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def document_merge_api(request):
    return Response({'message': 'Feature coming soon'}, status=status.HTTP_501_NOT_IMPLEMENTED)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def shared_documents_api(request):
    """Get documents shared with the user"""
    shared_docs = Document.objects.filter(
        shared_with=request.user
    ).order_by('-updated_at')
    
    serializer = DocumentListSerializer(shared_docs, many=True)
    return Response(serializer.data)