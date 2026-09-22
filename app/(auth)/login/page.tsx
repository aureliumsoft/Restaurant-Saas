/* eslint-disable react/no-unescaped-entities */
'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { getSession, useSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PublicAuthShell } from '@/components/marketing/public-auth-shell';
import { IconBrandGoogleFilled } from '@tabler/icons-react';
import { isPlatformAdminSession } from '@/lib/auth/admin';
import { useTranslation } from 'react-i18next';

function safeCallbackUrl(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
    return '/dashboard';
  }
  return raw;
}

function roleDefaultPath(
  user:
    | {
        role?: string | null;
        roleName?: string | null;
        isPlatformAdmin?: boolean;
      }
    | undefined,
  roleName: string | null | undefined,
  legacyRole: string | null | undefined
): string {
  if (isPlatformAdminSession(user)) return '/admin/dashboard';
  const normalizedName = (roleName ?? '').trim().toLowerCase();
  if (normalizedName === 'user') return '/';
  if (legacyRole === 'USER') return '/';
  return '/dashboard';
}

/**
 * Where to send the user after sign-in.
 * Platform admins (`ADMIN_EMAIL` / etc., or JWT `role === ADMIN`) go to SaaS admin.
 * All other users go directly to dashboard where role is checked for content display.
 */
function postLoginPath(
  user:
    | {
        email?: string | null;
        roleId?: string | null;
        roleName?: string | null;
        role?: string | null;
        isPlatformAdmin?: boolean;
      }
    | undefined,
  hasExplicitCallback: boolean,
  callbackUrl: string
): string {
  if (hasExplicitCallback) return callbackUrl;

  return roleDefaultPath(user, user?.roleName, user?.role);
}

function LoginForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrlParam = searchParams.get('callbackUrl');
  const callbackUrl = safeCallbackUrl(callbackUrlParam);
  const hasExplicitCallback = Boolean(callbackUrlParam);
  const { data: session, status } = useSession();
  const targetAfterLogin = postLoginPath(
    session?.user,
    hasExplicitCallback,
    callbackUrl
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(targetAfterLogin);
    }
  }, [status, router, targetAfterLogin]);

  async function handleGoogle() {
    setLoadingGoogle(true);
    try {
      await signIn('google', {
        // Return to login so session-aware role routing can run consistently.
        // Explicit callback URLs are still honored when present.
        callbackUrl: hasExplicitCallback ? callbackUrl : '/login',
      });
    } catch (e: any) {
      toast.error(e?.message ?? t('auth.login.googleFailed'));
    } finally {
      setLoadingGoogle(false);
    }
  }

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error(t('auth.login.emailRequired'));
      return;
    }
    if (!password) {
      toast.error(t('auth.login.passwordRequired'));
      return;
    }

    setLoading(true);
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (!result?.ok) {
        const err = (result as any)?.error;
        const statusCode = (result as any)?.status;

        toast.error(
          err === 'CredentialsSignin'
            ? t('auth.login.invalidCredentials')
            : err === 'AccessDenied'
              ? t('auth.login.accessDenied')
              : err
                ? t('auth.login.failedWithError', { error: String(err) })
                : statusCode === 401
                  ? t('auth.login.unauthorized')
                  : t('auth.login.failed')
        );
        return;
      }
      const fresh = await getSession();
      const nextPath = postLoginPath(
        fresh?.user,
        hasExplicitCallback,
        callbackUrl
      );
      router.push(nextPath);
    } catch (e: any) {
      toast.error(e?.message ?? t('auth.login.serverError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicAuthShell
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
    >
      <div className="flex flex-col gap-2">
        <Button
          onClick={handleGoogle}
          disabled={loadingGoogle || loading}
          variant="secondary"
        >
          {loadingGoogle ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />{' '}
              <span>{t('auth.loading')}</span>
            </>
          ) : (
            <>
              <IconBrandGoogleFilled className="mr-1 h-4 w-4" />{' '}
              {t('auth.login.continueGoogle')}
            </>
          )}
        </Button>
      </div>

      <div className="flex flex-row gap-2 items-center">
        <div className="my-6 border-t flex-1" />
        <div className="text-center text-sm text-muted-foreground">
          {t('auth.or')}
        </div>
        <div className="my-6 border-t flex-1" />
      </div>
      <form onSubmit={handleCredentials} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{t('auth.email')}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">{t('auth.password')}</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="pr-10"
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground"
              aria-label={
                showPassword
                  ? t('auth.login.hidePassword')
                  : t('auth.login.showPassword')
              }
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
            </Button>
          </div>
        </div>

        <Button
          disabled={loading || loadingGoogle}
          type="submit"
          className="h-11 w-full bg-gradient-to-r from-fire-500 via-fire-600 to-fire-500 text-white shadow-[0_16px_34px_-14px] shadow-fire-500/70 hover:from-fire-400 hover:to-fire-500"
        >
          {' '}
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />{' '}
              <span>{t('auth.login.signingIn')}</span>
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4 mr-2" />{' '}
              <span>{t('auth.login.submit')}</span>
            </>
          )}
        </Button>

        <div className="flex items-center justify-between text-sm">
          <Link className="text-primary underline" href="/reset-password">
            {t('auth.login.forgotPassword')}
          </Link>
          <Link className="text-primary underline" href="/register">
            {t('auth.login.createAccount')}
          </Link>
        </div>
      </form>
    </PublicAuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-white dark:bg-black">
          <p className="text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary mx-auto" />
          </p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
