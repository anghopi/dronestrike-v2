"""
Advanced base integration classes for DroneStrike third-party services.
"""

import asyncio
import hashlib
import hmac
import json
import logging
import time
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union, Callable
from contextlib import asynccontextmanager
from enum import Enum
import httpx
from pydantic import BaseModel, Field
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

logger = logging.getLogger(__name__)


class IntegrationError(Exception):
    """Base exception for integration errors."""
    def __init__(self, message: str, status_code: Optional[int] = None, response_data: Optional[Dict] = None):
        super().__init__(message)
        self.status_code = status_code
        self.response_data = response_data


class RateLimitError(IntegrationError):
    """Exception for rate limit errors."""
    pass


class AuthenticationError(IntegrationError):
    """Exception for authentication errors."""
    pass


class ValidationError(IntegrationError):
    """Exception for validation errors."""
    pass


class CircuitBreakerError(IntegrationError):
    """Exception when circuit breaker is open."""
    pass


class CircuitBreakerState(Enum):
    """Circuit breaker states."""
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class IntegrationConfig(BaseModel):
    """Advanced configuration for integrations."""
    api_key: str
    api_secret: Optional[str] = None
    base_url: Optional[str] = None
    timeout: int = 30
    max_retries: int = 3
    enabled: bool = True
    
    # Rate limiting
    rate_limit_calls: int = 100
    rate_limit_period: int = 3600  # seconds
    
    # Circuit breaker
    circuit_breaker_failure_threshold: int = 5
    circuit_breaker_recovery_timeout: int = 60
    circuit_breaker_expected_exception: tuple = (httpx.HTTPError,)
    
    # Caching
    cache_ttl: int = 300  # seconds
    cache_enabled: bool = True
    
    # Webhook security
    webhook_secret: Optional[str] = None
    webhook_tolerance: int = 300  # seconds
    
    # Monitoring
    metrics_enabled: bool = True
    health_check_interval: int = 300  # seconds
    
    class Config:
        extra = "allow"


class RateLimiter:
    """Token bucket rate limiter."""
    
    def __init__(self, calls: int, period: int):
        self.calls = calls
        self.period = period
        self.tokens = calls
        self.last_update = time.time()
        self._lock = asyncio.Lock()
    
    async def acquire(self) -> bool:
        """Acquire a token if available."""
        async with self._lock:
            now = time.time()
            elapsed = now - self.last_update
            self.tokens = min(self.calls, self.tokens + elapsed * (self.calls / self.period))
            self.last_update = now
            
            if self.tokens >= 1:
                self.tokens -= 1
                return True
            return False
    
    async def wait_for_token(self) -> None:
        """Wait until a token is available."""
        while not await self.acquire():
            await asyncio.sleep(0.1)


class CircuitBreaker:
    """Circuit breaker pattern implementation."""
    
    def __init__(self, failure_threshold: int, recovery_timeout: int, expected_exception: tuple):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        self.failure_count = 0
        self.last_failure_time = None
        self.state = CircuitBreakerState.CLOSED
        self._lock = asyncio.Lock()
    
    async def call(self, func: Callable, *args, **kwargs):
        """Execute function with circuit breaker protection."""
        async with self._lock:
            if self.state == CircuitBreakerState.OPEN:
                if time.time() - self.last_failure_time > self.recovery_timeout:
                    self.state = CircuitBreakerState.HALF_OPEN
                else:
                    raise CircuitBreakerError("Circuit breaker is open")
        
        try:
            result = await func(*args, **kwargs)
            async with self._lock:
                self.failure_count = 0
                self.state = CircuitBreakerState.CLOSED
            return result
        except self.expected_exception as e:
            async with self._lock:
                self.failure_count += 1
                self.last_failure_time = time.time()
                if self.failure_count >= self.failure_threshold:
                    self.state = CircuitBreakerState.OPEN
            raise e


class CacheManager:
    """Simple in-memory cache with TTL."""
    
    def __init__(self, ttl: int = 300):
        self.ttl = ttl
        self._cache = {}
        self._lock = asyncio.Lock()
    
    def _make_key(self, *args, **kwargs) -> str:
        """Generate cache key from arguments."""
        key_data = f"{args}_{sorted(kwargs.items())}"
        return hashlib.md5(key_data.encode()).hexdigest()
    
    async def get(self, *args, **kwargs) -> Optional[Any]:
        """Get cached value if not expired."""
        key = self._make_key(*args, **kwargs)
        async with self._lock:
            if key in self._cache:
                value, timestamp = self._cache[key]
                if time.time() - timestamp < self.ttl:
                    return value
                else:
                    del self._cache[key]
        return None
    
    async def set(self, value: Any, *args, **kwargs) -> None:
        """Set cached value with timestamp."""
        key = self._make_key(*args, **kwargs)
        async with self._lock:
            self._cache[key] = (value, time.time())
    
    async def clear(self) -> None:
        """Clear all cached values."""
        async with self._lock:
            self._cache.clear()


