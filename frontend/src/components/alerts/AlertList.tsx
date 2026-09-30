'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, TrendingUp, TrendingDown, Bell, Loader2, Settings } from 'lucide-react';
import { Alert, AlertType } from '@/types/alerts';
import { Alert as AlertUI, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import EditAlertDialog from './EditAlertDialog';

interface AlertListProps {
  alerts: Alert[];
  loading: boolean;
  onRefresh: () => void;
}

export default function AlertList({ alerts, loading, onRefresh }: AlertListProps) {
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const handleDeleteAlert = async (alertId: number) => {
    if (!confirm('Are you sure you want to delete this alert?')) {
      return;
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const authToken = user.access_token;

    if (!authToken) {
      setError('Not authenticated');
      return;
    }

    try {
      setDeleteLoading(alertId);
      setError(null);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/alert/${alertId}/delete/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete alert');
      }

      const data = await response.json();
      
      if (data.success) {
        onRefresh();
      } else {
        throw new Error(data.error || 'Failed to delete alert');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete alert');
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleEditAlert = (alert: Alert) => {
    setEditingAlert(alert);
    setEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    onRefresh();
    setError(null);
  };

  const getAlertTypeInfo = (type: AlertType) => {
    switch (type) {
      case 'pump':
        return {
          icon: <TrendingUp className="h-5 w-5" />,
          label: 'Pump Alert',
          color: 'bg-green-100 text-green-800 border-green-200',
        };
      case 'dump':
        return {
          icon: <TrendingDown className="h-5 w-5" />,
          label: 'Dump Alert',
          color: 'bg-red-100 text-red-800 border-red-200',
        };
      case 'price_target':
        return {
          icon: <Bell className="h-5 w-5" />,
          label: 'Price Target',
          color: 'bg-blue-100 text-blue-800 border-blue-200',
        };
      case 'rsi_overbought':
        return {
          icon: <Bell className="h-5 w-5" />,
          label: 'RSI Overbought',
          color: 'bg-orange-100 text-orange-800 border-orange-200',
        };
      case 'rsi_oversold':
        return {
          icon: <Bell className="h-5 w-5" />,
          label: 'RSI Oversold',
          color: 'bg-purple-100 text-purple-800 border-purple-200',
        };
      case 'volume_spike':
        return {
          icon: <Bell className="h-5 w-5" />,
          label: 'Volume Spike',
          color: 'bg-cyan-100 text-cyan-800 border-cyan-200',
        };
      case 'top_100':
        return {
          icon: <TrendingUp className="h-5 w-5" />,
          label: 'Top 100 Coins',
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        };
      case 'new_coin_listing':
        return {
          icon: <Bell className="h-5 w-5" />,
          label: 'New Coin Listing',
          color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        };
      default:
        return {
          icon: <Bell className="h-5 w-5" />,
          label: 'Custom Alert',
          color: 'bg-gray-100 text-gray-800 border-gray-200',
        };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-gray-200 rounded-xl shadow-sm">
      <CardHeader className="border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-gray-900">
            My Alerts
          </CardTitle>
          <Badge className="text-sm font-semibold bg-gray-900 text-white px-3 py-1">
            {alerts.length} {alerts.length === 1 ? 'Alert' : 'Alerts'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {error && (
          <AlertUI variant="destructive" className="mb-4 border-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </AlertUI>
        )}

        {alerts.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <Bell className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-700 mb-2">No alerts configured</p>
            <p className="text-sm text-gray-500">Create your first alert above to start monitoring</p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => {
              const typeInfo = getAlertTypeInfo(alert.alert_type);
              const isDeleting = deleteLoading === alert.id;

              return (
                <div
                  key={alert.id}
                  className={`p-5 rounded-xl border transition-all ${
                    alert.is_active
                      ? 'border-gray-300 bg-white shadow-sm'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-4">
                      {/* Alert Header */}
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-lg border ${typeInfo.color}`}>
                          {typeInfo.icon}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-gray-900">
                            {alert.symbol}
                          </h3>
                          <p className="text-sm font-medium text-gray-600">
                            {typeInfo.label}
                          </p>
                        </div>
                        <Badge 
                          className={`px-3 py-1 font-semibold ${
                            alert.is_active 
                              ? 'bg-green-100 text-green-800 border border-green-300' 
                              : 'bg-gray-200 text-gray-700 border border-gray-400'
                          }`}
                        >
                          {alert.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>

                      {/* Alert Details */}
                      <div className="grid grid-cols-3 gap-4 pt-3 border-t border-gray-200">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Threshold</p>
                          <p className="font-bold text-gray-900">
                            {alert.threshold}
                            {alert.alert_type.includes('rsi') ? '' : '%'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Timeframe</p>
                          <p className="font-bold text-gray-900">
                            {alert.timeframe || '15m'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Notifications</p>
                          <p className="font-bold text-gray-900 capitalize">
                            {Array.isArray(alert.notification_channels) 
                              ? alert.notification_channels.join(', ')
                              : alert.notification_channels}
                          </p>
                        </div>
                      </div>

                      {/* Last Triggered */}
                      {alert.last_triggered && (
                        <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
                          Last triggered: {formatDate(alert.last_triggered)}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e: React.MouseEvent) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleEditAlert(alert);
                        }}
                        title="Edit alert"
                        className="h-9 w-9 p-0 border border-gray-200 rounded-xl shadow-sm hover:bg-gray-900 hover:text-white transition-colors"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e: React.MouseEvent) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteAlert(alert.id);
                        }}
                        disabled={isDeleting}
                        title="Delete alert"
                        className="h-9 w-9 p-0 border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-colors"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Edit Alert Dialog */}
        <EditAlertDialog
          alert={editingAlert}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={handleEditSuccess}
        />
      </CardContent>
    </Card>
  );
}
