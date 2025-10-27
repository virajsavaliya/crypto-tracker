"""
Telegram Bot Polling Command
Use this for local development when webhook is not accessible
For production, use webhook instead
"""

from django.core.management.base import BaseCommand
from core.telegram_bot import telegram_bot
import requests
import time
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Start Telegram bot polling (for local development)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--once',
            action='store_true',
            help='Process pending updates once and exit (don\'t poll continuously)',
        )

    def handle(self, *args, **options):
        """Poll Telegram API for updates"""
        
        # Clear webhook first (can't use both webhook and polling)
        self.stdout.write("Clearing webhook...")
        try:
            response = requests.post(f"{telegram_bot.base_url}/deleteWebhook")
            if response.json().get('ok'):
                self.stdout.write(self.style.SUCCESS("✓ Webhook cleared"))
            else:
                self.stdout.write(self.style.WARNING("⚠ Could not clear webhook"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"✗ Error clearing webhook: {e}"))
        
        offset = None
        once_mode = options.get('once', False)
        
        if once_mode:
            self.stdout.write(self.style.SUCCESS("Running in single-run mode..."))
        else:
            self.stdout.write(self.style.SUCCESS("Starting Telegram bot polling..."))
            self.stdout.write("Press Ctrl+C to stop")
        
        try:
            while True:
                try:
                    # Get updates
                    params = {"timeout": 30, "allowed_updates": ["message", "callback_query"]}
                    if offset:
                        params["offset"] = offset
                    
                    response = requests.get(
                        f"{telegram_bot.base_url}/getUpdates",
                        params=params,
                        timeout=35
                    )
                    
                    data = response.json()
                    
                    if not data.get('ok'):
                        logger.error(f"Telegram API error: {data}")
                        time.sleep(5)
                        continue
                    
                    updates = data.get('result', [])
                    
                    if updates:
                        self.stdout.write(f"Processing {len(updates)} update(s)...")
                    
                    for update in updates:
                        # Process the update
                        try:
                            success = telegram_bot.handle_webhook_update(update)
                            if success:
                                if 'message' in update:
                                    msg = update['message']
                                    text = msg.get('text', '')
                                    chat_id = msg['chat']['id']
                                    self.stdout.write(
                                        self.style.SUCCESS(
                                            f"✓ Processed: {text[:50]} from chat {chat_id}"
                                        )
                                    )
                            else:
                                self.stdout.write(
                                    self.style.WARNING(
                                        f"⚠ Update {update.get('update_id')} not processed"
                                    )
                                )
                        except Exception as e:
                            logger.error(f"Error processing update: {e}")
                            self.stdout.write(
                                self.style.ERROR(f"✗ Error: {e}")
                            )
                        
                        # Update offset to acknowledge this update
                        offset = update['update_id'] + 1
                    
                    if once_mode and offset:
                        self.stdout.write(self.style.SUCCESS("✓ All pending updates processed"))
                        break
                    
                    if not updates and once_mode:
                        self.stdout.write("No pending updates found")
                        break
                    
                except requests.exceptions.Timeout:
                    # Timeout is expected with long polling
                    continue
                except KeyboardInterrupt:
                    raise
                except Exception as e:
                    logger.error(f"Polling error: {e}")
                    self.stdout.write(self.style.ERROR(f"Error: {e}"))
                    time.sleep(5)
            
        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING("\nStopping polling..."))
            self.stdout.write(self.style.SUCCESS("Bot stopped"))
