'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';

import { Sparkline, sparklineTrendPercent } from '@/components/ui/sparkline';
import { cn } from '@/lib/utils';

type AnalyticsKpiCardProps = {
  title: string;
  subtitle: string;
  value: string;
  sparklineData: number[];
  accentColor: string;
  icon: ComponentType<{ className?: string }>;
  href: string;
  daysLabel?: string;
};

export function AnalyticsKpiCard({
  title,
  subtitle,
  value,
  sparklineData,
  accentColor,
  icon: Icon,
  href,
  daysLabel = '30 days',
}: AnalyticsKpiCardProps) {
  const trend = sparklineTrendPercent(sparklineData);
  const trendUp = trend >= 0;

  return (
    <Link
      href={href}
      className="group block rounded-2xl outline-none ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative h-full overflow-hidden rounded-3xl bg-white/85 p-4 shadow-[0_12px_40px_-16px_rgba(15,23,42,0.18),0_0_0_1px_rgba(240,90,32,0.06)] backdrop-blur-xl transition-all group-hover:shadow-[0_18px_50px_-18px_rgba(240,90,32,0.22)] dark:bg-zinc-950/75 dark:shadow-[0_16px_48px_-18px_rgba(0,0,0,0.75),0_0_0_1px_rgba(240,90,32,0.14)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </div>
        </div>

        <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight">
          {value}
        </p>

        <div className="mt-3 -mx-1">
          <Sparkline data={sparklineData} color={accentColor} height={40} />
        </div>

        <p
          className={cn(
            'mt-2 text-xs font-medium',
            trendUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          )}
        >
          {trendUp ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}% vs last {daysLabel}
        </p>
      </div>
    </Link>
  );
}
