"""
CSV-based API views for development
Uses CSV data instead of database until real integrations are available
"""

from rest_framework import generics, permissions, status
from rest_framework.response import Response
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.csv_service import csv_service


class CSVDashboardView(generics.GenericAPIView):
    """Dashboard data from CSV files"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Get dashboard metrics from CSV data"""
        try:
            metrics = csv_service.get_dashboard_metrics()
            return Response(metrics)
        except Exception as e:
            return Response({
                'error': f'Failed to load dashboard data: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CSVPropertiesView(generics.GenericAPIView):
    """Properties data from CSV files"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Get properties from CSV data"""
        try:
            limit = int(request.query_params.get('limit', 50))
            search = request.query_params.get('search', '')
            
            if search:
                properties = csv_service.search_properties(search, limit)
            else:
                properties = csv_service.get_properties(limit)
            
            return Response({
                'count': len(properties),
                'results': properties
            })
        except Exception as e:
            return Response({
                'error': f'Failed to load properties: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CSVLeadsView(generics.GenericAPIView):
    """Leads data from CSV files"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Get leads from CSV data"""
        try:
            limit = int(request.query_params.get('limit', 50))
            search = request.query_params.get('search', '')
            
            if search:
                leads = csv_service.search_leads(search, limit)
            else:
                leads = csv_service.get_leads(limit)
            
            return Response({
                'count': len(leads),
                'results': leads
            })
        except Exception as e:
            return Response({
                'error': f'Failed to load leads: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CSVOpportunitiesView(generics.GenericAPIView):
    """Investment opportunities from CSV data"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Get investment opportunities from CSV data"""
        try:
            # Get high-scoring properties as opportunities
            properties = csv_service.get_properties(100)
            
            # Filter for investment opportunities (high score, lawsuit, good LTV)
            opportunities = []
            for prop in properties:
                if (prop['lead_score'] > 70 and 
                    prop['ltv_ratio'] > 0.3 and 
                    prop['assessed_value'] > 30000):
                    
                    opportunity = {
                        'id': f"opp_{prop['id']}",
                        'property': prop,
                        'investment_score': prop['lead_score'],
                        'potential_profit': prop['cash_to_customer'],
                        'risk_level': 'high' if prop['lawsuit_active'] else 'medium',
                        'status': 'active',
                        'priority': 'high' if prop['lead_score'] > 85 else 'medium',
                        'estimated_roi': round((prop['cash_to_customer'] / max(prop['tax_loan_amount'], 1)) * 100, 2),
                        'tags': prop['tags']
                    }
                    opportunities.append(opportunity)
            
            # Sort by investment score
            opportunities.sort(key=lambda x: x['investment_score'], reverse=True)
            
            return Response({
                'count': len(opportunities),
                'results': opportunities[:20]  # Top 20 opportunities
            })
        except Exception as e:
            return Response({
                'error': f'Failed to load opportunities: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CSVMissionsView(generics.GenericAPIView):
    """BOTG Missions from CSV data"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Generate missions from high-priority leads"""
        try:
            leads = csv_service.get_leads(100)
            
            # Create missions for high-scoring leads
            missions = []
            mission_id = 1
            
            for lead in leads:
                if lead['lead_score'] > 75:  # High priority leads
                    mission = {
                        'id': f"M-2025-{mission_id:03d}",
                        'mission_number': f"M-2025-{mission_id:03d}",
                        'target_lead': {
                            'id': lead['id'],
                            'full_name': lead['full_name'],
                            'property_address': lead.get('property_address', lead['full_address'])
                        },
                        'assigned_soldier': {
                            'id': 1,
                            'name': f"Agent {chr(65 + (mission_id % 26))}",  # Agent A, B, C, etc.
                            'phone': '+1-555-0123'
                        },
                        'status': 'pending' if mission_id % 4 == 0 else 'in_progress' if mission_id % 3 == 0 else 'completed',
                        'priority': lead['priority'],
                        'safety_level': 'red' if lead['lawsuit_active'] else 'green',
                        'lead_score': lead['lead_score'],
                        'property_value': lead['property_value'],
                        'total_due': lead['total_due'],
                        'created_at': lead['created_at'],
                        'tags': lead['tags']
                    }
                    missions.append(mission)
                    mission_id += 1
                    
                    if len(missions) >= 20:  # Limit to 20 missions
                        break
            
            return Response({
                'count': len(missions),
                'results': missions
            })
        except Exception as e:
            return Response({
                'error': f'Failed to load missions: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)