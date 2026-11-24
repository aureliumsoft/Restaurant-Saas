'use client';

import useSWR, { mutate as globalMutate } from 'swr';
import { useSession } from 'next-auth/react';
import { useMemo } from 'react';
import { usePathname } from 'next/navigation';

import {
  fetchStaffBootstrap,
  readStaffBootstrapSessionCache,
} from '@/lib/query/bootstrap-fetcher';
import { isRestaurantStaffRoute } from '@/lib/restaurant-staff-route';
import { STAFF_BOOTSTRAP_KEY } from '@/types/staff-bootstrap';
import type { StaffBootstrapResponse } from '@/types/staff-bootstrap';

/** Shared SWR cache for staff bootstrap — one HTTP + one DB bundle per session. */
export function useStaffBootstrapSWR() {
  const pathname = usePathname() ?? '';
  const { data: session } = useSession();
  const email =
    typeof session?.user?.email === 'string' ? session.user.email : null;
  const enabled = Boolean(email) && isRestaurantStaffRoute(pathname);

  const fallbackData = useMemo(
    () => (enabled ? readStaffBootstrapSessionCache(email) : undefined),
    [email, enabled]
  );

  return useSWR<StaffBootstrapResponse>(
    enabled ? STAFF_BOOTSTRAP_KEY : null,
    () => fetchStaffBootstrap(email),
    {
      fallbackData,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60_000,
      // Show last good payload while background revalidate runs.
      keepPreviousData: true,
      errorRetryCount: 2,
    }
  );
}

export function revalidateStaffBootstrap() {
  return globalMutate(STAFF_BOOTSTRAP_KEY);
}

export function selectStaffBootstrap(
  response: StaffBootstrapResponse | undefined
) {
  return response?.data ?? null;
}
