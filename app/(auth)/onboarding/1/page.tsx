'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setOnboardingRestaurantId } from '@/lib/onboarding/storage';
import { OnboardingSteps } from '../OnboardingSteps';

export default function OnboardingStep1Page() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: session, status } = useSession();

  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      const role = (session?.user as { role?: string })?.role;
      if (role && role !== 'OWNER') {
        toast.error(t('onboarding.step1.ownersOnly'));
        router.replace('/home');
      }
    }
  }, [status, session, router, t]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/step1', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          subdomain: subdomain.trim().toLowerCase(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          typeof data?.error === 'string'
            ? data.error
            : data?.error?.fieldErrors
              ? t('onboarding.step1.checkInputs')
              : t('onboarding.step1.saveFailed')
        );
        return;
      }
      const id = data?.restaurant?.id as string | undefined;
      if (id) setOnboardingRestaurantId(id);
      toast.success(t('onboarding.step1.created'));
      router.push('/onboarding/2');
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : t('onboarding.step1.requestFailed')
      );
    } finally {
      setLoading(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center rounded-lg border bg-background p-6 text-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-background p-6 shadow-sm">
      <OnboardingSteps active={1} />
      <h1 className="mb-1 text-xl font-semibold">
        {t('onboarding.step1.title')}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {t('onboarding.step1.description')}
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">{t('onboarding.step1.nameLabel')}</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('onboarding.step1.namePlaceholder')}
            required
            minLength={2}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="subdomain">
            {t('onboarding.step1.subdomainLabel')}
          </Label>
          <Input
            id="subdomain"
            value={subdomain}
            onChange={(e) =>
              setSubdomain(
                e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
              )
            }
            placeholder={t('onboarding.step1.subdomainPlaceholder')}
            required
            minLength={2}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          />
          <p className="text-xs text-muted-foreground">
            {t('onboarding.step1.subdomainHint')}
          </p>
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span>{t('onboarding.step1.creating')}</span>
            </>
          ) : (
            <>
              <span>{t('onboarding.step1.continue')}</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
