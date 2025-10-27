'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useParams } from 'next/navigation';

const ActivatePage = () => {
  const params = useParams();
  const [message, setMessage] = useState('Activating your account...');

  useEffect(() => {
    // Access the token directly from the params object
    const { token } = params;
    if (!token) {
      setMessage('Invalid activation link. Missing token.');
      return;
    }

    const activateAccount = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/activate/${token}/`, {
          method: 'GET',
          cache: 'no-store',
        });
        const data = await response.json();
        setMessage(data.message);
      } catch (err) {
        setMessage('Failed to activate account. Please try again or contact support.');
      }
    };
    
    activateAccount();
  }, [params]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <Card className="w-full max-w-lg bg-white border border-gray-200 rounded-xl shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-gray-900">Account Activation</CardTitle>
          <CardDescription className="text-gray-500">{message}</CardDescription>
        </CardHeader>
        <CardContent>
          {message === 'Account activated successfully.' && (
            <p className="text-center text-sm text-green-600">You can now log in to your account.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ActivatePage;