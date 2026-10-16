'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Crown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PremiumCrown } from '@/components/premium/premium-crown';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  /** When true, children are locked. */
  locked: boolean;
  children: ReactNode;
  className?: string;
  upgradeHref?: string;
  label?: string;
  /**
   * `overlay` — blurred content + Upgrade CTA (default).
   * `crown` — muted/disabled content + corner crown only (no Upgrade popup).
   */
  variant?: 'overlay' | 'crown';
};

export function PremiumGate({
  locked,
  children,
  className,
  upgradeHref = '/pricing',
  label,
  variant = 'overlay',
}: Props) {
  const { t } = useTranslation();
  if (!locked) return <>{children}</>;

  if (variant === 'crown') {
    return (
      <div
        className={cn('relative', className)}
        aria-disabled
        title={label ?? t('premium.upgradeRequired')}
      >
        <div
          className="pointer-events-none select-none opacity-50 grayscale-[0.35]"
          aria-hidden
        >
          {children}
        </div>
        <span className="absolute right-2 top-2 z-10">
          <PremiumCrown size="sm" />
        </span>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      <div
        className="pointer-events-none select-none blur-sm opacity-60"
        aria-hidden
      >
        {children}
      </div>
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/40 p-4 backdrop-blur-[2px]">
        <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl  bg-white/95 px-6 py-5 text-center shadow-lg  dark:bg-zinc-950/95">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Crown className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {label ?? t('premium.upgradeRequired')}
          </p>
          <Button
            asChild
            className="bg-gradient-to-r from-fire-500 to-fire-600 text-white hover:from-fire-400 hover:to-fire-500"
          >
            <Link href={upgradeHref}>{t('premium.upgrade')}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
