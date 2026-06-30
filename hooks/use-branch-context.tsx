'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import axios from 'axios';

import eventBus from '@/lib/even';
import type { BranchOption } from '@/lib/branch/branch-scope';
import {
  revalidateStaffBootstrap,
  useStaffBootstrapSWR,
} from '@/hooks/use-staff-bootstrap-swr';

type BranchContextValue = {
  loading: boolean;
  branches: BranchOption[];
  activeBranchId: string | null;
  canSwitchBranch: boolean;
  isOwnerOrAdmin: boolean;
  setActiveBranch: (branchId: string) => Promise<void>;
  branchQuery: string;
  reload: () => Promise<void>;
};

const BranchContext = createContext<BranchContextValue | null>(null);

const emptyBranchValue: BranchContextValue = {
  loading: false,
  branches: [],
  activeBranchId: null,
  canSwitchBranch: false,
  isOwnerOrAdmin: false,
  setActiveBranch: async () => {},
  branchQuery: '',
  reload: async () => {},
};

/** Branch scope from shared staff bootstrap cache (no separate API call). */
export function BranchProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, mutate } = useStaffBootstrapSWR();
  const scope = data?.data?.branchScope ?? null;

  useEffect(() => {
    const onConfig = () => void mutate();
    eventBus.on('realtime:config.branding', onConfig);
    eventBus.on('realtime:config.regional', onConfig);
    return () => {
      eventBus.removeListener('realtime:config.branding', onConfig);
      eventBus.removeListener('realtime:config.regional', onConfig);
    };
  }, [mutate]);

  const reload = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const setActiveBranch = useCallback(
    async (branchId: string) => {
      await axios.post('/api/me/active-branch', { branchId });
      await revalidateStaffBootstrap();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('branch-changed', { detail: { branchId } })
        );
      }
    },
    []
  );

  const activeBranchId = scope?.activeBranchId ?? null;
  const branchQuery = activeBranchId
    ? `branchId=${encodeURIComponent(activeBranchId)}`
    : '';

  const value = useMemo<BranchContextValue>(
    () => ({
      loading: isLoading && !data,
      branches: scope?.branches ?? [],
      activeBranchId,
      canSwitchBranch: Boolean(scope?.canSwitchBranch),
      isOwnerOrAdmin: Boolean(scope?.isOwnerOrAdmin),
      setActiveBranch,
      branchQuery,
      reload,
    }),
    [
      isLoading,
      data,
      scope,
      activeBranchId,
      setActiveBranch,
      branchQuery,
      reload,
    ]
  );

  return (
    <BranchContext.Provider value={value}>{children}</BranchContext.Provider>
  );
}

export function useBranchContext() {
  const ctx = useContext(BranchContext);
  if (!ctx) {
    return emptyBranchValue;
  }
  return ctx;
}

/** Append branchId to API URLs when an active branch is set. */
export function withBranchQuery(url: string, branchId: string | null) {
  if (!branchId) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}branchId=${encodeURIComponent(branchId)}`;
}
