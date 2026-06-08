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
    orderBy: { name: 'asc' },
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

  return categories.map((category) => {
    const categoryId = (category as { id: string }).id;
    return {
      ...category,
      items: itemsByCategory.get(categoryId) ?? [],
    };
  }) as Result[];
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
