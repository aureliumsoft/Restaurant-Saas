import { NextRequest, NextResponse } from 'next/server';

import {
  getBranchScopeFromRequest,
  userIsOwnerOrAdmin,
} from '@/lib/branch/branch-scope';
import { db } from '@/lib/db';
import { resolveReportDateRange } from '@/lib/reports/date-range';
import { queryTransactionLedger } from '@/lib/reports/transaction-ledger';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import {
  getTodayCreatedAtBounds,
  salesOrderFilterTimezone,
} from '@/lib/sales-order-period';
import type { TransactionHistoryKind } from '@/types/transaction-history';

export async function GET(req: NextRequest) {
  try {
    const auth = await getRestaurantIdForRequest(req, {
      moduleKey: 'records',
      action: 'access',
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const restaurantId = auth.restaurantId;
    const canViewHistorical = await userIsOwnerOrAdmin(
      auth.userId,
      restaurantId
    );
    const branchScope = await getBranchScopeFromRequest(
      req,
      auth.userId,
      restaurantId
    );

    const fromParam = req.nextUrl.searchParams.get('from');
    const toParam = req.nextUrl.searchParams.get('to');
    const hasExplicitRange = Boolean(fromParam || toParam);

    let range;
    if (hasExplicitRange || canViewHistorical) {
      range = await resolveReportDateRange({
        database: db,
        canViewHistorical,
        fromParam: hasExplicitRange
          ? fromParam
          : canViewHistorical
            ? '1970-01-01'
            : null,
        toParam: hasExplicitRange ? toParam : null,
      });
    } else {
      const tz = salesOrderFilterTimezone();
      const bounds = await getTodayCreatedAtBounds(db, tz);
      const todayKey = (
        await resolveReportDateRange({
          database: db,
          canViewHistorical: false,
        })
      ).fromKey;
      range = {
        from: bounds.gte,
        to: new Date(bounds.lt.getTime() - 1),
        fromKey: todayKey,
        toKey: todayKey,
      };
    }

    // Records page historically shows all history for owners when no dates set
    if (canViewHistorical && !hasExplicitRange) {
      range = {
        from: new Date(0),
        to: new Date(),
        fromKey: '1970-01-01',
        toKey: range.toKey,
      };
    }

    const kindRaw = req.nextUrl.searchParams.get('kind');
    const kind: 'ALL' | TransactionHistoryKind =
      kindRaw === 'ORDER' ||
      kindRaw === 'SUBSCRIPTION' ||
      kindRaw === 'REGISTER'
        ? kindRaw
        : 'ALL';

    const result = await queryTransactionLedger({
      restaurantId,
      activeBranchId: branchScope?.activeBranchId ?? null,
      range,
      q: req.nextUrl.searchParams.get('q') ?? '',
      kind,
      searchParams: req.nextUrl.searchParams,
    });

    return NextResponse.json({
      data: result.data,
      meta: {
        page: result.meta.page,
        take: result.meta.pageSize,
        total: result.meta.total,
        totalPages: result.meta.totalPages,
        hasNextPage: result.meta.hasNextPage,
        hasPrevPage: result.meta.hasPrevPage,
        canViewHistorical,
        dataScope: canViewHistorical ? 'all' : 'today',
      },
    });
  } catch (error) {
    console.error('transaction-history GET failed', error);
    return NextResponse.json(
      { error: 'Failed to load transaction history' },
      { status: 500 }
    );
  }
}
