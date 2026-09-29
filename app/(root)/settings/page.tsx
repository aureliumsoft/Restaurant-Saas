import React, { Suspense } from 'react';
import { Setting } from '@/components/setting/setting';
import { Loader2 } from 'lucide-react';

function SettingsFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center bg-muted/40 p-10 text-sm text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="h-full w-full">
      <Suspense fallback={<SettingsFallback />}>
        <Setting />
      </Suspense>
    </div>
  );
}
