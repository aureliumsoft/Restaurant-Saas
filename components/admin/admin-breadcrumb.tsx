'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import { adminNavTitleForPath } from '@/constant/adminNav';
import { cn } from '@/lib/utils';

export function AdminBreadcrumb({ className }: { className?: string }) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const pageTitleKey = adminNavTitleForPath(pathname ?? '');

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex min-w-0 flex-1 items-center gap-1.5 text-sm', className)}
    >
      <Link
        href="/admin/dashboard"
        className={cn(
          'shrink-0 rounded-lg px-2.5 py-1 text-muted-foreground transition-colors hover:bg-white/60 hover:text-foreground dark:hover:bg-white/10',
          !pageTitleKey &&
            'bg-fire-500/10 font-semibold text-fire-700 dark:text-fire-300'
        )}
      >
        {t('admin.nav.home')}
      </Link>
      {pageTitleKey ? (
        <>
          <span className="text-muted-foreground/40" aria-hidden>
            /
          </span>
          <span className="truncate rounded-lg bg-fire-500/10 px-2.5 py-1 font-semibold text-fire-700 dark:text-fire-300">
            {t(pageTitleKey)}
          </span>
        </>
      ) : null}
    </nav>
  );
}
