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
import { Loader2 } from 'lucide-react';
import { Alert } from '@/types/alerts';

interface EditAlertDialogProps {
  alert: Alert | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

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
      setAlertType(alert.alert_type || '');
      setConditionValue(alert.threshold?.toString() || '');
      setTimePeriod(alert.timeframe || '5m');
      
      // Handle notification channels
      if (Array.isArray(alert.notification_channels)) {
        setNotificationChannels(alert.notification_channels.join(','));
      } else {
        setNotificationChannels(alert.notification_channels || 'both');
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
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Edit Alert
          </DialogTitle>
          <DialogDescription className="text-base">
            Customize your alert settings. Changes apply immediately.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 py-4">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-800 px-4 py-3 rounded-r-lg flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Coin Symbol - Enhanced */}
            <div className="space-y-2">
              <Label htmlFor="symbol" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <span className="text-indigo-600">📊</span> Cryptocurrency
              </Label>
              <div className="relative">
                <Input
                  id="symbol"
                  placeholder="Enter symbol (e.g., BTCUSDT)"
                  value={coinSymbol}
                  onChange={(e) => setCoinSymbol(e.target.value.toUpperCase())}
                  required
                  className="pl-10 text-base font-medium border-2 focus:border-indigo-400"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                  $
                </span>
              </div>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <span className="text-blue-500">ℹ️</span>
                Must end with USDT (e.g., BTCUSDT, ETHUSDT, BNBUSDT)
              </p>
            </div>

            {/* Alert Type - Enhanced with visual cards */}
            <div className="space-y-2">
              <Label htmlFor="type" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <span className="text-indigo-600">🎯</span> Alert Type
              </Label>
              <Select value={alertType} onValueChange={setAlertType} required>
                <SelectTrigger className="border-2 text-base focus:border-indigo-400">
                  <SelectValue placeholder="Choose what to monitor" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-1">
                    <SelectItem value="pump_alert" className="cursor-pointer hover:bg-green-50">
                      <div className="flex items-center gap-2 py-1">
                        <span className="text-lg">📈</span>
                        <div>
                          <div className="font-semibold text-green-600">Pump Alert</div>
                          <div className="text-xs text-gray-500">Price increase threshold</div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="dump_alert" className="cursor-pointer hover:bg-red-50">
                      <div className="flex items-center gap-2 py-1">
                        <span className="text-lg">📉</span>
                        <div>
                          <div className="font-semibold text-red-600">Dump Alert</div>
                          <div className="text-xs text-gray-500">Price decrease threshold</div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="price_movement" className="cursor-pointer hover:bg-blue-50">
                      <div className="flex items-center gap-2 py-1">
                        <span className="text-lg">↕️</span>
                        <div>
                          <div className="font-semibold text-blue-600">Price Movement</div>
                          <div className="text-xs text-gray-500">Any direction change</div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="rsi_overbought" className="cursor-pointer hover:bg-orange-50">
                      <div className="flex items-center gap-2 py-1">
                        <span className="text-lg">🔴</span>
                        <div>
                          <div className="font-semibold text-orange-600">RSI Overbought</div>
                          <div className="text-xs text-gray-500">RSI above threshold (&gt;70)</div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="rsi_oversold" className="cursor-pointer hover:bg-purple-50">
                      <div className="flex items-center gap-2 py-1">
                        <span className="text-lg">🟣</span>
                        <div>
                          <div className="font-semibold text-purple-600">RSI Oversold</div>
                          <div className="text-xs text-gray-500">RSI below threshold (&lt;30)</div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="volume_change" className="cursor-pointer hover:bg-cyan-50">
                      <div className="flex items-center gap-2 py-1">
                        <span className="text-lg">📊</span>
                        <div>
                          <div className="font-semibold text-cyan-600">Volume Change</div>
                          <div className="text-xs text-gray-500">Trading volume spike</div>
                        </div>
                      </div>
                    </SelectItem>
                  </div>
                </SelectContent>
              </Select>
            </div>

            {/* Threshold/Condition - Enhanced with suggestions */}
            <div className="space-y-2">
              <Label htmlFor="threshold" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <span className="text-indigo-600">🎚️</span>
                {alertType?.includes('rsi') ? 'RSI Threshold' : 'Price Change %'}
              </Label>
              <div className="relative">
                <Input
                  id="threshold"
                  type="number"
                  step="0.01"
                  placeholder={alertType?.includes('rsi') ? 'e.g., 70 or 30' : 'e.g., 5 or -5'}
                  value={conditionValue}
                  onChange={(e) => setConditionValue(e.target.value)}
                  required
                  className="pr-12 text-base font-medium border-2 focus:border-indigo-400"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">
                  {alertType?.includes('rsi') ? '' : '%'}
                </span>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
                <p className="font-semibold text-blue-800 mb-1">💡 Suggested values:</p>
                {alertType?.includes('rsi') ? (
                  <p className="text-blue-700">
                    • Overbought: <strong>70-80</strong> (common: 70) | Oversold: <strong>20-30</strong> (common: 30)
                  </p>
                ) : alertType === 'pump_alert' ? (
                  <p className="text-blue-700">
                    • Conservative: <strong>5-10%</strong> | Moderate: <strong>3-5%</strong> | Aggressive: <strong>1-3%</strong>
                  </p>
                ) : alertType === 'dump_alert' ? (
                  <p className="text-blue-700">
                    • Conservative: <strong>-5 to -10%</strong> | Moderate: <strong>-3 to -5%</strong> | Aggressive: <strong>-1 to -3%</strong>
                  </p>
                ) : alertType === 'volume_change' ? (
                  <p className="text-blue-700">
                    • Normal spike: <strong>20-50%</strong> | Large spike: <strong>50-100%</strong> | Massive: <strong>&gt;100%</strong>
                  </p>
                ) : (
                  <p className="text-blue-700">
                    • Small moves: <strong>0.5-2%</strong> | Medium: <strong>2-5%</strong> | Large: <strong>&gt;5%</strong>
                  </p>
                )}
              </div>
            </div>

            {/* Time Period - Enhanced with icons */}
            <div className="space-y-2">
              <Label htmlFor="timeframe" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <span className="text-indigo-600">⏱️</span> Timeframe
              </Label>
              <Select value={timePeriod} onValueChange={setTimePeriod} required>
                <SelectTrigger className="border-2 text-base focus:border-indigo-400">
                  <SelectValue placeholder="Select monitoring period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1m" className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span>⚡</span> <strong>1 Minute</strong> - Ultra-fast alerts
                    </div>
                  </SelectItem>
                  <SelectItem value="5m" className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span>🚀</span> <strong>5 Minutes</strong> - Quick alerts
                    </div>
                  </SelectItem>
                  <SelectItem value="15m" className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span>📊</span> <strong>15 Minutes</strong> - Balanced (recommended)
                    </div>
                  </SelectItem>
                  <SelectItem value="1h" className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span>📈</span> <strong>1 Hour</strong> - Trend alerts
                    </div>
                  </SelectItem>
                  <SelectItem value="24h" className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span>📅</span> <strong>24 Hours</strong> - Daily overview
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notification Channels - Enhanced visual */}
            <div className="space-y-2">
              <Label htmlFor="notifications" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <span className="text-indigo-600">📬</span> Notification Method
              </Label>
              <Select
                value={notificationChannels}
                onValueChange={setNotificationChannels}
                required
              >
                <SelectTrigger className="border-2 text-base focus:border-indigo-400">
                  <SelectValue placeholder="How to receive alerts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email" className="cursor-pointer hover:bg-blue-50">
                    <div className="flex items-center gap-2 py-1">
                      <span className="text-lg">📧</span>
                      <div>
                        <div className="font-semibold">Email Only</div>
                        <div className="text-xs text-gray-500">Receive alerts via email</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="telegram" className="cursor-pointer hover:bg-blue-50">
                    <div className="flex items-center gap-2 py-1">
                      <span className="text-lg">📱</span>
                      <div>
                        <div className="font-semibold">Telegram Only</div>
                        <div className="text-xs text-gray-500">Instant mobile notifications</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="both" className="cursor-pointer hover:bg-green-50">
                    <div className="flex items-center gap-2 py-1">
                      <span className="text-lg">📧📱</span>
                      <div>
                        <div className="font-semibold text-green-600">Email + Telegram</div>
                        <div className="text-xs text-gray-500">Maximum reliability (recommended)</div>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="border-2"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Update Alert
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
