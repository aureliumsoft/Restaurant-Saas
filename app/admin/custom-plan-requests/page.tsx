'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/** Custom plan requests live under Subscriptions. */
export default function AdminCustomPlanRequestsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/subscriptions#custom-plans');
  }, [router]);

  return (
    <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-primary" />
  );
}
