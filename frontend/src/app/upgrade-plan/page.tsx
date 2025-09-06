// frontend copy/src/app/upgrade-plan/page.tsx
'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, CheckCircle, Loader2 } from 'lucide-react';
import Header from '@/components/shared/Header';
import { cn } from '@/lib/utils';

interface Plan {
    id: 'basic' | 'enterprise';
    name: string;
    price: string;
    features: string[];
}

const plans: Plan[] = [
    {
        id: 'basic',
        name: 'Basic Plan',
        price: '$10/month',
        features: [
            'Faster data updates',
            'Full access to all metrics',
            'Unlimited alerts',
            'Priority support',
        ],
    },
    {
        id: 'enterprise',
        name: 'Enterprise Plan',
        price: '$50/month',
        features: [
            'All Basic features',
            'Real-time streaming data',
            'Dedicated account manager',
            'Custom integrations',
        ],
    },
];

function UpgradePlanContent() {
    const searchParams = useSearchParams();
    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    
    useEffect(() => {
        if (searchParams.get('upgrade') === 'success') {
            setMessage('Upgrade successful! Please re-login to see your new plan.');
        } else if (searchParams.get('upgrade') === 'canceled') {
            setMessage('Upgrade process was canceled. You can try again.');
        }
    }, [searchParams]);

    const handleUpgrade = async () => {
        if (!selectedPlan) {
            setMessage('Please select a plan to upgrade.');
            return;
        }

        setLoading(true);
        setMessage('');
        
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upgrade-plan/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.access_token}`,
                },
                body: JSON.stringify({ plan: selectedPlan.id }),
            });
            const data = await response.json();

            if (response.ok) {
                window.location.href = data.checkout_url;
            } else {
                setMessage(data.error || 'Upgrade failed. Please try again.');
            }
        } catch (error) {
            console.error('Upgrade failed:', error);
            setMessage('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen p-6 bg-gray-100 font-sans">
            <Header />
            <div className="container mx-auto px-6 py-8 flex-grow flex items-center justify-center">
                <div className="w-full max-w-4xl space-y-8">
                    <div className="text-center">
                        <h1 className="text-4xl font-bold text-gray-900 flex items-center justify-center space-x-2">
                            <Award className="h-10 w-10 text-yellow-500" />
                            <span>Upgrade Your Plan</span>
                        </h1>
                        <p className="mt-4 text-lg text-gray-600">
                            Choose a premium plan to unlock all features and get access to more data.
                        </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        {plans.map(plan => (
                            <Card 
                                key={plan.id}
                                className={cn(
                                    "cursor-pointer transition-all duration-200",
                                    selectedPlan?.id === plan.id ? "border-2 border-indigo-600 shadow-xl" : "hover:border-indigo-400"
                                )}
                                onClick={() => setSelectedPlan(plan)}
                            >
                                <CardHeader>
                                    <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                                    <CardDescription className="mt-2 text-xl font-semibold text-indigo-600">{plan.price}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-2 text-gray-700 mt-4">
                                        {plan.features.map(feature => (
                                            <li key={feature} className="flex items-center space-x-2">
                                                <CheckCircle className="h-5 w-5 text-green-500" />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <div className="text-center space-y-4">
                        {message && (
                            <div className={cn("text-sm font-medium", message.includes('successful') ? "text-green-600" : "text-red-600")}>
                                {message}
                            </div>
                        )}
                        <Button 
                            onClick={handleUpgrade}
                            className="w-full max-w-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold transition-colors"
                            disabled={!selectedPlan || loading}
                        >
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Proceed to Checkout
                        </Button>
                        <p className="text-sm text-gray-500">
                            You can switch plans or cancel at any time.
                        </p>
                    </div>
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