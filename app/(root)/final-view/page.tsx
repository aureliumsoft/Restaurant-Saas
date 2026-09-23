'use client';

import { useTranslation } from 'react-i18next';

import { FinalViewScreen } from '@/components/dashboard/menu-manager/final-view-screen';
import ErrorBoundary from '@/components/toaster/toaster';

export default function FinalViewPage() {
  const { t } = useTranslation();

  return (
    <div className="min-w-0 w-full max-w-full">
      <ErrorBoundary>
        <FinalViewScreen />
      </ErrorBoundary>
    </div>
  );
}
