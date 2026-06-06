'use client';

import axios from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Label,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { AnalyticsKpiCard } from '@/components/dashboard/analytics-kpi-card';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { kpiSparklineFromValue } from '@/components/ui/sparkline';
import {
  DASHBOARD_MODULES,
  type DashboardModuleKey,
} from '@/constant/dashboardModules';
import { MODULE_ICONS } from '@/constant/navbarMenu';
import {
  useBranchContext,
  withBranchQuery,
} from '@/hooks/use-branch-context';
import { canAccessDashboardModule } from '@/lib/restaurant-roles';
import { cn } from '@/lib/utils';
import { IconExternalLink } from '@tabler/icons-react';
import { TooltipContent } from '../ui/tooltip';
import { Loader, Loader2Icon } from 'lucide-react';

type AnalyticsCounts = {
  branches: number;
  categories: number;
  menuItems: number;
  variations: number;
  tables: number;
  orders: number;
  posOrders: number;
  customers: number;
  recommendations: number;
  kdsOpen: number;
  orderDisplayQueue: number;
  employees: number;
};

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

type AnalyticsPayload = {
  counts: AnalyticsCounts;
  series: SeriesPoint[];
  days?: 7 | 14 | 30;
  channelTotals?: {
    orders: { online: number; pos: number; kiosk: number };
    revenue: { online: number; pos: number; kiosk: number };
  };
  analyticsTier?: 'basic' | 'advanced';
  activeBranchId?: string | null;
  activeBranchName?: string | null;
  branchScoped?: boolean;
};

const DAY_OPTIONS: Array<7 | 14 | 30> = [7, 14, 30];
const CHANNEL_COLORS = {
  online: '#ed6e40',
  pos: '#7c3aed',
  kiosk: '#e11d48',
} as const;

const MODULE_ACCENTS: Partial<Record<DashboardModuleKey, string>> = {
  sales: CHANNEL_COLORS.online,
  pos: CHANNEL_COLORS.pos,
  kds: '#f59e0b',
  'order-display': CHANNEL_COLORS.kiosk,
  branched: '#0ea5e9',
  categories: '#8b5cf6',
  variations: '#6366f1',
  tables: '#3b82f6',
  product: '#10b981',
  recommendations: '#ec4899',
  records: '#14b8a6',
  settings: '#64748b',
};

function moduleSparklineData(
  key: DashboardModuleKey,
  data: AnalyticsPayload | null
): number[] {
  if (!data?.series?.length) return kpiSparklineFromValue(0);
  const s = data.series;
  switch (key) {
    case 'sales':
      return s.map((p) => p.orders);
    case 'pos':
      return s.map((p) => p.posOrders);
    case 'order-display':
      return s.map((p) => p.kioskOrders + p.posOrders);
    case 'kds':
      return s.map((p) => p.orders);
    default: {
      const { value } = moduleMetric(key, data);
      const n = Number.parseInt(value, 10);
      return kpiSparklineFromValue(Number.isFinite(n) ? n : 0);
    }
  }
}

