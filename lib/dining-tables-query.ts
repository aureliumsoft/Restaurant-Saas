import type { DiningTableShape, DiningTableStatus } from '@prisma/client';

import { db } from '@/lib/db';

export type DiningTableListRow = {
  id: string;
  name: string;
  sortOrder: number;
  branchId: string | null;
  shape: DiningTableShape;
  status: DiningTableStatus;
  gridRow: number;
  gridCol: number;
  gridRowSpan: number;
  gridColSpan: number;
  createdAt: Date;
  updatedAt: Date;
};

export type BranchFloorSize = {
  tableFloorRows: number;
  tableFloorCols: number;
};

const DEFAULT_FLOOR: BranchFloorSize = {
  tableFloorRows: 4,
  tableFloorCols: 4,
};

const tableSelect = {
  id: true,
  name: true,
  sortOrder: true,
  branchId: true,
  shape: true,
  status: true,
  gridRow: true,
  gridCol: true,
  gridRowSpan: true,
  gridColSpan: true,
  createdAt: true,
  updatedAt: true,
} as const;

let branchColumnExists: boolean | null = null;

async function hasDiningTableBranchColumn(): Promise<boolean> {
  if (branchColumnExists !== null) return branchColumnExists;
  try {
    const rows = await db.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'DiningTable'
          AND column_name = 'branchId'
      ) AS "exists"
    `;
    branchColumnExists = Boolean(rows[0]?.exists);
  } catch {
    branchColumnExists = false;
  }
  return branchColumnExists;
}

export async function getBranchFloorSize(
  restaurantId: string,
  branchId: string | null
): Promise<BranchFloorSize> {
  if (!branchId) return { ...DEFAULT_FLOOR };
  const branch = await db.branch.findFirst({
    where: { id: branchId, restaurantId },
    select: { tableFloorRows: true, tableFloorCols: true },
  });
  if (!branch) return { ...DEFAULT_FLOOR };
  return {
    tableFloorRows: Math.max(1, branch.tableFloorRows || 4),
    tableFloorCols: Math.max(1, branch.tableFloorCols || 4),
  };
}

export async function updateBranchFloorSize(
  restaurantId: string,
  branchId: string,
  size: BranchFloorSize
): Promise<BranchFloorSize> {
  const rows = Math.min(40, Math.max(1, Math.floor(size.tableFloorRows)));
  const cols = Math.min(40, Math.max(1, Math.floor(size.tableFloorCols)));
  await db.branch.updateMany({
    where: { id: branchId, restaurantId },
    data: { tableFloorRows: rows, tableFloorCols: cols },
  });
  return { tableFloorRows: rows, tableFloorCols: cols };
}

export async function countDiningTables(
  restaurantId: string,
  branchId: string | null
): Promise<number> {
  const hasBranchCol = await hasDiningTableBranchColumn();
  if (!hasBranchCol || !branchId) {
    return db.diningTable.count({ where: { restaurantId } });
  }
  return db.diningTable.count({
    where: { restaurantId, branchId },
  });
}

export async function listDiningTables(
  restaurantId: string,
  branchId: string | null,
  pagination?: { skip: number; take: number }
): Promise<DiningTableListRow[]> {
  const hasBranchCol = await hasDiningTableBranchColumn();
  const where =
    !hasBranchCol || !branchId
      ? { restaurantId }
      : { restaurantId, branchId };

  const rows = await db.diningTable.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    ...(pagination
      ? { skip: pagination.skip, take: pagination.take }
      : {}),
    select: tableSelect,
  });
  return rows.map((r) => ({
    ...r,
    branchId: r.branchId ?? null,
  }));
}

export async function findDiningTableForBranch(
  tableId: string,
  restaurantId: string,
  branchId: string | null
): Promise<{ id: string; name: string; status: DiningTableStatus } | null> {
  const hasBranchCol = await hasDiningTableBranchColumn();
  if (!hasBranchCol || !branchId) {
    return db.diningTable.findFirst({
      where: { id: tableId, restaurantId },
      select: { id: true, name: true, status: true },
    });
  }
  return db.diningTable.findFirst({
    where: { id: tableId, restaurantId, branchId },
    select: { id: true, name: true, status: true },
  });
}

export type CreateDiningTableInput = {
  restaurantId: string;
  branchId: string;
  name: string;
  sortOrder: number;
  shape?: DiningTableShape;
  gridRow?: number;
  gridCol?: number;
  gridRowSpan?: number;
  gridColSpan?: number;
};

export async function createDiningTableRow(
  data: CreateDiningTableInput
): Promise<DiningTableListRow> {
  const hasBranchCol = await hasDiningTableBranchColumn();
  const shape = data.shape ?? 'SQUARE';
  const gridRow = data.gridRow ?? 0;
  const gridCol = data.gridCol ?? 0;
  const gridRowSpan = Math.max(1, data.gridRowSpan ?? 1);
  const gridColSpan = Math.max(1, data.gridColSpan ?? 1);

  if (!hasBranchCol) {
    const created = await db.diningTable.create({
      data: {
        restaurantId: data.restaurantId,
        name: data.name,
        sortOrder: data.sortOrder,
        shape,
        gridRow,
        gridCol,
        gridRowSpan,
        gridColSpan,
      },
      select: tableSelect,
    });
    return { ...created, branchId: null };
  }

  const created = await db.diningTable.create({
    data: {
      restaurantId: data.restaurantId,
      branchId: data.branchId,
      name: data.name,
      sortOrder: data.sortOrder,
      shape,
      gridRow,
      gridCol,
      gridRowSpan,
      gridColSpan,
    },
    select: tableSelect,
  });
  return { ...created, branchId: created.branchId ?? data.branchId };
}
