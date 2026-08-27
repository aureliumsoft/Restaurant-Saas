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

import { AdminBreadcrumb } from '@/components/admin/admin-breadcrumb';
import { AdminSidebarFooter } from '@/components/admin/admin-sidebar-footer';
import { AdminSidebarNav } from '@/components/admin/admin-sidebar-nav';
import { AdminAppShell } from '@/components/layout/admin-app-shell';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ModeToggle } from '@/components/darkmode/darkmode';
import UserMenu from '@/components/dashboard/UserMenu';
import { cn } from '@/lib/utils';
import { isPlatformAdminSession } from '@/lib/auth/admin';

const ADMIN_SIDEBAR_KEY = 'saas-admin-sidebar-open';

function AdminMobileNav({
  onOpenChange,
}: {
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <SheetContent
      side="left"
      className="flex w-[min(100vw,19rem)] flex-col border-0 bg-white/80 p-0 backdrop-blur-2xl dark:bg-black/80"
    >
      <div className="px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-fire-400 to-fire-600 shadow-lg shadow-fire-500/30">
            <Image src="/Logo.png" alt="Foodluk Admin" width={24} height={24} />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold tracking-tight">
              Foodluk
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fire-600 dark:text-fire-400">
              Admin
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <AdminSidebarNav onNavigate={() => onOpenChange(false)} />
      </div>

      <div className="px-3 pb-4">
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
      <div className="fire-mesh-bg flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-fire-500" />
          <p className="text-sm text-muted-foreground">Loading admin panel…</p>
        </div>
      </div>
    );
  }

  if (!canAccessAdmin) {
    return (
      <div className="fire-mesh-bg flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
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
        <Link href="/admin/dashboard" className="group flex min-w-0 items-center gap-3 transition-opacity hover:opacity-90">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-fire-400 to-fire-600 shadow-lg shadow-fire-500/30">
            <Image src="/Logo.png" alt="Foodluk Admin" width={24} height={24} />
          </div>
          <div className="min-w-0 flex flex-col leading-tight">
            <span className="truncate text-sm font-semibold tracking-tight">Foodluk</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fire-600 dark:text-fire-400">
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
            className="h-9 w-9 shrink-0 rounded-xl bg-white/70 text-muted-foreground shadow-sm hover:bg-white hover:text-foreground dark:bg-white/10 dark:hover:bg-white/15"
            aria-label="Toggle navigation"
            onClick={toggleDesktop}
          >
            <span className="hidden md:inline-flex" aria-hidden>
              {sidebarOpen ? (
                <PanelLeftClose className="h-[1.1rem] w-[1.1rem]" />
              ) : (
                <PanelLeft className="h-[1.1rem] w-[1.1rem]" />
              )}
            </span>
            <span className="inline-flex md:hidden" aria-hidden>
              <Menu className="h-[1.1rem] w-[1.1rem]" />
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
              className="hidden h-9 rounded-xl bg-white/70 px-3 text-muted-foreground shadow-sm hover:bg-white hover:text-foreground dark:bg-white/10 dark:hover:bg-white/15 lg:inline-flex"
              asChild
            >
              <Link href="/" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Site
              </Link>
            </Button>
            <ModeToggle />
            <div className={cn('hidden items-center', !sidebarOpen && 'md:flex')}>
              <UserMenu
                confirmLogout
                className="h-9 rounded-xl border-0 bg-white/70 px-3 shadow-sm hover:bg-white dark:bg-white/10 dark:hover:bg-white/15"
              />
            </div>
          </div>
        </>
      }
    >
      {children}
    </AdminAppShell>
  );
}
