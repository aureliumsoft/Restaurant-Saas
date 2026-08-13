'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Loader2, Menu, PanelLeft, PanelLeftClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { ModeToggle } from '@/components/darkmode/darkmode';
import Navbar from '@/components/dashboard/navbar';
import { NavbarSheet } from '@/components/dashboard/NavbarSheet';
import UserMenu from '@/components/dashboard/UserMenu';
import Bread from '@/components/dashboard/breadcrumb';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import { cn } from '@/lib/utils';
import { DASHBOARD_MODULES } from '@/constant/dashboardModules';
import { BranchSwitcher } from '@/components/dashboard/branch-switcher';
import { useRestaurantBranding } from '@/components/layout/restaurant-branding-provider';
import { BranchProvider } from '@/hooks/use-branch-context';
import { restaurantStorefrontPath } from '@/lib/customer-storefront-paths';
import {
  useStaffAccessGate,
  useStaffPermissions,
  useStaffSubscription,
} from '@/hooks/use-staff-permissions';
import { DashboardAppShell } from '@/components/layout/dashboard-app-shell';
import { RestaurantRegionalProvider } from '@/components/layout/restaurant-regional-provider';
import { RestaurantRealtimeProvider } from '@/components/providers/restaurant-realtime-provider';
import { revalidateStaffBootstrap } from '@/hooks/use-staff-bootstrap-swr';

const SIDEBAR_STORAGE_KEY = 'dashboard-sidebar-open';

interface RootLayoutProps {
  children: React.ReactNode;
}

function moduleKeyForPath(pathname: string): string | null {
  const exact = DASHBOARD_MODULES.find((m) => m.path === pathname);
  if (exact) return exact.moduleKey;
  const nested = DASHBOARD_MODULES.find((m) =>
    pathname.startsWith(`${m.path}/`)
  );
  return nested?.moduleKey ?? null;
}

function AccessLoadingScreen({
  message,
  fading = false,
}: {
  message: string;
  fading?: boolean;
}) {
  return (
    <div
      className={cn(
        'fixed inset-0 z-[80] flex flex-col items-center justify-center gap-3 bg-[#f4f4f5] text-sm text-muted-foreground transition-opacity duration-300 ease-out dark:bg-zinc-950',
        fading ? 'pointer-events-none opacity-0' : 'opacity-100'
      )}
      aria-busy={!fading}
      aria-live="polite"
    >
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p>{message}</p>
    </div>
  );
}

