'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ExternalLink,
  Loader2,
  Menu,
  PanelLeft,
  PanelLeftClose,
  Shield,
} from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

import { AdminBreadcrumb } from '@/components/admin/admin-breadcrumb';
import { AdminSidebarFooter } from '@/components/admin/admin-sidebar-footer';
import { AdminSidebarNav } from '@/components/admin/admin-sidebar-nav';
import { AdminAppShell } from '@/components/layout/admin-app-shell';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ModeToggle } from '@/components/darkmode/darkmode';
import UserMenu from '@/components/dashboard/UserMenu';
import { ADMIN_NAV_GROUPS } from '@/constant/adminNav';
import { cn } from '@/lib/utils';
import { isPlatformAdminSession } from '@/lib/auth/admin';

const ADMIN_SIDEBAR_KEY = 'saas-admin-sidebar-open';

function AdminMobileNav({
  onOpenChange,
}: {
  onOpenChange: (o: boolean) => void;
}) {
  const pathname = usePathname();

  return (
    <SheetContent
      side="left"
      className="flex w-[min(100vw,18rem)] flex-col bg-white p-0 dark:bg-zinc-900"
    >
      <div className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fire-500/10 ring-1 ring-fire-500/20">
            <Image src="/Logo.png" alt="Foodluk Admin" width={22} height={22} />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">Foodluk Admin</p>
            <p className="text-[11px] font-medium uppercase tracking-wider text-fire-600 dark:text-fire-400">
              Platform
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {ADMIN_NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-xs font-medium text-muted-foreground">
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
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-fire-500 text-white shadow-md shadow-fire-500/20'
                        : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-muted/50'
                      )}
                    >
                      {item.icon}
                    </span>
                    <span className="truncate">{item.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3">
        <AdminSidebarFooter />
      </div>
    </SheetContent>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const canAccessAdmin = isPlatformAdminSession(session?.user);

  useEffect(() => {
    try {
      const s = localStorage.getItem(ADMIN_SIDEBAR_KEY);
      if (s !== null) setSidebarOpen(s === 'true');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(ADMIN_SIDEBAR_KEY, String(sidebarOpen));
    } catch {
      /* ignore */
    }
  }, [sidebarOpen]);

  const toggleDesktop = () => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 768px)').matches
    ) {
      setSidebarOpen((o) => !o);
    } else {
      setMobileOpen((o) => !o);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-fire-500" />
          <p className="text-sm text-muted-foreground">Loading admin panel…</p>
        </div>
      </div>
    );
  }

  if (!canAccessAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-100 p-6 text-center dark:bg-zinc-950">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-fire-500/10">
          <Shield className="h-7 w-7 text-fire-600 dark:text-fire-400" />
        </div>
        <div className="space-y-2">
          <p className="text-lg font-semibold">Access denied</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Sign in with an email listed in{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">ADMIN_EMAIL</code> or{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">ADMIN_EMAILS</code> in your
            environment file.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    );
  }

  return (
    <AdminAppShell
      sidebarOpen={sidebarOpen}
      sidebarHeader={
        <Link href="/admin/dashboard" className="flex items-center gap-3 transition-opacity hover:opacity-90">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-fire-500/10">
            <Image src="/Logo.png" alt="Foodluk Admin" width={24} height={24} />
          </div>
          <div className="min-w-0 flex flex-col leading-tight">
            <span className="truncate text-sm font-semibold tracking-tight">Foodluk</span>
            <span className="text-xs font-medium text-fire-600 dark:text-fire-400">
              Admin
            </span>
          </div>
        </Link>
      }
      sidebarNav={<AdminSidebarNav />}
      sidebarFooter={<AdminSidebarFooter />}
      header={
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-xl text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            aria-label="Toggle navigation"
            onClick={toggleDesktop}
          >
            <span className="hidden md:inline-flex" aria-hidden>
              {sidebarOpen ? (
                <PanelLeftClose className="h-5 w-5" />
              ) : (
                <PanelLeft className="h-5 w-5" />
              )}
            </span>
            <span className="inline-flex md:hidden" aria-hidden>
              <Menu className="h-5 w-5" />
            </span>
          </Button>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <AdminMobileNav onOpenChange={setMobileOpen} />
          </Sheet>

          <AdminBreadcrumb className="min-w-0 flex-1" />

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="hidden rounded-xl text-muted-foreground hover:text-foreground lg:inline-flex"
              asChild
            >
              <Link href="/" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Site
              </Link>
            </Button>
            <ModeToggle />
            <div className={cn('hidden items-center', !sidebarOpen && 'md:flex')}>
              <UserMenu confirmLogout />
            </div>
          </div>
        </>
      }
    >
      {children}
    </AdminAppShell>
  );
}
