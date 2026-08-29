'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import ErrorBoundary from '@/components/toaster/toaster';
import { PosScreen } from '@/components/pos/pos-screen';

function PosPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const endShiftLogout = searchParams.get('endShiftLogout') === '1';

  const clearEndShiftParam = () => {
    if (!endShiftLogout) return;
    router.replace('/pos');
  };

  return (
    <PosScreen
      endShiftLogoutOnMount={endShiftLogout}
      onEndShiftLogoutMountHandled={clearEndShiftParam}
    />
  );
}

export default function PosPage() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <ErrorBoundary>
        <Suspense fallback={null}>
          <PosPageContent />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
