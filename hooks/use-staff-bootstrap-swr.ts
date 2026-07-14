'use client';

import useSWR, { mutate as globalMutate } from 'swr';

import { fetchStaffBootstrap } from '@/lib/query/bootstrap-fetcher';
import { STAFF_BOOTSTRAP_KEY } from '@/types/staff-bootstrap';
import type { StaffBootstrapResponse } from '@/types/staff-bootstrap';

/** Shared SWR cache for staff bootstrap — one HTTP + one DB bundle per session. */
export function useStaffBootstrapSWR() {
  return useSWR<StaffBootstrapResponse>(STAFF_BOOTSTRAP_KEY, fetchStaffBootstrap, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 30_000,
    // Avoid flashing empty/stale nav from a previous failed payload.
    keepPreviousData: false,
    errorRetryCount: 2,
  });
}

export function revalidateStaffBootstrap() {
  return globalMutate(STAFF_BOOTSTRAP_KEY);
}

export function selectStaffBootstrap(
  response: StaffBootstrapResponse | undefined
) {
  return response?.data ?? null;
}