function formatDayLabel(isoDay: string): string {
  const d = new Date(`${isoDay}T12:00:00.000Z`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatMoney(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}

function moduleMetric(
  key: DashboardModuleKey,
  data: AnalyticsPayload | null
): { value: string; hint: string } {
  if (!data) return { value: '—', hint: 'Loading…' };
  const c = data.counts;
  const ordersWindow = data.series.reduce((s, p) => s + p.orders, 0);

  switch (key) {
    case 'dashboard':
      return {
        value: String(ordersWindow),
        hint: `Active orders (${data.days ?? 7} days)`,
      };
    case 'sales':
      return { value: String(c.orders), hint: 'Active orders at branch' };
    case 'pos':
      return { value: String(c.posOrders), hint: 'POS orders' };
    case 'kds':
      return { value: String(c.kdsOpen), hint: 'Open kitchen tickets' };
    case 'order-display':
      return {
        value: String(c.orderDisplayQueue ?? 0),
        hint: data.branchScoped
          ? 'POS/kiosk in progress'
          : 'On order display queue',
      };
    case 'branched':
      return { value: String(c.branches), hint: 'Branches' };
    case 'categories':
      return { value: String(c.categories), hint: 'Menu categories' };
    case 'variations':
      return { value: String(c.variations ?? 0), hint: 'Product variations' };
    case 'tables':
      return {
        value: String(c.tables ?? 0),
        hint: data.branchScoped ? 'Tables at this branch' : 'Dining tables',
      };
    case 'product':
      return { value: String(c.menuItems), hint: 'Menu items' };
    case 'recommendations':
      return { value: String(c.recommendations), hint: 'Upsell links' };
    case 'records':
      return {
        value: String(c.customers),
        hint: data.branchScoped
          ? 'Customers with orders at this branch'
          : 'Customers on file',
      };
    case 'settings':
      return {
        value: String(c.employees),
        hint: data.branchScoped ? 'Team at this branch' : 'Team members',
      };
    default:
      return { value: '—', hint: '' };
  }
}

export default function DashboardAnalytics() {
  const { activeBranchId, loading: branchLoading } = useBranchContext();
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [planRecommendations, setPlanRecommendations] = useState(true);
  const [selectedDays, setSelectedDays] = useState<7 | 14 | 30>(7);

  const load = useCallback(
    async (days: 7 | 14 | 30, branchId: string | null) => {
      setError(null);
      setPermissionsLoaded(false);
      try {
        const [permRes, dashRes] = await Promise.all([
          axios.get<{
            permissions: string[];
            plan?: { recommendations?: boolean };
          }>('/api/me/dashboard-permissions'),
          axios.get<AnalyticsPayload>(
            withBranchQuery(
              `/api/restaurant/dashboard-analytics?days=${days}`,
              branchId
            )
          ),
        ]);
        setPermissions(permRes.data.permissions ?? []);
        setPlanRecommendations(permRes.data.plan?.recommendations !== false);
        setAnalytics(dashRes.data);
      } catch {
        setError('Could not load dashboard analytics.');
        setPermissions([]);
        setPlanRecommendations(true);
        setAnalytics(null);
      } finally {
        setPermissionsLoaded(true);
      }
    },
    []
  );

  useEffect(() => {
    if (branchLoading) return;
    void load(selectedDays, activeBranchId);
  }, [load, selectedDays, activeBranchId, branchLoading]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get<{ data: { slug?: string } | null }>(
          '/api/restaurant'
        );
        const s = res.data?.data?.slug?.trim();
        if (!cancelled) setSlug(s && s.length > 0 ? s : null);
      } catch {
        if (!cancelled) setSlug(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const modules = useMemo(() => {
    if (!permissionsLoaded || !permissions) return [];
    return DASHBOARD_MODULES.filter((m) => {
      if (m.moduleKey === 'dashboard') return false;
      if (m.moduleKey === 'recommendations' && !planRecommendations)
        return false;
      return canAccessDashboardModule(permissions, m.moduleKey);
    });
  }, [permissions, permissionsLoaded, planRecommendations]);

  const can = useCallback(
    (key: DashboardModuleKey) =>
      permissions ? canAccessDashboardModule(permissions, key) : false,
    [permissions]
  );

  const ordersPieData = useMemo(() => {
    const t = analytics?.channelTotals?.orders;
    return [
      { name: 'Online', value: t?.online ?? 0, color: CHANNEL_COLORS.online },
      { name: 'POS', value: t?.pos ?? 0, color: CHANNEL_COLORS.pos },
      { name: 'Kiosk', value: t?.kiosk ?? 0, color: CHANNEL_COLORS.kiosk },
    ];
  }, [analytics?.channelTotals?.orders]);

  const revenuePieData = useMemo(() => {
    const t = analytics?.channelTotals?.revenue;
    return [
      { name: 'Online', value: t?.online ?? 0, color: CHANNEL_COLORS.online },
      { name: 'POS', value: t?.pos ?? 0, color: CHANNEL_COLORS.pos },
      { name: 'Kiosk', value: t?.kiosk ?? 0, color: CHANNEL_COLORS.kiosk },
    ];
  }, [analytics?.channelTotals?.revenue]);

  const totalOrdersAll = useMemo(
    () => ordersPieData.reduce((sum, r) => sum + r.value, 0),
    [ordersPieData]
  );
  const totalRevenueAll = useMemo(
    () => revenuePieData.reduce((sum, r) => sum + r.value, 0),
    [revenuePieData]
  );

  return (
    <div className="w-full space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <h2 className="mt-1 text-lg font-semibold text-foreground/90">
            Overview
          </h2>
          <p className="text-sm text-muted-foreground">
            {analytics?.branchScoped && analytics.activeBranchName
              ? `Showing data for ${analytics.activeBranchName} — active orders and revenue (online, POS, kiosk).`
              : 'Active orders and revenue — online, POS, and kiosk with selectable day ranges.'}
          </p>
        </div>
        {slug ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild className="rounded-xl shadow-sm">
              <a
                href={`/web-app/${encodeURIComponent(slug)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Website
                <IconExternalLink className="ml-2 h-4 w-4" aria-hidden />
              </a>
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <a
                href={`/kiosk/${encodeURIComponent(slug)}`}
                title="Opens branch picker — use Settings for per-branch kiosk URLs"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Kiosk
                <IconExternalLink className="ml-2 h-4 w-4" aria-hidden />
              </a>
            </Button>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {!permissionsLoaded ? (
        <p className="text-sm text-muted-foreground">
          <Loader2Icon className="animate-spin text-primary mx-auto" />
        </p>
      ) : null}

      {analytics ? (
        <div className="space-y-4">
          {analytics.analyticsTier === 'basic' ? (
            <>
              <Card className="rounded-2xl border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">
                    Active orders (last 7 days)
                  </CardTitle>
                  <CardDescription>
                    Daily active orders for Starter plan.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-[340px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.series}>
                        <defs>
                          <linearGradient
                            id="ordersTotalFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor={CHANNEL_COLORS.online}
                              stopOpacity={0.45}
                            />
                            <stop
                              offset="95%"
                              stopColor={CHANNEL_COLORS.online}
                              stopOpacity={0.03}
                            />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="day" tickFormatter={formatDayLabel} />
                        <YAxis />
                        <Tooltip
                          cursor={false}
                          contentStyle={{
                            color: 'black',
                            borderRadius: '8px',
                            padding: '10px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                          }}
                          formatter={(value: number) =>
                            Number(value).toLocaleString()
                          }
                          labelFormatter={(label) =>
                            formatDayLabel(String(label))
                          }
                        />
                        <Area
                          type="monotone"
                          dataKey="orders"
                          name="Orders"
                          stroke={CHANNEL_COLORS.online}
                          fill="url(#ordersTotalFill)"
                          strokeWidth={2.6}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">
                    Completed revenue (last 7 days)
                  </CardTitle>
                  <CardDescription>
                    Revenue from active orders (Starter plan).
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-[340px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.series}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="gray"
                          vertical={false}
                        />
                        <XAxis dataKey="day" tickFormatter={formatDayLabel} />
                        <YAxis />
                        <Tooltip
                          formatter={(value: number) =>
                            `€${formatMoney(Number(value))}`
                          }
                          labelFormatter={(label) =>
                            formatDayLabel(String(label))
                          }
                        />
                        <Bar
                          dataKey="revenue"
                          name="Revenue (€)"
                          fill={CHANNEL_COLORS.pos}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <Card className="rounded-2xl border-border/60 shadow-sm">
                <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      Completed orders trend ({analytics.days ?? selectedDays}{' '}
                      days)
                    </CardTitle>
                    <CardDescription>
                      Online, POS, and Kiosk active orders over time.
                    </CardDescription>
                  </div>

                  <div className="inline-flex rounded-xl border bg-muted/30 p-1">
                    {DAY_OPTIONS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={cn(
                          'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                          selectedDays === d
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                        onClick={() => setSelectedDays(d)}
                      >
                        {d}D
                      </button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-[340px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.series}>
                        <defs>
                          <linearGradient
                            id="ordersOnlineFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor={CHANNEL_COLORS.online}
                              stopOpacity={0.45}
                            />
                            <stop
                              offset="95%"
                              stopColor={CHANNEL_COLORS.online}
                              stopOpacity={0.02}
                            />
                          </linearGradient>
                          <linearGradient
                            id="ordersPosFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor={CHANNEL_COLORS.pos}
                              stopOpacity={0.35}
                            />
                            <stop
                              offset="95%"
                              stopColor={CHANNEL_COLORS.pos}
                              stopOpacity={0.02}
                            />
                          </linearGradient>
                          <linearGradient
                            id="ordersKioskFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor={CHANNEL_COLORS.kiosk}
                              stopOpacity={0.35}
                            />
                            <stop
                              offset="95%"
                              stopColor={CHANNEL_COLORS.kiosk}
                              stopOpacity={0.02}
                            />
                          </linearGradient>
                        </defs>

                        <XAxis dataKey="day" tickFormatter={formatDayLabel} />
                        <YAxis />
                        <Tooltip
                          cursor={false}
                          contentStyle={{
                            color: 'black',
                            borderRadius: '8px',
                            padding: '10px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                          }}
                          formatter={(value: number) =>
                            Number(value).toLocaleString()
                          }
                          labelFormatter={(label) =>
                            formatDayLabel(String(label))
                          }
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="onlineOrders"
                          name="Online"
                          stroke={CHANNEL_COLORS.online}
                          fill="url(#ordersOnlineFill)"
                          strokeWidth={2.5}
                        />
                        <Area
                          type="monotone"
                          dataKey="posOrders"
                          name="POS"
                          stroke={CHANNEL_COLORS.pos}
                          fill="url(#ordersPosFill)"
                          strokeWidth={2.2}
                        />
                        <Area
                          type="monotone"
                          dataKey="kioskOrders"
                          name="Kiosk"
                          stroke={CHANNEL_COLORS.kiosk}
                          fill="url(#ordersKioskFill)"
                          strokeWidth={2.2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="rounded-2xl border-border/60 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">
                      Revenue by channel ({analytics.days ?? selectedDays} days)
                    </CardTitle>
                    <CardDescription>
                      Multiple bar chart for Online, POS, and Kiosk totals per
                      day.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="mb-3 grid grid-cols-3 overflow-hidden rounded-lg border text-xs">
                      <div className="border-r px-3 py-2">
                        <p className="text-muted-foreground">Online</p>
                        <p className="text-sm font-semibold">
                          €{formatMoney(revenuePieData[0]?.value ?? 0)}
                        </p>
                      </div>
                      <div className="border-r px-3 py-2">
                        <p className="text-muted-foreground">POS</p>
                        <p className="text-sm font-semibold">
                          €{formatMoney(revenuePieData[1]?.value ?? 0)}
                        </p>
                      </div>
                      <div className="px-3 py-2">
                        <p className="text-muted-foreground">Kiosk</p>
                        <p className="text-sm font-semibold">
                          €{formatMoney(revenuePieData[2]?.value ?? 0)}
                        </p>
                      </div>
                    </div>
                    <div className="h-[320px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.series}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="gray"
                            vertical={false}
                          />
                          <XAxis dataKey="day" tickFormatter={formatDayLabel} />
                          <YAxis />
                          <Tooltip
                            contentStyle={{
                              color: 'black',
                              borderRadius: '8px',
                              padding: '10px',
                              fontSize: '12px',
                              fontWeight: 'bold',
                            }}
                            formatter={(value: number) =>
                              formatMoney(Number(value))
                            }
                            labelFormatter={(label) =>
                              formatDayLabel(String(label))
                            }
                          />
                          <Legend />
                          <Bar
                            dataKey="onlineRevenue"
                            name="Online"
                            fill={CHANNEL_COLORS.online}
                          />
                          <Bar
                            dataKey="posRevenue"
                            name="POS"
                            fill={CHANNEL_COLORS.pos}
                          />
                          <Bar
                            dataKey="kioskRevenue"
                            name="Kiosk"
                            fill={CHANNEL_COLORS.kiosk}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-border/60 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">
                      Channel mix
                    </CardTitle>
                    <CardDescription>
                      Share of active orders and revenue by channel.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="h-[280px] w-full">
                        <p className="mb-2 text-sm font-medium">Orders split</p>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Tooltip
                              contentStyle={{
                                color: 'black',
                                borderRadius: '8px',
                                padding: '10px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                              }}
                              formatter={(value: number) =>
                                Number(value).toLocaleString()
                              }
                            />
                            <Legend />
                            <Pie
                              data={ordersPieData}
                              dataKey="value"
                              nameKey="name"
                              outerRadius={90}
                              innerRadius={56}
                              stroke="hsl(var(--background))"
                              strokeWidth={2}
                            >
                              <Label
                                position="center"
                                content={({ viewBox }) => {
                                  if (
                                    !viewBox ||
                                    !('cx' in viewBox) ||
                                    !('cy' in viewBox)
                                  )
                                    return null;
                                  const cx = Number(viewBox.cx ?? 0);
                                  const cy = Number(viewBox.cy ?? 0);
                                  return (
                                    <text
                                      x={cx}
                                      y={cy}
                                      textAnchor="middle"
                                      dominantBaseline="middle"
                                    >
                                      <tspan
                                        x={cx}
                                        y={cy - 2}
                                        className="fill-foreground text-lg font-semibold"
                                      >
                                        {totalOrdersAll.toLocaleString()}
                                      </tspan>
                                      <tspan
                                        x={cx}
                                        y={cy + 14}
                                        className="fill-muted-foreground text-xs"
                                      >
                                        orders
                                      </tspan>
                                    </text>
                                  );
                                }}
                              />
                              {ordersPieData.map((entry) => (
                                <Cell key={entry.name} fill={entry.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="h-[280px] w-full">
                        <p className="mb-2 text-sm font-medium">
                          Revenue(€) split
                        </p>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Tooltip
                              formatter={(value: number) =>
                                formatMoney(Number(value))
                              }
                            />
                            <Legend />
                            <Pie
                              data={revenuePieData}
                              dataKey="value"
                              nameKey="name"
                              outerRadius={90}
                              innerRadius={56}
                              stroke="hsl(var(--background))"
                              strokeWidth={2}
                            >
                              <Label
                                position="center"
                                content={({ viewBox }) => {
                                  if (
                                    !viewBox ||
                                    !('cx' in viewBox) ||
                                    !('cy' in viewBox)
                                  )
                                    return null;
                                  const cx = Number(viewBox.cx ?? 0);
                                  const cy = Number(viewBox.cy ?? 0);
                                  return (
                                    <text
                                      x={cx}
                                      y={cy}
                                      textAnchor="middle"
                                      dominantBaseline="middle"
                                    >
                                      <tspan
                                        x={cx}
                                        y={cy - 2}
                                        className="fill-foreground text-lg font-semibold"
                                      >
                                        €{formatMoney(totalRevenueAll)}
                                      </tspan>
                                      <tspan
                                        x={cx}
                                        y={cy + 14}
                                        className="fill-muted-foreground text-xs"
                                      >
                                        revenue
                                      </tspan>
                                    </text>
                                  );
                                }}
                              />
                              {revenuePieData.map((entry) => (
                                <Cell key={entry.name} fill={entry.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((m) => {
          const Icon = MODULE_ICONS[m.moduleKey];
          const { value, hint } = moduleMetric(m.moduleKey, analytics);
          const allowed = can(m.moduleKey);
          if (!allowed) return null;

          return (
            <AnalyticsKpiCard
              key={m.moduleKey}
              title={m.title}
              subtitle={hint}
              value={value}
              sparklineData={moduleSparklineData(m.moduleKey, analytics)}
              accentColor={
                MODULE_ACCENTS[m.moduleKey] ?? CHANNEL_COLORS.online
              }
              icon={Icon}
              href={m.path}
              daysLabel={`${analytics?.days ?? selectedDays} days`}
            />
          );
        })}
      </div>
    </div>
  );
}
