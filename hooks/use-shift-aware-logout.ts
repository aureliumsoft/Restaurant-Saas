'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';

import { fetchPosShiftSummary } from '@/components/pos/pos-shift-sheet';
import { useBranchContext } from '@/hooks/use-branch-context';
import { clearStaffBootstrapSessionCache } from '@/lib/query/bootstrap-fetcher';

type Options = {
  /** Branch to check for an open shift (defaults to active branch from context). */
  branchId?: string | null;
  /** Navigate to POS and open end-shift sheet (dashboard logout flow). */
  endShiftRoute?: string;
  /** POS inline handler — opens end-shift sheet without navigation. */
  onEndShiftAndLogout?: () => void;
  callbackUrl?: string;
};

export function useShiftAwareLogout(options?: Options) {
  const router = useRouter();
  const { activeBranchId } = useBranchContext();
  const [logoutChoiceOpen, setLogoutChoiceOpen] = useState(false);
  const [checkingShift, setCheckingShift] = useState(false);

  const callbackUrl = options?.callbackUrl ?? '/login';
  const endShiftRoute = options?.endShiftRoute ?? '/pos?endShiftLogout=1';
  const onEndShiftAndLogout = options?.onEndShiftAndLogout;
  const resolveBranchId = options?.branchId ?? activeBranchId;

  const handleLogoutOnly = useCallback(() => {
    clearStaffBootstrapSessionCache();
    void signOut({ callbackUrl });
  }, [callbackUrl]);

  const handleLogoutEndShift = useCallback(() => {
    if (onEndShiftAndLogout) {
      onEndShiftAndLogout();
      return;
    }
    router.push(endShiftRoute);
  }, [endShiftRoute, onEndShiftAndLogout, router]);

  const requestLogout = useCallback(async () => {
    const branchId = resolveBranchId?.trim() || null;
    if (!branchId) {
      clearStaffBootstrapSessionCache();
      void signOut({ callbackUrl });
      return;
    }

    setCheckingShift(true);
    try {
      const summary = await fetchPosShiftSummary(branchId);
      if (summary.id) {
        setLogoutChoiceOpen(true);
        return;
      }
    } catch {
      // fall through to sign out
    } finally {
      setCheckingShift(false);
    }

    clearStaffBootstrapSessionCache();
    void signOut({ callbackUrl });
  }, [callbackUrl, resolveBranchId]);

  return {
    logoutChoiceOpen,
    setLogoutChoiceOpen,
    checkingShift,
    requestLogout,
    handleLogoutOnly,
    handleLogoutEndShift,
  };
}