class MetricsCollector:
    """Collect integration metrics."""
    
    def __init__(self):
        self.request_count = 0
        self.error_count = 0
        self.total_response_time = 0.0
        self.last_request_time = None
        self._lock = asyncio.Lock()
    
    async def record_request(self, response_time: float, success: bool = True) -> None:
        """Record request metrics."""
        async with self._lock:
            self.request_count += 1
            self.total_response_time += response_time
            self.last_request_time = time.time()
            if not success:
                self.error_count += 1
    
    async def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics."""
        async with self._lock:
            avg_response_time = (
                self.total_response_time / self.request_count 
                if self.request_count > 0 else 0
            )
            error_rate = (
                self.error_count / self.request_count 
                if self.request_count > 0 else 0
            )
            
            return {
                "request_count": self.request_count,
                "error_count": self.error_count,
                "error_rate": error_rate,
                "average_response_time": avg_response_time,
                "last_request_time": self.last_request_time
            }


class BaseIntegration(ABC):
    """Advanced base class for all third-party integrations."""
    
    def __init__(self, config: IntegrationConfig):
        self.config = config
        self.client = None
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
        
        # Initialize advanced features
        self.rate_limiter = RateLimiter(config.rate_limit_calls, config.rate_limit_period)
        self.circuit_breaker = CircuitBreaker(
            config.circuit_breaker_failure_threshold,
            config.circuit_breaker_recovery_timeout,
            config.circuit_breaker_expected_exception
        )
        self.cache = CacheManager(config.cache_ttl) if config.cache_enabled else None
        self.metrics = MetricsCollector() if config.metrics_enabled else None
        
        # Health check
        self.last_health_check = None
        self.health_status = True
        
        if config.enabled:
            self._initialize_client()
    
    @abstractmethod
    def _initialize_client(self) -> None:
        """Initialize the integration client."""
        pass
    
    def is_enabled(self) -> bool:
        """Check if integration is enabled."""
        return self.config.enabled and self.client is not None
    
    async def health_check(self) -> bool:
        """Perform health check."""
        try:
            await self._perform_health_check()
            self.health_status = True
            self.last_health_check = time.time()
            return True
        except Exception as e:
            self.logger.error(f"Health check failed: {e}")
            self.health_status = False
            return False
    
    @abstractmethod
    async def _perform_health_check(self) -> None:
        """Perform integration-specific health check."""
        pass
    
    def _log_request(self, method: str, endpoint: str, data: Dict[str, Any] = None) -> None:
        """Log integration request."""
        self.logger.info(f"Integration request: {method} {endpoint}")
        if data and self.logger.isEnabledFor(logging.DEBUG):
            # Sanitize sensitive data for logging
            sanitized_data = self._sanitize_log_data(data)
            self.logger.debug(f"Request data: {sanitized_data}")
    
    def _sanitize_log_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Remove sensitive information from log data."""
        sensitive_keys = {'password', 'token', 'key', 'secret', 'authorization'}
        sanitized = {}
        for key, value in data.items():
            if any(sensitive in key.lower() for sensitive in sensitive_keys):
                sanitized[key] = "[REDACTED]"
            elif isinstance(value, dict):
                sanitized[key] = self._sanitize_log_data(value)
            else:
                sanitized[key] = value
        return sanitized
    
    def _log_response(self, response: Any, success: bool = True) -> None:
        """Log integration response."""
        if success:
            self.logger.info("Integration request successful")
        else:
            self.logger.error(f"Integration request failed: {response}")
    
    def _handle_error(self, error: Exception, context: str = "") -> None:
        """Handle and log integration errors with enhanced context."""
        error_msg = f"Integration error in {context}: {str(error)}"
        self.logger.error(error_msg, exc_info=True)
        
        # Determine error type and create appropriate exception
        if isinstance(error, httpx.HTTPStatusError):
            if error.response.status_code == 401:
                raise AuthenticationError(error_msg, error.response.status_code) from error
            elif error.response.status_code == 429:
                raise RateLimitError(error_msg, error.response.status_code) from error
            elif 400 <= error.response.status_code < 500:
                raise ValidationError(error_msg, error.response.status_code) from error
        
        raise IntegrationError(error_msg) from error
    
    async def get_metrics(self) -> Dict[str, Any]:
        """Get integration metrics."""
        base_metrics = {
            "enabled": self.is_enabled(),
            "health_status": self.health_status,
            "last_health_check": self.last_health_check,
            "circuit_breaker_state": self.circuit_breaker.state.value,
            "circuit_breaker_failure_count": self.circuit_breaker.failure_count
        }
        
        if self.metrics:
            request_metrics = await self.metrics.get_metrics()
            base_metrics.update(request_metrics)
        
        return base_metrics
    
    async def close(self) -> None:
        """Close integration resources."""
        if self.client and hasattr(self.client, 'aclose'):
            await self.client.aclose()
        
        if self.cache:
            await self.cache.clear()


