'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ADMIN_NAV_GROUPS } from '@/constant/adminNav';
import { cn } from '@/lib/utils';

export function AdminSidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-6 px-1.5">
      {ADMIN_NAV_GROUPS.map((group) => (
        <div key={group.label} className="space-y-1.5">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
            {group.label}
          </p>
          <div className="grid gap-0.5">
            {group.items.map((item) => {
              const active =
                pathname === item.path || pathname.startsWith(`${item.path}/`);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => onNavigate?.()}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    active
                      ? 'bg-gradient-to-r from-fire-500/20 via-fire-500/10 to-transparent text-fire-700 shadow-[inset_0_0_0_1px_rgba(240,90,32,0.12)] dark:text-fire-300 dark:shadow-[inset_0_0_0_1px_rgba(240,90,32,0.2)]'
                      : 'text-muted-foreground hover:bg-fire-500/10 hover:text-fire-700 dark:hover:bg-fire-500/15 dark:hover:text-fire-300'
                  )}
                >
                  <span
                    className={cn(
                      'absolute left-1 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full transition-all duration-200',
                      active
                        ? 'bg-fire-500 shadow-[0_0_12px_rgba(240,90,32,0.55)]'
                        : 'bg-transparent group-hover:bg-fire-500'
                    )}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors',
                      active
                        ? 'bg-fire-500 text-white shadow-md shadow-fire-500/30'
                        : 'bg-muted/40 text-muted-foreground group-hover:bg-fire-500 group-hover:text-white group-hover:shadow-md group-hover:shadow-fire-500/25 dark:bg-white/5'
                    )}
                  >
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate tracking-tight">
                    {item.title}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
