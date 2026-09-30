'use client';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Search, ChevronUp, ChevronDown, ArrowDown, ArrowUp, ChevronsUpDown, RefreshCw, Filter } from 'lucide-react';
import { cn } from '../../lib/utils';
import Header from '../../components/shared/Header';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import Image from 'next/image';
import '../../styles/blink-animations.css';
import { useInactivityLogout } from '../../lib/useInactivityLogout';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface CryptoData {
  symbol: string;
  last_price: number;
  bid_price: number;
  ask_price: number;
  spread: number;
  high_price_24h: number;
  low_price_24h: number;
  price_change_percent_24h: number;
  quote_volume_24h: number;
  m1: number; m2: number; m3: number; m5: number; m10: number; m15: number; m60: number;
  m1_vol_pct: number; m2_vol_pct: number; m3_vol_pct: number; m5_vol_pct: number; m10_vol_pct: number; m15_vol_pct: number; m60_vol_pct: number;
  m1_r_pct: number; m2_r_pct: number; m3_r_pct: number; m5_r_pct: number; m10_r_pct: number; m15_r_pct: number; m60_r_pct: number;
  m1_low: number; m1_high: number; m1_range_pct: number;
  m2_low: number; m2_high: number; m2_range_pct: number;
  m3_low: number; m3_high: number; m3_range_pct: number;
  m5_low: number; m5_high: number; m5_range_pct: number;
  m10_low: number; m10_high: number; m10_range_pct: number;
  m15_low: number; m15_high: number; m15_range_pct: number;
  m60_low: number; m60_high: number; m60_range_pct: number;
  m1_nv: number; m2_nv: number; m3_nv: number; m5_nv: number; m10_nv: number; m15_nv: number; m60_nv: number;
  m1_vol: number; m5_vol: number; m10_vol: number; m15_vol: number; m60_vol: number;
  rsi_1m: number; rsi_3m: number; rsi_5m: number; rsi_15m: number;
  m1_bv: number; m2_bv: number; m3_bv: number; m5_bv: number; m10_bv: number; m15_bv: number; m60_bv: number;
  m1_sv: number; m2_sv: number; m3_sv: number; m5_sv: number; m10_sv: number; m15_sv: number; m60_sv: number;
  [key: string]: string | number | null | undefined;
}

interface User {
  subscription_plan: 'free' | 'basic' | 'enterprise';
  is_premium_user: boolean;
}

const exchanges = [
  { id: 'binance', name: 'Binance', logo: '/treding_logo/binance.png', baseUrl: 'https://www.binance.com/en/trade/' },
  { id: 'binance_futures', name: 'Binance Futures', logo: '/treding_logo/binance.png', baseUrl: 'https://www.binance.com/en/futures/' },
  // { id: 'mexc', name: 'MEXC', logo: '/treding_logo/mexc.png', baseUrl: 'https://www.mexc.com/exchange/' },
  // { id: 'bybit', name: 'Bybit', logo: '/treding_logo/bybit.png', baseUrl: 'https://www.bybit.com/en-US/trade/spot/' },
  // { id: 'kucoin', name: 'Kucoin', logo: '/treding_logo/kucoin.png', baseUrl: 'https://www.kucoin.com/trade/' },
  // { id: 'trading_view', name: 'Trading View', logo: '/treding_logo/tv.png', baseUrl: 'https://www.tradingview.com/chart/?symbol=' },
];

const renderChange = (value: number | string) => {
  if (value === null || value === undefined) return <span className="text-gray-500">N/A</span>;
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numericValue)) return <span className="text-gray-500">N/A</span>;
  const isPositive = numericValue > 0;
  const color = isPositive ? 'text-green-600' : 'text-red-600';
  const icon = isPositive ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  return (
    <span className={`flex items-center font-medium ${color}`}>
      {icon}
      {numericValue.toFixed(2)}%
    </span>
  );
};

