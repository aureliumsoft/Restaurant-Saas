import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { validateBranchForRestaurant } from '@/lib/branch/branch-scope';
import { listDiningTables } from '@/lib/dining-tables-query';
import { db } from '@/lib/db';
import { resolveQueryParam } from '@/lib/resolve-route-id';

export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get('slug')?.trim();
    const branchId = resolveQueryParam(req.nextUrl.searchParams, 'branchId');

    if (!slug) {
      return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
    }

    const restaurant = await db.restaurant.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!restaurant) {
      return NextResponse.json({ data: [] }, { status: 200 });
    }

    if (!branchId) {
      return NextResponse.json({ data: [] }, { status: 200 });
    }

    if (!(await validateBranchForRestaurant(branchId, restaurant.id))) {
      return NextResponse.json({ error: 'Invalid branch' }, { status: 400 });
    }

    const rows = await listDiningTables(restaurant.id, branchId);

    return NextResponse.json(
      {
        data: rows.map((r) => ({
          id: r.id,
          name: r.name,
          sortOrder: r.sortOrder,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('customer tables', error);
    return NextResponse.json(
      { error: 'Failed to load tables.' },
      { status: 500 }
    );
  }
}
