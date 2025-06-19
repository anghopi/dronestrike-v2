"""
File processing utilities for data handling and validation.
"""

import os
import csv
import json
import mimetypes
from pathlib import Path
from typing import Dict, List, Optional, Any, Union, Tuple
import pandas as pd
from datetime import datetime
import hashlib
import shutil
import tempfile

from utils.logging_config import get_logger

logger = get_logger(__name__)


class FileProcessor:
    """Enhanced file processing utilities for DroneStrike system."""
    
    ALLOWED_EXTENSIONS = {
        'csv': ['text/csv', 'application/csv'],
        'excel': ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        'json': ['application/json'],
        'txt': ['text/plain'],
        'pdf': ['application/pdf'],
        'images': ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        'documents': ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    }
    
    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
    
    def __init__(self, upload_dir: str = "/tmp/uploads"):
        """
        Initialize file processor.
        
        Args:
            upload_dir: Directory for temporary file uploads
        """
        self.upload_dir = Path(upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
    
    def validate_file(self, file_path: Union[str, Path], 
                     allowed_types: List[str] = None) -> Dict[str, Any]:
        """
        Validate file type, size, and accessibility.
        
        Args:
            file_path: Path to file
            allowed_types: List of allowed file types
            
        Returns:
            Validation result with details
        """
        file_path = Path(file_path)
        result = {
            'valid': False,
            'errors': [],
            'warnings': [],
            'file_info': {}
        }
        
        try:
            # Check if file exists
            if not file_path.exists():
                result['errors'].append(f"File does not exist: {file_path}")
                return result
            
            # Check if it's a file (not directory)
            if not file_path.is_file():
                result['errors'].append(f"Path is not a file: {file_path}")
                return result
            
            # Get file info
            stat = file_path.stat()
            file_size = stat.st_size
            mime_type, _ = mimetypes.guess_type(str(file_path))
            
            result['file_info'] = {
                'name': file_path.name,
                'size': file_size,
                'size_mb': round(file_size / (1024 * 1024), 2),
                'extension': file_path.suffix.lower(),
                'mime_type': mime_type,
                'created': datetime.fromtimestamp(stat.st_ctime),
                'modified': datetime.fromtimestamp(stat.st_mtime),
                'md5_hash': self._calculate_file_hash(file_path)
            }
            
            # Check file size
            if file_size > self.MAX_FILE_SIZE:
                result['errors'].append(
                    f"File size ({result['file_info']['size_mb']} MB) exceeds maximum allowed size "
                    f"({self.MAX_FILE_SIZE / (1024 * 1024)} MB)"
                )
            
            # Check file type if restrictions specified
            if allowed_types:
                valid_type = False
                for file_type in allowed_types:
                    if file_type in self.ALLOWED_EXTENSIONS:
                        if mime_type in self.ALLOWED_EXTENSIONS[file_type]:
                            valid_type = True
                            break
                        if result['file_info']['extension'] in ['.csv', '.xlsx', '.json', '.txt', '.pdf']:
                            if file_type == 'csv' and result['file_info']['extension'] == '.csv':
                                valid_type = True
                                break
                            elif file_type == 'excel' and result['file_info']['extension'] in ['.xlsx', '.xls']:
                                valid_type = True
                                break
                            elif file_type == 'json' and result['file_info']['extension'] == '.json':
                                valid_type = True
                                break
                
                if not valid_type:
                    result['errors'].append(
                        f"File type '{mime_type}' not allowed. Allowed types: {allowed_types}"
                    )
            
            # Additional validations based on file type
            if result['file_info']['extension'] == '.csv':
                csv_validation = self._validate_csv_file(file_path)
                if not csv_validation['valid']:
                    result['errors'].extend(csv_validation['errors'])
                else:
                    result['file_info'].update(csv_validation['info'])
            
            elif result['file_info']['extension'] in ['.xlsx', '.xls']:
                excel_validation = self._validate_excel_file(file_path)
                if not excel_validation['valid']:
                    result['errors'].extend(excel_validation['errors'])
                else:
                    result['file_info'].update(excel_validation['info'])
            
            # Set valid flag
            result['valid'] = len(result['errors']) == 0
            
            logger.info(f"File validation completed for {file_path.name}", extra={
                'valid': result['valid'],
                'file_size': file_size,
                'mime_type': mime_type
            })
            
        except Exception as e:
            result['errors'].append(f"File validation error: {str(e)}")
            logger.error(f"File validation failed for {file_path}: {e}")
        
        return result
    
    def _validate_csv_file(self, file_path: Path) -> Dict[str, Any]:
        """Validate CSV file structure and content."""
        result = {'valid': True, 'errors': [], 'info': {}}
        
        try:
            # Try to read with pandas
            df = pd.read_csv(file_path, nrows=5)  # Read first 5 rows for validation
            
            result['info'].update({
                'columns': list(df.columns),
                'column_count': len(df.columns),
                'estimated_rows': len(df),
                'sample_data': df.head(3).to_dict('records')
            })
            
            # Check for empty file
            if len(df.columns) == 0:
                result['errors'].append("CSV file appears to be empty")
                result['valid'] = False
            
            # Check for reasonable column count
            if len(df.columns) > 100:
                result['errors'].append(f"CSV has too many columns ({len(df.columns)})")
                result['valid'] = False
            
        except pd.errors.EmptyDataError:
            result['errors'].append("CSV file is empty")
            result['valid'] = False
        except pd.errors.ParserError as e:
            result['errors'].append(f"CSV parsing error: {str(e)}")
            result['valid'] = False
        except Exception as e:
            result['errors'].append(f"CSV validation error: {str(e)}")
            result['valid'] = False
        
        return result
    
    def _validate_excel_file(self, file_path: Path) -> Dict[str, Any]:
        """Validate Excel file structure and content."""
        result = {'valid': True, 'errors': [], 'info': {}}
        
        try:
            # Read Excel file
            excel_file = pd.ExcelFile(file_path)
            result['info']['sheet_names'] = excel_file.sheet_names
            
            # Read first sheet for validation
            df = pd.read_excel(file_path, nrows=5)
            
            result['info'].update({
                'columns': list(df.columns),
                'column_count': len(df.columns),
                'estimated_rows': len(df),
                'sample_data': df.head(3).to_dict('records')
            })
            
        except Exception as e:
            result['errors'].append(f"Excel validation error: {str(e)}")
            result['valid'] = False
        
        return result
    
    def _calculate_file_hash(self, file_path: Path) -> str:
        """Calculate MD5 hash of file for integrity checking."""
        try:
            hash_md5 = hashlib.md5()
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_md5.update(chunk)
            return hash_md5.hexdigest()
        except Exception:
            return ""
    
    def process_csv_file(self, file_path: Union[str, Path], 
                        encoding: str = 'utf-8') -> Dict[str, Any]:
        """
        Process CSV file and return structured data.
        
        Args:
            file_path: Path to CSV file
            encoding: File encoding
            
        Returns:
            Processed data with metadata
        """
        file_path = Path(file_path)
        result = {
            'success': False,
            'data': [],
            'metadata': {},
            'errors': []
        }
        
        try:
            # Validate file first
            validation = self.validate_file(file_path, ['csv'])
            if not validation['valid']:
                result['errors'] = validation['errors']
                return result
            
            # Read CSV file
            df = pd.read_csv(file_path, encoding=encoding)
            
            # Convert to records
            result['data'] = df.to_dict('records')
            
            # Add metadata
            result['metadata'] = {
                'total_records': len(df),
                'columns': list(df.columns),
                'column_count': len(df.columns),
                'file_info': validation['file_info'],
                'data_types': df.dtypes.to_dict(),
                'null_counts': df.isnull().sum().to_dict(),
                'processed_at': datetime.utcnow().isoformat()
            }
            
            result['success'] = True
            
            logger.info(f"CSV file processed successfully", extra={
                'file': file_path.name,
                'records': len(df),
                'columns': len(df.columns)
            })
            
        except Exception as e:
            result['errors'].append(f"CSV processing error: {str(e)}")
            logger.error(f"CSV processing failed for {file_path}: {e}")
        
        return result
    
    def save_uploaded_file(self, file_data: bytes, filename: str, 
                          subdirectory: str = None) -> Dict[str, Any]:
        """
        Save uploaded file data to disk.
        
        Args:
            file_data: Binary file data
            filename: Original filename
            subdirectory: Optional subdirectory
            
        Returns:
            Save result with file path
        """
        result = {
            'success': False,
            'file_path': None,
            'errors': []
        }
        
        try:
            # Create subdirectory if specified
            save_dir = self.upload_dir
            if subdirectory:
                save_dir = save_dir / subdirectory
                save_dir.mkdir(parents=True, exist_ok=True)
            
            # Generate unique filename
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            name, ext = os.path.splitext(filename)
            unique_filename = f"{name}_{timestamp}{ext}"
            
            file_path = save_dir / unique_filename
            
            # Write file data
            with open(file_path, 'wb') as f:
                f.write(file_data)
            
            result['success'] = True
            result['file_path'] = str(file_path)
            
            logger.info(f"File saved successfully", extra={
                'filename': filename,
                'path': str(file_path),
                'size': len(file_data)
            })
            
        except Exception as e:
            result['errors'].append(f"File save error: {str(e)}")
            logger.error(f"File save failed for {filename}: {e}")
        
        return result
    
    def cleanup_temp_files(self, max_age_hours: int = 24) -> Dict[str, Any]:
        """
        Clean up temporary files older than specified age.
        
        Args:
            max_age_hours: Maximum age in hours
            
        Returns:
            Cleanup results
        """
        result = {
            'success': False,
            'files_deleted': 0,
            'space_freed': 0,
            'errors': []
        }
        
        try:
            current_time = datetime.utcnow().timestamp()
            max_age_seconds = max_age_hours * 3600
            
            for file_path in self.upload_dir.rglob('*'):
                if file_path.is_file():
                    file_age = current_time - file_path.stat().st_mtime
                    
                    if file_age > max_age_seconds:
                        try:
                            file_size = file_path.stat().st_size
                            file_path.unlink()
                            result['files_deleted'] += 1
                            result['space_freed'] += file_size
                        except Exception as e:
                            result['errors'].append(f"Failed to delete {file_path}: {e}")
            
            result['success'] = True
            result['space_freed_mb'] = round(result['space_freed'] / (1024 * 1024), 2)
            
            logger.info(f"Temp file cleanup completed", extra={
                'files_deleted': result['files_deleted'],
                'space_freed_mb': result['space_freed_mb']
            })
            
        except Exception as e:
            result['errors'].append(f"Cleanup error: {str(e)}")
            logger.error(f"Temp file cleanup failed: {e}")
        
        return result
    
    def create_backup(self, file_path: Union[str, Path], 
                     backup_dir: Union[str, Path] = None) -> Dict[str, Any]:
        """
        Create backup copy of file.
        
        Args:
            file_path: Original file path
            backup_dir: Backup directory (optional)
            
        Returns:
            Backup result
        """
        file_path = Path(file_path)
        result = {
            'success': False,
            'backup_path': None,
            'errors': []
        }
        
        try:
            if backup_dir is None:
                backup_dir = self.upload_dir / 'backups'
            else:
                backup_dir = Path(backup_dir)
            
            backup_dir.mkdir(parents=True, exist_ok=True)
            
            # Create backup filename with timestamp
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            backup_filename = f"{file_path.stem}_{timestamp}{file_path.suffix}"
            backup_path = backup_dir / backup_filename
            
            # Copy file
            shutil.copy2(file_path, backup_path)
            
            result['success'] = True
            result['backup_path'] = str(backup_path)
            
            logger.info(f"File backup created", extra={
                'original': str(file_path),
                'backup': str(backup_path)
            })
            
        except Exception as e:
            result['errors'].append(f"Backup error: {str(e)}")
            logger.error(f"File backup failed for {file_path}: {e}")
        
        return result