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
            url = f"https://api.binance.com/api/v3/klines?symbol={symbol.upper()}&interval=1m&limit=250"
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                klines_data = response.json()
                return symbol, [{'t': k[0], 'o': k[1], 'h': k[2], 'l': k[3], 'c': k[4], 'v': k[5], 'q': k[7]} for k in klines_data]
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

    def handle(self, *args, **options):
        while True:
            try:
                asyncio.run(self.main_logic())
            except KeyboardInterrupt:
                self.stdout.write(self.style.SUCCESS('Process stopped manually.'))
                break
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"An error occurred: {e}. Restarting in 10 seconds..."))
                time.sleep(10)

    async def main_logic(self):
        symbols = self.get_all_symbols()
        if not symbols: return

        self.prefetch_historical_data(symbols)

        kline_streams = [f"{symbol}@kline_1m" for symbol in symbols]
        uri = f"wss://stream.binance.com:9443/stream?streams={'/'.join(['!ticker@arr'] + kline_streams[:200])}"

        receiver_task = asyncio.create_task(self.receive_websocket_data(uri))
        saver_task = asyncio.create_task(self.process_and_save_data_periodically())
        await asyncio.gather(receiver_task, saver_task)

    async def receive_websocket_data(self, uri):
        while True:
            try:
                async with websockets.connect(uri, ping_interval=20, ping_timeout=20) as websocket:
                    self.stdout.write(self.style.SUCCESS('WebSocket connected and receiving live data.'))
                    async for message in websocket:
                        data = json.loads(message)
                        stream_type, payload = data.get('stream'), data.get('data')
                        if not stream_type or not payload: continue

                        if stream_type == '!ticker@arr':
                            for ticker in payload:
                                if symbol := ticker.get('s'): self.latest_data_from_stream[symbol] = ticker
                        elif '@kline_1m' in stream_type:
                            if (symbol := payload.get('s')) and (kline := payload.get('k')) and kline.get('x'):
                                if symbol not in self.kline_history: self.kline_history[symbol] = []
                                self.kline_history[symbol].append(kline)
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"WebSocket error: {e}, reconnecting..."))
                await asyncio.sleep(5)

    async def process_and_save_data_periodically(self):
        while True:
            await asyncio.sleep(3)
            data_batch = self.latest_data_from_stream
            self.latest_data_from_stream = {}
            if not data_batch: continue

            self.stdout.write(f"\nProcessing batch of {len(data_batch)} symbols at {time.strftime('%H:%M:%S')}...")
            await self.bulk_update_database(data_batch)
            self.stdout.write(self.style.SUCCESS("Batch database update complete."))
            self.cleanup_old_klines()

    def calculate_metrics_from_history(self, symbol):
        metrics = {}
        history = self.kline_history.get(symbol.lower(), [])
        if len(history) < 2: return metrics

        dtype = [('t', 'f8'), ('o', 'f8'), ('h', 'f8'), ('l', 'f8'), ('c', 'f8'), ('v', 'f8'), ('bv', 'f8')]
        klines = np.array([(float(k['t']), float(k['o']), float(k['h']), float(k['l']), float(k['c']), float(k['v']), float(k['q'])) for k in history], dtype=dtype)
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
            buy_volume = np.sum(period_klines['bv'])
            metrics.update({
                f'{key}_nv': np.sum((period_klines['c'] - period_klines['o']) * period_klines['v']),
                f'{key}_bv': buy_volume,
                f'{key}_sv': total_volume - buy_volume
            })
            if key in ['m1','m5','m10','m15','m60']: metrics[f'{key}_vol'] = total_volume

            prev_start_time_ms = start_time_ms - (minutes * 60 * 1000)
            prev_klines = klines[(klines['t'] >= prev_start_time_ms) & (klines['t'] < start_time_ms)]
            if len(prev_klines) > 0 and (prev_total_volume := np.sum(prev_klines['v'])) > 0:
                metrics[f'{key}_vol_pct'] = ((total_volume - prev_total_volume) / prev_total_volume) * 100
        
        rsi_intervals = {'1m': 14, '3m': 42, '5m': 70, '15m': 210}
        for key, periods in rsi_intervals.items():
            if len(klines) > periods:
                changes = np.diff(klines['c'])
                gains, losses = changes[changes > 0], -changes[changes < 0]
                if len(gains) < periods or len(losses) < periods: continue
                avg_gain, avg_loss = np.mean(gains[:periods]), np.mean(losses[:periods])
                if avg_loss > 0: metrics[f'rsi_{key}'] = 100 - (100 / (1 + (avg_gain / avg_loss)))
                else: metrics[f'rsi_{key}'] = 100
        return metrics

    @database_sync_to_async
    def bulk_update_database(self, data_batch):
        """Performs a highly efficient bulk update/create operation in smaller batches."""
        symbols = list(data_batch.keys())
        batch_size = 500  # Process 500 records at a time

        # Fetch existing records in one query
        existing_records = {obj.symbol: obj for obj in CryptoData.objects.filter(symbol__in=symbols)}
        
        to_create = []
        to_update = []
        
        all_fields = [f.name for f in CryptoData._meta.get_fields() if f.name != 'id']

        for symbol, data in data_batch.items():
            live_data = {
                'last_price': float(data.get('c', 0)), 'price_change_percent_24h': float(data.get('P', 0)),
                'high_price_24h': float(data.get('h', 0)), 'low_price_24h': float(data.get('l', 0)),
                'quote_volume_24h': float(data.get('q', 0)), 'bid_price': float(data.get('b', 0)),
                'ask_price': float(data.get('a', 0)),
            }
            live_data['spread'] = live_data.get('ask_price', 0) - live_data.get('bid_price', 0)
            
            calculated_metrics = self.calculate_metrics_from_history(symbol)
            full_payload = {**live_data, **calculated_metrics}

            if symbol in existing_records:
                record = existing_records[symbol]
                for key, value in full_payload.items():
                    # Check for NaN or infinity before setting attribute
                    if isinstance(value, float) and (value != value or value == float('inf') or value == float('-inf')):
                        value = None  # or 0, depending on how you want to handle it
                    setattr(record, key, value)
                to_update.append(record)
            else:
                new_record = CryptoData(symbol=symbol, **full_payload)
                to_create.append(new_record)

        # Process creations in batches
        if to_create:
            for i in range(0, len(to_create), batch_size):
                batch = to_create[i:i + batch_size]
                CryptoData.objects.bulk_create(batch)
        
        # Process updates in batches
        if to_update:
            for i in range(0, len(to_update), batch_size):
                batch = to_update[i:i + batch_size]
                CryptoData.objects.bulk_update(batch, all_fields)

    def cleanup_old_klines(self):
        cutoff_ms = (time.time() - (250 * 60)) * 1000
        for symbol in self.kline_history:
            self.kline_history[symbol] = [k for k in self.kline_history[symbol] if float(k.get('t', 0)) >= cutoff_ms]