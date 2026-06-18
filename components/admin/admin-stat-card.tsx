'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';

import { adminStatCardClass } from '@/components/admin/admin-surface';
import { Sparkline, kpiSparklineFromValue } from '@/components/ui/sparkline';
import { cn } from '@/lib/utils';

type AdminStatCardProps = {
  title: string;
  subtitle: string;
  value: number | string;
  accentColor: string;
  icon: ComponentType<{ className?: string }>;
  href?: string;
  badge?: string;
  className?: string;
};

export function AdminStatCard({
  title,
  subtitle,
  value,
  accentColor,
  icon: Icon,
  href,
  badge,
  className,
}: AdminStatCardProps) {
  const numericValue = typeof value === 'number' ? value : parseFloat(value) || 0;
  const sparklineData = kpiSparklineFromValue(numericValue);

  const content = (
    <div
      className={cn(
        adminStatCardClass,
        'relative h-full overflow-hidden p-5 transition-all duration-200',
        href && 'group-hover:-translate-y-0.5',
        className
      )}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-25 blur-3xl"
        style={{ backgroundColor: accentColor }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${accentColor}14`, color: accentColor }}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>

      <div className="relative mt-4 flex items-end justify-between gap-3">
        <p className="text-3xl font-bold tabular-nums tracking-tight">{value}</p>
        {badge ? (
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: `${accentColor}14`, color: accentColor }}
          >
            {badge}
          </span>
        ) : null}
      </div>

      <div className="relative mt-3 -mx-1 opacity-60">
        <Sparkline data={sparklineData} color={accentColor} height={36} />
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {content}
      </Link>
    );
  }

  return content;
}
