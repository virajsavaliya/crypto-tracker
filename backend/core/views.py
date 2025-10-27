# File: core/views.py
import os
import json
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
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
import logging

logger = logging.getLogger(__name__)

from .models import User, Alert, Payment, CryptoData, FavoriteCrypto
from .serializers import (
    RegisterSerializer, LoginSerializer, LoginWithTokenSerializer,
    UserSerializer, AlertSerializer, PaymentSerializer,
    CryptoDataSerializer, CryptoDataFreeSerializer, CryptoDataBasicSerializer,
    FavoriteCryptoSerializer
)

# --- Import the tasks ---
from .tasks import send_activation_email_task, send_login_token_email_task

# --- Firebase Admin SDK Initialization ---
private_key = os.environ.get("FIREBASE_PRIVATE_KEY", "").replace('\\n', '\n')

# Only initialize Firebase if private key is properly provided
if private_key and len(private_key.strip()) > 100:  # Valid private key should be much longer
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
else:
    pass  # Firebase not initialized - FIREBASE_PRIVATE_KEY not properly configured

stripe.api_key = settings.STRIPE_SECRET_KEY
stripe_price_ids = {
    'basic': os.environ.get('STRIPE_PRICE_ID_BASIC'),
    'enterprise': os.environ.get('STRIPE_PRICE_ID_ENTERPRISE'),
}

