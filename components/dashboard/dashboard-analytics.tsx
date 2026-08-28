'use client';

import axios from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  useBranchContext,
  withBranchQuery,
} from '@/hooks/use-branch-context';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { useStaffRestaurantBranding } from '@/hooks/use-staff-permissions';
import { useOwnerRestaurantRegional } from '@/hooks/use-restaurant-regional';
import { getRestaurantCurrencySymbol } from '@/lib/restaurant-regional';
import { kioskBasePath } from '@/lib/kiosk-path';
import { restaurantStorefrontPath } from '@/lib/customer-storefront-paths';
import { cn } from '@/lib/utils';
import { IconExternalLink } from '@tabler/icons-react';
import {
  ChefHat,
  Clock3,
  Loader2,
  Receipt,
  ShoppingBag,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react';

type SeriesPoint = {
  day: string;
  orders: number;
  revenue: number;
  onlineOrders: number;
  posOrders: number;
  kioskOrders: number;
  onlineRevenue: number;
  posRevenue: number;
  kioskRevenue: number;
};

type HourlyPoint = { hour: number; label: string; orders: number };
type TopItem = { name: string; quantity: number; revenue: number };

type AnalyticsPayload = {
  series: SeriesPoint[];
  days?: 7 | 14 | 30 | 1;
  channelTotals?: {
    orders: { online: number; pos: number; kiosk: number };
    revenue: { online: number; pos: number; kiosk: number };
  };
  hourlyOrders?: HourlyPoint[];
  topItems?: TopItem[];
  paymentMix?: { cash: number; card: number; other: number };
  ops?: {
    kdsOpen: number;
    openTableTabs: number;
    orderDisplayQueue: number;
    canceledOrders: number;
    revenueOrders: number;
    peakHour: number | null;
    peakHourLabel: string | null;
    peakHourOrders: number;
  };
  analyticsTier?: 'basic' | 'advanced';
  activeBranchId?: string | null;
  activeBranchName?: string | null;
  branchScoped?: boolean;
  dataScope?: 'all' | 'today';
};

const DAY_OPTIONS: Array<7 | 14 | 30> = [7, 14, 30];
const CHANNEL_COLORS = {
  online: '#F05A20',
  pos: '#FF8A4C',
  kiosk: '#9A3412',
} as const;
const PAY_COLORS = {
  cash: '#F05A20',
  card: '#FF8A4C',
  other: '#9A3412',
} as const;

const CHART_CARD =
  'bg-white shadow-[0_12px_40px_-16px_rgba(15,23,42,0.18),0_0_0_1px_rgba(240,90,32,0.06)] backdrop-blur-none dark:bg-zinc-950 dark:shadow-[0_16px_48px_-18px_rgba(0,0,0,0.75),0_0_0_1px_rgba(240,90,32,0.14)]';

function formatDayLabel(isoDay: string): string {
  const d = new Date(`${isoDay}T12:00:00.000Z`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatCompact(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

function AnalyticsChartLoader({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex w-full items-center justify-center rounded-2xl bg-muted/20',
        className ?? 'h-[260px]'
      )}
    >
      <Loader2 className="h-8 w-8 animate-spin text-fire-500" aria-hidden />
      <span className="sr-only">Loading chart…</span>
    </div>
  );
}

function ChartEmpty({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex w-full items-center justify-center rounded-2xl bg-muted/15 px-4 text-center text-sm text-muted-foreground',
        className ?? 'h-[260px]'
      )}
    >
      {message}
    </div>
  );
}

function normalizeSeries(series: SeriesPoint[] | undefined): SeriesPoint[] {
  if (!series?.length) return [];
  return series.map((p) => ({
    day: String(p.day),
    orders: Number(p.orders) || 0,
    revenue: Number(p.revenue) || 0,
    onlineOrders: Number(p.onlineOrders) || 0,
    posOrders: Number(p.posOrders) || 0,
    kioskOrders: Number(p.kioskOrders) || 0,
    onlineRevenue: Number(p.onlineRevenue) || 0,
    posRevenue: Number(p.posRevenue) || 0,
    kioskRevenue: Number(p.kioskRevenue) || 0,
  }));
}

function ChannelLegend({ advanced }: { advanced: boolean }) {
  if (!advanced) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {(
        [
          ['Online', CHANNEL_COLORS.online],
          ['POS', CHANNEL_COLORS.pos],
          ['Kiosk', CHANNEL_COLORS.kiosk],
        ] as const
      ).map(([label, color]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          {label}
        </span>
      ))}
    </div>
  );
}

