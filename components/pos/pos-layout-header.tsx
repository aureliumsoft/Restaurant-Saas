'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutDashboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ModeToggle } from '@/components/darkmode/darkmode';
import UserMenu from '@/components/dashboard/UserMenu';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { OperationalHeaderRestaurantBrand } from '@/components/layout/operational-header-restaurant-brand';
import { usePosCartGuard } from '@/components/pos/pos-cart-guard-context';

export function PosLayoutHeader() {
  const { t } = useTranslation();
  const router = useRouter();
  const { posCartHasItems } = usePosCartGuard();
  const [leaveOpen, setLeaveOpen] = useState(false);

  const requestDashboard = () => {
    if (posCartHasItems) {
      setLeaveOpen(true);
      return;
    }
    router.push('/dashboard');
  };

  const confirmLeaveToDashboard = () => {
    setLeaveOpen(false);
    router.push('/dashboard');
  };

  return (
    <header
      className="flex h-14 shrink-0 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/60"
      aria-label={t('pos.toolbar.pointOfSale')}
    >
      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('pos.dialogs.discardCart.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('pos.dialogs.discardCart.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">{t('pos.dialogs.discardCart.stayOnPos')}</AlertDialogCancel>
            <AlertDialogAction type="button" onClick={confirmLeaveToDashboard}>
              {t('pos.dialogs.discardCart.leaveAndLoseCart')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <OperationalHeaderRestaurantBrand />
        <Button
          type="button"
          variant="ghost"
          className="hidden gap-1.5 text-muted-foreground sm:inline-flex"
          title={t('pos.backToDashboard')}
          onClick={requestDashboard}
        >
          <LayoutDashboard className="h-4 w-4" />
          {t('pos.toolbar.dashboard')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="sm:hidden"
          aria-label={t('pos.toolbar.dashboard')}
          onClick={requestDashboard}
        >
          <LayoutDashboard className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ModeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
