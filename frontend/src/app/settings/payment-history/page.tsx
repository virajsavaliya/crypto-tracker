'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Header from '@/components/shared/Header';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getUser, logout, authenticatedFetch } from '@/lib/auth';

interface Payment {
  id: number;
  stripe_charge_id: string;
  amount: number;
  timestamp: string;
  status: string;
  plan: string;
}

const PaymentHistoryPage = () => {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPaymentHistory = async () => {
      setLoading(true);
      
      // Check authentication using centralized auth utility
      const authUser = getUser();
      if (!authUser) {
        logout();
        return;
      }

      try {
        const response = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/payment-history/`);

        if (!response) {
          // authenticatedFetch handles logout on auth errors
          return;
        }

        if (response.ok) {
          const data = await response.json();
          setPayments(data);
        }
      } catch (err) {
        console.error('Error fetching payment history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentHistory();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 p-6">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen p-6 bg-gray-100 font-sans">
      <Header />
      <div className="container mx-auto px-6 py-8 flex-grow">
        <main className="flex-1">
          <Card className="w-full shadow-lg border-gray-200">
            <CardHeader>
              <CardTitle className="text-3xl font-bold">Payment History</CardTitle>
              <CardDescription className="text-gray-600">
                Here is a list of your past payments.
              </CardDescription>
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
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{new Date(payment.timestamp).toLocaleDateString()}</TableCell>
                      <TableCell>{payment.plan}</TableCell>
                      <TableCell>${(payment.amount / 100).toFixed(2)}</TableCell>
                      <TableCell>{payment.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default PaymentHistoryPage;