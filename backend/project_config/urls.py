# myproject/myproject/urls.py
from django.contrib import admin
from django.urls import path, include
from core.views import StripeWebhookView # Import the new view

urlpatterns = [
    path('admin/', admin.site.urls),
    # Direct all requests to /api/ to the core app's URLs
    path('api/', include('core.urls')),
    path('stripe-webhook/', StripeWebhookView.as_view(), name='stripe-webhook'),
]
