"""
Set Telegram Webhook for Production
Use this to configure webhook URL when deploying to production
"""

from django.core.management.base import BaseCommand
from core.telegram_bot import telegram_bot
import sys

class Command(BaseCommand):
    help = 'Set Telegram bot webhook URL (for production)'

    def add_arguments(self, parser):
        parser.add_argument(
            'webhook_url',
            nargs='?',
            type=str,
            help='Full webhook URL (e.g., https://yourdomain.com/api/telegram/webhook/)',
        )
        parser.add_argument(
            '--delete',
            action='store_true',
            help='Delete the current webhook',
        )
        parser.add_argument(
            '--info',
            action='store_true',
            help='Show current webhook info',
        )

    def handle(self, *args, **options):
        """Set or manage Telegram webhook"""
        
        if options.get('info'):
            self.show_webhook_info()
            return
        
        if options.get('delete'):
            self.delete_webhook()
            return
        
        webhook_url = options.get('webhook_url')
        
        if not webhook_url:
            self.stdout.write(self.style.ERROR("Error: webhook_url is required"))
            self.stdout.write("\nUsage:")
            self.stdout.write("  python manage.py set_telegram_webhook https://yourdomain.com/api/telegram/webhook/")
            self.stdout.write("\nOptions:")
            self.stdout.write("  --info    Show current webhook configuration")
            self.stdout.write("  --delete  Remove webhook (for local development)")
            sys.exit(1)
        
        # Validate URL
        if not webhook_url.startswith('https://'):
            self.stdout.write(self.style.ERROR("Error: Webhook URL must use HTTPS"))
            sys.exit(1)
        
        if not webhook_url.endswith('/'):
            webhook_url += '/'
        
        self.stdout.write(f"Setting webhook to: {webhook_url}")
        
        success = telegram_bot.set_webhook(webhook_url)
        
        if success:
            self.stdout.write(self.style.SUCCESS("✓ Webhook set successfully!"))
            self.stdout.write("\nVerifying...")
            self.show_webhook_info()
        else:
            self.stdout.write(self.style.ERROR("✗ Failed to set webhook"))
            sys.exit(1)
    
    def show_webhook_info(self):
        """Display current webhook configuration"""
        import requests
        
        try:
            response = requests.get(f"{telegram_bot.base_url}/getWebhookInfo")
            data = response.json()
            
            if data.get('ok'):
                result = data['result']
                
                self.stdout.write("\n" + "="*60)
                self.stdout.write(self.style.SUCCESS("Webhook Information:"))
                self.stdout.write("="*60)
                
                if result.get('url'):
                    self.stdout.write(f"URL: {result['url']}")
                    self.stdout.write(self.style.SUCCESS("Status: ✓ Active"))
                else:
                    self.stdout.write(self.style.WARNING("Status: ✗ Not configured"))
                    self.stdout.write("(Bot is using polling or not configured)")
                
                if result.get('pending_update_count', 0) > 0:
                    self.stdout.write(
                        self.style.WARNING(
                            f"Pending Updates: {result['pending_update_count']}"
                        )
                    )
                else:
                    self.stdout.write("Pending Updates: 0")
                
                if result.get('last_error_date'):
                    from datetime import datetime
                    error_time = datetime.fromtimestamp(result['last_error_date'])
                    self.stdout.write(
                        self.style.ERROR(
                            f"Last Error: {result.get('last_error_message', 'Unknown')}"
                        )
                    )
                    self.stdout.write(f"Error Time: {error_time}")
                
                self.stdout.write("="*60 + "\n")
            else:
                self.stdout.write(self.style.ERROR(f"Error: {data}"))
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error getting webhook info: {e}"))
    
    def delete_webhook(self):
        """Delete current webhook"""
        import requests
        
        try:
            response = requests.post(f"{telegram_bot.base_url}/deleteWebhook")
            data = response.json()
            
            if data.get('ok'):
                self.stdout.write(self.style.SUCCESS("✓ Webhook deleted successfully"))
                self.stdout.write(self.style.WARNING(
                    "Note: You can now use polling for local development"
                ))
                self.stdout.write("Run: python manage.py telegram_polling")
            else:
                self.stdout.write(self.style.ERROR(f"Error: {data}"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error deleting webhook: {e}"))
