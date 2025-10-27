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

# Celery beat configuration - OPTIMIZED for 2 vCPU + 4GB RAM + 20 concurrent users
# Updated: Oct 13, 2025 - Added new coin listing monitoring
app.conf.beat_schedule = {
    'poll-telegram-updates-every-10-seconds': {
        'task': 'core.tasks.poll_telegram_updates_task',
        'schedule': 10.0,  # Keep at 10s - responsive enough for bot commands
    },
    'distributed-batch-fetch-every-10-seconds': {
        'task': 'core.tasks.fetch_binance_data_task',
        'schedule': 10.0,  # ⚡ Faster: 15s → 10s for fresher market data
    },
    'calculate-crypto-metrics-every-80-seconds': {
        'task': 'core.tasks.calculate_crypto_metrics_task', 
        'schedule': 80.0,  # ⚡⚡ Much faster: 120s → 80s for better accuracy
    },
    'monitor-distributed-performance-every-60-seconds': {
        'task': 'core.tasks.monitor_distributed_performance_task',
        'schedule': 60.0,  # Keep at 60s - monitoring doesn't need faster updates
    },
    'process-price-alerts-every-25-seconds': {
        'task': 'core.tasks.process_price_alerts_task',
        'schedule': 25.0,  # ⚡ Faster: 30s → 25s for quicker alert notifications
    },
    'process-rsi-alerts-every-25-seconds': {
        'task': 'core.tasks.process_rsi_alerts_task',
        'schedule': 25.0,  # ⚡ Faster: 30s → 25s for quicker RSI alerts
    },
    'check-new-coin-listings-every-60-seconds': {
        'task': 'core.tasks.check_new_coin_listings_task',
        'schedule': 60.0,  # Check for new listings every minute
    },
    'check-plan-expiration-warnings-daily': {
        'task': 'check_plan_expiration_warnings',
        'schedule': 86400.0,  # Run once per day (24 hours) - sends 7, 3, 1 day warnings
    },
    'check-expired-plans-daily': {
        'task': 'check_and_expire_plans',
        'schedule': 86400.0,  # Run once per day (24 hours) - downgrades expired users
    },
}

app.conf.timezone = 'UTC'