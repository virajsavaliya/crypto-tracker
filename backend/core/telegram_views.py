"""
Telegram Webhook and Views for Volume Tracker Bot
Handles Telegram bot webhook endpoints and alert system integration
"""

from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils.decorators import method_decorator
from django.views import View
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .telegram_bot import telegram_bot
from .models import User, Alert
import json
import logging

logger = logging.getLogger(__name__)

@csrf_exempt
@require_http_methods(["POST"])
def telegram_webhook(request):
    """
    Handle incoming Telegram webhook updates
    """
    try:
        if request.content_type != 'application/json':
            return HttpResponse('Invalid content type', status=400)
        
        update_data = json.loads(request.body)
        
        # Process the update
        success = telegram_bot.handle_webhook_update(update_data)
        
        if success:
            return JsonResponse({'status': 'ok'})
        else:
            return JsonResponse({'status': 'error'}, status=400)
            
    except json.JSONDecodeError:
        logger.error("Invalid JSON in webhook request")
        return HttpResponse('Invalid JSON', status=400)
    except Exception as e:
        logger.error(f"Webhook processing error: {str(e)}")
        return HttpResponse('Internal error', status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_telegram_setup_token(request):
    """
    Generate a setup token for Telegram integration
    """
    try:
        user = request.user
        # Premium gating: Only premium users can connect Telegram
        plan = getattr(user, 'subscription_plan', 'free') or 'free'
        is_premium = getattr(user, 'is_premium_user', False) or plan in ['basic', 'enterprise']
        if not is_premium:
            return Response({
                'success': False,
                'error': 'Telegram integration is a premium feature. Please upgrade your plan.'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Generate setup token
        setup_token = telegram_bot.generate_setup_token(user.email)
        
        # Save token to user model for tracking
        user.telegram_setup_token = setup_token
        user.save()
        
        # Check if bot is properly configured
        if not telegram_bot.is_enabled():
            return Response({
                'success': False,
                'error': 'Telegram bot is not configured. Please contact support.'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        
        if not telegram_bot.bot_username:
            return Response({
                'success': False,
                'error': 'Bot username not configured. Please contact support.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Create bot link
        bot_link = f"https://t.me/{telegram_bot.bot_username}?start={setup_token}"
        
        return Response({
            'success': True,
            'setup_token': setup_token,
            'bot_link': bot_link,
            'bot_username': telegram_bot.bot_username,
            'instructions': [
                'Click the bot link above',
                'Press "Start" in Telegram',
                'Your account will be automatically connected',
                'You will receive a confirmation message'
            ]
        })
        
    except Exception as e:
        logger.error(f"Failed to generate Telegram setup token: {str(e)}")
        return Response({
            'success': False,
            'error': 'Failed to generate setup token'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def telegram_connection_status(request):
    """
    Check Telegram connection status for the user
    """
    try:
        user = request.user
        
        return Response({
            'connected': user.telegram_connected,
            'chat_id': user.telegram_chat_id if user.telegram_connected else None,
            'username': user.telegram_username if user.telegram_connected else None,
            'bot_username': telegram_bot.bot_username
        })
        
    except Exception as e:
        logger.error(f"Failed to check Telegram status: {str(e)}")
        return Response({
            'error': 'Failed to check connection status'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def disconnect_telegram(request):
    """
    Disconnect user's Telegram account
    """
    try:
        user = request.user
        
        # Send goodbye message if connected
        if user.telegram_connected and user.telegram_chat_id:
            goodbye_msg = """
👋 <b>Telegram Disconnected</b>

Your Telegram account has been disconnected from Volume Tracker Bot.

You will no longer receive alerts via Telegram.

To reconnect, go to your dashboard and click "Connect Telegram".

Thank you for using Volume Tracker!
"""
            telegram_bot.send_message(user.telegram_chat_id, goodbye_msg)
        
        # Clear Telegram data
        user.telegram_chat_id = None
        user.telegram_username = None
        user.telegram_connected = False
        user.telegram_setup_token = None
        user.save()
        
        return Response({
            'success': True,
            'message': 'Telegram account disconnected successfully'
        })
        
    except Exception as e:
        logger.error(f"Failed to disconnect Telegram: {str(e)}")
        return Response({
            'success': False,
            'error': 'Failed to disconnect Telegram'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def test_telegram_alert(request):
    """
    Send a test alert to user's Telegram
    """
    try:
        user = request.user
        # Premium gating
        plan = getattr(user, 'subscription_plan', 'free') or 'free'
        is_premium = getattr(user, 'is_premium_user', False) or plan in ['basic', 'enterprise']
        if not is_premium:
            return Response({
                'success': False,
                'error': 'Telegram alerts are a premium feature. Please upgrade your plan.'
            }, status=status.HTTP_403_FORBIDDEN)
        
        if not user.telegram_connected:
            return Response({
                'success': False,
                'error': 'Telegram not connected'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Send test alert
        test_message = """
🧪 <b>Test Alert</b>

This is a test message from Volume Tracker Bot!

✅ Your Telegram alerts are working correctly.

You will receive real-time notifications for:
• Price pump/dump alerts
• RSI overbought/oversold signals
• Volume spike alerts
• Custom price targets

<i>Test completed successfully!</i>
"""
        
        success = telegram_bot.send_message(user.telegram_chat_id, test_message)
        
        if success:
            return Response({
                'success': True,
                'message': 'Test alert sent successfully'
            })
        else:
            return Response({
                'success': False,
                'error': 'Failed to send test alert'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    except Exception as e:
        logger.error(f"Failed to send test alert: {str(e)}")
        return Response({
            'success': False,
            'error': 'Failed to send test alert'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_alert_settings(request):
    """
    Get user's alert settings
    """
    try:
        user = request.user
        # Premium gating info in response (non-blocking for settings read)
        plan = getattr(user, 'subscription_plan', 'free') or 'free'
        is_premium = getattr(user, 'is_premium_user', False) or plan in ['basic', 'enterprise']

        # Get user's alerts
        alerts = Alert.objects.filter(user=user).values(
            'id', 'symbol', 'alert_type', 'threshold', 'condition',
            'timeframe', 'notification_channels', 'is_active',
            'trigger_count', 'created_at'
        )
        
        return Response({
            'alerts': list(alerts),
            'telegram_connected': user.telegram_connected,
            'is_premium': is_premium,
            'total_alerts': alerts.count(),
            'active_alerts': alerts.filter(is_active=True).count()
        })
        
    except Exception as e:
        logger.error(f"Failed to get alert settings: {str(e)}")
        return Response({
            'error': 'Failed to get alert settings'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_alert(request):
    """
    Create a new alert for the user
    """
    try:
        user = request.user
        # Premium gating: only premium users can create alerts
        plan = getattr(user, 'subscription_plan', 'free') or 'free'
        is_premium = getattr(user, 'is_premium_user', False) or plan in ['basic', 'enterprise']
        if not is_premium:
            return Response({
                'success': False,
                'error': 'Alerts are a premium feature. Please upgrade your plan to create alerts.'
            }, status=status.HTTP_403_FORBIDDEN)
        data = request.data
        
        # Validate required fields
        required_fields = ['symbol', 'alert_type', 'threshold']
        for field in required_fields:
            if field not in data:
                return Response({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create the alert
        alert = Alert.objects.create(
            user=user,
            symbol=data['symbol'].upper(),
            alert_type=data['alert_type'],
            threshold=float(data['threshold']),
            condition=data.get('condition', 'above'),
            timeframe=data.get('timeframe', '15m'),
            notification_channels=data.get('notification_channels', ['email']),
            is_active=data.get('is_active', True)
        )
        
        return Response({
            'success': True,
            'alert_id': alert.id,
            'message': 'Alert created successfully'
        })
        
    except ValueError as e:
        return Response({
            'success': False,
            'error': 'Invalid threshold value'
        }, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Failed to create alert: {str(e)}")
        return Response({
            'success': False,
            'error': 'Failed to create alert'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_alert(request, alert_id):
    """
    Delete an alert
    """
    try:
        user = request.user
        plan = getattr(user, 'subscription_plan', 'free') or 'free'
        is_premium = getattr(user, 'is_premium_user', False) or plan in ['basic', 'enterprise']
        if not is_premium:
            return Response({
                'success': False,
                'error': 'Alerts are a premium feature. Please upgrade your plan.'
            }, status=status.HTTP_403_FORBIDDEN)
        
        alert = Alert.objects.get(id=alert_id, user=user)
        alert.delete()
        
        return Response({
            'success': True,
            'message': 'Alert deleted successfully'
        })
        
    except Alert.DoesNotExist:
        return Response({
            'success': False,
            'error': 'Alert not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Failed to delete alert: {str(e)}")
        return Response({
            'success': False,
            'error': 'Failed to delete alert'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_alert(request, alert_id):
    """
    Update an existing alert
    """
    try:
        user = request.user
        plan = getattr(user, 'subscription_plan', 'free') or 'free'
        is_premium = getattr(user, 'is_premium_user', False) or plan in ['basic', 'enterprise']
        if not is_premium:
            return Response({
                'success': False,
                'error': 'Alerts are a premium feature. Please upgrade your plan.'
            }, status=status.HTTP_403_FORBIDDEN)
        alert = Alert.objects.get(id=alert_id, user=user)
        
        # Update fields if provided
        if 'coin_symbol' in request.data:
            alert.coin_symbol = request.data['coin_symbol']
        if 'alert_type' in request.data:
            alert.alert_type = request.data['alert_type']
        if 'condition_value' in request.data:
            alert.condition_value = request.data['condition_value']
        if 'time_period' in request.data:
            alert.time_period = request.data['time_period']
        if 'notification_channels' in request.data:
            alert.notification_channels = request.data['notification_channels']
        if 'any_coin' in request.data:
            alert.any_coin = request.data['any_coin']
        
        alert.save()
        
        return Response({
            'success': True,
            'message': 'Alert updated successfully',
            'alert': {
                'id': alert.id,
                'alert_type': alert.alert_type,
                'coin_symbol': alert.coin_symbol,
                'condition_value': alert.condition_value,
                'time_period': alert.time_period,
                'notification_channels': alert.notification_channels,
                'any_coin': alert.any_coin,
                'is_active': alert.is_active,
            }
        })
        
    except Alert.DoesNotExist:
        return Response({
            'success': False,
            'error': 'Alert not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Failed to update alert: {str(e)}")
        return Response({
            'success': False,
            'error': f'Failed to update alert: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def telegram_bot_info(request):
    """
    Get public bot information (no authentication required)
    """
    try:
        bot_info = telegram_bot.get_bot_info()
        
        if bot_info and bot_info.get('ok'):
            bot_data = bot_info['result']
            return Response({
                'success': True,
                'bot_username': bot_data.get('username'),
                'bot_name': bot_data.get('first_name'),
                'is_online': True
            })
        else:
            return Response({
                'success': False,
                'error': 'Bot is offline'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        
    except Exception as e:
        logger.error(f"Failed to get bot info: {str(e)}")
        return Response({
            'success': False,
            'error': 'Failed to get bot information'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)