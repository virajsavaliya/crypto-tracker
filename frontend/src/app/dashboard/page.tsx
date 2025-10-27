'use client';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Search, ChevronUp, ChevronDown, Loader2, ArrowDown, ArrowUp, ChevronsUpDown, RefreshCw, Filter } from 'lucide-react';
import { cn } from '../../lib/utils';
import Header from '../../components/shared/Header';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import Image from 'next/image';
import '../../styles/blink-animations.css';
import { useInactivityLogout } from '../../lib/useInactivityLogout';

interface CryptoData {
  symbol: string;
  last_price: number;
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
  { id: 'mexc', name: 'MEXC', logo: '/treding_logo/mexc.png', baseUrl: 'https://www.mexc.com/exchange/' },
  { id: 'bybit', name: 'Bybit', logo: '/treding_logo/bybit.png', baseUrl: 'https://www.bybit.com/en-US/trade/spot/' },
  { id: 'kucoin', name: 'Kucoin', logo: '/treding_logo/kucoin.png', baseUrl: 'https://www.kucoin.com/trade/' },
  { id: 'trading_view', name: 'Trading View', logo: '/treding_logo/tv.png', baseUrl: 'https://www.tradingview.com/chart/?symbol=' },
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
  const socketRef = useRef<WebSocket | null>(null);
  const dataBatchRef = useRef<Map<string, CryptoData>>(new Map());
  const snapshotAccumRef = useRef<{ chunks: number; total: number; buffer: Map<string, CryptoData> } | null>(null);
  const isMountedRef = useRef<boolean>(true); // Track if component is mounted
  
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
      localStorage.removeItem('user');
      localStorage.removeItem('is_premium_user');
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

  // Manual refresh function for free users
  const handleManualRefresh = useCallback(() => {
    if (!socketRef.current) return;

    setIsRefreshing(true);
    setLastUpdateTime(new Date().toLocaleTimeString());

    // Request fresh data via WebSocket
    try {
      const pageSize = itemCount === 'All' ? 500 : Math.min(parseInt(itemCount), 100);
      socketRef.current.send(JSON.stringify({
        type: 'request_snapshot',
        sort_by: 'profit',
        sort_order: 'desc',
        page_size: pageSize
      }));
    } catch (error) {
      console.error('Failed to request data refresh:', error);
    }

    // Stop refreshing indicator after 2 seconds
    setTimeout(() => setIsRefreshing(false), 2000);
  }, [itemCount]);

