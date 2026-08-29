'use client';

import { DashboardSidebarNav } from '@/components/dashboard/dashboard-sidebar-nav';
import { SheetContent } from '@/components/ui/sheet';
import { useRestaurantBranding } from '@/components/layout/restaurant-branding-provider';

import { ShiftAwareUserMenu } from '@/components/dashboard/shift-aware-user-menu';

type NavbarSheetProps = {
  /** Called when a nav link is used (e.g. to close the mobile sheet). */
  onNavigate?: () => void;
};

export function NavbarSheet({ onNavigate }: NavbarSheetProps) {
  const { restaurantName, logoUrl, logoFailed, setLogoFailed } =
    useRestaurantBranding();

  return (
    <SheetContent
      side="left"
      className="flex w-[min(100vw,19rem)] flex-col border-0 bg-white/80 p-0 backdrop-blur-2xl dark:bg-black/80"
    >
      <div className="px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-fire-400 to-fire-600 text-sm font-bold uppercase text-white shadow-lg shadow-fire-500/30">
            {logoUrl && !logoFailed ? (
              <img
                src={logoUrl}
                alt={restaurantName}
                className="h-full w-full object-cover"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <span>{restaurantName.charAt(0)}</span>
            )}
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold tracking-tight">
              {restaurantName}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fire-600 dark:text-fire-400">
              Portal
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <DashboardSidebarNav onNavigate={onNavigate} />
      </div>

      <div className="px-3 pb-4">
        <ShiftAwareUserMenu
          className="h-11 w-full justify-start gap-2 rounded-2xl border-0 bg-white/70 px-3 text-foreground shadow-sm hover:bg-white dark:bg-white/10 dark:hover:bg-white/15"
        />
      </div>
    </SheetContent>
  );
}
