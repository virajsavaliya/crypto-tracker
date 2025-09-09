# File: core/management/commands/start_websocket.py (Optimized Version)

import asyncio
import json
import requests
import time
import numpy as np
from concurrent.futures import ThreadPoolExecutor
from django.core.management.base import BaseCommand
import websockets
from core.models import CryptoData
from channels.db import database_sync_to_async
from django.core.cache import cache # <--- Add this import
from core.serializers import CryptoDataSerializer, CryptoDataFreeSerializer # <--- Add this import

class Command(BaseCommand):
    help = 'Starts a high-performance process to fetch, pre-load, calculate, and save all crypto data.'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Live data from !ticker@arr stream
        self.latest_ticker_data = {}
        # Historical k-line data for calculations
        self.kline_history = {}
        # Store for pre-calculated metrics
        self.calculated_metrics = {}
        # Use a lock to prevent race conditions on shared data
        self.data_lock = asyncio.Lock()

    def get_all_symbols(self):
        """Fetches ALL USDT and BTC trading pairs from Binance."""
        try:
            self.stdout.write("Fetching all tradable symbols from Binance API...")
            url = "https://api.binance.com/api/v3/ticker/24hr"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            all_tickers = response.json()
            
            symbols = [d['symbol'] for d in all_tickers if d['symbol'].endswith('USDT') or d['symbol'].endswith('BTC')]
            
            self.stdout.write(self.style.SUCCESS(f"Found {len(symbols)} total symbols to track."))
            return symbols
        except requests.exceptions.RequestException as e:
            self.stdout.write(self.style.ERROR(f"Could not fetch symbols: {e}"))
            return []

    def _fetch_history_for_symbol(self, symbol):
        """Helper function to fetch historical klines for a single symbol."""
        try:
            url = f"https://api.binance.com/api/v3/klines?symbol={symbol.upper()}&interval=1m&limit=250"
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                klines_data = response.json()
                # Store as a list of numpy arrays for efficiency
                dtype = [('t', 'f8'), ('o', 'f8'), ('h', 'f8'), ('l', 'f8'), ('c', 'f8'), ('v', 'f8'), ('q', 'f8')]
                np_klines = np.array([(float(k[0]), float(k[1]), float(k[2]), float(k[3]), float(k[4]), float(k[5]), float(k[7])) for k in klines_data], dtype=dtype)
                return symbol, np_klines
        except requests.exceptions.RequestException:
            return symbol, None
        return symbol, None

    def prefetch_historical_data(self, symbols):
        """Uses a thread pool to fetch historical data and run initial calculations."""
        self.stdout.write(f"Pre-fetching historical data for {len(symbols)} symbols...")
        with ThreadPoolExecutor(max_workers=20) as executor:
            results = executor.map(self._fetch_history_for_symbol, symbols)
        
        for symbol, klines in results:
            if klines is not None:
                self.kline_history[symbol] = klines
        
        self.stdout.write(self.style.SUCCESS("Historical pre-fetch complete. Running initial calculations..."))
        # Run initial calculations for all symbols
        for symbol in self.kline_history.keys():
            metrics = self._calculate_metrics_sync(symbol)
            if metrics:
                self.calculated_metrics[symbol] = metrics
        self.stdout.write(self.style.SUCCESS("Initial calculations are complete. All systems active."))

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

        # This is a blocking call, run it before starting the async loop
        self.prefetch_historical_data(symbols)

        kline_streams = [f"{symbol.lower()}@kline_1m" for symbol in symbols]
        
        # Binance limits streams to 1024 per connection. We'll handle this by chunking.
        # We need !ticker@arr in each connection.
        stream_chunks = [kline_streams[i:i + 200] for i in range(0, len(kline_streams), 200)]
        
        tasks = []
        for chunk in stream_chunks:
            uri = f"wss://stream.binance.com:9443/stream?streams={'/'.join(['!ticker@arr'] + chunk)}"
            tasks.append(self.receive_websocket_data(uri))
        
        tasks.append(self.save_data_periodically())
        await asyncio.gather(*tasks)

    async def receive_websocket_data(self, uri):
        """Handles a single websocket connection."""
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
                                    if symbol := ticker.get('s'): self.latest_ticker_data[symbol] = ticker
                            
                            elif '@kline_1m' in stream_type:
                                symbol, kline_data = payload.get('s'), payload.get('k')
                                # Only process closed candles
                                if symbol and kline_data and kline_data.get('x'):
                                    self.update_kline_history(symbol, kline_data)
                                    # Trigger a non-blocking calculation for this symbol
                                    asyncio.create_task(self.recalculate_metrics_for_symbol(symbol))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"WebSocket error: {e}, reconnecting..."))
                await asyncio.sleep(5)

    def update_kline_history(self, symbol, kline_data):
        """Appends new kline data to the numpy array."""
        if symbol not in self.kline_history:
            return
            
        dtype = self.kline_history[symbol].dtype
        new_kline = np.array([(float(kline_data['t']), float(kline_data['o']), float(kline_data['h']), float(kline_data['l']), float(kline_data['c']), float(kline_data['v']), float(kline_data['q']))], dtype=dtype)
        
        self.kline_history[symbol] = np.append(self.kline_history[symbol], new_kline)
        
        # Keep the history array at a max length of 250
        if len(self.kline_history[symbol]) > 250:
            self.kline_history[symbol] = self.kline_history[symbol][-250:]

    async def recalculate_metrics_for_symbol(self, symbol):
        """Runs metric calculation for a single symbol in a separate thread to avoid blocking."""
        # Run the synchronous, CPU-bound calculation in a thread
        metrics = await asyncio.to_thread(self._calculate_metrics_sync, symbol)
        if metrics:
            async with self.data_lock:
                self.calculated_metrics[symbol] = metrics

    def _calculate_metrics_sync(self, symbol):
        """The actual synchronous calculation logic. Optimized for performance."""
        metrics = {}
        klines = self.kline_history.get(symbol)
        if klines is None or len(klines) < 2: return metrics

        now_ms = time.time() * 1000
        
        intervals = {'m1': 1, 'm2': 2, 'm3': 3, 'm5': 5, 'm10': 10, 'm15': 15, 'm60': 60}
        for key, minutes in intervals.items():
            start_time_ms = now_ms - (minutes * 60 * 1000)
            period_klines = klines[klines['t'] >= start_time_ms]
            if len(period_klines) < 1: continue

            open_price, close_price = period_klines[0]['o'], period_klines[-1]['c']
            if open_price > 0: metrics[key] = ((close_price - open_price) / open_price) * 100

            low, high = np.min(period_klines['l']), np.max(period_klines['h'])
            metrics.update({f'{key}_low': low, f'{key}_high': high})
            if open_price > 0: metrics[f'{key}_range_pct'] = ((high - low) / open_price) * 100

            total_volume = np.sum(period_klines['v'])
            buy_volume = np.sum(period_klines['q']) # Quote asset volume is often a better proxy for buy volume
            metrics.update({
                f'{key}_nv': np.sum((period_klines['c'] - period_klines['o']) * period_klines['v']),
                f'{key}_bv': buy_volume,
                f'{key}_sv': np.sum(period_klines['v'] * (period_klines['h'] - period_klines['c'])) # approximation
            })
            if key in ['m1','m5','m10','m15','m60']: metrics[f'{key}_vol'] = total_volume
        return metrics


    async def save_data_periodically(self):
        """Periodically saves the latest combined ticker and metric data to the database and cache."""
        while True:
            await asyncio.sleep(3) # Save interval
            
            async with self.data_lock:
                ticker_batch = self.latest_ticker_data.copy()
            
            if not ticker_batch: continue

            self.stdout.write(f"\nSaving batch of {len(ticker_batch)} symbols at {time.strftime('%H:%M:%S')}...")
            
            # This database update can still happen in the background
            await self.bulk_update_database(ticker_batch)

            # --- NEW CACHING LOGIC ---
            # Now, let's update the cache with the latest full dataset
            await self.update_cache()
            
            self.stdout.write(self.style.SUCCESS("Batch database and cache save complete."))

    @database_sync_to_async
    def update_cache(self):
            """
            Fetches all data from the database and caches the serialized
            results for both free and premium users.
            """
            all_data = CryptoData.objects.all().order_by('-quote_volume_24h')
            
            # Create and cache the free user data
            free_serializer = CryptoDataFreeSerializer(all_data, many=True)
            cache.set('crypto_data_free', free_serializer.data, timeout=60) # Cache for 60 seconds

            # Create and cache the premium user data
            premium_serializer = CryptoDataSerializer(all_data, many=True)
            cache.set('crypto_data_premium', premium_serializer.data, timeout=60) # Cache for 60 seconds



    @database_sync_to_async
    def bulk_update_database(self, ticker_batch):
        """Performs a highly efficient bulk update/create operation in smaller batches."""
        symbols = list(ticker_batch.keys())
        batch_size = 500

        existing_records = {obj.symbol: obj for obj in CryptoData.objects.filter(symbol__in=symbols)}
        
        to_create, to_update = [], []
        all_fields = [f.name for f in CryptoData._meta.get_fields() if f.name != 'id']

        for symbol, data in ticker_batch.items():
            live_data = {
                'last_price': float(data.get('c', 0)), 'price_change_percent_24h': float(data.get('P', 0)),
                'high_price_24h': float(data.get('h', 0)), 'low_price_24h': float(data.get('l', 0)),
                'quote_volume_24h': float(data.get('q', 0)), 'bid_price': float(data.get('b', 0)),
                'ask_price': float(data.get('a', 0)),
            }
            live_data['spread'] = live_data.get('ask_price', 0) - live_data.get('bid_price', 0)
            
            # Combine live data with pre-calculated metrics
            calculated_metrics = self.calculated_metrics.get(symbol, {})
            full_payload = {**live_data, **calculated_metrics}

            instance = existing_records.get(symbol)
            if instance:
                for key, value in full_payload.items():
                    if hasattr(instance, key):
                        setattr(instance, key, value)
                to_update.append(instance)
            else:
                to_create.append(CryptoData(symbol=symbol, **full_payload))

        if to_create:
            for i in range(0, len(to_create), batch_size):
                CryptoData.objects.bulk_create(to_create[i:i + batch_size], ignore_conflicts=True)
        
        if to_update:
            for i in range(0, len(to_update), batch_size):
                CryptoData.objects.bulk_update(to_update[i:i + batch_size], all_fields)