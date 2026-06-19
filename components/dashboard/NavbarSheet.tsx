'use client';

import { DashboardSidebarNav } from '@/components/dashboard/dashboard-sidebar-nav';
import { ScrollAreaDemo } from '@/components/scrollarea/scrollarea';
import { SheetContent } from '@/components/ui/sheet';
import { useRestaurantBranding } from '@/components/layout/restaurant-branding-provider';

import UserMenu from './UserMenu';

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
      className="flex w-[min(100vw,18rem)] flex-col bg-white p-0 dark:bg-zinc-900"
    >
      <div className="border-b border-border/40 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-sm font-semibold uppercase ring-1 ring-primary/15">
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
            <p className="truncate text-sm font-semibold">{restaurantName}</p>
            <p className="text-[11px] font-medium uppercase tracking-wider text-primary">
              Dashboard
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-2 py-4">
        <DashboardSidebarNav onNavigate={onNavigate} />
        <ScrollAreaDemo />
      </div>

      <div className="border-t border-border/40 p-3">
        <UserMenu className="w-full justify-start" />
      </div>
    </SheetContent>
  );
}
