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
  getBranchFloorSize,
  listDiningTables,
} from '@/lib/dining-tables-query';
import {
  buildPaginationMeta,
  parsePaginationParams,
} from '@/lib/pagination';
import { resolveQueryParam } from '@/lib/resolve-route-id';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';
import { withUrlIds } from '@/lib/with-url-id';

const shapeSchema = z.enum(['CIRCLE', 'SQUARE', 'RECTANGLE']);

const postSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  branchId: z.string().uuid().optional(),
  shape: shapeSchema.optional(),
  gridRow: z.number().int().min(0).max(39).optional(),
  gridCol: z.number().int().min(0).max(39).optional(),
  gridRowSpan: z.number().int().min(1).max(4).optional(),
  gridColSpan: z.number().int().min(1).max(4).optional(),
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
  const queryBranchId = resolveQueryParam(req.nextUrl.searchParams, 'branchId');
  const activeBranchId =
    queryBranchId || branchScope?.activeBranchId || null;
  const wantsPagination = req.nextUrl.searchParams.get('page') != null;
  const floor = await getBranchFloorSize(auth.restaurant.id, activeBranchId);

  if (!wantsPagination) {
    const rows = await listDiningTables(auth.restaurant.id, activeBranchId);
    return NextResponse.json(
      {
        data: withUrlIds(rows),
        activeBranchId,
        floor,
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
      data: withUrlIds(rows),
      activeBranchId,
      floor,
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
      shape: parsed.data.shape,
      gridRow: parsed.data.gridRow,
      gridCol: parsed.data.gridCol,
      gridRowSpan: parsed.data.gridRowSpan,
      gridColSpan: parsed.data.gridColSpan,
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
