# File: core/serializers.py

from rest_framework import serializers
from .models import User, Alert, Payment, CryptoData, FavoriteCrypto

class RegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        # Only include the fields the user needs to provide
        fields = ['email', 'first_name', 'last_name', 'mobile_number']
        extra_kwargs = {
            'first_name': {'required': True},
            'last_name': {'required': True},
            'mobile_number': {'required': True},
        }

    def create(self, validated_data):
        # Set the username to be the email, as intended
        user = User.objects.create_user(
            username=validated_data['email'],
            email=validated_data['email'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            mobile_number=validated_data.get('mobile_number', ''),
            is_active=False, # Start with an inactive account until activation
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

# --- NEW AND UPDATED SERIALIZERS FOR CRYPTO DATA ---

class CryptoDataSerializer(serializers.ModelSerializer):
    """
    The FULL serializer for premium users. Includes all fields from the model.
    """
    class Meta:
        model = CryptoData
        fields = '__all__'
        
class CryptoDataFreeSerializer(serializers.ModelSerializer):
    """
    A LIMITED serializer for free users. It only includes the basic, non-premium fields.
    """
    class Meta:
        model = CryptoData
        fields = [
            'symbol', 'last_price', 'high_price_24h', 'low_price_24h', 
            'price_change_percent_24h', 'quote_volume_24h'
        ]
# --- NEW SERIALIZER FOR FAVORITES ---
class FavoriteCryptoSerializer(serializers.ModelSerializer):
    class Meta:
        model = FavoriteCrypto
        fields = ['id', 'symbol'] # We only need to send the symbol back and forth
