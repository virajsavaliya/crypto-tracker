"""
Django management command to start the Telegram alert monitoring system
"""

from django.core.management.base import BaseCommand
from core.tasks import comprehensive_alert_monitoring_task
from core.telegram_bot import telegram_bot
import logging
import time

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Start the Telegram alert monitoring system'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--interval',
            type=int,
            default=60,
            help='Monitoring interval in seconds (default: 60)'
        )
        parser.add_argument(
            '--setup-webhook',
            action='store_true',
            help='Setup Telegram webhook URL'
        )
        
    def handle(self, *args, **options):
        interval = options['interval']
        setup_webhook = options['setup_webhook']
        
        self.stdout.write(
            self.style.SUCCESS(f'🚀 Starting Telegram Alert Monitoring System')
        )
        
        # Setup webhook if requested
        if setup_webhook:
            self.setup_telegram_webhook()
        
        # Test bot connection
        self.test_bot_connection()
        
        # Start monitoring loop
        self.start_monitoring_loop(interval)
    
    def setup_telegram_webhook(self):
        """Setup Telegram webhook URL"""
        try:
            webhook_url = "https://your-domain.com/api/telegram/webhook/"  # Replace with your domain
            success = telegram_bot.set_webhook(webhook_url)
            
            if success:
                self.stdout.write(
                    self.style.SUCCESS(f'✅ Webhook setup successful: {webhook_url}')
                )
            else:
                self.stdout.write(
                    self.style.ERROR(f'❌ Failed to setup webhook')
                )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ Webhook setup error: {str(e)}')
            )
    
    def test_bot_connection(self):
        """Test Telegram bot connection"""
        try:
            bot_info = telegram_bot.get_bot_info()
            if bot_info and bot_info.get('ok'):
                bot_data = bot_info['result']
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✅ Bot connected: @{bot_data.get("username")} ({bot_data.get("first_name")})'
                    )
                )
            else:
                self.stdout.write(
                    self.style.ERROR(f'❌ Bot connection failed')
                )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ Bot test error: {str(e)}')
            )
    
    def start_monitoring_loop(self, interval):
        """Start the continuous monitoring loop"""
        self.stdout.write(
            self.style.SUCCESS(f'🔍 Alert monitoring started (interval: {interval}s)')
        )
        self.stdout.write(
            self.style.WARNING('Press Ctrl+C to stop monitoring')
        )
        
        try:
            cycle_count = 0
            while True:
                cycle_count += 1
                
                self.stdout.write(
                    self.style.HTTP_INFO(f'📊 Monitoring cycle #{cycle_count}')
                )
                
                # Trigger comprehensive alert monitoring
                try:
                    comprehensive_alert_monitoring_task.delay()
                    self.stdout.write('✅ Alert monitoring dispatched')
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'❌ Monitoring error: {str(e)}')
                    )
                
                # Wait for next cycle
                time.sleep(interval)
                
        except KeyboardInterrupt:
            self.stdout.write(
                self.style.SUCCESS(f'🛑 Alert monitoring stopped')
            )