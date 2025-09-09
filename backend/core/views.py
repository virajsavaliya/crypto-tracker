# File: core/views.py
import os
import json
from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
import uuid
import firebase_admin
from firebase_admin import credentials, auth
from django.db import IntegrityError
import requests
import stripe
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated

from .models import User, Alert, Payment, CryptoData, FavoriteCrypto
from .serializers import (
    RegisterSerializer, LoginSerializer, LoginWithTokenSerializer,
    UserSerializer, AlertSerializer, PaymentSerializer,
    CryptoDataSerializer, CryptoDataFreeSerializer, FavoriteCryptoSerializer
)

# --- Import the tasks ---
from .tasks import send_activation_email_task, send_login_token_email_task

# --- Firebase Admin SDK Initialization ---
private_key = os.environ.get("FIREBASE_PRIVATE_KEY", "").replace('\\n', '\n')

cred_dict = {
  "type": "service_account",
  "project_id": "file-sharing-app-c63a0",
  "private_key_id": "82461d4f111c13496741bef3173b76a65e9ad993",
  "private_key": private_key,
  "client_email": "firebase-adminsdk-5oc6t@file-sharing-app-c63a0.iam.gserviceaccount.com",
  "client_id": "114923044052820733108",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-5oc6t%40file-sharing-app-c63a0.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
}
cred = credentials.Certificate(cred_dict)


if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

stripe.api_key = settings.STRIPE_SECRET_KEY
stripe_price_ids = {
    'basic': os.environ.get('STRIPE_PRICE_ID_BASIC'),
    'enterprise': os.environ.get('STRIPE_PRICE_ID_ENTERPRISE'),
}

# File: core/views.py

