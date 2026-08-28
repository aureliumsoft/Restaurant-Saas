import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** Flat section surface — transparent over fire mesh. */
export const dashboardSectionClass = 'rounded-3xl bg-transparent';

const dashboardCardShadowClass =
  'shadow-[0_12px_40px_-16px_rgba(15,23,42,0.18),0_0_0_1px_rgba(240,90,32,0.06)] dark:shadow-[0_16px_48px_-18px_rgba(0,0,0,0.75),0_0_0_1px_rgba(240,90,32,0.14)]';

export const dashboardCardClass = cn(
  'rounded-3xl border-0 bg-white/85 text-card-foreground backdrop-blur-xl dark:bg-zinc-950/75',
  dashboardCardShadowClass,
  'transition-shadow duration-200'
);

export const dashboardGridCardClass = cn(
  dashboardCardClass,
  'dashboard-grid-card overflow-hidden hover:shadow-[0_18px_50px_-18px_rgba(240,90,32,0.22)]'
);

export const dashboardNestedCardClass = cn(
  'dashboard-nested-card rounded-2xl border-0 bg-fire-500/[0.06] text-card-foreground shadow-none',
  'dark:bg-fire-500/10'
);

export const dashboardStatCardClass = cn(
  'dashboard-stat-card rounded-2xl border-0 bg-gradient-to-br from-white/90 to-fire-50/60 text-card-foreground backdrop-blur-xl',
  'shadow-[0_10px_32px_-14px_rgba(15,23,42,0.16),0_0_0_1px_rgba(240,90,32,0.08)] transition-shadow duration-200',
  'dark:from-zinc-950/80 dark:to-fire-950/40 dark:shadow-[0_14px_40px_-16px_rgba(0,0,0,0.7),0_0_0_1px_rgba(240,90,32,0.16)]'
);

export const dashboardCardHeaderClass = 'border-0 bg-transparent pb-4';

export const dashboardCardTitleClass = 'text-base font-semibold tracking-tight';

export const dashboardCardDescriptionClass = 'text-sm leading-relaxed';

export const dashboardInsetClass =
  'rounded-2xl bg-fire-500/[0.06] dark:bg-fire-500/10';

export function dashboardNavGroupLabelClass() {
  return 'mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70';
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
