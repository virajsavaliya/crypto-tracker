# backend/core/crypto_trading_dashboard.py
# Comprehensive Real-Time Crypto Trading Dashboard
# Fetches: Symbol, Last, Bid, Ask, Spread, 24h data, % changes, RSI, Volumes
# Uses: Binance REST API + WebSocket streams for live updates

import json
import requests
import numpy as np
import pandas as pd
import time
import asyncio
import websocket
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from collections import defaultdict, deque
from dataclasses import dataclass
import logging
import signal
import sys

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class TradingData:
    """Data structure for trading information"""
    symbol: str
    last: float = 0.0
    bid: float = 0.0
    ask: float = 0.0
    spread: float = 0.0
    high_24h: float = 0.0
    low_24h: float = 0.0
    change_24h: float = 0.0
    volume_24h: float = 0.0
    
    # Percentage changes
    change_1m: float = 0.0
    change_5m: float = 0.0
    change_10m: float = 0.0
    change_15m: float = 0.0
    change_60m: float = 0.0
    
    # Volumes
    volume_1m: float = 0.0
    volume_5m: float = 0.0
    volume_10m: float = 0.0
    volume_15m: float = 0.0
    volume_60m: float = 0.0
    
    # RSI values
    rsi_1m: float = 50.0
    rsi_3m: float = 50.0
    rsi_5m: float = 50.0
    rsi_15m: float = 50.0
    
    # Buy/Sell/Net Volumes
    buy_volume_1m: float = 0.0
    buy_volume_5m: float = 0.0
    buy_volume_15m: float = 0.0
    buy_volume_60m: float = 0.0
    
    sell_volume_1m: float = 0.0
    sell_volume_5m: float = 0.0
    sell_volume_15m: float = 0.0
    sell_volume_60m: float = 0.0
    
    net_volume_1m: float = 0.0
    net_volume_5m: float = 0.0
    net_volume_15m: float = 0.0
    net_volume_60m: float = 0.0

class BinanceAPIClient:
    """Binance REST API client for 24h ticker and book ticker data"""
    
    BASE_URL = "https://api.binance.com/api/v3"
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'CryptoTradingDashboard/1.0'
        })
    
    def get_24h_ticker_stats(self) -> List[Dict]:
        """Get 24h ticker statistics for all symbols"""
        try:
            response = self.session.get(f"{self.BASE_URL}/ticker/24hr")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error fetching 24h ticker stats: {e}")
            return []
    
    def get_book_ticker(self) -> List[Dict]:
        """Get best bid/ask prices for all symbols"""
        try:
            response = self.session.get(f"{self.BASE_URL}/ticker/bookTicker")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error fetching book ticker: {e}")
            return []
    
    def get_exchange_info(self) -> Dict:
        """Get exchange information and active symbols"""
        try:
            response = self.session.get(f"{self.BASE_URL}/exchangeInfo")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error fetching exchange info: {e}")
            return {}

class RSICalculator:
    """Fast RSI calculation for multiple timeframes"""
    
    @staticmethod
    def calculate_rsi(prices: List[float], period: int = 14) -> float:
        """Calculate RSI using Wilder's smoothing method"""
        if len(prices) < period + 1:
            return 50.0
        
        prices = np.array(prices)
        deltas = np.diff(prices)
        
        # Separate gains and losses
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)
        
        # Calculate initial averages
        avg_gain = np.mean(gains[:period])
        avg_loss = np.mean(losses[:period])
        
        # Wilder's smoothing for subsequent values
        for i in range(period, len(gains)):
            avg_gain = (avg_gain * (period - 1) + gains[i]) / period
            avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        
        if avg_loss == 0:
            return 100.0
        
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        return float(rsi)

