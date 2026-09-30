// src/app/login/[token]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { saveUser } from '@/lib/auth';

export default function LoginWithTokenPage() {
  const router = useRouter();
  const params = useParams();
  const [message, setMessage] = useState('Logging in with token...');

  useEffect(() => {
    const loginWithToken = async () => {
      const token = params.token as string;
      if (!token) {
        setMessage('Invalid login link. Missing token.');
        return;
      }

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/login-with-token/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        // FIX: Changed 'res' to 'response'
        const data = await response.json();
        if (response.ok) {
          // Use sessionStorage via saveUser - will auto-logout on tab close
          saveUser({
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email,
            mobile_number: data.mobile_number || '',
            username: data.username || data.email,
            access_token: data.access,
            refresh_token: data.refresh,
            subscription_plan: data.subscription_plan || 'free',
            is_premium_user: data.is_premium_user || false,
          });
          setMessage('Login successful. Redirecting to dashboard...');
          router.push('/dashboard');
        } else {
          setMessage(data.error || 'Login failed. Invalid or expired token.');
        }
      } catch (err) {
        setMessage('An error occurred during login. Please try again.');
      }
    };

    loginWithToken();
  }, [params, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <Card className="w-full max-w-lg bg-white border border-gray-200 rounded-xl shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-gray-900">Login</CardTitle>
          <CardDescription className="text-gray-500">
            {message.includes('Redirecting') ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin inline-block" />
                {message}
              </>
            ) : (
              message
            )}
          </CardDescription>
        </CardHeader>
        {message.includes('successful') && (
            <p className="text-center text-sm text-green-600">You will be redirected shortly.</p>
        )}
      </Card>
    </div>
  );
}
