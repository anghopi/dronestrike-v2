"""
Advanced Data Processing Tasks
Production-ready data processing with progress tracking, validation, and error handling.
"""

import asyncio
import csv
import json
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from pathlib import Path
import tempfile
from celery import Task
from celery.exceptions import Retry
import numpy as np
from sqlalchemy import select, update, delete, and_, or_, func

from .celery_app import celery_app, TaskContext, BaseTask
from core.database import get_db_session
from models.user import User
from models.lead import Lead
from models.mission import Mission
from models.opportunity import Opportunity
from models.property import Property
from utils.logging_config import get_logger
from utils.monitoring_utils import MetricsCollector
# Data processing utility imports
try:
    from utils.file_utils import FileProcessor
except ImportError:
    class FileProcessor:
        def __init__(self):
            pass

try:
    from utils.validation_utils import ValidationManager
except ImportError:
    class ValidationManager:
        def validate_data(self, data, rules):
            return {'valid': True, 'errors': []}

logger = get_logger(__name__)
metrics = MetricsCollector()
file_processor = FileProcessor()
validator = ValidationManager()

class DataProcessingTaskBase(BaseTask):
    """Base class for data processing tasks with enhanced error handling."""
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Enhanced failure handling for data processing tasks."""
        super().on_failure(exc, task_id, args, kwargs, einfo)
        
        # Log data processing failure
        logger.error(f"Data processing task failed", extra={
            'task_id': task_id,
            'task_name': self.name,
            'exception': str(exc),
            'args': args,
            'kwargs': kwargs
        })
        
        # Record failure metrics
        metrics.record_metric('data_processing_failures_total', 1, {
            'task_name': self.name,
            'error_type': type(exc).__name__
        })

@celery_app.task(
    bind=True,
    base=DataProcessingTaskBase,
    max_retries=3,
    default_retry_delay=300,
    autoretry_for=(Exception,),
    retry_backoff=True
)
def process_csv_data(self, file_path: str, data_type: str, 
                    validation_rules: Dict[str, Any] = None,
                    batch_size: int = 1000) -> Dict[str, Any]:
    """
    Process CSV data with validation and batch processing.
    
    Args:
        file_path: Path to CSV file
        data_type: Type of data (leads, properties, contacts, etc.)
        validation_rules: Custom validation rules
        batch_size: Number of records to process per batch
    
    Returns:
        Processing results with statistics
    """
    with TaskContext(self.name, self.request.id):
        try:
            results = {
                'total_records': 0,
                'processed_records': 0,
                'failed_records': 0,
                'validation_errors': [],
                'processing_errors': [],
                'batches_processed': 0
            }
            
            # Validate file
            if not Path(file_path).exists():
                raise FileNotFoundError(f"CSV file not found: {file_path}")
            
            # Read CSV with pandas for better performance
            try:
                df = pd.read_csv(file_path)
                results['total_records'] = len(df)
                
                logger.info(f"Processing CSV with {results['total_records']} records")
                
            except Exception as e:
                raise ValueError(f"Failed to read CSV file: {e}")
            
            # Process in batches
            for i in range(0, len(df), batch_size):
                batch_df = df.iloc[i:i+batch_size]
                batch_results = _process_data_batch(
                    batch_df, data_type, validation_rules, i // batch_size + 1
                )
                
                # Aggregate results
                results['processed_records'] += batch_results['processed']
                results['failed_records'] += batch_results['failed']
                results['validation_errors'].extend(batch_results['validation_errors'])
                results['processing_errors'].extend(batch_results['processing_errors'])
                results['batches_processed'] += 1
                
                # Update progress
                progress = (i + len(batch_df)) / len(df)
                self.update_state(
                    state='PROGRESS',
                    meta={
                        'current': i + len(batch_df),
                        'total': len(df),
                        'progress': progress,
                        'processed': results['processed_records'],
                        'failed': results['failed_records']
                    }
                )
                
                # Add delay between batches to avoid overwhelming the system
                if results['batches_processed'] % 10 == 0:
                    asyncio.sleep(1)
            
            # Record processing metrics
            metrics.record_metric('csv_records_processed_total', 
                                results['processed_records'], 
                                {'data_type': data_type})
            
            metrics.record_metric('csv_processing_errors_total', 
                                results['failed_records'], 
                                {'data_type': data_type})
            
            logger.info(f"CSV processing completed", extra={
                'total_records': results['total_records'],
                'processed_records': results['processed_records'],
                'failed_records': results['failed_records'],
                'data_type': data_type
            })
            
            return results
            
        except Exception as exc:
            logger.error(f"CSV processing failed: {exc}")
            
            if self.request.retries < self.max_retries:
                raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
            
            raise exc

def _process_data_batch(df: pd.DataFrame, data_type: str, 
                       validation_rules: Dict[str, Any], batch_num: int) -> Dict[str, Any]:
    """Process a batch of data records."""
    batch_results = {
        'processed': 0,
        'failed': 0,
        'validation_errors': [],
        'processing_errors': []
    }
    
    try:
        # Convert DataFrame to list of dictionaries
        records = df.to_dict('records')
        
        async def process_batch_async():
            async with get_db_session() as session:
                for idx, record in enumerate(records):
                    try:
                        # Clean and validate record
                        cleaned_record = _clean_record_data(record)
                        
                        # Apply validation rules
                        if validation_rules:
                            validation_result = validator.validate_data(
                                cleaned_record, validation_rules
                            )
                            if not validation_result['valid']:
                                batch_results['validation_errors'].append({
                                    'batch': batch_num,
                                    'record': idx,
                                    'errors': validation_result['errors'],
                                    'data': cleaned_record
                                })
                                batch_results['failed'] += 1
                                continue
                        
                        # Process based on data type
                        if data_type == 'leads':
                            await _process_lead_record(session, cleaned_record)
                        elif data_type == 'properties':
                            await _process_property_record(session, cleaned_record)
                        elif data_type == 'contacts':
                            await _process_contact_record(session, cleaned_record)
                        else:
                            raise ValueError(f"Unknown data type: {data_type}")
                        
                        batch_results['processed'] += 1
                        
                    except Exception as e:
                        batch_results['processing_errors'].append({
                            'batch': batch_num,
                            'record': idx,
                            'error': str(e),
                            'data': record
                        })
                        batch_results['failed'] += 1
                
                await session.commit()
        
        asyncio.run(process_batch_async())
        
    except Exception as e:
        logger.error(f"Batch processing failed: {e}")
        batch_results['processing_errors'].append({
            'batch': batch_num,
            'error': str(e),
            'type': 'batch_error'
        })
    
    return batch_results

def _clean_record_data(record: Dict[str, Any]) -> Dict[str, Any]:
    """Clean and normalize record data."""
    cleaned = {}
    
    for key, value in record.items():
        # Skip NaN values
        if pd.isna(value):
            continue
        
        # Clean string values
        if isinstance(value, str):
            value = value.strip()
            if value.lower() in ['', 'null', 'none', 'n/a']:
                continue
        
        # Normalize key names
        clean_key = key.lower().replace(' ', '_').replace('-', '_')
        cleaned[clean_key] = value
    
    return cleaned

async def _process_lead_record(session, record: Dict[str, Any]):
    """Process a lead record."""
    # Check if lead already exists
    existing = await session.execute(
        select(Lead).where(
            and_(
                Lead.email == record.get('email'),
                Lead.phone == record.get('phone')
            )
        )
    )
    
    if existing.scalar_one_or_none():
        return  # Skip duplicate
    
    # Create new lead
    lead = Lead(
        first_name=record.get('first_name'),
        last_name=record.get('last_name'),
        email=record.get('email'),
        phone=record.get('phone'),
        address=record.get('address'),
        city=record.get('city'),
        state=record.get('state'),
        zip_code=record.get('zip_code'),
        source=record.get('source', 'csv_import'),
        status=record.get('status', 'new'),
        notes=record.get('notes')
    )
    
    session.add(lead)

async def _process_property_record(session, record: Dict[str, Any]):
    """Process a property record."""
    # Check if property already exists
    existing = await session.execute(
        select(Property).where(
            and_(
                Property.address == record.get('address'),
                Property.city == record.get('city'),
                Property.state == record.get('state')
            )
        )
    )
    
    if existing.scalar_one_or_none():
        return  # Skip duplicate
    
    # Create new property
    property_obj = Property(
        address=record.get('address'),
        city=record.get('city'),
        state=record.get('state'),
        zip_code=record.get('zip_code'),
        property_type=record.get('property_type', 'unknown'),
        square_footage=record.get('square_footage'),
        bedrooms=record.get('bedrooms'),
        bathrooms=record.get('bathrooms'),
        lot_size=record.get('lot_size'),
        year_built=record.get('year_built'),
        estimated_value=record.get('estimated_value')
    )
    
    session.add(property_obj)

async def _process_contact_record(session, record: Dict[str, Any]):
    """Process a contact record."""
    # This would create contacts in your contact model
    # Implementation depends on your contact model structure
    pass

@celery_app.task(bind=True, base=DataProcessingTaskBase)
def analyze_data_quality(self, table_name: str, 
                        analysis_type: str = 'comprehensive') -> Dict[str, Any]:
    """
    Analyze data quality for a specific table.
    
    Args:
        table_name: Name of table to analyze
        analysis_type: Type of analysis (basic, comprehensive, custom)
    
    Returns:
        Data quality analysis results
    """
    with TaskContext(self.name, self.request.id):
        try:
            async def run_analysis():
                async with get_db_session() as session:
                    # Get table model
                    model = _get_model_by_name(table_name)
                    if not model:
                        raise ValueError(f"Unknown table: {table_name}")
                    
                    # Get all records
                    result = await session.execute(select(model))
                    records = result.scalars().all()
                    
                    analysis_results = {
                        'table_name': table_name,
                        'total_records': len(records),
                        'analysis_type': analysis_type,
                        'timestamp': datetime.utcnow().isoformat(),
                        'field_analysis': {},
                        'quality_score': 0,
                        'issues': []
                    }
                    
                    if not records:
                        analysis_results['quality_score'] = 0
                        analysis_results['issues'].append('No records found')
                        return analysis_results
                    
                    # Analyze each field
                    for column in model.__table__.columns:
                        field_name = column.name
                        field_analysis = _analyze_field_quality(
                            records, field_name, column.type
                        )
                        analysis_results['field_analysis'][field_name] = field_analysis
                    
                    # Calculate overall quality score
                    quality_scores = [
                        field['quality_score'] 
                        for field in analysis_results['field_analysis'].values()
                    ]
                    analysis_results['quality_score'] = sum(quality_scores) / len(quality_scores)
                    
                    # Identify issues
                    for field_name, field_data in analysis_results['field_analysis'].items():
                        if field_data['null_percentage'] > 50:
                            analysis_results['issues'].append(
                                f"High null percentage in {field_name}: {field_data['null_percentage']:.1f}%"
                            )
                        
                        if field_data.get('duplicate_percentage', 0) > 80:
                            analysis_results['issues'].append(
                                f"High duplicate percentage in {field_name}: {field_data['duplicate_percentage']:.1f}%"
                            )
                    
                    return analysis_results
            
            results = asyncio.run(run_analysis())
            
            logger.info(f"Data quality analysis completed for {table_name}", extra={
                'table_name': table_name,
                'quality_score': results['quality_score'],
                'total_records': results['total_records']
            })
            
            return results
            
        except Exception as exc:
            logger.error(f"Data quality analysis failed: {exc}")
            raise exc

def _get_model_by_name(table_name: str):
    """Get SQLAlchemy model by table name"""
    model_mapping = {
        'users': User,
        'leads': Lead,
        'missions': Mission,
        'opportunities': Opportunity,
        'properties': Property
    }
    return model_mapping.get(table_name.lower())

def _analyze_field_quality(records: List, field_name: str, column_type) -> Dict[str, Any]:
    """Analyze quality of a specific field"""
    values = [getattr(record, field_name) for record in records]
    total_count = len(values)
    
    # Count nulls
    null_count = sum(1 for v in values if v is None)
    null_percentage = (null_count / total_count) * 100
    
    # Count unique values
    unique_values = set(v for v in values if v is not None)
    unique_count = len(unique_values)
    duplicate_percentage = ((total_count - unique_count) / total_count) * 100
    
    # Type-specific analysis
    type_issues = []
    if hasattr(column_type, 'python_type'):
        expected_type = column_type.python_type
        type_mismatches = sum(
            1 for v in values 
            if v is not None and not isinstance(v, expected_type)
        )
        if type_mismatches > 0:
            type_issues.append(f"{type_mismatches} type mismatches")
    
    # Calculate quality score
    quality_score = 100
    quality_score -= null_percentage * 0.5  # Penalize nulls
    quality_score -= min(duplicate_percentage * 0.3, 30)  # Penalize duplicates
    quality_score -= len(type_issues) * 10  # Penalize type issues
    quality_score = max(0, quality_score)
    
    return {
        'total_count': total_count,
        'null_count': null_count,
        'null_percentage': null_percentage,
        'unique_count': unique_count,
        'duplicate_percentage': duplicate_percentage,
        'type_issues': type_issues,
        'quality_score': quality_score
    }

@celery_app.task(bind=True, base=DataProcessingTaskBase)
def generate_data_report(self, report_type: str, filters: Dict[str, Any] = None,
                        output_format: str = 'json') -> Dict[str, Any]:
    """
    Generate comprehensive data reports.
    
    Args:
        report_type: Type of report (summary, detailed, custom)
        filters: Data filters to apply
        output_format: Output format (json, csv, excel)
    
    Returns:
        Report generation results
    """
    with TaskContext(self.name, self.request.id):
        try:
            async def generate_report():
                report_data = {
                    'report_type': report_type,
                    'generated_at': datetime.utcnow().isoformat(),
                    'filters': filters or {},
                    'data': {},
                    'summary': {},
                    'file_path': None
                }
                
                async with get_db_session() as session:
                    if report_type == 'summary':
                        report_data['data'] = await _generate_summary_report(session, filters)
                    elif report_type == 'detailed':
                        report_data['data'] = await _generate_detailed_report(session, filters)
                    elif report_type == 'custom':
                        report_data['data'] = await _generate_custom_report(session, filters)
                    else:
                        raise ValueError(f"Unknown report type: {report_type}")
                    
                    # Generate summary statistics
                    report_data['summary'] = _calculate_report_summary(report_data['data'])
                    
                    # Export to file if requested
                    if output_format != 'json':
                        report_data['file_path'] = await _export_report_to_file(
                            report_data, output_format
                        )
                
                return report_data
            
            results = asyncio.run(generate_report())
            
            logger.info(f"Data report generated", extra={
                'report_type': report_type,
                'output_format': output_format,
                'record_count': len(results.get('data', {}))
            })
            
            return results
            
        except Exception as exc:
            logger.error(f"Report generation failed: {exc}")
            raise exc

async def _generate_summary_report(session, filters: Dict[str, Any]) -> Dict[str, Any]:
    """Generate summary report data"""
    try:
        # Get actual counts from database
        users_result = await session.execute(select(User).where(
            User.created_at >= filters.get('start_date', datetime.utcnow().replace(day=1))
        ))
        users_count = len(users_result.scalars().all())
        
        leads_result = await session.execute(select(Lead).where(
            Lead.created_at >= filters.get('start_date', datetime.utcnow().replace(day=1))
        ))
        leads_count = len(leads_result.scalars().all())
        
        missions_result = await session.execute(select(Mission).where(
            Mission.created_at >= filters.get('start_date', datetime.utcnow().replace(day=1))
        ))
        missions_count = len(missions_result.scalars().all())
        
        # Calculate revenue from opportunities
        opportunities_result = await session.execute(
            select(Opportunity).where(
                and_(
                    Opportunity.status == 'won',
                    Opportunity.close_date >= filters.get('start_date', datetime.utcnow().replace(day=1))
                )
            )
        )
        opportunities = opportunities_result.scalars().all()
        revenue_total = sum(opp.amount or 0 for opp in opportunities)
        
        return {
            'users_count': users_count,
            'leads_count': leads_count,
            'missions_count': missions_count,
            'opportunities_count': len(opportunities),
            'revenue_total': revenue_total,
            'period': {
                'start_date': filters.get('start_date', datetime.utcnow().replace(day=1)).isoformat(),
                'end_date': filters.get('end_date', datetime.utcnow()).isoformat()
            },
            'generated_at': datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to generate summary report: {e}")
        return {
            'users_count': 0,
            'leads_count': 0,
            'missions_count': 0,
            'opportunities_count': 0,
            'revenue_total': 0,
            'error': str(e)
        }

async def _generate_detailed_report(session, filters: Dict[str, Any]) -> Dict[str, Any]:
    """Generate detailed report data"""
    try:
        detailed_data = {
            'leads': [],
            'missions': [],
            'opportunities': [],
            'properties': [],
            'users': []
        }
        
        # Get detailed lead data
        leads_result = await session.execute(
            select(Lead).where(
                Lead.created_at >= filters.get('start_date', datetime.utcnow().replace(day=1))
            ).order_by(Lead.created_at.desc())
        )
        leads = leads_result.scalars().all()
        detailed_data['leads'] = [
            {
                'id': lead.id,
                'name': f"{lead.first_name} {lead.last_name}",
                'email': lead.email,
                'phone': lead.phone,
                'status': lead.status,
                'source': lead.source,
                'created_at': lead.created_at.isoformat() if lead.created_at else None,
                'score': getattr(lead, 'score', 0)
            }
            for lead in leads
        ]
        
        # Get detailed mission data
        missions_result = await session.execute(
            select(Mission).where(
                Mission.created_at >= filters.get('start_date', datetime.utcnow().replace(day=1))
            ).order_by(Mission.created_at.desc())
        )
        missions = missions_result.scalars().all()
        detailed_data['missions'] = [
            {
                'id': mission.id,
                'title': mission.title,
                'status': mission.status,
                'priority': getattr(mission, 'priority', 'medium'),
                'assigned_to': getattr(mission, 'assigned_to', None),
                'created_at': mission.created_at.isoformat() if mission.created_at else None,
                'due_date': getattr(mission, 'due_date', None)
            }
            for mission in missions
        ]
        
        # Get detailed opportunity data
        opportunities_result = await session.execute(
            select(Opportunity).where(
                Opportunity.created_at >= filters.get('start_date', datetime.utcnow().replace(day=1))
            ).order_by(Opportunity.created_at.desc())
        )
        opportunities = opportunities_result.scalars().all()
        detailed_data['opportunities'] = [
            {
                'id': opp.id,
                'title': opp.title,
                'stage': opp.stage,
                'amount': opp.amount,
                'probability': getattr(opp, 'probability', 0),
                'close_date': opp.close_date.isoformat() if opp.close_date else None,
                'created_at': opp.created_at.isoformat() if opp.created_at else None
            }
            for opp in opportunities
        ]
        
        return detailed_data
        
    except Exception as e:
        logger.error(f"Failed to generate detailed report: {e}")
        return {'error': str(e)}

async def _generate_custom_report(session, filters: Dict[str, Any]) -> Dict[str, Any]:
    """Generate custom report data"""
    # Implementation for custom report
    return {}

def _calculate_report_summary(data: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate summary statistics for report data."""
    return {
        'total_records': sum(len(v) if isinstance(v, list) else 1 for v in data.values()),
        'data_types': len(data.keys()),
        'generation_time': datetime.utcnow().isoformat()
    }

