'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Bell, Loader2, TrendingUp, TrendingDown, Bell as BellIcon, TrendingUp as ActivityIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { AlertType, NotificationChannel, TimeFrame, CreateAlertPayload } from '@/types/alerts';

interface CreateAlertFormProps {
  telegramConnected: boolean;
  onAlertCreated?: () => void;
}

export default function CreateAlertForm({ telegramConnected, onAlertCreated }: CreateAlertFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [alertType, setAlertType] = useState<AlertType>('pump');
  const [threshold, setThreshold] = useState<number>(10);
  const [timeframe, setTimeframe] = useState<TimeFrame>('15m');
  const [notificationChannels, setNotificationChannels] = useState<NotificationChannel[]>(['email']);

  const handleNotificationToggle = (channel: NotificationChannel) => {
    setNotificationChannels(prev => {
      if (prev.includes(channel)) {
        return prev.filter(c => c !== channel);
      } else {
        return [...prev, channel];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validation
    if (!symbol || symbol.trim() === '') {
      setError('Please enter a valid symbol');
      return;
    }

    if (threshold <= 0) {
      setError('Threshold must be greater than 0');
      return;
    }

    if (notificationChannels.length === 0) {
      setError('Please select at least one notification channel');
      return;
    }

    if (notificationChannels.includes('telegram') && !telegramConnected) {
      setError('Please connect Telegram first to receive Telegram alerts');
      return;
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const authToken = user.access_token;

    if (!authToken) {
      setError('Not authenticated');
      return;
    }

    try {
      setLoading(true);

      const payload: CreateAlertPayload = {
        symbol: symbol.toUpperCase().trim(),
        alert_type: alertType,
        threshold: threshold,
        timeframe: timeframe,
        notification_channels: notificationChannels,
        is_active: true,
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/alert/create/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create alert');
      }

      const data = await response.json();
      
      if (data.success) {
        setSuccess(`Alert created successfully for ${symbol}!`);
        
        // Reset form
        setSymbol('BTCUSDT');
        setThreshold(10);
        setTimeframe('15m');
        
        // Call parent callback
        if (onAlertCreated) {
          onAlertCreated();
        }

        // Clear success message after 5 seconds
        setTimeout(() => {
          setSuccess(null);
        }, 5000);
      } else {
        throw new Error(data.error || 'Failed to create alert');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create alert');
    } finally {
      setLoading(false);
    }
  };

  const getAlertTypeInfo = (type: AlertType) => {
    switch (type) {
      case 'pump':
        return {
          icon: <TrendingUp className="h-5 w-5" />,
          label: 'Price Pump',
          description: 'Alert when price increases by threshold %',
          color: 'text-green-600',
        };
      case 'dump':
        return {
          icon: <TrendingDown className="h-5 w-5" />,
          label: 'Price Dump',
          description: 'Alert when price decreases by threshold %',
          color: 'text-red-600',
        };
      case 'price_target':
        return {
          icon: <BellIcon className="h-5 w-5" />,
          label: 'Price Target',
          description: 'Alert when price reaches specific value',
          color: 'text-blue-600',
        };
      case 'rsi_overbought':
        return {
          icon: <ActivityIcon className="h-5 w-5" />,
          label: 'RSI Overbought',
          description: 'Alert when RSI exceeds threshold (e.g., 70)',
          color: 'text-orange-600',
        };
      case 'rsi_oversold':
        return {
          icon: <ActivityIcon className="h-5 w-5" />,
          label: 'RSI Oversold',
          description: 'Alert when RSI falls below threshold (e.g., 30)',
          color: 'text-purple-600',
        };
      default:
        return {
          icon: <Bell className="h-5 w-5" />,
          label: 'Custom Alert',
          description: 'Custom alert condition',
          color: 'text-gray-600',
        };
    }
  };

  const currentAlertInfo = getAlertTypeInfo(alertType);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Bell className="h-6 w-6 text-indigo-600" />
          <div>
            <CardTitle>Create New Alert</CardTitle>
            <CardDescription>
              Set up custom alerts for price movements and technical indicators
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-4 bg-green-50 text-green-800 border-green-200">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Alert Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="alert-type">Alert Type</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {(['pump', 'dump', 'rsi_overbought', 'rsi_oversold', 'price_target'] as AlertType[]).map((type) => {
                const info = getAlertTypeInfo(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setAlertType(type)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      alertType === type
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`flex flex-col items-center space-y-2 ${alertType === type ? 'text-indigo-600' : 'text-gray-600'}`}>
                      {info.icon}
                      <span className="text-xs font-semibold text-center">{info.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {currentAlertInfo.description}
            </p>
          </div>

          {/* Symbol Input */}
          <div className="space-y-2">
            <Label htmlFor="symbol">Crypto Symbol</Label>
            <Input
              id="symbol"
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g., BTCUSDT, ETHUSDT"
              required
            />
            <p className="text-xs text-gray-500">Enter the trading pair symbol (e.g., BTCUSDT)</p>
          </div>

          {/* Threshold Input */}
          <div className="space-y-2">
            <Label htmlFor="threshold">
              {alertType.includes('rsi') ? 'RSI Level' : 'Threshold (%)'}
            </Label>
            <Input
              id="threshold"
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              placeholder={alertType.includes('rsi') ? '70' : '10'}
              step="0.1"
              min="0"
              required
            />
            <p className="text-xs text-gray-500">
              {alertType.includes('rsi')
                ? 'RSI value that will trigger the alert (e.g., 70 for overbought, 30 for oversold)'
                : 'Percentage change that will trigger the alert'}
            </p>
          </div>

          {/* Timeframe Selection */}
          <div className="space-y-2">
            <Label htmlFor="timeframe">Timeframe</Label>
            <Select value={timeframe} onValueChange={(value) => setTimeframe(value as TimeFrame)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1m">1 Minute</SelectItem>
                <SelectItem value="3m">3 Minutes</SelectItem>
                <SelectItem value="5m">5 Minutes</SelectItem>
                <SelectItem value="15m">15 Minutes</SelectItem>
                <SelectItem value="1h">1 Hour</SelectItem>
                <SelectItem value="24h">24 Hours</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Time period for monitoring the condition
            </p>
          </div>

          {/* Notification Channels */}
          <div className="space-y-3">
            <Label>Notification Channels</Label>
            <div className="space-y-3">
              <div className="flex items-center space-x-3 p-3 rounded-lg border">
                <Checkbox
                  id="email-notif"
                  checked={notificationChannels.includes('email')}
                  onCheckedChange={() => handleNotificationToggle('email')}
                />
                <Label htmlFor="email-notif" className="flex-1 cursor-pointer">
                  <span className="font-semibold">Email</span>
                  <p className="text-xs text-gray-500">Receive alerts via email</p>
                </Label>
              </div>

              <div className="flex items-center space-x-3 p-3 rounded-lg border">
                <Checkbox
                  id="telegram-notif"
                  checked={notificationChannels.includes('telegram')}
                  onCheckedChange={() => handleNotificationToggle('telegram')}
                  disabled={!telegramConnected}
                />
                <Label htmlFor="telegram-notif" className="flex-1 cursor-pointer">
                  <span className="font-semibold">Telegram</span>
                  <p className="text-xs text-gray-500">
                    {telegramConnected
                      ? 'Receive instant alerts via Telegram'
                      : 'Connect Telegram above to enable'}
                  </p>
                </Label>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Alert...
              </>
            ) : (
              <>
                <Bell className="h-4 w-4 mr-2" />
                Create Alert
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
