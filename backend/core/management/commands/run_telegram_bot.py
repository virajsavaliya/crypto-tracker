"""
Django management command to run Telegram bot in polling mode
This is for local development when webhooks cannot be used
"""

from django.core.management.base import BaseCommand
from core.telegram_bot import telegram_bot
import requests
import time
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Run Telegram bot in polling mode (for local development)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--interval',
            type=int,
            default=2,
            help='Polling interval in seconds (default: 2)'
        )

    def handle(self, *args, **options):
        interval = options['interval']
        last_update_id = None
        
        self.stdout.write(self.style.SUCCESS(
            f'🤖 Starting Telegram bot polling (interval: {interval}s)'
        ))
        self.stdout.write(self.style.WARNING('Press Ctrl+C to stop\n'))
        
        try:
            while True:
                try:
                    # Build URL with offset to get only new updates
                    url = f"{telegram_bot.base_url}/getUpdates"
                    params = {
                        'timeout': 30,  # Long polling
                        'allowed_updates': ['message']
                    }
                    
                    if last_update_id:
                        params['offset'] = last_update_id + 1
                    
                    # Get updates
                    response = requests.get(url, params=params, timeout=35)
                    response.raise_for_status()
                    data = response.json()
                    
                    if not data.get('ok'):
                        self.stdout.write(self.style.ERROR('Failed to get updates'))
                        time.sleep(interval)
                        continue
                    
                    updates = data.get('result', [])
                    
                    # Process each update
                    for update in updates:
                        update_id = update.get('update_id')
                        last_update_id = update_id
                        
                        message = update.get('message', {})
                        text = message.get('text', '')
                        chat_id = message.get('chat', {}).get('id')
                        username = message.get('from', {}).get('username', 'unknown')
                        
                        self.stdout.write(
                            f'📨 [{chat_id}] @{username}: {text}'
                        )
                        
                        # Process the update
                        success = telegram_bot.handle_webhook_update(update)
                        
                        if success:
                            self.stdout.write(self.style.SUCCESS('   ✓ Processed'))
                        else:
                            self.stdout.write(self.style.WARNING('   ⚠ Skipped'))
                    
                    if not updates:
                        # No new updates, wait a bit
                        time.sleep(interval)
                    
                except requests.RequestException as e:
                    self.stdout.write(self.style.ERROR(f'Network error: {str(e)}'))
                    time.sleep(interval)
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'Error: {str(e)}'))
                    time.sleep(interval)
        
        except KeyboardInterrupt:
            self.stdout.write(self.style.SUCCESS('\n\n🛑 Telegram bot polling stopped'))
