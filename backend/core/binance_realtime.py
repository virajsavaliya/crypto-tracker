# backend/core/binance_realtime.py
"""
REAL Binance Data Fetcher - Uses actual klines API for 100% accurate data
NO ESTIMATIONS - All data comes directly from Binance
"""

import requests
import logging
from decimal import Decimal
from typing import Dict, List, Optional
from django.core.cache import cache
import time

logger = logging.getLogger(__name__)


class BinanceRealTimeDataFetcher:
    """
    Fetches REAL data from Binance API
    - Uses klines (candlestick) API for historical price/volume data
    - Uses 24hr ticker for current prices
    - NO ESTIMATIONS OR RANDOM DATA
    """
    
    BASE_URL = "https://api.binance.com/api/v3"
    RATE_LIMIT_DELAY = 0.05  # 50ms delay between requests to avoid rate limits
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({'Accept': 'application/json'})
    
    def fetch_ticker_24hr(self, symbol: Optional[str] = None) -> List[Dict]:
        """Fetch 24hr ticker data for one or all symbols"""
        try:
            url = f"{self.BASE_URL}/ticker/24hr"
            if symbol:
                url += f"?symbol={symbol}"
            
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            return [data] if symbol else data
            
        except Exception as e:
            logger.error(f"Failed to fetch 24hr ticker: {e}")
            return []
    
    def fetch_klines(self, symbol: str, interval: str = '1m', limit: int = 60) -> List[List]:
        """
        Fetch REAL historical kline (candlestick) data from Binance
        
        Returns list of klines: [
            [
                1499040000000,      # Open time
                "0.01634000",       # Open
                "0.80000000",       # High
                "0.01575800",       # Low
                "0.01577100",       # Close (price)
                "148976.11427815",  # Volume
                1499644799999,      # Close time
                "2434.19055334",    # Quote asset volume
                308,                # Number of trades
                "1756.87402397",    # Taker buy base asset volume
                "28.46694368",      # Taker buy quote asset volume
                "17928899.62484339" # Ignore
            ],
            ...
        ]
        """
        try:
            # Check cache first (cache for 10 seconds)
            cache_key = f'klines_{symbol}_{interval}_{limit}'
            cached = cache.get(cache_key)
            if cached:
                return cached
            
            url = f"{self.BASE_URL}/klines"
            params = {
                'symbol': symbol,
                'interval': interval,
                'limit': limit
            }
            
            response = self.session.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            klines = response.json()
            
            # Cache for 10 seconds
            cache.set(cache_key, klines, 10)
            
            return klines
            
        except Exception as e:
            logger.error(f"Failed to fetch klines for {symbol}: {e}")
            return []
    
    def calculate_real_metrics(self, symbol: str) -> Dict:
        """
        Calculate 100% REAL metrics using Binance klines data
        Returns actual prices, volumes, and percentage changes
        """
        try:
            # Get 24hr ticker for current data
            ticker_data = self.fetch_ticker_24hr(symbol)
            if not ticker_data:
                return {}
            
            ticker = ticker_data[0]
            current_price = float(ticker['lastPrice'])
            
            # Get 1-minute klines (last 60 minutes)
            klines = self.fetch_klines(symbol, '1m', 60)
            if len(klines) < 2:
                logger.warning(f"Not enough klines data for {symbol}")
                return {}
            
            # Extract real historical data
            metrics = {
                'symbol': symbol,
                'last_price': Decimal(str(current_price)),
                'price_change_percent_24h': Decimal(ticker['priceChangePercent']),
                'high_price_24h': Decimal(ticker['highPrice']),
                'low_price_24h': Decimal(ticker['lowPrice']),
                'quote_volume_24h': Decimal(ticker['quoteVolume']),
                'bid_price': Decimal(ticker['bidPrice']) if ticker['bidPrice'] else None,
                'ask_price': Decimal(ticker['askPrice']) if ticker['askPrice'] else None,
            }
            
            # Calculate spread
            if metrics['bid_price'] and metrics['ask_price']:
                metrics['spread'] = metrics['ask_price'] - metrics['bid_price']
            
            # Calculate REAL price changes from klines
            # Kline format: [open_time, open, high, low, close, volume, close_time, quote_volume, ...]
            
            # Current candle (most recent)
            current_candle = klines[-1]
            
            # 1 minute ago (previous candle)
            if len(klines) >= 2:
                m1_candle = klines[-2]
                m1_price = float(m1_candle[4])  # Close price
                m1_volume = float(m1_candle[7])  # Quote volume
                metrics['m1'] = Decimal(str(round(((current_price - m1_price) / m1_price) * 100, 4)))
                metrics['m1_r_pct'] = metrics['m1']
                metrics['m1_vol'] = Decimal(str(round(m1_volume, 2)))
                metrics['m1_low'] = Decimal(m1_candle[3])
                metrics['m1_high'] = Decimal(m1_candle[2])
                if float(m1_candle[3]) > 0:
                    metrics['m1_range_pct'] = Decimal(str(round(((float(m1_candle[2]) - float(m1_candle[3])) / float(m1_candle[3])) * 100, 4)))
            
            # 5 minutes ago
            if len(klines) >= 6:
                m5_candle = klines[-6]
                m5_price = float(m5_candle[4])
                # Sum volumes for last 5 minutes
                m5_volume = sum(float(klines[i][7]) for i in range(-5, 0))
                metrics['m5'] = Decimal(str(round(((current_price - m5_price) / m5_price) * 100, 4)))
                metrics['m5_r_pct'] = metrics['m5']
                metrics['m5_vol'] = Decimal(str(round(m5_volume, 2)))
                # Calculate 5m high/low from last 5 candles
                m5_highs = [float(klines[i][2]) for i in range(-5, 0)]
                m5_lows = [float(klines[i][3]) for i in range(-5, 0)]
                metrics['m5_low'] = Decimal(str(min(m5_lows)))
                metrics['m5_high'] = Decimal(str(max(m5_highs)))
                if min(m5_lows) > 0:
                    metrics['m5_range_pct'] = Decimal(str(round(((max(m5_highs) - min(m5_lows)) / min(m5_lows)) * 100, 4)))
            
            # 15 minutes ago
            if len(klines) >= 16:
                m15_candle = klines[-16]
                m15_price = float(m15_candle[4])
                m15_volume = sum(float(klines[i][7]) for i in range(-15, 0))
                metrics['m15'] = Decimal(str(round(((current_price - m15_price) / m15_price) * 100, 4)))
                metrics['m15_r_pct'] = metrics['m15']
                metrics['m15_vol'] = Decimal(str(round(m15_volume, 2)))
                # Calculate 15m high/low
                m15_highs = [float(klines[i][2]) for i in range(-15, 0)]
                m15_lows = [float(klines[i][3]) for i in range(-15, 0)]
                metrics['m15_low'] = Decimal(str(min(m15_lows)))
                metrics['m15_high'] = Decimal(str(max(m15_highs)))
                if min(m15_lows) > 0:
                    metrics['m15_range_pct'] = Decimal(str(round(((max(m15_highs) - min(m15_lows)) / min(m15_lows)) * 100, 4)))
            
            # 60 minutes ago (1 hour)
            if len(klines) >= 60:
                m60_candle = klines[-60]
                m60_price = float(m60_candle[4])
                m60_volume = sum(float(klines[i][7]) for i in range(-60, 0))
                metrics['m60'] = Decimal(str(round(((current_price - m60_price) / m60_price) * 100, 4)))
                metrics['m60_r_pct'] = metrics['m60']
                metrics['m60_vol'] = Decimal(str(round(m60_volume, 2)))
                # Calculate 60m high/low
                m60_highs = [float(klines[i][2]) for i in range(-60, 0)]
                m60_lows = [float(klines[i][3]) for i in range(-60, 0)]
                metrics['m60_low'] = Decimal(str(min(m60_lows)))
                metrics['m60_high'] = Decimal(str(max(m60_highs)))
                if min(m60_lows) > 0:
                    metrics['m60_range_pct'] = Decimal(str(round(((max(m60_highs) - min(m60_lows)) / min(m60_lows)) * 100, 4)))
            
            # Calculate volume percentages (percent of 24h volume)
            total_volume_24h = float(ticker['quoteVolume'])
            if total_volume_24h > 0 and 'm1_vol' in metrics:
                metrics['m1_vol_pct'] = Decimal(str(round((float(metrics['m1_vol']) / total_volume_24h) * 100, 4)))
            if total_volume_24h > 0 and 'm5_vol' in metrics:
                metrics['m5_vol_pct'] = Decimal(str(round((float(metrics['m5_vol']) / total_volume_24h) * 100, 4)))
            if total_volume_24h > 0 and 'm15_vol' in metrics:
                metrics['m15_vol_pct'] = Decimal(str(round((float(metrics['m15_vol']) / total_volume_24h) * 100, 4)))
            if total_volume_24h > 0 and 'm60_vol' in metrics:
                metrics['m60_vol_pct'] = Decimal(str(round((float(metrics['m60_vol']) / total_volume_24h) * 100, 4)))
            
            logger.info(f"✅ REAL DATA for {symbol}: 1m%={metrics.get('m1', 0)}%, 5m%={metrics.get('m5', 0)}%, 15m%={metrics.get('m15', 0)}%")
            
            return metrics
            
        except Exception as e:
            logger.error(f"Failed to calculate real metrics for {symbol}: {e}")
            return {}
    
    def fetch_batch_with_delay(self, symbols: List[str]) -> List[Dict]:
        """Fetch data for multiple symbols with rate limit protection"""
        results = []
        
        for symbol in symbols:
            metrics = self.calculate_real_metrics(symbol)
            if metrics:
                results.append(metrics)
            
            # Rate limit protection
            time.sleep(self.RATE_LIMIT_DELAY)
        
        return results


# Global instance
realtime_fetcher = BinanceRealTimeDataFetcher()
