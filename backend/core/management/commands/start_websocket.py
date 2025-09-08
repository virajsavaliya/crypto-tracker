# File: core/management/commands/start_websocket.py

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
from django.db import OperationalError, transaction

BATCH_SIZE = 200       # number of rows per DB operation
MAX_RETRIES = 3        # retry attempts if DB connection fails
RETRY_DELAY = 5        # seconds between retries


class Command(BaseCommand):
    help = 'Starts a high-performance process to fetch, pre-load, calculate, and save all crypto data.'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.latest_data_from_stream = {}
        self.kline_history = {}

    def get_all_symbols(self):
        """Fetches ALL USDT and BTC trading pairs from Binance."""
        try:
            self.stdout.write("Fetching all tradable symbols from Binance API...")
            url = "https://api.binance.com/api/v3/ticker/24hr"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            all_tickers = response.json()

            usdt_pairs = [d['symbol'].lower() for d in all_tickers if d['symbol'].endswith('USDT')]
            btc_pairs = [d['symbol'].lower() for d in all_tickers if d['symbol'].endswith('BTC')]

            symbols = list(set(usdt_pairs + btc_pairs))
            self.stdout.write(self.style.SUCCESS(f"Found {len(symbols)} total symbols to track."))
            return symbols
        except requests.exceptions.RequestException as e:
            self.stdout.write(self.style.ERROR(f"Could not fetch symbols: {e}"))
            return []

    def _fetch_history_for_symbol(self, symbol):
        """Helper function to fetch historical klines for a single symbol."""
        try:
            url = f"https://api.binance.com/api/v3/klines?symbol={symbol.upper()}&interval=1m&limit=150"
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                klines_data = response.json()
                return symbol, [
                    {'t': k[0], 'o': k[1], 'h': k[2], 'l': k[3], 'c': k[4], 'v': k[5], 'q': k[7]}
                    for k in klines_data
                ]
        except requests.exceptions.RequestException:
            return symbol, None
        return symbol, None

    def prefetch_historical_data(self, symbols):
        """Uses a thread pool to fetch historical data for all symbols in parallel."""
        self.stdout.write(f"Pre-fetching historical data for {len(symbols)} symbols using multiple threads...")
        with ThreadPoolExecutor(max_workers=20) as executor:
            results = executor.map(self._fetch_history_for_symbol, symbols)

        for symbol, klines in results:
            if klines:
                self.kline_history[symbol] = klines
        self.stdout.write(self.style.SUCCESS("Historical pre-fetch complete. All calculations are now active."))

    # --- MODIFICATION 1: ADDED A "FOREVER" LOOP ---
    # This ensures the entire process restarts if it ever crashes completely.
    def handle(self, *args, **options):
        while True:
            try:
                self.stdout.write(self.style.SUCCESS('Starting main websocket logic...'))
                asyncio.run(self.main_logic())
            except KeyboardInterrupt:
                self.stdout.write(self.style.SUCCESS('Process stopped manually.'))
                break
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Main loop crashed with error: {e}"))
                self.stdout.write(self.style.WARNING("Restarting in 10 seconds..."))
                time.sleep(10)


    async def main_logic(self):
        symbols = self.get_all_symbols()
        if not symbols:
            self.stdout.write(self.style.WARNING("No symbols fetched, will retry in 30 seconds."))
            await asyncio.sleep(30)
            return

        self.prefetch_historical_data(symbols)

        kline_streams = [f"{symbol}@kline_1m" for symbol in symbols]
        # Limiting streams to avoid connection issues, Binance has limits.
        # You may need multiple workers for all symbols.
        uri = f"wss://stream.binance.com:9443/stream?streams={'/'.join(['!ticker@arr'] + kline_streams[:950])}"


        receiver_task = asyncio.create_task(self.receive_websocket_data(uri))
        saver_task = asyncio.create_task(self.process_and_save_data_periodically())
        await asyncio.gather(receiver_task, saver_task)

    # --- MODIFICATION 2: IMPROVED RECONNECTION AND ERROR HANDLING ---
    async def receive_websocket_data(self, uri):
        while True:
            try:
                async with websockets.connect(uri, ping_interval=20, ping_timeout=20) as websocket:
                    self.stdout.write(self.style.SUCCESS('WebSocket connected and receiving live data.'))
                    async for message in websocket:
                        try:
                            data = json.loads(message)
                            stream_type, payload = data.get('stream'), data.get('data')
                            if not stream_type or not payload:
                                continue

                            if stream_type == '!ticker@arr':
                                for ticker in payload:
                                    if symbol := ticker.get('s'):
                                        self.latest_data_from_stream[symbol.lower()] = ticker
                            elif '@kline_1m' in stream_type:
                                if (symbol := payload.get('s')) and (kline := payload.get('k')) and kline.get('x'):
                                    # Ensure symbol is lowercase for consistency
                                    symbol_lower = symbol.lower()
                                    if symbol_lower not in self.kline_history:
                                        self.kline_history[symbol_lower] = []
                                    self.kline_history[symbol_lower].append(kline)
                        except json.JSONDecodeError:
                            self.stdout.write(self.style.WARNING("Could not decode JSON from websocket message."))
                        except Exception as e:
                            self.stdout.write(self.style.ERROR(f"Error processing websocket message: {e}"))

            except websockets.exceptions.ConnectionClosed as e:
                self.stdout.write(self.style.ERROR(f"WebSocket connection closed: {e}. Reconnecting in 5 seconds..."))
                await asyncio.sleep(5)
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"An unexpected WebSocket error occurred: {e}. Reconnecting in 5 seconds..."))
                await asyncio.sleep(5)

    async def process_and_save_data_periodically(self):
        while True:
            await asyncio.sleep(3) # This is your 3-second database update interval
            data_batch = self.latest_data_from_stream
            self.latest_data_from_stream = {}
            if not data_batch:
                continue

            self.stdout.write(f"\nProcessing batch of {len(data_batch)} symbols at {time.strftime('%H:%M:%S')}...")
            await self.bulk_update_database(data_batch)
            self.stdout.write(self.style.SUCCESS("Batch database update complete."))
            self.cleanup_old_klines()

    def calculate_metrics_from_history(self, symbol):
        metrics = {}
        history = self.kline_history.get(symbol.lower(), [])
        if len(history) < 2:
            return metrics

        dtype = [('t', 'f8'), ('o', 'f8'), ('h', 'f8'), ('l', 'f8'),
                 ('c', 'f8'), ('v', 'f8'), ('bv', 'f8')]
        klines = np.array([
            (float(k['t']), float(k['o']), float(k['h']),
             float(k['l']), float(k['c']), float(k['v']), float(k['q']))
            for k in history if k.get('q') is not None
        ], dtype=dtype)
        
        if len(klines) == 0:
            return {}

        now_ms = time.time() * 1000
        intervals = {'m1': 1, 'm2': 2, 'm3': 3, 'm5': 5, 'm10': 10, 'm15': 15, 'm60': 60}
        for key, minutes in intervals.items():
            start_time_ms = now_ms - (minutes * 60 * 1000)
            period_klines = klines[klines['t'] >= start_time_ms]
            if len(period_klines) < 1:
                continue

            open_price, close_price = period_klines[0]['o'], period_klines[-1]['c']
            if open_price > 0:
                metrics[key] = ((close_price - open_price) / open_price) * 100

            low, high = np.min(period_klines['l']), np.max(period_klines['h'])
            metrics.update({f'{key}_low': low, f'{key}_high': high})
            if open_price > 0:
                metrics[f'{key}_range_pct'] = ((high - low) / open_price) * 100

            total_volume = np.sum(period_klines['v'])
            buy_volume = np.sum(period_klines['bv'])
            metrics.update({
                f'{key}_nv': np.sum((period_klines['c'] - period_klines['o']) * period_klines['v']),
                f'{key}_bv': buy_volume,
                f'{key}_sv': total_volume - buy_volume
            })
            if key in ['m1', 'm5', 'm10', 'm15', 'm60']:
                metrics[f'{key}_vol'] = total_volume

            prev_start_time_ms = start_time_ms - (minutes * 60 * 1000)
            prev_klines = klines[(klines['t'] >= prev_start_time_ms) & (klines['t'] < start_time_ms)]
            if len(prev_klines) > 0 and (prev_total_volume := np.sum(prev_klines['v'])) > 0:
                metrics[f'{key}_vol_pct'] = ((total_volume - prev_total_volume) / prev_total_volume) * 100

        # RSI calculations
        rsi_intervals = {'1m': 14, '3m': 42, '5m': 70, '15m': 210}
        for key, periods in rsi_intervals.items():
            if len(klines) > periods:
                changes = np.diff(klines['c'])
                gains, losses = changes[changes > 0], -changes[changes < 0]
                if len(gains) < periods or len(losses) < periods:
                    continue
                avg_gain, avg_loss = np.mean(gains[:periods]), np.mean(losses[:periods])
                if avg_loss > 0:
                    rs = avg_gain / avg_loss
                    metrics[f'rsi_{key}'] = 100 - (100 / (1 + rs))
                else:
                    metrics[f'rsi_{key}'] = 100
        return metrics

    @database_sync_to_async
    def bulk_update_database(self, data_batch):
        """Performs a safe bulk update/create operation with retry + chunking."""
        symbols = data_batch.keys()

        for attempt in range(MAX_RETRIES):
            try:
                existing_records = {obj.symbol: obj for obj in CryptoData.objects.filter(symbol__in=symbols)}
                to_create = []
                to_update = []
                all_fields = [f.name for f in CryptoData._meta.get_fields() if f.name != 'id']

                for symbol, data in data_batch.items():
                    live_data = {
                        'last_price': float(data.get('c', 0)),
                        'price_change_percent_24h': float(data.get('P', 0)),
                        'high_price_24h': float(data.get('h', 0)),
                        'low_price_24h': float(data.get('l', 0)),
                        'quote_volume_24h': float(data.get('q', 0)),
                        'bid_price': float(data.get('b', 0)),
                        'ask_price': float(data.get('a', 0)),
                    }
                    live_data['spread'] = live_data.get('ask_price', 0) - live_data.get('bid_price', 0)
                    calculated_metrics = self.calculate_metrics_from_history(symbol)
                    full_payload = {**live_data, **calculated_metrics}

                    if symbol in existing_records:
                        record = existing_records[symbol]
                        for key, value in full_payload.items():
                            if key in all_fields:
                                setattr(record, key, value)
                        to_update.append(record)
                    else:
                        new_record = CryptoData(symbol=symbol)
                        for key, value in full_payload.items():
                             if key in all_fields:
                                setattr(new_record, key, value)
                        to_create.append(new_record)

                if to_create:
                    for i in range(0, len(to_create), BATCH_SIZE):
                        CryptoData.objects.bulk_create(to_create[i:i + BATCH_SIZE], ignore_conflicts=True)

                if to_update:
                    update_fields = [f for f in all_fields if f != 'symbol']
                    for i in range(0, len(to_update), BATCH_SIZE):
                        with transaction.atomic():
                            CryptoData.objects.bulk_update(to_update[i:i + BATCH_SIZE], update_fields)
                return
            except OperationalError as e:
                self.stdout.write(self.style.ERROR(f"Database error on attempt {attempt + 1}: {e}"))
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY)
                    continue
                else:
                    self.stdout.write(self.style.ERROR("Max retries reached. Database operation failed."))
                    raise e
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"An unexpected error occurred in bulk_update_database: {e}"))
                break


    def cleanup_old_klines(self):
        cutoff_ms = (time.time() - (150 * 60)) * 1000
        for symbol in self.kline_history:
            self.kline_history[symbol] = [
                k for k in self.kline_history[symbol] if float(k.get('t', 0)) >= cutoff_ms
            ]
