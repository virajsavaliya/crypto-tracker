# File: core/serializers.py

from rest_framework import serializers
from .models import User, Alert, Payment, CryptoData, FavoriteCrypto

class RegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['email', 'first_name', 'last_name', 'mobile_number']
        extra_kwargs = {
            'first_name': {'required': True},
            'last_name': {'required': True},
            'mobile_number': {'required': True},
        }

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['email'],
            email=validated_data['email'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            mobile_number=validated_data.get('mobile_number', ''),
            is_active=False,
            subscription_plan='free',
            is_premium_user=False
        )
        return user

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()

class LoginWithTokenSerializer(serializers.Serializer):
    token = serializers.CharField()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('first_name', 'last_name', 'email', 'mobile_number', 'username', 'subscription_plan', 'is_premium_user', 'plan_start_date', 'plan_end_date')
        extra_kwargs = {
            'email': {'read_only': True},
        }
    
    def validate_mobile_number(self, value):
        """
        Check that the mobile number is unique, excluding the current user.
        """
        user = self.instance
        if user and User.objects.filter(mobile_number=value).exclude(id=user.id).exists():
            raise serializers.ValidationError("This mobile number is already in use by another user.")
        return value
    
    def validate_username(self, value):
        """
        Check that the username is unique, excluding the current user.
        """
        user = self.instance
        if user and User.objects.filter(username=value).exclude(id=user.id).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value
        
class AlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = '__all__'
        read_only_fields = ('user', 'created_at',)

class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = '__all__'

class CryptoDataSerializer(serializers.ModelSerializer):
    """ FULL serializer for Enterprise users. """
    class Meta:
        model = CryptoData
        fields = '__all__'

class CryptoDataBasicSerializer(serializers.ModelSerializer):
    """ INTERMEDIATE serializer for Basic users. """
    class Meta:
        model = CryptoData
        fields = [
            'symbol', 'last_price', 'high_price_24h', 'low_price_24h', 
            'price_change_percent_24h', 'quote_volume_24h',
            # Basic trading data
            'bid_price', 'ask_price', 'spread',
            # Time-based percentage changes
            'm1', 'm2', 'm3', 'm5', 'm10', 'm15', 'm60',
            # Return percentages (r_pct fields)
            'm1_r_pct', 'm2_r_pct', 'm3_r_pct', 'm5_r_pct', 'm10_r_pct', 'm15_r_pct', 'm60_r_pct',
            # Volume percentages
            'm1_vol_pct', 'm2_vol_pct', 'm3_vol_pct', 'm5_vol_pct', 'm10_vol_pct', 'm15_vol_pct', 'm60_vol_pct',
            # Range percentages  
            'm1_range_pct', 'm2_range_pct', 'm3_range_pct', 'm5_range_pct', 'm10_range_pct', 'm15_range_pct', 'm60_range_pct',
            # Volume data
            'm1_vol', 'm5_vol', 'm10_vol', 'm15_vol', 'm60_vol',
            # Low/High data
            'm1_low', 'm1_high', 'm2_low', 'm2_high', 'm3_low', 'm3_high',
            'm5_low', 'm5_high', 'm10_low', 'm10_high', 'm15_low', 'm15_high', 'm60_low', 'm60_high',
            # Net Volume (NV)
            'm1_nv', 'm2_nv', 'm3_nv', 'm5_nv', 'm10_nv', 'm15_nv', 'm60_nv',
            # RSI indicators
            'rsi_1m', 'rsi_3m', 'rsi_5m', 'rsi_15m',
            # Base Volume (BV)
            'm1_bv', 'm2_bv', 'm3_bv', 'm5_bv', 'm10_bv', 'm15_bv', 'm60_bv',
            # Sell Volume (SV)  
            'm1_sv', 'm2_sv', 'm3_sv', 'm5_sv', 'm10_sv', 'm15_sv', 'm60_sv',
        ]
        
class CryptoDataFreeSerializer(serializers.ModelSerializer):
    """ LIMITED serializer for Free users. """
    class Meta:
        model = CryptoData
        fields = [
            'symbol', 'last_price', 'high_price_24h', 'low_price_24h', 
            'price_change_percent_24h', 'quote_volume_24h'
        ]

class FavoriteCryptoSerializer(serializers.ModelSerializer):
    class Meta:
        model = FavoriteCrypto
        fields = ['id', 'symbol']