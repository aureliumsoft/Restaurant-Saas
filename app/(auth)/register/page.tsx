/* eslint-disable react/no-unescaped-entities */
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PublicAuthShell } from '@/components/marketing/public-auth-shell';
import { IconBrandGoogleFilled } from '@tabler/icons-react';
import { Loader2, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

function loginAfterSignupErrorMessage(
  err: string | undefined,
  statusCode: number | undefined,
  t: TFunction
): string {
  if (err === 'CredentialsSignin') return t('auth.register.loginAfterSignupFailed');
  if (err === 'AccessDenied') return t('auth.errors.accessDenied');
  if (err) return t('auth.login.failedWithError', { error: String(err) });
  if (statusCode === 401) return t('auth.login.unauthorized');
  return t('auth.login.failed');
}

export default function RegisterPage() {
  const { t } = useTranslation();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [subdomainError, setSubdomainError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    const webAddress = subdomain.trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(webAddress)) {
      setSubdomainError(t('auth.register.webAddressInvalid'));
      return;
    }
    setSubdomainError('');

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          restaurantName,
          subdomain: webAddress,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = data?.error;

        const msg =
          typeof err === 'string'
            ? err
            : Array.isArray(err?.formErrors) && err.formErrors.length
              ? err.formErrors[0]
              : err?.fieldErrors && typeof err.fieldErrors === 'object'
                ? Object.values(err.fieldErrors)
                    .flat()
                    .filter((x) => typeof x === 'string' && x.length > 0)[0]
                : null;

        const message = msg ?? t('auth.register.signupFailed');
        if (res.status === 409 && /web address|domain/i.test(String(message))) {
          setSubdomainError(String(message));
        } else {
          toast.error(message);
        }
        return;
      }

      const login = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (!login?.ok) {
        const err = (login as any)?.error;
        const status = (login as any)?.status;

        toast.error(loginAfterSignupErrorMessage(err, status, t));
        return;
      }

      toast.success(t('auth.register.signupSuccess'));
      router.push('/dashboard');
    } catch (e: any) {
      toast.error(e?.message ?? t('auth.register.signupFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignup() {
    setLoadingGoogle(true);
    try {
      await signIn('google', { callbackUrl: '/role?role=OWNER' });
    } catch (e: any) {
      toast.error(e?.message ?? t('auth.register.googleFailed'));
    } finally {
      setLoadingGoogle(false);
    }
  }

  return (
    <PublicAuthShell
      title={t('auth.register.title')}
      subtitle={t('auth.register.subtitle')}
    >
      <div className="mb-6 rounded-xl border border-fire-500/30 bg-fire-500/10 px-3 py-2 text-center text-xs font-medium text-fire-200">
        {t('auth.register.banner')}
      </div>

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          onClick={() => void handleGoogleSignup()}
          disabled={loadingGoogle || loading}
          variant="secondary"
        >
          {loadingGoogle ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span>{t('auth.loading')}</span>
            </>
          ) : (
            <>
              <IconBrandGoogleFilled className="mr-1 h-4 w-4" />{' '}
              {t('auth.register.continueGoogle')}
            </>
          )}
        </Button>
        
      </div>

      <div className="flex flex-row items-center gap-2">
        <div className="my-6 flex-1 border-t" />
        <div className="text-center text-sm text-muted-foreground">
          {t('auth.or')}
        </div>
        <div className="my-6 flex-1 border-t" />
      </div>

      <form onSubmit={handleEmailSignup} className="space-y-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name" className="text-zinc-800 dark:text-zinc-200">
            {t('auth.register.fullName')}
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
            className="h-11 border-zinc-300/80 bg-white/90 text-zinc-900 placeholder:text-zinc-500 focus-visible:border-fire-500 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email" className="text-zinc-800 dark:text-zinc-200">
              {t('auth.email')}
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="h-11 border-zinc-300/80 bg-white/90 text-zinc-900 placeholder:text-zinc-500 focus-visible:border-fire-500 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password" className="text-zinc-800 dark:text-zinc-200">
              {t('auth.password')}
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              className="h-11 border-zinc-300/80 bg-white/90 text-zinc-900 placeholder:text-zinc-500 focus-visible:border-fire-500 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="restaurant" className="text-zinc-800 dark:text-zinc-200">
            {t('auth.register.restaurantName')}
          </Label>
          <Input
            id="restaurant"
            value={restaurantName}
            onChange={(e) => setRestaurantName(e.target.value)}
            autoComplete="organization"
            required
            className="h-11 border-zinc-300/80 bg-white/90 text-zinc-900 placeholder:text-zinc-500 focus-visible:border-fire-500 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="subdomain" className="text-zinc-800 dark:text-zinc-200">
            {t('auth.register.webAddress')}
          </Label>
          <Input
            id="subdomain"
            value={subdomain}
            onChange={(e) => {
              setSubdomain(e.target.value.toLowerCase());
              setSubdomainError('');
            }}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            aria-invalid={Boolean(subdomainError)}
            placeholder={t('auth.register.webAddressPlaceholder')}
            className="h-11 border-zinc-300/80 bg-white/90 text-zinc-900 placeholder:text-zinc-500 focus-visible:border-fire-500 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100"
          />
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            {t('auth.register.webAddressHint')}
          </p>
          {subdomainError ? (
            <p className="text-sm text-destructive">{subdomainError}</p>
          ) : null}
        </div>

        <Button
          disabled={loading || loadingGoogle}
          type="submit"
          className="h-11 w-full bg-gradient-to-r from-fire-500 via-fire-600 to-fire-500 text-white shadow-[0_16px_34px_-14px] shadow-fire-500/70 hover:from-fire-400 hover:to-fire-500"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />{' '}
              <span>{t('auth.register.creating')}</span>
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4 mr-2" />{' '}
              <span>{t('auth.register.submit')}</span>
            </>
          )}
        </Button>

        <div className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          {t('auth.register.alreadyHaveAccount')}{' '}
          <Link
            className="font-medium text-fire-600 underline decoration-fire-500/60 underline-offset-4 hover:text-fire-500 dark:text-fire-400"
            href="/login"
          >
            {t('auth.register.signIn')}
          </Link>
        </div>
      </form>
    </PublicAuthShell>
  );
}
