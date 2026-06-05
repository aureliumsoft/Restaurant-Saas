'use client';

import { RestaurantVariationsPanel } from '@/components/dashboard/menu-manager/restaurant-variations-panel';
import { MenuPageShell } from '@/components/dashboard/menu-manager/menu-page-shell';
import ErrorBoundary from '@/components/toaster/toaster';

export default function VariationsPage() {
  return (
    <div className="min-w-0 w-full max-w-full">
      <ErrorBoundary>
        <MenuPageShell
          title="Variations"
          description="Define size templates (Small, Medium, Large) used on products and configuration add-ons. Set per-product rates and photos when editing a product."
          loading={false}
        >
          <RestaurantVariationsPanel />
        </MenuPageShell>
      </ErrorBoundary>
    </div>
  );
}
