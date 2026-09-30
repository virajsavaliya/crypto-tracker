'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert } from '@/types/alerts';

interface EditAlertDialogProps {
  alert: Alert | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// Map frontend alert types to backend types
const mapAlertTypeToBackend = (frontendType: string): string => {
  const mapping: Record<string, string> = {
    'price_target': 'price_movement',
    'pump': 'pump_alert',
    'dump': 'dump_alert',
    'volume_spike': 'volume_change',
    'rsi_overbought': 'rsi_overbought',
    'rsi_oversold': 'rsi_oversold',
    'custom': 'price_movement',
  };
  return mapping[frontendType] || frontendType;
};

// Map backend alert types to frontend display types
const mapAlertTypeFromBackend = (backendType: string): string => {
  const mapping: Record<string, string> = {
    'price_movement': 'price_movement',
    'pump_alert': 'pump_alert',
    'dump_alert': 'dump_alert',
    'volume_change': 'volume_change',
    'rsi_overbought': 'rsi_overbought',
    'rsi_oversold': 'rsi_oversold',
  };
  return mapping[backendType] || backendType;
};

export default function EditAlertDialog({
  alert,
  open,
  onOpenChange,
  onSuccess,
}: EditAlertDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [coinSymbol, setCoinSymbol] = useState('');
  const [alertType, setAlertType] = useState('');
  const [conditionValue, setConditionValue] = useState('');
  const [timePeriod, setTimePeriod] = useState('');
  const [notificationChannels, setNotificationChannels] = useState('');

  // Update form when alert changes
  useEffect(() => {
    if (alert) {
      setCoinSymbol(alert.symbol || '');
      
      // Map the alert type properly
      const backendType = mapAlertTypeToBackend(alert.alert_type);
      setAlertType(backendType);
      
      setConditionValue(alert.threshold?.toString() || '');
      setTimePeriod(alert.timeframe || '5m');
      
      // Handle notification channels properly
      if (Array.isArray(alert.notification_channels)) {
        if (alert.notification_channels.length === 2) {
          setNotificationChannels('both');
        } else if (alert.notification_channels.includes('telegram')) {
          setNotificationChannels('telegram');
        } else {
          setNotificationChannels('email');
        }
      } else {
        setNotificationChannels(alert.notification_channels || 'email');
      }
    }
  }, [alert]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alert) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const authToken = user.access_token;

    if (!authToken) {
      setError('Not authenticated');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const updateData = {
        coin_symbol: coinSymbol.toUpperCase(),
        alert_type: alertType,
        condition_value: parseFloat(conditionValue),
        time_period: timePeriod,
        notification_channels: notificationChannels,
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/alert/${alert.id}/update/`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update alert');
      }

      const data = await response.json();

      if (data.success) {
        onSuccess();
        onOpenChange(false);
      } else {
        throw new Error(data.error || 'Failed to update alert');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update alert');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg">
        <DialogHeader className="border-b border-gray-100 pb-4">
          <DialogTitle className="text-2xl font-bold text-gray-900">
            Edit Alert
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600 mt-2">
            Modify your alert configuration. All changes take effect immediately.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-6">
          <div className="space-y-6">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-600 p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">Error</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            )}

            {/* Coin Symbol */}
            <div className="space-y-2">
              <Label htmlFor="symbol" className="text-sm font-semibold text-gray-900">
                Cryptocurrency Symbol
              </Label>
              <Input
                id="symbol"
                placeholder="BTCUSDT"
                value={coinSymbol}
                onChange={(e) => setCoinSymbol(e.target.value.toUpperCase())}
                required
                className="h-11 border-gray-200 focus:border-gray-400 focus:ring-gray-400 rounded-lg font-mono"
              />
              <p className="text-xs text-gray-500">
                Enter the trading pair symbol (e.g., BTCUSDT, ETHUSDT)
              </p>
            </div>

            {/* Alert Type */}
            <div className="space-y-2">
              <Label htmlFor="type" className="text-sm font-semibold text-gray-900">
                Alert Type
              </Label>
              <Select value={alertType} onValueChange={setAlertType} required>
                <SelectTrigger className="h-11 border-gray-200 focus:border-gray-400 focus:ring-gray-400 rounded-lg">
                  <SelectValue placeholder="Select alert type" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 rounded-xl">
                  <SelectItem value="pump_alert" className="cursor-pointer focus:bg-gray-100">
                    <span className="font-medium">Pump Alert</span>
                  </SelectItem>
                  <SelectItem value="dump_alert" className="cursor-pointer focus:bg-gray-100">
                    <span className="font-medium">Dump Alert</span>
                  </SelectItem>
                  <SelectItem value="price_movement" className="cursor-pointer focus:bg-gray-100">
                    <span className="font-medium">Price Movement</span>
                  </SelectItem>
                  <SelectItem value="rsi_overbought" className="cursor-pointer focus:bg-gray-100">
                    <span className="font-medium">RSI Overbought</span>
                  </SelectItem>
                  <SelectItem value="rsi_oversold" className="cursor-pointer focus:bg-gray-100">
                    <span className="font-medium">RSI Oversold</span>
                  </SelectItem>
                  <SelectItem value="volume_change" className="cursor-pointer focus:bg-gray-100">
                    <span className="font-medium">Volume Change</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Threshold/Condition */}
            <div className="space-y-2">
              <Label htmlFor="threshold" className="text-sm font-semibold text-gray-900">
                {alertType?.includes('rsi') ? 'RSI Threshold Value' : 'Price Change Percentage'}
              </Label>
              <div className="relative">
                <Input
                  id="threshold"
                  type="number"
                  step="0.01"
                  placeholder={alertType?.includes('rsi') ? '70' : '5.0'}
                  value={conditionValue}
                  onChange={(e) => setConditionValue(e.target.value)}
                  required
                  className="h-11 pr-10 border-gray-200 focus:border-gray-400 focus:ring-gray-400 rounded-lg font-mono"
                />
                {!alertType?.includes('rsi') && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                    %
                  </span>
                )}
              </div>
            </div>

            {/* Time Period */}
            <div className="space-y-2">
              <Label htmlFor="timeframe" className="text-sm font-semibold text-gray-900">
                Timeframe
              </Label>
              <Select value={timePeriod} onValueChange={setTimePeriod} required>
                <SelectTrigger className="h-11 border-gray-200 focus:border-gray-400 focus:ring-gray-400 rounded-lg">
                  <SelectValue placeholder="Select timeframe" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 rounded-xl">
                  <SelectItem value="1m" className="cursor-pointer focus:bg-gray-100">
                    <span className="font-medium">1 Minute</span>
                  </SelectItem>
                  <SelectItem value="5m" className="cursor-pointer focus:bg-gray-100">
                    <span className="font-medium">5 Minutes</span>
                  </SelectItem>
                  <SelectItem value="15m" className="cursor-pointer focus:bg-gray-100">
                    <span className="font-medium">15 Minutes</span>
                  </SelectItem>
                  <SelectItem value="1h" className="cursor-pointer focus:bg-gray-100">
                    <span className="font-medium">1 Hour</span>
                  </SelectItem>
                  <SelectItem value="24h" className="cursor-pointer focus:bg-gray-100">
                    <span className="font-medium">24 Hours</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notification Channels */}
            <div className="space-y-2">
              <Label htmlFor="notifications" className="text-sm font-semibold text-gray-900">
                Notification Method
              </Label>
              <Select
                value={notificationChannels}
                onValueChange={setNotificationChannels}
                required
              >
                <SelectTrigger className="h-11 border-gray-200 focus:border-gray-400 focus:ring-gray-400 rounded-lg">
                  <SelectValue placeholder="Select notification method" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 rounded-xl">
                  <SelectItem value="email" className="cursor-pointer focus:bg-gray-100">
                    <span className="font-medium">Email</span>
                  </SelectItem>
                  <SelectItem value="telegram" className="cursor-pointer focus:bg-gray-100">
                    <span className="font-medium">Telegram</span>
                  </SelectItem>
                  <SelectItem value="both" className="cursor-pointer focus:bg-gray-100">
                    <span className="font-medium">Email and Telegram</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="mt-8 gap-3 border-t border-gray-200 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1 sm:flex-none h-11 border border-gray-200 rounded-lg hover:bg-gray-100 font-semibold"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="flex-1 sm:flex-none h-11 bg-gray-900 hover:bg-gray-800 text-white font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Alert'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
