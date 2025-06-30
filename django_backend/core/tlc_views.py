"""
TLC (Tax Lien Capital) Views
Django REST API views for TLC client management
Translated and improved from Laravel TLC system
"""

from rest_framework import viewsets, status, permissions, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q, Count, Sum, Avg
from django.db import transaction
from decimal import Decimal
from datetime import datetime, timedelta
import csv
import io
import uuid

from .models import (
    TLCClient, TLCClientAddress, TLCTaxInfo, TLCPropertyValuation,
    TLCLoanInfo, TLCClientNote, TLCImportJob, TLCImportError
)
from .serializers import (
    TLCClientSerializer, TLCClientCreateSerializer, TLCImportJobSerializer,
    TLCClientNoteSerializer
)


class TLCClientViewSet(viewsets.ModelViewSet):
    """TLC Client management API"""
    queryset = TLCClient.objects.all().select_related(
        'tax_info', 'property_valuation', 'loan_info'
    ).prefetch_related('addresses', 'notes')
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['status', 'workflow_stage', 'assigned_agent']
    search_fields = ['first_name', 'last_name', 'email', 'client_number']
    ordering_fields = ['created_at', 'last_contact', 'first_name', 'last_name']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return TLCClientCreateSerializer
        return TLCClientSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Apply advanced filters
        status_filter = self.request.query_params.getlist('status[]')
        if status_filter:
            queryset = queryset.filter(status__in=status_filter)
        
        workflow_filter = self.request.query_params.getlist('workflow_stage[]')
        if workflow_filter:
            queryset = queryset.filter(workflow_stage__in=workflow_filter)
        
        counties = self.request.query_params.getlist('counties[]')
        if counties:
            queryset = queryset.filter(addresses__county__in=counties, addresses__address_type='property')
        
        # Date range filter
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)
        
        # Amount range filter
        tax_min = self.request.query_params.get('tax_amount_min')
        tax_max = self.request.query_params.get('tax_amount_max')
        if tax_min:
            queryset = queryset.filter(tax_info__total_amount_due__gte=tax_min)
        if tax_max:
            queryset = queryset.filter(tax_info__total_amount_due__lte=tax_max)
        
        # Search term
        search_term = self.request.query_params.get('search_term')
        if search_term:
            queryset = queryset.filter(
                Q(first_name__icontains=search_term) |
                Q(last_name__icontains=search_term) |
                Q(email__icontains=search_term) |
                Q(client_number__icontains=search_term) |
                Q(tax_info__account_number__icontains=search_term)
            )
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def dashboard_stats(self, request):
        """Get TLC dashboard statistics"""
        queryset = self.get_queryset()
        
        # Basic counts
        total_clients = queryset.count()
        active_loans = queryset.filter(loan_info__status='funded').count()
        pending_applications = queryset.filter(status='applicant').count()
        
        # Status distribution
        status_stats = queryset.values('status').annotate(count=Count('id')).order_by('-count')
        
        # County distribution
        county_stats = queryset.filter(addresses__address_type='property').values(
            'addresses__county'
        ).annotate(
            count=Count('id'),
            total_amount=Sum('tax_info__total_amount_due'),
            avg_amount=Avg('tax_info__total_amount_due')
        ).order_by('-count')[:10]
        
        # Monthly trends (last 6 months)
        monthly_trends = []
        for i in range(6):
            month_start = datetime.now().replace(day=1) - timedelta(days=30*i)
            month_end = month_start.replace(day=28) + timedelta(days=4)
            month_end = month_end - timedelta(days=month_end.day)
            
            month_clients = queryset.filter(
                created_at__gte=month_start,
                created_at__lt=month_end
            )
            
            monthly_trends.append({
                'month': month_start.strftime('%b'),
                'new_clients': month_clients.count(),
                'loans_funded': month_clients.filter(loan_info__status='funded').count(),
                'total_funded_amount': month_clients.filter(
                    loan_info__status='funded'
                ).aggregate(total=Sum('loan_info__loan_amount'))['total'] or 0
            })
        
        # Performance metrics
        total_loan_amount = queryset.aggregate(
            total=Sum('loan_info__loan_amount')
        )['total'] or 0
        
        avg_processing_time = 14.5  # TODO: Calculate based on workflow timestamps
        approval_rate = 78.3  # TODO: Calculate based on application outcomes
        
        return Response({
            'total_clients': total_clients,
            'active_loans': active_loans,
            'total_loan_amount': float(total_loan_amount),
            'pending_applications': pending_applications,
            'clients_by_status': [
                {
                    'status': item['status'],
                    'count': item['count'],
                    'percentage': round((item['count'] / total_clients * 100) if total_clients > 0 else 0, 1)
                }
                for item in status_stats
            ],
            'loans_by_county': [
                {
                    'county': item['addresses__county'],
                    'count': item['count'],
                    'total_amount': float(item['total_amount'] or 0),
                    'avg_amount': float(item['avg_amount'] or 0)
                }
                for item in county_stats
            ],
            'monthly_trends': list(reversed(monthly_trends)),
            'performance_metrics': {
                'avg_processing_time_days': avg_processing_time,
                'approval_rate': approval_rate,
                'default_rate': 3.2,
                'avg_loan_amount': float(total_loan_amount / active_loans) if active_loans > 0 else 0,
                'avg_ltv_ratio': 65.8
            }
        })
    
    @action(detail=True, methods=['post'])
    def add_note(self, request, pk=None):
        """Add a note to a client"""
        client = self.get_object()
        serializer = TLCClientNoteSerializer(data=request.data)
        
        if serializer.is_valid():
            serializer.save(
                client=client,
                created_by=request.user.username
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def update_workflow_stage(self, request, pk=None):
        """Update client workflow stage"""
        client = self.get_object()
        new_stage = request.data.get('workflow_stage')
        
        if new_stage not in dict(TLCClient.WORKFLOW_CHOICES):
            return Response({
                'error': 'Invalid workflow stage'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        client.workflow_stage = new_stage
        client.last_activity = datetime.now()
        client.save()
        
        # Add automatic note
        TLCClientNote.objects.create(
            client=client,
            content=f"Workflow stage updated to: {new_stage}",
            note_type='general',
            created_by=request.user.username
        )
        
        return Response({
            'success': True,
            'workflow_stage': new_stage
        })


class TLCCSVUploadView(generics.CreateAPIView):
    """TLC CSV file upload and processing endpoint"""
    permission_classes = [permissions.IsAuthenticated]
    
    def create(self, request, *args, **kwargs):
        try:
            # Check if file was uploaded
            if 'file' not in request.FILES:
                return Response({
                    'error': 'No file uploaded'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            file = request.FILES['file']
            
            # Validate file type
            if not file.name.lower().endswith('.csv'):
                return Response({
                    'error': 'File must be a CSV file'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create import job
            import_job = TLCImportJob.objects.create(
                filename=file.name,
                file_size=file.size,
                created_by=request.user,
                status='pending'
            )
            
            # Process CSV file
            self._process_csv_file(file, import_job)
            
            return Response(
                TLCImportJobSerializer(import_job).data,
                status=status.HTTP_201_CREATED
            )
            
        except Exception as e:
            return Response({
                'error': f'CSV processing failed: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)
    
    def _process_csv_file(self, file, import_job):
        """Process TLC CSV file"""
        try:
            import_job.status = 'processing'
            import_job.started_at = datetime.now()
            import_job.save()
            
            # Read CSV file with encoding detection
            try:
                file_data = file.read().decode('utf-8')
            except UnicodeDecodeError:
                file.seek(0)  # Reset file pointer
                try:
                    file_data = file.read().decode('latin-1')
                except UnicodeDecodeError:
                    file.seek(0)  # Reset file pointer
                    file_data = file.read().decode('cp1252', errors='ignore')
            csv_reader = csv.DictReader(io.StringIO(file_data))
            
            # Count total rows
            rows = list(csv_reader)
            import_job.total_rows = len(rows)
            import_job.save()
            
            # Process each row
            for row_num, row in enumerate(rows, start=2):
                try:
                    with transaction.atomic():
                        self._process_csv_row(row, import_job, row_num)
                        import_job.successful_rows += 1
                        
                except Exception as e:
                    import_job.failed_rows += 1
                    TLCImportError.objects.create(
                        import_job=import_job,
                        row_number=row_num,
                        column='general',
                        error_message=str(e),
                        raw_data=str(row)[:500]
                    )
                
                # Update progress
                import_job.processed_rows = row_num - 1
                import_job.progress_percentage = (import_job.processed_rows / import_job.total_rows) * 100
                
                if row_num % 100 == 0:  # Save progress every 100 rows
                    import_job.save()
            
            # Finalize import
            import_job.status = 'completed'
            import_job.completed_at = datetime.now()
            import_job.progress_percentage = 100
            import_job.save()
            
        except Exception as e:
            import_job.status = 'failed'
            import_job.completed_at = datetime.now()
            import_job.save()
            
            TLCImportError.objects.create(
                import_job=import_job,
                row_number=0,
                column='system',
                error_message=f'Processing failed: {str(e)}',
                raw_data=''
            )
    
    def _process_csv_row(self, row, import_job, row_num):
        """Process a single CSV row"""
        # Extract and validate data from CSV row
        client_data = self._extract_client_data(row)
        
        # Check for duplicates (only if account number is not empty)
        account_number = client_data['tax_info']['account_number']
        if account_number and account_number.strip():
            existing_client = TLCClient.objects.filter(
                tax_info__account_number=account_number
            ).first()
            
            if existing_client:
                import_job.duplicate_clients += 1
                raise ValueError(f"Duplicate client: {account_number}")
        
        # Check for email duplicates (only if email exists)
        if client_data.get('email'):
            existing_email = TLCClient.objects.filter(email=client_data['email']).first()
            if existing_email:
                import_job.duplicate_clients += 1 
                raise ValueError(f"Duplicate email: {client_data['email']}")
        
        # Generate client number if not provided
        client_number = f"TLC{str(uuid.uuid4())[:8].upper()}"
        
        # Create client with related data
        client = TLCClient.objects.create(
            client_number=client_number,
            first_name=client_data['first_name'],
            last_name=client_data['last_name'],
            email=client_data.get('email'),
            phone_primary=client_data.get('phone_primary'),
            status='prospect',
            workflow_stage='initial_contact',
            lead_source='csv_import'
        )
        
        # Create addresses
        if client_data.get('mailing_address'):
            TLCClientAddress.objects.create(
                client=client,
                address_type='mailing',
                **client_data['mailing_address']
            )
        
        if client_data.get('property_address'):
            TLCClientAddress.objects.create(
                client=client,
                address_type='property',
                **client_data['property_address']
            )
        
        # Create tax info
        TLCTaxInfo.objects.create(
            client=client,
            **client_data['tax_info']
        )
        
        # Create property valuation if available
        if client_data.get('property_valuation'):
            TLCPropertyValuation.objects.create(
                client=client,
                **client_data['property_valuation']
            )
    
    def _extract_client_data(self, row):
        """Extract client data from CSV row with flexible column mapping"""
        # Default field mappings for Tarrant County CSV format
        def get_value(keys, default=None):
            for key in keys:
                if key in row and row[key]:
                    return row[key].strip()
            return default
        
        # Extract name - handle "OwnerName" field from Tarrant CSV
        full_name = get_value(['OwnerName', 'Owner Name', 'owner_name', 'name'])
        name_parts = full_name.split() if full_name else ['', '']
        first_name = name_parts[0] if name_parts else ''
        last_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else ''
        
        # Extract email and phone
        email = get_value(['Email', 'email', 'owner_email'])
        phone = get_value(['Phone', 'phone', 'owner_phone'])
        
        # Extract addresses - handle Tarrant CSV fields
        mailing_address = {
            'street_1': get_value(['OwnerStreet', 'Mailing Address', 'mailing_address', 'owner_address'], ''),
            'city': get_value(['OwnerCity', 'Mailing City', 'mailing_city', 'owner_city'], ''),
            'state': get_value(['OwnerState', 'Mailing State', 'mailing_state', 'owner_state'], 'TX'),
            'zip_code': get_value(['OwnerZIP', 'Mailing ZIP', 'mailing_zip', 'owner_zip'], ''),
            'county': get_value(['JDX', 'County', 'county'], 'Randall')
        }
        
        property_address = {
            'street_1': get_value(['PropStreet', 'Property Address', 'property_address', 'address'], ''),
            'city': get_value(['PropCity', 'Property City', 'property_city', 'city'], ''),
            'state': get_value(['PropState', 'Property State', 'property_state', 'state'], 'TX'),
            'zip_code': get_value(['PropZIP', 'Property ZIP', 'property_zip', 'zip'], ''),
            'county': get_value(['JDX', 'County', 'county'], 'Randall')
        }
        
        # Extract tax information
        def parse_currency(value):
            if not value:
                return Decimal('0')
            # Remove currency symbols and commas
            clean_value = str(value).replace('$', '').replace(',', '').strip()
            try:
                return Decimal(clean_value)
            except:
                return Decimal('0')
        
        tax_info = {
            'account_number': get_value(['TAXID', 'Account Number', 'account_number', 'account'], ''),
            'tax_year': int(get_value(['Tax Year', 'tax_year', 'year'], '2024')),
            'original_tax_amount': parse_currency(get_value(['Tax', 'Tax Amount', 'original_tax', 'taxes'])),
            'penalties_interest': parse_currency(get_value(['Fees', 'Penalties', 'penalties', 'interest'])),
            'attorney_fees': parse_currency(get_value(['Attorney Fees', 'attorney_fees', 'fees'])),
            'total_amount_due': parse_currency(get_value(['Total Due', 'total_due', 'amount_due'])) or 
                                (parse_currency(get_value(['Tax', 'Tax Amount', 'original_tax', 'taxes'])) + 
                                 parse_currency(get_value(['Fees', 'Penalties', 'penalties', 'interest'])))
        }
        
        # Extract property valuation
        property_valuation = {
            'market_total_value': parse_currency(get_value(['Market Value', 'market_value', 'value'])),
            'assessed_total_value': parse_currency(get_value(['Assessed Value', 'assessed_value'])),
            'assessed_land_value': parse_currency(get_value(['Land Value', 'land_value'])),
            'assessed_improvement_value': parse_currency(get_value(['Improvement Value', 'improvement_value']))
        }
        
        return {
            'first_name': first_name,
            'last_name': last_name,
            'email': email if email and '@' in email else None,
            'phone_primary': phone,
            'mailing_address': mailing_address if mailing_address['street_1'] else None,
            'property_address': property_address if property_address['street_1'] else None,
            'tax_info': tax_info,
            'property_valuation': property_valuation if property_valuation['market_total_value'] > 0 else None
        }


class TLCImportJobViewSet(viewsets.ReadOnlyModelViewSet):
    """TLC import job monitoring"""
    queryset = TLCImportJob.objects.all()
    serializer_class = TLCImportJobSerializer
    permission_classes = [permissions.IsAuthenticated]
    ordering = ['-created_at']
    
    def get_queryset(self):
        # Users can only see their own import jobs
        return super().get_queryset().filter(created_by=self.request.user)