import React, { Suspense } from 'react';
import { Setting } from '@/components/setting/setting';

function SettingsFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center bg-muted/40 p-10 text-sm text-muted-foreground">
      Loading settings…
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
