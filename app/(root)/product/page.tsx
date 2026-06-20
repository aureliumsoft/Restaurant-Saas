'use client';

import { ProductsTab } from '@/components/dashboard/menu-manager/products-tab';
import { MenuPageShell } from '@/components/dashboard/menu-manager/menu-page-shell';
import { useRestaurantMenu } from '@/components/dashboard/menu-manager/use-restaurant-menu';
import ErrorBoundary from '@/components/toaster/toaster';

export default function ProductPage() {
  const { loading, categories, inventoryItems, load } = useRestaurantMenu();

  return (
    <div className="w-full">
      <ErrorBoundary>
        <MenuPageShell
          title="Inventory"
          description="Manage your full menu inventory on one page — add categories, variation templates, and products without leaving this screen."
          loading={false}
        >
         
          <ProductsTab
            categories={categories}
            inventoryItems={inventoryItems}
            onRefresh={load}
            loading={loading}
          />
        </MenuPageShell>
      </ErrorBoundary>
    </div>
  );
}
