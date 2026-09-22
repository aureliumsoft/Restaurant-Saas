'use client';

import { useTranslation } from 'react-i18next';

import { RestaurantVariationsPanel } from '@/components/dashboard/menu-manager/restaurant-variations-panel';
import { MenuPageShell } from '@/components/dashboard/menu-manager/menu-page-shell';
import ErrorBoundary from '@/components/toaster/toaster';

export default function VariationsPage() {
  const { t } = useTranslation();
  return (
    <div className="min-w-0 w-full max-w-full">
      <ErrorBoundary>
        <MenuPageShell
          title={t('dashboard.variations.title')}
          description={t('dashboard.variations.description')}
          loading={false}
        >
          <RestaurantVariationsPanel />
        </MenuPageShell>
      </ErrorBoundary>
    </div>
  );
}
