'use client';

import {
  selectStaffBootstrap,
  useStaffBootstrapSWR,
} from '@/hooks/use-staff-bootstrap-swr';
import type { StaffBootstrapData } from '@/types/staff-bootstrap';

/** Shared SWR cache for slow/config restaurant data. */
export function useBootstrapConfig() {
  const swr = useStaffBootstrapSWR();
  return {
    ...swr,
    bootstrap: selectStaffBootstrap(swr.data),
  };
}

export function useStaffBootstrapData(): {
  data: StaffBootstrapData | null;
  loading: boolean;
  error: Error | undefined;
  refresh: () => Promise<StaffBootstrapData | null | undefined>;
} {
  const { data, error, isLoading, mutate } = useStaffBootstrapSWR();
  return {
    data: selectStaffBootstrap(data),
    loading: isLoading && !data,
    error,
    refresh: async () => {
      const next = await mutate();
      return selectStaffBootstrap(next);
    },
  };
}
