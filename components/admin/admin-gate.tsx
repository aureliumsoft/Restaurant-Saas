'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Loader2, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { isPlatformAdminSession } from '@/lib/auth/admin';

export function AdminGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 dark:bg-zinc-950">
        <Loader2 className="h-10 w-10 animate-spin text-fire-500" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-100 p-6 dark:bg-zinc-950">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-fire-500/10">
          <Shield className="h-7 w-7 text-fire-600 dark:text-fire-400" />
        </div>
        <p className="text-muted-foreground">{t('admin.gate.signInPrompt')}</p>
        <Button asChild>
          <Link href="/login?callbackUrl=/admin/dashboard">{t('admin.gate.signIn')}</Link>
        </Button>
      </div>
    );
  }

  if (!isPlatformAdminSession(session.user)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-100 p-6 text-center dark:bg-zinc-950">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-fire-500/10">
          <Shield className="h-7 w-7 text-fire-600 dark:text-fire-400" />
        </div>
        <div className="space-y-2">
          <p className="text-lg font-semibold">{t('admin.gate.accessDenied')}</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {t('admin.gate.accessDeniedHintPrefix')}{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">ADMIN</code>{' '}
            {t('admin.gate.accessDeniedHintOr')}{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">ADMIN_EMAIL</code> /{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">ADMIN_EMAILS</code>{' '}
            {t('admin.gate.accessDeniedHintSuffix')}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/">{t('admin.gate.backToHome')}</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
