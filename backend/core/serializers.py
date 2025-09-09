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
        fields = ('first_name', 'last_name', 'email', 'mobile_number', 'username', 'subscription_plan', 'is_premium_user')
        
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
            'm1', 'm5', 'm10', 'm15', 'm60',
            'm1_vol', 'm5_vol', 'm10_vol', 'm15_vol', 'm60_vol',
            'm1_range_pct', 'm5_range_pct', 'm15_range_pct', 'm60_range_pct',
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