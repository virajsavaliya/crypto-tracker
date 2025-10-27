# backend/core/urls.py
# Purpose: Add health check and metrics endpoints for monitoring
# Test: curl http://localhost:8000/healthz/

from django.urls import path
from . import views

urlpatterns = [
    # Authentication
    path('register/', views.RegisterView.as_view(), name='register'),
    path('request-login-token/', views.RequestLoginTokenView.as_view(), name='request_login_token'),
    path('login-with-token/', views.LoginWithTokenView.as_view(), name='login_with_token'),
    path('activate/<str:token>/', views.ActivateAccountView.as_view(), name='activate_account'),
    path('google-login/', views.GoogleLoginView.as_view(), name='google_login'),
    
    # User management
    path('user/', views.UserDetailView.as_view(), name='user_detail'),
    path('user/update/', views.UserUpdateView.as_view(), name='user_update'),
    
    # Subscription management
    path('upgrade-plan/', views.UpgradePlanView.as_view(), name='upgrade_plan'),
    path('stripe-webhook/', views.StripeWebhookView.as_view(), name='stripe_webhook'),
    path('payment-history/', views.PaymentHistoryView.as_view(), name='payment_history'),
    
    # Data and alerts
    path('alerts/', views.AlertsView.as_view(), name='alerts'),
    path('alerts/<int:alert_id>/', views.AlertsView.as_view(), name='delete_alert'),
    path('binance-data/', views.BinanceDataView.as_view(), name='binance_data'),
    
    # Favorites
    path('favorites/', views.FavoriteCryptoView.as_view(), name='favorites'),
    
    # Health check and metrics endpoints
    path('healthz/', views.HealthCheckView.as_view(), name='health_check'),
    path('metrics/', views.MetricsView.as_view(), name='metrics'),
]