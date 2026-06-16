'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

function PayPalReturnContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading'
  );
  const [message, setMessage] = useState('Completing PayPal connection…');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const merchantIdInPayPal =
        searchParams.get('merchantIdInPayPal') ??
        searchParams.get('merchantId') ??
        undefined;
      const permissionsGranted =
        searchParams.get('permissionsGranted') === 'true';
      const accountStatus = searchParams.get('accountStatus') ?? undefined;

      try {
        const res = await axios.post('/api/restaurant/paypal/complete', {
          merchantIdInPayPal: merchantIdInPayPal ?? undefined,
          permissionsGranted,
          accountStatus,
        });
        if (cancelled) return;
        const ready = res.data?.data?.paymentsReady === true;
        setStatus('success');
        setMessage(
          ready
            ? 'PayPal is connected. You can now accept online payments.'
            : 'PayPal connection saved. Finish any remaining steps in PayPal if prompted.'
        );
      } catch (e: unknown) {
        if (cancelled) return;
        setStatus('error');
        const err =
          axios.isAxiosError(e) && typeof e.response?.data?.error === 'string'
            ? e.response.data.error
            : 'Could not complete PayPal connection.';
        setMessage(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>PayPal connection</CardTitle>
        <CardDescription>
          {status === 'loading'
            ? 'Please wait while we verify your account.'
            : status === 'success'
              ? 'Setup complete'
              : 'Something went wrong'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 text-center">
        {status === 'loading' ? (
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        ) : status === 'success' ? (
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        ) : (
          <AlertCircle className="h-10 w-10 text-destructive" />
        )}
        <p className="text-sm text-muted-foreground">{message}</p>
        {status !== 'loading' ? (
          <Button
            type="button"
            onClick={() => router.push('/settings?section=payments')}
          >
            Back to payment methods
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function PayPalReturnPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Suspense
        fallback={
          <Card className="w-full max-w-md">
            <CardContent className="flex justify-center py-10">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </CardContent>
          </Card>
        }
      >
        <PayPalReturnContent />
      </Suspense>
    </div>
  );
}
