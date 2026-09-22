'use client';

import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, X } from 'lucide-react';

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
import { cn } from '@/lib/utils';

export type KdsOrderActionKind = 'proceed' | 'complete' | 'cancel';

type Props = {
  open: boolean;
  kind: KdsOrderActionKind;
  itemName?: string;
  detail?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  iconCancel?: React.ReactNode;
  iconConfirm?: React.ReactNode;
  iconLoading?: React.ReactNode;
};

export function KdsOrderActionDialog({
  open,
  kind,
  itemName,
  detail,
  loading = false,
  onConfirm,
  onCancel,
  iconCancel = <X className="mr-2 h-4 w-4" />,
  iconConfirm = <Check className="mr-2 h-4 w-4" />,
  iconLoading = <Loader2 className="mr-2 h-4 w-4 animate-spin" />,
}: Props) {
  const confirmClickedRef = useRef(false);
  const { t } = useTranslation();
  const isDestructive = kind === 'cancel';

  const title = itemName
    ? kind === 'proceed'
      ? t('kds.actionProceedWithToken', { name: itemName })
      : kind === 'complete'
        ? t('kds.actionCompleteWithToken', { name: itemName })
        : t('kds.actionCancelWithToken', { name: itemName })
    : kind === 'proceed'
      ? t('kds.actionProceedTitle')
      : kind === 'complete'
        ? t('kds.actionCompleteTitle')
        : t('kds.actionCancelTitle');

  const description =
    kind === 'proceed'
      ? t('kds.actionProceedDescription')
      : kind === 'complete'
        ? t('kds.actionCompleteDescription')
        : t('kds.actionCancelDescription');

  const confirmLabel =
    kind === 'proceed'
      ? t('kds.proceed')
      : kind === 'complete'
        ? t('kds.complete')
        : t('kds.cancelOrder');

  const loadingLabel =
    kind === 'proceed'
      ? t('kds.proceeding')
      : kind === 'complete'
        ? t('kds.completing')
        : t('kds.canceling');

  return (
    <AlertDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          if (!loading && !confirmClickedRef.current) onCancel();
          confirmClickedRef.current = false;
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
            {detail ? (
              <>
                <br />
                <span className="mt-2 block font-medium text-foreground">
                  {detail}
                </span>
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button" onClick={onCancel} disabled={loading}>
            <X className="mr-2 h-4 w-4" />
            {t('kds.stay')}
          </AlertDialogCancel>
          <AlertDialogAction
            type="button"
            disabled={loading}
            className={cn(
              isDestructive &&
                'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            )}
            onClick={() => {
              confirmClickedRef.current = true;
              void onConfirm();
            }}
          >
            {loading ? (
              <>
                {iconLoading}
                {loadingLabel}
              </>
            ) : (
              <>
                {iconConfirm}
                {confirmLabel}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
