import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import {
  buildPaginationMeta,
  clampPage,
  parsePaginationParams,
} from '@/lib/pagination';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';

const listItemSelect = {
  id: true,
  name: true,
  description: true,
  imageUrl: true,
  price: true,
  salePrice: true,
  categoryId: true,
  createdAt: true,
  updatedAt: true,
  variations: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true,
      name: true,
      title: true,
      imageUrl: true,
      swatchHex: true,
      priceDelta: true,
      sortOrder: true,
      restaurantVariationId: true,
    },
  },
} as const;

function parseCategoryIds(searchParams: URLSearchParams): string[] {
  const multi = searchParams.get('categoryIds')?.trim();
  if (multi) {
    return [
      ...new Set(
        multi
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      ),
    ];
  }
  const single = searchParams.get('categoryId')?.trim();
  return single ? [single] : [];
}

function searchWhere(search: string): Prisma.MenuItemWhereInput | undefined {
  if (!search) return undefined;
  return {
    OR: [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      {
        category: {
          name: { contains: search, mode: 'insensitive' },
        },
      },
      {
        categoryLinks: {
          some: {
            category: {
              name: { contains: search, mode: 'insensitive' },
            },
          },
        },
      },
    ],
  };
}

function categoryFilterWhere(
  categoryIds: string[]
): Prisma.MenuItemWhereInput | undefined {
  if (categoryIds.length === 0) return undefined;
  if (categoryIds.length === 1) {
    const categoryId = categoryIds[0]!;
    return {
      OR: [{ categoryId }, { categoryLinks: { some: { categoryId } } }],
    };
  }
  return {
    OR: [
      { categoryId: { in: categoryIds } },
      { categoryLinks: { some: { categoryId: { in: categoryIds } } } },
    ],
  };
}

export async function GET(req: NextRequest) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKeys: ['product', 'pos', 'recommendations'],
    action: 'access',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const restaurantId = auth.restaurant.id;
    const search = req.nextUrl.searchParams.get('search')?.trim() ?? '';
    const categoryIds = parseCategoryIds(req.nextUrl.searchParams);

    const { page, pageSize } = parsePaginationParams(req.nextUrl.searchParams, {
      defaultPageSize: 8,
      maxPageSize: 24,
    });

    const andFilters: Prisma.MenuItemWhereInput[] = [];
    const searchClause = searchWhere(search);
    if (searchClause) andFilters.push(searchClause);
    const categoryClause = categoryFilterWhere(categoryIds);
    if (categoryClause) andFilters.push(categoryClause);

    const combinedWhere: Prisma.MenuItemWhereInput = {
      restaurantId,
      ...(andFilters.length > 0 ? { AND: andFilters } : {}),
    };

    const [total, categories] = await Promise.all([
      db.menuItem.count({ where: combinedWhere }),
      db.menuCategory.findMany({
        where: { restaurantId },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true },
      }),
    ]);

    const safePage = clampPage(page, total, pageSize);
    const skip = (safePage - 1) * pageSize;

    const items = await db.menuItem.findMany({
      where: combinedWhere,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: pageSize,
      select: listItemSelect,
    });

    const itemIds = items.map((item) => item.id);
    const categoryLinks =
      itemIds.length === 0
        ? []
        : await db.menuItemCategory.findMany({
            where: { menuItemId: { in: itemIds } },
            orderBy: { sortOrder: 'asc' },
            select: { menuItemId: true, categoryId: true },
          });

    const categoryIdsByItem = new Map<string, string[]>();
    for (const link of categoryLinks) {
      const list = categoryIdsByItem.get(link.menuItemId) ?? [];
      list.push(link.categoryId);
      categoryIdsByItem.set(link.menuItemId, list);
    }
    const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

    const products = items.map((item) => {
      const ids = categoryIdsByItem.get(item.id) ?? [item.categoryId];
      const categoryNames = ids
        .map((id) => categoryNameById.get(id))
        .filter((name): name is string => Boolean(name));
      return {
        ...item,
        categoryIds: ids,
        categoryNames:
          categoryNames.length > 0
            ? categoryNames
            : [categoryNameById.get(item.categoryId) ?? '—'],
        categoryName:
          categoryNameById.get(item.categoryId) ??
          categoryNames[0] ??
          '—',
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        attributeGroups: [] as unknown[],
      };
    });

    const meta = buildPaginationMeta(safePage, pageSize, total);

    return NextResponse.json({
      data: {
        products,
        categories,
        pagination: meta,
      },
    });
  } catch (e) {
    console.error('menu products GET failed', e);
    return NextResponse.json(
      { error: 'Failed to load products' },
      { status: 500 }
    );
  }
}
