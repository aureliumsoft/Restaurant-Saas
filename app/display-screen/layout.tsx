'use client';

import { ModulePremiumShell } from '@/components/premium/module-premium-shell';
import { OperationalRealtimeShell } from '@/components/layout/operational-realtime-shell';

/** Alias route for customer-facing display tablets. */
export default function DisplayScreenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OperationalRealtimeShell>
      <ModulePremiumShell module="orderDisplay">
        <div className="order-display-shell fire-mesh-bg relative flex min-h-[100vh] min-h-[100dvh] flex-col overflow-hidden">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </div>
      </ModulePremiumShell>
    </OperationalRealtimeShell>
  );
}
