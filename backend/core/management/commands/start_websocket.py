import asyncio
import json
import requests
import time
import numpy as np
import logging
from concurrent.futures import ThreadPoolExecutor
from django.core.management.base import BaseCommand
import websockets
from channels.layers import get_channel_layer
from core.models import CryptoData
from channels.db import database_sync_to_async
from core.serializers import CryptoDataSerializer, CryptoDataFreeSerializer
from core.utils import bulk_upsert_crypto_data, bulk_upsert_crypto_data_raw_sql

logger = logging.getLogger(__name__)

def calculate_rsi(prices, period=14):
    """Calculates RSI using Wilder's smoothing method with improved error handling."""
    if len(prices) <= period:
        return 50.0  # Return neutral RSI instead of None for insufficient data
    
    try:
        deltas = np.diff(prices)
        seed = deltas[:period]
        
        gains = seed[seed >= 0].sum() / period
        losses = -seed[seed < 0].sum() / period
        
        if losses == 0:
            return 70.0  # Return high RSI instead of infinity
        
        rs = gains / losses
        rsi = 100 - (100 / (1 + rs))

        for i in range(period, len(deltas)):
            delta = deltas[i]
            if delta > 0:
                gain = delta
                loss = 0
            else:
                gain = 0
                loss = -delta
            
            gains = (gains * (period - 1) + gain) / period
            losses = (losses * (period - 1) + loss) / period

        if losses == 0:
            return 70.0  # Return high RSI instead of infinity
        
        rs = gains / losses
        rsi = 100 - (100 / (1 + rs))
        
        # Ensure RSI is within valid range
        if not (0 <= rsi <= 100) or np.isnan(rsi) or np.isinf(rsi):
            return 50.0  # Return neutral RSI for invalid calculations
            
        return float(rsi)
        
    except Exception as e:
        logger.warning(f"RSI calculation error: {e}, returning neutral RSI")
        return 50.0  # Return neutral RSI on any calculation error

