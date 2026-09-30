# backend/project_config/celery.py
# Purpose: Celery configuration for background task processing
# Reduces server load: Async task processing, distributed computing, background calculations
# Test: celery -A project_config worker --loglevel=info

from __future__ import absolute_import, unicode_literals
import os
from celery import Celery

# Set default Django settings module for Celery
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'project_config.settings')

app = Celery('crypto_tracker')

# Load configuration from Django settings
app.config_from_object('django.conf:settings', namespace='CELERY')

# Fix Celery 6.0 deprecation warning
app.conf.broker_connection_retry_on_startup = True

# Auto-discover tasks from all registered Django apps
app.autodiscover_tasks()

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')

# Celery beat configuration - OPTIMIZED for 2 vCPU + 4GB RAM
# Updated: Nov 28, 2025 - Balanced for accuracy vs resource usage
# 
# CRITICAL TASKS (need high frequency for accuracy):
# - fetch_binance_data_task: Fetches live prices from Binance
# - process_price_alerts_task: User alerts need quick response
# - process_rsi_alerts_task: RSI alerts need quick response
#
# MEDIUM PRIORITY (can run less frequently):
# - calculate_crypto_metrics_task: Calculates derived metrics
# - poll_telegram_updates_task: Bot commands
# - check_new_coin_listings_task: New listings
#
# LOW PRIORITY (run infrequently):
# - monitor_distributed_performance_task: Just monitoring
# - cleanup tasks: Maintenance only
#
app.conf.beat_schedule = {
    # ============ CRITICAL - HIGH FREQUENCY ============
    # Price data updates - MOST IMPORTANT for accuracy
    'distributed-batch-fetch-every-8-seconds': {
        'task': 'core.tasks.fetch_binance_data_task',
        'schedule': 8.0,  # ⚡ FASTER: 10s → 8s - fresher price data for trading
    },
    # Alert processing - Users expect quick notifications
    'process-price-alerts-every-15-seconds': {
        'task': 'core.tasks.process_price_alerts_task',
        'schedule': 15.0,  # ⚡ FASTER: 25s → 15s - quicker alert delivery
    },
    'process-rsi-alerts-every-15-seconds': {
        'task': 'core.tasks.process_rsi_alerts_task',
        'schedule': 15.0,  # ⚡ FASTER: 25s → 15s - quicker RSI alerts
    },
    
    # ============ MEDIUM PRIORITY ============
    # Telegram bot - needs responsive feel
    'poll-telegram-updates-every-8-seconds': {
        'task': 'core.tasks.poll_telegram_updates_task',
        'schedule': 8.0,  # ⚡ FASTER: 10s → 8s - more responsive bot
    },
    # Metrics calculation - important but can be slightly slower
    'calculate-crypto-metrics-every-60-seconds': {
        'task': 'core.tasks.calculate_crypto_metrics_task', 
        'schedule': 60.0,  # ⚡ FASTER: 80s → 60s - more accurate derived metrics
    },
    # New coin listings - check every 2 minutes (coins don't list every second)
    'check-new-coin-listings-every-120-seconds': {
        'task': 'core.tasks.check_new_coin_listings_task',
        'schedule': 120.0,  # 🔽 SLOWER: 60s → 120s - new listings are rare
    },
    
    # ============ LOW PRIORITY - MONITORING/MAINTENANCE ============
    # Performance monitoring - just for observability
    'monitor-distributed-performance-every-120-seconds': {
        'task': 'core.tasks.monitor_distributed_performance_task',
        'schedule': 120.0,  # 🔽 SLOWER: 60s → 120s - monitoring can be less frequent
    },
    # Daily tasks - no change needed
    'check-plan-expiration-warnings-daily': {
        'task': 'check_plan_expiration_warnings',
        'schedule': 86400.0,  # Once per day
    },
    'check-expired-plans-daily': {
        'task': 'check_and_expire_plans',
        'schedule': 86400.0,  # Once per day
    },
    # Cleanup delisted symbols - every 4 hours is enough
    'cleanup-delisted-symbols-every-4-hours': {
        'task': 'core.tasks.cleanup_delisted_symbols_task',
        'schedule': 14400.0,  # ⚡ FASTER: 6h → 4h - quicker cleanup of delisted coins
    },
}

app.conf.timezone = 'UTC'

# Task routing configuration - prevent multiple workers from polling Telegram
# Only celery-worker (not calc-worker) should handle Telegram tasks
app.conf.task_routes = {
    'core.tasks.poll_telegram_updates_task': {'queue': 'celery'},
    'core.tasks.send_telegram_alert_task': {'queue': 'celery'},
}

# Ensure only one instance of telegram polling runs at a time
app.conf.task_default_queue = 'celery'
app.conf.task_create_missing_queues = True