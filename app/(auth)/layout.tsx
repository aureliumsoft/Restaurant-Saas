'use client';

import React, { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'react-toastify';

function getErrorMessage(error?: string | null) {
  if (!error) return null;
  switch (error) {
    case 'CredentialsSignin':
      return 'Invalid email or password.';
    case 'OAuthSignin':
      return 'Google sign-in failed.';
    case 'OAuthCallback':
      return 'Google callback failed.';
    case 'AccessDenied':
      return 'Access denied.';
    case 'SessionRequired':
      return 'Please sign in first.';
    default:
      return error;
  }
}

function AuthErrorToasts({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const lastShownRef = useRef<string | null>(null);

  useEffect(() => {
    const msg = getErrorMessage(error);
    if (!msg) return;
    // Helps verify the layout is mounted and `?error=` is being read.
    if (lastShownRef.current === error) return; // avoid double toast in dev
    lastShownRef.current = error;
    toast.error(msg);
  }, [error]);

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
