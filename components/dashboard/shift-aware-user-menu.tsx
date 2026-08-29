'use client';

import type { ComponentProps } from 'react';

import UserMenu from '@/components/dashboard/UserMenu';
import { PosLogoutShiftDialog } from '@/components/pos/pos-logout-shift-dialog';
import { useShiftAwareLogout } from '@/hooks/use-shift-aware-logout';

type UserMenuProps = ComponentProps<typeof UserMenu>;

export function ShiftAwareUserMenu(props: UserMenuProps) {
  const {
    logoutChoiceOpen,
    setLogoutChoiceOpen,
    checkingShift,
    requestLogout,
    handleLogoutOnly,
    handleLogoutEndShift,
  } = useShiftAwareLogout();

  return (
    <>
      <UserMenu
        {...props}
        onLogout={requestLogout}
        logoutLoading={checkingShift}
      />
      <PosLogoutShiftDialog
        open={logoutChoiceOpen}
        onOpenChange={setLogoutChoiceOpen}
        title="Sign out?"
        description="You have an active POS shift. Log out without ending your shift, or go to POS to end your shift (cash reconciliation and print) and then sign out."
        onLogoutOnly={handleLogoutOnly}
        onEndShiftAndLogout={handleLogoutEndShift}
      />
    </>
  );
}
