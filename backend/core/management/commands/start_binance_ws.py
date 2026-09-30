"""
Django management command to start the Binance WebSocket client.

This command starts a background process that:
1. Connects to Binance WebSocket streams
2. Receives real-time ticker updates for ALL symbols every 1 second
3. Receives kline updates for top 100 symbols every 2 seconds
4. Updates the database automatically with fresh prices

Usage:
    python manage.py start_binance_ws

Benefits:
- ZERO API rate limits (streaming, not polling)
- Real-time data (1-2 second updates)
- Database always has fresh data
- consumers.py can just read from DB
"""

import asyncio
import logging
import signal
import sys
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Start the Binance WebSocket client for real-time data updates'

    def add_arguments(self, parser):
        parser.add_argument(
            '--update-interval',
            type=int,
            default=3,
            help='Database update interval in seconds (default: 3)'
        )
        parser.add_argument(
            '--debug',
            action='store_true',
            help='Enable debug logging'
        )

    def handle(self, *args, **options):
        # Setup logging
        log_level = logging.DEBUG if options['debug'] else logging.INFO
        logging.basicConfig(
            level=log_level,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        
        self.stdout.write(self.style.SUCCESS('\n' + '='*60))
        self.stdout.write(self.style.SUCCESS('🚀 BINANCE WEBSOCKET CLIENT'))
        self.stdout.write(self.style.SUCCESS('='*60 + '\n'))
        
        self.stdout.write('Starting Binance WebSocket client...')
        self.stdout.write(f'Update interval: {options["update_interval"]} seconds')
        self.stdout.write('')
        
        # Import here to avoid circular imports
        from core.binance_ws_client import BinanceWebSocketClient
        
        # Create the WebSocket client
        self.client = BinanceWebSocketClient()
        self.client.update_interval = options['update_interval']
        
        # Setup graceful shutdown
        self.setup_signal_handlers()
        
        # Run the async event loop
        try:
            asyncio.run(self.run_client())
        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING('\n⚠️ Received keyboard interrupt'))
        finally:
            self.stdout.write(self.style.SUCCESS('\n🛑 Binance WebSocket client stopped'))
    
    async def run_client(self):
        """Run the WebSocket client with periodic stats logging"""
        
        # Start a background task to log stats
        stats_task = asyncio.create_task(self.log_stats_loop())
        
        try:
            # Connect and listen (this runs forever)
            await self.client.connect()
        except asyncio.CancelledError:
            pass
        finally:
            stats_task.cancel()
            try:
                await stats_task
            except asyncio.CancelledError:
                pass
    
    async def log_stats_loop(self):
        """Log statistics every 30 seconds"""
        while True:
            await asyncio.sleep(30)
            
            if hasattr(self, 'client') and self.client:
                stats = self.client.get_stats()
                self.stdout.write(
                    f"\n📊 Stats: "
                    f"Ticker msgs: {stats.get('ticker_messages', 0)}, "
                    f"Kline msgs: {stats.get('kline_messages', 0)}, "
                    f"DB updates: {stats.get('db_updates', 0)}, "
                    f"Errors: {stats.get('errors', 0)}, "
                    f"Buffered: {stats.get('buffered_tickers', 0)} symbols"
                )
    
    def setup_signal_handlers(self):
        """Setup handlers for graceful shutdown"""
        def handle_signal(sig, frame):
            self.stdout.write(self.style.WARNING(f'\n⚠️ Received signal {sig}'))
            if hasattr(self, 'client') and self.client:
                asyncio.create_task(self.client.disconnect())
            sys.exit(0)
        
        signal.signal(signal.SIGINT, handle_signal)
        signal.signal(signal.SIGTERM, handle_signal)
