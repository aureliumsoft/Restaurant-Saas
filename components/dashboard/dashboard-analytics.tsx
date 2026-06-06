'use client';

import axios from 'axios';
import Link from 'next/link';
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

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DASHBOARD_MODULES,
  type DashboardModuleKey,
} from '@/constant/dashboardModules';
import { MODULE_ICONS } from '@/constant/navbarMenu';
import { canAccessDashboardModule } from '@/lib/restaurant-roles';
import { cn } from '@/lib/utils';
import { IconExternalLink } from '@tabler/icons-react';
import { TooltipContent } from '../ui/tooltip';
import { Loader, Loader2Icon } from 'lucide-react';

type AnalyticsCounts = {
  branches: number;
  categories: number;
  menuItems: number;
  orders: number;
  posOrders: number;
  customers: number;
  recommendations: number;
  kdsOpen: number;
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
};

const DAY_OPTIONS: Array<7 | 14 | 30> = [7, 14, 30];
const CHANNEL_COLORS = {
  online: '#ed6e40',
  pos: '#297fcf',
  kiosk: '#E03C50',
} as const;

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
        hint: `Completed orders (${data.days ?? 7} days)`,
      };
    case 'sales':
      return { value: String(c.orders), hint: 'Completed orders' };
    case 'pos':
      return { value: String(c.posOrders), hint: 'POS orders' };
    case 'kds':
      return { value: String(c.kdsOpen), hint: 'Open kitchen tickets' };
    case 'branched':
      return { value: String(c.branches), hint: 'Branches' };
    case 'categories':
      return { value: String(c.categories), hint: 'Menu categories' };
    case 'product':
      return { value: String(c.menuItems), hint: 'Menu items' };
    case 'recommendations':
      return { value: String(c.recommendations), hint: 'Upsell links' };
    case 'records':
      return { value: String(c.customers), hint: 'Customers on file' };
    case 'settings':
      return { value: String(c.employees), hint: 'Team members' };
    default:
      return { value: '—', hint: '' };
  }
}

export default function DashboardAnalytics() {
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [planRecommendations, setPlanRecommendations] = useState(true);
  const [selectedDays, setSelectedDays] = useState<7 | 14 | 30>(7);

  const load = useCallback(async (days: 7 | 14 | 30) => {
    setError(null);
    setPermissionsLoaded(false);
    try {
      const [permRes, dashRes] = await Promise.all([
        axios.get<{
          permissions: string[];
          plan?: { recommendations?: boolean };
        }>('/api/me/dashboard-permissions'),
        axios.get<AnalyticsPayload>(
          `/api/restaurant/dashboard-analytics?days=${days}`
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
  }, []);

  useEffect(() => {
    const onBranch = () => void load(selectedDays);
    window.addEventListener('branch-changed', onBranch);
    return () => window.removeEventListener('branch-changed', onBranch);
  }, [load, selectedDays]);

  useEffect(() => {
    void load(selectedDays);
  }, [load, selectedDays]);

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
    <div className="space-y-8 w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Overview</h2>
          <p className="text-sm text-muted-foreground">
            Completed orders only — online, POS, and kiosk with selectable day ranges.
          </p>
        </div>
        {slug ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a
                href={`/web-app/${encodeURIComponent(slug)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open website
                <IconExternalLink className="ml-2 h-4 w-4" aria-hidden />
              </a>
            </Button>
            <Button asChild variant="secondary">
              <a
                href={`/kiosk/${encodeURIComponent(slug)}`}
                title="Opens branch picker — use Settings for per-branch kiosk URLs"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open kiosk
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
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Completed orders (last 7 days)
                  </CardTitle>
                  <CardDescription>
                    Daily completed orders for Starter plan.
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

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Completed revenue (last 7 days)
                  </CardTitle>
                  <CardDescription>
                    Revenue from completed orders only (Starter plan).
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
              <Card>
                <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle className="text-base">
                      Completed orders trend ({analytics.days ?? selectedDays} days)
                    </CardTitle>
                    <CardDescription>
                      Completed orders by channel: Online, POS, and Kiosk.
                    </CardDescription>
                  </div>

                  <div className="inline-flex rounded-md border p-1">
                    {DAY_OPTIONS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={cn(
                          'rounded px-3 py-1 text-xs font-medium transition-colors',
                          selectedDays === d
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                        onClick={() => setSelectedDays(d)}
                      >
                        {d}d
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
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
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

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Channel mix (completed orders & revenue)
                    </CardTitle>
                    <CardDescription>
                      Share of completed orders and revenue by channel.
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

          return (
            <Link
              key={m.moduleKey}
              href={m.path}
              className={cn(
                'group rounded-xl outline-none ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-ring',
                !allowed && 'hidden'
              )}
              aria-label={`Open ${m.title}`}
            >
              <Card className="h-full border-border/80 shadow-sm transition-shadow group-hover:shadow-md group-hover:border-primary/30">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-medium">
                      {m.title}
                    </CardTitle>
                    <CardDescription>{hint}</CardDescription>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-2 text-muted-foreground group-hover:text-foreground group-hover:bg-muted/60">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold tabular-nums tracking-tight">
                    {value}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground group-hover:text-primary">
                    Go to module →
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
