import { KdsLayoutHeader } from '@/components/kds/kds-layout-header';
import { OperationalRealtimeShell } from '@/components/layout/operational-realtime-shell';

export default function OrderDisplayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OperationalRealtimeShell>
      {/* h-screen + overflow-hidden so the customer display never spills past
          the viewport — the screen is meant to be wall-mounted, not scrolled. */}
      <div className="fire-mesh-bg flex h-screen max-h-screen flex-col overflow-hidden">
        <KdsLayoutHeader />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </OperationalRealtimeShell>
  );
}