class HTTPIntegration(BaseIntegration):
    """Advanced HTTP-based integration with comprehensive features."""
    
    def _initialize_client(self) -> None:
        """Initialize HTTP client with advanced configuration."""
        self.client = httpx.AsyncClient(
            base_url=self.config.base_url,
            timeout=httpx.Timeout(self.config.timeout),
            headers=self._get_default_headers(),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=100)
        )
    
    def _get_default_headers(self) -> Dict[str, str]:
        """Get default headers for requests."""
        return {
            "User-Agent": "DroneStrike/2.0",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    
    async def _make_request_with_circuit_breaker(
        self,
        method: str,
        endpoint: str,
        data: Dict[str, Any] = None,
        params: Dict[str, Any] = None,
        headers: Dict[str, str] = None,
        use_cache: bool = True
    ) -> Dict[str, Any]:
        """Make request with circuit breaker protection."""
        return await self.circuit_breaker.call(
            self._make_request_internal,
            method, endpoint, data, params, headers, use_cache
        )
    
    async def _make_request_internal(
        self,
        method: str,
        endpoint: str,
        data: Dict[str, Any] = None,
        params: Dict[str, Any] = None,
        headers: Dict[str, str] = None,
        use_cache: bool = True
    ) -> Dict[str, Any]:
        """Internal request method with caching and rate limiting."""
        if not self.is_enabled():
            raise IntegrationError("Integration is not enabled")
        
        # Check cache for GET requests
        if use_cache and self.cache and method.upper() == "GET":
            cached_result = await self.cache.get(method, endpoint, params)
            if cached_result is not None:
                self.logger.debug("Returning cached result")
                return cached_result
        
        # Apply rate limiting
        await self.rate_limiter.wait_for_token()
        
        self._log_request(method, endpoint, data)
        
        request_headers = self._get_default_headers()
        if headers:
            request_headers.update(headers)
        
        start_time = time.time()
        success = False
        
        try:
            for attempt in range(self.config.max_retries + 1):
                try:
                    response = await self.client.request(
                        method=method,
                        url=endpoint,
                        json=data,
                        params=params,
                        headers=request_headers
                    )
                    response.raise_for_status()
                    
                    result = response.json() if response.content else {}
                    success = True
                    
                    # Cache successful GET requests
                    if use_cache and self.cache and method.upper() == "GET":
                        await self.cache.set(result, method, endpoint, params)
                    
                    self._log_response(result, True)
                    return result
                    
                except httpx.HTTPError as e:
                    if attempt == self.config.max_retries:
                        self._handle_error(e, f"{method} {endpoint}")
                    else:
                        wait_time = 2 ** attempt  # Exponential backoff
                        self.logger.warning(f"Request failed (attempt {attempt + 1}), retrying in {wait_time}s...")
                        await asyncio.sleep(wait_time)
                        continue
        finally:
            # Record metrics
            if self.metrics:
                response_time = time.time() - start_time
                await self.metrics.record_request(response_time, success)
    
    async def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Dict[str, Any] = None,
        params: Dict[str, Any] = None,
        headers: Dict[str, str] = None,
        use_cache: bool = True
    ) -> Dict[str, Any]:
        """Public interface for making requests."""
        return await self._make_request_with_circuit_breaker(
            method, endpoint, data, params, headers, use_cache
        )
    
    async def _perform_health_check(self) -> None:
        """Default health check implementation."""
        # Override in subclasses with specific health check logic
        if self.client:
            # Simple connectivity test
            try:
                await self.client.get("/", timeout=5.0)
            except (httpx.ConnectError, httpx.TimeoutException):
                # These are expected for health checks
                pass
    
    async def close(self) -> None:
        """Close HTTP client and parent resources."""
        await super().close()


