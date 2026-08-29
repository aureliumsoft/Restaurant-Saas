'use client';

import { Loader2, PlayCircle } from 'lucide-react';

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
            Start your shift?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {branchName
              ? `Start a shift at ${branchName} before taking orders.`
              : 'Start a shift before taking orders at this branch.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading} onClick={onDismiss}>
            Not now
          </AlertDialogCancel>
          <Button disabled={loading} onClick={onStart}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting…
              </>
            ) : (
              'Start shift'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
