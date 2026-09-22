'use client';

import { useTranslation } from 'react-i18next';

import { RecommendationsTab } from '@/components/dashboard/menu-manager/recommendations-tab';
import { MenuPageShell } from '@/components/dashboard/menu-manager/menu-page-shell';
import ErrorBoundary from '@/components/toaster/toaster';

export default function RecommendationsPage() {
  const { t } = useTranslation();

  return (
    <div className="min-w-0 w-full max-w-full">
      <ErrorBoundary>
        <MenuPageShell
          title={t('dashboard.configuration.title')}
          description={t('dashboard.configuration.description')}
          loading={false}
        >
          <RecommendationsTab />
        </MenuPageShell>
      </ErrorBoundary>
    </div>
  );
}
