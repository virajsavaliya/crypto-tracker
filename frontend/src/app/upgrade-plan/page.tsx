// frontend copy/src/app/upgrade-plan/page.tsx
'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, CheckCircle } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import Header from '@/components/shared/Header';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { getUser, logout, authenticatedFetch } from '@/lib/auth';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

const { Crown, Zap, XCircle, ArrowRight, Sparkles } = LucideIcons as any;

interface PlanFeature {
    name: string;
    included: boolean;
}

interface Plan {
    id: 'basic' | 'enterprise';
    name: string;
    price: string;
    period: string;
    description: string;
    features: PlanFeature[];
    icon: React.ReactNode;
    color: string;
    badge?: string;
}

interface UserData {
    subscription_plan: 'free' | 'basic' | 'enterprise';
    is_premium_user: boolean;
    first_name: string;
    last_name: string;
    email: string;
}

const planOptions: Plan[] = [
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

function UpgradePlanContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
    const [loading, setLoading] = useState(true);
    const [upgrading, setUpgrading] = useState(false);
    const [message, setMessage] = useState('');
    const [user, setUser] = useState<UserData | null>(null);
    
    const fetchUserDetails = useCallback(async () => {
        const authUser = getUser();
        if (!authUser) {
            logout();
            return;
        }

        try {
            const response = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`);

            if (!response) {
                return;
            }

            if (!response.ok) {
                throw new Error('Failed to fetch user details');
            }

            const data = await response.json();
            setUser(data);
        } catch (err) {
            console.error('Error fetching user details:', err);
            logout();
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUserDetails();
    }, [fetchUserDetails]);
    
    useEffect(() => {
        if (searchParams.get('upgrade') === 'success') {
            setMessage('🎉 Upgrade successful! Your new plan is now active.');
        } else if (searchParams.get('upgrade') === 'canceled') {
            setMessage('❌ Upgrade process was canceled. You can try again anytime.');
        }
    }, [searchParams]);

    const handleUpgrade = async (plan: Plan) => {
        setUpgrading(true);
        setMessage('');
        
        try {
            const authUser = getUser();
            if (!authUser) {
                logout();
                return;
            }

            const response = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upgrade-plan/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ plan: plan.id }),
            });

            if (!response) {
                return;
            }

            const data = await response.json();

            if (response.ok) {
                // Redirect to Stripe checkout
                window.location.href = data.checkout_url;
            } else {
                setMessage(data.error || '❌ Upgrade failed. Please try again.');
            }
        } catch (err) {
            setMessage('❌ Network error. Please try again.');
        } finally {
            setUpgrading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Header />
                <LoadingSpinner message="Loading upgrade options..." />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Header />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
                
                {/* Page Header */}
                <div className="mb-6 lg:mb-8 text-center">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="bg-yellow-100 p-3 rounded-full">
                            <Award className="h-8 w-8 text-yellow-600" />
                        </div>
                    </div>
                    <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
                        Upgrade Your Plan
                    </h1>
                    <p className="text-gray-600 text-lg">
                        Unlock premium features and take your trading to the next level
                    </p>
                </div>

                {/* Current Plan Badge */}
                {user && (
                    <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                        <p className="text-sm text-blue-800">
                            Your current plan: <span className="font-bold capitalize">{user.subscription_plan}</span>
                        </p>
                    </div>
                )}

                {/* Success/Error Message */}
                {message && (
                    <div className={cn(
                        "mb-6 p-4 rounded-lg text-center font-medium",
                        message.includes('successful') ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"
                    )}>
                        {message}
                    </div>
                )}

                {/* Plan Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {planOptions.map((plan) => {
                        const isCurrentPlan = user?.subscription_plan === plan.id;
                        const canUpgrade = user?.subscription_plan === 'free' || 
                                          (user?.subscription_plan === 'basic' && plan.id === 'enterprise');
                        
                        return (
                            <Card 
                                key={plan.id}
                                className={cn(
                                    'relative overflow-hidden border-2 transition-all',
                                    isCurrentPlan && 'border-blue-500 bg-blue-50/50',
                                    plan.badge && 'border-yellow-400',
                                    canUpgrade && !isCurrentPlan && 'hover:shadow-lg hover:border-gray-400'
                                )}
                            >
                                {plan.badge && (
                                    <div className="absolute top-4 right-4">
                                        <div className="bg-yellow-400 text-yellow-900 font-bold px-3 py-1 rounded-full text-xs">
                                            {plan.badge}
                                        </div>
                                    </div>
                                )}
                                
                                {isCurrentPlan && (
                                    <div className="absolute top-4 left-4">
                                        <div className="bg-blue-600 text-white font-bold px-3 py-1 rounded-full text-xs">
                                            CURRENT PLAN
                                        </div>
                                    </div>
                                )}
                                
                                <CardHeader className="pb-4">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className={cn(
                                            'p-3 rounded-lg',
                                            plan.color === 'blue' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                                        )}>
                                            {plan.icon}
                                        </div>
                                        <div>
                                            <CardTitle className="text-xl">{plan.name}</CardTitle>
                                            <CardDescription className="mt-1">{plan.description}</CardDescription>
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
                                            onClick={() => handleUpgrade(plan)}
                                            disabled={upgrading}
                                        >
                                            {upgrading ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                                    Processing...
                                                </>
                                            ) : (
                                                <>
                                                    Upgrade to {plan.name}
                                                    <ArrowRight className="ml-2 h-4 w-4" />
                                                </>
                                            )}
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

                {/* Information Section */}
                {/* <Card className="border-blue-200 bg-blue-50/50">
                    <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-blue-100 rounded-lg">
                                <Sparkles className="h-6 w-6 text-blue-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 mb-2 text-lg">Why Upgrade?</h3>
                                <ul className="space-y-2 text-sm text-gray-700">
                                    <li className="flex items-center gap-2">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                        <span>Instant access to all premium features</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                        <span>Cancel or change plans anytime</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                        <span>Secure payment processing via Stripe</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                        <span>30-day money-back guarantee</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </CardContent>
                </Card> */}

                {/* Back to Dashboard Button */}
                <div className="mt-8 text-center">
                    <Button 
                        variant="ghost" 
                        onClick={() => router.push('/dashboard')}
                        className="text-gray-600 hover:text-gray-900"
                    >
                        ← Back to Dashboard
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function UpgradePlan() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <UpgradePlanContent />
        </Suspense>
    );
}