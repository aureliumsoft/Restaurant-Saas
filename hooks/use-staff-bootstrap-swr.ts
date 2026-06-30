'use client';

import useSWR, { mutate as globalMutate } from 'swr';

import { fetchStaffBootstrap } from '@/lib/query/bootstrap-fetcher';
import { STAFF_BOOTSTRAP_KEY } from '@/types/staff-bootstrap';
import type { StaffBootstrapData, StaffBootstrapResponse } from '@/types/staff-bootstrap';

/** Shared SWR cache for staff bootstrap — one HTTP + one DB bundle per session. */
export function useStaffBootstrapSWR() {
  return useSWR<StaffBootstrapResponse>(STAFF_BOOTSTRAP_KEY, fetchStaffBootstrap, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 30_000,
    keepPreviousData: true,
  });
}

export function revalidateStaffBootstrap() {
  return globalMutate(STAFF_BOOTSTRAP_KEY);
}

export function selectStaffBootstrap(
  response: StaffBootstrapResponse | undefined
): StaffBootstrapData | null {
  return response?.data ?? null;
}
