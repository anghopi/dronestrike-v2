"""
Targets API views for DroneStrike v2
Comprehensive target management with actions and integrations
"""

from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from django.db.models import Q
import json
from datetime import datetime, timedelta


@api_view(['GET', 'POST'])
@permission_classes([permissions.AllowAny])
def targets_api(request):
    """
    Comprehensive targets API endpoint
    GET: List targets with filtering and search
    POST: Create new target
    """
    
    if request.method == 'GET':
        # Mock target data based on the old DroneStrike system
        targets = [
            {
                'id': 1,
                'name': 'John Smith',
                'email': 'john.smith@email.com',
                'phone': '(555) 123-4567',
                'address': '123 Oak Street',
                'city': 'Dallas',
                'state': 'TX',
                'zip': '75201',
                'property_type': 'Single Family',
                'estimated_value': 285000,
                'tax_delinquent': True,
                'delinquent_amount': 12500,
                'owner_occupied': True,
                'last_contact': '2024-12-15',
                'contact_attempts': 3,
                'status': 'Interested',
                'priority': 'High',
                'lead_score': 92,
                'notes': 'Very interested in quick sale. Facing foreclosure.',
                'tags': ['Hot Lead', 'Foreclosure', 'Quick Sale'],
                'assigned_to': 'Agent Smith',
                'created_at': '2024-12-01T10:00:00Z',
                'updated_at': '2024-12-15T14:30:00Z'
            },
            {
                'id': 2,
                'name': 'Sarah Johnson',
                'email': 'sarah.j@email.com',
                'phone': '(555) 987-6543',
                'address': '456 Main Avenue',
                'city': 'Fort Worth',
                'state': 'TX',
                'zip': '76102',
                'property_type': 'Condo',
                'estimated_value': 195000,
                'tax_delinquent': False,
                'delinquent_amount': 0,
                'owner_occupied': False,
                'last_contact': '2024-12-14',
                'contact_attempts': 1,
                'status': 'Contacted',
                'priority': 'Medium',
                'lead_score': 78,
                'notes': 'Rental property. Owner lives out of state.',
                'tags': ['Rental', 'Out of State'],
                'assigned_to': 'Agent Jones',
                'created_at': '2024-12-05T09:15:00Z',
                'updated_at': '2024-12-14T11:20:00Z'
            },
            {
                'id': 3,
                'name': 'Mike Davis',
                'email': 'mike.davis@email.com',
                'phone': '(555) 456-7890',
                'address': '789 Elm Drive',
                'city': 'Arlington',
                'state': 'TX',
                'zip': '76010',
                'property_type': 'Townhouse',
                'estimated_value': 325000,
                'tax_delinquent': True,
                'delinquent_amount': 8900,
                'owner_occupied': True,
                'last_contact': '2024-12-10',
                'contact_attempts': 5,
                'status': 'Follow Up',
                'priority': 'Critical',
                'lead_score': 95,
                'notes': 'Needs to sell urgently due to job relocation. Very motivated.',
                'tags': ['Urgent', 'Relocation', 'Motivated'],
                'assigned_to': 'Agent Brown',
                'created_at': '2024-11-28T16:45:00Z',
                'updated_at': '2024-12-10T13:22:00Z'
            },
            {
                'id': 4,
                'name': 'Lisa Rodriguez',
                'email': 'lisa.rodriguez@email.com',
                'phone': '(555) 321-0987',
                'address': '321 Pine Street',
                'city': 'Plano',
                'state': 'TX',
                'zip': '75023',
                'property_type': 'Single Family',
                'estimated_value': 410000,
                'tax_delinquent': False,
                'delinquent_amount': 0,
                'owner_occupied': True,
                'last_contact': '2024-12-12',
                'contact_attempts': 2,
                'status': 'New',
                'priority': 'Medium',
                'lead_score': 84,
                'notes': 'Recently inherited property. Considering options.',
                'tags': ['Inherited', 'Considering'],
                'assigned_to': 'Agent Wilson',
                'created_at': '2024-12-08T12:30:00Z',
                'updated_at': '2024-12-12T10:15:00Z'
            },
            {
                'id': 5,
                'name': 'Robert Chen',
                'email': 'robert.chen@email.com',
                'phone': '(555) 654-3210',
                'address': '567 Maple Lane',
                'city': 'Garland',
                'state': 'TX',
                'zip': '75040',
                'property_type': 'Single Family',
                'estimated_value': 220000,
                'tax_delinquent': True,
                'delinquent_amount': 15200,
                'owner_occupied': False,
                'last_contact': '2024-12-09',
                'contact_attempts': 4,
                'status': 'Not Interested',
                'priority': 'Low',
                'lead_score': 45,
                'notes': 'Not interested in selling at this time.',
                'tags': ['Not Interested'],
                'assigned_to': 'Agent Davis',
                'created_at': '2024-11-20T14:20:00Z',
                'updated_at': '2024-12-09T16:45:00Z'
            }
        ]
        
        # Apply filters
        search = request.GET.get('search', '').lower()
        status_filter = request.GET.get('status', 'All')
        priority_filter = request.GET.get('priority', 'All')
        
        if search:
            targets = [t for t in targets if 
                      search in t['name'].lower() or 
                      search in t['email'].lower() or 
                      search in t['address'].lower() or 
                      search in t['city'].lower()]
        
        if status_filter != 'All':
            targets = [t for t in targets if t['status'] == status_filter]
            
        if priority_filter != 'All':
            targets = [t for t in targets if t['priority'] == priority_filter]
        
        return Response({
            'count': len(targets),
            'results': targets,
            'stats': {
                'total_targets': len(targets),
                'high_priority': len([t for t in targets if t['priority'] in ['High', 'Critical']]),
                'tax_delinquent': len([t for t in targets if t['tax_delinquent']]),
                'interested': len([t for t in targets if t['status'] == 'Interested']),
                'avg_lead_score': sum([t['lead_score'] for t in targets]) / len(targets) if targets else 0
            }
        })
    
    elif request.method == 'POST':
        # Create new target
        data = request.data
        new_target = {
            'id': 99,  # In real implementation, this would be auto-generated
            'name': data.get('name', ''),
            'email': data.get('email', ''),
            'phone': data.get('phone', ''),
            'address': data.get('address', ''),
            'city': data.get('city', ''),
            'state': data.get('state', 'TX'),
            'zip': data.get('zip', ''),
            'property_type': data.get('property_type', 'Unknown'),
            'estimated_value': data.get('estimated_value', 0),
            'tax_delinquent': data.get('tax_delinquent', False),
            'delinquent_amount': data.get('delinquent_amount', 0),
            'owner_occupied': data.get('owner_occupied', True),
            'last_contact': None,
            'contact_attempts': 0,
            'status': 'New',
            'priority': data.get('priority', 'Medium'),
            'lead_score': data.get('lead_score', 50),
            'notes': data.get('notes', ''),
            'tags': data.get('tags', []),
            'assigned_to': data.get('assigned_to', 'Unassigned'),
            'created_at': datetime.now().isoformat() + 'Z',
            'updated_at': datetime.now().isoformat() + 'Z'
        }
        
        return Response(new_target, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([permissions.AllowAny])
def target_detail_api(request, target_id):
    """
    Individual target operations
    GET: Get target details
    PUT: Update target
    DELETE: Delete target
    """
    
    # Mock target lookup
    mock_target = {
        'id': target_id,
        'name': 'John Smith',
        'email': 'john.smith@email.com',
        'phone': '(555) 123-4567',
        'address': '123 Oak Street',
        'city': 'Dallas',
        'state': 'TX',
        'zip': '75201',
        'property_type': 'Single Family',
        'estimated_value': 285000,
        'tax_delinquent': True,
        'delinquent_amount': 12500,
        'owner_occupied': True,
        'last_contact': '2024-12-15',
        'contact_attempts': 3,
        'status': 'Interested',
        'priority': 'High',
        'lead_score': 92,
        'notes': 'Very interested in quick sale. Facing foreclosure.',
        'tags': ['Hot Lead', 'Foreclosure', 'Quick Sale'],
        'assigned_to': 'Agent Smith',
        'created_at': '2024-12-01T10:00:00Z',
        'updated_at': '2024-12-15T14:30:00Z'
    }
    
    if request.method == 'GET':
        return Response(mock_target)
    
    elif request.method == 'PUT':
        # Update target
        data = request.data
        updated_target = {**mock_target, **data}
        updated_target['updated_at'] = datetime.now().isoformat() + 'Z'
        return Response(updated_target)
    
    elif request.method == 'DELETE':
        return Response({'message': 'Target deleted successfully'}, status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def target_actions_api(request):
    """
    Bulk actions on targets (like the old DroneStrike system)
    """
    
    action = request.data.get('action')
    target_ids = request.data.get('target_ids', [])
    
    if not action or not target_ids:
        return Response(
            {'error': 'Action and target_ids are required'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Mock action processing
    actions_map = {
        'send_email': 'Email sent to {} targets',
        'make_call': 'Call initiated for {} targets',
        'update_status': 'Status updated for {} targets',
        'assign_agent': 'Agent assigned to {} targets',
        'add_tags': 'Tags added to {} targets',
        'export_data': 'Data exported for {} targets',
        'schedule_followup': 'Follow-up scheduled for {} targets',
        'send_sms': 'SMS sent to {} targets',
        'create_contract': 'Contracts created for {} targets',
        'mark_interested': 'Marked as interested: {} targets',
        'mark_not_interested': 'Marked as not interested: {} targets',
        'move_to_closed': 'Moved to closed: {} targets'
    }
    
    if action in actions_map:
        message = actions_map[action].format(len(target_ids))
        return Response({
            'success': True,
            'message': message,
            'action': action,
            'affected_targets': len(target_ids),
            'processed_at': datetime.now().isoformat() + 'Z'
        })
    else:
        return Response(
            {'error': f'Unknown action: {action}'}, 
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def target_history_api(request, target_id):
    """
    Get target interaction history
    """
    
    history = [
        {
            'id': 1,
            'type': 'email',
            'action': 'Email sent',
            'details': 'Initial outreach email sent',
            'created_by': 'Agent Smith',
            'created_at': '2024-12-01T10:30:00Z',
            'status': 'delivered'
        },
        {
            'id': 2,
            'type': 'call',
            'action': 'Phone call',
            'details': 'Left voicemail message',
            'created_by': 'Agent Smith',
            'created_at': '2024-12-03T14:15:00Z',
            'status': 'completed'
        },
        {
            'id': 3,
            'type': 'email',
            'action': 'Follow-up email',
            'details': 'Sent property valuation information',
            'created_by': 'Agent Smith',
            'created_at': '2024-12-05T09:45:00Z',
            'status': 'opened'
        },
        {
            'id': 4,
            'type': 'call',
            'action': 'Phone call',
            'details': 'Spoke with owner - expressed interest',
            'created_by': 'Agent Smith',
            'created_at': '2024-12-08T11:20:00Z',
            'status': 'completed'
        },
        {
            'id': 5,
            'type': 'meeting',
            'action': 'Property visit',
            'details': 'Scheduled property walkthrough',
            'created_by': 'Agent Smith',
            'created_at': '2024-12-15T14:30:00Z',
            'status': 'scheduled'
        }
    ]
    
    return Response({
        'target_id': target_id,
        'history': history,
        'total_interactions': len(history)
    })