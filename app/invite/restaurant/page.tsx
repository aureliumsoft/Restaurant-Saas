'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Check, Loader2, LogOut } from 'lucide-react';

type VerifyPayload = {
  restaurantName: string;
  roleName: string;
  email: string;
};

function InviteRestaurantContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();
  const { data: session, status } = useSession();

  const [verify, setVerify] = useState<VerifyPayload | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerifyError(t('inviteRestaurant.missingLink'));
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/restaurant/invites/verify?token=${encodeURIComponent(token)}`
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) {
            setVerifyError(
              typeof data?.error === 'string'
                ? data.error
                : t('inviteRestaurant.invalidInvitation')
            );
          }
          return;
        }
        if (!cancelled) {
          setVerify({
            restaurantName: data.restaurantName,
            roleName: data.roleName,
            email: data.email,
          });
        }
      } catch {
        if (!cancelled) {
          setVerifyError(t('inviteRestaurant.loadFailed'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  async function accept() {
    if (!token) return;
    setAccepting(true);
    try {
      const res = await fetch('/api/restaurant/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          typeof data?.error === 'string'
            ? data.error
            : t('inviteRestaurant.acceptFailed')
        );
        return;
      }
      toast.success(t('inviteRestaurant.joined'));
      router.push('/dashboard');
    } catch {
      toast.error(t('inviteRestaurant.acceptFailed'));
    } finally {
      setAccepting(false);
    }
  }

  const sessionEmail =
    session?.user && 'email' in session.user
      ? ((session.user as { email?: string | null }).email ?? null)
      : null;

  const emailMatches =
    verify &&
    sessionEmail &&
    sessionEmail.toLowerCase() === verify.email.toLowerCase();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
        <Loader2 className="text-primary animate-spin text-center mx-auto w-10 h-10" />
      </main>
    );
  }

  if (verifyError || !verify || !token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
        <div className="max-w-md rounded-lg border bg-card p-6 shadow-sm">
          <h1 className="text-lg font-semibold">{t('inviteRestaurant.unavailableTitle')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {verifyError ??
              (!token
                ? t('inviteRestaurant.openFromEmail')
                : t('inviteRestaurant.couldNotLoad'))}
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/login">{t('inviteRestaurant.backToSignIn')}</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <div className="max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-lg font-semibold">
          {t('inviteRestaurant.joinTitle', { restaurantName: verify.restaurantName })}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('inviteRestaurant.invitedAs', {
            roleName: verify.roleName,
            email: verify.email,
          })}
        </p>

        {status === 'loading' ? (
          <Loader2 className="text-primary animate-spin text-center mx-auto w-10 h-10" />
        ) : status === 'unauthenticated' ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('inviteRestaurant.signInToAccept')}
            </p>
            <Button asChild className="w-full">
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(
                  `/invite/restaurant?token=${encodeURIComponent(token)}`
                )}`}
              >
                {t('inviteRestaurant.signIn')}
              </Link>
            </Button>
          </div>
        ) : !emailMatches ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {t('inviteRestaurant.signedInAs', {
                sessionEmail,
                email: verify.email,
              })}
            </p>
            <Button
              variant="outline"
              type="button"
              onClick={() => void signOut({ callbackUrl: '/login' })}
            >
              <>
                <LogOut className="h-4 w-4 mr-2" />
                <span>{t('inviteRestaurant.signOut')}</span>
              </>
            </Button>
          </div>
        ) : (
          <Button
            className="mt-4 w-full text-white"
            disabled={accepting}
            onClick={() => void accept()}
          >
            {accepting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('inviteRestaurant.accepting')}
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                <span>{t('inviteRestaurant.acceptInvitation')}</span>
              </>
            )}
          </Button>
        )}
      </div>
    </main>
  );
}

export default function InviteRestaurantPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
        </main>
      }
    >
      <InviteRestaurantContent />
    </Suspense>
  );
}
