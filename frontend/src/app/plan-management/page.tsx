'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/shared/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, CheckCircle, TrendingUp } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInactivityLogout } from '@/lib/useInactivityLogout';
import { getUser, logout, authenticatedFetch } from '@/lib/auth';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

const { Calendar, Clock, XCircle, ArrowRight, Crown, Zap, Shield, Sparkles } = LucideIcons as any;

interface UserPlanDetails {
  subscription_plan: 'free' | 'basic' | 'enterprise';
  is_premium_user: boolean;
  plan_start_date?: string;
  plan_end_date?: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface PlanFeature {
  name: string;
  included: boolean;
}

interface PlanOption {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: PlanFeature[];
  icon: React.ReactNode;
  color: string;
  badge?: string;
}

const planOptions: PlanOption[] = [
  {
    id: 'basic',
    name: 'Basic Plan',
    price: '$9.99',
    period: 'month',
    description: 'Perfect for individual traders getting started',
    icon: <Zap className="h-6 w-6" />,
    color: 'blue',
    features: [
      { name: 'Real-time crypto tracking', included: true },
      { name: 'Up to 10 price alerts', included: true },
      { name: 'Email notifications', included: true },
      { name: 'Telegram bot integration', included: true },
      { name: 'Basic technical indicators (RSI)', included: true },
      { name: 'All exchange support', included: true },
      { name: 'Advanced analytics', included: false },
      { name: 'Priority support', included: false },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise Plan',
    price: '$29.99',
    period: 'month',
    description: 'For professional traders who need everything',
    icon: <Crown className="h-6 w-6" />,
    color: 'green',
    badge: 'POPULAR',
    features: [
      { name: 'Everything in Basic', included: true },
      { name: 'Unlimited price alerts', included: true },
      { name: 'Advanced technical indicators', included: true },
      { name: 'Custom alert conditions', included: true },
      { name: 'Portfolio tracking', included: true },
      { name: 'API access', included: true },
      { name: 'Priority support', included: true },
      { name: 'Early access to new features', included: true },
    ],
  },
];

export default function PlanManagementPage() {
  useInactivityLogout();
  const router = useRouter();
  const [user, setUser] = useState<UserPlanDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [progressPercentage, setProgressPercentage] = useState(0);

  const calculateDaysRemaining = useCallback((endDate: string) => {
    const now = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }, []);

  const calculateProgress = useCallback((startDate: string, endDate: string) => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const totalDuration = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    const percentage = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    
    return percentage;
  }, []);

  const fetchUserDetails = useCallback(async () => {
    // Check authentication using centralized auth utility
    const authUser = getUser();
    if (!authUser) {
      logout();
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

      // Calculate days remaining if plan has end date
      if (data.plan_end_date) {
        const days = calculateDaysRemaining(data.plan_end_date);
        setDaysRemaining(days);
        
        if (data.plan_start_date) {
          const progress = calculateProgress(data.plan_start_date, data.plan_end_date);
          setProgressPercentage(progress);
        }
      }
    } catch (err) {
      console.error('Error fetching user details:', err);
      logout();
    } finally {
      setLoading(false);
    }
  }, [calculateDaysRemaining, calculateProgress]);

  useEffect(() => {
    fetchUserDetails();
  }, [fetchUserDetails]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'enterprise':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'basic':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getPlanIcon = (plan: string) => {
    switch (plan) {
      case 'enterprise':
        return <Crown className="h-5 w-5" />;
      case 'basic':
        return <Zap className="h-5 w-5" />;
      default:
        return <Shield className="h-5 w-5" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <LoadingSpinner message="Loading plan details..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">

        <div className="mb-6 lg:mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Plan Management</h1>
          <p className="text-gray-600">Manage your subscription and view plan details</p>
        </div>

        {/* Current Plan Card */}
        <Card className="mb-8 border-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-3 rounded-lg',
                  user?.subscription_plan === 'enterprise' ? 'bg-green-100' :
                  user?.subscription_plan === 'basic' ? 'bg-blue-100' :
                  'bg-gray-100'
                )}>
                  {getPlanIcon(user?.subscription_plan || 'free')}
                </div>
                <div>
                  <CardTitle className="text-2xl">
                    {user?.subscription_plan ? 
                      user.subscription_plan.charAt(0).toUpperCase() + user.subscription_plan.slice(1) 
                      : 'Free'} Plan
                  </CardTitle>
                  <CardDescription>Your current subscription</CardDescription>
                </div>
              </div>
              <Badge className={cn('px-4 py-2 text-sm font-semibold', getPlanColor(user?.subscription_plan || 'free'))}>
                {user?.is_premium_user ? 'PREMIUM' : 'FREE'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Plan Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Activation Date */}
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Activation Date</p>
                  <p className="font-semibold text-gray-900">
                    {formatDate(user?.plan_start_date)}
                  </p>
                </div>
              </div>

              {/* Expiry Date */}
              <div className="flex items-start gap-3">
                <div className="p-2 bg-orange-50 rounded-lg">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Expiry Date</p>
                  <p className="font-semibold text-gray-900">
                    {user?.subscription_plan === 'free' ? 'Never' : formatDate(user?.plan_end_date)}
                  </p>
                </div>
              </div>

              {/* Days Remaining */}
              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-50 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Days Remaining</p>
                  <p className="font-semibold text-gray-900">
                    {user?.subscription_plan === 'free' 
                      ? '∞ Unlimited' 
                      : daysRemaining !== null 
                        ? `${daysRemaining} days` 
                        : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Progress Bar for Premium Plans */}
            {user?.subscription_plan !== 'free' && user?.plan_start_date && user?.plan_end_date && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Plan Duration</span>
                  <span className="text-gray-900 font-medium">
                    {Math.round(progressPercentage)}% used
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{formatDate(user?.plan_start_date)}</span>
                  <span>{formatDate(user?.plan_end_date)}</span>
                </div>
              </div>
            )}

            {/* Renewal Warning */}
            {daysRemaining !== null && daysRemaining < 7 && daysRemaining > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-orange-900">Plan Expiring Soon</p>
                    <p className="text-sm text-orange-700 mt-1">
                      Your plan will expire in {daysRemaining} days. Renew now to continue enjoying premium features.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Plan Expired */}
            {daysRemaining === 0 && user?.subscription_plan !== 'free' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900">Plan Expired</p>
                    <p className="text-sm text-red-700 mt-1">
                      Your premium plan has expired. Upgrade now to regain access to premium features.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upgrade Options */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-yellow-500" />
            Upgrade Your Plan
          </h2>
          <p className="text-gray-600">Choose a plan that fits your trading needs</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {planOptions.map((plan) => {
            const isCurrentPlan = user?.subscription_plan === plan.id;
            const canUpgrade = user?.subscription_plan === 'free' || 
                              (user?.subscription_plan === 'basic' && plan.id === 'enterprise');
            
            return (
              <Card 
                key={plan.id}
                className={cn(
                  'relative overflow-hidden border-2 transition-all hover:shadow-lg',
                  isCurrentPlan && 'border-blue-500 bg-blue-50/50',
                  plan.badge && 'border-yellow-400'
                )}
              >
                {plan.badge && (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-yellow-400 text-yellow-900 font-bold">
                      {plan.badge}
                    </Badge>
                  </div>
                )}
                
                <CardHeader>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={cn(
                      'p-3 rounded-lg',
                      plan.color === 'blue' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                    )}>
                      {plan.icon}
                    </div>
                    <div>
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <CardDescription>{plan.description}</CardDescription>
                    </div>
                  </div>
                  
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-gray-500">/ {plan.period}</span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <Separator />
                  
                  <div className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        {feature.included ? (
                          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-5 w-5 text-gray-300 flex-shrink-0" />
                        )}
                        <span className={cn(
                          'text-sm',
                          feature.included ? 'text-gray-900' : 'text-gray-400 line-through'
                        )}>
                          {feature.name}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {isCurrentPlan ? (
                    <Button 
                      className="w-full"
                      variant="outline"
                      disabled
                    >
                      Current Plan
                    </Button>
                  ) : canUpgrade ? (
                    <Button 
                      className={cn(
                        'w-full font-semibold',
                        plan.color === 'blue' 
                          ? 'bg-blue-600 hover:bg-blue-700' 
                          : 'bg-green-600 hover:bg-green-700'
                      )}
                      onClick={() => router.push('/upgrade-plan')}
                    >
                      Upgrade to {plan.name}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button 
                      className="w-full"
                      variant="outline"
                      disabled
                    >
                      Not Available
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Help Section */}
        {/* <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Shield className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-2">Need Help?</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Have questions about your plan or need assistance? Our support team is here to help.
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" size="sm" onClick={() => router.push('/settings')}>
                    Contact Support
                  </Button>
                  <Button variant="ghost" size="sm">
                    View FAQ
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card> */}
      </div>
    </div>
  );
}
