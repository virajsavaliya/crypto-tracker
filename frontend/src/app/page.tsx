// src/app/page.tsx
'use client';
import { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, TrendingUp, Bell, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRouter, useSearchParams } from 'next/navigation';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, provider } from '@/lib/firebaseConfig';
import { saveUser } from '@/lib/auth';
import { getApiEndpoint } from '@/lib/config';



// Define the schema for the login form fields.
const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
});

// Define the schema for the registration form fields.
const registerSchema = z.object({
  first_name: z.string().min(1, { message: 'First name is required.' }),
  last_name: z.string().min(1, { message: 'Last name is required.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  mobile_number: z.string().min(5, { message: 'Mobile number is too short.' }),
});

// Component to handle session expired message
function SessionExpiredMessage() {
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const sessionExpired = searchParams.get('session');
    if (sessionExpired === 'expired') {
      setLoginMessage('⏱️ Your session expired due to 2 minutes of inactivity. Please login again.');
    }
  }, [searchParams]);

  if (!loginMessage) return null;

  return (
    <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <p className="text-yellow-800 text-sm">{loginMessage}</p>
    </div>
  );
}

export default function App() {
  const [registerMessage, setRegisterMessage] = useState<string | null>(null);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const router = useRouter();

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
    },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      mobile_number: '',
    },
  });

  const onLoginSubmit = async (data: z.infer<typeof loginSchema>) => {
    setIsLoggingIn(true);
    setLoginMessage(null);
    try {
      const response = await fetch(getApiEndpoint('/api/request-login-token/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: data.email }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to send login link.' }));
        setLoginMessage(errorData.error || 'Failed to send login link.');
        return;
      }

      const responseData = await response.json();
      setLoginMessage(responseData.message || 'Login link sent! Check your email.');
    } catch (err) {
      console.error('Login error:', err);
      setLoginMessage('Network error. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const onRegisterSubmit = async (data: z.infer<typeof registerSchema>) => {
    setIsRegistering(true);
    setRegisterMessage(null);
    try {
      const response = await fetch(getApiEndpoint('/api/register/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const fieldErrors = responseData.errors || responseData;
        const flattenedErrors = Object.entries(fieldErrors)
          .flatMap(([field, value]) => {
            if (Array.isArray(value)) {
              return value.map((message) => `${field}: ${message}`);
            }
            return [`${field}: ${String(value)}`];
          })
          .join(' | ');
        setRegisterMessage(flattenedErrors || responseData.message || 'Registration failed.');
      } else {
        setRegisterMessage(responseData.message);
        registerForm.reset();
      }
    } catch (err) {
      setRegisterMessage('Network error. Please try again.');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      // Sign out any existing user to ensure a clean state
      await signOut(auth);

      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const idToken = await user.getIdToken();

      const [firstName, ...lastNameParts] = user.displayName ? user.displayName.split(' ') : ['', ''];
      const lastName = lastNameParts.join(' ');

      // Send the ID token to your Django backend
      const response = await fetch(getApiEndpoint('/api/google-login/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          email: user.email,
          first_name: firstName,
          last_name: lastName,
        }),
      });

      const responseData = await response.json();

      if (response.ok) {
        // Use sessionStorage via saveUser - will auto-logout on tab close
        saveUser({
          ...responseData,
          access_token: responseData.access,
          refresh_token: responseData.refresh,
          subscription_plan: responseData.subscription_plan || 'free',
          is_premium_user: responseData.is_premium_user || false,
        });
        router.push('/dashboard');
      } else {
        setLoginMessage(responseData.error || responseData.message || 'Google login failed.');
      }

    } catch (err) {
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 text-gray-900 font-sans p-3 sm:p-6 relative">
      {/* Background Gradients and Shapes */}
      <div className="absolute inset-0 bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-48 h-48 sm:w-96 sm:h-96 bg-gradient-to-br from-green-300 to-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-1/2 left-3/4 w-40 h-40 sm:w-80 sm:h-80 bg-gradient-to-br from-indigo-300 to-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-1/4 left-1/2 w-36 h-36 sm:w-72 sm:h-72 bg-gradient-to-br from-cyan-300 to-emerald-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 w-full max-w-6xl flex flex-col lg:flex-row bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden">
        {/* Left Column - Marketing Content */}
        <div className="w-full lg:w-1/2 p-6 sm:p-8 md:p-12 lg:p-16 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 sm:space-x-3 mb-4 sm:mb-6">
              <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Volume Tracker</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight text-gray-900 dark:text-white mb-3 sm:mb-4">
              Track the market. <br className="hidden sm:block" />Trade with confidence.
            </h1>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-sm mt-2 sm:mt-4">
              Join millions of traders worldwide and get real-time price updates, alerts, and market insights.
            </p>
            
            {/* Session Expired Message */}
            <div className="mt-4 sm:mt-6">
              <Suspense fallback={null}>
                <SessionExpiredMessage />
              </Suspense>
            </div>
          </div>
        </div>

        {/* Right Column - Login/Register Form */}
        <div className="w-full lg:w-1/2 p-4 sm:p-6 md:p-8 lg:p-12 bg-white dark:bg-gray-900">
          <Card className="shadow-none border-none bg-transparent">
            <CardHeader className="text-center px-2 sm:px-6">
              <CardTitle className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                Access Your Account
              </CardTitle>
              <CardDescription className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
                Login or Register to continue.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-4 sm:mb-6">
                  <TabsTrigger value="login" className="text-sm sm:text-base text-gray-700 dark:text-gray-300 data-[state=active]:bg-white data-[state=active]:dark:bg-gray-700 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg transition-all duration-200">Login</TabsTrigger>
                  <TabsTrigger value="register" className="text-sm sm:text-base text-gray-700 dark:text-gray-300 data-[state=active]:bg-white data-[state=active]:dark:bg-gray-700 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg transition-all duration-200">Register</TabsTrigger>
                </TabsList>
                <TabsContent value="register" className="mt-2 sm:mt-4">
                  <Button
                    variant="outline"
                    onClick={handleGoogleLogin}
                    className="w-full text-sm sm:text-base text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Image src="/google-favicon.png" alt="Google logo" width={16} height={16} className="mr-2" /> Register with Google
                  </Button>
                  <div className="relative my-4 sm:my-6">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-gray-300 dark:border-gray-600" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white dark:bg-gray-900 px-2 text-gray-500 dark:text-gray-400">Or continue with</span>
                    </div>
                  </div>
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-3 sm:space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <FormField
                          control={registerForm.control}
                          name="first_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-600 dark:text-gray-400">First Name</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                                  <Input placeholder="John" {...field} className="pl-10 bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl" />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="last_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-600 dark:text-gray-400">Last Name</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                                  <Input placeholder="Doe" {...field} className="pl-10 bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl" />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={registerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-600 dark:text-gray-400">Email</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Bell className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                                <Input type="email" placeholder="john.doe@example.com" {...field} className="pl-10 bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="mobile_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-600 dark:text-gray-400">Mobile Number</FormLabel>
                            <FormControl>
                              <PhoneInput
                                country={'us'}
                                value={field.value}
                                onChange={field.onChange}
                                inputStyle={{
                                  width: '100%',
                                  backgroundColor: 'transparent',
                                  borderColor: 'transparent',
                                  color: '#111827',
                                  borderRadius: '0.75rem',
                                  boxShadow: 'none',
                                  paddingTop: '0.5rem',
                                  paddingBottom: '0.5rem',
                                  paddingLeft: '60px',
                                }}
                                containerStyle={{
                                  backgroundColor: '#f9fafb',
                                  borderColor: '#d1d5db',
                                  borderRadius: '0.75rem',
                                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                                }}
                                buttonStyle={{
                                  backgroundColor: 'transparent',
                                  borderColor: 'transparent',
                                  borderRadius: '0.75rem 0 0 0.75rem',
                                  padding: '0.5rem',
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold transition-colors" disabled={isRegistering}>
                        {isRegistering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Create Account
                      </Button>
                      {registerMessage && (
                        <div className="mt-4 text-center text-sm font-medium text-green-600">
                          {registerMessage}
                        </div>
                      )}
                    </form>
                  </Form>
                </TabsContent>
                <TabsContent value="login" className="mt-2 sm:mt-4">
                  <Button
                    variant="outline"
                    onClick={handleGoogleLogin}
                    className="w-full text-sm sm:text-base text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Image src="/google-favicon.png" alt="Google logo" width={16} height={16} className="mr-2 h-4 w-4" /> Login with Google
                  </Button>
                  <div className="relative my-4 sm:my-6">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-gray-300 dark:border-gray-600" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white dark:bg-gray-900 px-2 text-gray-500 dark:text-gray-400">Or continue with</span>
                    </div>
                  </div>
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-3 sm:space-y-4">
                      <FormField
                        control={loginForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-600 dark:text-gray-400">Email</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Bell className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                                <Input placeholder="john.doe@example.com" {...field} className="pl-10 bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold transition-colors" disabled={isLoggingIn}>
                        {isLoggingIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Email me a login link
                      </Button>
                      {loginMessage && (
                        <div className="mt-4 text-center text-sm font-medium text-green-600">
                          {loginMessage}
                        </div>
                      )}
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}