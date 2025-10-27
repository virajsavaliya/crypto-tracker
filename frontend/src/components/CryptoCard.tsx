'use client';

import { Card, CardContent } from './ui/card';
import { ChevronUp, ChevronDown, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface CryptoData {
  symbol: string;
  last_price: number;
  price_change_percent_24h: number;
  quote_volume_24h: number;
  high_price_24h: number;
  low_price_24h: number;
  m1?: number;
  m5?: number;
  m15?: number;
  rsi_5m?: number;
  [key: string]: string | number | null | undefined;
}

interface Exchange {
  id: string;
  name: string;
  logo: string;
  baseUrl: string;
}

interface CryptoCardProps {
  crypto: CryptoData;
  exchange: Exchange;
  isPremium: boolean;
  priceChange?: 'up' | 'down' | 'neutral';
}

const formatNumber = (value: number | string | null | undefined, decimals = 2): string => {
  if (value === null || value === undefined) return 'N/A';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'N/A';
  
  if (Math.abs(num) >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toFixed(decimals);
};

export default function CryptoCard({ crypto, exchange, isPremium, priceChange }: CryptoCardProps) {
  // Safely handle potentially null/undefined values
  const priceChange24h = typeof crypto.price_change_percent_24h === 'number' 
    ? crypto.price_change_percent_24h 
    : 0;
  const isPositive = priceChange24h > 0;
  const changeColor = isPositive ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50';
  const borderColor = priceChange === 'up' ? 'border-green-500' : priceChange === 'down' ? 'border-red-500' : 'border-gray-200';

  const handleOpenTrade = () => {
    const url = exchange.baseUrl + crypto.symbol.replace('USDT', '_USDT');
    window.open(url, '_blank');
  };

  return (
    <Card className={cn(
      'overflow-hidden transition-all duration-300 hover:shadow-lg',
      `border-2 ${borderColor}`
    )}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-gray-900 truncate">
                {crypto.symbol.replace('USDT', '')}
              </h3>
              <span className="text-xs text-gray-500">/USDT</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              ${formatNumber(crypto.last_price, 4)}
            </div>
          </div>
          
          {/* Exchange Logo */}
          <div className="flex flex-col items-end gap-1">
            <Image
              src={exchange.logo}
              alt={exchange.name}
              width={24}
              height={24}
              className="rounded"
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={handleOpenTrade}
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* 24h Change */}
        <div className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-semibold mb-3', changeColor)}>
          {isPositive ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {priceChange24h.toFixed(2)}%
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* 24h High */}
          <div>
            <div className="text-xs text-gray-500 mb-1">24h High</div>
            <div className="text-sm font-semibold text-green-600">
              ${formatNumber(crypto.high_price_24h, 4)}
            </div>
          </div>

          {/* 24h Low */}
          <div>
            <div className="text-xs text-gray-500 mb-1">24h Low</div>
            <div className="text-sm font-semibold text-red-600">
              ${formatNumber(crypto.low_price_24h, 4)}
            </div>
          </div>

          {/* Volume */}
          <div>
            <div className="text-xs text-gray-500 mb-1">24h Volume</div>
            <div className="text-sm font-semibold">
              ${formatNumber(crypto.quote_volume_24h, 0)}
            </div>
          </div>

          {/* RSI */}
          {isPremium && crypto.rsi_5m !== undefined && crypto.rsi_5m !== null && (
            <div>
              <div className="text-xs text-gray-500 mb-1">RSI 5m</div>
              <div className={cn(
                'text-sm font-semibold',
                Number(crypto.rsi_5m) > 70 ? 'text-red-600' : Number(crypto.rsi_5m) < 30 ? 'text-green-600' : 'text-gray-900'
              )}>
                {Number(crypto.rsi_5m).toFixed(0)}
              </div>
            </div>
          )}

          {!isPremium && (
            <div className="col-span-2">
              <div className="text-xs text-center py-2 px-3 bg-gray-100 rounded text-gray-500">
                🔒 Unlock RSI and advanced metrics with Premium
              </div>
            </div>
          )}
        </div>

        {/* Premium Metrics */}
        {isPremium && (
          <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-2">
            {crypto.m1 !== undefined && crypto.m1 !== null && (
              <div>
                <div className="text-[10px] text-gray-500">1m</div>
                <div className={cn(
                  'text-xs font-semibold',
                  Number(crypto.m1) > 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {Number(crypto.m1).toFixed(2)}%
                </div>
              </div>
            )}
            {crypto.m5 !== undefined && crypto.m5 !== null && (
              <div>
                <div className="text-[10px] text-gray-500">5m</div>
                <div className={cn(
                  'text-xs font-semibold',
                  Number(crypto.m5) > 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {Number(crypto.m5).toFixed(2)}%
                </div>
              </div>
            )}
            {crypto.m15 !== undefined && crypto.m15 !== null && (
              <div>
                <div className="text-[10px] text-gray-500">15m</div>
                <div className={cn(
                  'text-xs font-semibold',
                  Number(crypto.m15) > 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {Number(crypto.m15).toFixed(2)}%
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
