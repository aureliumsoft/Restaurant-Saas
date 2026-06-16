'use client';

import { UtensilsCrossed } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

type OrderCustomerExtrasProps = {
  cutleryRequested?: boolean | null;
  customerComment?: string | null;
  className?: string;
  compact?: boolean;
};

/** Staff-facing cutlery + comment block (KDS, sales order detail). */
export function OrderCustomerExtras({
  cutleryRequested,
  customerComment,
  className,
  compact = false,
}: OrderCustomerExtrasProps) {
  const { t } = useTranslation();
  const comment = customerComment?.trim() ?? '';
  const hasCutlery = cutleryRequested === true;
  const hasComment = comment.length > 0;

  if (!hasCutlery && !hasComment) return null;

  return (
    <div
      className={cn(
        'rounded-md border border-amber-200/80 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-950/30',
        compact ? 'px-2.5 py-2 text-xs' : 'px-3 py-2.5 text-sm',
        className
      )}
    >
      {hasCutlery ? (
        <p className="flex items-center gap-2 font-medium text-amber-950 dark:text-amber-100">
          <UtensilsCrossed className="h-4 w-4 shrink-0" aria-hidden />
          {t('cutlery')}: {t('yes')}
        </p>
      ) : null}
      {hasComment ? (
        <p
          className={cn(
            'whitespace-pre-wrap text-amber-900/90 dark:text-amber-100/90',
            hasCutlery && 'mt-1.5'
          )}
        >
          <span className="font-medium">{t('comment')}: </span>
          {comment}
        </p>
      ) : null}
    </div>
  );
}
