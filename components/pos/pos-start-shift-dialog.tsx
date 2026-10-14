'use client';

import { Loader2, PlayCircle } from 'lucide-react';
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
  loading?: boolean;
  branchName?: string | null;
  onStart: () => void;
  onDismiss: () => void;
};

export function PosStartShiftDialog({
  open,
  loading = false,
  branchName,
  onStart,
  onDismiss,
}: Props) {
  const { t } = useTranslation();
  return (
    <AlertDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !loading) onDismiss();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-primary" />
            {t('pos.dialogs.startShift.title')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {branchName
              ? t('pos.dialogs.startShift.descriptionWithBranch', { branchName })
              : t('pos.dialogs.startShift.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading} onClick={onDismiss}>
            {t('pos.dialogs.startShift.notNow')}
          </AlertDialogCancel>
          <Button disabled={loading} onClick={onStart}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('pos.dialogs.startShift.starting')}
              </>
            ) : (
              t('pos.dialogs.startShift.startShift')
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
