import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requirePlatformAdmin } from '@/lib/auth/adminRequest';
import { fetchTrafficMetricsReport } from '@/lib/seo/platform-traffic-metrics';

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if ('error' in auth) return auth.error;

  const daysRaw = req.nextUrl.searchParams.get('days');
  const days = daysRaw ? Number(daysRaw) : 28;
  const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1';

  try {
    const report = await fetchTrafficMetricsReport({
      days: Number.isFinite(days) ? days : 28,
      forceRefresh,
    });
    return NextResponse.json({ data: report });
  } catch (e) {
    console.error('admin/seo/traffic-metrics', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load metrics' },
      { status: 500 }
    );
  }
}
