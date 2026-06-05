'use client';

import { CategoriesTab } from '@/components/dashboard/menu-manager/categories-tab';
import { MenuPageShell } from '@/components/dashboard/menu-manager/menu-page-shell';
import { useRestaurantMenu } from '@/components/dashboard/menu-manager/use-restaurant-menu';
import ErrorBoundary from '@/components/toaster/toaster';

export default function CategoriesPage() {
  const { loading, categories, load } = useRestaurantMenu();

  return (
    <div className="w-full">
      <ErrorBoundary>
        <MenuPageShell
          title="Categories"
          description="Create menu sections (categories). Use Show in front for items customers browse on web, kiosk, and POS. Turn it off for add-on categories used only in Recommendations."
          loading={false}
        >
          <CategoriesTab categories={categories} onRefresh={load} loading={loading} />
        </MenuPageShell>
      </ErrorBoundary>
    </div>
  );
}
