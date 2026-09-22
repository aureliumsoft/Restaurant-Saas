'use client';

import { useTranslation } from 'react-i18next';

import { ProductsTab } from '@/components/dashboard/menu-manager/products-tab';
import { MenuPageShell } from '@/components/dashboard/menu-manager/menu-page-shell';
import ErrorBoundary from '@/components/toaster/toaster';

export default function ProductPage() {
  const { t } = useTranslation();
  return (
    <div className="w-full">
      <ErrorBoundary>
        <MenuPageShell
          title={t('dashboard.product.title')}
          description={t('dashboard.product.description')}
          loading={false}
        >
          <ProductsTab />
        </MenuPageShell>
      </ErrorBoundary>
    </div>
  );
}
