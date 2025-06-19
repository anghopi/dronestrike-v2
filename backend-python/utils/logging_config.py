"""
Advanced Logging Configuration
Production-ready structured logging with comprehensive monitoring and error tracking.
"""

import logging
import logging.handlers
import os
import sys
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, Union
import structlog
from pythonjsonlogger import jsonlogger
import uvicorn.logging

from core.config import settings

# Create logs directory
LOG_DIR = Path(settings.LOG_DIR)
LOG_DIR.mkdir(exist_ok=True)

# Custom JSON formatter
class CustomJSONFormatter(jsonlogger.JsonFormatter):
    """Custom JSON formatter with additional context."""
    
    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)
        
        # Add timestamp
        log_record['timestamp'] = datetime.utcnow().isoformat()
        
        # Add environment
        log_record['environment'] = settings.ENVIRONMENT
        
        # Add application name
        log_record['application'] = settings.APP_NAME
        
        # Add process info
        log_record['process_id'] = os.getpid()
        
        # Add request ID if available
        if hasattr(record, 'request_id'):
            log_record['request_id'] = record.request_id
        
        # Add user ID if available
        if hasattr(record, 'user_id'):
            log_record['user_id'] = record.user_id
        
        # Add trace ID for distributed tracing
        if hasattr(record, 'trace_id'):
            log_record['trace_id'] = record.trace_id

# Custom log filter for sensitive data
class SensitiveDataFilter(logging.Filter):
    """Filter to remove sensitive data from logs."""
    
    SENSITIVE_KEYS = [
        'password', 'token', 'secret', 'api_key', 'private_key',
        'access_token', 'refresh_token', 'authorization', 'cookie'
    ]
    
    def filter(self, record):
        """Filter sensitive data from log records."""
        if hasattr(record, 'args') and record.args:
            record.args = self._sanitize_data(record.args)
        
        if hasattr(record, 'msg') and isinstance(record.msg, dict):
            record.msg = self._sanitize_data(record.msg)
        
        return True
    
    def _sanitize_data(self, data):
        """Recursively sanitize sensitive data."""
        if isinstance(data, dict):
            return {
                key: '***REDACTED***' if any(sens in key.lower() for sens in self.SENSITIVE_KEYS)
                else self._sanitize_data(value)
                for key, value in data.items()
            }
        elif isinstance(data, (list, tuple)):
            return [self._sanitize_data(item) for item in data]
        else:
            return data

