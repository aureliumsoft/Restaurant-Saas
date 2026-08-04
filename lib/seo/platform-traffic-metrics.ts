import { getPlatformSetting } from '@/lib/platform-settings';
import {
  getGoogleReportingAccessToken,
  isGoogleReportingAuthConfigured,
} from '@/lib/seo/google-auth';
import type {
  Ga4Totals,
  GscTotals,
  TrafficMetricsReport,
} from '@/lib/seo/traffic-metrics-types';

export type { TrafficMetricsReport } from '@/lib/seo/traffic-metrics-types';

const GSC_API = 'https://www.googleapis.com/webmasters/v3';
const GA4_API = 'https://analyticsdata.googleapis.com/v1beta';

const memoryCache = new Map<string, { expiresAt: number; report: TrafficMetricsReport }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

function formatDateUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** GSC/GA data is delayed; end ~3 days ago for stable Search Console figures. */
function dateRange(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { startDate: formatDateUTC(start), endDate: formatDateUTC(end) };
}

async function fetchGscTotals(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<GscTotals> {
  const url = `${GSC_API}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ['date'],
      rowLimit: 100,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GSC API ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    rows?: Array<{
      clicks?: number;
      impressions?: number;
      ctr?: number;
      position?: number;
    }>;
  };
  const rows = json.rows ?? [];
  const clicks = rows.reduce((s, r) => s + (r.clicks ?? 0), 0);
  const impressions = rows.reduce((s, r) => s + (r.impressions ?? 0), 0);
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const weighted = rows.reduce(
    (s, r) => s + (r.position ?? 0) * (r.impressions ?? 0),
    0
  );
  const position = impressions > 0 ? weighted / impressions : 0;
  return { clicks, impressions, ctr, position };
}

async function fetchGa4Totals(
  accessToken: string,
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<Ga4Totals> {
  const url = `${GA4_API}/properties/${propertyId}:runReport`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: 'totalUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 API ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    rows?: Array<{ metricValues?: Array<{ value?: string }> }>;
  };
  const values = json.rows?.[0]?.metricValues ?? [];
  return {
    users: Number(values[0]?.value ?? 0) || 0,
    sessions: Number(values[1]?.value ?? 0) || 0,
    pageViews: Number(values[2]?.value ?? 0) || 0,
  };
}

export async function fetchTrafficMetricsReport(options?: {
  days?: number;
  forceRefresh?: boolean;
}): Promise<TrafficMetricsReport> {
  const days = Math.min(90, Math.max(7, options?.days ?? 28));
  const { startDate, endDate } = dateRange(days);
  const siteUrl = (await getPlatformSetting('seo_gsc_property_url')).trim();
  const propertyId = (
    await getPlatformSetting('seo_ga4_property_id')
  ).trim().replace(/\D/g, '');

  const authConfigured = await isGoogleReportingAuthConfigured();
  const cacheKey = `${days}|${startDate}|${endDate}|${siteUrl}|${propertyId}|${authConfigured}`;
  const cached = memoryCache.get(cacheKey);
  if (!options?.forceRefresh && cached && cached.expiresAt > Date.now()) {
    return { ...cached.report, cacheHit: true };
  }

  const report: TrafficMetricsReport = {
    days,
    startDate,
    endDate,
    cachedAt: new Date().toISOString(),
    cacheHit: false,
    authConfigured,
    gsc: {
      configured: false,
      reason: !siteUrl
        ? 'Set Search Console property URL in Admin → SEO.'
        : !authConfigured
          ? 'Add service account JSON or OAuth credentials under Admin → SEO.'
          : undefined,
    },
    ga4: {
      configured: false,
      reason: !propertyId
        ? 'Set GA4 Property ID (numeric) in Admin → SEO.'
        : !authConfigured
          ? 'Add service account JSON or OAuth credentials under Admin → SEO.'
          : undefined,
    },
  };

  if (!authConfigured) {
    memoryCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      report,
    });
    return report;
  }

  let accessToken: string;
  try {
    accessToken = await getGoogleReportingAccessToken();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Auth failed';
    report.gsc.reason = msg;
    report.ga4.reason = msg;
    return report;
  }

  const tasks: Promise<void>[] = [];

  if (siteUrl) {
    tasks.push(
      fetchGscTotals(accessToken, siteUrl, startDate, endDate)
        .then((totals) => {
          report.gsc = { configured: true, ...totals };
        })
        .catch((e) => {
          report.gsc = {
            configured: false,
            reason: e instanceof Error ? e.message : 'GSC request failed',
          };
        })
    );
  }

  if (propertyId) {
    tasks.push(
      fetchGa4Totals(accessToken, propertyId, startDate, endDate)
        .then((totals) => {
          report.ga4 = { configured: true, ...totals };
        })
        .catch((e) => {
          report.ga4 = {
            configured: false,
            reason: e instanceof Error ? e.message : 'GA4 request failed',
          };
        })
    );
  }

  await Promise.all(tasks);

  memoryCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    report,
  });
  return report;
}
