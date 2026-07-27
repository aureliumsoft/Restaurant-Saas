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

type EasypaisaFormState = {
  storeId: string;
  hashKey: string;
  username: string;
  password: string;
  mode: 'sandbox' | 'live';
  hasHashKey: boolean;
  hasPassword: boolean;
  verified: boolean;
};

export default function EasypaisaCredentialsPage() {
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EasypaisaFormState>({
    storeId: '',
    hashKey: '',
    username: '',
    password: '',
    mode: 'sandbox',
    hasHashKey: false,
    hasPassword: false,
    verified: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get<{
          data?: {
            storeId?: string | null;
            username?: string | null;
            mode?: string | null;
            hasHashKey?: boolean;
            hasPassword?: boolean;
            verified?: boolean;
          };
        }>('/api/restaurant/payments/easypaisa');
        const data = res.data?.data;
        if (!cancelled && data) {
          setForm((prev) => ({
            ...prev,
            storeId: data.storeId ?? '',
            username: data.username ?? '',
            mode: data.mode === 'live' ? 'live' : 'sandbox',
            hasHashKey: data.hasHashKey === true,
            hasPassword: data.hasPassword === true,
            verified: data.verified === true,
          }));
          if (data.verified === true) setTestStatus('passed');
        }
      } catch {
        if (!cancelled) toast.error('Could not load Easypaisa settings.');
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
        '/api/restaurant/payments/easypaisa/test',
        {
          storeId: form.storeId,
          hashKey: form.hashKey || undefined,
          username: form.username || null,
          password: form.password || undefined,
          mode: form.mode,
        },
        { validateStatus: (status) => status < 500 }
      );
      if (res.status >= 200 && res.status < 300) {
        setTestStatus('passed');
        setForm((prev) => ({ ...prev, verified: true }));
        toast.success('Easypaisa credentials look valid.');
        return;
      }
      setTestStatus('failed');
      setForm((prev) => ({ ...prev, verified: false }));
      toast.error(
        extractApiErrorFromBody(res.data, 'Easypaisa credential test failed.')
      );
    } catch (e: unknown) {
      setTestStatus('failed');
      setForm((prev) => ({ ...prev, verified: false }));
      toast.error(
        extractApiErrorMessage(e, 'Easypaisa credential test failed.')
      );
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await axios.put('/api/restaurant/payments/easypaisa', {
        storeId: form.storeId,
        hashKey: form.hashKey || undefined,
        username: form.username || null,
        password: form.password || undefined,
        mode: form.mode,
      });
      const data = res.data?.data;
      setForm((prev) => ({
        ...prev,
        hashKey: '',
        password: '',
        hasHashKey: data?.hasHashKey === true,
        hasPassword: data?.hasPassword === true,
        verified: data?.verified === true,
      }));
      setTestStatus('passed');
      toast.success('Easypaisa credentials saved.');
    } catch (e: unknown) {
      setTestStatus('failed');
      setForm((prev) => ({ ...prev, verified: false }));
      toast.error(
        extractApiErrorMessage(e, 'Could not save Easypaisa credentials.')
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm('Remove Easypaisa credentials for this restaurant?')) {
      return;
    }
    try {
      await axios.delete('/api/restaurant/payments/easypaisa');
      setForm({
        storeId: '',
        hashKey: '',
        username: '',
        password: '',
        mode: 'sandbox',
        hasHashKey: false,
        hasPassword: false,
        verified: false,
      });
      setTestStatus('idle');
      toast.success('Easypaisa credentials removed.');
    } catch {
      toast.error('Could not remove Easypaisa credentials.');
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
          <CardTitle>Easypaisa configuration</CardTitle>
          <CardDescription>
            Enter store credentials from your Easypaisa merchant portal.
            Payments go to your Easypaisa merchant account. Currency is PKR.
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
              Validation failed. Check your Easypaisa credentials and try again.
            </p>
          ) : null}

          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Easypaisa expects PKR. Set your restaurant currency to PKR in
            regional settings for correct amounts.
          </p>

          <div className="space-y-2">
            <Label htmlFor="ep-store-id">Store ID</Label>
            <Input
              id="ep-store-id"
              value={form.storeId}
              onChange={(e) => {
                setTestStatus('idle');
                setForm((prev) => ({ ...prev, storeId: e.target.value }));
              }}
              placeholder="Numeric store ID"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ep-hash-key">Hash key</Label>
            <Input
              id="ep-hash-key"
              type="password"
              value={form.hashKey}
              onChange={(e) => {
                setTestStatus('idle');
                setForm((prev) => ({ ...prev, hashKey: e.target.value }));
              }}
              placeholder={
                form.hasHashKey
                  ? 'Leave blank to keep existing hash key'
                  : 'Hash key (required on first save)'
              }
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ep-username">Username (optional)</Label>
            <Input
              id="ep-username"
              value={form.username}
              onChange={(e) => {
                setTestStatus('idle');
                setForm((prev) => ({ ...prev, username: e.target.value }));
              }}
              placeholder="API username if provided"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ep-password">Password (optional)</Label>
            <Input
              id="ep-password"
              type="password"
              value={form.password}
              onChange={(e) => {
                setTestStatus('idle');
                setForm((prev) => ({ ...prev, password: e.target.value }));
              }}
              placeholder={
                form.hasPassword
                  ? 'Leave blank to keep existing password'
                  : 'API password if provided'
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
          {form.hasHashKey ? (
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
