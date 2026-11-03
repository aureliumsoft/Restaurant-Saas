'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import ErrorBoundary from '@/components/toaster/toaster';

const PosScreen = dynamic(
  () =>
    import('@/components/pos/pos-screen').then((m) => m.PosScreen),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading POS…
      </div>
    ),
  }
);

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