class RegisterView(APIView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            # Let the serializer create the user
            user = serializer.save() 
            
            # Generate the activation token
            token = str(uuid.uuid4())
            user.activation_token = token
            user.save()

            # Send the activation email
            send_activation_email_task(user.email, user.first_name, token)

            return Response({'message': 'User registered successfully. An activation email has been sent.'}, status=status.HTTP_201_CREATED)
        
        # If the serializer is not valid, it will return the errors
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    
class RequestLoginTokenView(APIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            try:
                user = User.objects.get(email=email)
                if not user.is_active:
                    return Response({'error': 'Please activate your account first.'}, status=status.HTTP_403_FORBIDDEN)
                login_token = str(uuid.uuid4())
                user.login_token = login_token
                user.save()

                # *** CHANGE THIS LINE ***
                # Call the function directly instead of using .delay()
                send_login_token_email_task(email, user.first_name, login_token)

                return Response({'message': 'A login link has been sent to your email.'}, status=status.HTTP_200_OK)
            except User.DoesNotExist:
                return Response({'error': 'User with this email does not exist.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LoginWithTokenView(APIView):
    def post(self, request):
        serializer = LoginWithTokenSerializer(data=request.data)
        if serializer.is_valid():
            token = serializer.validated_data['token']
            try:
                user = User.objects.get(login_token=token, is_active=True)
                user.login_token = None
                user.save()
                refresh = RefreshToken.for_user(user)
                return Response({
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'email': user.email,
                }, status=status.HTTP_200_OK)
            except User.DoesNotExist:
                return Response({'error': 'Invalid or expired login link.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ActivateAccountView(APIView):
    def get(self, request, token):
        try:
            user = User.objects.get(activation_token=token, is_active=False)
            user.is_active = True
            user.activation_token = None
            user.save()
            return Response({'message': 'Account activated successfully.'}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({'message': 'Invalid activation link or account already activated.'}, status=status.HTTP_400_BAD_REQUEST)

class GoogleLoginView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        try:
            id_token = request.headers.get('Authorization', '').split('Bearer ')[-1]
            if not id_token:
                return Response({'error': 'Authorization header missing or invalid.'}, status=status.HTTP_400_BAD_REQUEST)

            decoded_token = auth.verify_id_token(id_token)
            email = decoded_token.get('email')
            first_name = request.data.get('first_name')
            last_name = request.data.get('last_name')

            if not email:
                return Response({'error': 'Email not found in Google token.'}, status=status.HTTP_400_BAD_REQUEST)

            try:
                user = User.objects.get(email=email)
                if not user.is_active:
                    user.is_active = True
                    user.save()
            except User.DoesNotExist:
                user = User.objects.create_user(
                    username=email,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    is_active=True,
                    subscription_plan='free',
                    is_premium_user=False
                )

            refresh = RefreshToken.for_user(user)
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'first_name': user.first_name,
                'last_name': user.last_name,
                'email': user.email,
            }, status=status.HTTP_200_OK)

        except auth.InvalidIdTokenError:
            return Response({'error': 'Invalid Firebase ID token.'}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            print(f"Error during Google login: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UserDetailView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        user = request.user
        serializer = UserSerializer(user)
        return Response(serializer.data)

class UserUpdateView(APIView):
    permission_classes = [IsAuthenticated]
    def patch(self, request):
        user = request.user
        serializer = UserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UpgradePlanView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        user = request.user
        new_plan = request.data.get('plan')
        if not new_plan or new_plan not in ['basic', 'enterprise']:
            return Response({'error': 'Invalid plan specified.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            checkout_session = stripe.checkout.Session.create(
                line_items=[{'price': stripe_price_ids[new_plan], 'quantity': 1,}],
                mode='subscription',
                success_url=f"{settings.FRONTEND_URL}/dashboard?upgrade=success",
                cancel_url=f"{settings.FRONTEND_URL}/upgrade-plan?upgrade=canceled",
                customer_email=user.email,
                client_reference_id=str(user.id)
            )
            return Response({'checkout_url': checkout_session.url}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class StripeWebhookView(APIView):
    permission_classes = []
    authentication_classes = []
    def post(self, request):
        payload = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
        event = None
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
        except ValueError as e:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        except stripe.error.SignatureVerificationError as e:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        if event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            client_reference_id = session.get('client_reference_id')
            if client_reference_id:
                try:
                    user = User.objects.get(id=client_reference_id)
                    line_items = stripe.checkout.Session.list_line_items(session.id, limit=1)
                    price_id = line_items['data'][0]['price']['id']
                    plan_map = {v: k for k, v in stripe_price_ids.items()}
                    new_plan = plan_map.get(price_id)
                    if new_plan:
                        user.subscription_plan = new_plan
                        user.is_premium_user = True
                        user.stripe_customer_id = session.get('customer')
                        user.save()
                        Payment.objects.create(
                            user=user, stripe_charge_id=session.id,
                            amount=session.amount_total, status=session.payment_status,
                            plan=new_plan
                        )
                except User.DoesNotExist:
                    print(f"User with ID {client_reference_id} not found.")
        return Response(status=status.HTTP_200_OK)

class PaymentHistoryView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        payments = Payment.objects.filter(user=request.user)
        serializer = PaymentSerializer(payments, many=True)
        return Response(serializer.data)

class AlertsView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        alerts = Alert.objects.filter(user=request.user)
        serializer = AlertSerializer(alerts, many=True)
        return Response(serializer.data)
    def post(self, request):
        serializer = AlertSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    def delete(self, request, alert_id):
        try:
            alert = Alert.objects.get(id=alert_id, user=request.user)
            alert.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Alert.DoesNotExist:
            return Response({'error': 'Alert not found.'}, status=status.HTTP_404_NOT_FOUND)

class BinanceDataView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            user = request.user
            crypto_data = CryptoData.objects.all().order_by('-quote_volume_24h')

            if user.is_premium_user:
                serializer = CryptoDataSerializer(crypto_data, many=True)
            else:
                serializer = CryptoDataFreeSerializer(crypto_data, many=True)

            return Response(serializer.data, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class FavoriteCryptoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        favorites = FavoriteCrypto.objects.filter(user=request.user)
        serializer = FavoriteCryptoSerializer(favorites, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        symbol = request.data.get('symbol')
        if not symbol:
            return Response({'error': 'Symbol is required.'}, status=status.HTTP_400_BAD_REQUEST)

        favorite, created = FavoriteCrypto.objects.get_or_create(user=request.user, symbol=symbol)

        if created:
            serializer = FavoriteCryptoSerializer(favorite)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        else:
            return Response({'message': 'Symbol already in favorites.'}, status=status.HTTP_200_OK)

    def delete(self, request):
        symbol = request.data.get('symbol')
        if not symbol:
            return Response({'error': 'Symbol is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            favorite = FavoriteCrypto.objects.get(user=request.user, symbol=symbol)
            favorite.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except FavoriteCrypto.DoesNotExist:
            return Response({'error': 'Favorite not found.'}, status=status.HTTP_404_NOT_FOUND)