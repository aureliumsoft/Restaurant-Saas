'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Menu, PanelLeft, PanelLeftClose, Shield } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ModeToggle } from '@/components/darkmode/darkmode';
import UserMenu from '@/components/dashboard/UserMenu';
import { AdminSidebarNav } from '@/components/admin/admin-sidebar-nav';
import { ADMIN_NAV_ITEMS } from '@/constant/adminNav';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { isPlatformAdminSession } from '@/lib/auth/admin';
import Image from 'next/image';

const ADMIN_SIDEBAR_KEY = 'saas-admin-sidebar-open';

function AdminMobileNav({
  onOpenChange,
}: {
  onOpenChange: (o: boolean) => void;
}) {
  const pathname = usePathname();
  return (
    <SheetContent side="left" className="flex w-[min(100vw,280px)] flex-col">
      <div className="mb-4 flex items-center gap-2 font-semibold">
        <Shield className="h-5 w-5" />
        Foodluk Admin
      </div>
      <nav className="grid flex-1 gap-1">
        {ADMIN_NAV_ITEMS.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            onClick={() => onOpenChange(false)}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2',
              pathname === item.path
                ? 'bg-muted'
                : 'text-muted-foreground hover:bg-muted/80'
            )}
          >
            {item.icon}
            {item.title}
          </Link>
        ))}
      </nav>
      <div className="mt-auto border-t pt-4">
        <UserMenu className="w-full justify-start" />
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
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!canAccessAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="font-medium">Access denied</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Sign in with an email listed in{' '}
          <code className="rounded bg-muted px-1">ADMIN_EMAIL</code> or{' '}
          <code className="rounded bg-muted px-1">ADMIN_EMAILS</code> in your
          environment file.
        </p>
        <Link href="/" className="mt-2 text-sm text-primary underline">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
      <div
        className={cn(
          'grid min-h-screen w-full',
          sidebarOpen ? 'md:grid-cols-[minmax(0,240px)_1fr]' : 'grid-cols-1'
        )}
      >
        <aside
          className={cn(
            'hidden border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:flex md:flex-col',
            !sidebarOpen && 'md:hidden'
          )}
        >
          <div className="flex h-14 items-center gap-2 border-b border-zinc-200 px-4 dark:border-zinc-800">
            <Image src="/Logo.png" alt="Foodluk Admin" width={32} height={32} />
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">Foodluk Admin</span>
              <span className="text-[10px] text-muted-foreground">
                Platform
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-4">
            <AdminSidebarNav />
          </div>
          <div className="border-t border-zinc-200 p-2 dark:border-zinc-800">
            <UserMenu className="w-full justify-start" />
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="flex h-14 items-center gap-2 border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-900 sm:gap-4">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
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

            <div className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">
              Platform administration
            </div>

            <ModeToggle />
            <div
              className={cn('flex items-center', sidebarOpen && 'md:hidden')}
            >
              <UserMenu />
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
