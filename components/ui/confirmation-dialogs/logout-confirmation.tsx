'use client';

import * as React from 'react';
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
import { Loader2, LogOut, X } from 'lucide-react';

interface LogoutConfirmationProps {
  open: boolean;
  title?: string;
  description?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export function LogoutConfirmation({
  open,
  title = 'Sign out?',
  description = 'You will be signed out of your account and returned to the home page.',
  loading = false,
  onConfirm,
  onCancel,
  confirmText = 'Sign out',
  cancelText = 'Cancel',
}: LogoutConfirmationProps) {
  const confirmClickedRef = React.useRef(false);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          if (!loading && !confirmClickedRef.current) {
            onCancel();
          }
          confirmClickedRef.current = false;
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5 text-muted-foreground" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={loading}>
            <X className="mr-2 h-4 w-4" />
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              confirmClickedRef.current = true;
              void onConfirm();
            }}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>Signing out...</span>
              </>
            ) : (
              <>
                <LogOut className="mr-2 h-4 w-4" />
                <span>{confirmText}</span>
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
