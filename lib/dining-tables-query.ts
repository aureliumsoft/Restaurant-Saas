import { db } from '@/lib/db';

export type DiningTableListRow = {
  id: string;
  name: string;
  sortOrder: number;
  branchId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

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

export async function countDiningTables(
  restaurantId: string,
  branchId: string | null
): Promise<number> {
  const hasBranchCol = await hasDiningTableBranchColumn();
  if (!hasBranchCol || !branchId) {
    return db.diningTable.count({ where: { restaurantId } });
  }
  const rows = await db.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "DiningTable"
    WHERE "restaurantId" = ${restaurantId}
      AND "branchId" = ${branchId}
  `;
  return Number(rows[0]?.count ?? 0);
}

export async function listDiningTables(
  restaurantId: string,
  branchId: string | null
): Promise<DiningTableListRow[]> {
  const hasBranchCol = await hasDiningTableBranchColumn();
  if (!hasBranchCol || !branchId) {
    const rows = await db.diningTable.findMany({
      where: { restaurantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return rows.map((r) => ({ ...r, branchId: null }));
  }
  return db.$queryRaw<DiningTableListRow[]>`
    SELECT id, name, "sortOrder", "branchId", "createdAt", "updatedAt"
    FROM "DiningTable"
    WHERE "restaurantId" = ${restaurantId}
      AND "branchId" = ${branchId}
    ORDER BY "sortOrder" ASC, name ASC
  `;
}

export async function findDiningTableForBranch(
  tableId: string,
  restaurantId: string,
  branchId: string | null
): Promise<{ id: string; name: string } | null> {
  const hasBranchCol = await hasDiningTableBranchColumn();
  if (!hasBranchCol || !branchId) {
    return db.diningTable.findFirst({
      where: { id: tableId, restaurantId },
      select: { id: true, name: true },
    });
  }
  const rows = await db.$queryRaw<{ id: string; name: string }[]>`
    SELECT id, name
    FROM "DiningTable"
    WHERE id = ${tableId}
      AND "restaurantId" = ${restaurantId}
      AND "branchId" = ${branchId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function createDiningTableRow(data: {
  restaurantId: string;
  branchId: string;
  name: string;
  sortOrder: number;
}): Promise<DiningTableListRow> {
  const hasBranchCol = await hasDiningTableBranchColumn();
  if (!hasBranchCol) {
    const created = await db.diningTable.create({
      data: {
        restaurantId: data.restaurantId,
        name: data.name,
        sortOrder: data.sortOrder,
      },
      select: {
        id: true,
        name: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return { ...created, branchId: null };
  }
  const rows = await db.$queryRaw<DiningTableListRow[]>`
    INSERT INTO "DiningTable" (
      "id", "restaurantId", "branchId", "name", "sortOrder", "createdAt", "updatedAt"
    )
    VALUES (
      gen_random_uuid()::text,
      ${data.restaurantId},
      ${data.branchId},
      ${data.name},
      ${data.sortOrder},
      NOW(),
      NOW()
    )
    RETURNING id, name, "sortOrder", "branchId", "createdAt", "updatedAt"
  `;
  return rows[0]!;
}
