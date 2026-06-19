'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconExternalLink } from '@tabler/icons-react';

import { dashboardNavGroupLabelClass } from '@/components/dashboard/dashboard-surface';
import { isDashboardNavItemActive } from '@/lib/dashboard-nav';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/types/Navbar';

import { useDashboardNavGroups } from './use-dashboard-nav-items';

type DashboardSidebarNavProps = {
  onNavigate?: () => void;
};

function opensInNewTab(item: NavItem) {
  return item.moduleKey === 'pos' || item.moduleKey === 'order-display';
}

export function DashboardSidebarNav({ onNavigate }: DashboardSidebarNavProps) {
  const pathname = usePathname();
  const navGroups = useDashboardNavGroups();

  return (
    <nav className="space-y-5 px-1">
      {navGroups.map((group) => (
        <div key={group.label}>
          <p className={dashboardNavGroupLabelClass()}>{group.label}</p>
          <div className="grid gap-1">
            {group.items.map((item) => {
              const active = isDashboardNavItemActive(pathname ?? '', item.path);
              const newTab = opensInNewTab(item);

              return (
                <Link
                  key={item.path}
                  href={item.path}
                  target={newTab ? '_blank' : undefined}
                  rel={newTab ? 'noopener noreferrer' : undefined}
                  title={newTab ? `${item.title} (opens in new tab)` : item.title}
                  onClick={() => {
                    if (!newTab) onNavigate?.();
                  }}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                    active
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors [&_svg]:h-[18px] [&_svg]:w-[18px]',
                      active
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-muted/50 text-muted-foreground'
                    )}
                  >
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  {newTab ? (
                    <IconExternalLink
                      className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        active ? 'text-primary-foreground/80' : 'text-muted-foreground/70'
                      )}
                      aria-hidden
                    />
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
