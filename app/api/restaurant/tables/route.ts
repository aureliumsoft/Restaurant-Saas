import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getBranchScopeFromRequest,
  validateBranchForRestaurant,
} from '@/lib/branch/branch-scope';
import {
  createDiningTableRow,
  countDiningTables,
  listDiningTables,
} from '@/lib/dining-tables-query';
import { db } from '@/lib/db';
import {
  buildPaginationMeta,
  parsePaginationParams,
} from '@/lib/pagination';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';

const postSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  branchId: z.string().uuid().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKeys: ['tables', 'pos'],
    action: 'access',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const branchScope = await getBranchScopeFromRequest(
    req,
    auth.user.id,
    auth.restaurant.id
  );
  const activeBranchId = branchScope?.activeBranchId ?? null;
  const wantsPagination = req.nextUrl.searchParams.get('page') != null;

  if (!wantsPagination) {
    const rows = await listDiningTables(auth.restaurant.id, activeBranchId);
    return NextResponse.json(
      {
        data: rows,
        activeBranchId,
      },
      { status: 200 }
    );
  }

  const { page, pageSize, skip, take } = parsePaginationParams(
    req.nextUrl.searchParams,
    { defaultPageSize: 20 }
  );
  const [total, rows] = await Promise.all([
    countDiningTables(auth.restaurant.id, activeBranchId),
    listDiningTables(auth.restaurant.id, activeBranchId, { skip, take }),
  ]);

  return NextResponse.json(
    {
      data: rows,
      activeBranchId,
      pagination: buildPaginationMeta(page, pageSize, total),
    },
    { status: 200 }
  );
}

export async function POST(req: NextRequest) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: 'tables',
    action: 'edit',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const branchScope = await getBranchScopeFromRequest(
    req,
    auth.user.id,
    auth.restaurant.id
  );
  const branchId =
    parsed.data.branchId?.trim() ||
    branchScope?.activeBranchId ||
    null;

  if (!branchId) {
    return NextResponse.json(
      { error: 'Select a branch before adding tables' },
      { status: 400 }
    );
  }

  if (!(await validateBranchForRestaurant(branchId, auth.restaurant.id))) {
    return NextResponse.json({ error: 'Invalid branch' }, { status: 400 });
  }

  if (
    branchScope &&
    !branchScope.isOwnerOrAdmin &&
    !branchScope.allowedBranchIds.includes(branchId)
  ) {
    return NextResponse.json(
      { error: 'You do not have access to this branch.' },
      { status: 403 }
    );
  }

  const name = parsed.data.name.trim();
  const sortOrder = parsed.data.sortOrder ?? 0;

  try {
    const created = await createDiningTableRow({
      restaurantId: auth.restaurant.id,
      branchId,
      name,
      sortOrder,
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === 'P2002') {
      return NextResponse.json(
        { error: 'A table with this name already exists at this branch' },
        { status: 409 }
      );
    }
    console.error(e);
    return NextResponse.json({ error: 'Failed to create table' }, { status: 500 });
  }
}
