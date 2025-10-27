#!/usr/bin/env python
"""
Quick script to add the new coin listing periodic task to django-celery-beat database
Run: docker-compose exec calc-worker python add_new_coin_task.py
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'project_config.settings')
django.setup()

from django_celery_beat.models import PeriodicTask, IntervalSchedule

# Create or get the 60-second interval
interval, created = IntervalSchedule.objects.get_or_create(
    every=60,
    period=IntervalSchedule.SECONDS,
)

# Create or update the periodic task
task, created = PeriodicTask.objects.get_or_create(
    name='check-new-coin-listings',
    defaults={
        'task': 'core.tasks.check_new_coin_listings_task',
        'interval': interval,
        'enabled': True,
    }
)

if not created:
    # Update existing task
    task.task = 'core.tasks.check_new_coin_listings_task'
    task.interval = interval
    task.enabled = True
    task.save()
    print(f"✅ Updated existing task: {task.name}")
else:
    print(f"✅ Created new task: {task.name}")

print(f"\nTask Details:")
print(f"  Name: {task.name}")
print(f"  Task: {task.task}")
print(f"  Schedule: Every {interval.every} {interval.period}")
print(f"  Enabled: {task.enabled}")
print(f"\n🔄 Restart celery-beat to apply: docker-compose restart celery-beat")
