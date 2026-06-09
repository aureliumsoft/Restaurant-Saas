'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Loader2, Menu, PanelLeft, PanelLeftClose, Shield } from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ModeToggle } from '@/components/darkmode/darkmode';
import UserMenu from '@/components/dashboard/UserMenu';
import { AdminSidebarNav } from '@/components/admin/admin-sidebar-nav';
import { DashboardAppShell } from '@/components/layout/dashboard-app-shell';
import { ADMIN_NAV_ITEMS } from '@/constant/adminNav';
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
    <SheetContent side="left" className="flex w-[min(100vw,15rem)] flex-col">
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
      <div className="flex min-h-screen items-center justify-center bg-[#eef0f3] text-sm text-muted-foreground dark:bg-[#0d0d0d]">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!canAccessAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-[#eef0f3] p-6 text-center dark:bg-[#0d0d0d]">
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
    <DashboardAppShell
      sidebarOpen={sidebarOpen}
      sidebarHeader={
        <div className="flex items-center gap-2 font-semibold">
          <Image src="/Logo.png" alt="Foodluk Admin" width={28} height={28} />
          <div className="min-w-0 flex flex-col leading-tight">
            <span className="truncate text-sm">Foodluk Admin</span>
            <span className="text-[10px] font-normal text-muted-foreground">
              Platform
            </span>
          </div>
        </div>
      }
      sidebarNav={<AdminSidebarNav />}
      sidebarFooter={<UserMenu className="w-full justify-start" />}
      header={
        <>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
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

          <div
            className={cn(
              'flex min-w-0 shrink items-center gap-2',
              sidebarOpen && 'md:hidden'
            )}
          >
            <Shield className="h-5 w-5 shrink-0 text-primary" />
            <span className="truncate text-sm font-semibold">Foodluk Admin</span>
          </div>

          <div className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">
            Platform administration
          </div>

          <ModeToggle />
          <div
            className={cn('flex items-center', sidebarOpen && 'md:hidden')}
          >
            <UserMenu />
          </div>
        </>
      }
    >
      {children}
    </DashboardAppShell>
  );
}
