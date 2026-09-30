'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TrendingUp, Bell, User, LogOut, Award, Settings, Menu, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { getUser, logout, authenticatedFetch } from '@/lib/auth';

interface User {
  first_name: string;
  last_name: string;
  email: string;
  mobile_number: string;
  username: string;
  subscription_plan: 'free' | 'basic' | 'enterprise';
  is_premium_user: boolean;
}

const Header = () => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = useCallback(() => {
    logout();
  }, []);

  const fetchUserDetails = useCallback(async () => {
    // Check authentication using centralized auth utility
    const authUser = getUser();
    if (!authUser) {
      // User not authenticated, don't logout (let page handle it)
      return;
    }

    try {
      const response = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`);

      if (!response) {
        // authenticatedFetch handles logout on auth errors
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch user details');
      }

      const data = await response.json();
      setUser(data);
    } catch (err) {
      console.error('Error fetching user details in header:', err);
    }
  }, []);

  useEffect(() => {
    fetchUserDetails();
  }, [fetchUserDetails]);

  const getPlanBadge = () => {
    if (!user?.subscription_plan) return null;
    
    const planConfig = {
      free: {
        label: 'Free Plan',
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-700',
        borderColor: 'border-gray-300',
        hoverBg: 'hover:bg-gray-200'
      },
      basic: {
        label: 'Basic Plan',
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-700',
        borderColor: 'border-blue-300',
        hoverBg: 'hover:bg-blue-100'
      },
      enterprise: {
        label: 'Enterprise Plan',
        bgColor: 'bg-gradient-to-r from-green-50 to-emerald-50',
        textColor: 'text-green-700',
        borderColor: 'border-green-300',
        hoverBg: 'hover:from-green-100 hover:to-emerald-100'
      }
    };

    const config = planConfig[user.subscription_plan];

    return (
      <Button
        variant="ghost"
        onClick={() => router.push('/plan-management')}
        className={cn(
          'font-semibold px-4 py-2 h-auto rounded-lg border transition-all duration-200',
          config.bgColor,
          config.textColor,
          config.borderColor,
          config.hoverBg,
          'hidden sm:flex items-center gap-2'
        )}
      >
        {user.subscription_plan === 'enterprise' && <Award className="h-4 w-4" />}
        {config.label}
      </Button>
    );
  };

  return (
    <>
      {/* Desktop & Mobile Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            
            {/* Logo & Brand */}
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="flex items-center gap-3 group">
                <div className="bg-gray-900 p-2 rounded-xl shadow-md group-hover:shadow-lg transition-shadow">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <span className="text-xl lg:text-2xl font-bold text-gray-900">
                  Volume Tracker
                </span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-2 lg:gap-3">
              <Button 
                variant="ghost" 
                asChild 
                className="hover:bg-gray-100 hover:text-gray-900 transition-colors px-4 lg:px-6 h-10"
              >
                <Link href="/dashboard" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="font-medium">Live Data</span>
                </Link>
              </Button>
              <Button 
                variant="ghost" 
                asChild 
                className="hover:bg-gray-100 hover:text-gray-900 transition-colors px-4 lg:px-6 h-10"
              >
                <Link href="/alerts" className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  <span className="font-medium">Alerts</span>
                </Link>
              </Button>
            </nav>

            {/* Right Side Actions */}
            <div className="flex items-center gap-3">
              
              {/* Plan Badge */}
              {getPlanBadge()}

              {/* Upgrade Button (for free users) */}
              {user?.subscription_plan === 'free' && (
                <Button
                  onClick={() => router.push('/upgrade-plan')}
                  className="bg-gray-900 hover:bg-gray-800 text-white font-bold shadow-md hover:shadow-lg transition-all px-4 lg:px-6 hidden sm:flex"
                  size="default"
                >
                  <Award className="h-4 w-4 mr-2" />
                  UPGRADE
                </Button>
              )}

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="rounded-full h-10 w-10 p-0 hover:bg-gray-100 transition-colors hidden md:flex"
                  >
                    <div className="bg-gray-900 rounded-full h-9 w-9 flex items-center justify-center">
                      <User className="h-5 w-5 text-white" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>
                    <div className="font-semibold text-gray-900">{user?.first_name} {user?.last_name}</div>
                    <div className="text-sm text-gray-500 mt-1">{user?.email}</div>
                    <div className={cn(
                      "text-xs mt-2 px-2 py-1 rounded-md inline-block font-medium",
                      user?.subscription_plan === 'enterprise' ? 'bg-green-100 text-green-700' :
                      user?.subscription_plan === 'basic' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    )}>
                      {user?.subscription_plan?.toUpperCase()} PLAN
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="cursor-pointer">
                      <Settings className="h-4 w-4 mr-2" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/plan-management" className="cursor-pointer">
                      <Award className="h-4 w-4 mr-2" />
                      <span>Manage Plan</span>
                    </Link>
                  </DropdownMenuItem>
                  {!user?.is_premium_user && (
                    <DropdownMenuItem asChild>
                      <Link href="/upgrade-plan" className="cursor-pointer text-gray-900 font-medium">
                        <Award className="h-4 w-4 mr-2" />
                        <span>Upgrade Plan</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 cursor-pointer">
                    <LogOut className="h-4 w-4 mr-2" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                className="md:hidden h-10 w-10 p-0"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-4 space-y-3">
              <Link 
                href="/dashboard" 
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                <TrendingUp className="h-5 w-5 text-gray-900" />
                <span className="font-medium text-gray-900">Live Data</span>
              </Link>
              <Link 
                href="/alerts" 
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Bell className="h-5 w-5 text-gray-900" />
                <span className="font-medium text-gray-900">Alerts</span>
              </Link>
              <Link 
                href="/settings" 
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Settings className="h-5 w-5 text-gray-900" />
                <span className="font-medium text-gray-900">Settings</span>
              </Link>
              <Link 
                href="/plan-management" 
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Award className="h-5 w-5 text-gray-900" />
                <span className="font-medium text-gray-900">
                  {user?.subscription_plan?.charAt(0).toUpperCase() + (user?.subscription_plan?.slice(1) || '')} Plan
                </span>
              </Link>
              {user?.subscription_plan === 'free' && (
                <Button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    router.push('/upgrade-plan');
                  }}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold"
                >
                  <Award className="h-4 w-4 mr-2" />
                  UPGRADE PLAN
                </Button>
              )}
              <div className="pt-3 border-t border-gray-200">
                <div className="px-4 py-2">
                  <div className="font-semibold text-gray-900">{user?.first_name} {user?.last_name}</div>
                  <div className="text-sm text-gray-500">{user?.email}</div>
                </div>
                <Button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  variant="ghost"
                  className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 mt-2"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Log out
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
};

export default Header;