# Configure structured logging
def configure_structlog():
    """Configure structured logging with structlog."""
    
    timestamper = structlog.processors.TimeStamper(fmt="ISO")
    
    processors = [
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        timestamper,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
    ]
    
    # Add JSON processor for production
    if settings.ENVIRONMENT == 'production':
        processors.append(structlog.processors.JSONRenderer())
    else:
        processors.append(structlog.dev.ConsoleRenderer())
    
    structlog.configure(
        processors=processors,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

# Configure standard logging
def setup_logging():
    """Setup comprehensive logging configuration."""
    
    # Create formatters
    json_formatter = CustomJSONFormatter(
        '%(timestamp)s %(level)s %(name)s %(message)s'
    )
    
    console_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Create handlers
    handlers = []
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(console_formatter)
    console_handler.addFilter(SensitiveDataFilter())
    handlers.append(console_handler)
    
    # File handlers
    if settings.ENVIRONMENT == 'production':
        # Main log file with rotation
        file_handler = logging.handlers.RotatingFileHandler(
            LOG_DIR / 'app.log',
            maxBytes=100 * 1024 * 1024,  # 100MB
            backupCount=10
        )
        file_handler.setLevel(logging.INFO)
        file_handler.setFormatter(json_formatter)
        file_handler.addFilter(SensitiveDataFilter())
        handlers.append(file_handler)
        
        # Error log file
        error_handler = logging.handlers.RotatingFileHandler(
            LOG_DIR / 'error.log',
            maxBytes=50 * 1024 * 1024,  # 50MB
            backupCount=5
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(json_formatter)
        error_handler.addFilter(SensitiveDataFilter())
        handlers.append(error_handler)
        
        # Access log file
        access_handler = logging.handlers.RotatingFileHandler(
            LOG_DIR / 'access.log',
            maxBytes=100 * 1024 * 1024,  # 100MB
            backupCount=10
        )
        access_handler.setLevel(logging.INFO)
        access_handler.setFormatter(json_formatter)
        handlers.append(access_handler)
    
    # Configure root logger
    logging.basicConfig(
        level=getattr(logging, settings.LOG_LEVEL.upper()),
        handlers=handlers,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Configure specific loggers
    
    # Uvicorn access logger
    uvicorn_access = logging.getLogger("uvicorn.access")
    uvicorn_access.handlers = [h for h in handlers if 'access' in str(h)]
    
    # SQLAlchemy logger
    sqlalchemy_logger = logging.getLogger("sqlalchemy.engine")
    sqlalchemy_logger.setLevel(logging.WARNING)
    
    # Celery logger
    celery_logger = logging.getLogger("celery")
    celery_logger.setLevel(logging.INFO)
    
    # Disable noisy loggers
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("requests").setLevel(logging.WARNING)
    logging.getLogger("botocore").setLevel(logging.WARNING)
    logging.getLogger("boto3").setLevel(logging.WARNING)

def setup_celery_logging():
    """Setup logging specifically for Celery workers."""
    
    # Create Celery-specific formatter
    celery_formatter = CustomJSONFormatter(
        '%(timestamp)s %(level)s %(name)s %(task_name)s %(task_id)s %(message)s'
    )
    
    # Celery log file
    celery_handler = logging.handlers.RotatingFileHandler(
        LOG_DIR / 'celery.log',
        maxBytes=100 * 1024 * 1024,  # 100MB
        backupCount=10
    )
    celery_handler.setLevel(logging.INFO)
    celery_handler.setFormatter(celery_formatter)
    celery_handler.addFilter(SensitiveDataFilter())
    
    # Configure Celery loggers
    celery_logger = logging.getLogger("celery")
    celery_logger.addHandler(celery_handler)
    celery_logger.setLevel(logging.INFO)
    
    # Task logger
    task_logger = logging.getLogger("celery.task")
    task_logger.addHandler(celery_handler)
    task_logger.setLevel(logging.INFO)

# Context manager for request logging
class LogContext:
    """Context manager for adding request context to logs."""
    
    def __init__(self, request_id: str, user_id: Optional[int] = None, 
                 trace_id: Optional[str] = None):
        self.request_id = request_id
        self.user_id = user_id
        self.trace_id = trace_id
        self.old_factory = None
    
    def __enter__(self):
        old_factory = logging.getLogRecordFactory()
        
        def record_factory(*args, **kwargs):
            record = old_factory(*args, **kwargs)
            record.request_id = self.request_id
            if self.user_id:
                record.user_id = self.user_id
            if self.trace_id:
                record.trace_id = self.trace_id
            return record
        
        self.old_factory = old_factory
        logging.setLogRecordFactory(record_factory)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        logging.setLogRecordFactory(self.old_factory)

# Performance logging decorator
def log_performance(func_name: Optional[str] = None):
    """Decorator to log function performance."""
    def decorator(func):
        import functools
        import time
        
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            function_name = func_name or f"{func.__module__}.{func.__name__}"
            
            logger = get_logger(func.__module__)
            logger.debug(f"Starting {function_name}")
            
            try:
                result = func(*args, **kwargs)
                duration = time.time() - start_time
                
                logger.info(f"Completed {function_name}", extra={
                    'function_name': function_name,
                    'duration': duration,
                    'status': 'success'
                })
                
                return result
                
            except Exception as e:
                duration = time.time() - start_time
                
                logger.error(f"Failed {function_name}", extra={
                    'function_name': function_name,
                    'duration': duration,
                    'status': 'error',
                    'error': str(e)
                })
                
                raise
        
        return wrapper
    return decorator

# Async performance logging decorator
def log_async_performance(func_name: Optional[str] = None):
    """Decorator to log async function performance."""
    def decorator(func):
        import functools
        import time
        import asyncio
        
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            function_name = func_name or f"{func.__module__}.{func.__name__}"
            
            logger = get_logger(func.__module__)
            logger.debug(f"Starting {function_name}")
            
            try:
                result = await func(*args, **kwargs)
                duration = time.time() - start_time
                
                logger.info(f"Completed {function_name}", extra={
                    'function_name': function_name,
                    'duration': duration,
                    'status': 'success'
                })
                
                return result
                
            except Exception as e:
                duration = time.time() - start_time
                
                logger.error(f"Failed {function_name}", extra={
                    'function_name': function_name,
                    'duration': duration,
                    'status': 'error',
                    'error': str(e)
                })
                
                raise
        
        return wrapper
    return decorator

def get_logger(name: str) -> logging.Logger:
    """Get a configured logger instance."""
    return logging.getLogger(name)

# Initialize logging
configure_structlog()
setup_logging()

# Export commonly used loggers
app_logger = get_logger('dronestrike')
api_logger = get_logger('dronestrike.api')
task_logger = get_logger('dronestrike.tasks')
db_logger = get_logger('dronestrike.database')
security_logger = get_logger('dronestrike.security')