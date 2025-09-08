'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
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

const renderChange = (value: number) => {
    if (value === null || value === undefined) return <span className="text-gray-500">N/A</span>;
    const isPositive = value > 0;
    const color = isPositive ? 'text-green-600' : 'text-red-600';
    const icon = isPositive ? <ChevronUp className="h-4 w-4 inline-block align-text-bottom mr-1" /> : <ChevronDown className="h-4 w-4 inline-block align-text-bottom mr-1" />;
    return (
        <span className={`flex items-center justify-start font-medium ${color}`}>
            {icon}
            {value.toFixed(2)}%
        </span>
    );
};

let isRefreshing = false;

export default function DashboardPage() {
    const allColumns = useMemo(() => [
        { key: 'symbol', title: 'Symbol' },
        { key: 'last_price', title: 'Last Price'},
        { key: 'spread', title: 'Spread' },
        { key: 'high_price_24h', title: '24h High' },
        { key: 'low_price_24h', title: '24h Low' },
        { key: 'price_change_percent_24h', title: '24h %' },
        { key: 'quote_volume_24h', title: '24h Vol' },
        { key: 'm1', title: '1m %' }, { key: 'm5', title: '5m %' }, { key: 'm10', title: '10m %' }, { key: 'm15', title: '15m %' }, { key: 'm60', title: '60m %' },
        { key: 'm1_vol_pct', title: '1m Vol %' }, { key: 'm2_vol_pct', title: '2m Vol %' }, { key: 'm3_vol_pct', title: '3m Vol %' }, { key: 'm5_vol_pct', title: '5m Vol %' }, { key: 'm10_vol_pct', title: '10m Vol %' }, { key: 'm15_vol_pct', title: '15m Vol %' }, { key: 'm60_vol_pct', title: '60m Vol %' },
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
        { key: 'm1_bv', title: '1mBV' }, { key: 'm2_bv', title: '2mBV' }, { key: 'm3_bv', title: '3mBV' }, { key: 'm5_bv', title: '5mBV' }, { key: 'm10_bv', title: '10mBV' }, { key: 'm15_bv', title: '15mBV' }, { key: 'm60_bv', title: '60mBV' },
        { key: 'm1_sv', title: '1mSV' }, { key: 'm2_sv', title: '2mSV' }, { key: 'm3_sv', title: '3mSV' }, { key: 'm5_sv', title: '5mSV' }, { key: 'm10_sv', title: '10mSV' }, { key: 'm15_sv', title: '15mSV' }, { key: 'm60_sv', title: '60mSV' },
    ], []);

  const freeColumns = useMemo(() => ['symbol', 'last_price', 'high_price_24h', 'low_price_24h', 'price_change_percent_24h', 'quote_volume_24h'], []);
  const [isPremium, setIsPremium] = useState(false);
  const [plan, setPlan] = useState<string>('free');
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(allColumns.map(col => col.key)));
  const [userName, setUserName] = useState<string | null>('');
  const [cryptoData, setCryptoData] = useState<CryptoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExchange, setSelectedExchange] = useState('binance');
  const [sortConfig, setSortConfig] = useState<{ key: keyof CryptoData; direction: 'ascending' | 'descending' } | null>({ key: 'quote_volume_24h', direction: 'descending' });
  const [baseCurrency, setBaseCurrency] = useState<string>('USDT');
  const [itemCount, setItemCount] = useState<string>('25');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [symbolFilter, setSymbolFilter] = useState<string[]>([]);
  const [symbolSearch, setSymbolSearch] = useState('');

  const changeColumns = [
    'price_change_percent_24h', 'm1', 'm2', 'm3', 'm5', 'm10', 'm15', 'm60',
    'm1_vol_pct', 'm2_vol_pct', 'm3_vol_pct', 'm5_vol_pct', 'm10_vol_pct', 'm15_vol_pct', 'm60_vol_pct',
    'm1_range_pct', 'm2_range_pct', 'm3_range_pct', 'm5_range_pct', 'm10_range_pct', 'm15_range_pct', 'm60_range_pct'
  ];

  const handleLogout = useCallback(() => {
    localStorage.removeItem('user');
    localStorage.removeItem('is_premium_user');
    window.location.href = '/';
  }, []);

  const handleUpgradeClick = () => {
    window.location.href = '/upgrade-plan';
  };

  const refreshAndRetry = useCallback(async (originalRequest: (token?: string, isRetry?: boolean) => void) => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.refresh_token) {
      console.error('No refresh token found. Redirecting to login.');
      handleLogout();
      return;
    }
    if (isRefreshing) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const updatedUser = JSON.parse(localStorage.getItem('user') || '{}');
      await originalRequest(updatedUser.access_token, true);
      return;
    }
    isRefreshing = true;
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: user.refresh_token }),
      });
      if (response.ok) {
        const data = await response.json();
        const updatedUser = { ...user, access_token: data.access };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        await originalRequest(updatedUser.access_token, true);
      } else {
        console.error('Failed to refresh token. Redirecting to login.');
        handleLogout();
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      handleLogout();
    } finally {
      isRefreshing = false;
    }
  }, [handleLogout]);

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) newSet.delete(key);
      else newSet.add(key);
      return newSet;
    });
  };

  const fetchBackendData = useCallback(async (token?: string, isRetry = false) => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const authToken = token || user.access_token;
    if (!authToken) {
      handleLogout();
      return;
    }
    try {
      if (!cryptoData.length) {
        setLoading(true);
      }
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/binance-data/`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (!response.ok) {
        if (response.status === 401 && !isRetry) {
          await refreshAndRetry(fetchBackendData);
        } else {
          throw new Error('Failed to fetch data from backend');
        }
        return;
      }
      const data: CryptoData[] = await response.json();
      setCryptoData(data);
      setError(null);
    } catch (err: unknown) {
      console.error(err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred.');
      }
    } finally {
      setLoading(false);
    }
  }, [handleLogout, refreshAndRetry, cryptoData.length]);

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) {
      window.location.href = '/';
      return;
    }
    const userData = JSON.parse(user);
    setUserName(userData.first_name);

    let intervalId: NodeJS.Timeout | null = null;

    const fetchUserDetails = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, {
          headers: {
            'Authorization': `Bearer ${userData.access_token}`,
          },
        });
        if (response.ok) {
          const userDetails: User = await response.json();
          setIsPremium(userDetails.is_premium_user);
          setPlan(userDetails.subscription_plan);
          localStorage.setItem('is_premium_user', userDetails.is_premium_user.toString());
          localStorage.setItem('user_plan', userDetails.subscription_plan);

          // <<-- LOGIC MOVED HERE -->>
          // After confirming user's plan, set interval ONLY for premium users
          if (userDetails.is_premium_user) {
            intervalId = setInterval(fetchBackendData, 10000); // 10 seconds for paid users
          }
        }
      } catch (error) {
        console.error('Failed to fetch user details:', error);
        setPlan('free');
      }
    };

    fetchUserDetails();
    fetchBackendData(); // Fetch initial data for everyone

    // Cleanup function to clear the interval when the component unmounts
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fetchBackendData]);

  const sortedAndFilteredData = useMemo(() => {
    let filteredData = cryptoData
      .filter(crypto =>
        crypto.symbol &&
        crypto.symbol.endsWith(baseCurrency) &&
        crypto.symbol.toLowerCase().includes(searchQuery.toLowerCase())
      );

    if (symbolFilter.length > 0) {
      filteredData = filteredData.filter(crypto => symbolFilter.includes(crypto.symbol));
    }

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
          return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(bValue);
        }
        return 0;
      });
    }
    if (itemCount === 'All') {
        return filteredData;
    }
    return filteredData.slice(0, parseInt(itemCount));
  }, [cryptoData, sortConfig, baseCurrency, itemCount, searchQuery, symbolFilter]);

  const filteredSymbols = useMemo(() => {
    return cryptoData
      .filter(c => c.symbol && c.symbol.endsWith(baseCurrency))
      .map(c => c.symbol)
      .filter(symbol => symbol.toLowerCase().includes(symbolSearch.toLowerCase()));
  }, [cryptoData, symbolSearch, baseCurrency]);

  const requestSort = (key: keyof CryptoData) => {
    let direction: 'ascending' | 'descending' = 'descending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'descending') {
      direction = 'ascending';
    }
    setSortConfig({ key, direction });
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

  if (loading && !userName) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-6">
        <p className="text-gray-600">Redirecting to login...</p>
      </div>
    );
  }
  
  const formatNumber = (value: number | null | undefined) => {
      if (value === null || value === undefined) return 'N/A';
      if (value > 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
      if (value > 1_000) return `${(value / 1_000).toFixed(2)}K`;
      if (Math.abs(value) < 1 && value !== 0) return value.toFixed(6);
      return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    } else if (typeof value === 'number') {
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
      <div className="p-6 pb-0">
        <Header />
      </div>
      <main className="pt-8 px-6 pb-6 flex flex-col flex-grow min-h-0">
        <div className="container mx-auto px-0">
          <header className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <Select onValueChange={setBaseCurrency} defaultValue="USDT">
                <SelectTrigger className="w-[120px] bg-white">
                  <SelectValue placeholder="Base" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USDT">USDT</SelectItem>
                  <SelectItem value="BTC">BTC</SelectItem>
                </SelectContent>
              </Select>
              <Select onValueChange={setItemCount} defaultValue="25">
                <SelectTrigger className="w-[100px] bg-white">
                  <SelectValue placeholder="Count" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="All">All</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search..."
                  className="pl-10 w-full bg-white rounded-md border-gray-300 focus:ring-2 focus:ring-indigo-200"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={!isPremium}>Select Columns</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 max-h-[400px] overflow-y-auto" onSelect={(e) => e.preventDefault()}>
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

              {!isPremium && (
                <Button
                  onClick={handleUpgradeClick}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
                >
                  UPGRADE
                </Button>
              )}
                 {plan === 'free' && (
                  <Button
                    onClick={() => fetchBackendData()}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                )}
            </div>
          </header>

          <section className="mb-8">
            <div className="flex space-x-4 p-4 bg-white rounded-lg shadow-md overflow-x-auto">
              {exchanges.map((exchange) => (
                <div
                  key={exchange.id}
                  className={cn(
                    "flex items-center justify-center space-x-2 cursor-pointer transition-colors p-3 rounded-lg flex-shrink-0 min-w-[150px]",
                    selectedExchange === exchange.id ? "bg-gray-200 border border-gray-300" : "hover:bg-gray-100"
                  )}
                  onClick={() => setSelectedExchange(exchange.id)}
                >
                  <Image src={exchange.logo} alt={exchange.name} width={40} height={40} className="object-contain" />
                  <span className="font-medium text-gray-700">{exchange.name}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="flex-grow min-h-0">
          <Card className="h-full p-0 border-gray-200 overflow-hidden rounded-lg flex flex-col">
            <CardContent className="p-0 overflow-hidden flex-grow">
              <div className="h-full overflow-auto">
                <Table className="min-w-full">
                  <TableHeader className="bg-gray-100 sticky top-0 z-10">
                    <TableRow className="border-b-0">
                      {allColumns.filter(col => visibleColumns.has(col.key)).map((col) => (
                        <TableHead key={col.key} className="px-2 py-2 text-left" >
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
                                <DropdownMenuContent className="w-64 p-2" onSelect={(e) => e.preventDefault()}>
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
                    {loading && cryptoData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={visibleColumns.size} className="h-24 text-center">
                          <div className="flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                            <span className="ml-2">Loading initial data...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : sortedAndFilteredData.length > 0 ? (
                      sortedAndFilteredData.map((crypto) => (
                        <TableRow key={crypto.symbol} className="border-gray-200 hover:bg-gray-50 transition-colors">
                          {allColumns.filter(col => visibleColumns.has(col.key)).map((col) => (
                            <TableCell
                              key={col.key}
                              className={cn("px-2 py-2 text-left", col.key === 'symbol' && "min-w-[150px]")}
                            >
                              {renderCellContent(col.key, crypto, isPremium)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
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