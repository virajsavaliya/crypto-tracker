'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Bell, Trash2, Loader2, Award } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import Header from '@/components/shared/Header';
import Link from 'next/link';

const alertFormSchema = z.object({
  alert_type: z.enum(["price_movement", "volume_change", "new_coin_listing"]),
  coin_symbol: z.string().optional(),
  condition_value: z.number().optional(),
  time_period: z.string().optional(),
  any_coin: z.boolean().default(false).optional(),
  notifications: z.array(z.string()).min(1, { message: 'At least one notification channel is required.' }),
});

interface Alert {
  id: number;
  alert_type: 'price_movement' | 'volume_change' | 'new_coin_listing';
  coin_symbol: string | null;
  condition_value: number | null;
  time_period: string | null;
  any_coin: boolean;
  notification_channels: string | null;
  created_at: string;
}

export default function AlertsPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);

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

  const refreshAndRetry = useCallback(async (originalRequest: (token?: string, isRetry?: boolean) => void) => {
    const localUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (!localUser.refresh_token) {
      console.error('No refresh token found. Redirecting to login.');
      router.push('/');
      return;
    }
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/token/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh: localUser.refresh_token }),
      });
      if (response.ok) {
        const data = await response.json();
        const updatedUser = { ...localUser, access_token: data.access };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        await originalRequest(updatedUser.access_token, true);
      } else {
        console.error('Failed to refresh token. Redirecting to login.');
        router.push('/');
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      router.push('/');
    }
  }, [router]);

  const fetchAlerts = useCallback(async (token?: string, isRetry = false) => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const authToken = token || user.access_token;
    if (!authToken) {
      router.push('/');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/alerts/`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401 && !isRetry) {
          await refreshAndRetry(fetchAlerts);
        } else {
          throw new Error('Failed to fetch alerts.');
        }
      } else {
        const data: Alert[] = await response.json();
        setAlerts(data);
        setError(null);
      }
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
  }, [router, refreshAndRetry]);

  const handleCreateAlert = async (data: z.infer<typeof alertFormSchema>) => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const authToken = user.access_token;
    if (!authToken) {
      router.push('/');
      return;
    }

    try {
      const payload = {
        ...data,
        notification_channels: data.notifications.join(','),
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/alerts/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to create alert.');
      }

      await fetchAlerts(); // Refresh the list of alerts
      alertForm.reset();
    } catch (err: unknown) {
      console.error('Create alert failed:', err);
    }
  };

  const handleDeleteAlert = async (id: number) => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const authToken = user.access_token;
    if (!authToken) {
      router.push('/');
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/alerts/${id}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete alert.');
      }

      await fetchAlerts(); // Refresh the list of alerts
    } catch (err: unknown) {
      console.error('Delete alert failed:', err);
    }
  };

  useEffect(() => {
    const is_premium = localStorage.getItem('is_premium_user') === 'true';
    setIsPremium(is_premium);
    fetchAlerts();
  }, [fetchAlerts]);
  
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
      default:
        conditionText = 'N/A';
    }
    return conditionText;
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 p-6">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen p-6 bg-gray-100">
      <Header />
      <div className="w-full max-w-4xl space-y-8 mx-auto">
        <div className="flex items-center justify-between pb-4 border-b border-gray-200">
          <h1 className="text-4xl font-bold text-gray-900">Manage Alerts</h1>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bell className="h-6 w-6" />
              <span>Create New Alert</span>
            </CardTitle>
            <CardDescription>
              Set up custom alerts for price, volume, or new listings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isPremium ? (
              <Form {...alertForm}>
                <form onSubmit={alertForm.handleSubmit(handleCreateAlert)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={alertForm.control}
                      name="alert_type"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Alert Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select alert type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="price_movement">Price Movement</SelectItem>
                              <SelectItem value="volume_change">Volume Change</SelectItem>
                              <SelectItem value="new_coin_listing">New Coin Listing</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={alertForm.control}
                      name="coin_symbol"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Coin Symbol</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., BTC/USDT" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={alertForm.control}
                      name="condition_value"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Condition Value</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="e.g., 5" 
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
                          <FormLabel>Time Period</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
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
                    name="any_coin"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Apply to &quot;Any Coin&quot;
                          </FormLabel>
                          <FormDescription>
                            This alert will be triggered for any cryptocurrency.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={alertForm.control}
                    name="notifications"
                    render={() => (
                      <FormItem>
                        <FormLabel>Notification Channels</FormLabel>
                        <div className="flex space-x-4 mt-2">
                          {["email"].map((item) => (
                            <FormField
                              key={item}
                              control={alertForm.control}
                              name="notifications"
                              render={({ field }) => {
                                return (
                                  <FormItem key={item} className="flex flex-row items-start space-x-3 space-y-0">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(item)}
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
                                    <FormLabel className="font-normal capitalize">
                                      {item}
                                    </FormLabel>
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

                  <Button type="submit" className="w-full">Create Alert</Button>
                </form>
              </Form>
            ) : (
              <div className="text-center p-6 bg-yellow-50 rounded-xl border border-yellow-200">
                  <Award className="h-10 w-10 text-yellow-500 mx-auto" />
                  <p className="mt-4 text-lg font-semibold text-yellow-800">
                      Upgrade to a premium plan to create alerts.
                  </p>
                  <p className="mt-2 text-sm text-yellow-600">
                      Alerts are a premium feature, unlock them by upgrading your account.
                  </p>
                  <Link href="/upgrade-plan" className="mt-4 inline-block">
                    <Button className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl">
                      Upgrade Plan
                    </Button>
                  </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My Active Alerts</CardTitle>
            {error && <p className="text-red-500">{error}</p>}
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {alerts.length > 0 ? (
                alerts.map(alert => (
                  <li key={alert.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold">{getAlertConditionText(alert)}</p>
                      <p className="text-sm text-gray-500">Notifications: {alert.notification_channels}</p>
                    </div>
                    <Button variant="destructive" size="icon" onClick={() => handleDeleteAlert(alert.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))
              ) : (
                <p className="text-center text-gray-500">You have no active alerts.</p>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}