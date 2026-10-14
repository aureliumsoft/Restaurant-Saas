'use client';

import { LogOut, DoorOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  onLogoutOnly: () => void;
  onEndShiftAndLogout: () => void;
};

export function PosLogoutShiftDialog({
  open,
  onOpenChange,
  title,
  description,
  onLogoutOnly,
  onEndShiftAndLogout,
}: Props) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('pos.dialogs.leavePos.title');
  const resolvedDescription = description ?? t('pos.dialogs.leavePos.description');
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5 text-muted-foreground" />
            {resolvedTitle}
          </AlertDialogTitle>
          <AlertDialogDescription>{resolvedDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              onLogoutOnly();
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t('pos.dialogs.leavePos.logoutOnly')}
          </Button>
          <Button
            type="button"
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              onEndShiftAndLogout();
            }}
          >
            <DoorOpen className="mr-2 h-4 w-4" />
            {t('pos.dialogs.leavePos.endShiftAndLogout')}
          </Button>
          <AlertDialogCancel className="mt-0 w-full">{t('pos.dialogs.leavePos.cancel')}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
