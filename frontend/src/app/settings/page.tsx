'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { Loader2, Award, User, CreditCard } from 'lucide-react';
import Header from '@/components/shared/Header';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getUser, logout, authenticatedFetch } from '@/lib/auth';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

// Define User interface
interface User {
  first_name: string;
  last_name: string;
  email: string;
  mobile_number: string;
  username: string;
  subscription_plan: 'free' | 'basic' | 'enterprise';
  is_premium_user: boolean;
}

// Define Payment interface
interface Payment {
  id: number;
  stripe_charge_id: string;
  amount: number;
  timestamp: string;
  status: string;
  plan: string;
}

const profileFormSchema = z.object({
  first_name: z.string().min(1, { message: 'First name is required.' }),
  last_name: z.string().min(1, { message: 'Last name is required.' }),
  username: z.string().min(1, { message: 'Username is required.' }),
  mobile_number: z.string().min(5, { message: 'Mobile number is too short.' }),
});

const SettingsPage = () => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updateMessage, setUpdateMessage] = useState('');

  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { first_name: '', last_name: '', username: '', mobile_number: '' },
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    
    // Check authentication using centralized auth utility
    const authUser = getUser();
    if (!authUser) {
      logout();
      return;
    }

    try {
      const [userResponse, paymentResponse] = await Promise.all([
        authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`),
        authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/payment-history/`)
      ]);

      if (!userResponse || !paymentResponse) {
        // authenticatedFetch handles logout on auth errors
        return;
      }

      if (!userResponse.ok || !paymentResponse.ok) {
        throw new Error('Failed to fetch data');
      }

      const userData = await userResponse.json();
      const paymentData = await paymentResponse.json();

      setUser(userData);
      setPayments(paymentData);
      profileForm.reset(userData);

    } catch (err) {
      console.error('Error fetching settings data:', err);
    } finally {
      setLoading(false);
    }
  }, [profileForm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  const handleProfileSubmit = async (data: z.infer<typeof profileFormSchema>) => {
    setUpdateMessage('');
    setLoading(true);
    
    try {
      const authUser = getUser();
      if (!authUser) {
        logout();
        return;
      }

      const response = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/update/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response) {
        // authenticatedFetch handles logout on auth errors
        return;
      }

      if (response.ok) {
        const updatedUser = await response.json();
        setUser(updatedUser);
        profileForm.reset(updatedUser);
        setUpdateMessage('Profile updated successfully!');
      } else {
        const errorData = await response.json();
        setUpdateMessage(errorData.error || 'Failed to update profile.');
      }
    } catch (err) {
      setUpdateMessage('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <LoadingSpinner message="Loading settings..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="mb-6 lg:mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Manage your account settings, profile, and payment history</p>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="profile"><User className="h-4 w-4 mr-2" />Profile</TabsTrigger>
            <TabsTrigger value="payment-history"><CreditCard className="h-4 w-4 mr-2" />Payment History</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <Card className="w-full shadow-lg border-gray-200">
              <CardHeader>
                <CardTitle className="text-2xl font-bold">Profile Information</CardTitle>
                <CardDescription className="text-gray-600">Update your personal details here.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 pt-4">
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={profileForm.control} name="first_name" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-600">First Name</FormLabel>
                          <FormControl><Input placeholder="John" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={profileForm.control} name="last_name" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-600">Last Name</FormLabel>
                          <FormControl><Input placeholder="Doe" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={profileForm.control} name="username" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-600">Username</FormLabel>
                        <FormDescription>Username must not contain any spaces.</FormDescription>
                        <FormControl><Input placeholder="johndoe" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={profileForm.control} name="mobile_number" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-600">Mobile Number</FormLabel>
                        <FormControl>
                          <PhoneInput
                            country={'us'}
                            value={field.value || ''}
                            onChange={field.onChange}
                            inputClass="!w-full"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="space-y-1">
                      <Label className="text-gray-600">Email</Label>
                      <p className="font-medium text-gray-700">{user?.email || 'N/A'}</p>
                    </div>
                    {updateMessage && <div className={cn("text-sm font-medium", updateMessage.includes('successfully') ? "text-green-600" : "text-red-600")}>{updateMessage}</div>}
                    <Button type="submit" disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save Changes</Button>
                  </form>
                </Form>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center space-x-2">
                    <Label>Subscription Plan:</Label>
                    <span className="font-semibold text-indigo-600">{user?.subscription_plan ? user.subscription_plan.charAt(0).toUpperCase() + user.subscription_plan.slice(1) : 'Free'}</span>
                    {user?.is_premium_user && <Award className="h-5 w-5 text-yellow-500" />}
                  </div>
                  {!user?.is_premium_user && (
                    <Link href="/upgrade-plan">
                      <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl">Upgrade Now</Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payment-history" className="mt-6">
            <Card className="w-full shadow-lg border-gray-200">
              <CardHeader>
                <CardTitle className="text-2xl font-bold">Payment History</CardTitle>
                <CardDescription className="text-gray-600">View your transaction history.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length > 0 ? payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{new Date(payment.timestamp).toLocaleDateString()}</TableCell>
                        <TableCell className="capitalize">{payment.plan}</TableCell>
                        <TableCell>${(payment.amount / 100).toFixed(2)}</TableCell>
                        <TableCell className="capitalize">{payment.status}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">No payment history found.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SettingsPage;