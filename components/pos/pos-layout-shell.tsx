'use client';

import type { ReactNode } from 'react';

import { PosCartGuardProvider } from '@/components/pos/pos-cart-guard-context';
import { OperationalRealtimeShell } from '@/components/layout/operational-realtime-shell';

export function PosLayoutShell({ children }: { children: ReactNode }) {
  return (
    <OperationalRealtimeShell>
      <PosCartGuardProvider>
        <div className="fire-mesh-bg flex h-dvh flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </div>
      </PosCartGuardProvider>
    </OperationalRealtimeShell>
  );
}
