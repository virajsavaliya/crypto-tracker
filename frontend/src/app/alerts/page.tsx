'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Bell, Trash2, Award, Send } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { authenticatedFetch, requireAuth, logout } from '@/lib/auth';
import Header from '@/components/shared/Header';
import Link from 'next/link';
import TelegramConnection from '@/components/TelegramConnection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Combobox } from '@/components/ui/combobox';
import { getTelegramStatus } from '@/lib/telegram-api';
import AlertList from '@/components/alerts/AlertList';
import { Alert as AlertTypeFromTypes } from '@/types/alerts';
import { cn } from '@/lib/utils';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { useInactivityLogout } from '@/lib/useInactivityLogout';

const alertFormSchema = z.object({
  alert_type: z.enum(["price_movement", "volume_change", "new_coin_listing", "rsi_overbought", "rsi_oversold", "pump_alert", "dump_alert", "top_100"]),
  coin_symbol: z.string().optional(),
  condition_value: z.number().optional(),
  time_period: z.string().optional(),
  any_coin: z.boolean().default(false).optional(),
  notifications: z.array(z.string()).min(1, { message: 'At least one notification channel is required.' }),
});

interface Alert {
  id: number;
  alert_type: 'price_movement' | 'volume_change' | 'new_coin_listing' | 'rsi_overbought' | 'rsi_oversold' | 'pump_alert' | 'dump_alert' | 'top_100';
  coin_symbol: string | null;
  condition_value: number | null;
  time_period: string | null;
  any_coin: boolean;
  notification_channels: string | null;
  is_active: boolean;
  trigger_count?: number;
  created_at: string;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [transformedAlerts, setTransformedAlerts] = useState<AlertTypeFromTypes[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [coinSymbols, setCoinSymbols] = useState<string[]>([]);
  const [loadingSymbols, setLoadingSymbols] = useState(false);

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

  const alertForm = useForm<z.infer<typeof alertFormSchema>>({
    resolver: zodResolver(alertFormSchema),
    defaultValues: {
      alert_type: 'price_movement',
      coin_symbol: '',
      condition_value: 0,
      time_period: '5m',
      any_coin: false,
      notifications: ['email'],
    },
  });

  // Watch alert_type to conditionally show/hide coin symbol field
  const selectedAlertType = alertForm.watch('alert_type');

  const handleTelegramConnectionChange = (connected: boolean) => {
    setTelegramConnected(connected);
  };

  const fetchTelegramStatus = useCallback(async () => {
    try {
      const statusData = await getTelegramStatus();
      if (statusData) {
        setTelegramConnected(statusData.connected);
      }
    } catch (err) {
    }
  }, []);

  // Transform backend alert format to frontend Alert type
  const transformAlert = (backendAlert: Alert): AlertTypeFromTypes => {
    // Map backend alert_type to frontend AlertType
    let alertType: AlertTypeFromTypes['alert_type'] = 'custom';
    if (backendAlert.alert_type === 'price_movement') {
      alertType = 'price_target';
    } else if (backendAlert.alert_type === 'pump_alert') {
      alertType = 'pump';
    } else if (backendAlert.alert_type === 'dump_alert') {
      alertType = 'dump';
    } else if (['rsi_overbought', 'rsi_oversold'].includes(backendAlert.alert_type)) {
      alertType = backendAlert.alert_type as AlertTypeFromTypes['alert_type'];
    } else if (backendAlert.alert_type === 'volume_change') {
      alertType = 'volume_spike';
    } else if (backendAlert.alert_type === 'top_100') {
      alertType = 'top_100';
    } else if (backendAlert.alert_type === 'new_coin_listing') {
      alertType = 'new_coin_listing';
    }

    // Map notification_channels string to array
    let notificationChannels: AlertTypeFromTypes['notification_channels'] = ['email'];
    if (backendAlert.notification_channels === 'both') {
      notificationChannels = ['email', 'telegram'];
    } else if (backendAlert.notification_channels === 'telegram') {
      notificationChannels = ['telegram'];
    } else if (backendAlert.notification_channels === 'email') {
      notificationChannels = ['email'];
    }

    return {
      id: backendAlert.id,
      user: 0, // Not provided by backend
      symbol: backendAlert.coin_symbol || '',
      alert_type: alertType,
      threshold: backendAlert.condition_value || 0,
      timeframe: (backendAlert.time_period || '5m') as AlertTypeFromTypes['timeframe'],
      notification_channels: notificationChannels,
      is_active: backendAlert.is_active, // ✅ Use actual backend value
      trigger_count: backendAlert.trigger_count || 0,
      created_at: backendAlert.created_at,
    };
  };

  const fetchCoinSymbols = useCallback(async () => {
    try {
      setLoadingSymbols(true);
      const response = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/coin-symbols/`
      );

      if (!response) {
        // Auth failed, authenticatedFetch handles redirect
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch coin symbols.');
      }
      
      const data = await response.json();
      setCoinSymbols(data.symbols || []);
    } catch (err: unknown) {
      console.error('Error fetching coin symbols:', err);
    } finally {
      setLoadingSymbols(false);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/alerts/`
      );

      if (!response) {
        // Auth failed, authenticatedFetch handles redirect
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch alerts.');
      }
      
      const data: Alert[] = await response.json();
      setAlerts(data);
      // Transform alerts for AlertList component
      setTransformedAlerts(data.map(transformAlert));
      setError(null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCreateAlert = async (data: z.infer<typeof alertFormSchema>) => {
    try {
      // Remove 'notifications' from data and replace with 'notification_channels'
      const { notifications, ...alertData } = data;
      
      // Convert notifications array to the backend format
      let notificationChannels = 'email'; // default
      if (notifications.length === 2) {
        // Both email and telegram selected
        notificationChannels = 'both';
      } else if (notifications.length === 1) {
        // Only one channel selected
        notificationChannels = notifications[0];
      }
      
      // For top_100 alerts, set coin_symbol to 'TOP100'
      const finalCoinSymbol = data.alert_type === 'top_100' ? 'TOP100' : alertData.coin_symbol;
      
      const payload = {
        ...alertData,
        coin_symbol: finalCoinSymbol,
        notification_channels: notificationChannels,
      };


      const response = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/alerts/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response) {
        // Auth failed, authenticatedFetch handles redirect
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to create alert: ${JSON.stringify(errorData)}`);
      }

      await fetchAlerts(); // Refresh the list of alerts
      alertForm.reset();
    } catch (err: unknown) {
      console.error('Error creating alert:', err);
    }
  };

  const handleDeleteAlert = async (id: number) => {
    try {
      const response = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/alerts/${id}/`,
        {
          method: 'DELETE',
        }
      );

      if (!response) {
        // Auth failed, authenticatedFetch handles redirect
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to delete alert.');
      }

      await fetchAlerts(); // Refresh the list of alerts
    } catch (err: unknown) {
      console.error('Error deleting alert:', err);
    }
  };

  useEffect(() => {
    // Check authentication
    const user = requireAuth();
    if (!user) {
      // requireAuth will handle redirect
      return;
    }
    
    // Validate user session by making a test API call before proceeding
    const validateAndFetchData = async () => {
      try {
        // Make a simple API call to validate the token
        const validationResponse = await authenticatedFetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/user/`
        );
        
        if (!validationResponse) {
          // Auth failed, authenticatedFetch handles redirect
          return;
        }
        
        if (!validationResponse.ok) {
          console.error('Token validation failed');
          setLoading(false);
          return;
        }
        
        // Token is valid, proceed with fetching data
        const userData = await validationResponse.json();
        
        // Debug: Log user data to see what fields are available
        console.log('User data:', userData);
        console.log('subscription_plan:', userData.subscription_plan);
        console.log('is_premium_user:', userData.is_premium_user);
        
        // Check if user has Basic or Enterprise plan (both should have access to alerts)
        const subscription_plan = userData.subscription_plan || 'free';
        const is_premium = subscription_plan === 'basic' || 
                           subscription_plan === 'enterprise' || 
                           userData.is_premium_user === true;
        
        console.log('Final isPremium value:', is_premium);
        setIsPremium(is_premium);
        
        // Now fetch all data in parallel
        await Promise.all([
          fetchAlerts(),
          fetchCoinSymbols(),
          fetchTelegramStatus()
        ]);
      } catch (err) {
        console.error('Error during initial data fetch:', err);
        setLoading(false);
      }
    };
    
    validateAndFetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array to only run once on mount
  
  // Handle Telegram connection status changes
  useEffect(() => {
    const currentNotifications = alertForm.getValues('notifications') || [];
    
    if (!telegramConnected && currentNotifications.includes('telegram')) {
      // Remove telegram if disconnected
      const updatedNotifications = currentNotifications.filter((n: string) => n !== 'telegram');
      alertForm.setValue('notifications', updatedNotifications.length > 0 ? updatedNotifications : ['email']);
    }
  }, [telegramConnected, alertForm]);
  
  const getAlertConditionText = (alert: Alert) => {
    let conditionText = '';
    const symbol = alert.coin_symbol || 'Any Coin';
    const value = alert.condition_value;
    const period = alert.time_period;

    switch (alert.alert_type) {
      case 'price_movement':
        conditionText = `${symbol} changes by ${value}% in ${period}`;
        break;
      case 'volume_change':
        conditionText = `${symbol} volume changes by ${value}% in ${period}`;
        break;
      case 'new_coin_listing':
        conditionText = 'New coin listing';
        break;
      case 'rsi_overbought':
        conditionText = `${symbol} RSI overbought (>${value}) in ${period}`;
        break;
      case 'rsi_oversold':
        conditionText = `${symbol} RSI oversold (<${value}) in ${period}`;
        break;
      case 'pump_alert':
        conditionText = `${symbol} pump alert (>${value}% in ${period})`;
        break;
      case 'dump_alert':
        conditionText = `${symbol} dump alert (<-${value}% in ${period})`;
        break;
      default:
        conditionText = 'N/A';
    }
    return conditionText;
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <LoadingSpinner message="Loading alerts..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="mb-6 lg:mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Manage Alerts</h1>
          <p className="text-gray-600">Get notified about market changes</p>
        </div>
        
        <Tabs defaultValue="alerts" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="alerts" className="text-xs sm:text-sm md:text-base">
              <Bell className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">My Alerts</span>
              <span className="sm:hidden">Alerts</span>
              {alerts.length > 0 && (
                <span className="ml-1 sm:ml-2 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                  {alerts.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="telegram" className="text-xs sm:text-sm md:text-base">
              <Send className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Telegram Setup</span>
              <span className="sm:hidden">Telegram</span>
              {telegramConnected && (
                <span className="ml-1 sm:ml-2 h-2 w-2 bg-green-500 rounded-full"></span>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="alerts" className="space-y-4 sm:space-y-6 md:space-y-8">
            <Card className="shadow-md">
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl md:text-2xl">
                  <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                  <span>Create New Alert</span>
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm mt-2">
                  Set up custom alerts for price, volume, RSI, or market movements. Get instant notifications via email or Telegram.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {isPremium ? (
                  <Form {...alertForm}>
                    <form onSubmit={alertForm.handleSubmit(handleCreateAlert)} className="space-y-4 sm:space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                        <FormField
                          control={alertForm.control}
                          name="alert_type"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel className="text-sm sm:text-base">Alert Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="text-sm">
                                    <SelectValue placeholder="Select alert type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="price_movement">Price Movement</SelectItem>
                                  <SelectItem value="volume_change">Volume Change</SelectItem>
                                  <SelectItem value="new_coin_listing">New Coin Listing</SelectItem>
                                  <SelectItem value="rsi_overbought">RSI Overbought (&gt;70)</SelectItem>
                                  <SelectItem value="rsi_oversold">RSI Oversold (&lt;30)</SelectItem>
                                  <SelectItem value="pump_alert">Pump Alert (&gt;5% in 1m)</SelectItem>
                                  <SelectItem value="dump_alert">Dump Alert (&lt;-5% in 1m)</SelectItem>
                                  <SelectItem value="top_100">🏆 Top 100 Coins Alert</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        {/* Conditionally show Coin Symbol field - hide for top_100 */}
                        {selectedAlertType !== 'top_100' && (
                          <FormField
                            control={alertForm.control}
                            name="coin_symbol"
                            render={({ field }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel className="text-sm sm:text-base">Coin Symbol</FormLabel>
                                <FormControl>
                                  <Combobox
                                    options={coinSymbols}
                                    value={field.value || ''}
                                    onValueChange={field.onChange}
                                    placeholder={loadingSymbols ? "Loading..." : "Select coin"}
                                    searchPlaceholder="Search symbols..."
                                    emptyText="No symbols found."
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {/* Show info message for top_100 */}
                        {selectedAlertType === 'top_100' && (
                          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-start gap-3">
                              <span className="text-2xl">🏆</span>
                              <div>
                                <h4 className="font-semibold text-yellow-900 mb-1">Monitoring Top 100 Coins</h4>
                                <p className="text-sm text-yellow-800">
                                  This alert will monitor all top 100 coins by market cap. You'll receive a notification 
                                  whenever any of these coins meets your threshold criteria in the selected timeframe.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                        <FormField
                          control={alertForm.control}
                          name="condition_value"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel className="text-sm sm:text-base">Threshold Value (%)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  placeholder="e.g., 5" 
                                  className="text-sm"
                                  {...field} 
                                  value={field.value ?? ''}
                                  onChange={e => {
                                      const value = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                      field.onChange(value);
                                  }} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={alertForm.control}
                          name="time_period"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel className="text-sm sm:text-base">Time Period</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="text-sm">
                                    <SelectValue placeholder="Select time period" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="1m">1 minute</SelectItem>
                                  <SelectItem value="5m">5 minutes</SelectItem>
                                  <SelectItem value="15m">15 minutes</SelectItem>
                                  <SelectItem value="1h">1 hour</SelectItem>
                                  <SelectItem value="24h">24 hours</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={alertForm.control}
                        name="notifications"
                        render={() => (
                          <FormItem>
                            <FormLabel className="text-sm sm:text-base">Notification Channels</FormLabel>
                            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-2">
                              {["email", "telegram"].map((item) => (
                                <FormField
                                  key={item}
                                  control={alertForm.control}
                                  name="notifications"
                                  render={({ field }) => {
                                    const isDisabled = item === 'telegram' && !telegramConnected;
                                    return (
                                      <FormItem key={item} className="flex flex-row items-center space-x-3 space-y-0 flex-1 p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors">
                                        <FormControl>
                                          <Checkbox
                                            id={`notification-${item}`}
                                            checked={field.value?.includes(item)}
                                            disabled={isDisabled}
                                            onCheckedChange={(checked: boolean) => {
                                              return checked
                                                ? field.onChange([...(field.value || []), item])
                                                : field.onChange(
                                                    (field.value || []).filter(
                                                      (value: string) => value !== item
                                                    )
                                                  )
                                            }}
                                          />
                                        </FormControl>
                                        <label 
                                          htmlFor={`notification-${item}`}
                                          className={`text-sm font-medium capitalize cursor-pointer flex items-center gap-2 ${isDisabled ? 'text-gray-400' : 'text-gray-900'}`}
                                        >
                                          {item === 'telegram' && <Send className="h-4 w-4" />}
                                          <span>{item}</span>
                                          {isDisabled && (
                                            <span className="text-xs text-red-500 font-normal">(Connect first)</span>
                                          )}
                                        </label>
                                      </FormItem>
                                    )
                                  }}
                                />
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-5 sm:py-6 text-sm sm:text-base">
                        <Bell className="h-4 w-4 mr-2" />
                        Create Alert
                      </Button>
                    </form>
                  </Form>
                ) : (
                  <div className="text-center p-6 sm:p-8 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl border-2 border-yellow-200">
                      <div className="bg-yellow-100 w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Award className="h-8 w-8 sm:h-10 sm:w-10 text-yellow-600" />
                      </div>
                      <p className="text-lg sm:text-xl font-bold text-yellow-900 mb-2">
                          Premium Feature
                      </p>
                      <p className="text-sm sm:text-base text-yellow-700 mb-4">
                          Unlock alerts to monitor price, volume, and RSI changes in real-time.
                      </p>
                      <Link href="/upgrade-plan">
                        <Button className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-5 sm:py-6 px-6 sm:px-8 rounded-xl shadow-lg text-sm sm:text-base">
                          Upgrade Now →
                        </Button>
                      </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Use the new AlertList component with edit functionality */}
            <AlertList 
              alerts={transformedAlerts} 
              loading={loading} 
              onRefresh={fetchAlerts}
            />
          </TabsContent>
          
          <TabsContent value="telegram" className="space-y-8">
            <TelegramConnection onConnectionChange={handleTelegramConnectionChange} />
            
            <Card>
              <CardHeader>
                <CardTitle>About Telegram Alerts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">How it works:</h4>
                  <ol className="space-y-2 text-sm text-blue-800 list-decimal list-inside">
                    <li>Connect your Telegram account using the QR code or link above</li>
                    <li>Choose Telegram as a notification channel when creating alerts</li>
                    <li>Receive instant notifications directly in your Telegram chat</li>
                    <li>Use bot commands to manage your alerts on the go</li>
                  </ol>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Bot Commands:</h4>
                  <ul className="space-y-1 text-sm text-gray-700">
                    <li><code className="bg-gray-200 px-2 py-0.5 rounded">/status</code> - Check your alert settings</li>
                    <li><code className="bg-gray-200 px-2 py-0.5 rounded">/help</code> - Get help and support</li>
                    <li><code className="bg-gray-200 px-2 py-0.5 rounded">/stop</code> - Temporarily disable alerts</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}