class KlineDataProcessor:
    """Process kline data for percentage calculations and RSI"""
    
    def __init__(self):
        # Store kline data for different timeframes
        self.kline_data = defaultdict(lambda: defaultdict(deque))  # symbol -> timeframe -> deque
        self.price_history = defaultdict(lambda: defaultdict(deque))  # For RSI calculation
        
        # Timeframe mapping (minutes)
        self.timeframes = {
            '1m': 1, '3m': 3, '5m': 5, '10m': 10, '15m': 15, '60m': 60
        }
    
    def process_kline(self, symbol: str, kline_data: Dict):
        """Process incoming kline data"""
        timeframe = kline_data.get('s', '1m')  # Default to 1m
        close_price = float(kline_data.get('c', 0))
        volume = float(kline_data.get('v', 0))
        
        # Store kline data (keep last 100 entries)
        if len(self.kline_data[symbol][timeframe]) >= 100:
            self.kline_data[symbol][timeframe].popleft()
        self.kline_data[symbol][timeframe].append({
            'close': close_price,
            'volume': volume,
            'timestamp': time.time()
        })
        
        # Store price history for RSI
        if len(self.price_history[symbol][timeframe]) >= 100:
            self.price_history[symbol][timeframe].popleft()
        self.price_history[symbol][timeframe].append(close_price)
    
    def calculate_percentage_change(self, symbol: str, timeframe: str) -> float:
        """Calculate percentage change for given timeframe"""
        if symbol not in self.kline_data or timeframe not in self.kline_data[symbol]:
            return 0.0
        
        data = list(self.kline_data[symbol][timeframe])
        if len(data) < 2:
            return 0.0
        
        current_price = data[-1]['close']
        
        # Find price from X minutes ago
        target_time = time.time() - (self.timeframes[timeframe] * 60)
        
        # Find closest price to target time
        closest_price = current_price
        for entry in reversed(data[:-1]):
            if entry['timestamp'] <= target_time:
                closest_price = entry['close']
                break
        
        if closest_price == 0:
            return 0.0
        
        return ((current_price - closest_price) / closest_price) * 100
    
    def calculate_volume_sum(self, symbol: str, timeframe: str) -> float:
        """Calculate volume sum for given timeframe"""
        if symbol not in self.kline_data or timeframe not in self.kline_data[symbol]:
            return 0.0
        
        data = list(self.kline_data[symbol][timeframe])
        target_time = time.time() - (self.timeframes[timeframe] * 60)
        
        total_volume = 0.0
        for entry in data:
            if entry['timestamp'] >= target_time:
                total_volume += entry['volume']
        
        return total_volume
    
    def calculate_rsi(self, symbol: str, timeframe: str, period: int = 14) -> float:
        """Calculate RSI for given symbol and timeframe"""
        if symbol not in self.price_history or timeframe not in self.price_history[symbol]:
            return 50.0
        
        prices = list(self.price_history[symbol][timeframe])
        return RSICalculator.calculate_rsi(prices, period)

class TradeVolumeTracker:
    """Track buy/sell volumes from trade stream"""
    
    def __init__(self):
        self.trade_data = defaultdict(lambda: defaultdict(list))  # symbol -> timeframe -> trades
        self.timeframes_minutes = {
            '1m': 1, '5m': 5, '15m': 15, '60m': 60
        }
    
    def process_trade(self, symbol: str, trade_data: Dict):
        """Process incoming trade data"""
        try:
            price = float(trade_data.get('p', 0))
            quantity = float(trade_data.get('q', 0))
            is_buyer_maker = trade_data.get('m', False)  # True if buyer is market maker (sell)
            timestamp = time.time()
            
            trade_info = {
                'price': price,
                'quantity': quantity,
                'value': price * quantity,
                'is_sell': is_buyer_maker,  # If buyer is maker, it's a sell order
                'timestamp': timestamp
            }
            
            # Add to all timeframes
            for timeframe in self.timeframes_minutes:
                self.trade_data[symbol][timeframe].append(trade_info)
                
                # Keep only recent trades (cleanup old data)
                cutoff_time = timestamp - (self.timeframes_minutes[timeframe] * 60)
                self.trade_data[symbol][timeframe] = [
                    trade for trade in self.trade_data[symbol][timeframe]
                    if trade['timestamp'] >= cutoff_time
                ]
                
        except Exception as e:
            logger.error(f"Error processing trade for {symbol}: {e}")
    
    def get_volume_metrics(self, symbol: str, timeframe: str) -> Tuple[float, float, float]:
        """Get buy volume, sell volume, and net volume"""
        if symbol not in self.trade_data or timeframe not in self.trade_data[symbol]:
            return 0.0, 0.0, 0.0
        
        trades = self.trade_data[symbol][timeframe]
        current_time = time.time()
        cutoff_time = current_time - (self.timeframes_minutes[timeframe] * 60)
        
        buy_volume = 0.0
        sell_volume = 0.0
        
        for trade in trades:
            if trade['timestamp'] >= cutoff_time:
                if trade['is_sell']:
                    sell_volume += trade['value']
                else:
                    buy_volume += trade['value']
        
        net_volume = buy_volume - sell_volume
        return buy_volume, sell_volume, net_volume

