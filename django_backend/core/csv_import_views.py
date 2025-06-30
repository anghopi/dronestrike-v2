"""
CSV Import API views for DroneStrike v2
Handles TARRANT-style tax data imports with sophisticated processing
"""

import json
import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.core.files.storage import default_storage
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser

from .csv_import_system import CSVImportService, TarrantCSVProcessor, CSVImportError
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.csv_service import CSVDataService
from .user_roles import UserPermission
from .token_engine import TokenEngine

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_csv_file_api(request):
    """
    Upload and validate CSV file for import
    """
    # Check permission
    if not request.user.profile.has_permission(UserPermission.CAN_IMPORT_LEADS):
        return Response({'error': 'No permission to import leads'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    if 'file' not in request.FILES:
        return Response({'error': 'No file uploaded'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    uploaded_file = request.FILES['file']
    
    # Validate file type
    if not uploaded_file.name.endswith('.csv'):
        return Response({'error': 'Only CSV files are allowed'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    # Validate file size (max 50MB)
    max_size = 50 * 1024 * 1024  # 50MB
    if uploaded_file.size > max_size:
        return Response({'error': f'File too large. Maximum size is {max_size // (1024*1024)}MB'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Read file content
        file_content = uploaded_file.read().decode('utf-8-sig')  # Handle BOM
        
        # Validate CSV structure
        processor = TarrantCSVProcessor(request.user)
        is_valid, message, headers = processor.validate_csv_structure(file_content)
        
        if not is_valid:
            return Response({
                'error': message,
                'valid': False
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Estimate token cost
        total_rows = processor.import_stats['total_rows']
        estimated_tokens = max(1, total_rows // 100)
        
        # Check token availability
        can_afford, token_message, cost_breakdown = TokenEngine.check_token_availability(
            request.user, 'csv_import_row', estimated_tokens
        )
        
        # Store file temporarily for import
        temp_filename = f"temp_csv_{request.user.id}_{uploaded_file.name}"
        file_path = default_storage.save(temp_filename, uploaded_file)
        
        return Response({
            'valid': True,
            'message': message,
            'file_info': {
                'filename': uploaded_file.name,
                'size': uploaded_file.size,
                'temp_path': file_path,
                'total_rows': total_rows,
                'headers': headers[:10],  # First 10 headers for preview
                'total_headers': len(headers)
            },
            'cost_estimate': {
                'estimated_tokens': estimated_tokens,
                'can_afford': can_afford,
                'token_message': token_message,
                'user_balance': request.user.profile.tokens
            }
        })
    
    except Exception as e:
        logger.error(f"CSV upload validation failed: {str(e)}")
        return Response({'error': f'File validation failed: {str(e)}'}, 
                       status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def import_csv_api(request):
    """
    Import validated CSV file
    """
    try:
        data = json.loads(request.body)
        temp_file_path = data.get('temp_file_path')
        import_options = data.get('options', {})
        
        if not temp_file_path:
            return Response({'error': 'temp_file_path is required'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        # Check permission
        if not request.user.profile.has_permission(UserPermission.CAN_IMPORT_LEADS):
            return Response({'error': 'No permission to import leads'}, 
                           status=status.HTTP_403_FORBIDDEN)
        
        # Read file from temporary storage
        try:
            with default_storage.open(temp_file_path, 'r') as f:
                file_content = f.read()
        except Exception as e:
            return Response({'error': 'Temporary file not found or expired'}, 
                           status=status.HTTP_404_NOT_FOUND)
        
        # Start import process
        logger.info(f"Starting CSV import for user {request.user.username}")
        
        result = CSVImportService.import_tarrant_csv(
            user=request.user,
            file_content=file_content,
            filename=temp_file_path.split('_')[-1] if '_' in temp_file_path else 'unknown.csv'
        )
        
        # Clean up temporary file
        try:
            default_storage.delete(temp_file_path)
        except:
            pass  # Ignore cleanup errors
        
        if result['success']:
            return Response({
                'success': True,
                'message': result['message'],
                'import_stats': result['stats'],
                'batch_id': result['batch_id'],
                'recommendations': _generate_import_recommendations(result['stats'])
            }, status=status.HTTP_201_CREATED)
        else:
            return Response({
                'success': False,
                'message': result['message'],
                'import_stats': result['stats'],
                'errors': result['stats'].get('errors', [])[:10]  # First 10 errors
            }, status=status.HTTP_400_BAD_REQUEST)
    
    except CSVImportError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except PermissionError as e:
        return Response({'error': str(e)}, status=status.HTTP_403_FORBIDDEN)
    except Exception as e:
        logger.error(f"CSV import failed: {str(e)}")
        return Response({'error': f'Import failed: {str(e)}'}, 
                       status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def import_history_api(request):
    """
    Get user's import history
    """
    # Get user's leads grouped by import batch
    from django.db.models import Count, Max, Min
    from .models import Lead
    
    import_batches = Lead.objects.filter(
        owner=request.user,
        source_batch__isnull=False
    ).values('source_batch', 'imported_from').annotate(
        lead_count=Count('id'),
        latest_import=Max('created_at'),
        earliest_import=Min('created_at')
    ).order_by('-latest_import')
    
    history_data = []
    for batch in import_batches:
        # Get sample leads from this batch
        sample_leads = Lead.objects.filter(
            owner=request.user,
            source_batch=batch['source_batch']
        ).select_related('property')[:5]
        
        history_data.append({
            'batch_id': batch['source_batch'],
            'import_source': batch['imported_from'],
            'lead_count': batch['lead_count'],
            'imported_at': batch['latest_import'].isoformat(),
            'sample_leads': [{
                'id': lead.id,
                'name': f"{lead.first_name} {lead.last_name}",
                'city': lead.mailing_city,
                'state': lead.mailing_state,
                'property_value': str(lead.property.total_value) if lead.property else None,
                'taxes_due': str(lead.property.ple_amount_due) if lead.property and lead.property.ple_amount_due else None
            } for lead in sample_leads]
        })
    
    return Response({
        'import_history': history_data,
        'total_imports': len(history_data),
        'total_leads_imported': sum(batch['lead_count'] for batch in import_batches)
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def csv_template_api(request):
    """
    Get CSV template information and download links
    """
    template_info = {
        'tarrant_template': {
            'name': 'TARRANT County Tax Delinquent Properties',
            'description': 'Standard 79-field format for Texas tax lien properties',
            'required_fields': [
                'OwnerName',
                'PropStreet', 
                'Tax',
                'ValueAss'
            ],
            'recommended_fields': [
                'OwnerStreet',
                'OwnerCityState', 
                'OwnerZip',
                'PropCity',
                'PropState',
                'PropZip',
                'Fees',
                'PriorDue',
                'Total',
                'PropertyType',
                'AccountNumber',
                'Latitude',
                'Longitude'
            ],
            'optional_fields': [
                'YearBuilt',
                'SquareFeet',
                'Bedrooms',
                'Bathrooms',
                'LotSize',
                'law suit active',
                'Lawsuit No',
                'LastPayment',
                'LastPaymentDate',
                'DelinquentYears',
                'DoNotMail',
                'DoNotEmail',
                'DoNotCall'
            ],
            'sample_data': {
                'OwnerName': 'SMITH JOHN',
                'PropStreet': '123 MAIN ST',
                'PropCity': 'DALLAS', 
                'PropState': 'TX',
                'PropZip': '75201',
                'Tax': '2500.00',
                'Fees': '125.00',
                'ValueAss': '125000',
                'PropertyType': 'Single Family',
                'AccountNumber': 'R123456789'
            }
        }
    }
    
    return Response({
        'templates': template_info,
        'supported_formats': ['CSV'],
        'max_file_size_mb': 50,
        'encoding': 'UTF-8 (with or without BOM)',
        'delimiter': 'Comma (,)',
        'text_qualifier': 'Double quotes (")'
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def validate_csv_data_api(request):
    """
    Validate CSV data without importing
    """
    try:
        data = json.loads(request.body)
        temp_file_path = data.get('temp_file_path')
        sample_rows = data.get('sample_rows', 10)
        
        if not temp_file_path:
            return Response({'error': 'temp_file_path is required'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        # Read file
        try:
            with default_storage.open(temp_file_path, 'r') as f:
                file_content = f.read()
        except Exception as e:
            return Response({'error': 'Temporary file not found'}, 
                           status=status.HTTP_404_NOT_FOUND)
        
        # Validate and analyze data
        processor = TarrantCSVProcessor(request.user)
        
        # Get headers and structure validation
        is_valid, message, headers = processor.validate_csv_structure(file_content)
        
        if not is_valid:
            return Response({
                'valid': False,
                'message': message
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Analyze sample rows
        import csv
        import io
        
        csv_reader = csv.DictReader(io.StringIO(file_content))
        sample_data = []
        validation_issues = []
        
        for i, row in enumerate(csv_reader):
            if i >= sample_rows:
                break
            
            # Process row for validation
            try:
                processed_row = processor.process_csv_row(row, i + 1, headers)
                if processed_row:
                    sample_data.append({
                        'row_number': i + 1,
                        'owner_name': processed_row['lead_data'].get('owner_name', ''),
                        'property_address': processed_row['property_data'].get('address1', ''),
                        'tax_amount': str(processed_row['property_data'].get('tax_amount', '')),
                        'property_value': str(processed_row['property_data'].get('assessed_value', '')),
                        'valid': True
                    })
            except Exception as e:
                validation_issues.append({
                    'row_number': i + 1,
                    'issue': str(e),
                    'data': dict(row)
                })
                sample_data.append({
                    'row_number': i + 1,
                    'owner_name': row.get('OwnerName', ''),
                    'property_address': row.get('PropStreet', ''),
                    'tax_amount': row.get('Tax', ''),
                    'property_value': row.get('ValueAss', ''),
                    'valid': False,
                    'error': str(e)
                })
        
        return Response({
            'valid': True,
            'message': 'CSV data validation completed',
            'sample_data': sample_data,
            'validation_issues': validation_issues,
            'total_rows': processor.import_stats['total_rows'],
            'headers_mapped': len([h for h in headers if h in processor.FIELD_MAPPING]),
            'headers_unmapped': [h for h in headers if h not in processor.FIELD_MAPPING]
        })
    
    except Exception as e:
        return Response({'error': f'Validation failed: {str(e)}'}, 
                       status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def analyze_csv_structure_api(request):
    """
    Analyze CSV structure and suggest field mappings for general CSV files
    """
    # Check permission
    if not request.user.profile.has_permission(UserPermission.CAN_IMPORT_LEADS):
        return Response({'error': 'No permission to import leads'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    if 'file' not in request.FILES:
        return Response({'error': 'No file uploaded'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    uploaded_file = request.FILES['file']
    
    # Validate file type
    if not uploaded_file.name.endswith('.csv'):
        return Response({'error': 'Only CSV files are allowed'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Read file content
        file_content = uploaded_file.read().decode('utf-8-sig')  # Handle BOM
        
        # Create CSV service for analysis
        csv_service = CSVDataService(csv_content=file_content)
        
        # Analyze structure
        analysis = csv_service.analyze_csv_structure()
        
        return Response({
            'success': True,
            'analysis': analysis,
            'file_info': {
                'filename': uploaded_file.name,
                'size': uploaded_file.size,
                'rows_analyzed': 5  # Sample size
            }
        })
    
    except Exception as e:
        logger.error(f"CSV structure analysis failed: {str(e)}")
        return Response({'error': f'Analysis failed: {str(e)}'}, 
                       status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _generate_import_recommendations(import_stats: dict) -> list:
    """
    Generate recommendations based on import results
    """
    recommendations = []
    
    success_rate = import_stats.get('success_rate', 0)
    
    if success_rate < 50:
        recommendations.append({
            'type': 'warning',
            'message': 'Low success rate detected. Check data quality and field mapping.',
            'action': 'Review error details and consider data cleanup'
        })
    
    if import_stats.get('duplicate_rows', 0) > 0:
        recommendations.append({
            'type': 'info',
            'message': f"Found {import_stats['duplicate_rows']} duplicate records that were skipped.",
            'action': 'Consider deduplication before import'
        })
    
    if import_stats.get('tokens_used', 0) > 0:
        recommendations.append({
            'type': 'info',
            'message': f"Import consumed {import_stats['tokens_used']} tokens.",
            'action': 'Monitor token usage for large imports'
        })
    
    if success_rate > 90:
        recommendations.append({
            'type': 'success',
            'message': 'Excellent import quality! Data is well-formatted.',
            'action': 'Consider using this data source for future imports'
        })
    
    return recommendations


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def import_stats_api(request):
    """
    Get overall import statistics for user
    """
    from django.db.models import Count, Sum, Avg
    from .models import Lead, TokenTransaction
    
    # Get lead statistics
    lead_stats = Lead.objects.filter(owner=request.user).aggregate(
        total_leads=Count('id'),
        imported_leads=Count('id', filter=models.Q(imported_from__isnull=False)),
        total_batches=Count('source_batch', distinct=True)
    )
    
    # Get token usage for imports
    token_stats = TokenTransaction.objects.filter(
        user=request.user,
        action_type__icontains='import'
    ).aggregate(
        total_import_tokens=Sum('tokens_changed'),
        import_transactions=Count('id'),
        avg_tokens_per_import=Avg('tokens_changed')
    )
    
    # Recent import activity (last 30 days)
    from datetime import timedelta
    from django.utils import timezone
    
    recent_imports = Lead.objects.filter(
        owner=request.user,
        created_at__gte=timezone.now() - timedelta(days=30),
        source_batch__isnull=False
    ).values('source_batch').annotate(
        count=Count('id'),
        date=Max('created_at')
    ).order_by('-date')[:10]
    
    return Response({
        'lead_statistics': {
            'total_leads': lead_stats['total_leads'] or 0,
            'imported_leads': lead_stats['imported_leads'] or 0,
            'manual_leads': (lead_stats['total_leads'] or 0) - (lead_stats['imported_leads'] or 0),
            'total_import_batches': lead_stats['total_batches'] or 0
        },
        'token_usage': {
            'total_tokens_used': abs(token_stats['total_import_tokens'] or 0),
            'import_transactions': token_stats['import_transactions'] or 0,
            'avg_tokens_per_import': round(abs(token_stats['avg_tokens_per_import'] or 0), 2)
        },
        'recent_activity': [{
            'batch_id': batch['source_batch'],
            'lead_count': batch['count'],
            'import_date': batch['date'].isoformat()
        } for batch in recent_imports]
    })