/* eslint-disable react/no-unescaped-entities */
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PublicAuthShell } from '@/components/marketing/public-auth-shell';
import { REGISTER_ROLE_SLUG } from '@/lib/global-roles';
import { IconBrandGoogleFilled } from '@tabler/icons-react';
import { Loader2, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

type GoogleSignupRole = 'OWNER' | 'WORKER';

type RegisterRoleOption = {
  id: string;
  name: string;
  slug: string | null;
};

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
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [registerRoles, setRegisterRoles] = useState<RegisterRoleOption[]>(
    []
  );
  const [rolesLoading, setRolesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/register-roles');
        const data = await res.json().catch(() => ({}));
        const roles: RegisterRoleOption[] = Array.isArray(data?.roles)
          ? data.roles
          : [];
        if (!cancelled) {
          setRegisterRoles(roles);
          if (roles.length > 0) {
            setRoleId((prev) => prev || roles[0].id);
          }
        }
      } catch {
        if (!cancelled) {
          toast.error(t('auth.register.rolesLoadFailed'));
        }
      } finally {
        if (!cancelled) {
          setRolesLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, email, password, roleId }),
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

        toast.error(msg ?? t('auth.register.signupFailed'));
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
      const slug = registerRoles.find((r) => r.id === roleId)?.slug;
      if (slug === REGISTER_ROLE_SLUG.OWNER) {
        router.push('/onboarding/1');
      } else {
        router.push('/dashboard');
      }
    } catch (e: any) {
      toast.error(e?.message ?? t('auth.register.signupFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignup(targetRole: GoogleSignupRole) {
    setLoadingGoogle(true);
    try {
      await signIn('google', { callbackUrl: `/role?role=${targetRole}` });
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
          onClick={() => {
            const selected = registerRoles.find((r) => r.id === roleId);
            const targetRole: GoogleSignupRole =
              selected?.slug === REGISTER_ROLE_SLUG.OWNER ? 'OWNER' : 'WORKER';
            void handleGoogleSignup(targetRole);
          }}
          disabled={loadingGoogle || loading || rolesLoading || registerRoles.length === 0}
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
        <p className="text-center text-xs text-zinc-600 dark:text-zinc-400">
          {t('auth.register.googleRoleHint')}
        </p>
      </div>

      <div className="flex flex-row items-center gap-2">
        <div className="my-6 flex-1 border-t" />
        <div className="text-center text-sm text-muted-foreground">
          {t('auth.or')}
        </div>
        <div className="my-6 flex-1 border-t" />
      </div>

      <form onSubmit={handleEmailSignup} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
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

          <div className="flex flex-col gap-2">
            <Label htmlFor="username" className="text-zinc-800 dark:text-zinc-200">
              {t('auth.register.username')}
            </Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="h-11 border-zinc-300/80 bg-white/90 text-zinc-900 placeholder:text-zinc-500 focus-visible:border-fire-500 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100"
            />
          </div>
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
          <Label htmlFor="role" className="text-zinc-800 dark:text-zinc-200">
            {t('auth.register.role')}
          </Label>
          <select
            id="role"
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className="h-11 w-full rounded-md border border-zinc-300/80 bg-white/90 px-3 text-sm text-zinc-900 shadow-sm outline-none ring-0 focus:border-fire-500 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100"
            required
            disabled={rolesLoading || registerRoles.length === 0}
          >
            {registerRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          {!rolesLoading && registerRoles.length === 0 ? (
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {t('auth.register.noRolesHint')}
            </p>
          ) : null}
        </div>

        <Button
          disabled={loading || loadingGoogle || rolesLoading || registerRoles.length === 0}
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
