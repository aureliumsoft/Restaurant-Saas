'use client';

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { PremiumCrown } from '@/components/premium/premium-crown';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  /** When true, render disabled control + crown instead of children. */
  locked: boolean;
  children: ReactNode;
  label?: string;
  className?: string;
};

/**
 * Wrap primary “Add …” actions: locked → inert button with a crisp crown.
 * Avoids native `disabled:opacity-50` so the crown stays sharp.
 */
export function PremiumDisabledControl({
  locked,
  children,
  label,
  className,
}: Props) {
  const { t } = useTranslation();
  if (!locked) return <>{children}</>;

  return (
    <Button
      type="button"
      variant="outline"
      aria-disabled
      tabIndex={-1}
      onClick={(e) => e.preventDefault()}
      className={cn(
        'pointer-events-none gap-2 border-amber-300/70 bg-amber-50/50 text-muted-foreground',
        className
      )}
    >
      <PremiumCrown />
      <span className="opacity-80">{label ?? t('premium.upgradeToAddMore')}</span>
    </Button>
  );
}