const RootLayout = ({ children }: RootLayoutProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const { status: sessionStatus } = useSession();
  const {
    restaurantName,
    restaurantSlug,
    logoUrl: restaurantLogoUrl,
    logoFailed,
    setLogoFailed,
  } = useRestaurantBranding();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarHydrated, setSidebarHydrated] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const openedForSessionRef = useRef(false);
  const redirectedToPricingRef = useRef(false);
  const [accessGateVisible, setAccessGateVisible] = useState(true);

  const { loading: accessLoading, failed: accessFailed, ready: accessReady } =
    useStaffAccessGate();
  const { subscription } = useStaffSubscription();
  const { allowedModuleKeys, permissions, ready: permissionsReady } =
    useStaffPermissions();

  const subscriptionAllowed = subscription.allowed;
  const subscriptionWarning = subscription.warning;

  const bootstrapReady =
    sessionStatus === 'authenticated' &&
    accessReady &&
    permissionsReady &&
    subscriptionAllowed;

  const securityReady = bootstrapReady && permissions.length > 0;

  const blockingMessage =
    sessionStatus === 'loading'
      ? 'Checking session…'
      : accessLoading || !accessReady
        ? 'Checking access & security…'
        : !subscriptionAllowed
          ? 'Redirecting to pricing…'
          : !permissionsReady
            ? 'Loading permissions…'
            : null;

  // Fade out the access gate once the dashboard is ready to show.
  useEffect(() => {
    if (!securityReady) {
      setAccessGateVisible(true);
      return;
    }
    const id = window.setTimeout(() => {
      setAccessGateVisible(false);
    }, 300);
    return () => window.clearTimeout(id);
  }, [securityReady]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      setSidebarOpen(stored !== 'false');
    } catch {
      setSidebarOpen(true);
    } finally {
      setSidebarHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!sidebarHydrated) return;
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarOpen));
    } catch {
      /* ignore */
    }
  }, [sidebarOpen, sidebarHydrated]);

  useEffect(() => {
    if (!securityReady || openedForSessionRef.current) return;
    openedForSessionRef.current = true;
    setSidebarOpen(true);
  }, [securityReady]);

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      const callback = encodeURIComponent(pathname ?? '/dashboard');
      router.replace(`/login?callbackUrl=${callback}`);
    }
  }, [sessionStatus, pathname, router]);

  useEffect(() => {
    if (!accessReady) return;
    if (subscriptionAllowed) {
      redirectedToPricingRef.current = false;
      return;
    }
    if (!redirectedToPricingRef.current) {
      redirectedToPricingRef.current = true;
      toast.error(
        'Your trial/plan is expired or not configured. Please choose a pricing plan.'
      );
      // Use a full navigation to avoid App Router transition crashes when
      // leaving the dashboard shell after bootstrap denies subscription access.
      if (typeof window !== 'undefined') {
        window.location.replace('/pricing');
      } else {
        router.replace('/pricing');
      }
    }
  }, [accessReady, subscriptionAllowed, router]);

  useEffect(() => {
    if (!securityReady) return;
    if (pathname === '/no-access' || pathname === '/dashboard') return;
    const moduleKey = moduleKeyForPath(pathname ?? '/');
    if (!moduleKey) return;
    if (!allowedModuleKeys.has(moduleKey)) {
      router.replace('/no-access');
    }
  }, [allowedModuleKeys, pathname, securityReady, router]);

  const toggleNav = () => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 768px)').matches
    ) {
      setSidebarOpen((o) => !o);
    } else {
      setMobileNavOpen((o) => !o);
    }
  };

  if (sessionStatus === 'unauthenticated') {
    return <AccessLoadingScreen message="Checking session…" />;
  }

  if (accessFailed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f4f4f5] px-4 text-center dark:bg-zinc-950">
        <p className="text-sm text-muted-foreground">
          Could not verify dashboard access. Please try again.
        </p>
        <Button
          type="button"
          onClick={() => {
            void revalidateStaffBootstrap();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (bootstrapReady && permissions.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f4f4f5] px-4 text-center dark:bg-zinc-950">
        <p className="text-sm text-muted-foreground">
          No dashboard permissions were returned for this account.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.replace('/pricing')}
        >
          Go to pricing
        </Button>
      </div>
    );
  }

  const accessGateFading = securityReady && accessGateVisible;
  const showAccessOverlay =
    accessGateVisible && (Boolean(blockingMessage) || securityReady);

  return (
    <BranchProvider>
      <RestaurantRealtimeProvider>
        <RestaurantRegionalProvider>
          {showAccessOverlay ? (
            <AccessLoadingScreen
              message={blockingMessage ?? 'Checking access & security…'}
              fading={accessGateFading}
            />
          ) : null}

          {securityReady ? (
            <div className="min-h-screen animate-in fade-in duration-300">
              <DashboardAppShell
                sidebarOpen={sidebarOpen}
                sidebarHeader={
                  <Link
                    href={restaurantSlug ? restaurantStorefrontPath(restaurantSlug) : '/'}
                    target={restaurantSlug ? '_blank' : undefined}
                    className="flex items-center gap-2 font-semibold transition-opacity hover:opacity-90"
                  >
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-xs font-semibold uppercase ring-1 ring-primary/15">
                      {restaurantLogoUrl && !logoFailed ? (
                        <img
                          src={restaurantLogoUrl}
                          alt={restaurantName}
                          className="h-full w-full object-cover"
                          onError={() => setLogoFailed(true)}
                        />
                      ) : (
                        <span>{restaurantName.charAt(0)}</span>
                      )}
                    </div>
                    <span className="truncate">{restaurantName}</span>
                  </Link>
                }
                sidebarNav={<Navbar />}
                sidebarFooter={<UserMenu className="w-full justify-start" />}
                header={
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 rounded-xl text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                      aria-label="Toggle navigation"
                      title="Show or hide the sidebar with navigation links"
                      onClick={toggleNav}
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

                    <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                      <NavbarSheet onNavigate={() => setMobileNavOpen(false)} />
                    </Sheet>

                    <div
                      className={cn(
                        'flex min-w-0 shrink items-center gap-2',
                        sidebarOpen && 'md:hidden'
                      )}
                    >
                      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-sm font-semibold uppercase ring-1 ring-border">
                        {restaurantLogoUrl && !logoFailed ? (
                          <img
                            src={restaurantLogoUrl}
                            alt={restaurantName}
                            className="h-full w-full object-cover"
                            onError={() => setLogoFailed(true)}
                          />
                        ) : (
                          <span>{restaurantName.charAt(0)}</span>
                        )}
                      </div>
                      <span className="truncate text-sm font-semibold">
                        {restaurantName}
                      </span>
                    </div>

                    <Bread />
                    <BranchSwitcher />
                    <ModeToggle />
                    <div
                      className={cn(
                        'ml-auto flex items-center gap-2',
                        sidebarOpen && 'md:hidden'
                      )}
                    >
                      <UserMenu />
                    </div>
                  </>
                }
              >
                {subscriptionWarning && (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
                    {subscriptionWarning}
                  </div>
                )}
                {children}
              </DashboardAppShell>
            </div>
          ) : null}
        </RestaurantRegionalProvider>
      </RestaurantRealtimeProvider>
    </BranchProvider>
  );
};

export default RootLayout;
