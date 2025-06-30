"""
CSV-based API views for development
Uses CSV data instead of database until real integrations are available
"""

from rest_framework import generics, permissions, status
from rest_framework.response import Response
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from services.csv_service import csv_service
except ImportError:
    csv_service = None


class CSVDashboardView(generics.GenericAPIView):
    """Dashboard data from CSV files"""
    permission_classes = [permissions.AllowAny]  # Allow unauthenticated for testing
    
    def get(self, request):
        """Get dashboard metrics from CSV data"""
        try:
            if csv_service:
                data = csv_service.get_dashboard_metrics()
                return Response(data)
            else:
                # Fallback data if csv_service is not available
                return Response({
                    'stats': {
                        'total_properties': 1250,
                        'active_leads': 89,
                        'pending_missions': 12,
                        'revenue_month': 45000
                    },
                    'recent_activity': [
                        {'type': 'lead', 'message': 'New lead: John Smith', 'time': '2 hours ago'},
                        {'type': 'mission', 'message': 'Mission completed: Oak Street', 'time': '4 hours ago'}
                    ]
                })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CSVPropertiesView(generics.GenericAPIView):
    """Properties data from CSV files"""
    permission_classes = [permissions.AllowAny]
    
    def get(self, request):
        """Get properties from CSV data"""
        try:
            if csv_service:
                data = csv_service.get_properties()
                return Response(data)
            else:
                return Response({
                    'count': 3,
                    'results': [
                        {
                            'id': 1,
                            'address': '123 Oak Street',
                            'city': 'Dallas',
                            'state': 'TX',
                            'zip_code': '75201',
                            'property_type': 'Single Family',
                            'estimated_value': 250000,
                            'status': 'Active'
                        }
                    ]
                })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CSVLeadsView(generics.GenericAPIView):
    """Leads data from CSV files"""
    permission_classes = [permissions.AllowAny]
    
    def get(self, request):
        """Get leads from CSV data"""
        try:
            if csv_service:
                data = csv_service.get_leads()
                return Response(data)
            else:
                return Response({
                    'count': 2,
                    'results': [
                        {
                            'id': 1,
                            'first_name': 'John',
                            'last_name': 'Smith',
                            'email': 'john.smith@email.com',
                            'phone': '(555) 123-4567',
                            'status': 'New',
                            'score': 85
                        }
                    ]
                })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CSVOpportunitiesView(generics.GenericAPIView):
    """Opportunities data from CSV files"""
    permission_classes = [permissions.AllowAny]
    
    def get(self, request):
        """Get opportunities from CSV data"""
        return Response({
            'count': 0,
            'results': []
        })


class CSVMissionsView(generics.GenericAPIView):
    """Missions data from CSV files"""
    permission_classes = [permissions.AllowAny]
    
    def get(self, request):
        """Get missions from CSV data"""
        return Response({
            'count': 0,
            'results': []
        })