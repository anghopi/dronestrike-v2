"""
Advanced Celery Application Configuration
Production-ready task queue with comprehensive monitoring and error handling.
"""

import os
import ssl
from datetime import timedelta
from typing import Dict, Any, Optional
from celery import Celery
from celery.signals import (
    task_prerun, task_postrun, task_failure, task_retry,
    worker_ready, worker_shutdown, setup_logging
)
from kombu import Queue, Exchange
import structlog

from core.config import settings
from utils.logging_config import get_logger, setup_celery_logging
from utils.monitoring_utils import MetricsCollector
from utils.error_tracking import ErrorTracker

logger = get_logger(__name__)

# Celery configuration
celery_config = {
    # Broker settings
    'broker_url': settings.REDIS_URL,
    'result_backend': settings.REDIS_URL,
    'broker_connection_retry_on_startup': True,
    'broker_connection_retry': True,
    'broker_connection_max_retries': 10,
    
    # Task settings
    'task_serializer': 'json',
    'accept_content': ['json'],
    'result_serializer': 'json',
    'timezone': 'UTC',
    'enable_utc': True,
    'task_track_started': True,
    'task_time_limit': 30 * 60,  # 30 minutes
    'task_soft_time_limit': 25 * 60,  # 25 minutes
    'task_acks_late': True,
    'worker_prefetch_multiplier': 1,
    'task_reject_on_worker_lost': True,
    
    # Result backend settings
    'result_expires': 3600,  # 1 hour
    'result_backend_max_retries': 10,
    'result_backend_retry_delay': 0.1,
    
    # Worker settings
    'worker_max_tasks_per_child': 1000,
    'worker_disable_rate_limits': False,
    'worker_enable_remote_control': True,
    
    # Monitoring
    'worker_send_task_events': True,
    'task_send_sent_event': True,
    
    # Security
    'worker_hijack_root_logger': False,
    'worker_log_color': False,
    
    # Queue configuration
    'task_default_queue': 'default',
    'task_default_exchange': 'default',
    'task_default_exchange_type': 'direct',
    'task_default_routing_key': 'default',
    
    # Custom queues for different task types
    'task_routes': {
        'tasks.email_tasks.*': {'queue': 'email'},
        'tasks.communication_tasks.*': {'queue': 'communication'},
        'tasks.data_processing_tasks.*': {'queue': 'data_processing'},
        'tasks.maintenance_tasks.*': {'queue': 'maintenance'},
        'tasks.report_tasks.*': {'queue': 'reports'},
        'tasks.file_processing_tasks.*': {'queue': 'file_processing'},
        'tasks.webhook_tasks.*': {'queue': 'webhooks'},
        'tasks.analytics_tasks.*': {'queue': 'analytics'},
        'tasks.integration_tasks.*': {'queue': 'integrations'},
    },
    
    # Queue definitions
    'task_queues': (
        Queue('default', Exchange('default'), routing_key='default'),
        Queue('email', Exchange('email'), routing_key='email'),
        Queue('communication', Exchange('communication'), routing_key='communication'),
        Queue('data_processing', Exchange('data_processing'), routing_key='data_processing'),
        Queue('maintenance', Exchange('maintenance'), routing_key='maintenance'),
        Queue('reports', Exchange('reports'), routing_key='reports'),
        Queue('file_processing', Exchange('file_processing'), routing_key='file_processing'),
        Queue('webhooks', Exchange('webhooks'), routing_key='webhooks'),
        Queue('analytics', Exchange('analytics'), routing_key='analytics'),
        Queue('integrations', Exchange('integrations'), routing_key='integrations'),
    ),
    
    # Beat schedule for periodic tasks
    'beat_schedule': {
        'cleanup-expired-tokens': {
            'task': 'tasks.maintenance_tasks.cleanup_expired_tokens',
            'schedule': timedelta(hours=1),
        },
        'generate-daily-reports': {
            'task': 'tasks.report_tasks.generate_daily_reports',
            'schedule': timedelta(hours=24),
        },
        'sync-integration-data': {
            'task': 'tasks.integration_tasks.sync_all_integrations',
            'schedule': timedelta(minutes=30),
        },
        'cleanup-old-logs': {
            'task': 'tasks.maintenance_tasks.cleanup_old_logs',
            'schedule': timedelta(days=1),
        },
        'health-check': {
            'task': 'tasks.maintenance_tasks.system_health_check',
            'schedule': timedelta(minutes=5),
        },
        'backup-database': {
            'task': 'tasks.maintenance_tasks.backup_database',
            'schedule': timedelta(hours=6),
        },
    },
}

# SSL configuration for production
if settings.ENVIRONMENT == 'production':
    celery_config.update({
        'broker_use_ssl': {
            'keyfile': settings.SSL_KEYFILE,
            'certfile': settings.SSL_CERTFILE,
            'ca_certs': settings.SSL_CA_CERTS,
            'cert_reqs': ssl.CERT_REQUIRED,
        },
        'redis_backend_use_ssl': {
            'ssl_keyfile': settings.SSL_KEYFILE,
            'ssl_certfile': settings.SSL_CERTFILE,
            'ssl_ca_certs': settings.SSL_CA_CERTS,
            'ssl_cert_reqs': ssl.CERT_REQUIRED,
        }
    })

# Create Celery app
celery_app = Celery('dronestrike', include=[
    'tasks.email_tasks',
    'tasks.communication_tasks', 
    'tasks.data_processing_tasks',
    'tasks.maintenance_tasks',
    'tasks.report_tasks',
    'tasks.file_processing_tasks',
    'tasks.webhook_tasks',
    'tasks.analytics_tasks',
    'tasks.integration_tasks',
])

