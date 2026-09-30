'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Send, 
  CheckCircle, 
  X, 
  Loader2, 
  ExternalLink 
} from 'lucide-react';
import {
  generateTelegramSetupToken,
  getTelegramStatus,
  disconnectTelegram,
  sendTestTelegramAlert,
  type TelegramStatusResponse,
  type TelegramSetupResponse,
} from '@/lib/telegram-api';

// Dynamically import QRCode to avoid SSR issues
const QRCodeSVG = dynamic(
  () => import('qrcode.react').then((mod) => mod.QRCodeSVG),
  { ssr: false, loading: () => <div className="w-[200px] h-[200px] bg-gray-100 animate-pulse rounded" /> }
);

interface TelegramConnectionProps {
  onConnectionChange?: (connected: boolean) => void;
}

export default function TelegramConnection({ onConnectionChange }: TelegramConnectionProps) {
  const [status, setStatus] = useState<TelegramStatusResponse | null>(null);
  const [setupData, setSetupData] = useState<TelegramSetupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [isPremium, setIsPremium] = useState<boolean>(false);

  const checkConnectionStatus = useCallback(async () => {
    const isInitialLoad = loading;
    if (isInitialLoad) {
      setLoading(true);
    }
    
    const statusData = await getTelegramStatus();
    
    // Check if connection status changed
    const wasConnected = status?.connected;
    const isNowConnected = statusData?.connected;
    
    setStatus(statusData);
    
    if (isInitialLoad) {
      setLoading(false);
    }
    
    // If just connected, hide QR and show success message
    if (!wasConnected && isNowConnected) {
      setShowQR(false);
      setSetupData(null);
      setMessage({
        type: 'success',
        text: '🎉 Telegram connected successfully! You can now receive alerts.',
      });
      
      // Notify parent of successful connection
      if (onConnectionChange) {
        onConnectionChange(true);
      }
      
      // Auto-clear success message after 10 seconds
      setTimeout(() => {
        setMessage(null);
      }, 10000);
    }
    
    if (statusData && onConnectionChange) {
      onConnectionChange(statusData.connected);
    }
  // Only include onConnectionChange in dependencies, not loading or status
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onConnectionChange]);

  // Function to check premium status from localStorage
  const checkPremiumStatus = useCallback(() => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        const plan = user?.subscription_plan || 'free';
        const premium = plan === 'basic' || plan === 'enterprise' || user?.is_premium_user === true;
        console.log('🔍 TelegramConnection - User plan:', plan, 'is_premium_user:', user?.is_premium_user, 'Final isPremium:', premium);
        setIsPremium(premium);
        return premium;
      } else {
        console.log('⚠️ TelegramConnection - No user found in localStorage');
        setIsPremium(false);
        return false;
      }
    } catch (error) {
      console.error('❌ TelegramConnection - Error parsing user:', error);
      setIsPremium(false);
      return false;
    }
  }, []);

  // Fetch initial connection status - only run once on mount
  useEffect(() => {
    checkPremiumStatus();
    checkConnectionStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for storage changes (e.g., when user upgrades in another tab or after upgrade)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user') {
        console.log('👂 TelegramConnection - User data changed in localStorage, rechecking premium status');
        checkPremiumStatus();
      }
    };

    // Also listen for custom event when user data is updated in same tab
    const handleUserUpdate = () => {
      console.log('👂 TelegramConnection - Custom user update event received');
      checkPremiumStatus();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('userUpdated', handleUserUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userUpdated', handleUserUpdate);
    };
  }, [checkPremiumStatus]);

  // Auto-refresh connection status every 5 seconds when QR is showing
  useEffect(() => {
    if (!showQR) return;

    const interval = setInterval(() => {
      checkConnectionStatus();
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [showQR, checkConnectionStatus]);

  const handleConnect = async () => {
    setActionLoading(true);
    setMessage(null);
    
    const response = await generateTelegramSetupToken();
    
    if (response.success && response.bot_link) {
      setSetupData(response);
      setShowQR(true);
      setMessage({
        type: 'success',
        text: 'Setup link generated! Scan the QR code or click the link to connect.',
      });
    } else {
      setMessage({
        type: 'error',
        text: response.error || 'Failed to generate setup link. Please try again.',
      });
    }
    
    setActionLoading(false);
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Telegram? You will stop receiving alerts.')) {
      return;
    }

    setActionLoading(true);
    setMessage(null);
    
    const response = await disconnectTelegram();
    
    if (response.success) {
      setMessage({
        type: 'success',
        text: 'Telegram disconnected successfully.',
      });
      await checkConnectionStatus();
      setShowQR(false);
      setSetupData(null);
    } else {
      setMessage({
        type: 'error',
        text: response.error || 'Failed to disconnect Telegram.',
      });
    }
    
    setActionLoading(false);
  };

  const handleTestAlert = async () => {
    setActionLoading(true);
    setMessage(null);
    
    const response = await sendTestTelegramAlert();
    
    if (response.success) {
      setMessage({
        type: 'success',
        text: 'Test alert sent! Check your Telegram.',
      });
    } else {
      setMessage({
        type: 'error',
        text: response.error || 'Failed to send test alert.',
      });
    }
    
    setActionLoading(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage({
      type: 'success',
      text: 'Link copied to clipboard!',
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Send className="h-6 w-6 text-blue-500" />
            <div>
              <CardTitle>Telegram Alerts</CardTitle>
              <CardDescription>
                Connect your Telegram account to receive real-time crypto alerts
              </CardDescription>
            </div>
          </div>
          {status?.connected ? (
            <Badge className="bg-green-500 hover:bg-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge variant="secondary">
              <X className="h-3 w-3 mr-1" />
              Not Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {message && (
          <Alert className={message.type === 'success' ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}>
            <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        {status?.connected ? (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Telegram Username:</span>
                <span className="text-sm text-gray-900">@{status.username || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Bot:</span>
                <span className="text-sm text-gray-900">@{status.bot_username}</span>
              </div>
            </div>

            <div className="flex space-x-3">
              <Button
                onClick={handleTestAlert}
                disabled={actionLoading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Test Alert
              </Button>
              
              <Button
                onClick={handleDisconnect}
                disabled={actionLoading}
                variant="destructive"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <X className="h-4 w-4 mr-2" />
                )}
                Disconnect
              </Button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">You&apos;re all set!</p>
                  <p className="text-blue-700">
                    You&apos;ll receive crypto alerts directly in your Telegram chat. Make sure notifications are enabled.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {!showQR ? (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Benefits of Telegram Alerts:</h4>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      Instant notifications for price movements and RSI signals
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      Rich formatting with emojis and real-time data
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      Works on all devices - mobile, desktop, and web
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      Free and secure - no additional costs
                    </li>
                  </ul>
                </div>

                {!isPremium && (
                  <div className="p-3 border border-yellow-200 bg-yellow-50 rounded text-yellow-800 text-sm mb-2">
                    Telegram setup is a premium feature. Upgrade to unlock alerts in Telegram.
                  </div>
                )}
                <Button
                  onClick={handleConnect}
                  disabled={actionLoading || !isPremium}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
                  size="lg"
                >
                  {actionLoading ? (
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5 mr-2" />
                  )}
                  {isPremium ? 'Connect Telegram' : 'Upgrade to Connect'}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {setupData?.bot_link && (
                  <div className="flex flex-col items-center space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 w-full">
                      <div className="flex items-center space-x-2">
                        <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                        <span className="text-sm text-blue-800 font-medium">
                          Waiting for connection... (checking automatically)
                        </span>
                      </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-lg border-2 border-gray-200 shadow-sm">
                      <QRCodeSVG 
                        value={setupData.bot_link} 
                        size={200}
                        level="H"
                        includeMargin={true}
                      />
                    </div>
                    
                    <div className="text-center space-y-2">
                      <p className="text-sm font-medium text-gray-900">
                        Scan with your phone or click the button below
                      </p>
                      <p className="text-xs text-gray-600">
                        The QR code and link will expire in 15 minutes
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                    <code className="text-xs text-gray-700 truncate flex-1 mr-2">
                      {setupData?.bot_link}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setupData?.bot_link && copyToClipboard(setupData.bot_link)}
                    >
                      Copy
                    </Button>
                  </div>

                  <Button
                    onClick={() => setupData?.bot_link && window.open(setupData.bot_link, '_blank')}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    size="lg"
                  >
                    <ExternalLink className="h-5 w-5 mr-2" />
                    Open in Telegram
                  </Button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Setup Instructions:
                  </h4>
                  <ol className="space-y-1 text-sm text-blue-800 list-decimal list-inside">
                    {setupData?.instructions?.map((instruction, index) => (
                      <li key={index}>{instruction}</li>
                    ))}
                  </ol>
                </div>

                <Button
                  onClick={() => {
                    setShowQR(false);
                    setSetupData(null);
                    checkConnectionStatus();
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
