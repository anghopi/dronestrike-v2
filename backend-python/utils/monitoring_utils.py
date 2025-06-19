"""
Advanced Monitoring and Metrics Collection
Production-ready monitoring with comprehensive metrics, alerting, and performance tracking.
"""

import time
import psutil
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable, Union
from collections import defaultdict, deque
from dataclasses import dataclass, field
import json
import asyncio
from pathlib import Path

from core.config import settings
from utils.logging_config import get_logger

logger = get_logger(__name__)

@dataclass
class Metric:
    """Represents a single metric measurement."""
    name: str
    value: Union[int, float]
    timestamp: datetime
    tags: Dict[str, str] = field(default_factory=dict)
    unit: str = ""

@dataclass
class Alert:
    """Represents an alert condition."""
    name: str
    condition: Callable[[float], bool]
    message: str
    severity: str = "warning"  # info, warning, error, critical
    cooldown: int = 300  # seconds
    last_triggered: Optional[datetime] = None

class MetricsCollector:
    """Advanced metrics collection and monitoring system."""
    
    def __init__(self):
        self.metrics = defaultdict(deque)
        self.counters = defaultdict(int)
        self.gauges = defaultdict(float)
        self.timers = {}
        self.alerts = {}
        
        # Configuration
        self.max_metric_history = 1000
        self.metric_retention_hours = 24
        
        # System monitoring
        self.system_stats = {
            'cpu_percent': deque(maxlen=60),  # Last 60 measurements
            'memory_percent': deque(maxlen=60),
            'disk_usage': deque(maxlen=60),
            'network_io': deque(maxlen=60)
        }
        
        # Performance tracking
        self.performance_stats = {
            'request_count': 0,
            'request_duration': deque(maxlen=1000),
            'error_count': 0,
            'error_rate': deque(maxlen=100)
        }
        
        # Task monitoring
        self.task_stats = defaultdict(lambda: {
            'total_runs': 0,
            'successful_runs': 0,
            'failed_runs': 0,
            'average_duration': 0,
            'last_run': None,
            'last_error': None
        })
        
        # Database monitoring
        self.db_stats = {
            'connection_count': deque(maxlen=60),
            'query_count': 0,
            'slow_queries': deque(maxlen=100),
            'query_duration': deque(maxlen=1000)
        }
        
        # Start background monitoring
        self._start_system_monitoring()
        
        # Setup default alerts
        self._setup_default_alerts()
    
    def record_metric(self, name: str, value: Union[int, float], 
                     tags: Dict[str, str] = None, unit: str = ""):
        """Record a metric measurement."""
        try:
            metric = Metric(
                name=name,
                value=value,
                timestamp=datetime.utcnow(),
                tags=tags or {},
                unit=unit
            )
            
            # Store in time series
            self.metrics[name].append(metric)
            
            # Limit history size
            while len(self.metrics[name]) > self.max_metric_history:
                self.metrics[name].popleft()
            
            # Check alerts
            self._check_alerts(name, value)
            
            logger.debug(f"Recorded metric: {name} = {value} {unit}", extra={
                'metric_name': name,
                'metric_value': value,
                'metric_tags': tags
            })
            
        except Exception as e:
            logger.error(f"Failed to record metric {name}: {e}")
    
    def increment_counter(self, name: str, value: int = 1, tags: Dict[str, str] = None):
        """Increment a counter metric."""
        self.counters[name] += value
        self.record_metric(f"{name}_total", self.counters[name], tags, "count")
    
    def set_gauge(self, name: str, value: float, tags: Dict[str, str] = None):
        """Set a gauge metric value."""
        self.gauges[name] = value
        self.record_metric(name, value, tags, "gauge")
    
    def start_timer(self) -> str:
        """Start a timer and return timer ID."""
        timer_id = f"timer_{time.time()}_{id(threading.current_thread())}"
        self.timers[timer_id] = time.perf_counter()
        return timer_id
    
    def stop_timer(self, timer_id: str) -> float:
        """Stop timer and return duration in seconds."""
        if timer_id not in self.timers:
            logger.warning(f"Timer {timer_id} not found")
            return 0.0
        
        start_time = self.timers.pop(timer_id)
        duration = time.perf_counter() - start_time
        return duration
    
    def time_function(self, func_name: str):
        """Decorator to time function execution."""
        def decorator(func):
            import functools
            
            @functools.wraps(func)
            def wrapper(*args, **kwargs):
                timer_id = self.start_timer()
                try:
                    result = func(*args, **kwargs)
                    duration = self.stop_timer(timer_id)
                    self.record_metric(f"function_duration", duration, 
                                     {"function": func_name}, "seconds")
                    return result
                except Exception as e:
                    duration = self.stop_timer(timer_id)
                    self.record_metric(f"function_duration", duration, 
                                     {"function": func_name, "status": "error"}, "seconds")
                    raise
            
            return wrapper
        return decorator
    
    def time_async_function(self, func_name: str):
        """Decorator to time async function execution."""
        def decorator(func):
            import functools
            
            @functools.wraps(func)
            async def wrapper(*args, **kwargs):
                timer_id = self.start_timer()
                try:
                    result = await func(*args, **kwargs)
                    duration = self.stop_timer(timer_id)
                    self.record_metric(f"async_function_duration", duration, 
                                     {"function": func_name}, "seconds")
                    return result
                except Exception as e:
                    duration = self.stop_timer(timer_id)
                    self.record_metric(f"async_function_duration", duration, 
                                     {"function": func_name, "status": "error"}, "seconds")
                    raise
            
            return wrapper
        return decorator
    
    # HTTP Request Monitoring
    def record_request(self, method: str, path: str, status_code: int, duration: float):
        """Record HTTP request metrics."""
        self.performance_stats['request_count'] += 1
        self.performance_stats['request_duration'].append(duration)
        
        tags = {
            'method': method,
            'path': path,
            'status_code': str(status_code)
        }
        
        self.record_metric('http_request_duration', duration, tags, "seconds")
        self.increment_counter('http_requests_total', 1, tags)
        
        if status_code >= 400:
            self.performance_stats['error_count'] += 1
            self.increment_counter('http_errors_total', 1, tags)
    
    def record_request_size(self, size: int, request_type: str = "request"):
        """Record request/response size."""
        tags = {'type': request_type}
        self.record_metric('http_request_size_bytes', size, tags, "bytes")
    
    # Database Monitoring
    def record_db_query(self, query_type: str, duration: float, success: bool = True):
        """Record database query metrics."""
        self.db_stats['query_count'] += 1
        self.db_stats['query_duration'].append(duration)
        
        tags = {
            'query_type': query_type,
            'status': 'success' if success else 'error'
        }
        
        self.record_metric('db_query_duration', duration, tags, "seconds")
        self.increment_counter('db_queries_total', 1, tags)
        
        # Track slow queries
        if duration > 1.0:  # Queries taking more than 1 second
            self.db_stats['slow_queries'].append({
                'query_type': query_type,
                'duration': duration,
                'timestamp': datetime.utcnow()
            })
    
    def record_db_connection_count(self, count: int):
        """Record database connection count."""
        self.db_stats['connection_count'].append(count)
        self.set_gauge('db_connections_active', count)
    
    # Task Monitoring
    def record_task_start(self, task_name: str, task_id: str):
        """Record task start."""
        self.task_stats[task_name]['total_runs'] += 1
        self.increment_counter('celery_tasks_started_total', 1, {'task': task_name})
    
    def record_task_completion(self, task_name: str, task_id: str, status: str):
        """Record task completion."""
        if status == 'SUCCESS':
            self.task_stats[task_name]['successful_runs'] += 1
            self.increment_counter('celery_tasks_succeeded_total', 1, {'task': task_name})
        else:
            self.task_stats[task_name]['failed_runs'] += 1
            self.increment_counter('celery_tasks_failed_total', 1, {'task': task_name})
        
        self.task_stats[task_name]['last_run'] = datetime.utcnow()
    
    def record_task_failure(self, task_name: str, task_id: str, error: str):
        """Record task failure."""
        self.task_stats[task_name]['failed_runs'] += 1
        self.task_stats[task_name]['last_error'] = {
            'error': error,
            'timestamp': datetime.utcnow(),
            'task_id': task_id
        }
        
        self.increment_counter('celery_tasks_failed_total', 1, {'task': task_name})
    
    def record_task_retry(self, task_name: str, task_id: str, reason: str):
        """Record task retry."""
        self.increment_counter('celery_tasks_retried_total', 1, {'task': task_name})
    
    # Worker Monitoring
    def record_worker_ready(self, hostname: str):
        """Record worker ready event."""
        self.increment_counter('celery_workers_ready_total', 1, {'hostname': hostname})
    
    def record_worker_shutdown(self, hostname: str):
        """Record worker shutdown event."""
        self.increment_counter('celery_workers_shutdown_total', 1, {'hostname': hostname})
    
    # Email Monitoring
    def record_email_sent(self, recipient: str, email_type: str, message_id: str):
        """Record successful email delivery."""
        tags = {'email_type': email_type}
        self.increment_counter('emails_sent_total', 1, tags)
        
        logger.info("Email sent", extra={
            'recipient': recipient,
            'email_type': email_type,
            'message_id': message_id
        })
    
    def record_email_failure(self, recipient: str, email_type: str, error: str):
        """Record failed email delivery."""
        tags = {'email_type': email_type, 'error_type': 'delivery_failed'}
        self.increment_counter('emails_failed_total', 1, tags)
        
        logger.error("Email failed", extra={
            'recipient': recipient,
            'email_type': email_type,
            'error': error
        })
    
    # System Monitoring
    def _start_system_monitoring(self):
        """Start background system monitoring."""
        def monitor_system():
            while True:
                try:
                    # CPU usage
                    cpu_percent = psutil.cpu_percent(interval=1)
                    self.system_stats['cpu_percent'].append(cpu_percent)
                    self.set_gauge('system_cpu_percent', cpu_percent)
                    
                    # Memory usage
                    memory = psutil.virtual_memory()
                    self.system_stats['memory_percent'].append(memory.percent)
                    self.set_gauge('system_memory_percent', memory.percent)
                    self.set_gauge('system_memory_available_bytes', memory.available)
                    
                    # Disk usage
                    disk = psutil.disk_usage('/')
                    disk_percent = (disk.used / disk.total) * 100
                    self.system_stats['disk_usage'].append(disk_percent)
                    self.set_gauge('system_disk_percent', disk_percent)
                    self.set_gauge('system_disk_free_bytes', disk.free)
                    
                    # Network I/O
                    network = psutil.net_io_counters()
                    self.set_gauge('system_network_bytes_sent', network.bytes_sent)
                    self.set_gauge('system_network_bytes_recv', network.bytes_recv)
                    
                    # Process info
                    process = psutil.Process()
                    self.set_gauge('process_memory_rss_bytes', process.memory_info().rss)
                    self.set_gauge('process_cpu_percent', process.cpu_percent())
                    self.set_gauge('process_num_threads', process.num_threads())
                    
                    time.sleep(60)  # Monitor every minute
                    
                except Exception as e:
                    logger.error(f"System monitoring error: {e}")
                    time.sleep(60)
        
        monitor_thread = threading.Thread(target=monitor_system, daemon=True)
        monitor_thread.start()
    
    # Alerting System
    def _setup_default_alerts(self):
        """Setup default system alerts."""
        self.alerts.update({
            'high_cpu': Alert(
                name='high_cpu',
                condition=lambda x: x > 80,
                message='CPU usage is above 80%',
                severity='warning'
            ),
            'high_memory': Alert(
                name='high_memory',
                condition=lambda x: x > 85,
                message='Memory usage is above 85%',
                severity='warning'
            ),
            'high_disk': Alert(
                name='high_disk',
                condition=lambda x: x > 90,
                message='Disk usage is above 90%',
                severity='critical'
            ),
            'high_error_rate': Alert(
                name='high_error_rate',
                condition=lambda x: x > 0.05,  # 5% error rate
                message='HTTP error rate is above 5%',
                severity='error'
            ),
            'slow_response': Alert(
                name='slow_response',
                condition=lambda x: x > 2.0,  # 2 second response time
                message='Average response time is above 2 seconds',
                severity='warning'
            )
        })
    
    def add_alert(self, alert: Alert):
        """Add custom alert."""
        self.alerts[alert.name] = alert
    
    def _check_alerts(self, metric_name: str, value: float):
        """Check if metric value triggers any alerts."""
        # Map metric names to alert names
        metric_alert_map = {
            'system_cpu_percent': 'high_cpu',
            'system_memory_percent': 'high_memory',
            'system_disk_percent': 'high_disk',
        }
        
        alert_name = metric_alert_map.get(metric_name)
        if not alert_name or alert_name not in self.alerts:
            return
        
        alert = self.alerts[alert_name]
        
        # Check cooldown
        if alert.last_triggered:
            time_since_last = (datetime.utcnow() - alert.last_triggered).total_seconds()
            if time_since_last < alert.cooldown:
                return
        
        # Check condition
        if alert.condition(value):
            self._trigger_alert(alert, metric_name, value)
    
    def _trigger_alert(self, alert: Alert, metric_name: str, value: float):
        """Trigger an alert."""
        alert.last_triggered = datetime.utcnow()
        
        alert_data = {
            'alert_name': alert.name,
            'metric_name': metric_name,
            'metric_value': value,
            'severity': alert.severity,
            'message': alert.message,
            'timestamp': alert.last_triggered.isoformat()
        }
        
        logger.warning(f"Alert triggered: {alert.message}", extra=alert_data)
        
        # In production, send to external alerting system
        # self._send_to_alerting_system(alert_data)
    
    # Data Export and Analysis
    def get_metrics_summary(self) -> Dict[str, Any]:
        """Get summary of all metrics."""
        return {
            'system': {
                'cpu_percent': list(self.system_stats['cpu_percent'])[-10:],  # Last 10 readings
                'memory_percent': list(self.system_stats['memory_percent'])[-10:],
                'disk_usage': list(self.system_stats['disk_usage'])[-10:]
            },
            'performance': {
                'request_count': self.performance_stats['request_count'],
                'error_count': self.performance_stats['error_count'],
                'avg_response_time': (
                    sum(self.performance_stats['request_duration']) / 
                    len(self.performance_stats['request_duration'])
                    if self.performance_stats['request_duration'] else 0
                )
            },
            'database': {
                'query_count': self.db_stats['query_count'],
                'slow_query_count': len(self.db_stats['slow_queries']),
                'avg_query_time': (
                    sum(self.db_stats['query_duration']) / 
                    len(self.db_stats['query_duration'])
                    if self.db_stats['query_duration'] else 0
                )
            },
            'tasks': {name: stats for name, stats in self.task_stats.items()},
            'counters': dict(self.counters),
            'gauges': dict(self.gauges)
        }
    
    def export_metrics(self, format: str = 'json') -> str:
        """Export metrics in specified format."""
        summary = self.get_metrics_summary()
        
        if format == 'json':
            return json.dumps(summary, indent=2, default=str)
        elif format == 'prometheus':
            return self._export_prometheus_format()
        else:
            raise ValueError(f"Unsupported export format: {format}")
    
    def _export_prometheus_format(self) -> str:
        """Export metrics in Prometheus format."""
        lines = []
        
        # Counters
        for name, value in self.counters.items():
            lines.append(f"# TYPE {name} counter")
            lines.append(f"{name} {value}")
        
        # Gauges
        for name, value in self.gauges.items():
            lines.append(f"# TYPE {name} gauge")
            lines.append(f"{name} {value}")
        
        return '\n'.join(lines)
    
    def cleanup_old_metrics(self):
        """Clean up old metrics data."""
        cutoff_time = datetime.utcnow() - timedelta(hours=self.metric_retention_hours)
        
        for metric_name, metric_deque in self.metrics.items():
            # Remove old metrics
            while metric_deque and metric_deque[0].timestamp < cutoff_time:
                metric_deque.popleft()
    
    def get_timestamp(self) -> str:
        """Get current timestamp for metrics."""
        return datetime.utcnow().isoformat()
    
    # Health Check
    def health_check(self) -> Dict[str, Any]:
        """Perform comprehensive health check."""
        try:
            # System health
            cpu_usage = psutil.cpu_percent()
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            # Application health
            recent_errors = self.performance_stats['error_count']
            avg_response_time = (
                sum(list(self.performance_stats['request_duration'])[-100:]) / 
                min(100, len(self.performance_stats['request_duration']))
                if self.performance_stats['request_duration'] else 0
            )
            
            # Determine overall health status
            status = 'healthy'
            issues = []
            
            if cpu_usage > 90:
                status = 'unhealthy'
                issues.append(f'High CPU usage: {cpu_usage}%')
            
            if memory.percent > 90:
                status = 'unhealthy'
                issues.append(f'High memory usage: {memory.percent}%')
            
            if (disk.used / disk.total) > 0.95:
                status = 'unhealthy'
                issues.append(f'High disk usage: {(disk.used / disk.total) * 100:.1f}%')
            
            if avg_response_time > 5.0:
                status = 'degraded' if status == 'healthy' else status
                issues.append(f'Slow response time: {avg_response_time:.2f}s')
            
            return {
                'status': status,
                'timestamp': datetime.utcnow().isoformat(),
                'system': {
                    'cpu_percent': cpu_usage,
                    'memory_percent': memory.percent,
                    'disk_percent': (disk.used / disk.total) * 100
                },
                'application': {
                    'request_count': self.performance_stats['request_count'],
                    'error_count': recent_errors,
                    'avg_response_time': avg_response_time
                },
                'issues': issues
            }
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {
                'status': 'unhealthy',
                'timestamp': datetime.utcnow().isoformat(),
                'error': str(e)
            }