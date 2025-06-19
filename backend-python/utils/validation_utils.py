"""
Advanced validation utilities for data processing and form validation.
"""

import re
import json
from typing import Dict, List, Optional, Any, Union, Callable
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
import phonenumbers
from email_validator import validate_email, EmailNotValidError

from utils.logging_config import get_logger

logger = get_logger(__name__)


class ValidationManager:
    """Comprehensive validation manager for DroneStrike system."""
    
    # Common regex patterns
    PATTERNS = {
        'phone': r'^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$',
        'zip_code': r'^\d{5}(-\d{4})?$',
        'ssn': r'^\d{3}-?\d{2}-?\d{4}$',
        'ein': r'^\d{2}-?\d{7}$',
        'url': r'^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$',
        'currency': r'^\$?[\d,]+\.?\d{0,2}$',
        'percentage': r'^(\d{1,2}(\.\d+)?|100(\.0+)?)%?$',
        'alphanumeric': r'^[a-zA-Z0-9]+$',
        'alpha_only': r'^[a-zA-Z\s]+$',
        'numeric_only': r'^\d+$'
    }
    
    # US State codes
    US_STATES = {
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
    }
    
    def __init__(self):
        """Initialize validation manager."""
        self.custom_validators = {}
    
    def register_custom_validator(self, name: str, validator_func: Callable) -> None:
        """
        Register a custom validation function.
        
        Args:
            name: Name of the validator
            validator_func: Function that takes a value and returns (bool, str) for (valid, error_message)
        """
        self.custom_validators[name] = validator_func
        logger.info(f"Custom validator '{name}' registered")
    
    def validate_data(self, data: Dict[str, Any], 
                     rules: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
        """
        Validate data against a set of rules.
        
        Args:
            data: Data to validate
            rules: Validation rules for each field
            
        Returns:
            Validation result with errors
        """
        result = {
            'valid': True,
            'errors': {},
            'warnings': {},
            'cleaned_data': {}
        }
        
        try:
            for field_name, field_rules in rules.items():
                field_value = data.get(field_name)
                field_result = self._validate_field(field_value, field_rules, field_name)
                
                if not field_result['valid']:
                    result['errors'][field_name] = field_result['errors']
                    result['valid'] = False
                
                if field_result['warnings']:
                    result['warnings'][field_name] = field_result['warnings']
                
                # Store cleaned value
                result['cleaned_data'][field_name] = field_result['cleaned_value']
            
            logger.info(f"Data validation completed", extra={
                'valid': result['valid'],
                'error_count': len(result['errors']),
                'warning_count': len(result['warnings'])
            })
            
        except Exception as e:
            result['valid'] = False
            result['errors']['_general'] = [f"Validation error: {str(e)}"]
            logger.error(f"Data validation failed: {e}")
        
        return result
    
    def _validate_field(self, value: Any, rules: Dict[str, Any], 
                       field_name: str) -> Dict[str, Any]:
        """Validate a single field against its rules."""
        result = {
            'valid': True,
            'errors': [],
            'warnings': [],
            'cleaned_value': value
        }
        
        # Handle None/empty values
        if value is None or (isinstance(value, str) and value.strip() == ''):
            if rules.get('required', False):
                result['errors'].append(f"{field_name} is required")
                result['valid'] = False
            return result
        
        # Convert value to string for pattern matching
        str_value = str(value).strip() if value is not None else ''
        result['cleaned_value'] = str_value
        
        # Type validation
        expected_type = rules.get('type')
        if expected_type:
            type_result = self._validate_type(str_value, expected_type)
            if not type_result['valid']:
                result['errors'].extend(type_result['errors'])
                result['valid'] = False
            else:
                result['cleaned_value'] = type_result['converted_value']
        
        # Length validation
        if 'min_length' in rules:
            if len(str_value) < rules['min_length']:
                result['errors'].append(f"{field_name} must be at least {rules['min_length']} characters")
                result['valid'] = False
        
        if 'max_length' in rules:
            if len(str_value) > rules['max_length']:
                result['errors'].append(f"{field_name} must be no more than {rules['max_length']} characters")
                result['valid'] = False
        
        # Range validation (for numeric values)
        if 'min_value' in rules or 'max_value' in rules:
            try:
                numeric_value = float(str_value)
                if 'min_value' in rules and numeric_value < rules['min_value']:
                    result['errors'].append(f"{field_name} must be at least {rules['min_value']}")
                    result['valid'] = False
                if 'max_value' in rules and numeric_value > rules['max_value']:
                    result['errors'].append(f"{field_name} must be no more than {rules['max_value']}")
                    result['valid'] = False
            except ValueError:
                if 'min_value' in rules or 'max_value' in rules:
                    result['errors'].append(f"{field_name} must be a valid number for range validation")
                    result['valid'] = False
        
        # Pattern validation
        if 'pattern' in rules:
            pattern = rules['pattern']
            if pattern in self.PATTERNS:
                pattern = self.PATTERNS[pattern]
            
            if not re.match(pattern, str_value):
                result['errors'].append(f"{field_name} format is invalid")
                result['valid'] = False
        
        # Email validation
        if rules.get('format') == 'email':
            email_result = self._validate_email(str_value)
            if not email_result['valid']:
                result['errors'].extend(email_result['errors'])
                result['valid'] = False
        
        # Phone validation
        if rules.get('format') == 'phone':
            phone_result = self._validate_phone(str_value)
            if not phone_result['valid']:
                result['errors'].extend(phone_result['errors'])
                result['valid'] = False
            else:
                result['cleaned_value'] = phone_result['formatted_phone']
        
        # Custom validation
        if 'custom' in rules:
            custom_name = rules['custom']
            if custom_name in self.custom_validators:
                try:
                    is_valid, error_msg = self.custom_validators[custom_name](str_value)
                    if not is_valid:
                        result['errors'].append(error_msg)
                        result['valid'] = False
                except Exception as e:
                    result['errors'].append(f"Custom validation error: {str(e)}")
                    result['valid'] = False
        
        # Choices validation
        if 'choices' in rules:
            if str_value not in rules['choices']:
                result['errors'].append(f"{field_name} must be one of: {', '.join(rules['choices'])}")
                result['valid'] = False
        
        return result
    
    def _validate_type(self, value: str, expected_type: str) -> Dict[str, Any]:
        """Validate and convert value type."""
        result = {
            'valid': True,
            'errors': [],
            'converted_value': value
        }
        
        try:
            if expected_type == 'integer':
                result['converted_value'] = int(value)
            elif expected_type == 'float':
                result['converted_value'] = float(value)
            elif expected_type == 'decimal':
                result['converted_value'] = Decimal(value)
            elif expected_type == 'boolean':
                if value.lower() in ['true', '1', 'yes', 'on']:
                    result['converted_value'] = True
                elif value.lower() in ['false', '0', 'no', 'off']:
                    result['converted_value'] = False
                else:
                    raise ValueError("Invalid boolean value")
            elif expected_type == 'date':
                # Try common date formats
                for fmt in ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%Y-%m-%d %H:%M:%S']:
                    try:
                        result['converted_value'] = datetime.strptime(value, fmt).date()
                        break
                    except ValueError:
                        continue
                else:
                    raise ValueError("Invalid date format")
            elif expected_type == 'datetime':
                # Try common datetime formats
                for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%m/%d/%Y %H:%M']:
                    try:
                        result['converted_value'] = datetime.strptime(value, fmt)
                        break
                    except ValueError:
                        continue
                else:
                    raise ValueError("Invalid datetime format")
            elif expected_type == 'string':
                result['converted_value'] = str(value)
            else:
                result['errors'].append(f"Unknown type: {expected_type}")
                result['valid'] = False
                
        except (ValueError, InvalidOperation) as e:
            result['errors'].append(f"Invalid {expected_type}: {str(e)}")
            result['valid'] = False
        
        return result
    
    def _validate_email(self, email: str) -> Dict[str, Any]:
        """Validate email address."""
        result = {
            'valid': True,
            'errors': []
        }
        
        try:
            # Use email-validator library for comprehensive validation
            validate_email(email)
        except EmailNotValidError as e:
            result['errors'].append(f"Invalid email address: {str(e)}")
            result['valid'] = False
        except Exception as e:
            result['errors'].append(f"Email validation error: {str(e)}")
            result['valid'] = False
        
        return result
    
    def _validate_phone(self, phone: str) -> Dict[str, Any]:
        """Validate and format phone number."""
        result = {
            'valid': True,
            'errors': [],
            'formatted_phone': phone
        }
        
        try:
            # Parse phone number (assuming US if no country code)
            parsed = phonenumbers.parse(phone, "US")
            
            if phonenumbers.is_valid_number(parsed):
                # Format as E164 (international format)
                result['formatted_phone'] = phonenumbers.format_number(
                    parsed, phonenumbers.PhoneNumberFormat.E164
                )
            else:
                result['errors'].append("Invalid phone number")
                result['valid'] = False
                
        except phonenumbers.NumberParseException:
            # Fallback to regex validation
            if not re.match(self.PATTERNS['phone'], phone):
                result['errors'].append("Invalid phone number format")
                result['valid'] = False
        except Exception as e:
            result['errors'].append(f"Phone validation error: {str(e)}")
            result['valid'] = False
        
        return result
    
    def validate_business_rules(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate business-specific rules for DroneStrike data.
        
        Args:
            data: Data to validate
            
        Returns:
            Validation result
        """
        result = {
            'valid': True,
            'errors': [],
            'warnings': []
        }
        
        try:
            # Lead validation rules
            if 'lead_score' in data:
                score = data['lead_score']
                if isinstance(score, (int, float)):
                    if score < 0 or score > 100:
                        result['errors'].append("Lead score must be between 0 and 100")
                        result['valid'] = False
            
            # Property validation rules
            if 'property_value' in data:
                value = data['property_value']
                if isinstance(value, (int, float)):
                    if value < 0:
                        result['errors'].append("Property value cannot be negative")
                        result['valid'] = False
                    elif value > 50000000:  # $50M
                        result['warnings'].append("Property value is unusually high")
            
            # Mission validation rules
            if 'mission_priority' in data:
                priority = data['mission_priority']
                if priority not in ['low', 'medium', 'high', 'critical']:
                    result['errors'].append("Mission priority must be: low, medium, high, or critical")
                    result['valid'] = False
            
            # Date validation rules
            if 'start_date' in data and 'end_date' in data:
                start = data['start_date']
                end = data['end_date']
                
                # Convert strings to dates if needed
                if isinstance(start, str):
                    try:
                        start = datetime.strptime(start, '%Y-%m-%d').date()
                    except ValueError:
                        pass
                
                if isinstance(end, str):
                    try:
                        end = datetime.strptime(end, '%Y-%m-%d').date()
                    except ValueError:
                        pass
                
                if isinstance(start, date) and isinstance(end, date):
                    if start > end:
                        result['errors'].append("Start date cannot be after end date")
                        result['valid'] = False
            
            # Financial validation
            if 'opportunity_amount' in data:
                amount = data['opportunity_amount']
                if isinstance(amount, (int, float)):
                    if amount < 0:
                        result['errors'].append("Opportunity amount cannot be negative")
                        result['valid'] = False
                    elif amount > 10000000:  # $10M
                        result['warnings'].append("Opportunity amount is unusually high")
            
        except Exception as e:
            result['errors'].append(f"Business rule validation error: {str(e)}")
            result['valid'] = False
            logger.error(f"Business rule validation failed: {e}")
        
        return result
    
    def validate_bulk_data(self, data_list: List[Dict[str, Any]], 
                          rules: Dict[str, Dict[str, Any]],
                          max_errors: int = 100) -> Dict[str, Any]:
        """
        Validate bulk data with error limiting.
        
        Args:
            data_list: List of data dictionaries to validate
            rules: Validation rules
            max_errors: Maximum number of errors to collect
            
        Returns:
            Bulk validation result
        """
        result = {
            'valid': True,
            'total_records': len(data_list),
            'valid_records': 0,
            'invalid_records': 0,
            'errors': [],
            'warnings': [],
            'error_summary': {},
            'sample_valid_data': []
        }
        
        try:
            error_count = 0
            
            for index, record in enumerate(data_list):
                if error_count >= max_errors:
                    result['warnings'].append(f"Stopped validation at {max_errors} errors")
                    break
                
                record_result = self.validate_data(record, rules)
                
                if record_result['valid']:
                    result['valid_records'] += 1
                    if len(result['sample_valid_data']) < 5:
                        result['sample_valid_data'].append({
                            'index': index,
                            'data': record_result['cleaned_data']
                        })
                else:
                    result['invalid_records'] += 1
                    result['valid'] = False
                    
                    # Collect error details
                    for field, errors in record_result['errors'].items():
                        for error in errors:
                            if error_count < max_errors:
                                result['errors'].append({
                                    'record_index': index,
                                    'field': field,
                                    'error': error,
                                    'value': record.get(field)
                                })
                                error_count += 1
                            
                            # Track error frequency
                            error_key = f"{field}: {error}"
                            result['error_summary'][error_key] = result['error_summary'].get(error_key, 0) + 1
            
            # Calculate success rate
            if result['total_records'] > 0:
                result['success_rate'] = (result['valid_records'] / result['total_records']) * 100
            else:
                result['success_rate'] = 0
            
            logger.info(f"Bulk validation completed", extra={
                'total_records': result['total_records'],
                'valid_records': result['valid_records'],
                'success_rate': result['success_rate']
            })
            
        except Exception as e:
            result['valid'] = False
            result['errors'].append(f"Bulk validation error: {str(e)}")
            logger.error(f"Bulk validation failed: {e}")
        
        return result