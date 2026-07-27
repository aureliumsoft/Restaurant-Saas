'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { ArrowLeft, Check, Loader2, Trash2, X } from 'lucide-react';
import { toast } from 'react-toastify';

import {
  extractApiErrorFromBody,
  extractApiErrorMessage,
} from '@/lib/extract-api-error';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

type TestStatus = 'idle' | 'passed' | 'failed';

type JazzCashFormState = {
  merchantId: string;
  password: string;
  integritySalt: string;
  mode: 'sandbox' | 'live';
  hasPassword: boolean;
  hasIntegritySalt: boolean;
  verified: boolean;
};

export default function JazzCashCredentialsPage() {
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<JazzCashFormState>({
    merchantId: '',
    password: '',
    integritySalt: '',
    mode: 'sandbox',
    hasPassword: false,
    hasIntegritySalt: false,
    verified: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get<{
          data?: {
            merchantId?: string | null;
            mode?: string | null;
            hasPassword?: boolean;
            hasIntegritySalt?: boolean;
            verified?: boolean;
          };
        }>('/api/restaurant/payments/jazzcash');
        const data = res.data?.data;
        if (!cancelled && data) {
          setForm((prev) => ({
            ...prev,
            merchantId: data.merchantId ?? '',
            mode: data.mode === 'live' ? 'live' : 'sandbox',
            hasPassword: data.hasPassword === true,
            hasIntegritySalt: data.hasIntegritySalt === true,
            verified: data.verified === true,
          }));
          if (data.verified === true) setTestStatus('passed');
        }
      } catch {
        if (!cancelled) toast.error('Could not load JazzCash settings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleTest() {
    setTesting(true);
    try {
      const res = await axios.post(
        '/api/restaurant/payments/jazzcash/test',
        {
          merchantId: form.merchantId,
          password: form.password || undefined,
          integritySalt: form.integritySalt || undefined,
          mode: form.mode,
        },
        { validateStatus: (status) => status < 500 }
      );
      if (res.status >= 200 && res.status < 300) {
        setTestStatus('passed');
        setForm((prev) => ({ ...prev, verified: true }));
        toast.success('JazzCash credentials look valid.');
        return;
      }
      setTestStatus('failed');
      setForm((prev) => ({ ...prev, verified: false }));
      toast.error(
        extractApiErrorFromBody(res.data, 'JazzCash credential test failed.')
      );
    } catch (e: unknown) {
      setTestStatus('failed');
      setForm((prev) => ({ ...prev, verified: false }));
      toast.error(
        extractApiErrorMessage(e, 'JazzCash credential test failed.')
      );
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await axios.put('/api/restaurant/payments/jazzcash', {
        merchantId: form.merchantId,
        password: form.password || undefined,
        integritySalt: form.integritySalt || undefined,
        mode: form.mode,
      });
      const data = res.data?.data;
      setForm((prev) => ({
        ...prev,
        password: '',
        integritySalt: '',
        hasPassword: data?.hasPassword === true,
        hasIntegritySalt: data?.hasIntegritySalt === true,
        verified: data?.verified === true,
      }));
      setTestStatus('passed');
      toast.success('JazzCash credentials saved.');
    } catch (e: unknown) {
      setTestStatus('failed');
      setForm((prev) => ({ ...prev, verified: false }));
      toast.error(
        extractApiErrorMessage(e, 'Could not save JazzCash credentials.')
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm('Remove JazzCash credentials for this restaurant?')) {
      return;
    }
    try {
      await axios.delete('/api/restaurant/payments/jazzcash');
      setForm({
        merchantId: '',
        password: '',
        integritySalt: '',
        mode: 'sandbox',
        hasPassword: false,
        hasIntegritySalt: false,
        verified: false,
      });
      setTestStatus('idle');
      toast.success('JazzCash credentials removed.');
    } catch {
      toast.error('Could not remove JazzCash credentials.');
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <Button type="button" variant="ghost" className="gap-2" asChild>
        <Link href="/settings?section=payments">
          <ArrowLeft className="h-4 w-4" />
          Back to payment methods
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>JazzCash configuration</CardTitle>
          <CardDescription>
            Enter merchant credentials from your JazzCash merchant portal.
            Payments go to your JazzCash merchant account. Currency is PKR.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.verified && testStatus !== 'failed' ? (
            <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
              Credentials verified and saved.
            </p>
          ) : null}

          {testStatus === 'failed' ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
              Validation failed. Check your JazzCash credentials and try again.
            </p>
          ) : null}

          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            JazzCash expects PKR. Set your restaurant currency to PKR in
            regional settings for correct amounts.
          </p>

          <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
            In the JazzCash Credential Generator, set Return URL to your full
            public callback URL, for example{' '}
            <span className="font-mono">
              https://foodluk.com/api/jazzcash/return
            </span>
            . Do not use only{' '}
            <span className="font-mono">foodluk.com</span>. For local
            development, also set{' '}
            <span className="font-mono">JAZZCASH_RETURN_URL</span> in{' '}
            <span className="font-mono">.env</span> to the same public URL.
          </p>

          <div className="space-y-2">
            <Label htmlFor="jc-merchant-id">Merchant ID</Label>
            <Input
              id="jc-merchant-id"
              value={form.merchantId}
              onChange={(e) => {
                setTestStatus('idle');
                setForm((prev) => ({ ...prev, merchantId: e.target.value }));
              }}
              placeholder="MC…"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="jc-password">Password</Label>
            <Input
              id="jc-password"
              type="text"
              value={form.password}
              onChange={(e) => {
                setTestStatus('idle');
                setForm((prev) => ({ ...prev, password: e.target.value }));
              }}
              placeholder={
                form.hasPassword
                  ? 'Leave blank to keep existing password'
                  : 'Merchant password (required on first save)'
              }
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="jc-salt">Integrity salt</Label>
            <Input
              id="jc-salt"
              type="text"
              value={form.integritySalt}
              onChange={(e) => {
                setTestStatus('idle');
                setForm((prev) => ({
                  ...prev,
                  integritySalt: e.target.value,
                }));
              }}
              placeholder={
                form.hasIntegritySalt
                  ? 'Leave blank to keep existing salt'
                  : 'Integrity salt (required on first save)'
              }
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-2">
            <Label>Mode</Label>
            <Select
              value={form.mode}
              onValueChange={(value: 'sandbox' | 'live') => {
                setTestStatus('idle');
                setForm((prev) => ({ ...prev, mode: value }));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox</SelectItem>
                <SelectItem value="live">Live</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleTest}
            disabled={testing || testStatus === 'passed'}
            className={
              testStatus === 'passed'
                ? 'border-green-600 text-green-700 hover:bg-green-50 hover:text-green-800 disabled:opacity-100'
                : testStatus === 'failed'
                  ? 'border-red-600 text-red-700 hover:bg-red-50 hover:text-red-800'
                  : undefined
            }
          >
            {testing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : testStatus === 'passed' ? (
              <Check className="mr-2 h-4 w-4" aria-hidden />
            ) : testStatus === 'failed' ? (
              <X className="mr-2 h-4 w-4" aria-hidden />
            ) : null}
            {testStatus === 'passed'
              ? 'Credentials verified'
              : testStatus === 'failed'
                ? 'Validation failed'
                : 'Test credentials'}
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save credentials
          </Button>
          {form.hasPassword ? (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDisconnect}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Disconnect
            </Button>
          ) : null}
        </CardFooter>
      </Card>
    </div>
  );
}
