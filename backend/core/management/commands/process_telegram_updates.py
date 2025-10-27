"""
Django management command to process pending Telegram updates
Use this for local development when webhook is not set up
"""

from django.core.management.base import BaseCommand
from core.telegram_bot import telegram_bot
import requests
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Process pending Telegram updates'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Fetching pending Telegram updates...'))
        
        try:
            # Get pending updates
            url = f"{telegram_bot.base_url}/getUpdates"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if not data.get('ok'):
                self.stdout.write(self.style.ERROR('Failed to get updates from Telegram'))
                return
            
            updates = data.get('result', [])
            self.stdout.write(self.style.SUCCESS(f'Found {len(updates)} pending updates'))
            
            # Process each update
            processed = 0
            failed = 0
            
            for update in updates:
                try:
                    update_id = update.get('update_id')
                    message = update.get('message', {})
                    text = message.get('text', '')
                    
                    self.stdout.write(f'Processing update {update_id}: {text}')
                    
                    # Process the update using the bot's handler
                    success = telegram_bot.handle_webhook_update(update)
                    
                    if success:
                        processed += 1
                        self.stdout.write(self.style.SUCCESS(f'  ✓ Processed update {update_id}'))
                    else:
                        failed += 1
                        self.stdout.write(self.style.WARNING(f'  ⚠ Skipped update {update_id}'))
                    
                except Exception as e:
                    failed += 1
                    self.stdout.write(self.style.ERROR(f'  ✗ Failed to process update: {str(e)}'))
            
            # Clear the updates queue by acknowledging the last update
            if updates:
                last_update_id = updates[-1]['update_id']
                clear_url = f"{telegram_bot.base_url}/getUpdates?offset={last_update_id + 1}"
                requests.get(clear_url, timeout=10)
                self.stdout.write(self.style.SUCCESS(f'Cleared updates queue'))
            
            self.stdout.write(self.style.SUCCESS(
                f'\n✓ Done! Processed: {processed}, Failed: {failed}, Total: {len(updates)}'
            ))
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error: {str(e)}'))
            logger.error(f'Failed to process Telegram updates: {str(e)}')
