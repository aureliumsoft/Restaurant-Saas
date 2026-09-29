'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/** Branches moved to Settings → Branches. */
export default function BranchedRoutePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/settings?section=branches');
  }, [router]);

  return (
    <div className="flex min-h-[40vh] w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
