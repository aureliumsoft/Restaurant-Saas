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
          description="Link add-on options to products (e.g. choose a sauce or gratin from another category)."
          loading={false}
        >
          <RecommendationsTab />
        </MenuPageShell>
      </ErrorBoundary>
    </div>
  );
}
