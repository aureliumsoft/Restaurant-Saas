'use client';

import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import UserMenu from '@/components/dashboard/UserMenu';
import { PosLogoutShiftDialog } from '@/components/pos/pos-logout-shift-dialog';
import { useShiftAwareLogout } from '@/hooks/use-shift-aware-logout';

type UserMenuProps = ComponentProps<typeof UserMenu>;

export function ShiftAwareUserMenu(props: UserMenuProps) {
  const { t } = useTranslation();
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
        title={t('dashboard.userMenu.shiftSignOutTitle')}
        description={t('dashboard.userMenu.shiftSignOutDescription')}
        onLogoutOnly={handleLogoutOnly}
        onEndShiftAndLogout={handleLogoutEndShift}
      />
    </>
  );
}
