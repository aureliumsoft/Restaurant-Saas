'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import axios from 'axios';

import type { BranchOption } from '@/lib/branch/branch-scope';

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

export function BranchProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [canSwitchBranch, setCanSwitchBranch] = useState(false);
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get<{
        data?: {
          branches?: BranchOption[];
          activeBranchId?: string | null;
          canSwitchBranch?: boolean;
          isOwnerOrAdmin?: boolean;
        };
      }>('/api/me/branch-context');
      const d = res.data.data;
      setBranches(d?.branches ?? []);
      setActiveBranchId(d?.activeBranchId ?? null);
      setCanSwitchBranch(Boolean(d?.canSwitchBranch));
      setIsOwnerOrAdmin(Boolean(d?.isOwnerOrAdmin));
    } catch {
      setBranches([]);
      setActiveBranchId(null);
      setCanSwitchBranch(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setActiveBranch = useCallback(async (branchId: string) => {
    await axios.post('/api/me/active-branch', { branchId });
    setActiveBranchId(branchId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('branch-changed', { detail: { branchId } }));
    }
  }, []);

  const branchQuery = activeBranchId
    ? `branchId=${encodeURIComponent(activeBranchId)}`
    : '';

  const value = useMemo(
    () => ({
      loading,
      branches,
      activeBranchId,
      canSwitchBranch,
      isOwnerOrAdmin,
      setActiveBranch,
      branchQuery,
      reload: load,
    }),
    [
      loading,
      branches,
      activeBranchId,
      canSwitchBranch,
      isOwnerOrAdmin,
      setActiveBranch,
      branchQuery,
      load,
    ]
  );

  return (
    <BranchContext.Provider value={value}>{children}</BranchContext.Provider>
  );
}

export function useBranchContext() {
  const ctx = useContext(BranchContext);
  if (!ctx) {
    return {
      loading: false,
      branches: [],
      activeBranchId: null,
      canSwitchBranch: false,
      isOwnerOrAdmin: false,
      setActiveBranch: async () => {},
      branchQuery: '',
      reload: async () => {},
    };
  }
  return ctx;
}

/** Append branchId to API URLs when an active branch is set. */
export function withBranchQuery(url: string, branchId: string | null) {
  if (!branchId) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}branchId=${encodeURIComponent(branchId)}`;
}
