'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { adminNavGroupLabelClass } from '@/components/admin/admin-surface';
import { ADMIN_NAV_GROUPS } from '@/constant/adminNav';
import { cn } from '@/lib/utils';

export function AdminSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-5">
      {ADMIN_NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className={adminNavGroupLabelClass()}>{group.label}</p>
          <div className="grid gap-1">
            {group.items.map((item) => {
              const active =
                pathname === item.path || pathname.startsWith(`${item.path}/`);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                    active
                      ? 'bg-fire-500 text-white shadow-md shadow-fire-500/20'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-muted/50 text-muted-foreground'
                    )}
                  >
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
