import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  getBranchScopeFromRequest,
  userIsOwnerOrAdmin,
} from '@/lib/branch/branch-scope';
import { db } from '@/lib/db';
import { resolveReportDateRange } from '@/lib/reports/date-range';
import { queryTransactionLedger } from '@/lib/reports/transaction-ledger';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';
import type { TransactionHistoryKind } from '@/types/transaction-history';

export async function GET(req: NextRequest) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: 'reports',
    action: 'access',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const canViewHistorical = await userIsOwnerOrAdmin(
    auth.user.id,
    auth.restaurant.id
  );
  const branchScope = await getBranchScopeFromRequest(
    req,
    auth.user.id,
    auth.restaurant.id
  );
  const range = await resolveReportDateRange({
    database: db,
    canViewHistorical,
    fromParam: req.nextUrl.searchParams.get('from'),
    toParam: req.nextUrl.searchParams.get('to'),
  });

  const kindRaw = req.nextUrl.searchParams.get('kind');
  const kind: 'ALL' | TransactionHistoryKind =
    kindRaw === 'ORDER' ||
    kindRaw === 'SUBSCRIPTION' ||
    kindRaw === 'REGISTER'
      ? kindRaw
      : 'ALL';

  const result = await queryTransactionLedger({
    restaurantId: auth.restaurant.id,
    activeBranchId: branchScope?.activeBranchId ?? null,
    range,
    q: req.nextUrl.searchParams.get('q') ?? '',
    kind,
    searchParams: req.nextUrl.searchParams,
  });

  return NextResponse.json(
    {
      data: result.data,
      meta: {
        ...result.meta,
        take: result.meta.pageSize,
        canViewHistorical,
        dataScope: canViewHistorical ? 'all' : 'today',
        from: range.fromKey,
        to: range.toKey,
      },
      aggregates: result.aggregates,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
