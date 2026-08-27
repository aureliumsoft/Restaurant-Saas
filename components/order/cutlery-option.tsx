'use client';

import { UtensilsCrossed } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

type CutleryOptionProps = {
  value: boolean;
  onChange: (next: boolean) => void;
  className?: string;
};

export function CutleryOption({ value, onChange, className }: CutleryOptionProps) {
  const { t } = useTranslation();

  return (
    <div className={cn('flex items-center justify-between gap-4 py-2', className)}>
      <div className="flex min-w-0 items-start gap-3">
        <UtensilsCrossed
          className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{t('cutlery')}</h3>
          <p className="text-xs text-muted-foreground">{t('cutleryHint')}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={cn(
            'min-w-[2rem] text-right text-xs font-semibold tabular-nums',
            value ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          {value ? t('yes') : t('no')}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={value}
          aria-label={t('cutlery')}
          onClick={() => onChange(!value)}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            value ? 'bg-primary' : 'bg-muted'
          )}
        >
          <span
          className={cn(
            'pointer-events-none block h-5 w-5 rounded-full bg-white shadow transition-transform',
            value ? 'translate-x-5' : 'translate-x-0'
          )}
          />
        </button>
      </div>
    </div>
  );
}