function ChannelLineChart({
  data,
  advanced,
}: {
  data: SeriesPoint[];
  advanced: boolean;
}) {
  const width = 640;
  const height = 220;
  const padX = 8;
  const padTop = 16;
  const padBottom = 8;
  const plotW = width - padX * 2;
  const plotH = height - padTop - padBottom;
  const n = Math.max(data.length, 1);

  const seriesKeys = advanced
    ? ([
        { key: 'onlineOrders' as const, color: CHANNEL_COLORS.online },
        { key: 'posOrders' as const, color: CHANNEL_COLORS.pos },
        { key: 'kioskOrders' as const, color: CHANNEL_COLORS.kiosk },
      ] as const)
    : ([{ key: 'orders' as const, color: CHANNEL_COLORS.online }] as const);

  const max = Math.max(
    1,
    ...data.flatMap((p) => seriesKeys.map((s) => Number(p[s.key]) || 0))
  );
  const xAt = (i: number) =>
    padX + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => padTop + plotH - (v / max) * plotH;

  return (
    <div className="flex h-[260px] w-full min-w-0 flex-col">
      <div className="relative min-h-0 flex-1">
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between py-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-t border-dashed border-border/50" />
          ))}
        </div>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="absolute inset-0 h-full w-full overflow-visible"
          role="img"
          aria-label="Orders over time"
        >
          {seriesKeys.map((s) => {
            const points = data.map((p, i) => {
              const v = Number(p[s.key]) || 0;
              return { x: xAt(i), y: yAt(v), v, day: p.day };
            });
            return (
              <g key={s.key}>
                <polyline
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2.75}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={points
                    .map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
                    .join(' ')}
                />
                {points.map((pt) => (
                  <circle
                    key={`${s.key}-${pt.day}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={pt.v > 0 ? 4 : 2.5}
                    fill={s.color}
                    stroke="var(--card, #fff)"
                    strokeWidth={1.5}
                  >
                    <title>
                      {formatDayLabel(pt.day)} · {pt.v.toLocaleString()}
                    </title>
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-2 flex gap-1 sm:gap-1.5">
        {data.map((p) => (
          <div
            key={p.day}
            className="min-w-0 flex-1 truncate text-center text-[10px] tabular-nums text-muted-foreground"
          >
            {formatDayLabel(p.day)}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Full-width total revenue line with soft area fill. */
function CombinedRevenueLineChart({
  data,
  formatTip,
}: {
  data: SeriesPoint[];
  formatTip: (n: number) => string;
}) {
  const width = 960;
  const height = 300;
  const padL = 48;
  const padR = 12;
  const padTop = 18;
  const padBottom = 10;
  const plotW = width - padL - padR;
  const plotH = height - padTop - padBottom;
  const n = Math.max(data.length, 1);

  const withTotal = data.map((p) => ({
    ...p,
    total:
      p.revenue ||
      p.onlineRevenue + p.posRevenue + p.kioskRevenue,
  }));

  const max = Math.max(1, ...withTotal.map((p) => p.total));
  const xAt = (i: number) =>
    padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => padTop + plotH - (v / max) * plotH;

  const totalPoints = withTotal.map((p, i) => ({
    x: xAt(i),
    y: yAt(p.total),
    v: p.total,
    day: p.day,
  }));

  const areaPath =
    totalPoints.length > 0
      ? [
          `M ${totalPoints[0].x.toFixed(1)} ${yAt(0).toFixed(1)}`,
          ...totalPoints.map(
            (pt) => `L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`
          ),
          `L ${totalPoints[totalPoints.length - 1].x.toFixed(1)} ${yAt(0).toFixed(1)}`,
          'Z',
        ].join(' ')
      : '';

  const linePoints = totalPoints
    .map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
    .join(' ');

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: yAt(max * t),
    label: formatTip(max * t),
  }));

  return (
    <div className="flex h-[320px] w-full min-w-0 flex-col">
      <div className="relative min-h-0 w-full flex-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="Revenue over time"
        >
          <defs>
            <linearGradient id="revAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={CHANNEL_COLORS.online}
                stopOpacity="0.32"
              />
              <stop
                offset="100%"
                stopColor={CHANNEL_COLORS.online}
                stopOpacity="0.02"
              />
            </linearGradient>
          </defs>

          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={padL}
                x2={width - padR}
                y1={tick.y}
                y2={tick.y}
                stroke="var(--border)"
                strokeDasharray="4 4"
                strokeOpacity={0.7}
              />
              <text
                x={padL - 8}
                y={tick.y + 3}
                textAnchor="end"
                fill="var(--muted-foreground)"
                fontSize="11"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {areaPath ? <path d={areaPath} fill="url(#revAreaFill)" /> : null}

          <polyline
            fill="none"
            stroke={CHANNEL_COLORS.online}
            strokeWidth={3.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            points={linePoints}
          />
          {totalPoints.map((pt) => (
            <circle
              key={pt.day}
              cx={pt.x}
              cy={pt.y}
              r={pt.v > 0 ? 5 : 3}
              fill={CHANNEL_COLORS.online}
              stroke="var(--card, #fff)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            >
              <title>
                {formatDayLabel(pt.day)} · {formatTip(pt.v)}
              </title>
            </circle>
          ))}
        </svg>
      </div>
      <div
        className="mt-2 flex w-full gap-1 sm:gap-1.5"
        style={{ paddingLeft: 48, paddingRight: 12 }}
      >
        {withTotal.map((p) => (
          <div
            key={p.day}
            className="min-w-0 flex-1 truncate text-center text-[10px] tabular-nums text-muted-foreground"
          >
            {formatDayLabel(p.day)}
          </div>
        ))}
      </div>
    </div>
  );
}

function PeakHoursBars({ data }: { data: HourlyPoint[] }) {
  const active = data.filter((h) => h.hour >= 8 && h.hour <= 23);
  const max = Math.max(1, ...active.map((h) => h.orders));
  return (
    <div className="flex h-[220px] w-full min-w-0 flex-col">
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 flex items-end gap-0.5 sm:gap-1">
          {active.map((h) => {
            const pct = h.orders > 0 ? Math.max((h.orders / max) * 100, 4) : 0;
            return (
              <div
                key={h.hour}
                className="flex h-full min-w-0 flex-1 flex-col justify-end"
                title={`${h.label}: ${h.orders} orders`}
              >
                <div
                  className="w-full rounded-t-sm bg-fire-500/85"
                  style={{ height: `${pct}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex gap-0.5 sm:gap-1">
        {active.map((h) => (
          <div
            key={h.hour}
            className="min-w-0 flex-1 truncate text-center text-[9px] text-muted-foreground"
          >
            {h.hour % 3 === 0 || h.hour === 8 || h.hour === 23 ? h.label : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

function TopItemsList({
  items,
  formatMoney,
}: {
  items: TopItem[];
  formatMoney: (n: number) => string;
}) {
  const maxQty = Math.max(1, ...items.map((i) => i.quantity));
  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={`${item.name}-${idx}`} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">
              <span className="mr-2 tabular-nums text-muted-foreground">
                {idx + 1}.
              </span>
              {item.name}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {item.quantity} · {formatMoney(item.revenue)}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted/50">
            <div
              className="h-full rounded-full bg-fire-500"
              style={{ width: `${(item.quantity / maxQty) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function InsightChip({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof ShoppingBag;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-3xl bg-white/85 p-4 shadow-[0_12px_40px_-16px_rgba(15,23,42,0.18),0_0_0_1px_rgba(240,90,32,0.06)] backdrop-blur-xl dark:bg-zinc-950/75 dark:shadow-[0_16px_48px_-18px_rgba(0,0,0,0.75),0_0_0_1px_rgba(240,90,32,0.14)]">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-fire-500 text-white shadow-md shadow-fire-500/30">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-bold tracking-tight tabular-nums">
            {value}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
        </div>
      </div>
    </div>
  );
}

export default function DashboardAnalytics() {
  const { formatMoney, regional } = useOwnerRestaurantRegional();
  const currencySymbol = getRestaurantCurrencySymbol(regional.currencyCode);
  const { activeBranchId, loading: branchLoading, isOwnerOrAdmin } =
    useBranchContext();
  const { restaurantSlug } = useStaffRestaurantBranding();
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState<7 | 14 | 30>(7);
  const queryDays = isOwnerOrAdmin ? selectedDays : 1;
  const slug = restaurantSlug;

  const load = useCallback(async (days: number, branchId: string | null) => {
    setError(null);
    setAnalyticsLoading(true);
    try {
      const dashRes = await axios.get<AnalyticsPayload>(
        withBranchQuery(
          `/api/restaurant/dashboard-analytics?days=${days}`,
          branchId
        )
      );
      setAnalytics(dashRes.data);
    } catch {
      setError('Could not load dashboard analytics.');
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (branchLoading) return;
    void load(queryDays, activeBranchId);
  }, [load, queryDays, activeBranchId, branchLoading]);

  useRealtimeRefresh(
    'realtime:dashboard.analytics',
    () => {
      if (branchLoading) return;
      void load(queryDays, activeBranchId);
    },
    { runOnMount: false }
  );

  const chartSeries = useMemo(() => {
    const series = normalizeSeries(analytics?.series);
    if (!series.length) return series;
    const seriesOrders = series.reduce((s, p) => s + p.orders, 0);
    const seriesRevenue = series.reduce((s, p) => s + p.revenue, 0);
    const ordersTot = analytics?.channelTotals?.orders;
    const revenueTot = analytics?.channelTotals?.revenue;
    const channelOrders =
      (Number(ordersTot?.online) || 0) +
      (Number(ordersTot?.pos) || 0) +
      (Number(ordersTot?.kiosk) || 0);
    const channelRevenue =
      (Number(revenueTot?.online) || 0) +
      (Number(revenueTot?.pos) || 0) +
      (Number(revenueTot?.kiosk) || 0);
    if (
      (channelOrders > 0 && seriesOrders === 0) ||
      (channelRevenue > 0 && seriesRevenue === 0)
    ) {
      const last = series.length - 1;
      return series.map((p, i) => {
        if (i !== last) return p;
        return {
          ...p,
          orders: channelOrders > 0 ? channelOrders : p.orders,
          revenue: channelRevenue > 0 ? channelRevenue : p.revenue,
          onlineOrders:
            channelOrders > 0 ? Number(ordersTot?.online) || 0 : p.onlineOrders,
          posOrders:
            channelOrders > 0 ? Number(ordersTot?.pos) || 0 : p.posOrders,
          kioskOrders:
            channelOrders > 0 ? Number(ordersTot?.kiosk) || 0 : p.kioskOrders,
          onlineRevenue:
            channelRevenue > 0
              ? Number(revenueTot?.online) || 0
              : p.onlineRevenue,
          posRevenue:
            channelRevenue > 0 ? Number(revenueTot?.pos) || 0 : p.posRevenue,
          kioskRevenue:
            channelRevenue > 0
              ? Number(revenueTot?.kiosk) || 0
              : p.kioskRevenue,
        };
      });
    }
    return series;
  }, [analytics?.series, analytics?.channelTotals]);

  const channelMix = useMemo(() => {
    const revenue = analytics?.channelTotals?.revenue;
    return [
      {
        name: 'Online',
        value: Number(revenue?.online) || 0,
        color: CHANNEL_COLORS.online,
      },
      {
        name: 'POS',
        value: Number(revenue?.pos) || 0,
        color: CHANNEL_COLORS.pos,
      },
      {
        name: 'Kiosk',
        value: Number(revenue?.kiosk) || 0,
        color: CHANNEL_COLORS.kiosk,
      },
    ];
  }, [analytics?.channelTotals]);

  const channelMixTotal = useMemo(
    () => channelMix.reduce((s, r) => s + r.value, 0),
    [channelMix]
  );

  const paymentSlices = useMemo(() => {
    const mix = analytics?.paymentMix;
    return [
      { name: 'Cash', value: Number(mix?.cash) || 0, color: PAY_COLORS.cash },
      { name: 'Card', value: Number(mix?.card) || 0, color: PAY_COLORS.card },
      { name: 'Other', value: Number(mix?.other) || 0, color: PAY_COLORS.other },
    ].filter((s) => s.value > 0);
  }, [analytics?.paymentMix]);

  const paymentTotal = useMemo(
    () => paymentSlices.reduce((s, r) => s + r.value, 0),
    [paymentSlices]
  );

  const hourlyOrders = analytics?.hourlyOrders ?? [];
  const topItems = analytics?.topItems ?? [];
  const ops = analytics?.ops;

  const insights = useMemo(() => {
    const totalOrders = chartSeries.reduce((s, p) => s + p.orders, 0);
    const totalRevenue = chartSeries.reduce((s, p) => s + p.revenue, 0);
    const avgOrderValue =
      totalOrders > 0 && totalRevenue > 0 ? totalRevenue / totalOrders : 0;
    return { totalOrders, totalRevenue, avgOrderValue };
  }, [chartSeries]);

  const isLoading = branchLoading || analyticsLoading;
  const showAdvanced = (analytics?.analyticsTier ?? 'advanced') === 'advanced';
  const todayOnly = !isOwnerOrAdmin || analytics?.dataScope === 'today';
  const chartDaysLabel = todayOnly
    ? 'today'
    : `${analytics?.days ?? selectedDays} days`;

  const daySwitcher =
    isOwnerOrAdmin && !todayOnly ? (
      <div className="inline-flex rounded-2xl bg-muted/40 p-1 dark:bg-white/5">
        {DAY_OPTIONS.map((d) => (
          <button
            key={d}
            type="button"
            disabled={isLoading}
            className={cn(
              'rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all disabled:opacity-50',
              selectedDays === d
                ? 'bg-fire-500 text-white shadow-md shadow-fire-500/30'
                : 'text-muted-foreground hover:bg-white/60 hover:text-foreground dark:hover:bg-white/10'
            )}
            onClick={() => setSelectedDays(d)}
          >
            {d}D
          </button>
        ))}
      </div>
    ) : null;

  const pieSlices = channelMix.filter((s) => s.value > 0);

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {todayOnly
              ? 'Today’s sales and floor pulse.'
              : analytics?.branchScoped && analytics.activeBranchName
                ? `${analytics.activeBranchName} · last ${chartDaysLabel}.`
                : `Sales & operations · last ${chartDaysLabel}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {daySwitcher}
          {slug ? (
            <>
              <Button
                asChild
                className="rounded-2xl bg-fire-500 shadow-md shadow-fire-500/30 hover:bg-fire-600"
              >
                <a
                  href={restaurantStorefrontPath(slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Website
                  <IconExternalLink className="ml-2 h-4 w-4" aria-hidden />
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                className="rounded-2xl bg-white/70 shadow-sm dark:bg-white/10"
              >
                <a
                  href={
                    activeBranchId
                      ? kioskBasePath(slug, activeBranchId)
                      : `/kiosk/${encodeURIComponent(slug)}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Kiosk
                  <IconExternalLink className="ml-2 h-4 w-4" aria-hidden />
                </a>
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[88px] animate-pulse rounded-3xl bg-white/50 dark:bg-zinc-950/50"
            />
          ))
        ) : (
          <>
            <InsightChip
              icon={Wallet}
              label="Revenue"
              value={formatMoney(insights.totalRevenue)}
              hint={`Completed payments · ${chartDaysLabel}`}
            />
            <InsightChip
              icon={ShoppingBag}
              label="Orders"
              value={insights.totalOrders.toLocaleString()}
              hint={`Active tickets · ${chartDaysLabel}`}
            />
            <InsightChip
              icon={Receipt}
              label="Avg. order"
              value={
                insights.avgOrderValue > 0
                  ? formatMoney(insights.avgOrderValue)
                  : '—'
              }
              hint="Revenue ÷ orders"
            />
            <InsightChip
              icon={ChefHat}
              label="Kitchen open"
              value={String(ops?.kdsOpen ?? 0)}
              hint={
                ops?.peakHourLabel
                  ? `Peak ${ops.peakHourLabel} · ${ops.peakHourOrders} orders`
                  : 'Open KDS tickets now'
              }
            />
          </>
        )}
      </div>

      {/* 1. Revenue first */}
      <Card className={CHART_CARD}>
        <CardHeader>
          <CardTitle>Revenue report ({chartDaysLabel})</CardTitle>
          <CardDescription>
            Total completed-payment revenue over time.
          </CardDescription>
        </CardHeader>
        <CardContent className="w-full min-w-0 pt-0">
          {isLoading || !analytics ? (
            <AnalyticsChartLoader className="h-[320px]" />
          ) : insights.totalRevenue <= 0 ? (
            <ChartEmpty
              className="h-[320px]"
              message="No completed payments in this period yet."
            />
          ) : (
            <CombinedRevenueLineChart
              data={chartSeries}
              formatTip={(n) => `${currencySymbol}${formatCompact(n)}`}
            />
          )}
        </CardContent>
      </Card>

      {/* 2. Orders line + channel mix */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <Card className={cn('min-w-0', CHART_CARD)}>
          <CardHeader>
            <CardTitle>
              {showAdvanced ? 'Orders by channel' : 'Orders trend'} (
              {chartDaysLabel})
            </CardTitle>
            <CardDescription>
              Ticket volume over time — busy vs slow days.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading || !analytics ? (
              <AnalyticsChartLoader />
            ) : insights.totalOrders <= 0 ? (
              <ChartEmpty message="No orders in this period yet." />
            ) : (
              <>
                <ChannelLegend advanced={showAdvanced} />
                <ChannelLineChart
                  data={chartSeries}
                  advanced={showAdvanced}
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card className={cn('min-w-0', CHART_CARD)}>
          <CardHeader>
            <CardTitle>Channel mix</CardTitle>
            <CardDescription>
              Where completed revenue comes from.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading || !analytics ? (
              <AnalyticsChartLoader className="h-[260px]" />
            ) : channelMixTotal <= 0 ? (
              <ChartEmpty
                className="h-[260px]"
                message="No completed revenue to split yet."
              />
            ) : (
              <div className="h-[260px] w-full min-w-0">
                <ResponsiveContainer width="100%" height={260} debounce={50}>
                  <PieChart>
                    <Pie
                      data={pieSlices}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={84}
                      paddingAngle={pieSlices.length > 1 ? 3 : 0}
                      isAnimationActive={false}
                    >
                      {pieSlices.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatMoney(Number(value))}
                      contentStyle={{
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 12px 30px rgba(0,0,0,0.12)',
                        fontSize: '12px',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 3. Top items + peak hours */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card className={cn('min-w-0', CHART_CARD)}>
          <CardHeader>
            <CardTitle>Top selling items</CardTitle>
            <CardDescription>
              What to promote and never stock out · {chartDaysLabel}.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading || !analytics ? (
              <AnalyticsChartLoader className="h-[220px]" />
            ) : topItems.length === 0 ? (
              <ChartEmpty
                className="h-[220px]"
                message="No paid item sales in this period yet."
              />
            ) : (
              <TopItemsList items={topItems} formatMoney={formatMoney} />
            )}
          </CardContent>
        </Card>

        <Card className={cn('min-w-0', CHART_CARD)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-fire-500" aria-hidden />
              Peak hours
            </CardTitle>
            <CardDescription>
              When to schedule staff and prep · {chartDaysLabel}.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading || !analytics ? (
              <AnalyticsChartLoader className="h-[220px]" />
            ) : hourlyOrders.every((h) => h.orders === 0) ? (
              <ChartEmpty
                className="h-[220px]"
                message="No order timing data yet."
              />
            ) : (
              <PeakHoursBars data={hourlyOrders} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4. Floor ops + payment mix */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className={cn('min-w-0', CHART_CARD)}>
          <CardHeader>
            <CardTitle>Floor right now</CardTitle>
            <CardDescription>Live kitchen and dine-in pressure.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading || !analytics ? (
              <AnalyticsChartLoader className="h-[180px]" />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-fire-500/10 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <ChefHat className="h-3.5 w-3.5" aria-hidden />
                    Kitchen
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums">
                    {ops?.kdsOpen ?? 0}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Open tickets
                  </p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <UtensilsCrossed className="h-3.5 w-3.5" aria-hidden />
                    Tables
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums">
                    {ops?.openTableTabs ?? 0}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Open tabs</p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-4">
                  <div className="text-xs font-medium text-muted-foreground">
                    Display queue
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums">
                    {ops?.orderDisplayQueue ?? 0}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    In progress
                  </p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-4">
                  <div className="text-xs font-medium text-muted-foreground">
                    Canceled
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums">
                    {ops?.canceledOrders ?? 0}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    In period
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={cn('min-w-0', CHART_CARD)}>
          <CardHeader>
            <CardTitle>Payment mix</CardTitle>
            <CardDescription>
              Cash vs card on completed payments · {chartDaysLabel}.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading || !analytics ? (
              <AnalyticsChartLoader className="h-[220px]" />
            ) : paymentTotal <= 0 ? (
              <ChartEmpty
                className="h-[220px]"
                message="No completed payments to split yet."
              />
            ) : (
              <div className="grid h-[220px] gap-4 sm:grid-cols-[1fr_0.85fr]">
                <div className="min-h-0 min-w-0">
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <PieChart>
                      <Pie
                        data={paymentSlices}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={78}
                        paddingAngle={paymentSlices.length > 1 ? 3 : 0}
                        isAnimationActive={false}
                      >
                        {paymentSlices.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) =>
                          formatMoney(Number(value))
                        }
                        contentStyle={{
                          borderRadius: '12px',
                          border: 'none',
                          boxShadow: '0 12px 30px rgba(0,0,0,0.12)',
                          fontSize: '12px',
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col justify-center gap-3 text-sm">
                  {paymentSlices.map((s) => (
                    <div
                      key={s.name}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="inline-flex items-center gap-2 text-muted-foreground">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        {s.name}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {Math.round((s.value / paymentTotal) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