class RegisterView(APIView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save() 
            token = str(uuid.uuid4())
            user.activation_token = token
            user.save()
            send_activation_email_task(user.email, user.first_name, token)
            return Response({'message': 'User registered successfully. An activation email has been sent.'}, status=status.HTTP_201_CREATED)
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
                    'subscription_plan': user.subscription_plan,
                    'is_premium_user': user.is_premium_user,
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
            # Enhanced logging for debugging
            logger.info(f"Google login attempt from IP: {request.META.get('REMOTE_ADDR')}")
            
            # Debug: Log the raw Authorization header
            auth_header = request.headers.get('Authorization', '')
            logger.info(f"Raw Authorization header: {auth_header[:50]}...")
            
            id_token = auth_header.split('Bearer ')[-1] if 'Bearer ' in auth_header else auth_header
            if not id_token or id_token == auth_header:
                logger.warning("Google login failed: No Authorization header or invalid format")
                return Response({'error': 'Authorization header missing or invalid format. Expected: Bearer <token>'}, status=status.HTTP_400_BAD_REQUEST)

            # Check if Firebase is properly initialized
            if not firebase_admin._apps:
                logger.error("Firebase not initialized - cannot verify ID token")
                return Response({'error': 'Authentication service not available.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

            logger.info(f"Attempting to verify Firebase ID token (length: {len(id_token)}, starts with: {id_token[:20]}...)")
            
            # Add clock skew tolerance for Docker containers
            # This allows for small time differences between client and server
            decoded_token = auth.verify_id_token(id_token, clock_skew_seconds=60)
            
            email = decoded_token.get('email')
            first_name = request.data.get('first_name')
            last_name = request.data.get('last_name')

            if not email:
                logger.warning("Google login failed: No email in decoded token")
                return Response({'error': 'Email not found in Google token.'}, status=status.HTTP_400_BAD_REQUEST)

            try:
                user = User.objects.get(email=email)
                if not user.is_active:
                    user.is_active = True
                    user.save()
                logger.info(f"Existing user logged in: {email}")
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
                logger.info(f"New user created: {email}")

            refresh = RefreshToken.for_user(user)
            logger.info(f"Google login successful for: {email}")
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'first_name': user.first_name,
                'last_name': user.last_name,
                'email': user.email,
                'subscription_plan': user.subscription_plan,
                'is_premium_user': user.is_premium_user,
            }, status=status.HTTP_200_OK)

        except auth.InvalidIdTokenError as e:
            logger.warning(f"Invalid Firebase ID token: {str(e)}")
            return Response({'error': 'Invalid Firebase ID token.', 'details': str(e)}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            logger.error(f"Error during Google login: {str(e)}")
            return Response({'error': 'Authentication failed.', 'details': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class FirebaseTestView(APIView):
    """Test endpoint to validate Firebase configuration"""
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        try:
            firebase_initialized = bool(firebase_admin._apps)
            return Response({
                'firebase_initialized': firebase_initialized,
                'project_id': os.environ.get('FIREBASE_PROJECT_ID', 'Not set'),
                'client_email': os.environ.get('FIREBASE_CLIENT_EMAIL', 'Not set'),
                'private_key_set': bool(os.environ.get('FIREBASE_PRIVATE_KEY', '')),
                'apps_count': len(firebase_admin._apps) if firebase_admin._apps else 0
            })
        except Exception as e:
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
        # Return more detailed error messages
        error_message = 'Failed to update profile.'
        if serializer.errors:
            # Extract the first error message for better UX
            for field, errors in serializer.errors.items():
                if errors:
                    error_message = f"{field}: {errors[0]}"
                    break
        return Response({'error': error_message, 'details': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

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
                    from django.utils import timezone
                    from datetime import timedelta
                    
                    user = User.objects.get(id=client_reference_id)
                    line_items = stripe.checkout.Session.list_line_items(session.id, limit=1)
                    price_id = line_items['data'][0]['price']['id']
                    plan_map = {v: k for k, v in stripe_price_ids.items()}
                    new_plan = plan_map.get(price_id)
                    if new_plan:
                        user.subscription_plan = new_plan
                        user.is_premium_user = True
                        user.stripe_customer_id = session.get('customer')
                        
                        # Set plan dates (30 days subscription)
                        user.plan_start_date = timezone.now()
                        user.plan_end_date = timezone.now() + timedelta(days=30)
                        
                        user.save()
                        Payment.objects.create(
                            user=user, stripe_charge_id=session.id,
                            amount=session.amount_total, status=session.payment_status,
                            plan=new_plan
                        )
                except User.DoesNotExist:
                    pass  # User with ID not found
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
        # Restrict alert creation to premium plans
        user = request.user
        user_plan = getattr(user, 'subscription_plan', 'free') or 'free'
        is_premium = getattr(user, 'is_premium_user', False) or user_plan in ['basic', 'enterprise']
        if not is_premium:
            return Response({'error': 'Alerts are a premium feature. Please upgrade your plan to create alerts.'}, status=status.HTTP_403_FORBIDDEN)
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
            
            # Pagination parameters for handling ALL symbols
            page = int(request.GET.get('page', 1))
            page_size = min(int(request.GET.get('page_size', 100)), 500)  # Allow up to 500 symbols
            offset = (page - 1) * page_size
            
            # Sorting parameters
            sort_by = request.GET.get('sort_by', 'profit')  # profit, volume, latest, price
            sort_order = request.GET.get('sort_order', 'desc')  # asc, desc
            
            # Build cache key with sorting
            cache_key = f'crypto_data_{user.subscription_plan}_page_{page}_size_{page_size}_sort_{sort_by}_{sort_order}'
            cached_data = cache.get(cache_key)
            
            if cached_data is None:
                # Get total count for pagination - OPTIMIZED: USDT pairs only
                total_count = CryptoData.objects.filter(
                    symbol__endswith='USDT',
                    last_price__isnull=False,
                    quote_volume_24h__gt=0
                ).count()
                
                # Determine sorting field
                sort_field = '-price_change_percent_24h'  # Default: Most profitable first
                if sort_by == 'volume':
                    sort_field = '-quote_volume_24h'
                elif sort_by == 'latest':
                    sort_field = '-id'  # Latest added symbols
                elif sort_by == 'price':
                    sort_field = '-last_price'
                elif sort_by == 'profit':
                    sort_field = '-price_change_percent_24h'
                
                # Apply sort order
                if sort_order == 'asc':
                    sort_field = sort_field.lstrip('-')
                
                # Get fresh data from database with pagination and sorting
                # OPTIMIZED: Only USDT pairs with active trading
                crypto_data = CryptoData.objects.filter(
                    symbol__endswith='USDT',
                    last_price__isnull=False,
                    quote_volume_24h__gt=0
                ).order_by(sort_field)[offset:offset + page_size]
                
                # Serialize based on user plan (no symbol count cap for any plan)
                if user.subscription_plan == 'enterprise':
                    serializer = CryptoDataSerializer(crypto_data, many=True)
                elif user.subscription_plan == 'basic':
                    serializer = CryptoDataBasicSerializer(crypto_data, many=True)
                else:  # free
                    serializer = CryptoDataFreeSerializer(crypto_data, many=True)
                
                # Prepare response with pagination info
                cached_data = {
                    'data': serializer.data,
                    'plan': user.subscription_plan,
                    'is_premium': user.is_premium_user or user.subscription_plan in ['basic', 'enterprise'],
                    'pagination': {
                        'current_page': page,
                        'page_size': page_size,
                        'total_count': total_count,
                        'total_pages': (total_count + page_size - 1) // page_size,
                        'has_next': offset + page_size < total_count,
                        'has_previous': page > 1
                    },
                    'sorting': {
                        'sort_by': sort_by,
                        'sort_order': sort_order,
                        'available_sorts': ['profit', 'volume', 'latest', 'price']
                    },
                    'last_updated': timezone.now().isoformat(),
                    'symbols_in_page': len(serializer.data)
                }
                
                # Cache for 30 seconds for real-time updates
                cache.set(cache_key, cached_data, 30)

            return Response(cached_data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error in BinanceDataView: {e}")
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

class HealthCheckView(APIView):
    """
    Health check endpoint for load balancer and monitoring
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        try:
            # Check database connectivity
            from django.db import connection
            cursor = connection.cursor()
            cursor.execute("SELECT 1")
            
            # Check Redis connectivity
            from django.core.cache import cache
            cache.set('health_check', 'ok', 10)
            cache_status = cache.get('health_check')
            
            # Check if we have crypto data
            # Health check data
            crypto_count = CryptoData.objects.filter(
                symbol__endswith='USDT'
            ).count()
            
            health_data = {
                'status': 'healthy',
                'timestamp': settings.TIME_ZONE,
                'database': 'connected',
                'cache': 'connected' if cache_status == 'ok' else 'disconnected',
                'crypto_symbols': crypto_count,
                'version': '1.0.0'
            }
            
            return Response(health_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return Response({
                'status': 'unhealthy',
                'error': str(e)
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

class MetricsView(APIView):
    """
    Metrics endpoint for monitoring and observability
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        try:
            from django.db import connection
            
            # Database metrics
            with connection.cursor() as cursor:
                # Total symbols
                cursor.execute("SELECT COUNT(*) FROM core_cryptodata")
                total_symbols = cursor.fetchone()[0]
                
                # Active users count
                cursor.execute("SELECT COUNT(*) FROM core_user WHERE is_active = true")
                active_users = cursor.fetchone()[0]
                
                # Premium users count
                cursor.execute("SELECT COUNT(*) FROM core_user WHERE is_premium_user = true")
                premium_users = cursor.fetchone()[0]
                
                # Recent alerts count
                cursor.execute("""
                    SELECT COUNT(*) FROM core_alert 
                    WHERE created_at > NOW() - INTERVAL '24 hours'
                """)
                recent_alerts = cursor.fetchone()[0]
            
            # Cache metrics
            cache_info = {
                'redis_connected': True
            }
            
            try:
                cache.set('metrics_test', 'ok', 5)
                cache.get('metrics_test')
            except Exception:
                cache_info['redis_connected'] = False
            
            metrics = {
                'timestamp': timezone.now().isoformat(),
                'database': {
                    'total_crypto_symbols': total_symbols,
                    'active_users': active_users,
                    'premium_users': premium_users,
                    'recent_alerts_24h': recent_alerts,
                },
                'cache': cache_info,
                'application': {
                    'version': '1.0.0',
                    'environment': 'development' if settings.DEBUG else 'production',
                }
            }
            
            return Response(metrics, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Metrics collection failed: {e}")
            return Response({
                'error': 'Failed to collect metrics',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CoinSymbolsView(APIView):
    """
    API endpoint to fetch all available coin symbols from the database.
    Returns a list of unique symbols for use in dropdowns and search.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            # Get all symbols from the database, ordered alphabetically
            # Using values_list to get only the symbol field for performance
            symbols = CryptoData.objects.filter(
                symbol__isnull=False
            ).values_list('symbol', flat=True).order_by('symbol')
            
            # Convert QuerySet to list
            symbol_list = list(symbols)
            
            return Response({
                'symbols': symbol_list,
                'count': len(symbol_list)
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Failed to fetch coin symbols: {e}")
            return Response({
                'error': 'Failed to fetch coin symbols',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)