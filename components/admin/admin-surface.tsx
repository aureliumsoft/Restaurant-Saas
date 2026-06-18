import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** Flat section surface — no borders or rings. */
export const adminSectionClass =
  'rounded-2xl bg-zinc-50/90 dark:bg-zinc-800/35';

export const adminCardClass = cn(adminSectionClass, 'border-0 shadow-none');

export const adminInsetClass =
  'rounded-xl bg-white/60 dark:bg-zinc-900/40';

export const adminStatCardClass =
  'rounded-2xl bg-white dark:bg-zinc-900/60 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_16px_-4px_rgba(0,0,0,0.35)]';

export function adminNavGroupLabelClass() {
  return 'mb-1.5 px-3 text-xs font-medium text-muted-foreground';
}

type AdminSectionProps = {
  children: ReactNode;
  className?: string;
};

export function AdminSection({ children, className }: AdminSectionProps) {
  return <section className={cn(adminSectionClass, 'min-w-0 max-w-full', className)}>{children}</section>;
}

type AdminSectionHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function AdminSectionHeader({
  title,
  description,
  action,
  className,
}: AdminSectionHeaderProps) {
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

export function AdminSectionBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('px-5 pb-5', className)}>{children}</div>;
}
