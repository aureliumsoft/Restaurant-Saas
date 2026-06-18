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
      className={cn('flex min-w-0 items-center gap-2 text-sm', className)}
    >
      <Link
        href="/admin/dashboard"
        className={cn(
          'shrink-0 rounded-lg px-2.5 py-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground',
          !pageTitle && 'bg-muted/50 font-medium text-foreground'
        )}
      >
        Admin
      </Link>
      {pageTitle ? (
        <span className="truncate rounded-lg bg-muted/50 px-2.5 py-1 font-medium text-foreground">
          {pageTitle}
        </span>
      ) : null}
    </nav>
  );
}
