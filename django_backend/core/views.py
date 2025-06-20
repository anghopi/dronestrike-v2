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

from .models import Company, UserProfile, County, Property, Lead
from .serializers import (
    CompanySerializer, UserProfileSerializer, CountySerializer,
    PropertySerializer, LeadSerializer, LeadCreateSerializer,
    LoanCalculationSerializer, TokenTransactionSerializer
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
    """Lead management API with workflow integration"""
    queryset = Lead.objects.select_related('owner', 'property__county').prefetch_related('property__leads')
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['lead_status', 'workflow_stage', 'owner_type', 'mailing_state', 'owner']
    search_fields = ['first_name', 'last_name', 'email', 'mailing_city', 'phone_cell']
    ordering_fields = ['score_value', 'created_at', 'last_contact']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return LeadCreateSerializer
        return LeadSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        # Users see their own leads or company leads if manager/admin
        if self.request.user.profile.role in ['admin', 'manager']:
            return queryset.filter(owner__profile__company=self.request.user.profile.company)
        return queryset.filter(owner=self.request.user)
    
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
            # Create user
            user = User.objects.create_user(
                username=data.get('username'),
                email=data.get('email'),
                password=data.get('password'),
                first_name=data.get('first_name', ''),
                last_name=data.get('last_name', '')
            )
            
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