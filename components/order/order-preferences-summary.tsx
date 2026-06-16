'use client';

import { MessageSquare, UtensilsCrossed } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

type OrderPreferencesSummaryProps = {
  cutlery: boolean;
  comment?: string;
  className?: string;
  /** When false, hide cutlery row if off (default). */
  alwaysShowCutlery?: boolean;
};

export function OrderPreferencesSummary({
  cutlery,
  comment,
  className,
  alwaysShowCutlery = false,
}: OrderPreferencesSummaryProps) {
  const { t } = useTranslation();
  const trimmedComment = comment?.trim() ?? '';
  const showCutlery = alwaysShowCutlery || cutlery;
  const showComment = trimmedComment.length > 0;

  if (!showCutlery && !showComment) return null;

  return (
    <div
      className={cn(
        'space-y-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm',
        className
      )}
    >
      {showCutlery ? (
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-muted-foreground">
            <UtensilsCrossed className="h-4 w-4 shrink-0" aria-hidden />
            {t('cutlery')}
          </span>
          <span className="font-medium">{cutlery ? t('yes') : t('no')}</span>
        </div>
      ) : null}
      {showComment ? (
        <div className="flex items-start gap-2">
          <MessageSquare
            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              {t('comment')}
            </p>
            <p className="whitespace-pre-wrap text-sm">{trimmedComment}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