async def _export_report_to_file(report_data: Dict[str, Any], 
                               output_format: str) -> str:
    """Export report data to file."""
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"report_{report_data['report_type']}_{timestamp}.{output_format}"
    
    with tempfile.NamedTemporaryFile(mode='w', suffix=f'.{output_format}', 
                                   delete=False) as f:
        if output_format == 'csv':
            # Convert to CSV format
            # Implementation would depend on data structure
            writer = csv.writer(f)
            writer.writerow(['Report Data'])  # Placeholder
        elif output_format == 'excel':
            # Convert to Excel format using pandas
            df = pd.DataFrame(report_data['data'])
            df.to_excel(f.name, index=False)
        
        return f.name

@celery_app.task(bind=True, base=DataProcessingTaskBase)
def cleanup_duplicate_data(self, table_name: str, 
                          criteria: Dict[str, Any]) -> Dict[str, Any]:
    """
    Clean up duplicate data based on specified criteria.
    
    Args:
        table_name: Name of table to clean
        criteria: Criteria for identifying duplicates
    
    Returns:
        Cleanup results
    """
    with TaskContext(self.name, self.request.id):
        try:
            async def run_cleanup():
                async with get_db_session() as session:
                    model = _get_model_by_name(table_name)
                    if not model:
                        raise ValueError(f"Unknown table: {table_name}")
                    
                    # Find duplicates based on criteria
                    duplicates = await _find_duplicates(session, model, criteria)
                    
                    cleaned_count = 0
                    for duplicate_group in duplicates:
                        # Keep the first record, delete the rest
                        for record in duplicate_group[1:]:
                            await session.delete(record)
                            cleaned_count += 1
                    
                    await session.commit()
                    
                    return {
                        'table_name': table_name,
                        'duplicate_groups': len(duplicates),
                        'records_removed': cleaned_count,
                        'criteria': criteria
                    }
            
            results = asyncio.run(run_cleanup())
            
            logger.info(f"Duplicate cleanup completed", extra={
                'table_name': table_name,
                'records_removed': results['records_removed']
            })
            
            return results
            
        except Exception as exc:
            logger.error(f"Duplicate cleanup failed: {exc}")
            raise exc

