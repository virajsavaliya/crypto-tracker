from django.urls import path, re_path
from .views import (
    RegisterView,
    ActivateAccountView,
    RequestLoginTokenView,
    LoginWithTokenView,
    GoogleLoginView,
    FirebaseTestView,
    BinanceDataView,
    UserDetailView,
    UserUpdateView,
    UpgradePlanView,
    AlertsView,
    StripeWebhookView,
    PaymentHistoryView,
    FavoriteCryptoView,
    HealthCheckView,
    MetricsView,
    CoinSymbolsView,
    ManualRefreshView,
)
from .telegram_views import (
    telegram_webhook,
    generate_telegram_setup_token,
    telegram_connection_status,
    disconnect_telegram,
    test_telegram_alert,
    user_alert_settings,
    create_alert,
    delete_alert,
    update_alert,
    telegram_bot_info,
)
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('request-login-token/', RequestLoginTokenView.as_view(), name='request_login_token'),
    path('login-with-token/', LoginWithTokenView.as_view(), name='login_with_token'),
    path('google-login/', GoogleLoginView.as_view(), name='google_login'),
    path('firebase-test/', FirebaseTestView.as_view(), name='firebase_test'),
    re_path(r'activate/(?P<token>[0-9a-f-]+)/$', ActivateAccountView.as_view(), name='activate'),
    path('binance-data/', BinanceDataView.as_view(), name='binance-data'),
    path('manual-refresh/', ManualRefreshView.as_view(), name='manual-refresh'),
    path('user/', UserDetailView.as_view(), name='user-detail'),
    path('user/update/', UserUpdateView.as_view(), name='user-update'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('upgrade-plan/', UpgradePlanView.as_view(), name='upgrade-plan'),

    # Alert System URLs
    path('alerts/', AlertsView.as_view(), name='alerts'),
    path('alerts/<int:alert_id>/', AlertsView.as_view(), name='delete-alert'),

    # Telegram Integration URLs
    path('telegram/webhook/', telegram_webhook, name='telegram-webhook'),
    path('telegram/setup-token/', generate_telegram_setup_token, name='telegram-setup-token'),
    path('telegram/status/', telegram_connection_status, name='telegram-status'),
    path('telegram/disconnect/', disconnect_telegram, name='telegram-disconnect'),
    path('telegram/test-alert/', test_telegram_alert, name='telegram-test-alert'),
    path('telegram/bot-info/', telegram_bot_info, name='telegram-bot-info'),
    
    # Enhanced Alert Management URLs
    path('alert-settings/', user_alert_settings, name='user-alert-settings'),
    path('alert/create/', create_alert, name='create-alert'),
    path('alert/<int:alert_id>/delete/', delete_alert, name='delete-alert-api'),
    path('alert/<int:alert_id>/update/', update_alert, name='update-alert'),

    # Stripe Webhook URL
    path('stripe-webhook/', StripeWebhookView.as_view(), name='stripe-webhook'),

    # Payment History URL
    path('payment-history/', PaymentHistoryView.as_view(), name='payment-history'),
    path('favorites/', FavoriteCryptoView.as_view(), name='user-favorites'),
    
    # Coin Symbols URL
    path('coin-symbols/', CoinSymbolsView.as_view(), name='coin-symbols'),

    # Health check and metrics endpoints
    path('healthz/', HealthCheckView.as_view(), name='health_check'),
    path('metrics/', MetricsView.as_view(), name='metrics'),
]