from django.urls import path, re_path
from .views import (
    RegisterView,
    ActivateAccountView,
    RequestLoginTokenView,
    LoginWithTokenView,
    GoogleLoginView,
    BinanceDataView,
    UserDetailView,
    UserUpdateView,
    UpgradePlanView,
    AlertsView,
    StripeWebhookView,
    PaymentHistoryView,FavoriteCryptoView,
)
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('request-login-token/', RequestLoginTokenView.as_view(), name='request_login_token'),
    path('login-with-token/', LoginWithTokenView.as_view(), name='login_with_token'),
    path('google-login/', GoogleLoginView.as_view(), name='google_login'),
    re_path(r'activate/(?P<token>[0-9a-f-]+)/$', ActivateAccountView.as_view(), name='activate'),
    path('binance-data/', BinanceDataView.as_view(), name='binance-data'),
    path('user/', UserDetailView.as_view(), name='user-detail'),
    path('user/update/', UserUpdateView.as_view(), name='user-update'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('upgrade-plan/', UpgradePlanView.as_view(), name='upgrade-plan'),

    # Alert System URLs
    path('alerts/', AlertsView.as_view(), name='alerts'),
    path('alerts/<int:alert_id>/', AlertsView.as_view(), name='delete-alert'),

    # Stripe Webhook URL
    path('stripe-webhook/', StripeWebhookView.as_view(), name='stripe-webhook'),

    # Payment History URL
    path('payment-history/', PaymentHistoryView.as_view(), name='payment-history'),
    path('favorites/', FavoriteCryptoView.as_view(), name='user-favorites'),

]