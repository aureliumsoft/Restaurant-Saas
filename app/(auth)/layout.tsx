'use client';

import React, { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

function getErrorMessage(error: string | null | undefined, t: TFunction) {
  if (!error) return null;
  switch (error) {
    case 'CredentialsSignin':
      return t('auth.errors.credentialsSignin');
    case 'OAuthSignin':
      return t('auth.errors.oauthSignin');
    case 'OAuthCallback':
      return t('auth.errors.oauthCallback');
    case 'AccessDenied':
      return t('auth.errors.accessDenied');
    case 'SessionRequired':
      return t('auth.errors.sessionRequired');
    default:
      return error;
  }
}

function AuthErrorToasts({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const lastShownRef = useRef<string | null>(null);

  useEffect(() => {
    const msg = getErrorMessage(error, t);
    if (!msg) return;
    // Helps verify the layout is mounted and `?error=` is being read.
    if (lastShownRef.current === error) return; // avoid double toast in dev
    lastShownRef.current = error;
    toast.error(msg);
  }, [error, t]);

  return <>{children}</>;
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<>{children}</>}>
      <AuthErrorToasts>{children}</AuthErrorToasts>
    </Suspense>
  );
}
