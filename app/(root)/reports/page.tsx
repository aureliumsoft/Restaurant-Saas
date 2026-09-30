'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

import { ReportsModule } from '@/components/reports/reports-module';

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <ReportsModule />
    </Suspense>
  );
}
