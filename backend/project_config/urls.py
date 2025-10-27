# myproject/myproject/urls.py
from django.contrib import admin
from django.urls import path, include
from core.views import StripeWebhookView, HealthCheckView, MetricsView # Import the health and metrics views

urlpatterns = [
    path('admin/', admin.site.urls),
    # Direct all requests to /api/ to the core app's URLs
    path('api/', include('core.urls')),
    path('stripe-webhook/', StripeWebhookView.as_view(), name='stripe-webhook'),
    
    # Health check and metrics at root level for Docker health checks
    path('healthz/', HealthCheckView.as_view(), name='root_health_check'),
    path('metrics/', MetricsView.as_view(), name='root_metrics'),
]
