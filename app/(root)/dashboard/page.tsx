import React from 'react';

import DashboardAnalytics from '@/components/dashboard/dashboard-analytics';
import ErrorBoundary from '@/components/toaster/toaster';

const page = () => {
  return (
    <div className="w-full space-y-10">
      <ErrorBoundary>
        <DashboardAnalytics />
        {/* <BentoGridHome /> */}
      </ErrorBoundary>
    </div>
  );
};

export default page;




