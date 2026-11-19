import React from 'react';

import DashboardAnalytics from '@/components/dashboard/dashboard-analytics';
import { DashboardTrialBanner } from '@/components/dashboard/dashboard-trial-banner';
import ErrorBoundary from '@/components/toaster/toaster';

const page = () => {
  return (
    <div className="w-full space-y-6">
      <ErrorBoundary>
        <DashboardTrialBanner />
        <DashboardAnalytics />
        {/* <BentoGridHome /> */}
      </ErrorBoundary>
    </div>
  );
};

export default page;




