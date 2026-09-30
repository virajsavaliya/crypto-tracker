"""
Binance WebSocket Client for Real-Time Crypto Data

This module connects to Binance WebSocket streams and receives real-time updates:
- !ticker@arr: All market tickers (price, volume, 24h change) - updates every 1 second

Benefits:
- ZERO API rate limits (streaming, not polling)
- Real-time data (1-2 second updates)
- Single connection handles ALL symbols
- Low resource usage
"""

import json
import asyncio
import logging
import os
import time
from decimal import Decimal
from typing import Dict, List, Optional
import websockets

logger = logging.getLogger(__name__)

# Binance WebSocket endpoints
BINANCE_WS_URL = "wss://stream.binance.com:9443/ws"

# Global state
_ws_client = None
_is_running = False

# Async DB connection pool (using asyncpg)
_db_pool = None


class BinanceWebSocketClient:
    """
    WebSocket client that connects to Binance and receives real-time data.
    Updates the database automatically with fresh prices.
    """
    
    def __init__(self):
        self.ws = None
        self.is_connected = False
        self.reconnect_delay = 5  # seconds
        self.ticker_data_buffer = {}  # Buffer ticker data for batch DB updates
        self.kline_data_buffer = {}   # Buffer kline data
        self.update_interval = 10     # Update DB every 10 seconds (slower for external DB)
        
        # Statistics
        self.stats = {
            'ticker_messages': 0,
            'kline_messages': 0,
            'db_updates': 0,
            'errors': 0,
            'last_update': None
        }
    
    async def connect(self):
        """Connect to Binance WebSocket streams"""
        try:
            # Setup Django for ORM access
            import django
            import os
            os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'project_config.settings')
            django.setup()
            logger.info("✅ Django ORM initialized for database access")
            
            # Use simple single-stream URL for ticker data
            url = f"{BINANCE_WS_URL}/!ticker@arr"
            
            logger.info(f"🔌 Connecting to Binance WebSocket (ticker stream)...")
            logger.info(f"   URL: {url}")
            
            self.ws = await websockets.connect(
                url,
                ping_interval=20,
                ping_timeout=60,
                close_timeout=10
            )
            
            self.is_connected = True
            logger.info(f"✅ Connected to Binance WebSocket successfully!")
            
            # Start background tasks
            asyncio.create_task(self._db_update_loop())
            
            # Listen for messages
            await self._listen()
            
        except Exception as e:
            logger.error(f"❌ WebSocket connection failed: {e}")
            self.is_connected = False
            await self._reconnect()
    
    async def _listen(self):
        """Listen for incoming WebSocket messages"""
        try:
            async for message in self.ws:
                try:
                    data = json.loads(message)
                    await self._handle_message(data)
                except json.JSONDecodeError:
                    logger.warning("Received invalid JSON from Binance WebSocket")
                except Exception as e:
                    logger.error(f"Error handling message: {e}")
                    self.stats['errors'] += 1
                    
        except websockets.exceptions.ConnectionClosed as e:
            logger.warning(f"⚠️ WebSocket connection closed: {e}")
            self.is_connected = False
            await self._reconnect()
        except Exception as e:
            logger.error(f"❌ WebSocket listen error: {e}")
            self.is_connected = False
            await self._reconnect()
    
    async def _handle_message(self, data):
        """Handle incoming WebSocket message"""
        # Single stream endpoint returns list directly
        if isinstance(data, list):
            await self._handle_ticker_update(data)
        elif isinstance(data, dict):
            stream = data.get('stream', '')
            payload = data.get('data', data)
            if stream == '!ticker@arr' or isinstance(payload, list):
                await self._handle_ticker_update(payload)
    
    async def _handle_ticker_update(self, tickers: list):
        """Handle ticker updates - buffer for batch DB update"""
        self.stats['ticker_messages'] += 1
        
        for ticker in tickers:
            symbol = ticker.get('s', '')
            if not symbol:
                continue
            
            # Buffer the ticker data
            self.ticker_data_buffer[symbol] = {
                'symbol': symbol,
                'last_price': ticker.get('c', '0'),  # Close price
                'price_change_percent_24h': ticker.get('P', '0'),
                'high_price_24h': ticker.get('h', '0'),
                'low_price_24h': ticker.get('l', '0'),
                'quote_volume_24h': ticker.get('q', '0'),
                'bid_price': ticker.get('b', '0'),
                'ask_price': ticker.get('a', '0'),
                'open_price_24h': ticker.get('o', '0'),
                'last_update': time.time()
            }
    
    async def _db_update_loop(self):
        """Background loop to log statistics (DB updates handled by calc-worker)"""
        logger.info("🔄 Stats monitoring loop started (DB updates via calc-worker)")
        while self.is_connected:
            try:
                await asyncio.sleep(30)  # Log stats every 30 seconds
                
                buffer_size = len(self.ticker_data_buffer)
                # Just log stats, don't try to update DB (calc-worker does that)
                logger.info(f"� Stats: Ticker msgs: {self.stats['ticker_messages']}, "
                           f"Buffered: {buffer_size} symbols")
                
                # Clear buffer periodically to prevent memory buildup
                if buffer_size > 2000:
                    self.ticker_data_buffer.clear()
                    logger.info("   Cleared buffer (memory management)")
                    
            except Exception as e:
                logger.error(f"Stats loop error: {e}")
    
    async def _update_database(self):
        """Update database with buffered ticker data using Django ORM in a thread"""
        try:
            # Copy and clear buffers immediately
            ticker_snapshot = dict(self.ticker_data_buffer)
            self.ticker_data_buffer.clear()
            
            if not ticker_snapshot:
                return
            
            logger.info(f"📝 Starting DB update for {len(ticker_snapshot)} symbols...")
            
            # Support ALL quote currencies (USDT, USDC, FDUSD, BNB, BTC, EUR, etc.)
            # Sort alphabetically to prevent deadlocks
            quote_currencies = ('USDT', 'USDC', 'FDUSD', 'BNB', 'BTC', 'EUR', 'TRY', 'DAI', 'TUSD', 'ETH')
            symbols_list = sorted([s for s in ticker_snapshot.keys() if any(s.endswith(q) for q in quote_currencies)])
            logger.info(f"   Found {len(symbols_list)} pairs for supported quote currencies...")
            
            if not symbols_list:
                return
            
            start_time = time.time()
            
            # Prepare data for update
            updates = []
            for symbol in symbols_list[:200]:  # Update 200 pairs per cycle (faster with external DB)
                data = ticker_snapshot.get(symbol)
                if not data:
                    continue
                
                try:
                    metrics = self._calculate_metrics(data)
                    updates.append(metrics)
                except Exception as e:
                    logger.error(f"   Failed to prepare {symbol}: {e}")
            
            if not updates:
                return
            
            logger.info(f"   Prepared {len(updates)} records, using Django ORM bulk update...")
            
            # Run sync update in executor to not block the event loop
            try:
                loop = asyncio.get_running_loop()
                result = await loop.run_in_executor(None, self._sync_bulk_update, updates)
                
                elapsed = time.time() - start_time
                self.stats['db_updates'] += 1
                self.stats['last_update'] = time.time()
                
                logger.info(f"✅ Upserted {result} symbols in {elapsed:.2f}s")
                        
            except Exception as e:
                logger.error(f"   Django ORM bulk update failed: {e}")
                import traceback
                logger.error(traceback.format_exc())
            
        except Exception as e:
            import traceback
            logger.error(f"Database update failed: {e}")
            logger.error(traceback.format_exc())
            self.stats['errors'] += 1
    
    def _sync_bulk_update(self, updates: list):
        """Synchronous bulk update using Django ORM with batch INSERT"""
        from django.db import connection, close_old_connections
        from psycopg2.extras import execute_values
        
        if not updates:
            return 0
        
        # Close stale connections first
        close_old_connections()
        
        # Prepare data as list of tuples
        data = []
        for item in updates:
            data.append((
                item['symbol'],
                float(item['last_price']),
                float(item['price_change_percent_24h']),
                float(item['high_price_24h']),
                float(item['low_price_24h']),
                float(item['quote_volume_24h']),
                float(item['bid_price']),
                float(item['ask_price']),
                float(item['spread'])
            ))
        
        # Use execute_values for fast batch upsert
        try:
            # Ensure connection is open
            connection.ensure_connection()
            
            with connection.cursor() as cursor:
                execute_values(
                    cursor,
                    '''
                    INSERT INTO core_cryptodata (symbol, last_price, price_change_percent_24h, 
                        high_price_24h, low_price_24h, quote_volume_24h, bid_price, ask_price, spread)
                    VALUES %s
                    ON CONFLICT (symbol) DO UPDATE SET
                        last_price = EXCLUDED.last_price,
                        price_change_percent_24h = EXCLUDED.price_change_percent_24h,
                        high_price_24h = EXCLUDED.high_price_24h,
                        low_price_24h = EXCLUDED.low_price_24h,
                        quote_volume_24h = EXCLUDED.quote_volume_24h,
                        bid_price = EXCLUDED.bid_price,
                        ask_price = EXCLUDED.ask_price,
                        spread = EXCLUDED.spread
                    ''',
                    data,
                    page_size=100  # Batch 100 rows at a time
                )
            return len(updates)
        except Exception as e:
            logger.error(f"Batch upsert failed: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return 0
        finally:
            # Close connection to prevent stale connections
            close_old_connections()
    
    def _calculate_metrics(self, ticker_data: dict) -> dict:
        """Calculate all metrics from ticker data"""
        metrics = {
            'symbol': ticker_data['symbol'],
            'last_price': Decimal(str(ticker_data.get('last_price', '0'))),
            'price_change_percent_24h': Decimal(str(ticker_data.get('price_change_percent_24h', '0'))),
            'high_price_24h': Decimal(str(ticker_data.get('high_price_24h', '0'))),
            'low_price_24h': Decimal(str(ticker_data.get('low_price_24h', '0'))),
            'quote_volume_24h': Decimal(str(ticker_data.get('quote_volume_24h', '0'))),
            'bid_price': Decimal(str(ticker_data.get('bid_price', '0') or '0')),
            'ask_price': Decimal(str(ticker_data.get('ask_price', '0') or '0')),
        }
        
        # Calculate spread
        if metrics['bid_price'] > 0 and metrics['ask_price'] > 0:
            metrics['spread'] = metrics['ask_price'] - metrics['bid_price']
        else:
            metrics['spread'] = Decimal('0')
        
        return metrics
    
    async def _reconnect(self):
        """Reconnect to WebSocket after connection loss"""
        logger.info(f"🔄 Reconnecting in {self.reconnect_delay} seconds...")
        await asyncio.sleep(self.reconnect_delay)
        
        # Exponential backoff (max 60 seconds)
        self.reconnect_delay = min(self.reconnect_delay * 2, 60)
        
        await self.connect()
    
    async def disconnect(self):
        """Disconnect from WebSocket"""
        self.is_connected = False
        if self.ws:
            await self.ws.close()
            logger.info("🔌 Disconnected from Binance WebSocket")
    
    def get_stats(self) -> dict:
        """Get current statistics"""
        return {
            **self.stats,
            'is_connected': self.is_connected,
            'buffered_tickers': len(self.ticker_data_buffer),
            'buffered_klines': len(self.kline_data_buffer)
        }


# Global instance management
async def start_binance_ws_client():
    """Start the Binance WebSocket client (singleton)"""
    global _ws_client, _is_running
    
    if _is_running:
        logger.info("Binance WebSocket client already running")
        return _ws_client
    
    _ws_client = BinanceWebSocketClient()
    _is_running = True
    
    logger.info("🚀 Starting Binance WebSocket client...")
    await _ws_client.connect()
    
    return _ws_client


async def stop_binance_ws_client():
    """Stop the Binance WebSocket client"""
    global _ws_client, _is_running
    
    if _ws_client:
        await _ws_client.disconnect()
        _ws_client = None
    
    _is_running = False
    logger.info("🛑 Binance WebSocket client stopped")


def get_ws_client() -> Optional[BinanceWebSocketClient]:
    """Get the current WebSocket client instance"""
    return _ws_client


# For testing
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    async def test():
        client = BinanceWebSocketClient()
        await client.connect()
    
    asyncio.run(test())
