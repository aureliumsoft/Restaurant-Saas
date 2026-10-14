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
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
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
        title={t('admin.traffic.title')}
        description={
          report
            ? t('admin.traffic.descriptionWithRange', {
                days: report.days,
                startDate: report.startDate,
                endDate: report.endDate,
                cached: report.cacheHit ? t('admin.traffic.cachedSuffix') : '',
              })
            : t('admin.traffic.descriptionDefault')
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
                <SelectValue placeholder={t('admin.traffic.range')} />
              </SelectTrigger>
              <SelectContent>
                {[7, 28, 90].map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {t('admin.traffic.daysOption', { count: d })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={loading}
              onClick={() => void load({ refresh: true })}
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
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
            {t('admin.traffic.connectApisPrefix')}{' '}
            <Link href="/admin/seo" className="underline underline-offset-2">
              {t('admin.nav.seo')}
            </Link>
            .
          </p>
        ) : null}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('admin.traffic.searchConsole')}
            {gsc && !gsc.configured && gsc.reason ? (
              <span className="ml-2 font-normal normal-case tracking-normal">
                — {gsc.reason}
              </span>
            ) : null}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AdminStatCard
              title={t('admin.traffic.clicks')}
              subtitle={t('admin.traffic.clicksSubtitle')}
              value={gsc?.configured ? formatInt(gsc.clicks ?? 0) : '—'}
              accentColor="#0ea5e9"
              icon={MousePointerClick}
            />
            <AdminStatCard
              title={t('admin.traffic.impressions')}
              subtitle={t('admin.traffic.impressionsSubtitle')}
              value={gsc?.configured ? formatInt(gsc.impressions ?? 0) : '—'}
              accentColor="#6366f1"
              icon={Eye}
            />
            <AdminStatCard
              title={t('admin.traffic.ctr')}
              subtitle={t('admin.traffic.ctrSubtitle')}
              value={gsc?.configured ? formatPct(gsc.ctr ?? 0) : '—'}
              accentColor="#10b981"
              icon={Target}
            />
            <AdminStatCard
              title={t('admin.traffic.avgPosition')}
              subtitle={t('admin.traffic.avgPositionSubtitle')}
              value={gsc?.configured ? formatPos(gsc.position ?? 0) : '—'}
              accentColor="#f59e0b"
              icon={Search}
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('admin.traffic.googleAnalytics')}
            {ga4 && !ga4.configured && ga4.reason ? (
              <span className="ml-2 font-normal normal-case tracking-normal">
                — {ga4.reason}
              </span>
            ) : null}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <AdminStatCard
              title={t('admin.traffic.users')}
              subtitle={t('admin.traffic.usersSubtitle')}
              value={ga4?.configured ? formatInt(ga4.users ?? 0) : '—'}
              accentColor="#ed6e40"
              icon={Users}
            />
            <AdminStatCard
              title={t('admin.traffic.sessions')}
              subtitle={t('admin.traffic.sessionsSubtitle')}
              value={ga4?.configured ? formatInt(ga4.sessions ?? 0) : '—'}
              accentColor="#8b5cf6"
              icon={BarChart3}
            />
            <AdminStatCard
              title={t('admin.traffic.pageViews')}
              subtitle={t('admin.traffic.pageViewsSubtitle')}
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
