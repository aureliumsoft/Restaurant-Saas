'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { adminNavTitleForPath } from '@/constant/adminNav';
import { cn } from '@/lib/utils';

export function AdminBreadcrumb({ className }: { className?: string }) {
  const pathname = usePathname();
  const pageTitle = adminNavTitleForPath(pathname ?? '');

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex min-w-0 flex-1 items-center gap-1.5 text-sm', className)}
    >
      <Link
        href="/admin/dashboard"
        className={cn(
          'shrink-0 rounded-lg px-2.5 py-1 text-muted-foreground transition-colors hover:bg-white/60 hover:text-foreground dark:hover:bg-white/10',
          !pageTitle &&
            'bg-fire-500/10 font-semibold text-fire-700 dark:text-fire-300'
        )}
      >
        Admin
      </Link>
      {pageTitle ? (
        <>
          <span className="text-muted-foreground/40" aria-hidden>
            /
          </span>
          <span className="truncate rounded-lg bg-fire-500/10 px-2.5 py-1 font-semibold text-fire-700 dark:text-fire-300">
            {pageTitle}
          </span>
        </>
      ) : null}
    </nav>
  );
}
