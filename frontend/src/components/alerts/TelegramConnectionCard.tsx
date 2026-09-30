'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, CheckCircle, X, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TelegramConnectionCardProps {
  onConnectionChange?: (connected: boolean) => void;
}

interface TelegramStatus {
  connected: boolean;
  chat_id?: string;
  username?: string;
  bot_username?: string;
}

export default function TelegramConnectionCard({ onConnectionChange }: TelegramConnectionCardProps) {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch Telegram connection status
  const fetchTelegramStatus = useCallback(async () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const authToken = user.access_token;

    if (!authToken) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/telegram/status/`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch Telegram status');
      }

      const data: TelegramStatus = await response.json();
      setStatus(data);
      setError(null);
      
      if (onConnectionChange) {
        onConnectionChange(data.connected);
      }
    } catch (err) {
      setError('Failed to load Telegram status');
    } finally {
      setLoading(false);
    }
  }, [onConnectionChange]);

  // Generate setup token and open Telegram bot
  const handleConnectTelegram = async () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const authToken = user.access_token;

    if (!authToken) {
      setError('Not authenticated');
      return;
    }

    try {
      setSetupLoading(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/telegram/setup-token/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate setup token');
      }

      const data = await response.json();
      
      if (data.success && data.bot_link) {
        // Open Telegram bot in new tab
        window.open(data.bot_link, '_blank');
        
        setSuccessMessage('Telegram bot opened! Click "Start" in Telegram to connect your account.');
        
        // Poll for connection status
        setTimeout(() => {
          fetchTelegramStatus();
        }, 3000);
        
        // Poll again after 10 seconds
        setTimeout(() => {
          fetchTelegramStatus();
        }, 10000);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      setError('Failed to connect Telegram. Please try again.');
    } finally {
      setSetupLoading(false);
    }
  };

  // Send test alert
  const handleTestAlert = async () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const authToken = user.access_token;

    if (!authToken) {
      setError('Not authenticated');
      return;
    }

    try {
      setTestLoading(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/telegram/test-alert/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to send test alert');
      }

      const data = await response.json();
      
      if (data.success) {
        setSuccessMessage('Test alert sent successfully! Check your Telegram.');
      } else {
        throw new Error(data.error || 'Failed to send test alert');
      }
    } catch (err) {
      setError('Failed to send test alert. Please try again.');
    } finally {
      setTestLoading(false);
    }
  };

  // Disconnect Telegram
  const handleDisconnect = async () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const authToken = user.access_token;

    if (!authToken) {
      setError('Not authenticated');
      return;
    }

    if (!confirm('Are you sure you want to disconnect Telegram? You will stop receiving alerts.')) {
      return;
    }

    try {
      setDisconnectLoading(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/telegram/disconnect/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect Telegram');
      }

      const data = await response.json();
      
      if (data.success) {
        setSuccessMessage('Telegram disconnected successfully');
        fetchTelegramStatus();
      } else {
        throw new Error(data.error || 'Failed to disconnect');
      }
    } catch (err) {
      setError('Failed to disconnect Telegram. Please try again.');
    } finally {
      setDisconnectLoading(false);
    }
  };

  useEffect(() => {
    fetchTelegramStatus();
  }, [fetchTelegramStatus]);

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
          <div className="flex items-center space-x-3">
            <Send className="h-6 w-6 text-indigo-600" />
            <div>
              <CardTitle>Telegram Alerts</CardTitle>
              <CardDescription>
                Get instant crypto alerts on Telegram
              </CardDescription>
            </div>
          </div>
          {status?.connected ? (
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
              <X className="h-3 w-3 mr-1" />
              Not Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert className="bg-green-50 text-green-800 border-green-200">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        {status?.connected ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-green-900">Telegram Connected!</p>
                  <p className="text-sm text-green-700 mt-1">
                    Bot: @{status.bot_username || 'volusignal_alerts_v2_bot'}
                  </p>
                  {status.username && (
                    <p className="text-sm text-green-700">
                      Your Telegram: @{status.username}
                    </p>
                  )}
                  <p className="text-xs text-green-600 mt-2">
                    You will receive real-time alerts via Telegram
                  </p>
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <Button
                onClick={handleTestAlert}
                disabled={testLoading}
                variant="outline"
                className="flex-1"
              >
                {testLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Test Alert
                  </>
                )}
              </Button>

              <Button
                onClick={handleDisconnect}
                disabled={disconnectLoading}
                variant="destructive"
                className="flex-1"
              >
                {disconnectLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Disconnecting...
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Disconnect
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-blue-900">Connect Telegram for Instant Alerts</p>
                  <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
                    <li>Real-time price pump/dump notifications</li>
                    <li>RSI overbought/oversold signals</li>
                    <li>Custom price target alerts</li>
                    <li>Volume spike notifications</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm text-gray-600">
                <p className="font-semibold mb-2">How to connect:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Click &quot;Connect Telegram&quot; below</li>
                  <li>Telegram will open with our bot</li>
                  <li>Press &quot;Start&quot; in Telegram</li>
                  <li>You&apos;ll receive a confirmation message</li>
                </ol>
              </div>

              <Button
                onClick={handleConnectTelegram}
                disabled={setupLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700"
              >
                {setupLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Opening Telegram...
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Connect Telegram
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
