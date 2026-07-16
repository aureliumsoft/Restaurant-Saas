import type { Prisma } from '@prisma/client';

import { db } from '@/lib/db';

type DbClient = Prisma.TransactionClient | typeof db;

export function normalizeMenuItemCategoryIds(categoryIds: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of categoryIds) {
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export async function validateMenuItemCategoryIds(
  client: DbClient,
  restaurantId: string,
  categoryIds: string[]
): Promise<string[] | null> {
  const unique = normalizeMenuItemCategoryIds(categoryIds);
  if (unique.length === 0) return null;

  const count = await client.menuCategory.count({
    where: { id: { in: unique }, restaurantId },
  });
  if (count !== unique.length) return null;
  return unique;
}

/** Replace category links and return the primary category id (first in list). */
export async function syncMenuItemCategoryLinks(
  client: DbClient,
  menuItemId: string,
  categoryIds: string[]
): Promise<string> {
  const unique = normalizeMenuItemCategoryIds(categoryIds);
  if (unique.length === 0) {
    throw new Error('At least one category is required');
  }

  await client.menuItemCategory.deleteMany({ where: { menuItemId } });
  await client.menuItemCategory.createMany({
    data: unique.map((categoryId, index) => ({
      menuItemId,
      categoryId,
      sortOrder: index,
    })),
  });

  return unique[0];
}

export async function loadCategoriesWithLinkedItems<
  TCategorySelect extends Prisma.MenuCategorySelect & { id: true },
  TItemSelect extends Prisma.MenuItemSelect,
>(options: {
  restaurantId: string;
  categorySelect: TCategorySelect;
  itemSelect: TItemSelect;
  categoryWhere?: Prisma.MenuCategoryWhereInput;
  itemOrderBy?: Prisma.MenuItemOrderByWithRelationInput;
}): Promise<
  Array<
    Prisma.MenuCategoryGetPayload<{ select: TCategorySelect }> & {
      items: Prisma.MenuItemGetPayload<{ select: TItemSelect }>[];
    }
  >
> {
  type MenuItem = Prisma.MenuItemGetPayload<{ select: TItemSelect }>;
  type Result = Prisma.MenuCategoryGetPayload<{ select: TCategorySelect }> & {
    items: MenuItem[];
  };

  const categories = await db.menuCategory.findMany({
    where: {
      restaurantId: options.restaurantId,
      ...options.categoryWhere,
    },
    orderBy: [
      { sortOrder: 'asc' as const },
      { name: 'asc' as const },
    ] as Prisma.Enumerable<Prisma.MenuCategoryOrderByWithRelationInput>,
    select: options.categorySelect,
  });

  const links = await db.menuItemCategory.findMany({
    where: { category: { restaurantId: options.restaurantId } },
    orderBy: [{ sortOrder: 'asc' }, { menuItem: { name: 'asc' } }],
    select: {
      categoryId: true,
      menuItemId: true,
      menuItem: { select: options.itemSelect },
    },
  });

  const itemsByCategory = new Map<string, MenuItem[]>();
  const itemIdsByCategory = new Map<string, Set<string>>();
  for (const link of links) {
    const item = link.menuItem;
    const list = itemsByCategory.get(link.categoryId) ?? [];
    const seen = itemIdsByCategory.get(link.categoryId) ?? new Set<string>();
    if (!seen.has(link.menuItemId)) {
      seen.add(link.menuItemId);
      list.push(item);
    }
    itemIdsByCategory.set(link.categoryId, seen);
    itemsByCategory.set(link.categoryId, list);
  }

  const categoryIds = categories.map((c) => (c as { id: string }).id);
  if (categoryIds.length > 0) {
    const legacyItems = await db.menuItem.findMany({
      where: {
        restaurantId: options.restaurantId,
        categoryId: { in: categoryIds },
      },
      orderBy: options.itemOrderBy ?? { name: 'asc' },
      select: {
        ...(options.itemSelect as object),
        categoryId: true,
      } as TItemSelect,
    });

    for (const row of legacyItems) {
      const item = row as MenuItem & { categoryId: string; id: string };
      const categoryId = item.categoryId;
      const list = itemsByCategory.get(categoryId) ?? [];
      const seen = itemIdsByCategory.get(categoryId) ?? new Set<string>();
      if (!seen.has(item.id)) {
        seen.add(item.id);
        list.push(item);
      }
      itemIdsByCategory.set(categoryId, seen);
      itemsByCategory.set(categoryId, list);
    }
  }

  return categories.map((category) => {
    const categoryId = (category as { id: string }).id;
    return {
      ...category,
      items: itemsByCategory.get(categoryId) ?? [],
    };
  }) as Result[];
}

export async function loadSingleCategoryWithLinkedItems<
  TCategorySelect extends Prisma.MenuCategorySelect & { id: true },
  TItemSelect extends Prisma.MenuItemSelect,
>(options: {
  restaurantId: string;
  categoryId: string;
  categorySelect: TCategorySelect;
  itemSelect: TItemSelect;
  categoryWhere?: Prisma.MenuCategoryWhereInput;
  itemOrderBy?: Prisma.MenuItemOrderByWithRelationInput;
  /** When set, only this page of items is loaded (full id list is still resolved). */
  pagination?: { skip: number; take: number };
}): Promise<
  | (Prisma.MenuCategoryGetPayload<{ select: TCategorySelect }> & {
      items: Prisma.MenuItemGetPayload<{ select: TItemSelect }>[];
      itemTotal: number;
      hasMore: boolean;
    })
  | null
> {
  type MenuItem = Prisma.MenuItemGetPayload<{ select: TItemSelect }>;

  const category = await db.menuCategory.findFirst({
    where: {
      id: options.categoryId,
      restaurantId: options.restaurantId,
      ...options.categoryWhere,
    },
    select: options.categorySelect,
  });
  if (!category) return null;

  // Resolve ordered item IDs first (cheap), then load full rows for the page.
  const links = await db.menuItemCategory.findMany({
    where: {
      categoryId: options.categoryId,
      category: { restaurantId: options.restaurantId },
    },
    orderBy: [{ sortOrder: 'asc' }, { menuItem: { name: 'asc' } }],
    select: { menuItemId: true },
  });

  const orderedIds: string[] = [];
  const seen = new Set<string>();
  for (const link of links) {
    if (seen.has(link.menuItemId)) continue;
    seen.add(link.menuItemId);
    orderedIds.push(link.menuItemId);
  }

  const legacyItems = await db.menuItem.findMany({
    where: {
      restaurantId: options.restaurantId,
      categoryId: options.categoryId,
    },
    orderBy: options.itemOrderBy ?? { name: 'asc' },
    select: { id: true },
  });
  for (const row of legacyItems) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    orderedIds.push(row.id);
  }

  const itemTotal = orderedIds.length;
  const skip = options.pagination?.skip ?? 0;
  const take = options.pagination?.take ?? orderedIds.length;
  const pageIds =
    options.pagination != null
      ? orderedIds.slice(skip, skip + take)
      : orderedIds;
  const hasMore =
    options.pagination != null ? skip + pageIds.length < itemTotal : false;

  if (pageIds.length === 0) {
    return {
      ...category,
      items: [],
      itemTotal,
      hasMore,
    } as Prisma.MenuCategoryGetPayload<{ select: TCategorySelect }> & {
      items: MenuItem[];
      itemTotal: number;
      hasMore: boolean;
    };
  }

  const loaded = await db.menuItem.findMany({
    where: { id: { in: pageIds } },
    select: options.itemSelect,
  });
  const byId = new Map(
    loaded.map((row) => [(row as MenuItem & { id: string }).id, row as MenuItem])
  );
  const items: MenuItem[] = [];
  for (const id of pageIds) {
    const item = byId.get(id);
    if (item) items.push(item);
  }

  return {
    ...category,
    items,
    itemTotal,
    hasMore,
  } as Prisma.MenuCategoryGetPayload<{ select: TCategorySelect }> & {
    items: MenuItem[];
    itemTotal: number;
    hasMore: boolean;
  };
}

export async function getMenuItemCategoryIds(
  menuItemId: string
): Promise<string[]> {
  const links = await db.menuItemCategory.findMany({
    where: { menuItemId },
    orderBy: { sortOrder: 'asc' },
    select: { categoryId: true },
  });
  return links.map((l) => l.categoryId);
}
