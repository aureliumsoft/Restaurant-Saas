'use client';

import type { ReactNode } from 'react';

import { BranchProvider } from '@/hooks/use-branch-context';
import { RestaurantRealtimeProvider } from '@/components/providers/restaurant-realtime-provider';

/** POS, KDS screen, order display — SSE push + branch context (outside dashboard layout). */
export function OperationalRealtimeShell({ children }: { children: ReactNode }) {
  return (
    <BranchProvider>
      <RestaurantRealtimeProvider>{children}</RestaurantRealtimeProvider>
    </BranchProvider>
  );
}
