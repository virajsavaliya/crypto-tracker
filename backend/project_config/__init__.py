# backend/project_config/__init__.py
# Purpose: Initialize Celery app for Django
# Ensures Celery is loaded when Django starts

from __future__ import absolute_import, unicode_literals

# Import Celery app so that shared_task decorator will use this app
from .celery import app as celery_app

__all__ = ('celery_app',)