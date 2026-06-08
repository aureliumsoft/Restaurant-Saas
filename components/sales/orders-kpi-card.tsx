'use client';

import type { ComponentType, ReactNode } from 'react';

import {
  kpiSparklineFromValue,
  Sparkline,
  sparklineTrendPercent,
} from '@/components/ui/sparkline';
import { cn } from '@/lib/utils';

export { kpiSparklineFromValue };

type OrdersKpiCardProps = {
  label: string;
  value: ReactNode;
  sparklineData: number[];
  accentColor: string;
  icon: ComponentType<{ className?: string }>;
  loading?: boolean;
};

export function OrdersKpiCard({
  label,
  value,
  sparklineData,
  accentColor,
  icon: Icon,
  loading,
}: OrdersKpiCardProps) {
  const trend = sparklineTrendPercent(sparklineData);
  const trendUp = trend >= 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
            {loading ? '…' : value}
          </p>
        </div>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl dark:shadow-[0_0_20px_-4px]"
          style={{
            backgroundColor: `${accentColor}18`,
            color: accentColor,
            boxShadow: `0 0 16px -6px ${accentColor}44`,
          }}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>

      <div className="mt-4 opacity-90">
        <Sparkline data={sparklineData} color={accentColor} height={36} />
      </div>

      <p
        className={cn(
          'mt-2 text-xs font-medium',
          trendUp
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-rose-600 dark:text-rose-400'
        )}
      >
        {trendUp ? '+' : ''}
        {trend.toFixed(1)}% vs yesterday
      </p>
    </div>
  );
}
