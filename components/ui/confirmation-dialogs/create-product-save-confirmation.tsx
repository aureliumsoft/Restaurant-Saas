'use client';

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
import { Loader2, Plus, Save, X } from 'lucide-react';

interface CreateProductSaveConfirmationProps {
  open: boolean;
  itemName?: string;
  loading?: boolean;
  title?: string;
  description?: string;
  saveAndCloseText?: string;
  saveAndAddNewText?: string;
  onCancel: () => void;
  onSaveAndClose: () => void | Promise<void>;
  onSaveAndAddNew: () => void | Promise<void>;
}

export function CreateProductSaveConfirmation({
  open,
  itemName,
  loading = false,
  title,
  description = 'Choose how you want to save this new menu item.',
  saveAndCloseText = 'Save & close',
  saveAndAddNewText = 'Save & add new',
  onCancel,
  onSaveAndClose,
  onSaveAndAddNew,
}: CreateProductSaveConfirmationProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !loading) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {title ?? (itemName ? `Create "${itemName}"?` : 'Create product?')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="mt-0"
            >
              <X className="mr-2 h-4 w-4" />
              <span>Cancel</span>
            </AlertDialogCancel>
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => void onSaveAndAddNew()}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  <span>{saveAndAddNewText}</span>
                </>
              )}
            </Button>
            <Button
              type="button"
              disabled={loading}
              onClick={() => void onSaveAndClose()}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  <span>{saveAndCloseText}</span>
                </>
              )}
            </Button>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