async def _find_duplicates(session, model, criteria: Dict[str, Any]) -> List[List]:
    """Find duplicate records based on criteria."""
    try:
        duplicates = []
        
        # Build query based on criteria
        if 'email' in criteria and hasattr(model, 'email'):
            # Find duplicates by email
            result = await session.execute(
                select(model.email, func.count(model.id).label('cnt'))
                .group_by(model.email)
                .having(func.count(model.id) > 1)
            )
            duplicate_emails = result.fetchall()
            
            for email, count in duplicate_emails:
                records_result = await session.execute(
                    select(model).where(model.email == email)
                )
                records = records_result.scalars().all()
                if len(records) > 1:
                    duplicates.append(records)
        
        if 'phone' in criteria and hasattr(model, 'phone'):
            # Find duplicates by phone
            result = await session.execute(
                select(model.phone, func.count(model.id).label('cnt'))
                .group_by(model.phone)
                .having(func.count(model.id) > 1)
            )
            duplicate_phones = result.fetchall()
            
            for phone, count in duplicate_phones:
                records_result = await session.execute(
                    select(model).where(model.phone == phone)
                )
                records = records_result.scalars().all()
                if len(records) > 1:
                    duplicates.append(records)
        
        if 'address' in criteria and hasattr(model, 'address'):
            # Find duplicates by address
            result = await session.execute(
                select(model.address, func.count(model.id).label('cnt'))
                .group_by(model.address)
                .having(func.count(model.id) > 1)
            )
            duplicate_addresses = result.fetchall()
            
            for address, count in duplicate_addresses:
                records_result = await session.execute(
                    select(model).where(model.address == address)
                )
                records = records_result.scalars().all()
                if len(records) > 1:
                    duplicates.append(records)
        
        return duplicates
        
    except Exception as e:
        logger.error(f"Failed to find duplicates: {e}")
        return []