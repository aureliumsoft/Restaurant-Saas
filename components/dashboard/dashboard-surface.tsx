import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** Flat section surface — matches admin panel styling. */
export const dashboardSectionClass =
  'rounded-2xl bg-zinc-50/90 dark:bg-zinc-800/35';

const dashboardCardShadowClass =
  'shadow-[0_2px_16px_-4px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_16px_-4px_rgba(0,0,0,0.35)]';

export const dashboardCardClass = cn(
  'rounded-2xl border border-border/50 bg-card text-card-foreground',
  dashboardCardShadowClass,
  'transition-[box-shadow,border-color] duration-200 dark:border-border/40'
);

export const dashboardGridCardClass = cn(
  dashboardCardClass,
  'dashboard-grid-card overflow-hidden hover:border-primary/20 hover:shadow-md'
);

export const dashboardNestedCardClass = cn(
  'dashboard-nested-card rounded-xl border border-border/40 bg-muted/25 text-card-foreground shadow-none',
  'dark:border-border/30 dark:bg-muted/15'
);

export const dashboardStatCardClass = cn(
  'dashboard-stat-card rounded-xl border border-border/50 bg-gradient-to-br from-card to-muted/30 text-card-foreground',
  'shadow-sm transition-[box-shadow,border-color] duration-200',
  'dark:from-card dark:to-muted/20'
);

export const dashboardCardHeaderClass =
  'border-b border-border/40 bg-muted/20 pb-5 dark:bg-muted/10';

export const dashboardCardTitleClass = 'text-base font-semibold tracking-tight';

export const dashboardCardDescriptionClass = 'text-sm leading-relaxed';

export const dashboardInsetClass =
  'rounded-xl bg-white/60 dark:bg-zinc-900/40';

export function dashboardNavGroupLabelClass() {
  return 'mb-1.5 px-3 text-xs font-medium text-muted-foreground';
}

type DashboardSectionProps = {
  children: ReactNode;
  className?: string;
};

export function DashboardSection({ children, className }: DashboardSectionProps) {
  return (
    <section className={cn(dashboardSectionClass, 'min-w-0 max-w-full', className)}>
      {children}
    </section>
  );
}

type DashboardSectionHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function DashboardSectionHeader({
  title,
  description,
  action,
  className,
}: DashboardSectionHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-3 p-5 pb-3', className)}>
      <div className="space-y-0.5">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function DashboardSectionBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('px-5 pb-5', className)}>{children}</div>;
}