class WebSocketManager:
    """Manage WebSocket connections for real-time data"""
    
    def __init__(self, symbols: List[str], kline_processor: KlineDataProcessor, trade_tracker: TradeVolumeTracker):
        self.symbols = symbols
        self.kline_processor = kline_processor
        self.trade_tracker = trade_tracker
        self.ws_connections = {}
        self.running = True
    
    def create_stream_url(self, stream_type: str) -> str:
        """Create WebSocket stream URL"""
        base_url = "wss://stream.binance.com:9443/ws/"
        
        if stream_type == "kline":
            # Subscribe to 1m, 3m, 5m, 15m, 60m klines for all symbols
            streams = []
            timeframes = ['1m', '3m', '5m', '15m', '1h']  # 1h = 60m
            
            for symbol in self.symbols[:50]:  # Limit to avoid URL length issues
                for tf in timeframes:
                    streams.append(f"{symbol.lower()}@kline_{tf}")
            
            return base_url + "/".join(streams)
        
        elif stream_type == "trade":
            # Subscribe to trade streams for volume tracking
            streams = [f"{symbol.lower()}@aggTrade" for symbol in self.symbols[:50]]
            return base_url + "/".join(streams)
        
        return base_url
    
    def on_kline_message(self, ws, message):
        """Handle kline WebSocket messages"""
        try:
            data = json.loads(message)
            if 'stream' in data and 'data' in data:
                stream_name = data['stream']
                kline_data = data['data']
                
                if '@kline_' in stream_name:
                    symbol = kline_data['s']
                    self.kline_processor.process_kline(symbol, kline_data['k'])
                    
        except Exception as e:
            logger.error(f"Error processing kline message: {e}")
    
    def on_trade_message(self, ws, message):
        """Handle trade WebSocket messages"""
        try:
            data = json.loads(message)
            if 'stream' in data and 'data' in data:
                stream_name = data['stream']
                trade_data = data['data']
                
                if '@aggTrade' in stream_name:
                    symbol = trade_data['s']
                    self.trade_tracker.process_trade(symbol, trade_data)
                    
        except Exception as e:
            logger.error(f"Error processing trade message: {e}")
    
    def start_websockets(self):
        """Start WebSocket connections"""
        def start_kline_ws():
            url = self.create_stream_url("kline")
            ws = websocket.WebSocketApp(url, on_message=self.on_kline_message)
            ws.run_forever()
        
        def start_trade_ws():
            url = self.create_stream_url("trade")
            ws = websocket.WebSocketApp(url, on_message=self.on_trade_message)
            ws.run_forever()
        
        # Start in separate threads
        threading.Thread(target=start_kline_ws, daemon=True).start()
        threading.Thread(target=start_trade_ws, daemon=True).start()

