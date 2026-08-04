'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
  BarChart3,
  Eye,
  Loader2,
  MousePointerClick,
  RefreshCw,
  Search,
  Target,
  Users,
} from 'lucide-react';
import Link from 'next/link';

import { AdminStatCard } from '@/components/admin/admin-stat-card';
import {
  AdminSection,
  AdminSectionBody,
  AdminSectionHeader,
} from '@/components/admin/admin-surface';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TrafficMetricsReport } from '@/lib/seo/traffic-metrics-types';

function formatInt(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
    n
  );
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function formatPos(n: number): string {
  return n.toFixed(1);
}

export function AdminTrafficMetrics() {
  const [report, setReport] = useState<TrafficMetricsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(28);

  const load = useCallback(
    async (opts?: { refresh?: boolean; range?: number }) => {
      const range = opts?.range ?? days;
      setLoading(true);
      try {
        const params = new URLSearchParams({ days: String(range) });
        if (opts?.refresh) params.set('refresh', '1');
        const res = await axios.get<{ data: TrafficMetricsReport }>(
          `/api/admin/seo/traffic-metrics?${params}`
        );
        setReport(res.data.data);
      } catch {
        setReport(null);
      } finally {
        setLoading(false);
      }
    },
    [days]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const gsc = report?.gsc;
  const ga4 = report?.ga4;

  return (
    <AdminSection>
      <AdminSectionHeader
        title="Search & traffic"
        description={
          report
            ? `Google Search Console + Analytics · last ${report.days} days (${report.startDate} → ${report.endDate})${report.cacheHit ? ' · cached' : ''}`
            : 'Platform marketing metrics from Google APIs'
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={String(days)}
              disabled={loading}
              onValueChange={(value) => {
                const range = Number(value);
                setDays(range);
                void load({ range });
              }}
            >
              <SelectTrigger className="h-9 w-[100px] rounded-xl">
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent>
                {[7, 28, 90].map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d} Days
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={loading}
              onClick={() => void load({ refresh: true })}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        }
      />
      <AdminSectionBody className="space-y-4">
        {loading && !report ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : null}

        {!loading && report && !report.authConfigured ? (
          <p className="text-sm text-muted-foreground">
            Connect APIs: set a service account or refresh token in server env,
            then property URL and GA4 Property ID under{' '}
            <Link href="/admin/seo" className="underline underline-offset-2">
              SEO & analytics
            </Link>
            .
          </p>
        ) : null}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Search Console
            {gsc && !gsc.configured && gsc.reason ? (
              <span className="ml-2 font-normal normal-case tracking-normal">
                — {gsc.reason}
              </span>
            ) : null}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AdminStatCard
              title="Clicks"
              subtitle="Organic search clicks"
              value={gsc?.configured ? formatInt(gsc.clicks ?? 0) : '—'}
              accentColor="#0ea5e9"
              icon={MousePointerClick}
            />
            <AdminStatCard
              title="Impressions"
              subtitle="Times shown in search"
              value={gsc?.configured ? formatInt(gsc.impressions ?? 0) : '—'}
              accentColor="#6366f1"
              icon={Eye}
            />
            <AdminStatCard
              title="CTR"
              subtitle="Click-through rate"
              value={gsc?.configured ? formatPct(gsc.ctr ?? 0) : '—'}
              accentColor="#10b981"
              icon={Target}
            />
            <AdminStatCard
              title="Avg. position"
              subtitle="Search ranking"
              value={gsc?.configured ? formatPos(gsc.position ?? 0) : '—'}
              accentColor="#f59e0b"
              icon={Search}
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Google Analytics 4
            {ga4 && !ga4.configured && ga4.reason ? (
              <span className="ml-2 font-normal normal-case tracking-normal">
                — {ga4.reason}
              </span>
            ) : null}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <AdminStatCard
              title="Users"
              subtitle="Total users"
              value={ga4?.configured ? formatInt(ga4.users ?? 0) : '—'}
              accentColor="#ed6e40"
              icon={Users}
            />
            <AdminStatCard
              title="Sessions"
              subtitle="Total sessions"
              value={ga4?.configured ? formatInt(ga4.sessions ?? 0) : '—'}
              accentColor="#8b5cf6"
              icon={BarChart3}
            />
            <AdminStatCard
              title="Page views"
              subtitle="Screen / page views"
              value={ga4?.configured ? formatInt(ga4.pageViews ?? 0) : '—'}
              accentColor="#14b8a6"
              icon={Eye}
            />
          </div>
        </div>
      </AdminSectionBody>
    </AdminSection>
  );
}
