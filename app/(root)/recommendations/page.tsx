'use client';

import { RecommendationsTab } from '@/components/dashboard/menu-manager/recommendations-tab';
import { MenuPageShell } from '@/components/dashboard/menu-manager/menu-page-shell';
import { useRestaurantMenu } from '@/components/dashboard/menu-manager/use-restaurant-menu';
import ErrorBoundary from '@/components/toaster/toaster';

export default function RecommendationsPage() {
  const { loading, categories, load } = useRestaurantMenu();

  return (
    <div className="min-w-0 w-full max-w-full">
      <ErrorBoundary>
        <MenuPageShell
          title="Configuration"
          description="Link add-on options to products (e.g. choose a sauce or gratin from another category)."
          loading={false}
        >
          <RecommendationsTab categories={categories} onRefresh={load} loading={loading} />
        </MenuPageShell>
      </ErrorBoundary>
    </div>
  );
}