class CryptoTradingDashboard:
    """Main trading dashboard class"""
    
    def __init__(self):
        self.api_client = BinanceAPIClient()
        self.kline_processor = KlineDataProcessor()
        self.trade_tracker = TradeVolumeTracker()
        self.trading_data = {}
        self.symbols = []
        self.ws_manager = None
        self.running = True
        
        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
    
    def signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        logger.info("Shutting down trading dashboard...")
        self.running = False
        sys.exit(0)
    
    def initialize_symbols(self):
        """Get all active trading symbols"""
        logger.info("Fetching active trading symbols...")
        exchange_info = self.api_client.get_exchange_info()
        
        if not exchange_info:
            logger.error("Failed to fetch exchange info")
            return
        
        # Filter active USDT pairs
        self.symbols = [
            symbol['symbol'] for symbol in exchange_info.get('symbols', [])
            if symbol['status'] == 'TRADING' and symbol['symbol'].endswith('USDT')
        ]
        
        logger.info(f"Found {len(self.symbols)} active USDT trading pairs")
        
        # Initialize trading data
        for symbol in self.symbols:
            self.trading_data[symbol] = TradingData(symbol=symbol)
    
    def fetch_24h_data(self):
        """Fetch 24h ticker statistics"""
        logger.info("Fetching 24h ticker data...")
        ticker_data = self.api_client.get_24h_ticker_stats()
        
        for ticker in ticker_data:
            symbol = ticker['symbol']
            if symbol in self.trading_data:
                self.trading_data[symbol].last = float(ticker['lastPrice'])
                self.trading_data[symbol].high_24h = float(ticker['highPrice'])
                self.trading_data[symbol].low_24h = float(ticker['lowPrice'])
                self.trading_data[symbol].change_24h = float(ticker['priceChangePercent'])
                self.trading_data[symbol].volume_24h = float(ticker['volume'])
    
    def fetch_book_ticker_data(self):
        """Fetch best bid/ask prices"""
        logger.info("Fetching book ticker data...")
        book_data = self.api_client.get_book_ticker()
        
        for book in book_data:
            symbol = book['symbol']
            if symbol in self.trading_data:
                bid = float(book['bidPrice'])
                ask = float(book['askPrice'])
                
                self.trading_data[symbol].bid = bid
                self.trading_data[symbol].ask = ask
                self.trading_data[symbol].spread = ((ask - bid) / bid) * 100 if bid > 0 else 0
    
    def update_calculated_metrics(self):
        """Update all calculated metrics (%, RSI, volumes)"""
        for symbol in self.symbols:
            if symbol not in self.trading_data:
                continue
            
            data = self.trading_data[symbol]
            
            # Update percentage changes
            data.change_1m = self.kline_processor.calculate_percentage_change(symbol, '1m')
            data.change_5m = self.kline_processor.calculate_percentage_change(symbol, '5m')
            data.change_10m = self.kline_processor.calculate_percentage_change(symbol, '10m')
            data.change_15m = self.kline_processor.calculate_percentage_change(symbol, '15m')
            data.change_60m = self.kline_processor.calculate_percentage_change(symbol, '60m')
            
            # Update volumes
            data.volume_1m = self.kline_processor.calculate_volume_sum(symbol, '1m')
            data.volume_5m = self.kline_processor.calculate_volume_sum(symbol, '5m')
            data.volume_10m = self.kline_processor.calculate_volume_sum(symbol, '10m')
            data.volume_15m = self.kline_processor.calculate_volume_sum(symbol, '15m')
            data.volume_60m = self.kline_processor.calculate_volume_sum(symbol, '60m')
            
            # Update RSI
            data.rsi_1m = self.kline_processor.calculate_rsi(symbol, '1m')
            data.rsi_3m = self.kline_processor.calculate_rsi(symbol, '3m')
            data.rsi_5m = self.kline_processor.calculate_rsi(symbol, '5m')
            data.rsi_15m = self.kline_processor.calculate_rsi(symbol, '15m')
            
            # Update buy/sell/net volumes
            bv_1m, sv_1m, nv_1m = self.trade_tracker.get_volume_metrics(symbol, '1m')
            bv_5m, sv_5m, nv_5m = self.trade_tracker.get_volume_metrics(symbol, '5m')
            bv_15m, sv_15m, nv_15m = self.trade_tracker.get_volume_metrics(symbol, '15m')
            bv_60m, sv_60m, nv_60m = self.trade_tracker.get_volume_metrics(symbol, '60m')
            
            data.buy_volume_1m = bv_1m
            data.buy_volume_5m = bv_5m
            data.buy_volume_15m = bv_15m
            data.buy_volume_60m = bv_60m
            
            data.sell_volume_1m = sv_1m
            data.sell_volume_5m = sv_5m
            data.sell_volume_15m = sv_15m
            data.sell_volume_60m = sv_60m
            
            data.net_volume_1m = nv_1m
            data.net_volume_5m = nv_5m
            data.net_volume_15m = nv_15m
            data.net_volume_60m = nv_60m
    
    def create_dataframe(self) -> pd.DataFrame:
        """Create pandas DataFrame with all trading data"""
        rows = []
        
        for symbol, data in self.trading_data.items():
            row = {
                'Symbol': data.symbol,
                'Last': data.last,
                'Bid': data.bid,
                'Ask': data.ask,
                'Spread': f"{data.spread:.4f}%",
                '24h High': data.high_24h,
                '24h Low': data.low_24h,
                '24h %': f"{data.change_24h:.2f}%",
                '24h Vol': data.volume_24h,
                
                '1m %': f"{data.change_1m:.2f}%",
                '5m %': f"{data.change_5m:.2f}%",
                '10m %': f"{data.change_10m:.2f}%",
                '15m %': f"{data.change_15m:.2f}%",
                '60m %': f"{data.change_60m:.2f}%",
                
                '1m Vol': data.volume_1m,
                '5m Vol': data.volume_5m,
                '10m Vol': data.volume_10m,
                '15m Vol': data.volume_15m,
                '60m Vol': data.volume_60m,
                
                'RSI 1m': f"{data.rsi_1m:.2f}",
                'RSI 3m': f"{data.rsi_3m:.2f}",
                'RSI 5m': f"{data.rsi_5m:.2f}",
                'RSI 15m': f"{data.rsi_15m:.2f}",
                
                'BV 1m': data.buy_volume_1m,
                'BV 5m': data.buy_volume_5m,
                'BV 15m': data.buy_volume_15m,
                'BV 60m': data.buy_volume_60m,
                
                'SV 1m': data.sell_volume_1m,
                'SV 5m': data.sell_volume_5m,
                'SV 15m': data.sell_volume_15m,
                'SV 60m': data.sell_volume_60m,
                
                'NV 1m': data.net_volume_1m,
                'NV 5m': data.net_volume_5m,
                'NV 15m': data.net_volume_15m,
                'NV 60m': data.net_volume_60m,
            }
            rows.append(row)
        
        df = pd.DataFrame(rows)
        return df.sort_values('24h Vol', ascending=False)
    
    def print_dashboard(self, df: pd.DataFrame, top_n: int = 20):
        """Print formatted dashboard output"""
        
        # Display top symbols by volume
        top_df = df.head(top_n)
        
        # Format for better display
        pd.set_option('display.max_columns', None)
        pd.set_option('display.width', None)
        pd.set_option('display.max_colwidth', 12)
        
    
    def start_websocket_streams(self):
        """Start WebSocket connections"""
        if self.symbols:
            self.ws_manager = WebSocketManager(
                self.symbols, self.kline_processor, self.trade_tracker
            )
            self.ws_manager.start_websockets()
            logger.info("WebSocket streams started")
    
    def run(self):
        """Main dashboard loop"""
        try:
            # Initialize
            logger.info("🚀 Starting Crypto Trading Dashboard...")
            self.initialize_symbols()
            
            if not self.symbols:
                logger.error("No symbols found. Exiting.")
                return
            
            # Start WebSocket streams
            self.start_websocket_streams()
            
            # Wait a bit for WebSocket connections
            time.sleep(5)
            
            update_count = 0
            
            while self.running:
                try:
                    # Fetch REST API data every 10 updates (reduce API calls)
                    if update_count % 10 == 0:
                        self.fetch_24h_data()
                        self.fetch_book_ticker_data()
                    
                    # Update calculated metrics
                    self.update_calculated_metrics()
                    
                    # Create and display DataFrame
                    df = self.create_dataframe()
                    self.print_dashboard(df)
                    
                    update_count += 1
                    
                    # Update every 10 seconds
                    time.sleep(10)
                    
                except KeyboardInterrupt:
                    logger.info("Dashboard stopped by user")
                    break
                except Exception as e:
                    logger.error(f"Error in main loop: {e}")
                    time.sleep(5)
                    
        except Exception as e:
            logger.error(f"Fatal error: {e}")
        finally:
            self.running = False

if __name__ == "__main__":
    dashboard = CryptoTradingDashboard()
    dashboard.run()