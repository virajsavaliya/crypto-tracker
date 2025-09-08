# File: core/models.py

from django.db import models
from django.contrib.auth.models import AbstractUser
import uuid

# --- User, Alert, Payment, and CryptoData models remain the same ---

class User(AbstractUser):
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name', 'mobile_number']
    email = models.EmailField(unique=True, blank=True, null=True, verbose_name='email address')
    is_active = models.BooleanField(default=False)
    activation_token = models.CharField(max_length=100, blank=True, null=True, unique=True)
    login_token = models.CharField(max_length=100, blank=True, null=True, unique=True)
    mobile_number = models.CharField(max_length=15, blank=True, null=True)
    SUBSCRIPTION_PLANS = (('free', 'Free'), ('basic', 'Basic'), ('enterprise', 'Enterprise'),)
    subscription_plan = models.CharField(max_length=20, choices=SUBSCRIPTION_PLANS, default='free')
    stripe_customer_id = models.CharField(max_length=50, blank=True, null=True)
    is_premium_user = models.BooleanField(default=False)
    groups = models.ManyToManyField('auth.Group', related_name='core_user_set', blank=True)
    user_permissions = models.ManyToManyField('auth.Permission', related_name='core_user_permissions_set', blank=True)
    def __str__(self):
        return self.email

class Alert(models.Model):
    ALERT_TYPES = (('price_movement', 'Price Movement'), ('volume_change', 'Volume Change'), ('new_coin_listing', 'New Coin Listing'),)
    TIME_PERIODS = (('1m', '1 minute'), ('5m', '5 minutes'), ('15m', '15 minutes'), ('1h', '1 hour'), ('24h', '24 hours'),)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='alerts')
    alert_type = models.CharField(max_length=20, choices=ALERT_TYPES)
    coin_symbol = models.CharField(max_length=20, blank=True, null=True)
    condition_value = models.FloatField(blank=True, null=True)
    time_period = models.CharField(max_length=5, choices=TIME_PERIODS, blank=True, null=True)
    any_coin = models.BooleanField(default=False)
    notification_channels = models.CharField(max_length=50, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    def __str__(self):
        return f"{self.user.email} - {self.alert_type} for {self.coin_symbol or 'Any Coin'}"

class Payment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payments')
    stripe_charge_id = models.CharField(max_length=100)
    amount = models.IntegerField()
    timestamp = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=50)
    plan = models.CharField(max_length=20)
    def __str__(self):
        return f"{self.user.email} - {self.amount / 100} USD on {self.timestamp.strftime('%Y-%m-%d')}"

class CryptoData(models.Model):
    symbol = models.CharField(max_length=20, unique=True, db_index=True)
    last_price = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    price_change_percent_24h = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    high_price_24h = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    low_price_24h = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    quote_volume_24h = models.DecimalField(max_digits=30, decimal_places=10, null=True, blank=True)
    bid_price = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    ask_price = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    spread = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m1 = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m2 = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m3 = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m5 = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m10 = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m15 = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m60 = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m1_vol_pct = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m2_vol_pct = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m3_vol_pct = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m5_vol_pct = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m10_vol_pct = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m15_vol_pct = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m60_vol_pct = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m1_vol = models.DecimalField(max_digits=30, decimal_places=10, null=True, blank=True)
    m5_vol = models.DecimalField(max_digits=30, decimal_places=10, null=True, blank=True)
    m10_vol = models.DecimalField(max_digits=30, decimal_places=10, null=True, blank=True)
    m15_vol = models.DecimalField(max_digits=30, decimal_places=10, null=True, blank=True)
    m60_vol = models.DecimalField(max_digits=30, decimal_places=10, null=True, blank=True)
    m1_low = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m1_high = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m1_range_pct = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m2_low = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m2_high = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m2_range_pct = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m3_low = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m3_high = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m3_range_pct = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank   =True)
    m5_low = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m5_high = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m5_range_pct = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m10_low = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m10_high = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m10_range_pct = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m15_low = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m15_high = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m15_range_pct = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m60_low = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m60_high = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m60_range_pct = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m1_nv = models.DecimalField(max_digits=30, decimal_places=10, null=True, blank=True)
    m2_nv = models.DecimalField(max_digits=30, decimal_places=10, null=True, blank=True)
    m3_nv = models.DecimalField(max_digits=30, decimal_places=10, null=True, blank=True)
    m5_nv = models.DecimalField(max_digits=30, decimal_places=10, null=True, blank=True)
    m10_nv = models.DecimalField(max_digits=30, decimal_places=10, null=True, blank=True)
    m15_nv = models.DecimalField(max_digits=30, decimal_places=10, null=True, blank=True)
    m60_nv = models.DecimalField(max_digits=30, decimal_places=10, null=True, blank=True)
    rsi_1m = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    rsi_3m = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    rsi_5m = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    rsi_15m = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    m1_bv = models.DecimalField(max_digits=30, decimal_places=10, null=True, blank=True)
    m2_bv = models.DecimalField(max_digits=30, decimal_places=10, null=True, blank=True)
    m3_bv = models.DecimalField(max_digits=30, decimal_places=10, null=True, blank=True)
    m5_bv = models.DecimalField(max_digits=30, decimal_places=10, null=True, blank=True)
    m10_bv = models.DecimalField(max_digits=30, decimal_places=10, null=True, blank=True)
    m15_bv = models.DecimalField(max_digits=30, decimal_places=10, null=True, blank=True)
    m60_bv = models.DecimalField(max_digits=30, decimal_places=10, null=True, blank=True)
    m1_sv = models.DecimalField(max_digits=30, decimal_places=10, null=True, blank=True)
    m2_sv = models.DecimalField(max_digits=30, decimal_places=10, null=True, blank=True)
    m3_sv = models.DecimalField(max_digits=30, decimal_places=10, null=True, blank=True)
    m5_sv = models.DecimalField(max_digits=30, decimal_places=10, null=True, blank=True)
    m10_sv = models.DecimalField(max_digits=30, decimal_places=10, null=True, blank=True)
    m15_sv = models.DecimalField(max_digits=30, decimal_places=10, null=True, blank=True)
    m60_sv = models.DecimalField(max_digits=30, decimal_places=10, null=True, blank=True)

    def __str__(self):
        return self.symbol

# --- NEW MODEL FOR FAVORITES ---
class FavoriteCrypto(models.Model):
    """
    Stores a favorite cryptocurrency symbol for a specific user.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='favorites')
    symbol = models.CharField(max_length=20)

    class Meta:
        # Ensures a user can only favorite a symbol once
        unique_together = ('user', 'symbol')

    def __str__(self):
        return f"{self.user.email} - {self.symbol}"