"""
CSV Data Service for Drone Strike v2
Processes Tarrant County tax data and converts to application entities
"""
import csv
import os
from typing import List, Dict, Any, Optional
from decimal import Decimal, InvalidOperation
from datetime import datetime
import re


class TarrantCountyCSVService:
    """Service for processing Tarrant County tax delinquency CSV data"""
    
    def __init__(self, csv_file_path: str):
        self.csv_file_path = csv_file_path
        self.data_cache = None
        self.last_loaded = None
    
    def _clean_currency(self, value: str) -> float:
        """Convert currency string to float"""
        if not value or value.strip() == '':
            return 0.0
        
        # Remove currency symbols, commas, and quotes
        cleaned = re.sub(r'[$",]', '', str(value).strip())
        try:
            return float(cleaned)
        except (ValueError, InvalidOperation):
            return 0.0
    
    def _clean_percentage(self, value: str) -> float:
        """Convert percentage string to float"""
        if not value or value.strip() == '':
            return 0.0
        
        cleaned = str(value).replace('%', '').strip()
        try:
            return float(cleaned)
        except ValueError:
            return 0.0
    
    def _parse_date(self, date_str: str) -> Optional[str]:
        """Parse date string to ISO format"""
        if not date_str or date_str.strip() == '':
            return None
        
        try:
            # Handle format: 3/18/2025 0:00
            date_part = date_str.split(' ')[0]
            parsed = datetime.strptime(date_part, '%m/%d/%Y')
            return parsed.strftime('%Y-%m-%d')
        except ValueError:
            return None
    
    def _calculate_lead_score(self, row: Dict[str, str]) -> int:
        """Calculate lead score based on property characteristics"""
        score = 50  # Base score
        
        # High total due increases score
        total_due = self._clean_currency(row.get('TOTAL DUE', '0'))
        if total_due > 5000:
            score += 20
        elif total_due > 2000:
            score += 10
        
        # Lawsuit status
        lawsuit = row.get('law suit active', '').upper()
        if 'ACTIVE' in lawsuit:
            score += 15
        
        # High property value increases score
        value_ass = self._clean_currency(row.get('ValueAss', '0'))
        if value_ass > 100000:
            score += 15
        elif value_ass > 50000:
            score += 10
        
        # LTV ratio considerations
        ltv = self._clean_percentage(row.get('LTV', '0'))
        if 0.5 <= ltv <= 0.8:  # Sweet spot for investment
            score += 10
        
        # Homestead exemption (owner-occupied)
        exemptions = row.get('Exemptions', '').lower()
        if 'homestead' in exemptions:
            score += 5
        
        return min(max(score, 0), 100)  # Clamp between 0-100
    
    def _generate_tags(self, row: Dict[str, str]) -> List[str]:
        """Generate tags based on property characteristics"""
        tags = []
        
        # Lawsuit status
        lawsuit = row.get('law suit active', '').upper()
        if 'ACTIVE' in lawsuit:
            tags.append('lawsuit-active')
        
        # Property value categories
        value_ass = self._clean_currency(row.get('ValueAss', '0'))
        if value_ass > 100000:
            tags.append('high-value')
        elif value_ass < 30000:
            tags.append('low-value')
        
        # Exemptions
        exemptions = row.get('Exemptions', '').lower()
        if 'homestead' in exemptions:
            tags.append('homestead')
        if 'cap adjustment' in exemptions:
            tags.append('cap-adjustment')
        
        # Financial stress indicators
        total_due = self._clean_currency(row.get('TOTAL DUE', '0'))
        if total_due > 5000:
            tags.append('high-delinquency')
        
        # Mobile home
        if row.get('MobileHome', '').strip():
            tags.append('mobile-home')
        
        # Bankruptcy
        if row.get('BK', '').strip():
            tags.append('bankruptcy')
        
        return tags
    
    def load_data(self, force_reload: bool = False) -> List[Dict[str, Any]]:
        """Load and cache CSV data"""
        if self.data_cache and not force_reload:
            return self.data_cache
        
        if not os.path.exists(self.csv_file_path):
            raise FileNotFoundError(f"CSV file not found: {self.csv_file_path}")
        
        data = []
        with open(self.csv_file_path, 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            for row in reader:
                data.append(row)
        
        self.data_cache = data
        self.last_loaded = datetime.now()
        return data
    
    def get_properties(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Convert CSV data to property objects"""
        raw_data = self.load_data()
        properties = []
        
        for i, row in enumerate(raw_data):
            if limit and i >= limit:
                break
            
            # Create property object
            property_data = {
                'id': f"tarrant_{row.get('ID', i)}",
                'external_id': row.get('ID', ''),
                'tax_id': row.get('TAXID', ''),
                'prop_id': row.get('PropID', ''),
                
                # Property Address
                'street': row.get('PropStreet', ''),
                'city': row.get('PropCity', ''),
                'state': row.get('PropState', 'TX'),
                'zip_code': row.get('PropZIP', ''),
                'full_address': f"{row.get('PropStreet', '')} {row.get('PropCity', '')} {row.get('PropState', 'TX')} {row.get('PropZIP', '')}".strip(),
                
                # Property Details
                'description': row.get('Description', ''),
                'property_type': 'residential',  # Default for tax data
                'exemptions': row.get('Exemptions', ''),
                
                # Financial Data
                'assessed_value': self._clean_currency(row.get('ValueAss', '0')),
                'land_value': self._clean_currency(row.get('ValueLand', '0')),
                'improvement_value': self._clean_currency(row.get('ValueImp', '0')),
                'total_due': self._clean_currency(row.get('TOTAL DUE', '0')),
                'current_due': self._clean_currency(row.get('CurrentDue', '0')),
                'tax_amount': self._clean_currency(row.get('Tax', '0')),
                'fees': self._clean_currency(row.get('Fees', '0')),
                'prior_due': self._clean_currency(row.get('PriorDue', '0')),
                
                # Loan Calculations
                'ltv_ratio': self._clean_percentage(row.get('LTV', '0')) / 100,
                'estimated_purchase_price': self._clean_currency(row.get('ESTIMATED MAX PURCHASE PRICE', '0')),
                'cash_to_customer': self._clean_currency(row.get('CASH TO CUSTOMER', '0')),
                'tax_loan_amount': self._clean_currency(row.get('tax loan amount', '0')),
                'payment_24_months': self._clean_currency(row.get('pmt 24 mts', '0')),
                'interest_rate': self._clean_percentage(row.get('RATE', '0')),
                'apr': self._clean_percentage(row.get('APR', '0')),
                
                # Status
                'lawsuit_active': row.get('law suit active', '').upper() == 'LAWSUIT ACTIVE',
                'bankruptcy': bool(row.get('BK', '').strip()),
                'mobile_home': bool(row.get('MobileHome', '').strip()),
                
                # Dates
                'last_payment_date': self._parse_date(row.get('LastPaymentDate', '')),
                'last_run': self._parse_date(row.get('LastRun', '')),
                
                # Generated fields
                'lead_score': self._calculate_lead_score(row),
                'tags': self._generate_tags(row),
                'data_source': 'tarrant_county_csv',
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat(),
            }
            
            properties.append(property_data)
        
        return properties
    
    def get_leads(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Convert CSV data to lead objects"""
        raw_data = self.load_data()
        leads = []
        
        for i, row in enumerate(raw_data):
            if limit and i >= limit:
                break
            
            # Create lead object from owner data
            lead_data = {
                'id': f"tarrant_lead_{row.get('ID', i)}",
                'external_id': row.get('ID', ''),
                'property_id': f"tarrant_{row.get('ID', i)}",
                
                # Owner Information
                'full_name': row.get('OwnerName', ''),
                'first_name': row.get('OwnerName', '').split(' ')[0] if row.get('OwnerName') else '',
                'last_name': ' '.join(row.get('OwnerName', '').split(' ')[1:]) if row.get('OwnerName') else '',
                
                # Owner Address
                'street': row.get('OwnerStreet', ''),
                'city': row.get('OwnerCity', ''),
                'state': row.get('OwnerState', ''),
                'zip_code': row.get('OwnerZIP', ''),
                'full_address': f"{row.get('OwnerStreet', '')} {row.get('OwnerCity', '')} {row.get('OwnerState', '')} {row.get('OwnerZIP', '')}".strip(),
                
                # Lead Status
                'status': 'new',
                'lead_score': self._calculate_lead_score(row),
                'priority': 'high' if self._calculate_lead_score(row) > 80 else 'medium' if self._calculate_lead_score(row) > 60 else 'low',
                
                # Property Context
                'property_value': self._clean_currency(row.get('ValueAss', '0')),
                'total_due': self._clean_currency(row.get('TOTAL DUE', '0')),
                'lawsuit_active': row.get('law suit active', '').upper() == 'LAWSUIT ACTIVE',
                
                # Generated fields
                'tags': self._generate_tags(row),
                'data_source': 'tarrant_county_csv',
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat(),
            }
            
            leads.append(lead_data)
        
        return leads
    
    def get_dashboard_metrics(self) -> Dict[str, Any]:
        """Generate dashboard metrics from CSV data"""
        properties = self.get_properties()
        leads = self.get_leads()
        
        total_properties = len(properties)
        total_leads = len(leads)
        
        # Calculate financial metrics
        total_assessed_value = sum(p['assessed_value'] for p in properties)
        total_due_amount = sum(p['total_due'] for p in properties)
        avg_property_value = total_assessed_value / total_properties if total_properties > 0 else 0
        
        # Lead scoring metrics
        high_score_leads = [l for l in leads if l['lead_score'] > 80]
        lawsuit_active = [p for p in properties if p['lawsuit_active']]
        
        return {
            'total_properties': total_properties,
            'total_leads': total_leads,
            'high_priority_leads': len(high_score_leads),
            'lawsuit_properties': len(lawsuit_active),
            'total_assessed_value': total_assessed_value,
            'total_due_amount': total_due_amount,
            'avg_property_value': avg_property_value,
            'data_source': 'tarrant_county_csv',
            'last_updated': self.last_loaded.isoformat() if self.last_loaded else None,
        }
    
    def search_properties(self, query: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Search properties by address, owner name, or tax ID"""
        properties = self.get_properties()
        query_lower = query.lower()
        
        filtered = []
        for prop in properties:
            # Search in multiple fields
            searchable_text = ' '.join([
                prop.get('full_address', ''),
                prop.get('description', ''),
                prop.get('tax_id', ''),
                prop.get('external_id', ''),
            ]).lower()
            
            if query_lower in searchable_text:
                filtered.append(prop)
            
            if len(filtered) >= limit:
                break
        
        return filtered
    
    def search_leads(self, query: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Search leads by name or address"""
        leads = self.get_leads()
        query_lower = query.lower()
        
        filtered = []
        for lead in leads:
            # Search in multiple fields
            searchable_text = ' '.join([
                lead.get('full_name', ''),
                lead.get('full_address', ''),
                lead.get('external_id', ''),
            ]).lower()
            
            if query_lower in searchable_text:
                filtered.append(lead)
            
            if len(filtered) >= limit:
                break
        
        return filtered


# Global service instance
csv_service = TarrantCountyCSVService('/Users/angelinaopinca/Desktop/TARRANT LOAD 28 MAR 2025.csv')