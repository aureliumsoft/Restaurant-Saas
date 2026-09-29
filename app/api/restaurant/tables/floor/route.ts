import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getBranchScopeFromRequest,
  validateBranchForRestaurant,
} from '@/lib/branch/branch-scope';
import {
  getBranchFloorSize,
  listDiningTables,
  updateBranchFloorSize,
} from '@/lib/dining-tables-query';
import { db } from '@/lib/db';
import { openTableOrdersWhere } from '@/lib/table-open-orders';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';
import { withUrlIds } from '@/lib/with-url-id';

const shapeSchema = z.enum(['CIRCLE', 'SQUARE', 'RECTANGLE']);

const tableDraftSchema = z.object({
  id: z.string().min(1).max(80).optional().nullable(),
  name: z.string().min(1).max(120).trim(),
  shape: shapeSchema,
  gridRow: z.number().int().min(0).max(39),
  gridCol: z.number().int().min(0).max(39),
  gridRowSpan: z.number().int().min(1).max(4).default(1),
  gridColSpan: z.number().int().min(1).max(4).default(1),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

const floorSaveSchema = z.object({
  branchId: z.string().uuid(),
  tableFloorRows: z.number().int().min(1).max(40),
  tableFloorCols: z.number().int().min(1).max(40),
  tables: z.array(tableDraftSchema).max(200),
  deletedIds: z.array(z.string().uuid()).max(200).default([]),
});

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

/** Persist a full floor-plan draft (create / update / delete + floor size). */
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

  const parsed = floorSaveSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { branchId, tables, deletedIds, tableFloorRows, tableFloorCols } =
    parsed.data;

  if (!(await validateBranchForRestaurant(branchId, auth.restaurant.id))) {
    return NextResponse.json({ error: 'Invalid branch' }, { status: 400 });
  }

  const branchScope = await getBranchScopeFromRequest(
    req,
    auth.user.id,
    auth.restaurant.id
  );
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

  if (deletedIds.length > 0) {
    const openOnDeleted = await db.order.findFirst({
      where: {
        ...openTableOrdersWhere(auth.restaurant.id, branchId),
        diningTableId: { in: deletedIds },
      },
      select: { id: true },
    });
    if (openOnDeleted) {
      return NextResponse.json(
        {
          error:
            'Cannot delete a table that still has an open order. Close or move the order first.',
        },
        { status: 409 }
      );
    }
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.branch.updateMany({
        where: { id: branchId, restaurantId: auth.restaurant.id },
        data: { tableFloorRows, tableFloorCols },
      });

      if (deletedIds.length > 0) {
        await tx.diningTable.deleteMany({
          where: {
            restaurantId: auth.restaurant.id,
            branchId,
            id: { in: deletedIds },
          },
        });
      }

      for (const [index, table] of tables.entries()) {
        const sortOrder = table.sortOrder ?? index;
        const existingId =
          table.id && isUuid(table.id) ? table.id : null;
        if (existingId) {
          const owned = await tx.diningTable.findFirst({
            where: {
              id: existingId,
              restaurantId: auth.restaurant.id,
              branchId,
            },
            select: { id: true },
          });
          if (owned) {
            await tx.diningTable.update({
              where: { id: existingId },
              data: {
                name: table.name.trim(),
                shape: table.shape,
                gridRow: table.gridRow,
                gridCol: table.gridCol,
                gridRowSpan: table.gridRowSpan,
                gridColSpan: table.gridColSpan,
                sortOrder,
              },
            });
            continue;
          }
        }
        await tx.diningTable.create({
          data: {
            restaurantId: auth.restaurant.id,
            branchId,
            name: table.name.trim(),
            sortOrder,
            shape: table.shape,
            gridRow: table.gridRow,
            gridCol: table.gridCol,
            gridRowSpan: table.gridRowSpan,
            gridColSpan: table.gridColSpan,
          },
        });
      }
    });

    await updateBranchFloorSize(auth.restaurant.id, branchId, {
      tableFloorRows,
      tableFloorCols,
    });

    const [floor, rows] = await Promise.all([
      getBranchFloorSize(auth.restaurant.id, branchId),
      listDiningTables(auth.restaurant.id, branchId),
    ]);

    return NextResponse.json(
      { data: withUrlIds(rows), floor },
      { status: 200 }
    );
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === 'P2002') {
      return NextResponse.json(
        { error: 'A table with this name already exists at this branch' },
        { status: 409 }
      );
    }
    console.error('tables floor save', e);
    return NextResponse.json(
      { error: 'Failed to save floor plan' },
      { status: 500 }
    );
  }
}