celery_app.config_from_object(celery_config)

# Initialize monitoring and error tracking
metrics_collector = MetricsCollector()
error_tracker = ErrorTracker()

# Task monitoring and error handling
@task_prerun.connect
def task_prerun_handler(sender=None, task_id=None, task=None, args=None, kwargs=None, **kwds):
    """Handle task pre-run events."""
    logger.info(f"Task {task.name} starting", extra={
        'task_id': task_id,
        'task_name': task.name,
        'args': args,
        'kwargs': kwargs
    })
    
    # Record task start metrics
    metrics_collector.record_task_start(task.name, task_id)

@task_postrun.connect
def task_postrun_handler(sender=None, task_id=None, task=None, args=None, kwargs=None, 
                        retval=None, state=None, **kwds):
    """Handle task post-run events."""
    logger.info(f"Task {task.name} completed", extra={
        'task_id': task_id,
        'task_name': task.name,
        'state': state,
        'retval': retval
    })
    
    # Record task completion metrics
    metrics_collector.record_task_completion(task.name, task_id, state)

@task_failure.connect
def task_failure_handler(sender=None, task_id=None, exception=None, traceback=None, 
                        einfo=None, **kwds):
    """Handle task failure events."""
    logger.error(f"Task {sender.name} failed", extra={
        'task_id': task_id,
        'task_name': sender.name,
        'exception': str(exception),
        'traceback': traceback
    })
    
    # Track error for monitoring
    error_tracker.track_task_error(sender.name, task_id, exception, traceback)
    
    # Record failure metrics
    metrics_collector.record_task_failure(sender.name, task_id, str(exception))

@task_retry.connect
def task_retry_handler(sender=None, task_id=None, reason=None, einfo=None, **kwds):
    """Handle task retry events."""
    logger.warning(f"Task {sender.name} retrying", extra={
        'task_id': task_id,
        'task_name': sender.name,
        'reason': str(reason),
        'retry_count': sender.request.retries
    })
    
    # Record retry metrics
    metrics_collector.record_task_retry(sender.name, task_id, str(reason))

@worker_ready.connect
def worker_ready_handler(sender=None, **kwds):
    """Handle worker ready events."""
    logger.info(f"Worker {sender.hostname} ready")
    metrics_collector.record_worker_ready(sender.hostname)

@worker_shutdown.connect
def worker_shutdown_handler(sender=None, **kwds):
    """Handle worker shutdown events."""
    logger.info(f"Worker {sender.hostname} shutting down")
    metrics_collector.record_worker_shutdown(sender.hostname)

@setup_logging.connect
def setup_logging_handler(**kwargs):
    """Setup structured logging for Celery."""
    setup_celery_logging()

# Custom task base class with enhanced error handling
class BaseTask(celery_app.Task):
    """Base task class with enhanced error handling and monitoring."""
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Handle task failure with enhanced error tracking."""
        logger.error(f"Task {self.name} failed", extra={
            'task_id': task_id,
            'exception': str(exc),
            'args': args,
            'kwargs': kwargs,
            'traceback': str(einfo)
        })
        
        # Send alert for critical failures
        if hasattr(exc, 'critical') and exc.critical:
            error_tracker.send_critical_alert(self.name, task_id, exc)
    
    def on_retry(self, exc, task_id, args, kwargs, einfo):
        """Handle task retry with logging."""
        logger.warning(f"Task {self.name} retrying", extra={
            'task_id': task_id,
            'exception': str(exc),
            'retry_count': self.request.retries,
            'max_retries': self.max_retries
        })
    
    def on_success(self, retval, task_id, args, kwargs):
        """Handle task success with metrics."""
        logger.info(f"Task {self.name} succeeded", extra={
            'task_id': task_id,
            'retval': retval
        })

# Set default base task
celery_app.Task = BaseTask

# Task execution context manager
class TaskContext:
    """Context manager for task execution with automatic cleanup."""
    
    def __init__(self, task_name: str, task_id: str):
        self.task_name = task_name
        self.task_id = task_id
        self.start_time = None
    
    def __enter__(self):
        self.start_time = metrics_collector.start_timer()
        logger.info(f"Starting task {self.task_name}", extra={
            'task_id': self.task_id,
            'task_name': self.task_name
        })
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = metrics_collector.stop_timer(self.start_time)
        
        if exc_type:
            logger.error(f"Task {self.task_name} failed", extra={
                'task_id': self.task_id,
                'exception': str(exc_val),
                'duration': duration
            })
            return False
        else:
            logger.info(f"Task {self.task_name} completed", extra={
                'task_id': self.task_id,
                'duration': duration
            })

# Health check function
def health_check() -> Dict[str, Any]:
    """Check Celery health status."""
    try:
        # Check broker connection
        inspect = celery_app.control.inspect()
        
        # Get active tasks
        active_tasks = inspect.active()
        
        # Get worker stats
        stats = inspect.stats()
        
        # Get queue lengths
        queue_lengths = {}
        for queue_name in ['default', 'email', 'communication', 'data_processing']:
            try:
                length = celery_app.control.inspect().active_queues()
                queue_lengths[queue_name] = length
            except:
                queue_lengths[queue_name] = 'unknown'
        
        return {
            'status': 'healthy',
            'active_tasks': len(active_tasks) if active_tasks else 0,
            'workers': len(stats) if stats else 0,
            'queue_lengths': queue_lengths,
            'timestamp': metrics_collector.get_timestamp()
        }
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': metrics_collector.get_timestamp()
        }

if __name__ == '__main__':
    celery_app.start()