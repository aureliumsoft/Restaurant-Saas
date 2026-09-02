'use client';

import Link from 'next/link';
import { Loader2 } from 'lucide-react';

import ErrorBoundary from '@/components/toaster/toaster';
import { MenuPageShell } from '@/components/dashboard/menu-manager/menu-page-shell';
import { TablesModule } from '@/components/dashboard/tables/tables-module';
import { Button } from '@/components/ui/button';
import { useRestaurantFulfillmentSettings } from '@/hooks/use-restaurant-fulfillment-settings';

function TablesPageContent() {
  const { settings, loading } = useRestaurantFulfillmentSettings();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!settings.dineInEnabled) {
    return (
      <MenuPageShell
        title="Tables"
        description="Dine-in is turned off in Settings → Basic → Order channels."
        loading={false}
      >
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
          <p className="text-sm text-muted-foreground"> 
            Enable dine-in in restaurant settings to manage tables and table QR
            codes.
          </p>
          <Button type="button" className="mt-4" asChild>
            <Link href="/settings">Open settings</Link>
          </Button>
        </div>
      </MenuPageShell>
    );
  }

  return (
    <MenuPageShell
      title="Tables"
      description="Add, edit, or remove dining tables. They appear in the POS table selector for dine-in orders."
      loading={false}
    >
      <TablesModule />
    </MenuPageShell>
  );
}

export default function TablesPage() {
  return (
    <div className="w-full">
      <ErrorBoundary>
        <TablesPageContent />
      </ErrorBoundary>
    </div>
  );
}
