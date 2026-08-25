'use client';

import { ProductsTab } from '@/components/dashboard/menu-manager/products-tab';
import { MenuPageShell } from '@/components/dashboard/menu-manager/menu-page-shell';
import ErrorBoundary from '@/components/toaster/toaster';

export default function ProductPage() {
  return (
    <div className="w-full">
      <ErrorBoundary>
        <MenuPageShell
          title="Products"
          description="Manage menu products — add categories, variation templates, and items without leaving this screen."
          loading={false}
        >
          <ProductsTab />
        </MenuPageShell>
      </ErrorBoundary>
    </div>
  );
}
