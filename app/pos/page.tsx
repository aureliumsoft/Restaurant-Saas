import ErrorBoundary from '@/components/toaster/toaster';
import { PosScreen } from '@/components/pos/pos-screen';

export default function PosPage() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <ErrorBoundary>
        <PosScreen />
      </ErrorBoundary>
    </div>
  );
}
