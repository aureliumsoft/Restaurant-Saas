'use client';

import { Crown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  size?: 'sm' | 'md';
  title?: string;
};

/** Crisp amber crown — keep outside faded/disabled opacity wrappers. */
export function PremiumCrown({ className, size = 'sm', title }: Props) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('premium.crownTitle');
  return (
    <span
      title={resolvedTitle}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-amber-400/80 bg-amber-400 text-amber-950 shadow-sm opacity-100',
        size === 'sm' ? 'h-5 w-5' : 'h-7 w-7',
        className
      )}
      aria-label={resolvedTitle}
    >
      <Crown
        className={cn(
          'fill-amber-950 text-amber-950',
          size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'
        )}
        strokeWidth={2}
        aria-hidden
      />
    </span>
  );
}
