import asyncio
import json
import requests
import time
import numpy as np
from concurrent.futures import ThreadPoolExecutor
from django.core.management.base import BaseCommand
import websockets
from channels.layers import get_channel_layer
from core.models import CryptoData
from channels.db import database_sync_to_async
from core.serializers import CryptoDataSerializer, CryptoDataFreeSerializer

class Command(BaseCommand):
    help = 'Starts a high-performance process to fetch, pre-load, calculate, and save all crypto data.'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.latest_ticker_data = {}
        self.kline_history = {}
        self.calculated_metrics = {}
        self.data_lock = asyncio.Lock()
        self.channel_layer = get_channel_layer()

    def get_all_symbols(self):
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
                                    if symbol := ticker.get('s'): self.latest_ticker_data[symbol] = ticker
                            
                            elif '@kline_1m' in stream_type:
                                symbol, kline_data = payload.get('s'), payload.get('k')
                                if symbol and kline_data and kline_data.get('x'):
                                    self.update_kline_history(symbol, kline_data)
                                    asyncio.create_task(self.recalculate_metrics_for_symbol(symbol))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"WebSocket error: {e}, reconnecting..."))
                await asyncio.sleep(5)

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
            buy_volume = np.sum(period_klines['q'])
            metrics.update({
                f'{key}_nv': np.sum((period_klines['c'] - period_klines['o']) * period_klines['v']),
                f'{key}_bv': buy_volume,
                f'{key}_sv': np.sum(period_klines['v'] * (period_klines['h'] - period_klines['c']))
            })
            if key in ['m1','m5','m10','m15','m60']: metrics[f'{key}_vol'] = total_volume
        return metrics

    async def save_and_broadcast_data(self):
        while True:
            # Increased interval to reduce database load
            await asyncio.sleep(10)
            
            async with self.data_lock:
                ticker_batch = self.latest_ticker_data.copy()
            if not ticker_batch: continue
            
            self.stdout.write(f"\nProcessing batch of {len(ticker_batch)} symbols at {time.strftime('%H:%M:%S')}...")
            
            updated_instances_data = await self.bulk_upsert_database(ticker_batch)
            
            if updated_instances_data:
                premium_data = CryptoDataSerializer(updated_instances_data, many=True).data
                free_data = CryptoDataFreeSerializer(updated_instances_data, many=True).data
                
                await self.channel_layer.group_send(
                    "crypto_premium", {"type": "crypto.update", "data": premium_data}
                )
                await self.channel_layer.group_send(
                    "crypto_free", {"type": "crypto.update", "data": free_data}
                )
            self.stdout.write(self.style.SUCCESS("Batch processed and broadcasted."))

    @database_sync_to_async
    def bulk_upsert_database(self, ticker_batch):
        """
        Performs a highly efficient bulk "upsert" (update or insert).
        This is much faster than fetching and then updating.
        """
        all_fields = [f.name for f in CryptoData._meta.get_fields() if f.name not in ['id', 'symbol']]
        instances_to_upsert = []

        for symbol, data in ticker_batch.items():
            live_data = {
                'last_price': float(data.get('c', 0)), 'price_change_percent_24h': float(data.get('P', 0)),
                'high_price_24h': float(data.get('h', 0)), 'low_price_24h': float(data.get('l', 0)),
                'quote_volume_24h': float(data.get('q', 0)), 'bid_price': float(data.get('b', 0)),
                'ask_price': float(data.get('a', 0)),
            }
            live_data['spread'] = live_data.get('ask_price', 0) - live_data.get('bid_price', 0)
            calculated_metrics = self.calculated_metrics.get(symbol, {})
            full_payload = {**live_data, **calculated_metrics}
            
            # Set default values for all fields to avoid IntegrityError on insert
            for field in all_fields:
                if field not in full_payload:
                    full_payload[field] = None
            
            instances_to_upsert.append(CryptoData(symbol=symbol, **full_payload))

        if instances_to_upsert:
            CryptoData.objects.bulk_create(
                instances_to_upsert,
                batch_size=500,
                update_conflicts=True,
                unique_fields=['symbol'],
                update_fields=all_fields
            )
        
        # Return the data for broadcasting
        return instances_to_upsert