export default function DashboardPage() {
  const allColumns = useMemo(() => [
    { key: 'symbol', title: 'Symbol' },
    { key: 'last_price', title: 'Last' },
    { key: 'bid_price', title: 'Bid' },
    { key: 'ask_price', title: 'Ask' },
    { key: 'spread', title: 'Spread' },
    { key: 'high_price_24h', title: '24h High' },
    { key: 'low_price_24h', title: '24h Low' },
    { key: 'price_change_percent_24h', title: '24h %' },
    { key: 'quote_volume_24h', title: '24h Vol' },
    { key: 'm1', title: '1m %' }, { key: 'm5', title: '5m %' }, { key: 'm10', title: '10m %' }, { key: 'm15', title: '15m %' }, { key: 'm60', title: '60m %' },
    { key: 'm1_vol_pct', title: '1m Vol %' }, { key: 'm2_vol_pct', title: '2m Vol %' }, { key: 'm3_vol_pct', title: '3m Vol %' }, { key: 'm5_vol_pct', title: '5m Vol %' }, { key: 'm10_vol_pct', title: '10m Vol %' }, { key: 'm15_vol_pct', title: '15m Vol %' }, { key: 'm60_vol_pct', title: '60m Vol %' },
    { key: 'm1_r_pct', title: '1m Ret %' }, { key: 'm2_r_pct', title: '2m Ret %' }, { key: 'm3_r_pct', title: '3m Ret %' }, { key: 'm5_r_pct', title: '5m Ret %' }, { key: 'm10_r_pct', title: '10m Ret %' }, { key: 'm15_r_pct', title: '15m Ret %' }, { key: 'm60_r_pct', title: '60m Ret %' },
    { key: 'm1_low', title: '1mL' }, { key: 'm1_high', title: '1mH' }, { key: 'm1_range_pct', title: '1mR%' },
    { key: 'm2_low', title: '2mL' }, { key: 'm2_high', title: '2mH' }, { key: 'm2_range_pct', title: '2mR%' },
    { key: 'm3_low', title: '3mL' }, { key: 'm3_high', title: '3mH' }, { key: 'm3_range_pct', title: '3mR%' },
    { key: 'm5_low', title: '5mL' }, { key: 'm5_high', title: '5mH' }, { key: 'm5_range_pct', title: '5mR%' },
    { key: 'm10_low', title: '10mL' }, { key: 'm10_high', title: '10mH' }, { key: 'm10_range_pct', title: '10mR%' },
    { key: 'm15_low', title: '15mL' }, { key: 'm15_high', title: '15mH' }, { key: 'm15_range_pct', title: '15mR%' },
    { key: 'm60_low', title: '60mL' }, { key: 'm60_high', title: '60mH' }, { key: 'm60_range_pct', title: '60mR%' },
    { key: 'm1_nv', title: '1mNV' }, { key: 'm2_nv', title: '2mNV' }, { key: 'm3_nv', title: '3mNV' }, { key: 'm5_nv', title: '5mNV' }, { key: 'm10_nv', title: '10mNV' }, { key: 'm15_nv', title: '15mNV' }, { key: 'm60_nv', title: '60mNV' },
    { key: 'm1_vol', title: '1m Vol' }, { key: 'm5_vol', title: '5m Vol' }, { key: 'm10_vol', title: '10m Vol' }, { key: 'm15_vol', title: '15m Vol' }, { key: 'm60_vol', title: '60m Vol' },
    { key: 'rsi_1m', title: 'RSI 1m' }, { key: 'rsi_3m', title: 'RSI 3m' }, { key: 'rsi_5m', title: 'RSI 5m' }, { key: 'rsi_15m', title: 'RSI 15m' },
    { key: 'm1_bv', title: '1mBV' }, { key: 'm2_bv', title: '2mBV' }, { key: 'm3_bv', title: '3mBV' }, { key: 'm5_bv', title: '5mBV' }, { key: 'm15_bv', title: '15mBV' }, { key: 'm60_bv', title: '60mBV' },
    { key: 'm1_sv', title: '1mSV' }, { key: 'm2_sv', title: '2mSV' }, { key: 'm3_sv', title: '3mSV' }, { key: 'm5_sv', title: '5mSV' }, { key: 'm15_sv', title: '15mSV' }, { key: 'm60_sv', title: '60mSV' },
  ], []);

  const defaultColumns = useMemo(() => [
    'symbol', 'last_price', 'price_change_percent_24h', 'quote_volume_24h', 'm1', 'm5', 'm10', 'm15', 'm60',
    'm1_vol_pct', 'm2_vol_pct', 'm3_vol_pct', 'm5_vol_pct', 'm10_vol_pct', 'm15_vol_pct', 'm60_vol_pct',
    'm1_r_pct', 'm2_r_pct', 'm3_r_pct', 'm5_r_pct', 'm10_r_pct', 'm15_r_pct', 'm60_r_pct',
    'm1_range_pct', 'm2_range_pct', 'm3_range_pct', 'm5_range_pct', 'm10_range_pct', 'm15_range_pct', 'm60_range_pct',
    'm1_nv', 'm2_nv', 'm3_nv', 'm5_nv', 'm10_nv', 'm15_nv', 'm60_nv',
    'm1_vol', 'm5_vol', 'm10_vol', 'm15_vol', 'm60_vol',
    'rsi_1m', 'rsi_3m', 'rsi_5m', 'rsi_15m',
    'm1_bv', 'm2_bv', 'm3_bv', 'm5_bv', 'm15_bv', 'm60_bv',
    'm1_sv', 'm2_sv', 'm3_sv', 'm5_sv', 'm15_sv', 'm60_sv'
  ], []);

  const freeColumns = useMemo(() => ['symbol', 'last_price', 'high_price_24h', 'low_price_24h', 'price_change_percent_24h', 'quote_volume_24h'], []);
  const [isPremium, setIsPremium] = useState(false);
  const [plan, setPlan] = useState<string>('free');
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(defaultColumns));
  const [userName, setUserName] = useState<string | null>('');
  
  // Auto-logout after 30 minutes of inactivity (with 2-minute warning)
  useInactivityLogout({
    timeout: 30 * 60 * 1000, // 30 minutes
    warningTime: 2 * 60 * 1000, // Warning 2 minutes before logout
    onLogout: () => {
      console.log('🔴 Auto-logout triggered due to inactivity');
    },
    onWarning: (remainingSeconds) => {
      console.log(`⚠️ You will be logged out in ${remainingSeconds} seconds due to inactivity`);
    }
  });
  
  const [cryptoData, setCryptoData] = useState<CryptoData[]>([]);
  const [allCryptoData, setAllCryptoData] = useState<CryptoData[]>([]); // ✨ Store ALL currencies for instant filtering
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedExchange, setSelectedExchange] = useState('binance');
  const [sortConfig, setSortConfig] = useState<{ key: keyof CryptoData; direction: 'ascending' | 'descending' } | null>({ key: 'quote_volume_24h', direction: 'descending' });
  const [baseCurrency, setBaseCurrency] = useState<string>('USDT');
  const [itemCount, setItemCount] = useState<string>('25');
  const [sessionSortOrder, setSessionSortOrder] = useState<string[]>([]); // Track initial order for session
  const [isNewSession, setIsNewSession] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [symbolFilter, setSymbolFilter] = useState<string[]>([]);
  const [symbolSearch, setSymbolSearch] = useState('');
  const [priceChanges, setPriceChanges] = useState<{ [key: string]: 'up' | 'down' | 'neutral' }>({});
  const [blinkingCells, setBlinkingCells] = useState<{ [key: string]: 'green' | 'red' }>({});
  const [blinkDuration, setBlinkDuration] = useState<number>(1200); // Configurable blink duration
  const [blinkEnabled, setBlinkEnabled] = useState<boolean>(true); // Toggle for performance
  const [maxBlinkingsPerSecond, setMaxBlinkingsPerSecond] = useState<number>(20); // Increased rate limiting
  const blinkThrottleRef = useRef<Map<string, number>>(new Map()); // Throttle tracking
  const [countdown, setCountdown] = useState(10);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');
  const [sessionStartTime, setSessionStartTime] = useState<number>(Date.now());
  const [isWebSocketOnly, setIsWebSocketOnly] = useState<boolean>(true); // Use WebSocket-only mode
  const [isWebSocketReady, setIsWebSocketReady] = useState<boolean>(false); // Track WebSocket connection status
  const socketRef = useRef<WebSocket | null>(null);
  const dataBatchRef = useRef<Map<string, CryptoData>>(new Map());
  const baseCurrencyRef = useRef<string>(baseCurrency); // ✨ Ref to track current currency for WebSocket handler
  const itemCountRef = useRef<string>(itemCount); // ✨ Ref to track itemCount for interval
  // ✨ Initialize isPremiumRef from localStorage to avoid race condition
  const getInitialPremiumStatus = (): boolean => {
    if (typeof window !== 'undefined') {
      try {
        const userStr = sessionStorage.getItem('user') || localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          const plan = user.subscription_plan || 'free';
          return plan === 'basic' || plan === 'enterprise' || user.is_premium_user === true;
        }
      } catch { /* ignore */ }
    }
    return false;
  };
  const isPremiumRef = useRef<boolean>(getInitialPremiumStatus());
  const snapshotAccumRef = useRef<{ chunks: number; total: number; buffer: Map<string, CryptoData> } | null>(null);
  const isMountedRef = useRef<boolean>(true); // Track if component is mounted
  const initialLoadCompleteRef = useRef<boolean>(false); // Track if initial data load is complete
  
  // Lazy loading state for virtualization
  const [visibleRowCount, setVisibleRowCount] = useState<number>(50); // Start with 50 rows
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const observerTarget = useRef<HTMLTableRowElement>(null);

  const changeColumns = [
    'price_change_percent_24h', 'm1', 'm2', 'm3', 'm5', 'm10', 'm15', 'm60',
    'm1_vol_pct', 'm2_vol_pct', 'm3_vol_pct', 'm5_vol_pct', 'm10_vol_pct', 'm15_vol_pct', 'm60_vol_pct',
    'm1_r_pct', 'm2_r_pct', 'm3_r_pct', 'm5_r_pct', 'm10_r_pct', 'm15_r_pct', 'm60_r_pct',
    'm1_range_pct', 'm2_range_pct', 'm3_range_pct', 'm5_range_pct', 'm10_range_pct', 'm15_range_pct', 'm60_range_pct'
  ];

  const handleLogout = useCallback(() => {
    try {
      // Clear all localStorage data
      localStorage.removeItem('user');
      localStorage.removeItem('last_activity');
      localStorage.removeItem('is_premium_user');
      localStorage.removeItem('user_refresh');
      localStorage.removeItem('user_email');
      localStorage.removeItem('user_plan');
    } catch { }
    // Redirect to home (login page)
    window.location.href = '/';
  }, []);

  const handleUpgradeClick = () => {
    window.location.href = '/upgrade-plan';
  };

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) newSet.delete(key);
      else newSet.add(key);
      return newSet;
    });
  };

  // Manual refresh function - fetches LIVE data from Binance
  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setLastUpdateTime(new Date().toLocaleTimeString());

    try {
      // Get user token from storage
      const userStr = sessionStorage.getItem('user') || localStorage.getItem('user');
      let token = null;
      if (userStr) {
        const user = JSON.parse(userStr);
        token = user.access_token;
      }

      if (token) {
        // Always request 500+ symbols for complete data coverage
        const pageSize = itemCount === 'All' ? 1000 : 500;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        
        // Call manual-refresh endpoint which fetches LIVE data from Binance
        const response = await fetch(`${apiUrl}/api/manual-refresh/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            base_currency: baseCurrency,
            page_size: pageSize
          })
        });

        if (response.ok) {
          const responseData = await response.json();
          const newData = responseData.data || [];
          
          if (newData.length > 0) {
            setCryptoData(newData);
            console.log(`✅ Manual refresh: Updated ${responseData.symbols_updated} symbols with LIVE Binance data`);
          }
        } else {
          // Fallback to regular binance-data endpoint
          console.log('⚠️ Manual refresh failed, falling back to cached data');
          const fallbackResponse = await fetch(`${apiUrl}/api/binance-data/?page_size=${pageSize}&base_currency=${baseCurrency}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
          });
          
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            const data = Array.isArray(fallbackData) ? fallbackData : (fallbackData.data || []);
            if (data.length > 0) {
              setCryptoData(data);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  }, [itemCount, baseCurrency]);

  const loadDashboardData = useCallback(async (token: string, currency: string, pageSize: number) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    try {
      const cachedResponse = await fetch(`${apiUrl}/api/binance-data/?base_currency=${currency}&page_size=${pageSize}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (cachedResponse.ok) {
        const cachedJson = await cachedResponse.json();
        const cachedData = Array.isArray(cachedJson) ? cachedJson : (cachedJson.data || []);

        if (isMountedRef.current && cachedData.length > 0 && baseCurrencyRef.current === currency) {
          setCryptoData(cachedData);
          setAllCryptoData(cachedData);
          setLastUpdateTime(new Date().toLocaleTimeString());
          setLoading(false);
          initialLoadCompleteRef.current = true;
          setError(null);
          return true;
        }
      }

      const refreshResponse = await fetch(`${apiUrl}/api/manual-refresh/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          base_currency: currency,
          page_size: 500,
        }),
      });

      if (refreshResponse.ok) {
        const refreshJson = await refreshResponse.json();
        const liveData = Array.isArray(refreshJson) ? refreshJson : (refreshJson.data || []);

        if (isMountedRef.current && liveData.length > 0 && baseCurrencyRef.current === currency) {
          setCryptoData(liveData);
          setAllCryptoData(liveData);
          setLastUpdateTime(new Date().toLocaleTimeString());
          setLoading(false);
          initialLoadCompleteRef.current = true;
          setError(null);
          return true;
        }
      }
    } catch (error) {
      console.error(`Failed to load dashboard data for ${currency}:`, error);
    }

    return false;
  }, []);

  const getStoredAccessToken = useCallback(() => {
    try {
      const userStr = sessionStorage.getItem('user') || localStorage.getItem('user');
      if (!userStr) {
        return null;
      }

      const storedUser = JSON.parse(userStr);
      return storedUser.access_token || null;
    } catch {
      return null;
    }
  }, []);

  // WebSocket-only data fetching - no more REST API calls
  const requestWebSocketData = useCallback((pageSize: number = 100) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    try {
      socketRef.current.send(JSON.stringify({
        type: 'request_snapshot',
        sort_by: 'profit',
        sort_order: 'desc',
        page_size: pageSize,
        quote_currency: baseCurrency
      }));
    } catch (error) {
      console.error('Failed to request WebSocket data:', error);
    }
  }, [baseCurrency]);

  // Removed old fetchBackendData function - now using WebSocket-only approach

  // Optimized blinking animation manager with throttling
  const triggerBlink = useCallback((cellKey: string, changeType: 'up' | 'down') => {
    if (!blinkEnabled) return; // Skip if blinking is disabled for performance

    // Throttling: prevent too many blinks on the same cell
    const now = Date.now();
    const lastBlink = blinkThrottleRef.current.get(cellKey) || 0;
    const minInterval = 1000 / maxBlinkingsPerSecond; // ms between blinks

    if (now - lastBlink < minInterval) {
      return; // Skip this blink to prevent overwhelming animations
    }

    blinkThrottleRef.current.set(cellKey, now);

    const blinkColor = changeType === 'up' ? 'green' : 'red';

    console.log(`🎯 Triggering ${blinkColor} blink for ${cellKey}`);

    setBlinkingCells(prev => ({
      ...prev,
      [cellKey]: blinkColor
    }));

    // Remove blink after animation duration
    setTimeout(() => {
      setBlinkingCells(prev => {
        const newState = { ...prev };
        delete newState[cellKey];
        return newState;
      });
    }, blinkDuration);
  }, [blinkDuration, blinkEnabled, maxBlinkingsPerSecond]);

  // Enhanced change detection with blinking (performance optimized)
  const detectAndAnimateChanges = useCallback((oldData: CryptoData[], newData: CryptoData[]) => {
    const changes: { [key: string]: 'up' | 'down' } = {};
    const oldDataMap = new Map(oldData.map(item => [item.symbol, item]));

    // Only animate columns that are currently visible
    const visibleColumnKeys = Array.from(visibleColumns);

    // Numeric columns that should trigger blink animations
    const numericColumns = [
      'last_price', 'price_change_percent_24h', 'high_price_24h', 'low_price_24h',
      'quote_volume_24h', 'm1', 'm2', 'm3', 'm5', 'm10', 'm15', 'm60',
      'm1_vol_pct', 'm2_vol_pct', 'm3_vol_pct', 'm5_vol_pct', 'm10_vol_pct', 'm15_vol_pct', 'm60_vol_pct',
      'm1_r_pct', 'm2_r_pct', 'm3_r_pct', 'm5_r_pct', 'm10_r_pct', 'm15_r_pct', 'm60_r_pct'
    ].filter(col => visibleColumnKeys.includes(col)); // Only visible numeric columns

    let changeCount = 0;

    newData.forEach(newItem => {
      const oldItem = oldDataMap.get(newItem.symbol);
      if (oldItem) {
        numericColumns.forEach(column => {
          const key = column as keyof CryptoData;
          const oldValue = oldItem[key];
          const newValue = newItem[key];

          if (typeof oldValue === 'number' && typeof newValue === 'number' && oldValue !== newValue) {
            const changeType = newValue > oldValue ? 'up' : 'down';
            const cellKey = `${newItem.symbol}-${key}`;

            changes[cellKey] = changeType;
            triggerBlink(cellKey, changeType);
            changeCount++;
          }
        });
      }
    });

    // Debug: Log change count for testing
    if (changeCount > 0) {
      console.log(`🔥 Blinking ${changeCount} cells with price changes`);
    }

    setPriceChanges(changes);
    // Clear price changes for next cycle
    setTimeout(() => setPriceChanges({}), 1000);
  }, [triggerBlink, visibleColumns]);

  // Keep refs in sync with state values (for use in intervals without restarting them)
  useEffect(() => {
    itemCountRef.current = itemCount;
  }, [itemCount]);

  useEffect(() => {
    isPremiumRef.current = isPremium;
  }, [isPremium]);

  // Request data when itemCount changes (WebSocket-only)
  useEffect(() => {
    if (!loading && socketRef.current) {
      // Always request 500+ symbols to ensure we have complete data
      // Frontend will filter/paginate as needed based on itemCount
      const pageSize = itemCount === 'All' ? 1000 : 500;
      requestWebSocketData(pageSize);
      // Reset session when itemCount changes
      setIsNewSession(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemCount]);

  useEffect(() => {
    isMountedRef.current = true; // Set to true when component mounts
    
    // Check for upgrade success parameter
    const urlParams = new URLSearchParams(window.location.search);
    const upgradeSuccess = urlParams.has('upgrade') && urlParams.get('upgrade') === 'success';
    
    // Check sessionStorage first (for email login), then fallback to localStorage
    let userStr = sessionStorage.getItem('user');
    if (!userStr) {
      userStr = localStorage.getItem('user');
    }
    
    if (!userStr) {
      handleLogout();
      return;
    }
    const user = JSON.parse(userStr);
    setUserName(user.first_name);

    const fetchInitialDataAndConnect = async () => {
      try {
        console.log('🔍 Dashboard - User data from localStorage:', user);
        console.log('📊 Dashboard - subscription_plan:', user.subscription_plan);
        console.log('💎 Dashboard - is_premium_user:', user.is_premium_user);
        
        // Always sync the current user profile from the backend so plan changes
        // made outside the browser storage are reflected immediately.
        if (true) {
          if (upgradeSuccess) {
            console.log('🎉 Upgrade successful! Fetching updated user data...');
          } else {
            console.log('🔄 Syncing current user profile from API...');
          }
          
          try {
            const userDetailsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, {
              headers: { 
                'Authorization': `Bearer ${user.access_token}`,
                'Content-Type': 'application/json'
              },
            });
            
            if (userDetailsResponse.status === 401 || userDetailsResponse.status === 403) {
              console.error('❌ Dashboard - Authentication failed, logging out...');
              handleLogout();
              return;
            }
            
            if (userDetailsResponse.ok) {
              const userDetails = await userDetailsResponse.json();
              console.log('✅ Dashboard - Fetched user details:', userDetails);
              
              // Update sessionStorage with complete user data (maintain same storage as login)
              const updatedUser = { ...user, ...userDetails };
              sessionStorage.setItem('user', JSON.stringify(updatedUser));
              // Also update localStorage for backward compatibility
              localStorage.setItem('user', JSON.stringify(updatedUser));
              
              // Notify other components that user data has been updated
              window.dispatchEvent(new CustomEvent('userUpdated', { detail: updatedUser }));
              
              // Determine if user is premium
              const userPlan = userDetails.subscription_plan || 'free';
              const isPremiumValue = userPlan === 'basic' || 
                                     userPlan === 'enterprise' || 
                                     userDetails.is_premium_user === true;
              
              if (isMountedRef.current) {
                setIsPremium(isPremiumValue);
                setPlan(userPlan);
                
                // Show all columns for both free and premium users
                // Free users will see blurred premium columns
                setVisibleColumns(new Set(defaultColumns));
              }
              
              // If this was an upgrade success, show a success message and clean URL
              if (upgradeSuccess) {
                console.log('🎊 Upgrade successful! Plan:', userPlan, 'Premium:', isPremiumValue);
                // Remove the upgrade parameter from URL without reloading
                window.history.replaceState({}, '', '/dashboard');
                
                // Optional: Show a success toast/notification
                alert('🎉 Upgrade successful! You now have access to premium features.');
              }
            } else {
              // Default to free user if fetch fails
              if (isMountedRef.current) {
                setIsPremium(false);
                setPlan('free');
                // Show all columns even for free users (with blur on premium columns)
                setVisibleColumns(new Set(defaultColumns));
              }
            }
          } catch (fetchError) {
            console.error('❌ Failed to fetch user details:', fetchError);
            // Default to free user if fetch fails
            if (isMountedRef.current) {
              setIsPremium(false);
              setPlan('free');
              // Show all columns even for free users (with blur on premium columns)
              setVisibleColumns(new Set(defaultColumns));
            }
          }
        } else {
          // User data already in localStorage
          const userPlan = user.subscription_plan || 'free';
          const isPremiumValue = userPlan === 'basic' || 
                                 userPlan === 'enterprise' || 
                                 user.is_premium_user === true;
          
          if (isMountedRef.current) {
            setIsPremium(isPremiumValue);
            setPlan(userPlan);
            
            // Show all columns for both free and premium users
            // Free users will see blurred premium columns
            setVisibleColumns(new Set(defaultColumns));
          }
        }

        // Fetch initial data via REST API for instant display (before WebSocket)
        // IMPORTANT: Use cached database endpoint first, then live refresh if cache is empty
        try {
          console.log('📊 Fetching initial crypto data for USDT...');
          void loadDashboardData(user.access_token, 'USDT', 150);
        } catch (fetchError) {
          console.error('❌ Error fetching initial data:', fetchError);
          // Continue anyway, WebSocket will provide data
        }

        // Always connect WebSocket for both free and paid users
        connectWebSocket(user.access_token);

        // Safety timeout: Stop loading after 10 seconds even if no data arrives (only for initial load)
        setTimeout(() => {
          if (isMountedRef.current && !initialLoadCompleteRef.current) {
            console.warn('⏱️ Initial loading timeout reached - stopping loading spinner');
            setLoading(false);
            setError('Unable to load data. Please check your internet connection and refresh the page.');
          }
        }, 10000);

      } catch (e: unknown) {
        console.error('Error initializing dashboard:', e);
        if (isMountedRef.current) {
          setError('Failed to load data. Please refresh.');
          setLoading(false);
        }
      }
      // Note: Don't set loading to false in finally block - let WebSocket or REST data do it
    };

    const connectWebSocket = (token: string) => {
      // Prevent multiple connections
      if (socketRef.current) {
        if (socketRef.current.readyState === WebSocket.CONNECTING || 
            socketRef.current.readyState === WebSocket.OPEN) {
          console.log('⚠️ WebSocket already connecting/connected, skipping duplicate connection');
          return;
        }
      }

      const isLocal = window.location.hostname === 'localhost';
      const localWsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
      const productionWsUrl = process.env.NEXT_PUBLIC_WS_URL || `wss://${window.location.host}`;
      const wsUrl = isLocal ? localWsUrl : productionWsUrl;

      try {
        socketRef.current = new WebSocket(`${wsUrl}/ws/crypto/?token=${token}`);
      } catch (createErr) {
        console.error('Failed to create WebSocket:', createErr);
        setError('Failed to establish connection. Please refresh the page.');
        return;
      }

      socketRef.current.onopen = () => {
        console.log('✅ WebSocket connected!');
        setIsWebSocketReady(true); // Mark WebSocket as ready
        setIsRefreshing(false); // Not refreshing on initial connect
        setLastUpdateTime(new Date().toLocaleTimeString());
        
        // Request data for current currency on connect
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          console.log('📡 Requesting data for currency:', baseCurrencyRef.current);
          socketRef.current.send(JSON.stringify({
            type: 'request_snapshot',
            sort_by: 'profit',
            sort_order: 'desc',
            page_size: 1000, // Get all pairs for current currency
            quote_currency: baseCurrencyRef.current
          }));
        }
      };

      socketRef.current.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          // Handle heartbeat - just ignore it
          if (msg?.type === 'heartbeat') {
            return;
          }
          
          // Handle authentication check
          if (msg?.type === 'ws_ack') {
            if (msg.is_authenticated === false) {
              socketRef.current?.close();
              handleLogout();
              return;
            }
            console.log('✅ WebSocket authenticated - Plan:', msg.plan, 'Group:', msg.group);
            return;
          }
          
          // Snapshot streaming
          if (msg?.type === 'snapshot') {
            const items: CryptoData[] = Array.isArray(msg.data) ? msg.data : [];
            
            // 🔍 DEBUG: Log snapshot details
            console.log('📸 Snapshot received:', {
              chunk: msg.chunk,
              totalChunks: msg.total_chunks,
              itemCount: items.length,
              quoteCurrency: msg.quote_currency,
              currentBaseCurrency: baseCurrencyRef.current,
              firstSymbols: items.slice(0, 5).map(i => i.symbol)
            });
            
            // Only accept snapshot if it matches current currency
            const snapshotCurrency = msg.quote_currency || 'USDT';
            if (snapshotCurrency !== baseCurrencyRef.current) {
              console.log(`⚠️ Ignoring snapshot for ${snapshotCurrency} - current currency is ${baseCurrencyRef.current}`);
              return;
            }
            
            if (!snapshotAccumRef.current) {
              snapshotAccumRef.current = { chunks: msg.total_chunks || 1, total: msg.total_count || 0, buffer: new Map() };
            }
            
            // Store items in buffer
            items.forEach(i => {
              snapshotAccumRef.current!.buffer.set(i.symbol, i);
            });
            
            // When last chunk arrives, commit
            if (msg.chunk >= (snapshotAccumRef.current.chunks || 1)) {
              const merged = Array.from(snapshotAccumRef.current.buffer.values());
              console.log('✅ Snapshot complete - Total symbols:', merged.length, 'First 5:', merged.slice(0, 5).map(i => i.symbol));
              snapshotAccumRef.current = null;
              
              // Store total count for this currency (for "All" option display)
              setAllCryptoData(merged);
              
              // Filter for current currency display (all should already match)
              const currentCurrencyData = merged.filter(i => i.symbol?.endsWith(baseCurrencyRef.current));
              
              // ✨ FIX: If we already have data, UPDATE values without changing symbol order
              // This prevents the "flash" effect where symbols suddenly reorder after initial load
              setCryptoData(prevData => {
                if (prevData.length === 0) {
                  // No previous data - use filtered snapshot directly
                  return currentCurrencyData;
                }
                
                // Create a map of new data for quick lookup
                const newDataMap = new Map(currentCurrencyData.map(item => [item.symbol, item]));
                
                // Update existing items with new values, keeping same order
                const updated = prevData.map(existingItem => {
                  const newItem = newDataMap.get(existingItem.symbol);
                  return newItem || existingItem; // Use new data if available, otherwise keep old
                });
                
                // Add any new symbols that weren't in previous data (append at end)
                const existingSymbols = new Set(prevData.map(item => item.symbol));
                const newSymbols = currentCurrencyData.filter(item => !existingSymbols.has(item.symbol));
                
                return [...updated, ...newSymbols];
              });
              
              // Mark initial load as complete (prevents timeout error)
              initialLoadCompleteRef.current = true;
              setError(null); // Clear any errors
              setIsRefreshing(false);
              setLoading(false); // Stop loading spinner once WebSocket data arrives
            }
            return;
          }
          
          // Live update from Binance (premium users) - merge with existing data
          if (msg?.type === 'live_update') {
            const items: CryptoData[] = Array.isArray(msg.data) ? msg.data : [];
            const snapshotCurrency = msg.quote_currency || 'USDT';
            
            // Only accept if matches current currency
            if (snapshotCurrency !== baseCurrencyRef.current) {
              console.log(`⚠️ Ignoring live_update for ${snapshotCurrency}`);
              return;
            }
            
            console.log('🔴 Live update received:', items.length, 'items for', snapshotCurrency);
            
            // Update allCryptoData for accurate count
            setAllCryptoData(prevAll => {
              const allDataMap = new Map(prevAll.map(item => [item.symbol, item]));
              items.forEach(item => allDataMap.set(item.symbol, item));
              return Array.from(allDataMap.values());
            });
            
            // Update existing data with live values
            setCryptoData(prevData => {
              const liveDataMap = new Map(items.map(item => [item.symbol, item]));
              
              // If prevData is empty (currency just changed), use items directly
              if (prevData.length === 0) {
                return items;
              }
              
              // Update existing items with live data
              const updated = prevData.map(existingItem => {
                const liveItem = liveDataMap.get(existingItem.symbol);
                return liveItem || existingItem;
              });
              
              // Add any new symbols from live data
              const existingSymbols = new Set(prevData.map(item => item.symbol));
              const newSymbols = items.filter(item => !existingSymbols.has(item.symbol));
              
              return [...updated, ...newSymbols];
            });
            
            // ✅ FIX: Stop loading spinner when live_update arrives (currency change)
            setLoading(false);
            setIsRefreshing(false);
            setError(null);
            return;
          }
          
          // Delta updates - batch them for 10-second cycles
          if (msg?.type === 'delta') {
            const updatedBatch: CryptoData[] = Array.isArray(msg.data) ? msg.data : [];
            console.log('📊 Delta updates received:', {
              count: updatedBatch.length,
              currentCurrency: baseCurrencyRef.current,
              sampleSymbols: updatedBatch.slice(0, 3).map(i => i.symbol)
            });
            
            let accepted = 0, rejected = 0;
            updatedBatch.forEach(newItem => {
              // ✨ FILTER: Only batch updates for symbols matching current currency (use ref!)
              if (newItem.symbol.endsWith(baseCurrencyRef.current)) {
                dataBatchRef.current.set(newItem.symbol, newItem);
                accepted++;
              } else {
                rejected++;
                if (rejected <= 3) console.log('⚠️ Rejected delta:', newItem.symbol, '(want', baseCurrencyRef.current + ')');
              }
            });
            console.log(`📦 Delta filtering: ${accepted} accepted, ${rejected} rejected`);
            return;
          }
          
          // Backward compatibility: raw array
          if (Array.isArray(msg)) {
            msg.forEach((item: CryptoData) => {
              // ✨ FILTER: Only batch updates for symbols matching current currency (use ref!)
              if (item.symbol.endsWith(baseCurrencyRef.current)) {
                dataBatchRef.current.set(item.symbol, item);
              }
            });
          }
        } catch (e: unknown) {
          console.error('WebSocket message parse error:', e);
        }
      };

      socketRef.current.onclose = (event) => {
        console.log('❌ WebSocket closed - Code:', event.code, 'Reason:', event.reason, 'Clean:', event.wasClean);
        setIsWebSocketReady(false); // Mark WebSocket as not ready
        
        // Check if user is still logged in and component is mounted
        // Check sessionStorage first, then localStorage
        const userStrNow = sessionStorage.getItem('user') || localStorage.getItem('user');
        
        if (isMountedRef.current && userStrNow) {
          // Reconnect after 5 seconds
          setTimeout(() => {
            if (isMountedRef.current && (sessionStorage.getItem('user') || localStorage.getItem('user'))) {
              connectWebSocket(token);
            }
          }, 5000);
        }
      };

      socketRef.current.onerror = () => {
        console.log('⚠️ WebSocket error');
        setIsWebSocketReady(false); // Mark WebSocket as not ready
        
        // Errors are handled by onclose, just close the connection
        try { 
          socketRef.current?.close(); 
        } catch (e: unknown) {
          // Ignore close errors
        }
      };
    };

    fetchInitialDataAndConnect();

    return () => {
      isMountedRef.current = false;
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [handleLogout]);

  useEffect(() => {
    // Auto-refresh countdown: Always run for all users (free and premium)
    // Premium users: auto-refresh data every 10 seconds
    // Free users: countdown runs but they need to click refresh button manually

    console.log('🔄 Auto-refresh countdown started');

    // Run countdown for all users every 1 second
    const interval = setInterval(() => {
      setCountdown(prev => {
        // Decrement countdown first
        const nextValue = prev - 1;
        
        // When countdown reaches 0, trigger update and reset
        if (nextValue <= 0) {
          // Use refs to get latest values without restarting the interval
          const currentIsPremium = isPremiumRef.current;
          const currentItemCount = itemCountRef.current;
          const currentCurrency = baseCurrencyRef.current;
          
          console.log('⏰ Countdown reached 0 - isPremium:', currentIsPremium, 'WebSocket OPEN:', socketRef.current?.readyState === WebSocket.OPEN, 'Current currency:', currentCurrency);
          
          // Update last update time
          setLastUpdateTime(new Date().toLocaleTimeString());
          
          // ONLY premium users get automatic data refresh
          if (currentIsPremium && socketRef.current?.readyState === WebSocket.OPEN) {
            // Always request enough symbols (500) to get complete data for all currencies
            // The backend will send live updates for all actively traded symbols
            const pageSize = currentItemCount === 'All' ? 1000 : 500;
            console.log('🚀 Sending refresh request - pageSize:', pageSize, 'currency:', currentCurrency, 'socketState:', socketRef.current?.readyState);
            try {
              socketRef.current.send(JSON.stringify({
                type: 'request_snapshot',
                sort_by: 'profit',
                sort_order: 'desc',
                page_size: pageSize,
                quote_currency: currentCurrency
              }));
              console.log('✅ WebSocket request sent successfully');
            } catch (sendError) {
              console.error('❌ Failed to send WebSocket request:', sendError);
            }
          } else {
            if (!currentIsPremium) {
              console.log('⛔ Auto-refresh skipped - User is not premium');
            }
            if (socketRef.current?.readyState !== WebSocket.OPEN) {
              console.log('⛔ Auto-refresh skipped - WebSocket not open. State:', socketRef.current?.readyState);
            }
          }

          // Apply any batched deltas with blinking animations (10-second cycle)
          // This works for all users receiving WebSocket delta updates
          const batchSize = dataBatchRef.current.size;
          
          if (batchSize > 0) {
            console.log('📦 Applying batched delta updates:', batchSize, 'items');
            setCryptoData(prevData => {
              const dataMap = new Map(prevData.map(item => [item.symbol, item]));
              const newUpdatedItems: CryptoData[] = [];
              const oldItemsForChanges: CryptoData[] = [];

              dataBatchRef.current.forEach(newItem => {
                // ✨ SAFETY CHECK: Only apply updates for current currency (use ref!)
                if (!newItem.symbol.endsWith(baseCurrencyRef.current)) {
                  console.log('⚠️ Skipping delta update for', newItem.symbol, '(current currency:', baseCurrencyRef.current, ')');
                  return;
                }
                
                const oldItem = dataMap.get(newItem.symbol);
                if (oldItem) {
                  oldItemsForChanges.push(oldItem);
                  const updatedItem = { ...oldItem, ...newItem };
                  dataMap.set(newItem.symbol, updatedItem);
                  newUpdatedItems.push(updatedItem);
                }
              });

              // Trigger blinking animations for all changes in this 10-second cycle
              if (oldItemsForChanges.length > 0 && newUpdatedItems.length > 0) {
                detectAndAnimateChanges(oldItemsForChanges, newUpdatedItems);
              }

              dataBatchRef.current.clear();
              return Array.from(dataMap.values());
            });
          }
          
          // Reset countdown to 10 for next cycle
          return 10;
        }
        
        // Return the decremented value
        return nextValue;
      });
    }, 1000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectAndAnimateChanges]); // Only restart if detectAndAnimateChanges changes (visibleColumns)

  // Currency change effect - request new data from WebSocket
  // Skip initial render (WebSocket connects on mount, not here)
  const isInitialCurrencyMount = useRef(true);
  
  useEffect(() => {
    // Skip the initial mount - WebSocket connection handles the first data request
    if (isInitialCurrencyMount.current) {
      isInitialCurrencyMount.current = false;
      console.log('🔄 Currency effect: Skipping initial mount (WebSocket will handle first request)');
      return;
    }
    
    console.log('🔄 Currency change effect triggered - NEW VALUE:', baseCurrency);
    console.log('🔄 Updating baseCurrencyRef.current from', baseCurrencyRef.current, 'to', baseCurrency);
    
    // Update ref so WebSocket handler always has latest currency
    baseCurrencyRef.current = baseCurrency;
    
    // Request data for new currency from WebSocket
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      console.log('💱 Currency changed to:', baseCurrency, '- requesting from WebSocket');
      
      // CLEAR OLD DATA AND ERROR STATE when currency changes
      setCryptoData([]);
      setAllCryptoData([]); // Clear all data for new currency
      setError(null); // Clear any previous errors
      setLoading(true); // Show loading state while fetching new currency data
      
      // Clear any accumulated snapshot data
      snapshotAccumRef.current = null;
      dataBatchRef.current.clear();
      
      socketRef.current.send(JSON.stringify({
        type: 'request_snapshot',
        sort_by: 'profit',
        sort_order: 'desc',
        page_size: 1000, // Get all pairs for this currency
        quote_currency: baseCurrency
      }));
      const storedToken = getStoredAccessToken();
      if (storedToken) {
        void loadDashboardData(storedToken, baseCurrency, 1000);
      }
      // Reset session state for new currency
      setIsNewSession(true);
      setSessionSortOrder([]);
      
      // Safety timeout: If no data arrives within 15 seconds, stop loading and show error
      const currencyChangeTimeout = setTimeout(() => {
        // Only trigger if still loading AND no data for this currency
        if (isMountedRef.current && baseCurrencyRef.current === baseCurrency) {
          // Check if we have any data for the current currency
          setCryptoData(currentData => {
            if (currentData.length === 0) {
              console.warn(`⏱️ Currency change timeout for ${baseCurrency} - no data received`);
              setLoading(false);
              setError(`No data available for ${baseCurrency}. Try a different currency or refresh the page.`);
            }
            return currentData;
          });
        }
      }, 15000);
      
      // Clean up timeout on next currency change
      return () => clearTimeout(currencyChangeTimeout);
    } else {
      // WebSocket not connected - wait and retry
      console.warn('⚠️ WebSocket not connected yet, waiting for connection...');
      
      // Wait for WebSocket to connect, then request data
      const waitForConnection = setInterval(() => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          clearInterval(waitForConnection);
          console.log('✅ WebSocket connected! Requesting data for', baseCurrency);
          
          // Clear old data
          setCryptoData([]);
          setAllCryptoData([]);
          setError(null);
          setLoading(true);
          
          socketRef.current.send(JSON.stringify({
            type: 'request_snapshot',
            sort_by: 'profit',
            sort_order: 'desc',
            page_size: 1000,
            quote_currency: baseCurrency
          }));
          const storedToken = getStoredAccessToken();
          if (storedToken) {
            void loadDashboardData(storedToken, baseCurrency, 1000);
          }
        }
      }, 500); // Check every 500ms
      
      // Stop waiting after 10 seconds
      const stopWaiting = setTimeout(() => {
        clearInterval(waitForConnection);
        if (socketRef.current?.readyState !== WebSocket.OPEN) {
          setLoading(false);
          setError('Unable to connect. Please refresh the page.');
        }
      }, 10000);
      
      return () => {
        clearInterval(waitForConnection);
        clearTimeout(stopWaiting);
      };
    }
  }, [baseCurrency]);

  // Cleanup throttle map periodically to prevent memory leaks
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const maxAge = 30000; // Keep entries for 30 seconds

      blinkThrottleRef.current.forEach((timestamp, key) => {
        if (now - timestamp > maxAge) {
          blinkThrottleRef.current.delete(key);
        }
      });
    }, 10000); // Cleanup every 10 seconds

    return () => clearInterval(cleanupInterval);
  }, []);

  // Free Refresh button should request a full snapshot over WS instead of REST
  const requestWebSocketSnapshot = useCallback(() => {
    try {
      socketRef.current?.send(JSON.stringify({ 
        type: 'request_snapshot', 
        sort_by: 'profit', 
        sort_order: 'desc', 
        page_size: 1000,
        quote_currency: baseCurrency
      }));
    } catch (e: unknown) {
      console.error('Failed to request WS snapshot', e);
    }
  }, [baseCurrency]);

  const sortedAndFilteredData = useMemo(() => {
    const base: CryptoData[] = Array.isArray(cryptoData) ? cryptoData : [];
    let filteredData = base
      .filter(crypto =>
        crypto.symbol &&
        crypto.symbol.endsWith(baseCurrency) && // Only show symbols matching selected currency
        crypto.symbol.toLowerCase().includes(searchQuery.toLowerCase())
      );

    if (symbolFilter.length > 0) {
      filteredData = filteredData.filter(crypto => symbolFilter.includes(crypto.symbol));
    }

    // Always apply sorting when sortConfig exists
    if (sortConfig) {
      filteredData.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
          
          // Helper function to check if value should be treated as "empty"
          // Note: 0 is a VALID value for prices/percentages, don't treat it as empty
          const isEmpty = (val: any) => {
            return val === null || 
                   val === undefined || 
                   val === 'N/A' || 
                   val === '';
          };

          // Helper function to convert value to number for sorting
          const toNumber = (val: any): number => {
            if (typeof val === 'number') return val;
            if (typeof val === 'string') {
              const parsed = parseFloat(val);
              return isNaN(parsed) ? 0 : parsed;
            }
            return 0;
          };
          
          const aEmpty = isEmpty(aValue);
          const bEmpty = isEmpty(bValue);
          
          // Both empty - maintain order
          if (aEmpty && bEmpty) return 0;
          // a is empty - push to end
          if (aEmpty) return 1;
          // b is empty - push to end
          if (bEmpty) return -1;
          
          // For numeric columns (prices, volumes, percentages), always sort as numbers
          const numericColumns = ['last_price', 'bid_price', 'ask_price', 'spread', 'high_price_24h', 'low_price_24h', 
            'price_change_percent_24h', 'quote_volume_24h', 'm1', 'm2', 'm3', 'm5', 'm10', 'm15', 'm60',
            'm1_vol_pct', 'm2_vol_pct', 'm3_vol_pct', 'm5_vol_pct', 'm10_vol_pct', 'm15_vol_pct', 'm60_vol_pct',
            'm1_r_pct', 'm2_r_pct', 'm3_r_pct', 'm5_r_pct', 'm10_r_pct', 'm15_r_pct', 'm60_r_pct',
            'm1_vol', 'm5_vol', 'm10_vol', 'm15_vol', 'm60_vol', 'rsi_1m', 'rsi_3m', 'rsi_5m', 'rsi_15m'];
          
          if (numericColumns.includes(sortConfig.key as string)) {
            const aNum = toNumber(aValue);
            const bNum = toNumber(bValue);
            return sortConfig.direction === 'ascending' ? aNum - bNum : bNum - aNum;
          }
          
          // Both have valid values - sort normally
          if (typeof aValue === 'number' && typeof bValue === 'number') {
            return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
          }
          if (typeof aValue === 'string' && typeof bValue === 'string') {
            return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
          }
          return 0;
        });
    }
    
    if (itemCount === 'All') {
      return filteredData;
    }
    return filteredData.slice(0, parseInt(itemCount));
  }, [cryptoData, sortConfig, baseCurrency, itemCount, searchQuery, symbolFilter]);

  // Total count of coins for selected currency
  const totalCoinCount = useMemo(() => {
    // allCryptoData contains all symbols for current currency
    // Use it for accurate count, fallback to cryptoData
    const base: CryptoData[] = Array.isArray(allCryptoData) && allCryptoData.length > 0 
      ? allCryptoData 
      : (Array.isArray(cryptoData) ? cryptoData : []);
    return base.length;
  }, [allCryptoData, cryptoData]);

  const filteredSymbols = useMemo(() => {
    // Use allCryptoData for symbol filtering if available
    const base: CryptoData[] = Array.isArray(allCryptoData) && allCryptoData.length > 0 
      ? allCryptoData 
      : (Array.isArray(cryptoData) ? cryptoData : []);
    return base
      .map(c => c.symbol)
      .filter(symbol => 
        symbol.toLowerCase().includes(symbolSearch.toLowerCase())
      );
  }, [cryptoData, symbolSearch, baseCurrency]);
  
  // Lazy loading with Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && !isLoadingMore) {
          const totalRows = sortedAndFilteredData.length;
          if (visibleRowCount < totalRows) {
            setIsLoadingMore(true);
            // Load 100 more rows quickly
            setTimeout(() => {
              setVisibleRowCount(prev => Math.min(prev + 100, totalRows));
              setIsLoadingMore(false);
            }, 50);
          }
        }
      },
      {
        root: tableContainerRef.current,
        rootMargin: '400px', // Start loading 400px before reaching bottom for smoother experience
        threshold: 0.1
      }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [sortedAndFilteredData.length, visibleRowCount, isLoadingMore]);
  
  // Reset visible rows when filters, sorting, or item count changes
  useEffect(() => {
    // Start with a reasonable number for performance, then lazy load more
    const targetCount = itemCount === 'All' ? sortedAndFilteredData.length : parseInt(itemCount);
    // Start with 50 rows max initially for fast rendering, lazy load the rest
    setVisibleRowCount(Math.min(targetCount, 50));
  }, [searchQuery, symbolFilter, sortConfig, itemCount, sortedAndFilteredData.length]);

  const requestSort = (key: keyof CryptoData) => {
    let direction: 'ascending' | 'descending' = 'descending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'descending') {
      direction = 'ascending';
    }
    setSortConfig({ key, direction });
    // Reset session when user manually sorts
    setIsNewSession(true);
  };

  const getSortIcon = (key: keyof CryptoData) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ChevronsUpDown className="h-4 w-4 text-gray-400" />;
    }
    if (sortConfig.direction === 'ascending') {
      return <ArrowUp className="h-4 w-4" />;
    }
    return <ArrowDown className="h-4 w-4" />;
  };

  const handleSymbolFilterChange = (symbol: string) => {
    setSymbolFilter(prev => {
      const newSet = new Set(prev);
      if (newSet.has(symbol)) {
        newSet.delete(symbol);
      } else {
        newSet.add(symbol);
      }
      return Array.from(newSet);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <LoadingSpinner message="Loading crypto data..." />
      </div>
    );
  }

  const formatNumber = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';

    const numericValue = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(numericValue)) {
      return 'N/A';
    }

    if (numericValue > 1_000_000) return `${(numericValue / 1_000_000).toFixed(2)}M`;
    if (numericValue > 1_000) return `${(numericValue / 1_000).toFixed(2)}K`;
    if (Math.abs(numericValue) < 1 && numericValue !== 0) return numericValue.toFixed(6);
    return numericValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const renderCellContent = (key: string, crypto: CryptoData, isPremiumUser: boolean) => {
    const value = crypto[key];

    const isPremiumColumn = !freeColumns.includes(key);
    const shouldBlur = !isPremiumUser && isPremiumColumn;

    const selectedExchangeData = exchanges.find(e => e.id === selectedExchange);

    if (key === 'symbol' && selectedExchangeData) {
      // Strip the quote currency from the symbol (e.g., BTCUSDT -> BTC)
      const baseSymbol = crypto.symbol.replace(baseCurrency, '');
      
      let tradeLink = selectedExchangeData.baseUrl;
      const pair = crypto.symbol.replace(baseCurrency, `_${baseCurrency}`);
      switch (selectedExchange) {
        case 'binance': tradeLink += pair; break;
        case 'binance_futures': tradeLink += crypto.symbol; break;
        case 'mexc': tradeLink += pair; break;
        case 'bybit': tradeLink += crypto.symbol.replace(baseCurrency, `/${baseCurrency}`); break;
        case 'kucoin': tradeLink += crypto.symbol.replace(baseCurrency, `-${baseCurrency}`); break;
        case 'trading_view': tradeLink += `BINANCE:${crypto.symbol}`; break;
        default: tradeLink += pair; break;
      }
      return (
        <a href={tradeLink} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2">
          <span className="font-medium text-lg">{baseSymbol}</span>
          {/* Use img tag with inline fallback for better reliability */}
          <img 
            src={selectedExchangeData.logo} 
            alt={selectedExchangeData.name} 
            width={20} 
            height={20} 
            className="object-contain h-5 w-5"
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        </a>
      );
    }

    if (value === null || value === undefined) {
      return <span className={cn("text-gray-500", shouldBlur && "blur-sm select-none")}>N/A</span>;
    }

    let formattedValue: React.ReactNode;
    if (changeColumns.includes(key)) {
      formattedValue = renderChange(value as number);
    } else if (typeof value === 'number' || typeof value === 'string') {
      formattedValue = formatNumber(value);
    } else {
      formattedValue = value;
    }

    if (shouldBlur) {
      return <span className="blur-sm select-none">{formattedValue}</span>;
    }

    return formattedValue;
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col">
      <Header />
      <main className="flex-1 w-full">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {/* Performance improvement info */}
          {/* <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center space-x-2 text-sm text-blue-800">
                  <RefreshCw className="h-4 w-4" />
                  <span>
                    <strong>Improved Performance:</strong> Now using real-time WebSocket updates with visual change indicators! 
                    {isPremium ? ' Auto-refresh every 10 seconds.' : ' Click "Refresh Data" to update manually.'}
                    {blinkEnabled && <span className="ml-2">🟢 Green = increase, 🔴 Red = decrease</span>}
                  </span>
                </div>
              </div> */}

          <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 lg:mb-8 gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-wrap">
              {/* Currency Selector - First (Most Important) */}
              <Select 
                onValueChange={(value: string) => {
                  console.log('🎯 Currency dropdown changed - User selected:', value);
                  setBaseCurrency(value);
                }} 
                value={baseCurrency}
                name="currency-selector"
              >
                <SelectTrigger id="currency-selector" className="w-full sm:w-[180px] bg-white font-semibold">
                  <SelectValue placeholder="Select Currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USDT">USDT</SelectItem>
                  <SelectItem value="USDC">USDC</SelectItem>
                  <SelectItem value="FDUSD">FDUSD</SelectItem>
                  <SelectItem value="BNB">BNB</SelectItem>
                  <SelectItem value="BTC">BTC</SelectItem>
                </SelectContent>
              </Select>
              
              <Select onValueChange={setItemCount} value={itemCount} name="item-count">
                <SelectTrigger id="item-count" className="w-full sm:w-[130px] bg-white">
                  <SelectValue placeholder="Count" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All ({totalCoinCount})</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search-crypto"
                  name="search-crypto"
                  type="text"
                  placeholder="Search..."
                  className="pl-10 w-full bg-white rounded-md border-gray-300 focus:ring-2 focus:ring-indigo-200"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoComplete="off"
                />
              </div>
              {isPremium ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs sm:text-sm text-gray-500">
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="h-4 w-4" />
                    <span>Auto-refresh: Next in {countdown}s</span>
                  </div>
                  {lastUpdateTime && (
                    <span className="text-xs text-gray-400">Last: {lastUpdateTime}</span>
                  )}
                  <span className="text-xs text-blue-600">• Premium Auto-Update</span>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="text-xs text-amber-600 whitespace-nowrap">• Free Plan - Manual Refresh Only</span>
                  <Button
                    onClick={handleManualRefresh}
                    disabled={isRefreshing}
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-2 w-full sm:w-auto"
                  >
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>{isRefreshing ? 'Updating...' : 'Refresh Data'}</span>
                  </Button>
                  {lastUpdateTime && (
                    <span className="text-xs text-gray-500">Last: {lastUpdateTime}</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={!isPremium} className="w-full sm:w-auto">Select Columns</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  className="w-64 max-h-[500px] overflow-y-auto z-[200]" 
                  onInteractOutside={(e: Event) => {
                    // Allow closing when clicking outside
                  }}
                  onEscapeKeyDown={(e: KeyboardEvent) => {
                    // Allow closing with Escape key
                  }}
                >
                  <DropdownMenuLabel>Column Visibility</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  
                  {/* Select All / Clear All buttons */}
                  <div className="flex gap-2 px-2 py-2 border-b">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 h-8 text-xs"
                      onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const newColumns = new Set(allColumns.map(col => col.key));
                        setVisibleColumns(newColumns);
                      }}
                    >
                      Select All
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 h-8 text-xs"
                      onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Keep only the symbol column visible
                        setVisibleColumns(new Set(['symbol']));
                      }}
                    >
                      Clear All
                    </Button>
                  </div>

                  {/* Column checkboxes */}
                  <div className="py-1">
                    {allColumns.map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.key}
                        checked={visibleColumns.has(column.key)}
                        onCheckedChange={() => toggleColumn(column.key)}
                        onSelect={(e: Event) => {
                          // Prevent dropdown from closing when clicking checkbox
                          e.preventDefault();
                        }}
                        className="cursor-pointer"
                      >
                        {column.title}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Performance Settings */}
              {/* Removed Performance dropdown - blinking now enabled by default */}
              {/* Removed UPGRADE button as per requirement */}
            </div>
          </header>

          <section className="mb-4 md:mb-8">
            <div className="flex gap-2 sm:gap-4 p-2 sm:p-4 bg-white rounded-lg shadow-md overflow-x-auto">
              {exchanges.map((exchange) => (
                <div
                  key={exchange.id}
                  className={cn(
                    "flex items-center justify-center gap-2 cursor-pointer transition-colors p-2 sm:p-3 rounded-lg flex-shrink-0 min-w-[120px] sm:min-w-[150px]",
                    selectedExchange === exchange.id ? "bg-gray-200 border border-gray-300" : "hover:bg-gray-100"
                  )}
                  onClick={() => setSelectedExchange(exchange.id)}
                >
                  {/* Use img tag with error handling for reliability */}
                  <img 
                    src={exchange.logo} 
                    alt={exchange.name} 
                    width={32} 
                    height={32} 
                    className="object-contain w-8 h-8 sm:w-10 sm:h-10"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                  <span className="font-medium text-gray-700 text-xs sm:text-sm">{exchange.name}</span>
                </div>
              ))}
            </div>
          </section>

        <section className="flex-1">
          <div className="bg-white overflow-hidden rounded-lg shadow-sm">
            <div ref={tableContainerRef} className="max-h-[65vh] min-h-[400px] overflow-y-auto overflow-x-auto">
              <Table className="min-w-full text-xs sm:text-sm">
                <TableHeader className="bg-gray-100 sticky top-0 z-30">
                  <TableRow className="border-b border-gray-200">
                      {allColumns.filter(col => visibleColumns.has(col.key)).map((col) => (
                        <TableHead
                          key={col.key}
                          className={cn(
                            "px-1 sm:px-2 py-2 text-left text-xs sm:text-sm",
                            col.key === 'symbol' && "sticky left-0 bg-gray-100 z-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                          )}
                        >
                          <div className="flex items-center whitespace-nowrap">
                            {col.key === 'symbol' ? (
                              <>
                                <span>{col.title}</span>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="ml-2 h-6 w-6">
                                      <Filter className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="w-64 p-2 z-[200]" onSelect={(e: Event) => e.preventDefault()}>
                                    <div className="flex items-center border-b pb-2 mb-2">
                                      <Search className="h-4 w-4 mr-2 text-gray-400" />
                                      <Input
                                        id="symbol-search"
                                        name="symbol-search"
                                        placeholder="Search symbols..."
                                        value={symbolSearch}
                                        onChange={(e) => setSymbolSearch(e.target.value)}
                                        className="h-8 text-sm"
                                        autoComplete="off"
                                      />
                                    </div>
                                    <div className="max-h-60 overflow-y-auto">
                                      {filteredSymbols.map(symbol => (
                                        <div key={symbol} className="flex items-center space-x-2 p-1">
                                          <Checkbox
                                            id={`symbol-${symbol}`}
                                            checked={symbolFilter.includes(symbol)}
                                            onCheckedChange={() => handleSymbolFilterChange(symbol)}
                                          />
                                          <label htmlFor={`symbol-${symbol}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                            {symbol}
                                          </label>
                                        </div>
                                      ))}
                                    </div>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </>
                            ) : (
                              <button 
                                className="flex items-center space-x-1 cursor-pointer hover:text-gray-900 transition-colors focus:outline-none w-full"
                                onClick={() => requestSort(col.key as keyof CryptoData)}
                              >
                                <span>{col.title}</span>
                                {getSortIcon(col.key as keyof CryptoData)}
                              </button>
                            )}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedAndFilteredData.length > 0 ? (
                      <>
                        {sortedAndFilteredData.slice(0, visibleRowCount).map((crypto) => (
                          <TableRow key={crypto.symbol} className="border-gray-200 hover:bg-gray-50 transition-colors">
                            {allColumns.filter(col => visibleColumns.has(col.key)).map((col) => (
                              <TableCell
                                key={col.key}
                                className={cn(
                                  "px-1 sm:px-2 py-1.5 sm:py-2 text-left transition-all duration-200 text-xs sm:text-sm whitespace-nowrap",
                                  col.key === 'symbol' && "sticky left-0 bg-white z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]",
                                  blinkingCells[`${crypto.symbol}-${col.key}`] === 'green' && 'blink-green',
                                  blinkingCells[`${crypto.symbol}-${col.key}`] === 'red' && 'blink-red'
                                )}
                                style={
                                  blinkingCells[`${crypto.symbol}-${col.key}`] ? {
                                    animationName: blinkingCells[`${crypto.symbol}-${col.key}`] === 'green' ? 'blinkGreen' : 'blinkRed',
                                    animationDuration: '1.2s',
                                    animationTimingFunction: 'ease-in-out'
                                  } : undefined
                                }
                              >
                                {renderCellContent(col.key, crypto, isPremium)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                        {visibleRowCount < sortedAndFilteredData.length && (
                          <TableRow ref={observerTarget}>
                            <TableCell colSpan={visibleColumns.size} className="h-20 text-center">
                              {isLoadingMore ? (
                                <LoadingSpinner message="Loading more rows..." className="min-h-[80px]" />
                              ) : (
                                <span className="text-gray-400">Scroll for more</span>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ) : (
                      <TableRow>
                        <TableCell colSpan={visibleColumns.size} className="h-24 text-center">
                          <span className="text-gray-500">
                            {error || 'No data to display. Try changing filters.'}
                          </span>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}