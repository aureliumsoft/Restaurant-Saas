'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { format, formatDistanceToNow } from 'date-fns';
import {
  ArrowRight,
  Building2,
  CreditCard,
  FlaskConical,
  Inbox,
  RefreshCw,
  Settings,
  TrendingUp,
} from 'lucide-react';
import { useSession } from 'next-auth/react';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminStatCard } from '@/components/admin/admin-stat-card';
import {
  AdminSection,
  AdminSectionBody,
  AdminSectionHeader,
  adminInsetClass,
} from '@/components/admin/admin-surface';
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableEmpty,
  AdminTableHead,
  AdminTableHeader,
  AdminTableLead,
  AdminTableMuted,
  AdminTableRow,
  AdminTableWrapper,
} from '@/components/admin/admin-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type SubscriptionBreakdown = {
  active: number;
  trial: number;
  pastDue: number;
  canceled: number;
  noSubscription: number;
};

type RecentRestaurant = {
  id: string;
  name: string;
  subdomain: string;
  createdAt: string;
  owner: { name: string };
  subscription: { status: string; plan: string } | null;
};

type RecentRequest = {
  id: string;
  name: string;
  email: string;
  restaurantName: string;
  createdAt: string;
};

type Overview = {
  range?: {
    preset: 'monthly' | '3m' | '6m' | '1y' | 'custom';
    from: string;
    to: string;
  };
  restaurantCount: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  demoRequestCount: number;
  subscriptionBreakdown: SubscriptionBreakdown;
  recentRestaurants: RecentRestaurant[];
  recentRequests: RecentRequest[];
};

type RangePreset = 'monthly' | '3m' | '6m' | '1y' | 'custom';

const SUBSCRIPTION_SEGMENTS = [
  { key: 'active' as const, label: 'Active', color: '#10b981' },
  { key: 'trial' as const, label: 'Trial', color: '#3b82f6' },
  { key: 'pastDue' as const, label: 'Past due', color: '#f59e0b' },
  { key: 'canceled' as const, label: 'Canceled', color: '#94a3b8' },
  { key: 'noSubscription' as const, label: 'No plan', color: '#cbd5e1' },
];

const QUICK_ACTIONS = [
  {
    title: 'Restaurants',
    description: 'Browse tenants and owners',
    href: '/admin/restaurants',
    icon: Building2,
    color: '#ed6e40',
  },
  {
    title: 'Subscriptions',
    description: 'Plans, billing, and renewals',
    href: '/admin/subscriptions',
    icon: CreditCard,
    color: '#7c3aed',
  },
  {
    title: 'Demo requests',
    description: 'Leads from the marketing site',
    href: '/admin/requests',
    icon: Inbox,
    color: '#0ea5e9',
  },
  {
    title: 'Platform settings',
    description: 'Pricing and global config',
    href: '/admin/settings',
    icon: Settings,
    color: '#64748b',
  },
] as const;

function statusBadgeVariant(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'default' as const;
    case 'TRIAL':
      return 'secondary' as const;
    case 'PAST_DUE':
      return 'destructive' as const;
    default:
      return 'outline' as const;
  }
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-64 rounded-lg bg-muted" />
        <div className="h-4 w-96 max-w-full rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-44 rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-72 rounded-2xl bg-muted" />
        <div className="h-72 rounded-2xl bg-muted" />
      </div>
    </div>
  );
}