class WebhookHandler(ABC):
    """Advanced webhook handling with security and validation."""
    
    def __init__(self, secret: str, tolerance: int = 300):
        self.secret = secret.encode() if isinstance(secret, str) else secret
        self.tolerance = tolerance
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
    
    def _verify_timestamp(self, timestamp: str) -> bool:
        """Verify webhook timestamp is within tolerance."""
        try:
            webhook_time = int(timestamp)
            current_time = int(time.time())
            return abs(current_time - webhook_time) <= self.tolerance
        except (ValueError, TypeError):
            return False
    
    def _compute_signature(self, payload: bytes, timestamp: str) -> str:
        """Compute expected signature for payload."""
        signed_payload = f"{timestamp}.{payload.decode('utf-8')}"
        return hmac.new(
            self.secret,
            signed_payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
    
    async def verify_webhook(
        self, 
        payload: bytes, 
        signature: str, 
        timestamp: str = None
    ) -> bool:
        """Verify webhook signature and timestamp."""
        try:
            # Extract signature from header (format: t=timestamp,v1=signature)
            signature_parts = {}
            for part in signature.split(','):
                if '=' in part:
                    key, value = part.split('=', 1)
                    signature_parts[key] = value
            
            # Use provided timestamp or extract from signature
            webhook_timestamp = timestamp or signature_parts.get('t')
            if not webhook_timestamp:
                self.logger.error("No timestamp found in webhook")
                return False
            
            # Verify timestamp
            if not self._verify_timestamp(webhook_timestamp):
                self.logger.error("Webhook timestamp outside tolerance")
                return False
            
            # Verify signature
            expected_signature = self._compute_signature(payload, webhook_timestamp)
            provided_signature = signature_parts.get('v1', signature_parts.get('sha256', ''))
            
            return hmac.compare_digest(expected_signature, provided_signature)
            
        except Exception as e:
            self.logger.error(f"Webhook verification failed: {e}")
            return False
    
    @abstractmethod
    async def process_webhook(self, event_type: str, data: Dict[str, Any]) -> None:
        """Process verified webhook event."""
        pass
    
    async def handle_webhook(
        self, 
        payload: bytes, 
        signature: str, 
        timestamp: str = None
    ) -> Dict[str, Any]:
        """Handle incoming webhook with verification and processing."""
        if not await self.verify_webhook(payload, signature, timestamp):
            raise ValidationError("Invalid webhook signature")
        
        try:
            event_data = json.loads(payload.decode('utf-8'))
            event_type = event_data.get('type', 'unknown')
            
            self.logger.info(f"Processing webhook event: {event_type}")
            await self.process_webhook(event_type, event_data)
            
            return {"status": "success", "event_type": event_type}
            
        except json.JSONDecodeError as e:
            raise ValidationError(f"Invalid JSON payload: {e}")
        except Exception as e:
            self.logger.error(f"Webhook processing failed: {e}")
            raise IntegrationError(f"Webhook processing failed: {e}")


class BatchProcessor:
    """Utility for batch processing requests."""
    
    def __init__(self, batch_size: int = 100, max_workers: int = 10):
        self.batch_size = batch_size
        self.max_workers = max_workers
        self.semaphore = asyncio.Semaphore(max_workers)
    
    async def process_batch(
        self, 
        items: List[Any], 
        processor_func: Callable,
        *args, 
        **kwargs
    ) -> List[Any]:
        """Process items in batches with concurrency control."""
        results = []
        
        for i in range(0, len(items), self.batch_size):
            batch = items[i:i + self.batch_size]
            batch_tasks = []
            
            for item in batch:
                task = self._process_item_with_semaphore(
                    processor_func, item, *args, **kwargs
                )
                batch_tasks.append(task)
            
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
            results.extend(batch_results)
        
        return results
    
    async def _process_item_with_semaphore(
        self, 
        processor_func: Callable, 
        item: Any, 
        *args, 
        **kwargs
    ) -> Any:
        """Process single item with semaphore protection."""
        async with self.semaphore:
            try:
                return await processor_func(item, *args, **kwargs)
            except Exception as e:
                return e