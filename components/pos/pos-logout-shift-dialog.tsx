'use client';

import { LogOut, DoorOpen } from 'lucide-react';

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
  title = 'Leave POS?',
  description = 'You have an active shift. Log out without ending your shift, or end your shift first (cash reconciliation and print) and then sign out.',
  onLogoutOnly,
  onEndShiftAndLogout,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5 text-muted-foreground" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
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
            Logout only
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
            End shift &amp; logout
          </Button>
          <AlertDialogCancel className="mt-0 w-full">Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
