import { KdsLayoutHeader } from '@/components/kds/kds-layout-header';
import { OperationalRealtimeShell } from '@/components/layout/operational-realtime-shell';

export default function KdsScreenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OperationalRealtimeShell>
      <div className="flex min-h-screen flex-col bg-muted/30 dark:bg-background">
        <KdsLayoutHeader />
        <div className="flex min-h-0 flex-1 flex-col p-3 md:p-4">{children}</div>
      </div>
    </OperationalRealtimeShell>
  );
}