  // WebSocket-only data fetching - no more REST API calls
  const requestWebSocketData = useCallback((pageSize: number = 100) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    try {
      socketRef.current.send(JSON.stringify({
        type: 'request_snapshot',
        sort_by: 'profit',
        sort_order: 'desc',
        page_size: pageSize
      }));
    } catch (error) {
      console.error('Failed to request WebSocket data:', error);
    }
  }, []);

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

  // Request data when itemCount changes (WebSocket-only)
  useEffect(() => {
    if (!loading && socketRef.current) {
      const pageSize = itemCount === 'All' ? 500 : Math.min(parseInt(itemCount), 100);
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
    
    const userStr = localStorage.getItem('user');
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
        
        // ALWAYS fetch fresh user data if upgrade=success OR if user details are missing
        const shouldFetchUserData = upgradeSuccess || 
                                     user.subscription_plan === undefined || 
                                     user.is_premium_user === undefined;
        
        if (shouldFetchUserData) {
          if (upgradeSuccess) {
            console.log('🎉 Upgrade successful! Fetching updated user data...');
          } else {
            console.log('⚠️ Dashboard - Missing user details, fetching from API...');
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
              
              // Update localStorage with complete user data
              const updatedUser = { ...user, ...userDetails };
              localStorage.setItem('user', JSON.stringify(updatedUser));
              
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

        // Always connect WebSocket for both free and paid users
        connectWebSocket(user.access_token);

      } catch (e) {
        console.error('Error initializing dashboard:', e);
        if (isMountedRef.current) setError('Failed to load data. Please refresh.');
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    };

    const connectWebSocket = (token: string) => {
      const isLocal = window.location.hostname === 'localhost';
      const localWsUrl = 'ws://localhost:8080';
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
        setIsRefreshing(true);
        setLastUpdateTime(new Date().toLocaleTimeString());
        
        // Request initial snapshot - wait a bit for connection to stabilize
        setTimeout(() => {
          if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ 
              type: 'request_snapshot', 
              sort_by: 'profit', 
              sort_order: 'desc', 
              page_size: 500 
            }));
          }
        }, 100);
      };

      socketRef.current.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          // Handle authentication check
          if (msg?.type === 'ws_ack') {
            if (msg.is_authenticated === false) {
              socketRef.current?.close();
              handleLogout();
              return;
            }
          }
          
          // Snapshot streaming
          if (msg?.type === 'snapshot') {
            const items: CryptoData[] = Array.isArray(msg.data) ? msg.data : [];
            if (!snapshotAccumRef.current) {
              snapshotAccumRef.current = { chunks: msg.total_chunks || 1, total: msg.total_count || 0, buffer: new Map() };
            }
            items.forEach(i => snapshotAccumRef.current!.buffer.set(i.symbol, i));
            
            // When last chunk arrives, commit
            if (msg.chunk >= (snapshotAccumRef.current.chunks || 1)) {
              const merged = Array.from(snapshotAccumRef.current.buffer.values());
              snapshotAccumRef.current = null;
              setCryptoData(merged);
              setIsRefreshing(false);
            }
            return;
          }
          
          // Delta updates - batch them for 10-second cycles
          if (msg?.type === 'delta') {
            const updatedBatch: CryptoData[] = Array.isArray(msg.data) ? msg.data : [];
            updatedBatch.forEach(newItem => {
              dataBatchRef.current.set(newItem.symbol, newItem);
            });
            return;
          }
          
          // Backward compatibility: raw array
          if (Array.isArray(msg)) {
            msg.forEach((item: CryptoData) => {
              dataBatchRef.current.set(item.symbol, item);
            });
          }
        } catch (e) {
          console.error('WebSocket message parse error:', e);
        }
      };

      socketRef.current.onclose = (event) => {
        // Check if user is still logged in and component is mounted
        const userStrNow = localStorage.getItem('user');
        
        if (isMountedRef.current && userStrNow) {
          // Reconnect after 5 seconds
          setTimeout(() => {
            if (isMountedRef.current && localStorage.getItem('user')) {
              connectWebSocket(token);
            }
          }, 5000);
        }
      };

      socketRef.current.onerror = () => {
        // Errors are handled by onclose, just close the connection
        try { 
          socketRef.current?.close(); 
        } catch (e) {
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
    // Auto-refresh logic: 10s countdown for premium users, manual refresh for free users
    if (!isPremium) {
      setCountdown(0); // No countdown for free users
      return;
    }

    if (!socketRef.current) return;

    // Premium users: automatic refresh every 10 seconds with countdown
    const interval = setInterval(() => {
      setCountdown(prev => {
        
        // When countdown reaches 1, it will become 0 and trigger update
        if (prev <= 1) {
          // Update last update time
          setLastUpdateTime(new Date().toLocaleTimeString());
          
          // Request fresh snapshot for premium users
          if (socketRef.current?.readyState === WebSocket.OPEN) {
            const pageSize = itemCount === 'All' ? 500 : Math.min(parseInt(itemCount), 100);
            socketRef.current.send(JSON.stringify({
              type: 'request_snapshot',
              sort_by: 'profit',
              sort_order: 'desc',
              page_size: pageSize
            }));
          }

          // Apply any batched deltas with blinking animations (10-second cycle)
          const batchSize = dataBatchRef.current.size;
          
          if (batchSize > 0) {
            setCryptoData(prevData => {
              const dataMap = new Map(prevData.map(item => [item.symbol, item]));
              const newUpdatedItems: CryptoData[] = [];
              const oldItemsForChanges: CryptoData[] = [];

              dataBatchRef.current.forEach(newItem => {
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
          
          // Reset countdown to 10
          return 10;
        }
        
        // Decrement countdown
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPremium, itemCount]);

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
      socketRef.current?.send(JSON.stringify({ type: 'request_snapshot', sort_by: 'profit', sort_order: 'desc', page_size: 500 }));
    } catch (e) {
      console.error('Failed to request WS snapshot', e);
    }
  }, []);

  const sortedAndFilteredData = useMemo(() => {
    const base: CryptoData[] = Array.isArray(cryptoData) ? cryptoData : [];
    let filteredData = base
      .filter(crypto =>
        crypto.symbol &&
        crypto.symbol.toLowerCase().includes(searchQuery.toLowerCase())
      );

    if (symbolFilter.length > 0) {
      filteredData = filteredData.filter(crypto => symbolFilter.includes(crypto.symbol));
    }

    // For new sessions or when user manually sorts, apply fresh sorting
    if (isNewSession || sortConfig) {
      if (sortConfig) {
        filteredData.sort((a, b) => {
          const aValue = a[sortConfig.key];
          const bValue = b[sortConfig.key];
          if (aValue === null || aValue === undefined) return 1;
          if (bValue === null || bValue === undefined) return -1;
          if (typeof aValue === 'number' && typeof bValue === 'number') {
            return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
          }
          if (typeof aValue === 'string' && typeof bValue === 'string') {
            return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
          }
          return 0;
        });
      }

      // Store the session order after sorting
      const newOrder = filteredData.map(item => item.symbol);
      if (JSON.stringify(newOrder) !== JSON.stringify(sessionSortOrder)) {
        setSessionSortOrder(newOrder);
        setIsNewSession(false);
      }
    } else {
      // For existing sessions, maintain the session order while allowing data updates
      // Sort by session order, then by symbol as fallback for new symbols
      filteredData.sort((a, b) => {
        const aIndex = sessionSortOrder.indexOf(a.symbol);
        const bIndex = sessionSortOrder.indexOf(b.symbol);

        // Both symbols in session order
        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }
        // Only a is in session order
        if (aIndex !== -1) return -1;
        // Only b is in session order  
        if (bIndex !== -1) return 1;
        // Neither in session order, sort by symbol
        return a.symbol.localeCompare(b.symbol);
      });
    }
    if (itemCount === 'All') {
      return filteredData;
    }
    return filteredData.slice(0, parseInt(itemCount));
  }, [cryptoData, sortConfig, baseCurrency, itemCount, searchQuery, symbolFilter, sessionSortOrder, isNewSession]);

  const filteredSymbols = useMemo(() => {
    const base: CryptoData[] = Array.isArray(cryptoData) ? cryptoData : [];
    return base
      .map(c => c.symbol)
      .filter(symbol => symbol.toLowerCase().includes(symbolSearch.toLowerCase()));
  }, [cryptoData, symbolSearch]);
  
  // Lazy loading with Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && !isLoadingMore) {
          const totalRows = sortedAndFilteredData.length;
          if (visibleRowCount < totalRows) {
            setIsLoadingMore(true);
            // Load 50 more rows
            setTimeout(() => {
              setVisibleRowCount(prev => Math.min(prev + 50, totalRows));
              setIsLoadingMore(false);
            }, 100);
          }
        }
      },
      {
        root: tableContainerRef.current,
        rootMargin: '200px', // Start loading 200px before reaching bottom
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
  
  // Reset visible rows when filters or sorting change
  useEffect(() => {
    setVisibleRowCount(50);
  }, [searchQuery, symbolFilter, sortConfig]);

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
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-6">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
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
      let tradeLink = selectedExchangeData.baseUrl;
      const pair = crypto.symbol.replace('USDT', '_USDT');
      switch (selectedExchange) {
        case 'binance': tradeLink += pair; break;
        case 'binance_futures': tradeLink += crypto.symbol; break;
        case 'mexc': tradeLink += pair; break;
        case 'bybit': tradeLink += crypto.symbol.replace('USDT', '/USDT'); break;
        case 'kucoin': tradeLink += crypto.symbol.replace('USDT', '-USDT'); break;
        case 'trading_view': tradeLink += `BINANCE:${crypto.symbol}`; break;
        default: tradeLink += pair; break;
      }
      return (
        <a href={tradeLink} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2">
          <span className="font-medium text-lg">{crypto.symbol}</span>
          <div className="h-5 w-5 relative flex items-center justify-center">
            <Image src={selectedExchangeData.logo} alt={selectedExchangeData.name} width={20} height={20} className="object-contain" />
          </div>
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
    <div className="h-screen bg-gray-50 font-sans flex flex-col overflow-hidden">
      <div className="p-4 md:p-6 pb-0">
        <Header />
      </div>
      <main className="pt-4 md:pt-8 px-4 md:px-6 pb-4 md:pb-6 flex flex-col flex-grow min-h-0 h-full">
        <div className="container mx-auto px-0">
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

          <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4 md:mb-8 gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-wrap">
              <Select onValueChange={setItemCount} value={itemCount}>
                <SelectTrigger className="w-full sm:w-[100px] bg-white">
                  <SelectValue placeholder="Count" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search..."
                  className="pl-10 w-full bg-white rounded-md border-gray-300 focus:ring-2 focus:ring-indigo-200"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
                <DropdownMenuContent className="w-56 max-h-[400px] overflow-y-auto z-[200]" onSelect={(e) => e.preventDefault()}>
                  <DropdownMenuLabel>Column Visibility</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {allColumns.map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.key}
                      checked={visibleColumns.has(column.key)}
                      onCheckedChange={() => toggleColumn(column.key)}
                    >
                      {column.title}
                    </DropdownMenuCheckboxItem>
                  ))}
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
                  <Image src={exchange.logo} alt={exchange.name} width={32} height={32} className="object-contain sm:w-10 sm:h-10" />
                  <span className="font-medium text-gray-700 text-xs sm:text-sm">{exchange.name}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="flex-grow min-h-0 h-0">
          <Card className="h-full p-0 border-gray-200 overflow-hidden rounded-lg flex flex-col">
            <CardContent className="p-0 overflow-hidden flex-grow">
              <div ref={tableContainerRef} className="h-full max-h-[65vh] min-h-[300px] overflow-y-auto overflow-x-auto">
                <Table className="min-w-full text-xs sm:text-sm">
                  <TableHeader className="bg-gray-100 sticky top-0 z-30">
                    <TableRow className="border-b-0">
                      {allColumns.filter(col => visibleColumns.has(col.key)).map((col) => (
                        <TableHead
                          key={col.key}
                          className={cn(
                            "px-1 sm:px-2 py-2 text-left text-xs sm:text-sm",
                            col.key === 'symbol' && "sticky left-0 bg-gray-100 z-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                          )}
                        >
                          <div className="flex items-center whitespace-nowrap">
                            <span className="cursor-pointer" onClick={() => col.key !== 'symbol' && requestSort(col.key as keyof CryptoData)}>
                              {col.title}
                            </span>
                            {col.key === 'symbol' ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="ml-2 h-6 w-6">
                                    <Filter className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-64 p-2 z-[200]" onSelect={(e) => e.preventDefault()}>
                                  <div className="flex items-center border-b pb-2 mb-2">
                                    <Search className="h-4 w-4 mr-2 text-gray-400" />
                                    <Input
                                      placeholder="Search symbols..."
                                      value={symbolSearch}
                                      onChange={(e) => setSymbolSearch(e.target.value)}
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                  <div className="max-h-60 overflow-y-auto">
                                    {filteredSymbols.map(symbol => (
                                      <div key={symbol} className="flex items-center space-x-2 p-1">
                                        <Checkbox
                                          id={symbol}
                                          checked={symbolFilter.includes(symbol)}
                                          onCheckedChange={() => handleSymbolFilterChange(symbol)}
                                        />
                                        <label htmlFor={symbol} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                          {symbol}
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <span className="cursor-pointer" onClick={() => requestSort(col.key as keyof CryptoData)}>
                                {getSortIcon(col.key as keyof CryptoData)}
                              </span>
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
                                <div className="flex items-center justify-center space-x-2">
                                  <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                                  <span className="text-gray-500">Loading more rows...</span>
                                </div>
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
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}