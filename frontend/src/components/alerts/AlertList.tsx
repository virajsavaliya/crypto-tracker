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
          color: 'bg-green-100 text-green-800',
        };
      case 'dump':
        return {
          icon: <TrendingDown className="h-5 w-5" />,
          label: 'Dump Alert',
          color: 'bg-red-100 text-red-800',
        };
      case 'price_target':
        return {
          icon: <Bell className="h-5 w-5" />,
          label: 'Price Target',
          color: 'bg-blue-100 text-blue-800',
        };
      case 'rsi_overbought':
        return {
          icon: <Bell className="h-5 w-5" />,
          label: 'RSI Overbought',
          color: 'bg-orange-100 text-orange-800',
        };
      case 'rsi_oversold':
        return {
          icon: <Bell className="h-5 w-5" />,
          label: 'RSI Oversold',
          color: 'bg-purple-100 text-purple-800',
        };
      default:
        return {
          icon: <Bell className="h-5 w-5" />,
          label: 'Custom',
          color: 'bg-gray-100 text-gray-800',
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold">
            My Alerts
          </CardTitle>
          <Badge variant="secondary" className="text-sm">
            {alerts.length} {alerts.length === 1 ? 'Alert' : 'Alerts'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <AlertUI variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </AlertUI>
        )}

        {alerts.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No alerts created yet</p>
            <p className="text-sm text-gray-400">Create your first alert above to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => {
              const typeInfo = getAlertTypeInfo(alert.alert_type);
              const isDeleting = deleteLoading === alert.id;

              return (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    alert.is_active
                      ? 'border-indigo-200 bg-indigo-50/50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-3">
                      {/* Alert Header */}
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${typeInfo.color}`}>
                          {typeInfo.icon}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">
                            {alert.symbol}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {typeInfo.label}
                          </p>
                        </div>
                        <Badge className={typeInfo.color}>
                          {alert.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>

                      {/* Alert Details */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-gray-500">Threshold</p>
                          <p className="font-semibold text-gray-900">
                            {alert.threshold}
                            {alert.alert_type.includes('rsi') ? '' : '%'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Timeframe</p>
                          <p className="font-semibold text-gray-900">
                            {alert.timeframe || '15m'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Notifications</p>
                          <p className="font-semibold text-gray-900 capitalize">
                            {Array.isArray(alert.notification_channels) 
                              ? alert.notification_channels.join(', ')
                              : alert.notification_channels}
                          </p>
                        </div>
                      </div>

                      {/* Last Triggered */}
                      {alert.last_triggered && (
                        <div className="text-xs text-gray-500">
                          Last triggered: {formatDate(alert.last_triggered)}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleEditAlert(alert);
                        }}
                        title="Edit alert"
                        className="h-9 w-9 p-0 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteAlert(alert.id);
                        }}
                        disabled={isDeleting}
                        title="Delete alert"
                        className="h-9 w-9 p-0 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors"
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
