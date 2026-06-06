'use client';

import { useRouter } from 'next/navigation';
import { LayoutDashboard } from 'lucide-react';

import { BranchSwitcher } from '@/components/dashboard/branch-switcher';
import { OperationalHeaderRestaurantBrand } from '@/components/layout/operational-header-restaurant-brand';
import { ModeToggle } from '@/components/darkmode/darkmode';
import UserMenu from '@/components/dashboard/UserMenu';
import { Button } from '@/components/ui/button';

export function KdsLayoutHeader() {
  const router = useRouter();

  return (
    <header
      className="flex h-14 shrink-0 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/60"
      aria-label="Kitchen display"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <OperationalHeaderRestaurantBrand />
        <Button
          type="button"
          variant="ghost"
          className="hidden gap-1.5 text-muted-foreground sm:inline-flex"
          title="Back to dashboard"
          onClick={() => router.push('/dashboard')}
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="sm:hidden"
          aria-label="Dashboard"
          onClick={() => router.push('/dashboard')}
        >
          <LayoutDashboard className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <BranchSwitcher />
        <ModeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