class Command(BaseCommand):
    help = 'Starts a high-performance process to fetch, pre-load, calculate, and save all crypto data.'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.latest_ticker_data = {}
        self.kline_history = {}
        self.calculated_metrics = {}
        self.data_lock = asyncio.Lock()
        self.channel_layer = get_channel_layer()
        self.total_updated_symbols = 0
        self.known_symbols = set()  # Track known symbols to detect new ones
        self.last_symbol_check = 0  # Timestamp for periodic symbol discovery

    def get_all_symbols(self):
        try:
            self.stdout.write("Fetching USDT trading pairs from Binance API...")
            url = "https://api.binance.com/api/v3/ticker/24hr"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            all_tickers = response.json()
            # Filter to only USDT pairs for better performance and easier management
            symbols = [d['symbol'] for d in all_tickers if d['symbol'].endswith('USDT')]
            self.known_symbols.update(symbols)  # Track all known symbols
            self.stdout.write(self.style.SUCCESS(f"Found {len(symbols)} USDT pairs to track (filtered from {len(all_tickers)} total)."))
            return symbols
        except requests.exceptions.RequestException as e:
            self.stdout.write(self.style.ERROR(f"Could not fetch symbols: {e}"))
            return []

    def _fetch_history_for_symbol(self, symbol):
        try:
            url = f"https://api.binance.com/api/v3/klines?symbol={symbol.upper()}&interval=1m&limit=250"
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                klines_data = response.json()
                dtype = [('t', 'f8'), ('o', 'f8'), ('h', 'f8'), ('l', 'f8'), ('c', 'f8'), ('v', 'f8'), ('q', 'f8')]
                np_klines = np.array([(float(k[0]), float(k[1]), float(k[2]), float(k[3]), float(k[4]), float(k[5]), float(k[7])) for k in klines_data], dtype=dtype)
                return symbol, np_klines
        except requests.exceptions.RequestException:
            return symbol, None
        return symbol, None

    def prefetch_historical_data(self, symbols):
        self.stdout.write(f"Pre-fetching historical data for {len(symbols)} symbols...")
        with ThreadPoolExecutor(max_workers=50) as executor:
            results = executor.map(self._fetch_history_for_symbol, symbols)
        
        for symbol, klines in results:
            if klines is not None:
                self.kline_history[symbol] = klines
        
        self.stdout.write(self.style.SUCCESS("Historical pre-fetch complete. Running initial calculations..."))
        for symbol in self.kline_history.keys():
            metrics = self._calculate_metrics_sync(symbol)
            if metrics:
                self.calculated_metrics[symbol] = metrics
        self.stdout.write(self.style.SUCCESS("Initial calculations are complete. All systems active."))

    async def check_for_new_symbols(self):
        """Periodically check for new USDT symbols added by Binance"""
        current_time = time.time()
        # Check every 30 minutes for new symbols
        if current_time - self.last_symbol_check < 1800:  # 30 minutes = 1800 seconds
            return
        
        self.last_symbol_check = current_time
        try:
            self.stdout.write("🔍 Checking for new USDT symbols on Binance...")
            url = "https://api.binance.com/api/v3/ticker/24hr"
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                all_tickers = response.json()
                current_symbols = {d['symbol'] for d in all_tickers if d['symbol'].endswith('USDT')}
                new_symbols = current_symbols - self.known_symbols
                
                if new_symbols:
                    self.stdout.write(self.style.SUCCESS(f"🎉 Found {len(new_symbols)} new USDT symbols: {', '.join(sorted(new_symbols))}"))
                    
                    # Add new symbols to our tracking
                    self.known_symbols.update(new_symbols)
                    
                    # Fetch historical data for new symbols
                    for symbol in new_symbols:
                        _, klines = self._fetch_history_for_symbol(symbol)
                        if klines is not None:
                            self.kline_history[symbol] = klines
                            # Calculate initial metrics
                            metrics = self._calculate_metrics_sync(symbol)
                            if metrics:
                                self.calculated_metrics[symbol] = metrics
                    
                    self.stdout.write(self.style.SUCCESS(f"✅ Successfully initialized {len(new_symbols)} new USDT symbols!"))
                else:
                    self.stdout.write("ℹ️ No new USDT symbols detected")
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error checking for new symbols: {e}"))

    def handle(self, *args, **options):
        while True:
            try:
                asyncio.run(self.main_logic())
            except KeyboardInterrupt:
                self.stdout.write(self.style.SUCCESS('Process stopped manually.'))
                break
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"A critical error occurred: {e}. Restarting in 10 seconds..."))
                time.sleep(10)

    async def main_logic(self):
        symbols = self.get_all_symbols()
        if not symbols: return

        self.prefetch_historical_data(symbols)
        kline_streams = [f"{symbol.lower()}@kline_1m" for symbol in symbols]
        stream_chunks = [kline_streams[i:i + 200] for i in range(0, len(kline_streams), 200)]
        
        tasks = []
        for chunk in stream_chunks:
            uri = f"wss://stream.binance.com:9443/stream?streams={'/'.join(['!ticker@arr'] + chunk)}"
            tasks.append(self.receive_websocket_data(uri))
        
        tasks.append(self.save_and_broadcast_data())
        tasks.append(self.periodic_symbol_discovery())  # Add periodic new symbol detection
        await asyncio.gather(*tasks)

    async def receive_websocket_data(self, uri):
        while True:
            try:
                async with websockets.connect(uri, ping_interval=20, ping_timeout=20) as websocket:
                    self.stdout.write(self.style.SUCCESS(f'WebSocket connected to {uri[:70]}...'))
                    async for message in websocket:
                        data = json.loads(message)
                        stream_type, payload = data.get('stream'), data.get('data')
                        if not stream_type or not payload: continue

                        async with self.data_lock:
                            if stream_type == '!ticker@arr':
                                for ticker in payload:
                                    symbol = ticker.get('s')
                                    # CRITICAL: Only process USDT symbols to maintain clean database
                                    if symbol and symbol.endswith('USDT'):
                                        # AUTO-DETECT NEW SYMBOLS: If this is a new symbol, initialize it
                                        if symbol not in self.known_symbols:
                                            self.stdout.write(self.style.SUCCESS(f"🆕 Auto-detected new USDT symbol: {symbol}"))
                                            self.known_symbols.add(symbol)
                                            # Initialize historical data for new symbol in background
                                            asyncio.create_task(self.initialize_new_symbol(symbol))
                                        
                                        self.latest_ticker_data[symbol] = ticker
                            
                            elif '@kline_1m' in stream_type:
                                symbol, kline_data = payload.get('s'), payload.get('k')
                                # CRITICAL: Only process USDT symbols to maintain clean database
                                if symbol and symbol.endswith('USDT') and kline_data and kline_data.get('x'):
                                    # AUTO-DETECT NEW SYMBOLS: Initialize if this is a new symbol
                                    if symbol not in self.known_symbols:
                                        self.stdout.write(self.style.SUCCESS(f"🆕 Auto-detected new USDT symbol from kline: {symbol}"))
                                        self.known_symbols.add(symbol)
                                        asyncio.create_task(self.initialize_new_symbol(symbol))
                                    
                                    self.update_kline_history(symbol, kline_data)
                                    asyncio.create_task(self.recalculate_metrics_for_symbol(symbol))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"WebSocket error: {e}, reconnecting..."))
                await asyncio.sleep(5)

    async def initialize_new_symbol(self, symbol):
        """Initialize historical data and metrics for a newly detected symbol"""
        try:
            # Fetch historical data in a separate thread to avoid blocking
            _, klines = await asyncio.to_thread(self._fetch_history_for_symbol, symbol)
            if klines is not None:
                async with self.data_lock:
                    self.kline_history[symbol] = klines
                    # Calculate initial metrics
                    metrics = self._calculate_metrics_sync(symbol)
                    if metrics:
                        self.calculated_metrics[symbol] = metrics
                self.stdout.write(self.style.SUCCESS(f"✅ Initialized historical data for new symbol: {symbol}"))
            else:
                self.stdout.write(self.style.WARNING(f"⚠️ Could not fetch historical data for new symbol: {symbol}"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error initializing new symbol {symbol}: {e}"))

    def update_kline_history(self, symbol, kline_data):
        if symbol not in self.kline_history: return
        dtype = self.kline_history[symbol].dtype
        new_kline = np.array([(float(kline_data['t']), float(kline_data['o']), float(kline_data['h']), float(kline_data['l']), float(kline_data['c']), float(kline_data['v']), float(kline_data['q']))], dtype=dtype)
        self.kline_history[symbol] = np.append(self.kline_history[symbol], new_kline)
        if len(self.kline_history[symbol]) > 250:
            self.kline_history[symbol] = self.kline_history[symbol][-250:]

    async def recalculate_metrics_for_symbol(self, symbol):
        metrics = await asyncio.to_thread(self._calculate_metrics_sync, symbol)
        if metrics:
            async with self.data_lock:
                self.calculated_metrics[symbol] = metrics

    def _calculate_metrics_sync(self, symbol):
        metrics = {}
        klines = self.kline_history.get(symbol)
        live_ticker = self.latest_ticker_data.get(symbol)

        if klines is None or len(klines) < 2:
            return metrics

        now_ms = time.time() * 1000
        all_close_prices = klines['c']
        quote_volume_24h = float(live_ticker.get('q', 0)) if live_ticker else 0
        avg_minute_volume_24h = (quote_volume_24h / (24 * 60)) if quote_volume_24h > 0 else 0

        intervals = {'m1': 1, 'm2': 2, 'm3': 3, 'm5': 5, 'm10': 10, 'm15': 15, 'm60': 60}
        for key, minutes in intervals.items():
            start_time_ms = now_ms - (minutes * 60 * 1000)
            period_klines = klines[klines['t'] >= start_time_ms]
            
            # For 1-minute calculations, ensure we have recent data (within last 2 minutes)
            if key == 'm1' and len(period_klines) < 1:
                # Try a slightly larger window for m1 to catch recent data
                start_time_ms = now_ms - (2 * 60 * 1000)  # 2 minutes
                period_klines = klines[klines['t'] >= start_time_ms]
            
            if len(period_klines) < 1: 
                continue

            open_price = period_klines[0]['o']
            close_price = period_klines[-1]['c']
            if open_price > 0:
                metrics[key] = float(((close_price - open_price) / open_price) * 100)

            low, high = float(np.min(period_klines['l'])), float(np.max(period_klines['h']))
            metrics.update({f'{key}_low': low, f'{key}_high': high})
            if open_price > 0:
                metrics[f'{key}_range_pct'] = float(((high - low) / open_price) * 100)

            base_volume_period = float(np.sum(period_klines['v']))
            quote_volume_period = float(np.sum(period_klines['q']))
            metrics.update({
                f'{key}_nv': float(np.sum((period_klines['c'] - period_klines['o']) * period_klines['v'])),
                f'{key}_bv': quote_volume_period,
                f'{key}_sv': float(np.sum(period_klines['v'] * (period_klines['h'] - period_klines['c'])))
            })
            if key in ['m1','m5','m10','m15','m60']:
                metrics[f'{key}_vol'] = base_volume_period
            
            if avg_minute_volume_24h > 0:
                avg_vol_for_period = avg_minute_volume_24h * minutes
                metrics[f'{key}_vol_pct'] = float((quote_volume_period / avg_vol_for_period) * 100) if avg_vol_for_period > 0 else 0

        # RSI calculations with proper validation and type conversion
        if len(all_close_prices) > 14:
            rsi_1m = calculate_rsi(all_close_prices[-28:], period=14)
            if rsi_1m is not None and 0 <= rsi_1m <= 100:
                metrics['rsi_1m'] = float(rsi_1m)
            else:
                metrics['rsi_1m'] = 50.0  # Default to neutral instead of None
        else:
            metrics['rsi_1m'] = 50.0  # Default for insufficient data
            
        if len(all_close_prices) > 42:
            rsi_3m = calculate_rsi(all_close_prices[-42:], period=14)
            if rsi_3m is not None and 0 <= rsi_3m <= 100:
                metrics['rsi_3m'] = float(rsi_3m)
            else:
                metrics['rsi_3m'] = 50.0  # Default to neutral instead of None
        else:
            metrics['rsi_3m'] = 50.0  # Default for insufficient data
            
        if len(all_close_prices) > 70:
            rsi_5m = calculate_rsi(all_close_prices[-70:], period=14)
            if rsi_5m is not None and 0 <= rsi_5m <= 100:
                metrics['rsi_5m'] = float(rsi_5m)
            else:
                metrics['rsi_5m'] = 50.0  # Default to neutral instead of None
        else:
            metrics['rsi_5m'] = 50.0  # Default for insufficient data
            
        if len(all_close_prices) > 210:
            rsi_15m = calculate_rsi(all_close_prices[-210:], period=14)
            if rsi_15m is not None and 0 <= rsi_15m <= 100:
                metrics['rsi_15m'] = float(rsi_15m)
            else:
                metrics['rsi_15m'] = 50.0  # Default to neutral instead of None
        else:
            metrics['rsi_15m'] = 50.0  # Default for insufficient data

        return metrics

    async def save_and_broadcast_data(self):
        while True:
            # Wait exactly 5 seconds for backend data updates
            await asyncio.sleep(5)
            
            async with self.data_lock:
                ticker_batch = self.latest_ticker_data.copy()
            if not ticker_batch: continue
            
            self.stdout.write(f"\n=== 5-SECOND BACKEND UPDATE ===")
            self.stdout.write(f"Processing {len(ticker_batch)} USDT symbols at {time.strftime('%H:%M:%S')}...")
            
            # 🚀 DISTRIBUTED BATCH PROCESSING - Split symbols into parallel batches
            batch_size = 75  # Process 75 symbols per batch for optimal speed
            symbol_batches = []
            ticker_items = list(ticker_batch.items())
            
            for i in range(0, len(ticker_items), batch_size):
                batch_dict = dict(ticker_items[i:i + batch_size])
                symbol_batches.append(batch_dict)
            
            self.stdout.write(f"🔄 Split into {len(symbol_batches)} parallel batches of ~{batch_size} symbols each")
            
            # Process all batches in parallel using asyncio.gather
            batch_tasks = []
            for i, batch in enumerate(symbol_batches):
                task = self.process_symbol_batch(batch, i + 1)
                batch_tasks.append(task)
            
            # Execute all batches simultaneously
            start_time = time.time()
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
            processing_time = time.time() - start_time
            
            # Combine all successful results
            all_updated_data = []
            successful_batches = 0
            total_processed = 0
            
            for i, result in enumerate(batch_results):
                if isinstance(result, Exception):
                    self.stdout.write(self.style.ERROR(f"❌ Batch {i+1} failed: {result}"))
                else:
                    all_updated_data.extend(result)
                    successful_batches += 1
                    total_processed += len(result)
            
            self.stdout.write(self.style.SUCCESS(
                f"✅ Processed {total_processed} symbols in {processing_time:.2f}s "
                f"({successful_batches}/{len(symbol_batches)} batches successful)"
            ))
            
            # Broadcast combined results
            if all_updated_data:
                premium_data = CryptoDataSerializer(all_updated_data, many=True).data
                free_data = CryptoDataFreeSerializer(all_updated_data, many=True).data
                
                # Broadcast to each tier - frontend will handle 10-second user updates
                await self.channel_layer.group_send(
                    "crypto_free", {"type": "crypto.update", "data": free_data}
                )
                await self.channel_layer.group_send(
                    "crypto_premium", {"type": "crypto.update", "data": premium_data}
                )
                await self.channel_layer.group_send(
                    "crypto_enterprise", {"type": "crypto.update", "data": premium_data}
                )
            
            self.stdout.write(self.style.SUCCESS("✅ Distributed processing and broadcasting completed!"))
            self.stdout.write("📊 Next backend update in 5 seconds...")

    async def process_symbol_batch(self, ticker_batch_subset, batch_number):
        """Process a subset of symbols in parallel for distributed computing"""
        try:
            # Process this batch subset using the existing bulk upsert logic
            updated_data = await self.bulk_upsert_database(ticker_batch_subset)
            
            self.stdout.write(f"✅ Batch {batch_number}: Processed {len(updated_data)} symbols successfully")
            return updated_data
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"❌ Batch {batch_number} failed: {e}"))
            raise

    async def periodic_symbol_discovery(self):
        """Periodic task to discover new USDT symbols every 30 minutes"""
        while True:
            await asyncio.sleep(1800)  # Wait 30 minutes
            await self.check_for_new_symbols()

    @database_sync_to_async
    def bulk_upsert_database(self, ticker_batch):
        """
        Process ticker data batch and perform deadlock-safe database upserts
        ticker_batch is a dict where keys are symbols and values are ticker objects
        """
        if not ticker_batch:
            return []
            
        # Convert ticker data to the format expected by our utility function
        processed_data = []
        for symbol, ticker in ticker_batch.items():
            try:
                # Calculate additional metrics
                metrics = self._calculate_metrics_sync(symbol)
                
                # Create the data dictionary in the format expected by bulk_upsert_crypto_data
                crypto_data = {
                    'symbol': symbol,
                    'last_price': float(ticker.get('c', 0)),
                    'price_change_percent_24h': float(ticker.get('P', 0)),
                    'high_price_24h': float(ticker.get('h', 0)),
                    'low_price_24h': float(ticker.get('l', 0)),
                    'quote_volume_24h': float(ticker.get('q', 0)),
                    'bid_price': float(ticker.get('b', 0)),
                    'ask_price': float(ticker.get('a', 0)),
                    'spread': float(ticker.get('a', 0)) - float(ticker.get('b', 0)) if ticker.get('a') and ticker.get('b') else 0,
                }
                
                # Add all the calculated metrics - ensure they override any conflicting basic data
                if metrics:
                    crypto_data.update(metrics)
                else:
                    # If no metrics calculated, provide DEFAULT values instead of None to prevent N/A
                    # Use last_price as fallback for percentage calculations
                    fallback_price = float(ticker.get('c', 0))
                    
                    for interval in ['m1', 'm2', 'm3', 'm5', 'm10', 'm15', 'm60']:
                        crypto_data[interval] = 0.0  # Default to 0% change instead of None
                        crypto_data[f'{interval}_vol_pct'] = 0.0  # Default to 0% volume instead of None
                        crypto_data[f'{interval}_low'] = fallback_price  # Use current price as fallback
                        crypto_data[f'{interval}_high'] = fallback_price  # Use current price as fallback
                        crypto_data[f'{interval}_range_pct'] = 0.0  # Default to 0% range instead of None
                        crypto_data[f'{interval}_nv'] = 0.0
                        crypto_data[f'{interval}_bv'] = 0.0
                        crypto_data[f'{interval}_sv'] = 0.0
                    
                    # Add missing volume fields with defaults
                    for vol_interval in ['m1', 'm5', 'm10', 'm15', 'm60']:
                        crypto_data[f'{vol_interval}_vol'] = 0.0
                    
                    # RSI defaults to neutral 50 instead of None
                    for rsi_field in ['rsi_1m', 'rsi_3m', 'rsi_5m', 'rsi_15m']:
                        crypto_data[rsi_field] = 50.0  # Neutral RSI instead of None
                
                processed_data.append(crypto_data)
                
            except Exception as e:
                logger.error(f"Error processing ticker data for {symbol}: {e}")
                continue
        
        # Use the deadlock-safe bulk upsert function with raw SQL
        result = bulk_upsert_crypto_data_raw_sql(processed_data)
        success_count = result.get('processed', 0)
        
        self.total_updated_symbols += success_count
        
        # Return the processed data for broadcasting
        return processed_data