"""
Rate Limiting Middleware for Backend
Prevents excessive API calls and protects against abuse
"""

import time
from django.core.cache import cache
from django.http import JsonResponse
from functools import wraps
import logging

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Rate limiter to prevent excessive requests
    """
    
    @staticmethod
    def check_rate_limit(key: str, max_requests: int = 100, window: int = 60):
        """
        Check if rate limit is exceeded
        
        Args:
            key: Unique identifier (IP, user_id, etc)
            max_requests: Maximum requests allowed
            window: Time window in seconds
            
        Returns:
            tuple: (allowed: bool, remaining: int, reset_time: int)
        """
        cache_key = f"rate_limit:{key}"
        
        # Get current count
        current = cache.get(cache_key, {
            'count': 0,
            'start_time': time.time()
        })
        
        # Check if window has expired
        elapsed = time.time() - current['start_time']
        if elapsed >= window:
            # Reset counter
            current = {
                'count': 1,
                'start_time': time.time()
            }
            cache.set(cache_key, current, window)
            return True, max_requests - 1, int(window)
        
        # Check if limit exceeded
        if current['count'] >= max_requests:
            remaining_time = int(window - elapsed)
            logger.warning(f"Rate limit exceeded for {key}: {current['count']}/{max_requests}")
            return False, 0, remaining_time
        
        # Increment counter
        current['count'] += 1
        cache.set(cache_key, current, int(window - elapsed))
        
        return True, max_requests - current['count'], int(window - elapsed)


def rate_limit(max_requests: int = 100, window: int = 60):
    """
    Decorator to rate limit API endpoints
    
    Usage:
        @rate_limit(max_requests=60, window=60)  # 60 requests per minute
        def my_api_view(request):
            ...
    """
    def decorator(func):
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            # Get client identifier (IP address or user ID)
            client_ip = get_client_ip(request)
            user_id = request.user.id if request.user.is_authenticated else None
            key = f"user:{user_id}" if user_id else f"ip:{client_ip}"
            
            # Check rate limit
            allowed, remaining, reset_time = RateLimiter.check_rate_limit(
                key, max_requests, window
            )
            
            if not allowed:
                return JsonResponse({
                    'error': 'Rate limit exceeded',
                    'message': f'Too many requests. Please try again in {reset_time} seconds.',
                    'retry_after': reset_time
                }, status=429)
            
            # Add rate limit headers to response
            response = func(request, *args, **kwargs)
            if hasattr(response, '__setitem__'):
                response['X-RateLimit-Limit'] = str(max_requests)
                response['X-RateLimit-Remaining'] = str(remaining)
                response['X-RateLimit-Reset'] = str(reset_time)
            
            return response
        return wrapper
    return decorator


def get_client_ip(request):
    """Get client IP address from request"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


class ConnectionPoolManager:
    """
    Manage connection pooling to prevent connection exhaustion
    """
    
    _pools = {}
    
    @classmethod
    def get_pool(cls, name: str, max_connections: int = 10):
        """
        Get or create a connection pool
        """
        if name not in cls._pools:
            cls._pools[name] = {
                'active': 0,
                'max': max_connections,
                'waiting': []
            }
        return cls._pools[name]
    
    @classmethod
    def acquire(cls, name: str) -> bool:
        """
        Acquire a connection from the pool
        Returns True if connection acquired, False if pool is full
        """
        pool = cls.get_pool(name)
        if pool['active'] >= pool['max']:
            logger.warning(f"Connection pool '{name}' is full: {pool['active']}/{pool['max']}")
            return False
        
        pool['active'] += 1
        return True
    
    @classmethod
    def release(cls, name: str):
        """
        Release a connection back to the pool
        """
        pool = cls.get_pool(name)
        if pool['active'] > 0:
            pool['active'] -= 1


# Binance API rate limiting
class BinanceRateLimiter:
    """
    Specialized rate limiter for Binance API
    Binance limits: 1200 requests per minute
    """
    
    MAX_REQUESTS_PER_MINUTE = 1000  # Conservative limit
    MAX_REQUESTS_PER_SECOND = 20    # Burst limit
    
    @staticmethod
    def check_binance_limit():
        """Check if we can make a Binance API call"""
        # Check per-second limit
        allowed_second, _, _ = RateLimiter.check_rate_limit(
            'binance:second',
            BinanceRateLimiter.MAX_REQUESTS_PER_SECOND,
            1
        )
        
        # Check per-minute limit
        allowed_minute, remaining, reset = RateLimiter.check_rate_limit(
            'binance:minute',
            BinanceRateLimiter.MAX_REQUESTS_PER_MINUTE,
            60
        )
        
        if not (allowed_second and allowed_minute):
            wait_time = reset if not allowed_minute else 1
            logger.warning(f"Binance rate limit hit, waiting {wait_time}s")
            time.sleep(wait_time)
            return False
        
        return True
    
    @staticmethod
    def rate_limited_call(func):
        """Decorator for Binance API calls"""
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Wait if rate limit exceeded
            while not BinanceRateLimiter.check_binance_limit():
                time.sleep(0.1)
            
            return func(*args, **kwargs)
        return wrapper
