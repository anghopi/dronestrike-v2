"""
Advanced CSV Import System for DroneStrike v2
Handles TARRANT-style tax delinquent property data with 79+ fields
Based on the original Node.js system's sophisticated import capabilities
"""

import csv
import io
import logging
import re
import asyncio
from decimal import Decimal, InvalidOperation
from datetime import datetime, date
from typing import Dict, List, Optional, Tuple, Any
from django.db import transaction, models
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User

from .models import Lead, Property, County, TokenTransaction
from .token_engine import TokenEngine
from .user_roles import UserPermission

logger = logging.getLogger(__name__)


class CSVImportError(Exception):
    """Custom exception for CSV import errors"""
    pass


class TarrantCSVProcessor:
    """
    Processes TARRANT County tax delinquent property CSV files
    Handles the 79-field format used by the original Node.js system
    """
    
    # TARRANT CSV field mapping (79 fields from original system)
    FIELD_MAPPING = {
        # Owner information
        'OwnerName': 'owner_name',
        'OwnerStreet': 'owner_street',
        'OwnerCityState': 'owner_city_state',
        'OwnerZip': 'owner_zip',
        
        # Property address
        'PropStreet': 'property_street',
        'PropCity': 'property_city',
        'PropState': 'property_state',
        'PropZip': 'property_zip',
        
        # Financial data
        'Tax': 'tax_amount',
        'Fees': 'fees_amount',
        'PriorDue': 'prior_due_amount',
        'Total': 'total_amount_due',
        'ValueAss': 'assessed_value',
        'ValueLand': 'land_value',
        'ValueImpr': 'improvement_value',
        'LTV': 'loan_to_value',
        
        # Legal information
        'law suit active': 'lawsuit_active',
        'Lawsuit No': 'lawsuit_number',
        'Attorney': 'attorney_name',
        'Attorney Phone': 'attorney_phone',
        
        # Property details
        'PropertyType': 'property_type',
        'YearBuilt': 'year_built',
        'SquareFeet': 'square_feet',
        'Bedrooms': 'bedrooms',
        'Bathrooms': 'bathrooms',
        'LotSize': 'lot_size',
        
        # Account information
        'AccountNumber': 'account_number',
        'TaxYear': 'tax_year',
        'TaxID': 'tax_id',
        'ParcelID': 'parcel_id',
        
        # Additional fields
        'LastPayment': 'last_payment_amount',
        'LastPaymentDate': 'last_payment_date',
        'LastPayer': 'last_payer_name',
        'DelinquentYears': 'delinquent_years',
        'InterestRate': 'interest_rate',
        'PenaltyRate': 'penalty_rate',
        
        # Contact preferences
        'DoNotMail': 'do_not_mail',
        'DoNotEmail': 'do_not_email',
        'DoNotCall': 'do_not_call',
        
        # Geographic data
        'Latitude': 'latitude',
        'Longitude': 'longitude',
        'County': 'county_name',
        'CensusBlock': 'census_block',
        'SchoolDistrict': 'school_district',
        
        # Exemptions and special status
        'Exemptions': 'exemptions',
        'Homestead': 'homestead_exemption',
        'Disabled': 'disabled_exemption',
        'Senior': 'senior_exemption',
        'Veteran': 'veteran_exemption',
        
        # Additional owner information
        'OwnerType': 'owner_type',
        'EntityType': 'entity_type',
        'BusinessName': 'business_name',
        'MailingAddress': 'mailing_address',
        'MailingCity': 'mailing_city',
        'MailingState': 'mailing_state',
        'MailingZip': 'mailing_zip',
        
        # Data source tracking
        'DataSource': 'data_source',
        'ImportDate': 'import_date',
        'LastUpdated': 'last_updated',
        'DataQuality': 'data_quality_score',
    }
    
    def __init__(self, user: User):
        self.user = user
        self.import_stats = {
            'total_rows': 0,
            'processed_rows': 0,
            'successful_rows': 0,
            'failed_rows': 0,
            'duplicate_rows': 0,
            'errors': [],
            'tokens_used': 0
        }
        self.batch_size = 100  # Process in batches
    
    def validate_csv_structure(self, file_content: str) -> Tuple[bool, str, List[str]]:
        """
        Validate CSV structure and return headers
        """
        try:
            csv_reader = csv.reader(io.StringIO(file_content))
            headers = next(csv_reader)
            
            # Check for minimum required fields
            required_fields = ['OwnerName', 'PropStreet', 'Tax', 'ValueAss']
            missing_fields = [field for field in required_fields if field not in headers]
            
            if missing_fields:
                return False, f"Missing required fields: {', '.join(missing_fields)}", headers
            
            # Check row count
            sample_rows = list(csv_reader)
            if len(sample_rows) == 0:
                return False, "CSV file contains no data rows", headers
            
            self.import_stats['total_rows'] = len(sample_rows)
            
            return True, "CSV structure is valid", headers
        
        except Exception as e:
            return False, f"Error reading CSV: {str(e)}", []
    
    def clean_and_validate_field(self, field_name: str, value: str, row_number: int) -> Tuple[Any, Optional[str]]:
        """
        Clean and validate individual field values
        """
        if not value or value.strip() == '':
            return None, None
        
        value = value.strip()
        
        try:
            # Handle different field types
            if field_name in ['tax_amount', 'fees_amount', 'prior_due_amount', 'total_amount_due', 
                             'assessed_value', 'land_value', 'improvement_value', 'last_payment_amount']:
                # Clean currency values
                clean_value = re.sub(r'[,$\s]', '', value)
                if clean_value:
                    return Decimal(clean_value), None
                return None, None
            
            elif field_name in ['loan_to_value', 'interest_rate', 'penalty_rate', 'data_quality_score']:
                # Handle percentages and rates
                clean_value = re.sub(r'[%\s]', '', value)
                if clean_value:
                    return float(clean_value), None
                return None, None
            
            elif field_name in ['year_built', 'square_feet', 'bedrooms', 'tax_year']:
                # Integer fields
                clean_value = re.sub(r'[,\s]', '', value)
                if clean_value.isdigit():
                    return int(clean_value), None
                return None, f"Invalid integer value: {value}"
            
            elif field_name == 'bathrooms':
                # Handle decimal bathrooms (2.5, etc.)
                clean_value = re.sub(r'[,\s]', '', value)
                try:
                    return float(clean_value), None
                except ValueError:
                    return None, f"Invalid bathroom count: {value}"
            
            elif field_name in ['last_payment_date', 'import_date', 'last_updated']:
                # Date fields
                return self.parse_date(value), None
            
            elif field_name in ['do_not_mail', 'do_not_email', 'do_not_call', 'homestead_exemption',
                               'disabled_exemption', 'senior_exemption', 'veteran_exemption']:
                # Boolean fields
                return value.lower() in ['true', 'yes', '1', 'y'], None
            
            elif field_name in ['latitude', 'longitude']:
                # Geographic coordinates
                try:
                    coord = float(value)
                    if field_name == 'latitude' and not (-90 <= coord <= 90):
                        return None, f"Invalid latitude: {value}"
                    elif field_name == 'longitude' and not (-180 <= coord <= 180):
                        return None, f"Invalid longitude: {value}"
                    return coord, None
                except ValueError:
                    return None, f"Invalid coordinate: {value}"
            
            else:
                # String fields - clean and truncate if needed
                clean_value = value.strip()
                if len(clean_value) > 255:  # Assume max field length
                    clean_value = clean_value[:255]
                return clean_value, None
        
        except Exception as e:
            return None, f"Error processing field {field_name}: {str(e)}"
    
    def parse_date(self, date_str: str) -> Optional[date]:
        """
        Parse date from various formats
        """
        if not date_str:
            return None
        
        # Common date formats
        formats = [
            '%m/%d/%Y',
            '%Y-%m-%d',
            '%m-%d-%Y',
            '%d/%m/%Y',
            '%Y/%m/%d',
            '%m/%d/%y',
            '%y-%m-%d'
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str.strip(), fmt).date()
            except ValueError:
                continue
        
        return None
    
    def split_owner_name(self, full_name: str) -> Tuple[str, str]:
        """
        Split full owner name into first and last names
        """
        if not full_name:
            return "", ""
        
        # Handle common formats
        name_parts = full_name.strip().split()
        
        if len(name_parts) == 1:
            return name_parts[0], ""
        elif len(name_parts) == 2:
            return name_parts[0], name_parts[1]
        else:
            # More than 2 parts - assume first word is first name, rest is last name
            return name_parts[0], " ".join(name_parts[1:])
    
    def determine_owner_type(self, owner_name: str, entity_type: str = None, business_name: str = None) -> str:
        """
        Determine owner type based on name patterns and other fields
        """
        if not owner_name:
            return 'individual'
        
        owner_lower = owner_name.lower()
        
        # Business indicators
        business_indicators = ['llc', 'inc', 'corp', 'ltd', 'company', 'co.', 'trust', 'estate', 'bank']
        if any(indicator in owner_lower for indicator in business_indicators):
            return 'entity'
        
        if business_name:
            return 'entity'
        
        if entity_type:
            return 'entity'
        
        # Default to individual
        return 'individual'
    
    def parse_property_address(self, address_str: str) -> Dict[str, str]:
        """
        Parse property address into components
        """
        if not address_str:
            return {'address1': '', 'city': '', 'state': '', 'zip_code': ''}
        
        # Simple address parsing - can be enhanced with geocoding APIs
        parts = address_str.split(',')
        
        if len(parts) >= 3:
            return {
                'address1': parts[0].strip(),
                'city': parts[1].strip(),
                'state': parts[2].strip()[:2] if len(parts[2].strip()) >= 2 else '',
                'zip_code': parts[2].strip()[2:].strip() if len(parts[2].strip()) > 2 else ''
            }
        elif len(parts) == 2:
            return {
                'address1': parts[0].strip(),
                'city': parts[1].strip(),
                'state': '',
                'zip_code': ''
            }
        else:
            return {
                'address1': address_str.strip(),
                'city': '',
                'state': '',
                'zip_code': ''
            }
    
    @transaction.atomic
    def process_csv_file(self, file_content: str, batch_id: str = None) -> Dict:
        """
        Process the entire CSV file with proper error handling and batch processing
        """
        # Validate structure first
        is_valid, message, headers = self.validate_csv_structure(file_content)
        if not is_valid:
            raise CSVImportError(message)
        
        # Check token availability for large imports
        estimated_tokens = max(1, self.import_stats['total_rows'] // 100)  # 1 token per 100 rows
        try:
            TokenEngine.consume_tokens(
                user=self.user,
                action_type='csv_import_row',
                quantity=estimated_tokens,
                description=f"CSV import of {self.import_stats['total_rows']} rows"
            )
            self.import_stats['tokens_used'] = estimated_tokens
        except ValueError as e:
            raise CSVImportError(f"Insufficient tokens for import: {str(e)}")
        
        # Process CSV in batches
        csv_reader = csv.DictReader(io.StringIO(file_content))
        batch = []
        
        for row_number, row in enumerate(csv_reader, start=1):
            try:
                processed_row = self.process_csv_row(row, row_number, headers)
                if processed_row:
                    batch.append(processed_row)
                
                # Process batch when it reaches batch_size
                if len(batch) >= self.batch_size:
                    self.process_batch(batch, batch_id)
                    batch = []
                
                self.import_stats['processed_rows'] += 1
                
                # Progress logging for large imports
                if row_number % 1000 == 0:
                    logger.info(f"Processed {row_number} rows...")
            
            except Exception as e:
                self.import_stats['failed_rows'] += 1
                self.import_stats['errors'].append({
                    'row': row_number,
                    'error': str(e),
                    'data': dict(row)
                })
                logger.error(f"Error processing row {row_number}: {str(e)}")
        
        # Process remaining batch
        if batch:
            self.process_batch(batch, batch_id)
        
        # Final statistics
        self.import_stats['success_rate'] = (
            self.import_stats['successful_rows'] / max(self.import_stats['processed_rows'], 1)
        ) * 100
        
        return self.import_stats
    
    def process_csv_row(self, row: Dict, row_number: int, headers: List[str]) -> Optional[Dict]:
        """
        Process a single CSV row and return structured data
        """
        processed_data = {
            'lead_data': {},
            'property_data': {},
            'raw_data': dict(row),
            'row_number': row_number
        }
        
        # Map and clean fields
        for csv_field, db_field in self.FIELD_MAPPING.items():
            if csv_field in row:
                value, error = self.clean_and_validate_field(db_field, row[csv_field], row_number)
                if error:
                    logger.warning(f"Row {row_number}, field {csv_field}: {error}")
                
                if value is not None:
                    # Determine if field belongs to lead or property
                    if db_field in ['owner_name', 'owner_street', 'owner_city_state', 'owner_zip',
                                   'mailing_address', 'mailing_city', 'mailing_state', 'mailing_zip',
                                   'owner_type', 'entity_type', 'business_name', 'do_not_mail',
                                   'do_not_email', 'do_not_call']:
                        processed_data['lead_data'][db_field] = value
                    else:
                        processed_data['property_data'][db_field] = value
        
        # Split owner name into first/last
        if 'owner_name' in processed_data['lead_data']:
            first_name, last_name = self.split_owner_name(processed_data['lead_data']['owner_name'])
            processed_data['lead_data']['first_name'] = first_name
            processed_data['lead_data']['last_name'] = last_name
        
        # Determine owner type
        processed_data['lead_data']['owner_type'] = self.determine_owner_type(
            processed_data['lead_data'].get('owner_name', ''),
            processed_data['lead_data'].get('entity_type'),
            processed_data['lead_data'].get('business_name')
        )
        
        # Parse property address
        if 'property_street' in processed_data['property_data']:
            addr_parts = self.parse_property_address(processed_data['property_data']['property_street'])
            processed_data['property_data'].update(addr_parts)
        
        # Set defaults
        processed_data['lead_data']['lead_status'] = 'target_acquired'
        processed_data['lead_data']['workflow_stage'] = 'lead_identified'
        processed_data['property_data']['disposition'] = 'active'
        
        return processed_data
    
    @transaction.atomic
    def process_batch(self, batch: List[Dict], batch_id: str = None):
        """
        Process a batch of rows with database operations
        """
        for row_data in batch:
            try:
                # Check for duplicates
                existing_lead = self.check_for_duplicate(row_data)
                if existing_lead:
                    self.import_stats['duplicate_rows'] += 1
                    continue
                
                # Create or get county
                county = self.get_or_create_county(row_data['property_data'])
                
                # Create property
                property_obj = self.create_property(row_data['property_data'], county)
                
                # Create lead
                lead_obj = self.create_lead(row_data['lead_data'], property_obj, batch_id)
                
                self.import_stats['successful_rows'] += 1
            
            except Exception as e:
                self.import_stats['failed_rows'] += 1
                self.import_stats['errors'].append({
                    'row': row_data['row_number'],
                    'error': str(e),
                    'data': row_data['raw_data']
                })
                logger.error(f"Error creating records for row {row_data['row_number']}: {str(e)}")
    
    def check_for_duplicate(self, row_data: Dict) -> Optional[Lead]:
        """
        Check for duplicate leads based on property address and owner name
        """
        property_data = row_data['property_data']
        lead_data = row_data['lead_data']
        
        # Check by property address and owner name
        existing_leads = Lead.objects.filter(
            first_name=lead_data.get('first_name', ''),
            last_name=lead_data.get('last_name', ''),
            property__address1__iexact=property_data.get('address1', ''),
            property__city__iexact=property_data.get('city', ''),
            property__state__iexact=property_data.get('state', '')
        )
        
        return existing_leads.first()
    
    def get_or_create_county(self, property_data: Dict) -> County:
        """
        Get or create county record
        """
        county_name = property_data.get('county_name', 'Unknown')
        state = property_data.get('state', 'TX')
        
        county, created = County.objects.get_or_create(
            name=county_name,
            state=state,
            defaults={
                'fips_code': f"{state}999",  # Default FIPS code
                'redemption_period_months': 24,
                'interest_rate': Decimal('0.08')
            }
        )
        
        return county
    
    def create_property(self, property_data: Dict, county: County) -> Property:
        """
        Create property record
        """
        # Map property type
        property_type_mapping = {
            'single family': 'single_family',
            'single-family': 'single_family',
            'multi family': 'multi_family',
            'multi-family': 'multi_family',
            'condo': 'condo',
            'condominium': 'condo',
            'townhouse': 'townhouse',
            'commercial': 'commercial',
            'land': 'land',
            'vacant': 'land',
            'mobile home': 'mobile_home',
        }
        
        raw_property_type = property_data.get('property_type', '').lower()
        property_type = property_type_mapping.get(raw_property_type, 'single_family')
        
        property_obj = Property.objects.create(
            county=county,
            address1=property_data.get('address1', ''),
            city=property_data.get('city', ''),
            state=property_data.get('state', ''),
            zip_code=property_data.get('zip_code', ''),
            original_address1=property_data.get('address1', ''),
            original_city=property_data.get('city', ''),
            original_state=property_data.get('state', ''),
            original_zip=property_data.get('zip_code', ''),
            
            # Values
            improvement_value=property_data.get('improvement_value', Decimal('0')),
            land_value=property_data.get('land_value', Decimal('0')),
            total_value=property_data.get('assessed_value', Decimal('0')),
            
            # Property details
            property_type=property_type,
            square_feet=property_data.get('square_feet'),
            year_built=property_data.get('year_built'),
            bedrooms=property_data.get('bedrooms'),
            bathrooms=property_data.get('bathrooms'),
            lot_size=property_data.get('lot_size'),
            
            # Tax information
            account_number=property_data.get('account_number', ''),
            ple_amount_due=property_data.get('total_amount_due'),
            ple_amount_tax=property_data.get('tax_amount'),
            ple_lawsuit_no=property_data.get('lawsuit_number'),
            
            # Geographic
            latitude=property_data.get('latitude'),
            longitude=property_data.get('longitude'),
            
            # Legal status
            in_foreclosure=property_data.get('lawsuit_active', False),
            last_payment=property_data.get('last_payment_amount'),
            last_payment_date=property_data.get('last_payment_date'),
            last_payer=property_data.get('last_payer_name'),
            
            # Additional details
            exemptions=property_data.get('exemptions', ''),
            description=f"Imported from TARRANT CSV",
        )
        
        return property_obj
    
    def create_lead(self, lead_data: Dict, property_obj: Property, batch_id: str = None) -> Lead:
        """
        Create lead record
        """
        lead_obj = Lead.objects.create(
            owner=self.user,
            property=property_obj,
            
            # Personal information
            first_name=lead_data.get('first_name', ''),
            last_name=lead_data.get('last_name', ''),
            owner_type=lead_data.get('owner_type', 'individual'),
            
            # Mailing address
            mailing_address_1=lead_data.get('mailing_address', property_obj.address1),
            mailing_city=lead_data.get('mailing_city', property_obj.city),
            mailing_state=lead_data.get('mailing_state', property_obj.state),
            mailing_zip5=lead_data.get('mailing_zip', property_obj.zip_code)[:5] if lead_data.get('mailing_zip') else property_obj.zip_code[:5],
            
            # Communication preferences
            do_not_email=lead_data.get('do_not_email', False),
            do_not_mail=lead_data.get('do_not_mail', False),
            
            # Status
            lead_status='target_acquired',
            workflow_stage='lead_identified',
            
            # Business flags
            is_business=lead_data.get('owner_type') == 'entity',
            
            # Data tracking
            source_batch=batch_id or f"csv_import_{timezone.now().strftime('%Y%m%d_%H%M%S')}",
            imported_from='tarrant_csv',
        )
        
        return lead_obj


class CSVImportService:
    """
    Service for managing CSV import operations
    """
    
    @staticmethod
    def import_tarrant_csv(user: User, file_content: str, filename: str = None) -> Dict:
        """
        Import TARRANT-style CSV file
        """
        # Check permissions
        if not user.profile.has_permission(UserPermission.CAN_IMPORT_LEADS):
            raise PermissionError("No permission to import leads")
        
        processor = TarrantCSVProcessor(user)
        
        try:
            batch_id = f"tarrant_{timezone.now().strftime('%Y%m%d_%H%M%S')}"
            
            logger.info(f"Starting TARRANT CSV import for user {user.username}")
            
            result = processor.process_csv_file(file_content, batch_id)
            
            logger.info(f"Completed TARRANT CSV import: {result['successful_rows']} successful, {result['failed_rows']} failed")
            
            return {
                'success': True,
                'message': 'CSV import completed',
                'stats': result,
                'batch_id': batch_id,
                'filename': filename
            }
        
        except Exception as e:
            logger.error(f"CSV import failed for user {user.username}: {str(e)}")
            return {
                'success': False,
                'message': str(e),
                'stats': processor.import_stats,
                'batch_id': None,
                'filename': filename
            }