export function AdminDashboardOverview() {
  const { data: session } = useSession();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [preset, setPreset] = useState<RangePreset>('monthly');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('preset', preset);
    if (preset === 'custom') {
      if (customFrom) params.set('from', customFrom);
      if (customTo) params.set('to', customTo);
    }
    return params.toString();
  }, [preset, customFrom, customTo]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const r = await axios.get(`/api/admin/overview?${queryString}`);
      setData(r.data.data);
    } catch {
      setError('Could not load platform overview. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [queryString]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh when a non-custom preset changes.
  useEffect(() => {
    if (preset === 'custom') return;
    load();
  }, [preset, load]);

  const conversionRate = useMemo(() => {
    if (!data || data.restaurantCount === 0) return 0;
    return Math.round((data.activeSubscriptions / data.restaurantCount) * 100);
  }, [data]);

  const subscriptionSegments = useMemo(() => {
    if (!data) return [];
    const total = data.restaurantCount || 1;
    return SUBSCRIPTION_SEGMENTS.map((seg) => ({
      ...seg,
      count: data.subscriptionBreakdown[seg.key],
      percent: Math.round((data.subscriptionBreakdown[seg.key] / total) * 100),
    })).filter((s) => s.count > 0);
  }, [data]);

  const firstName = session?.user?.name?.split(' ')[0] ?? 'Admin';
  const rangeLabel = useMemo(() => {
    switch (preset) {
      case 'monthly':
        return 'This month';
      case '3m':
        return 'Last 3 months';
      case '6m':
        return 'Last 6 months';
      case '1y':
        return 'Last year';
      case 'custom':
        return 'Custom range';
      default:
        return 'This month';
    }
  }, [preset]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/80 bg-card/50 p-8 text-center">
        <p className="text-sm text-destructive">{error ?? 'Something went wrong.'}</p>
        <Button type="button" variant="outline" onClick={() => load()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Overview"
        title={`Welcome back, ${firstName}`}
        description={`Showing ${rangeLabel} — updated ${format(new Date(), 'EEEE, MMM d')}`}
        actions={
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Select value={preset} onValueChange={(v) => setPreset(v as RangePreset)}>
                <SelectTrigger className="h-9 w-[170px] rounded-xl">
                  <SelectValue placeholder="Date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="3m">3 months</SelectItem>
                  <SelectItem value="6m">6 months</SelectItem>
                  <SelectItem value="1y">1 year</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={refreshing}
                onClick={() => load(true)}
              >
                <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              </Button>
            </div>

            {preset === 'custom' ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-9 rounded-xl"
                />
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-9 rounded-xl"
                />
                <Button
                  type="button"
                  size="sm"
                  className="rounded-xl"
                  disabled={!customFrom || !customTo || refreshing}
                  onClick={() => load(true)}
                >
                  Apply
                </Button>
              </div>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          title="Restaurants"
          subtitle="Total onboarded tenants"
          value={data.restaurantCount}
          accentColor="#ed6e40"
          icon={Building2}
          href="/admin/restaurants"
        />
        <AdminStatCard
          title="Active subscriptions"
          subtitle="Paying or active plans"
          value={data.activeSubscriptions}
          accentColor="#10b981"
          icon={CreditCard}
          href="/admin/subscriptions"
          badge={`${conversionRate}% conversion`}
        />
        <AdminStatCard
          title="Trials"
          subtitle="Restaurants in trial period"
          value={data.trialSubscriptions}
          accentColor="#3b82f6"
          icon={FlaskConical}
          href="/admin/subscriptions"
        />
        <AdminStatCard
          title="Demo requests"
          subtitle="Leads from marketing site"
          value={data.demoRequestCount}
          accentColor="#0ea5e9"
          icon={Inbox}
          href="/admin/requests"
        />
      </div>


      <div className="grid gap-5 lg:grid-cols-5">
        <AdminSection className="lg:col-span-3">
          <AdminSectionHeader
            title="Subscription health"
            description={`Distribution across all ${data.restaurantCount} restaurants`}
            action={
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <TrendingUp className="h-3.5 w-3.5" />
                {conversionRate}% active
              </div>
            }
          />
          <AdminSectionBody className="space-y-5 pt-0">
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/80 dark:bg-zinc-900/50">
              {subscriptionSegments.map((seg) => (
                <div
                  key={seg.key}
                  className="h-full transition-all"
                  style={{
                    width: `${(seg.count / data.restaurantCount) * 100}%`,
                    backgroundColor: seg.color,
                  }}
                  title={`${seg.label}: ${seg.count}`}
                />
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {subscriptionSegments.map((seg) => (
                <div
                  key={seg.key}
                  className={cn(
                    'flex items-center justify-between rounded-xl px-3 py-2.5',
                    adminInsetClass
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="text-sm font-medium">{seg.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold tabular-nums">{seg.count}</span>
                    <span className="ml-1.5 text-xs text-muted-foreground">({seg.percent}%)</span>
                  </div>
                </div>
              ))}
            </div>

            <div className={cn('space-y-2 rounded-xl p-4', adminInsetClass)}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Trial → active conversion</span>
                <span className="font-semibold tabular-nums">{conversionRate}%</span>
              </div>
              <Progress value={conversionRate} className="h-1.5 bg-white/80 dark:bg-zinc-900/50" />
            </div>
          </AdminSectionBody>
        </AdminSection>

        <AdminSection className="lg:col-span-2">
          <AdminSectionHeader
            title="Quick actions"
            description="Jump to common admin tasks"
          />
          <AdminSectionBody className="grid gap-1.5 pt-0">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-white/70 dark:hover:bg-zinc-900/50"
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${action.color}14`, color: action.color }}
                >
                  <action.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{action.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{action.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </Link>
            ))}
          </AdminSectionBody>
        </AdminSection>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <AdminSection>
          <AdminSectionHeader
            title="Recent restaurants"
            description="Latest tenants onboarded"
            action={
              <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
                <Link href="/admin/restaurants">
                  View all
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            }
          />
          <AdminSectionBody className="min-w-0 px-0 pb-4 pt-0">
            <AdminTableWrapper>
            {data.recentRestaurants.length === 0 ? (
              <AdminTableEmpty>No restaurants yet.</AdminTableEmpty>
            ) : (
              <AdminTable minWidth={560}>
                <AdminTableHeader>
                  <AdminTableRow>
                    <AdminTableHead>Restaurant</AdminTableHead>
                    <AdminTableHead>Owner</AdminTableHead>
                    <AdminTableHead>Status</AdminTableHead>
                    <AdminTableHead className="text-right">Joined</AdminTableHead>
                  </AdminTableRow>
                </AdminTableHeader>
                <AdminTableBody>
                  {data.recentRestaurants.map((r) => (
                    <AdminTableRow key={r.id}>
                      <AdminTableCell>
                        <AdminTableLead title={r.name} subtitle={r.subdomain} />
                      </AdminTableCell>
                      <AdminTableCell>
                        <AdminTableMuted>{r.owner.name}</AdminTableMuted>
                      </AdminTableCell>
                      <AdminTableCell>
                        {r.subscription ? (
                          <Badge variant={statusBadgeVariant(r.subscription.status)} className="rounded-md">
                            {r.subscription.status}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="rounded-md">None</Badge>
                        )}
                      </AdminTableCell>
                      <AdminTableCell className="text-right">
                        <AdminTableMuted>
                          {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                        </AdminTableMuted>
                      </AdminTableCell>
                    </AdminTableRow>
                  ))}
                </AdminTableBody>
              </AdminTable>
            )}
            </AdminTableWrapper>
          </AdminSectionBody>
        </AdminSection>

        <AdminSection>
          <AdminSectionHeader
            title="Recent demo requests"
            description="Latest inbound leads"
            action={
              <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
                <Link href="/admin/requests">
                  View all
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            }
          />
          <AdminSectionBody className="min-w-0 px-0 pb-4 pt-0">
            <AdminTableWrapper>
            {data.recentRequests.length === 0 ? (
              <AdminTableEmpty>No demo requests yet.</AdminTableEmpty>
            ) : (
              <AdminTable minWidth={560}>
                <AdminTableHeader>
                  <AdminTableRow>
                    <AdminTableHead>Contact</AdminTableHead>
                    <AdminTableHead>Restaurant</AdminTableHead>
                    <AdminTableHead className="text-right">Requested</AdminTableHead>
                  </AdminTableRow>
                </AdminTableHeader>
                <AdminTableBody>
                  {data.recentRequests.map((r) => (
                    <AdminTableRow key={r.id}>
                      <AdminTableCell>
                        <AdminTableLead title={r.name} subtitle={r.email} accent="#0ea5e9" />
                      </AdminTableCell>
                      <AdminTableCell>
                        <span className="font-medium">{r.restaurantName}</span>
                      </AdminTableCell>
                      <AdminTableCell className="text-right">
                        <AdminTableMuted>
                          {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                        </AdminTableMuted>
                      </AdminTableCell>
                    </AdminTableRow>
                  ))}
                </AdminTableBody>
              </AdminTable>
            )}
            </AdminTableWrapper>
          </AdminSectionBody>
        </AdminSection>
      </div>
    </div>
  );
}
