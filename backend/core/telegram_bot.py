"""
Telegram Bot Integration for Crypto Alert System
Handles Telegram bot setup, user registration, and alert notifications
"""

import requests
import logging
import os
from typing import Optional, Dict, Any
from django.conf import settings
from django.core.cache import cache
from core.models import User
import secrets
import string
import html

logger = logging.getLogger(__name__)

class TelegramBot:
    """Telegram Bot handler for crypto alerts"""
    
    def __init__(self):
        # Get configuration from environment variables
        self.bot_token = os.getenv('TELEGRAM_BOT_TOKEN', settings.TELEGRAM_BOT_TOKEN if hasattr(settings, 'TELEGRAM_BOT_TOKEN') else '')
        self.bot_username = os.getenv('TELEGRAM_BOT_USERNAME', settings.TELEGRAM_BOT_USERNAME if hasattr(settings, 'TELEGRAM_BOT_USERNAME') else '')
        
        if not self.bot_token or not self.bot_username:
            logger.warning("Telegram bot token or username not configured - bot features will be disabled")
            self.enabled = False
            self.base_url = ""
        else:
            self.enabled = True
            self.base_url = f"https://api.telegram.org/bot{self.bot_token}"
            logger.info(f"Telegram bot initialized: @{self.bot_username}")
    
    def is_enabled(self) -> bool:
        """Check if bot is properly configured"""
        return self.enabled
    
    def sanitize_html(self, text: str) -> str:
        """Sanitize text for Telegram HTML parse mode - escape special chars but keep allowed HTML tags"""
        # Telegram HTML supports: <b>, <i>, <u>, <s>, <a>, <code>, <pre>
        # We need to escape &, <, > but preserve our intended HTML tags
        
        # First, temporarily replace our HTML tags with placeholders
        replacements = [
            ('<b>', '___BOLD_START___'),
            ('</b>', '___BOLD_END___'),
            ('<i>', '___ITALIC_START___'),
            ('</i>', '___ITALIC_END___'),
            ('<u>', '___UNDERLINE_START___'),
            ('</u>', '___UNDERLINE_END___'),
            ('<code>', '___CODE_START___'),
            ('</code>', '___CODE_END___'),
        ]
        
        result = text
        for tag, placeholder in replacements:
            result = result.replace(tag, placeholder)
        
        # Now escape special characters
        result = html.escape(result, quote=False)
        
        # Restore our HTML tags
        for tag, placeholder in replacements:
            result = result.replace(placeholder, tag)
        
        return result
        
    def send_message(self, chat_id: str, message: str, parse_mode: str = "HTML", reply_markup: dict = None) -> bool:
        """Send a message to a Telegram chat with optional inline keyboard"""
        try:
            if not self.is_enabled():
                logger.warning("Telegram bot not configured - cannot send message")
                return False
            
            # Sanitize message for HTML parse mode
            if parse_mode == "HTML":
                sanitized_message = self.sanitize_html(message)
            else:
                sanitized_message = message
                
            url = f"{self.base_url}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": sanitized_message,
                "parse_mode": parse_mode
            }
            
            # Add inline keyboard if provided
            if reply_markup:
                payload["reply_markup"] = reply_markup
            
            response = requests.post(url, json=payload, timeout=10)
            response.raise_for_status()
            logger.info(f"Message sent successfully to chat_id: {chat_id}")
            return True
        except requests.exceptions.HTTPError as e:
            logger.error(f"Failed to send message to {chat_id}: {e.response.status_code} - {e.response.text}")
            return False
        except Exception as e:
            logger.error(f"Failed to send message to {chat_id}: {str(e)}")
            return False
    
    def get_bot_info(self) -> Optional[Dict[str, Any]]:
        """Get bot information"""
        try:
            url = f"{self.base_url}/getMe"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to get bot info: {str(e)}")
            return None
    
    def set_webhook(self, webhook_url: str) -> bool:
        """Set webhook for the bot"""
        try:
            url = f"{self.base_url}/setWebhook"
            payload = {"url": webhook_url}
            response = requests.post(url, json=payload, timeout=10)
            response.raise_for_status()
            logger.info(f"Webhook set successfully: {webhook_url}")
            return True
        except Exception as e:
            logger.error(f"Failed to set webhook: {str(e)}")
            return False
    
    def generate_setup_token(self, user_email: str) -> str:
        """Generate a unique setup token for user verification"""
        token = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))
        cache.set(f"telegram_setup_{token}", user_email, timeout=900)  # 15 minutes
        return token
    
    def verify_setup_token(self, token: str) -> Optional[str]:
        """Verify setup token and return user email"""
        # First check cache
        user_email = cache.get(f"telegram_setup_{token}")
        if user_email:
            cache.delete(f"telegram_setup_{token}")
            return user_email
        
        # Fallback: Check database if token not in cache
        try:
            user = User.objects.get(telegram_setup_token=token)
            return user.email
        except User.DoesNotExist:
            return None
    
    def connect_user_telegram(self, user_email: str, chat_id: str, username: str = None) -> bool:
        """Connect user's Telegram account"""
        try:
            user = User.objects.get(email=user_email)
            user.telegram_chat_id = chat_id
            user.telegram_username = username
            user.telegram_connected = True
            user.telegram_setup_token = None
            user.save()
            
            # Send welcome message with modern design
            welcome_msg = f"""
🎉 <b>Welcome to Volume Tracker Bot!</b>

Hi <b>{user.first_name}</b>! I'm your personal crypto trading assistant. 🚀

✅ <b>Connection Successful!</b>
Your Telegram account has been connected to your Volume Tracker dashboard.

<b>What I can do for you:</b>

📊 <b>Real-Time Alerts</b>
• Price pump/dump notifications
• RSI overbought/oversold signals  
• Volume spike alerts
• Custom price targets

💎 <b>Your Subscription</b>
Plan: <b>{user.subscription_plan.title()}</b>
Status: <b>Active</b>

🤖 <b>Quick Commands</b>
/plan - View your subscription details
/upgrade - Upgrade to unlock more features
/status - Check your alert settings
/help - Get detailed help and support
/stop - Temporarily disable alerts

<b>Get Started:</b>
Set up your first alert from the dashboard to start receiving notifications!

Happy trading! 📈💰
"""
            self.send_message(chat_id, welcome_msg)
            logger.info(f"User {user_email} connected to Telegram chat_id: {chat_id}")
            return True
            
        except User.DoesNotExist:
            logger.error(f"User {user_email} not found")
            return False
        except Exception as e:
            logger.error(f"Failed to connect user {user_email}: {str(e)}")
            return False
    
    def send_alert(self, user: User, alert_message: str, symbol: str = None) -> bool:
        """Send alert message to user's Telegram with professional formatting"""
        if not user.telegram_connected or not user.telegram_chat_id:
            return False
        
        try:
            from datetime import datetime
            
            # Parse the alert message to extract details
            # Expected format: "BTCUSDT alert: pump_alert" or similar
            alert_parts = alert_message.split(':')
            
            if len(alert_parts) >= 2:
                symbol_part = alert_parts[0].strip()
                alert_type = alert_parts[1].strip()
                
                # Determine alert details based on type
                if 'pump' in alert_type:
                    emoji = "🚀"
                    action = "PUMP ALERT"
                    color_emoji = "🟢"
                    signal = "Bullish momentum detected! Strong buying pressure observed."
                    suggestion = "Consider reviewing your position or taking profits."
                elif 'dump' in alert_type:
                    emoji = "🔻"
                    action = "DUMP ALERT"
                    color_emoji = "🔴"
                    signal = "Bearish momentum detected! Significant selling pressure."
                    suggestion = "Consider implementing stop-loss or risk management."
                elif 'movement' in alert_type:
                    emoji = "⚡"
                    action = "PRICE MOVEMENT ALERT"
                    color_emoji = "🟡"
                    signal = "Significant price movement detected."
                    suggestion = "Monitor the market closely for further action."
                elif 'volume' in alert_type:
                    emoji = "📊"
                    action = "VOLUME ALERT"
                    color_emoji = "🔵"
                    signal = "Unusual trading volume detected."
                    suggestion = "Increased market interest - potential breakout incoming."
                elif 'rsi_overbought' in alert_type:
                    emoji = "🔥"
                    action = "RSI OVERBOUGHT"
                    color_emoji = "🔴"
                    signal = "RSI indicates overbought conditions."
                    suggestion = "Potential price reversal or consolidation ahead."
                elif 'rsi_oversold' in alert_type:
                    emoji = "❄️"
                    action = "RSI OVERSOLD"
                    color_emoji = "�"
                    signal = "RSI indicates oversold conditions."
                    suggestion = "Potential buying opportunity - watch for reversal."
                else:
                    emoji = "🎯"
                    action = "CRYPTO ALERT"
                    color_emoji = "⚪"
                    signal = "Your custom alert has been triggered."
                    suggestion = "Review your trading strategy and market conditions."
            else:
                # Fallback for unexpected format
                symbol_part = symbol or "Unknown"
                alert_type = alert_message
                emoji = "🎯"
                action = "CRYPTO ALERT"
                color_emoji = "⚪"
                signal = "Alert triggered"
                suggestion = "Review the details and take appropriate action."
            
            # Current time
            current_time = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')
            
            # Format the professional message
            formatted_message = f"""
{emoji} <b>{action}</b> {emoji}

<b>Symbol:</b> {symbol_part}
<b>Alert Type:</b> {alert_type}

{color_emoji} <b>Signal:</b> {signal}
💡 <b>Suggestion:</b> {suggestion}

⏰ <b>Time:</b> {current_time}

<i>🚀 Real-time crypto alerts by Volume Tracker Bot</i>
"""
            
            return self.send_message(user.telegram_chat_id, formatted_message)
            
        except Exception as e:
            logger.error(f"Failed to send alert to user {user.email}: {str(e)}")
            return False
    
    def send_price_alert(self, user: User, symbol: str, current_price: float, 
                        alert_type: str, threshold: float = None, 
                        percentage_change: float = None, time_period: str = None) -> bool:
        """Send price-specific alert with professional formatting"""
        if not user.telegram_connected or not user.telegram_chat_id:
            return False
            
        try:
            from datetime import datetime
            
            # Determine alert details based on type
            if 'pump' in alert_type:
                emoji = "🚀"
                action = "PUMP ALERT"
                color_emoji = "🟢"
                change_text = f"{color_emoji} <b>Price Change:</b> +{abs(percentage_change):.2f}%" if percentage_change else ""
                signal = "Bullish momentum detected! Strong buying pressure observed."
                suggestion = "Consider reviewing your position or taking profits."
            elif 'dump' in alert_type:
                emoji = "🔻"
                action = "DUMP ALERT"
                color_emoji = "🔴"
                change_text = f"{color_emoji} <b>Price Change:</b> {percentage_change:.2f}%" if percentage_change else ""
                signal = "Bearish momentum detected! Significant selling pressure."
                suggestion = "Consider implementing stop-loss or risk management."
            elif 'movement' in alert_type:
                emoji = "⚡"
                action = "PRICE MOVEMENT"
                color_emoji = "🟡"
                change_text = f"{color_emoji} <b>Price Change:</b> {percentage_change:+.2f}%" if percentage_change else ""
                signal = "Significant price movement detected."
                suggestion = "Monitor the market closely for further action."
            elif 'volume' in alert_type:
                emoji = "📊"
                action = "VOLUME ALERT"
                color_emoji = "🔵"
                change_text = f"{color_emoji} <b>Volume Change:</b> +{abs(percentage_change):.2f}%" if percentage_change else ""
                signal = "Unusual trading volume detected."
                suggestion = "Increased market interest - potential breakout incoming."
            else:
                emoji = "🎯"
                action = "PRICE ALERT"
                color_emoji = "🔵"
                change_text = f"<b>Target:</b> ${threshold:.4f}" if threshold else ""
                signal = "Price target reached."
                suggestion = "Review your trading strategy and market conditions."
            
            # Format time period
            time_text = f" in {time_period}" if time_period else ""
            
            # Current time
            current_time = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')
            
            message = f"""
{emoji} <b>{action}</b> {emoji}

<b>Symbol:</b> {symbol}
<b>Current Price:</b> <code>${current_price:.8f}</code>
{change_text}{time_text}

📊 <b>Signal:</b> {signal}
💡 <b>Suggestion:</b> {suggestion}
⏰ <b>Time:</b> {current_time}

<i>📊 Real-time crypto alerts by Volume Tracker Bot</i>
"""
            
            return self.send_message(user.telegram_chat_id, message.strip())
            
        except Exception as e:
            logger.error(f"Failed to send price alert: {str(e)}")
            return False
    
    def send_rsi_alert(self, user: User, symbol: str, current_price: float, 
                      rsi_value: float, condition: str) -> bool:
        """Send RSI-specific alert with professional formatting"""
        if not user.telegram_connected or not user.telegram_chat_id:
            return False
            
        try:
            from datetime import datetime
            
            if condition == "overbought":
                emoji = "🔥"
                status = "OVERBOUGHT"
                color_emoji = "🔴"
                description = "Consider taking profits"
                signal = "Potential reversal or consolidation"
            else:
                emoji = "❄️"
                status = "OVERSOLD"
                color_emoji = "🟢"
                description = "Potential buying opportunity"
                signal = "Possible bounce or recovery"
            
            current_time = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')
            
            message = f"""
{emoji} <b>RSI {status} ALERT</b> {emoji}

<b>Symbol:</b> {symbol}
<b>Current Price:</b> <code>${current_price:.8f}</code>
{color_emoji} <b>RSI Value:</b> <code>{rsi_value:.2f}</code>

📊 <b>Analysis:</b> {signal}
💡 <b>Suggestion:</b> {description}
⏰ <b>Time:</b> {current_time}

<i>📈 Technical analysis by Volume Tracker Bot</i>
"""
            
            return self.send_message(user.telegram_chat_id, message.strip())
            
        except Exception as e:
            logger.error(f"Failed to send RSI alert: {str(e)}")
            return False
    
    def handle_webhook_update(self, update_data: Dict[str, Any]) -> bool:
        """Handle incoming webhook updates from Telegram"""
        try:
            # Handle callback queries (button clicks)
            if 'callback_query' in update_data:
                return self.handle_callback_query(update_data['callback_query'])
            
            if "message" not in update_data:
                return False
            
            message = update_data["message"]
            chat_id = str(message["chat"]["id"])
            text = message.get("text", "")
            username = message["from"].get("username")
            first_name = message["from"].get("first_name", "User")
            
            # If no text, handle non-text messages
            if not text:
                self.send_message(
                    chat_id,
                    "👋 I can only process text messages right now.\n\n"
                    "Try typing /help to see what I can do!"
                )
                return True
            
            # Handle /start command with setup token
            if text.startswith("/start"):
                parts = text.split()
                if len(parts) > 1:
                    # User provided a setup token
                    token = parts[1]
                    user_email = self.verify_setup_token(token)
                    
                    if user_email:
                        # Valid token - connect the user
                        success = self.connect_user_telegram(user_email, chat_id, username)
                        if not success:
                            # Connection failed - send error message
                            self.send_message(chat_id, "❌ Failed to connect your account. Please try again.")
                        # If success, connect_user_telegram already sent the welcome message
                        return success
                    else:
                        # Invalid or expired token
                        self.send_message(chat_id, "❌ Invalid or expired setup token. Please generate a new one from the dashboard.")
                        return False
                else:
                    # No token provided - show welcome message with buttons
                    welcome_msg = """
👋 <b>Welcome to Volume Tracker Bot!</b>

Hi! I'm your personal crypto trading assistant. 🚀

<b>What I can do for you:</b>

📊 <b>Real-Time Alerts</b>
• Price pump/dump notifications
• RSI overbought/oversold signals
• Volume spike alerts
• Custom price targets

💎 <b>Subscription Plans</b>
• Free - 3 alerts, email only
• Basic - 10 alerts, Telegram + RSI
• Enterprise - Unlimited, all features

🤖 <b>Quick Commands</b>
• /plan - View your subscription
• /upgrade - Upgrade your plan
• /status - Check alert settings
• /help - Get detailed help

<b>Get Started:</b>
Connect your account to start receiving alerts!
"""
                    
                    # Create inline keyboard with buttons
                    keyboard = {
                        "inline_keyboard": [
                            [
                                {"text": "💎 View My Plan", "callback_data": "view_plan"},
                                {"text": "📊 Check Status", "callback_data": "check_status"}
                            ],
                            [
                                {"text": "💰 Upgrade Plan", "callback_data": "upgrade_plan"},
                                {"text": "❓ Get Help", "callback_data": "get_help"}
                            ],
                            [
                                {"text": "ℹ️ View All Commands", "callback_data": "all_commands"}
                            ]
                        ]
                    }
                    
                    self.send_message(chat_id, welcome_msg, reply_markup=keyboard)
                    return True
            
            # Handle other commands
            elif text == "/status":
                self.handle_status_command(chat_id)
            elif text == "/help":
                self.handle_help_command(chat_id)
            elif text == "/stop":
                self.handle_stop_command(chat_id)
            elif text == "/plan":
                self.handle_plan_command(chat_id)
            elif text == "/upgrade":
                self.handle_upgrade_command(chat_id)
            else:
                # User sent a regular message (not a command)
                # Respond with helpful information
                help_msg = """
👋 <b>Hi there!</b>

I'm Volume Tracker Bot, your crypto trading assistant! 🚀

I understand commands like:
• /start - Connect your account
• /plan - View your subscription
• /status - Check your alerts
• /upgrade - Upgrade your plan
• /help - Get detailed help

<b>Choose an action below:</b>
"""
                
                # Create inline keyboard with quick actions
                keyboard = {
                    "inline_keyboard": [
                        [
                            {"text": "💎 View My Plan", "callback_data": "view_plan"},
                            {"text": "📊 Check Status", "callback_data": "check_status"}
                        ],
                        [
                            {"text": "❓ Get Help", "callback_data": "get_help"},
                            {"text": "ℹ️ All Commands", "callback_data": "all_commands"}
                        ]
                    ]
                }
                
                self.send_message(chat_id, help_msg, reply_markup=keyboard)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to handle webhook update: {str(e)}")
            return False
    
    def handle_callback_query(self, callback_query: Dict[str, Any]) -> bool:
        """Handle button clicks from inline keyboards"""
        try:
            query_id = callback_query['id']
            chat_id = str(callback_query['message']['chat']['id'])
            callback_data = callback_query['data']
            
            # Answer the callback query (removes loading state from button)
            self.answer_callback_query(query_id)
            
            # Check if user is connected for actions that require it
            user_connected = User.objects.filter(telegram_chat_id=chat_id).exists()
            
            # Handle different button actions
            if callback_data == "view_plan":
                if user_connected:
                    self.handle_plan_command(chat_id)
                else:
                    self.send_not_connected_message(chat_id)
            elif callback_data == "check_status":
                if user_connected:
                    self.handle_status_command(chat_id)
                else:
                    self.send_not_connected_message(chat_id)
            elif callback_data == "upgrade_plan":
                if user_connected:
                    self.handle_upgrade_command(chat_id)
                else:
                    self.send_not_connected_message(chat_id)
            elif callback_data == "get_help":
                self.handle_help_command(chat_id)
            elif callback_data == "all_commands":
                commands_msg = """
📋 <b>All Available Commands</b>

<b>Getting Started:</b>
• /start - Connect your account
• /help - Get detailed help

<b>Account Management:</b>
• /plan - View subscription details
• /status - Check alert settings
• /upgrade - Upgrade your plan

<b>Alert Control:</b>
• /stop - Pause all alerts

<b>Need more help?</b>
Visit your dashboard to manage alerts and settings!
"""
                self.send_message(chat_id, commands_msg)
            else:
                self.send_message(chat_id, "❌ Unknown button action")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to handle callback query: {str(e)}")
            return False
    
    def send_not_connected_message(self, chat_id: str):
        """Send a message when user tries to use features without being connected"""
        from django.conf import settings
        import os
        frontend_url = os.getenv('FRONTEND_URL', settings.FRONTEND_URL if hasattr(settings, 'FRONTEND_URL') else 'http://localhost:3000')
        
        msg = f"""
🔐 <b>Account Not Connected</b>

To use this feature, you need to connect your Telegram account first!

<b>How to connect:</b>
1. Go to your dashboard: {frontend_url}
2. Navigate to <b>Alert Settings</b>
3. Click <b>"Connect Telegram"</b>
4. Copy the setup command
5. Paste it here in Telegram

<b>Or send /start with your setup token:</b>
<code>/start YOUR_TOKEN_HERE</code>

<i>Once connected, you'll have full access to all features!</i>
"""
        
        # Add button to try again
        keyboard = {
            "inline_keyboard": [
                [
                    {"text": "❓ Get Help", "callback_data": "get_help"},
                    {"text": "ℹ️ All Commands", "callback_data": "all_commands"}
                ]
            ]
        }
        
        self.send_message(chat_id, msg, reply_markup=keyboard)
    
    def answer_callback_query(self, query_id: str, text: str = None):
        """Answer a callback query to remove loading state"""
        try:
            url = f"https://api.telegram.org/bot{self.bot_token}/answerCallbackQuery"
            payload = {"callback_query_id": query_id}
            if text:
                payload["text"] = text
            
            response = requests.post(url, json=payload, timeout=5)
            result = response.json()
            if result.get("ok"):
                logger.info(f"Callback query answered successfully")
                return True
            else:
                logger.warning(f"Failed to answer callback query: {result.get('description', 'Unknown error')}")
                return False
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error answering callback query: {str(e)}")
            # Don't fail the whole operation if we can't answer the callback
            return False
        except Exception as e:
            logger.error(f"Failed to answer callback query: {str(e)}")
            return False
    
    def handle_status_command(self, chat_id: str):
        """Handle /status command with modern design"""
        try:
            user = User.objects.get(telegram_chat_id=chat_id)
            
            # Get active alerts count
            from .models import Alert
            active_alerts = Alert.objects.filter(user=user, is_active=True).count()
            total_alerts = Alert.objects.filter(user=user).count()
            
            status_msg = f"""
📊 <b>Your Alert Status</b>

👤 <b>Account Information</b>
Name: <b>{user.first_name} {user.last_name}</b>
Email: <code>{user.email}</code>
🔔 Telegram: <b>✅ Connected</b>

💎 <b>Subscription Plan</b>
Current Plan: <b>{user.subscription_plan.title()}</b>
Status: <b>🟢 Active</b>

📈 <b>Alert Statistics</b>
• Active Alerts: <b>{active_alerts}</b>
• Total Alerts: <b>{total_alerts}</b>
• Price Alerts: <b>✅ Enabled</b>
• RSI Signals: <b>✅ Enabled</b>
• Volume Alerts: <b>✅ Enabled</b>

<b>Quick Actions:</b>
• Use /plan to view plan details
• Use /upgrade to unlock more features
• Use /help for more commands

<i>Manage your alerts from the dashboard!</i>
"""
            
            # Add quick action buttons
            keyboard = {
                "inline_keyboard": [
                    [
                        {"text": "💎 View Plan", "callback_data": "view_plan"},
                        {"text": "💰 Upgrade", "callback_data": "upgrade_plan"}
                    ],
                    [
                        {"text": "❓ Get Help", "callback_data": "get_help"}
                    ]
                ]
            }
            
            self.send_message(chat_id, status_msg, reply_markup=keyboard)
        except User.DoesNotExist:
            self.send_message(chat_id, "❌ Account not found. Please connect your account first.")
    
    def handle_plan_command(self, chat_id: str):
        """Handle /plan command to show subscription details"""
        try:
            user = User.objects.get(telegram_chat_id=chat_id)
            
            # Plan features based on subscription
            if user.subscription_plan == 'free':
                plan_emoji = "🆓"
                features = """
• <b>3 alerts</b> maximum
• <b>Email</b> notifications only
• Basic price alerts
• Community support
"""
                upgrade_msg = "\n💡 <i>Upgrade to Basic or Enterprise for more features!</i>"
            elif user.subscription_plan == 'basic':
                plan_emoji = "💎"
                features = """
• <b>10 alerts</b> maximum
• <b>Telegram</b> + Email notifications
• Price & RSI alerts
• Volume spike detection
• Priority support
"""
                upgrade_msg = "\n💡 <i>Upgrade to Enterprise for unlimited alerts!</i>"
            else:  # enterprise
                plan_emoji = "👑"
                features = """
• <b>Unlimited alerts</b>
• <b>All notification channels</b>
• Advanced technical indicators
• Custom price targets
• Volume analysis
• VIP support
• Early access to new features
"""
                upgrade_msg = "\n🎉 <i>You have the best plan!</i>"
            
            plan_msg = f"""
{plan_emoji} <b>Your Subscription Plan</b>

<b>Current Plan:</b> {user.subscription_plan.title()}
<b>Status:</b> 🟢 Active

<b>Features Included:</b>
{features}
{upgrade_msg}

<b>Want to upgrade?</b>
• Use /upgrade to see available plans
• Visit your dashboard for detailed pricing

<i>Questions? Contact support anytime!</i>
"""
            
            # Add action buttons
            keyboard = {
                "inline_keyboard": [
                    [
                        {"text": "💰 Upgrade Plan", "callback_data": "upgrade_plan"},
                        {"text": "📊 Check Status", "callback_data": "check_status"}
                    ],
                    [
                        {"text": "❓ Get Help", "callback_data": "get_help"}
                    ]
                ]
            }
            
            self.send_message(chat_id, plan_msg, reply_markup=keyboard)
        except User.DoesNotExist:
            self.send_message(chat_id, "❌ Account not found. Please connect your account first.")
    
    def handle_upgrade_command(self, chat_id: str):
        """Handle /upgrade command to show upgrade options"""
        try:
            user = User.objects.get(telegram_chat_id=chat_id)
            
            # Get backend URL from settings
            from django.conf import settings
            import os
            backend_url = os.getenv('BACKEND_URL', settings.BACKEND_URL if hasattr(settings, 'BACKEND_URL') else 'http://localhost:8080')
            frontend_url = os.getenv('FRONTEND_URL', settings.FRONTEND_URL if hasattr(settings, 'FRONTEND_URL') else 'http://localhost:3000')
            
            current_plan = user.subscription_plan
            
            if current_plan == 'enterprise':
                upgrade_msg = f"""
👑 <b>You're on the Best Plan!</b>

You already have the <b>Enterprise</b> plan with all features unlocked!

<b>What you get:</b>
✅ Unlimited alerts
✅ All notification channels
✅ Advanced indicators
✅ Priority VIP support
✅ Early access to features

Thank you for being a premium member! 🎉

<i>Need help? We're here 24/7!</i>
"""
            else:
                upgrade_msg = f"""
🚀 <b>Upgrade Your Plan</b>

<b>Current Plan:</b> {current_plan.title()}

<b>Available Plans:</b>

"""
                if current_plan != 'basic':
                    upgrade_msg += """
💎 <b>Basic Plan</b> - $9.99/month
• 10 alerts maximum
• Telegram + Email notifications
• RSI signals
• Volume alerts
• Priority support

"""
                
                if current_plan != 'enterprise':
                    upgrade_msg += """
👑 <b>Enterprise Plan</b> - $29.99/month
• Unlimited alerts
• All notification channels
• Advanced technical analysis
• Custom indicators
• VIP support
• Early feature access

"""
                
                upgrade_msg += f"""
<b>How to Upgrade:</b>
1. Visit your dashboard
2. Go to "Upgrade Plan" section
3. Choose your preferred plan
4. Complete secure payment

🔗 <b>Upgrade Now:</b>
{frontend_url}/upgrade-plan

<i>Questions about plans? Contact support!</i>
"""
            
            # Add action buttons
            if current_plan == 'enterprise':
                keyboard = {
                    "inline_keyboard": [
                        [
                            {"text": "📊 Check Status", "callback_data": "check_status"},
                            {"text": "❓ Get Help", "callback_data": "get_help"}
                        ]
                    ]
                }
            else:
                keyboard = {
                    "inline_keyboard": [
                        [
                            {"text": "💎 View My Plan", "callback_data": "view_plan"},
                            {"text": "📊 Check Status", "callback_data": "check_status"}
                        ],
                        [
                            {"text": "❓ Get Help", "callback_data": "get_help"}
                        ]
                    ]
                }
            
            self.send_message(chat_id, upgrade_msg, reply_markup=keyboard)
        except User.DoesNotExist:
            self.send_message(chat_id, "❌ Account not found. Please connect your account first.")
    
    def handle_help_command(self, chat_id: str):
        """Handle /help command with modern design"""
        help_msg = """
🤖 <b>Volume Tracker Bot Help Center</b>

<b>📱 Available Commands:</b>

/plan - View your subscription details
/upgrade - Upgrade to unlock more features
/status - Check your alert settings
/help - Show this help message
/stop - Temporarily disable alerts

<b>📊 Alert Types You'll Receive:</b>

🚀 <b>Pump Alerts</b> - Significant price increases
🔻 <b>Dump Alerts</b> - Significant price decreases
� <b>RSI Overbought</b> - RSI > 70 (potential reversal)
💎 <b>RSI Oversold</b> - RSI < 30 (buying opportunity)
📊 <b>Volume Spikes</b> - Unusual trading volume
🎯 <b>Price Targets</b> - Custom price level alerts

<b>💎 Subscription Plans:</b>

🆓 Free - 3 alerts, email only
💎 Basic - 10 alerts, Telegram + RSI
👑 Enterprise - Unlimited, all features

<b>🔧 Managing Alerts:</b>
• Create alerts from your dashboard
• Customize notification preferences
• Set custom price targets
• Choose alert timeframes

<b>Need Support?</b>
📧 Email: support@volumetracker.com
🌐 Dashboard: Manage your account
💬 Help: We're here 24/7!

<i>Happy trading! 📈</i>
"""
        
        # Add quick action buttons
        keyboard = {
            "inline_keyboard": [
                [
                    {"text": "💎 View My Plan", "callback_data": "view_plan"},
                    {"text": "📊 Check Status", "callback_data": "check_status"}
                ],
                [
                    {"text": "💰 Upgrade Plan", "callback_data": "upgrade_plan"},
                    {"text": "ℹ️ All Commands", "callback_data": "all_commands"}
                ]
            ]
        }
        
        self.send_message(chat_id, help_msg, reply_markup=keyboard)
    
    def handle_stop_command(self, chat_id: str):
        """Handle /stop command with modern design"""
        try:
            user = User.objects.get(telegram_chat_id=chat_id)
            user.telegram_connected = False
            user.save()
            
            stop_msg = f"""
⏸️ <b>Alerts Paused</b>

Hi <b>{user.first_name}</b>, your Telegram alerts have been temporarily disabled.

<b>What happens now:</b>
• You won't receive Telegram notifications
• Your alerts are still active in the dashboard
• Email notifications (if enabled) continue working
• Your account remains connected

<b>To re-enable Telegram alerts:</b>
1. Go to your dashboard
2. Navigate to Alert Settings
3. Click "Enable Telegram Alerts"
4. Or send /start again

We'll miss sending you crypto updates! 📊

<i>Questions? Contact support anytime!</i>
"""
            self.send_message(chat_id, stop_msg)
        except User.DoesNotExist:
            self.send_message(chat_id, "❌ Account not found.")

# Global bot instance
telegram_bot = TelegramBot()