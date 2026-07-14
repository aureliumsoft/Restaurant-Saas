'use client';

import useSWR, { mutate as globalMutate } from 'swr';
import { useSession } from 'next-auth/react';
import { useMemo } from 'react';

import {
  fetchStaffBootstrap,
  readStaffBootstrapSessionCache,
} from '@/lib/query/bootstrap-fetcher';
import { STAFF_BOOTSTRAP_KEY } from '@/types/staff-bootstrap';
import type { StaffBootstrapResponse } from '@/types/staff-bootstrap';

/** Shared SWR cache for staff bootstrap — one HTTP + one DB bundle per session. */
export function useStaffBootstrapSWR() {
  const { data: session } = useSession();
  const email =
    typeof session?.user?.email === 'string' ? session.user.email : null;

  const fallbackData = useMemo(
    () => readStaffBootstrapSessionCache(email),
    [email]
  );

  return useSWR<StaffBootstrapResponse>(
    email ? STAFF_BOOTSTRAP_KEY : null,
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
