'use client';

import { RecommendationsTab } from '@/components/dashboard/menu-manager/recommendations-tab';
import { MenuPageShell } from '@/components/dashboard/menu-manager/menu-page-shell';
import ErrorBoundary from '@/components/toaster/toaster';

export default function RecommendationsPage() {
  return (
    <div className="min-w-0 w-full max-w-full">
      <ErrorBoundary>
        <MenuPageShell
          title="Configuration"
          description="Choose a product, then set what guests can pick — extras, one option, preferences, or upsells."
          loading={false}
        >
          <RecommendationsTab />
        </MenuPageShell>
      </ErrorBoundary>
    </div>
  );
}
