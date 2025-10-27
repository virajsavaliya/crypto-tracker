'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TrendingUp, Bell, User, LogOut, Award, Settings } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface User {
  first_name: string;
  last_name: string;
  email: string;
  mobile_number: string;
  username: string;
  subscription_plan: 'free' | 'basic' | 'enterprise';
  is_premium_user: boolean;
}

let isRefreshing = false;
let failedQueue: ((token: string) => void)[] = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach(promise => {
    if (error) {
      // Intentionally not rejecting promises to avoid unhandled promise rejections
    } else {
      promise(token!);
    }
  });
  failedQueue = [];
};

const Header = () => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('user');
    localStorage.removeItem('is_premium_user');
    router.push('/');
  }, [router]);

  const refreshAndRetry = useCallback(async (originalRequest: (token: string) => Promise<void>) => {
    const localUser = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!localUser.refresh_token) {
      handleLogout();
      return;
    }

    if (isRefreshing) {
      return new Promise<void>((resolve) => {
        failedQueue.push(async (token) => {
          await originalRequest(token);
          resolve();
        });
      });
    }

    isRefreshing = true;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: localUser.refresh_token }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();
      const newToken = data.access;
      
      // Update local storage with new token
      localStorage.setItem('user', JSON.stringify({
        ...localUser,
        access_token: newToken,
      }));

      // Process all queued requests
      processQueue(null, newToken);
      
      // Execute original request with new token
      await originalRequest(newToken);

    } catch (err) {
      processQueue(err as Error, null);
      handleLogout();
    } finally {
      isRefreshing = false;
    }
  }, [handleLogout]);

  const fetchUserDetails = useCallback(async (token?: string, isRetry = false) => {
    const localUser = JSON.parse(localStorage.getItem('user') || '{}');
    const authToken = token || localUser.access_token;

    if (!authToken) {
      handleLogout();
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401 && !isRetry) {
          await refreshAndRetry((newToken) => fetchUserDetails(newToken, true));
          return;
        }
        throw new Error('Failed to fetch user details');
      }

      const data = await response.json();
      setUser(data);
      localStorage.setItem('is_premium_user', data.is_premium_user.toString());
      localStorage.setItem('user_plan', data.subscription_plan);
    } catch (err) {
      if (!isRetry) {
        handleLogout();
      }
    }
  }, [handleLogout, refreshAndRetry]);

  useEffect(() => {
    fetchUserDetails();
  }, [fetchUserDetails]);

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between bg-white shadow-sm p-2 rounded-xl mb-4">
      <div className="flex items-center space-x-2">
        <span className="text-lg font-bold">Crypto Tracker</span>
        <Button variant="ghost" asChild>
          <Link href="/dashboard">
            <TrendingUp className="h-4 w-4 mr-1" />
            Live
          </Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/alerts">
            <Bell className="h-4 w-4 mr-1" />
            Alerts
          </Link>
        </Button>
      </div>
      <div className="flex items-center space-x-2">
        <div className="text-sm text-gray-500 flex items-center space-x-2">
            <Button
              variant="ghost"
              onClick={() => router.push('/plan-management')}
              className={cn(
                'font-semibold px-3 py-1 h-auto hover:bg-gray-100',
                user?.subscription_plan === 'enterprise' ? 'text-green-600 hover:text-green-700' :
                user?.subscription_plan === 'basic' ? 'text-blue-600 hover:text-blue-700' :
                    'text-gray-600 hover:text-gray-700'
              )}
            >
              {user?.subscription_plan ? user.subscription_plan.charAt(0).toUpperCase() + user.subscription_plan.slice(1) : ''} Plan
            </Button>
            {user?.subscription_plan === 'free' && (
                <Button
                    onClick={() => router.push('/upgrade-plan')}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
                    size="sm"
                >
                    UPGRADE
                </Button>
            )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="rounded-full size-9 p-0">
              <User className="h-7 w-7" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <div className="font-semibold">{user?.first_name} {user?.last_name}</div>
              <div className="text-sm text-gray-500">{user?.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="h-4 w-4 mr-2" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            {!user?.is_premium_user && (
              <DropdownMenuItem asChild>
                <Link href="/upgrade-plan">
                  <Award className="h-4 w-4 mr-2" />
                  <span>Upgrade Plan</span>
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-500 focus:text-red-500">
              <LogOut className="h-4 w-4 mr-2" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;