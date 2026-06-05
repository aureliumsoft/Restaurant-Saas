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
import { Loader2, Plus, X } from 'lucide-react';

interface AddVariationConfirmationProps {
  open: boolean;
  variationName: string;
  shortLabel?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function AddVariationConfirmation({
  open,
  variationName,
  shortLabel,
  loading = false,
  onConfirm,
  onCancel,
}: AddVariationConfirmationProps) {
  const confirmClickedRef = React.useRef(false);
  const trimmed = variationName.trim();
  const label = shortLabel?.trim();

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
          <AlertDialogTitle>
            {trimmed ? `Add variation "${trimmed}"?` : 'Add variation'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            This creates a size template you can assign on products and
            configuration add-ons.
            {label ? (
              <>
                {' '}
                Short label: <strong>{label}</strong>.
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button" onClick={onCancel} disabled={loading}>
            <X className="mr-2 h-4 w-4" aria-hidden />
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            type="button"
            disabled={loading || !trimmed}
            onClick={() => {
              confirmClickedRef.current = true;
              void onConfirm();
            }}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                <span>Adding…</span>
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                <span>Add variation</span>
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
