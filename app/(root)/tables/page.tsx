'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/** Tables moved under Settings → Branches (select a branch to manage tables). */
export default function TablesPage() {
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
