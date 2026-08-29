import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import {
  buildPaginationMeta,
  clampPage,
  parsePaginationParams,
} from '@/lib/pagination';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';
import { encodeUrlId } from '@/lib/url-id';
import { menuItemApiPath } from '@/lib/dashboard-paths';

/** Lazy image URL — browser loads photo after list JSON (does not bloat list payload). */
function lazyProductImageUrl(itemId: string): string {
  return `${menuItemApiPath(itemId)}/image`;
}

const listItemSelect = {
  id: true,
  name: true,
  description: true,
  // Do NOT select imageUrl here — base64 blobs would slow DB→API→client for every page.
  price: true,
  salePrice: true,
  categoryId: true,
  createdAt: true,
  updatedAt: true,
  // Only fields needed for list pricing + variation count (no variation images).
  variations: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true,
      name: true,
      title: true,
      priceDelta: true,
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

function truncateDescription(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 160) return trimmed;
  return `${trimmed.slice(0, 157)}…`;
}

export async function GET(req: NextRequest) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKeys: ['product', 'pos', 'recommendations', 'inventory'],
    action: 'access',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const restaurantId = auth.restaurant.id;
    const search = req.nextUrl.searchParams.get('search')?.trim() ?? '';
    const categoryIds = parseCategoryIds(req.nextUrl.searchParams);
    const includeCategories =
      req.nextUrl.searchParams.get('includeCategories') !== '0';

    const { page, pageSize } = parsePaginationParams(req.nextUrl.searchParams, {
      defaultPageSize: 12,
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

    // Count first so we can clamp page, then fetch page rows + categories in parallel.
    const total = await db.menuItem.count({ where: combinedWhere });
    const safePage = clampPage(page, total, pageSize);
    const skip = (safePage - 1) * pageSize;

    const [categories, items] = await Promise.all([
      includeCategories
        ? db.menuCategory.findMany({
            where: { restaurantId },
            orderBy: { sortOrder: 'asc' },
            select: { id: true, name: true },
          })
        : Promise.resolve(
            [] as Array<{ id: string; name: string }>
          ),
      total === 0
        ? Promise.resolve([])
        : db.menuItem.findMany({
            where: combinedWhere,
            orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
            skip,
            take: pageSize,
            select: listItemSelect,
          }),
    ]);

    const itemIds = items.map((item) => item.id);

    const [categoryLinks, imageFlags] = await Promise.all([
      itemIds.length === 0
        ? Promise.resolve(
            [] as Array<{ menuItemId: string; categoryId: string }>
          )
        : db.menuItemCategory.findMany({
            where: { menuItemId: { in: itemIds } },
            orderBy: { sortOrder: 'asc' },
            select: { menuItemId: true, categoryId: true },
          }),
      // Presence only — avoids transferring base64 blobs into the list response.
      itemIds.length === 0
        ? Promise.resolve([] as Array<{ id: string; hasImage: boolean }>)
        : db.$queryRaw<Array<{ id: string; hasImage: boolean }>>`
            SELECT id, ("imageUrl" IS NOT NULL) AS "hasImage"
            FROM "MenuItem"
            WHERE id IN (${Prisma.join(itemIds)})
          `,
    ]);

    const hasImageById = new Map(
      imageFlags.map((row) => [row.id, Boolean(row.hasImage)])
    );

    const categoryIdsByItem = new Map<string, string[]>();
    for (const link of categoryLinks) {
      const list = categoryIdsByItem.get(link.menuItemId) ?? [];
      list.push(link.categoryId);
      categoryIdsByItem.set(link.menuItemId, list);
    }

    // Prefer names from this response; fall back to primary category relation via map.
    let categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
    if (!includeCategories || categories.length === 0) {
      const neededIds = [
        ...new Set(
          items.flatMap((item) => {
            const linked = categoryIdsByItem.get(item.id) ?? [];
            return linked.length > 0 ? linked : [item.categoryId];
          })
        ),
      ];
      if (neededIds.length > 0) {
        const named = await db.menuCategory.findMany({
          where: { restaurantId, id: { in: neededIds } },
          select: { id: true, name: true },
        });
        categoryNameById = new Map(named.map((c) => [c.id, c.name]));
      }
    }

    const products = items.map((item) => {
      const ids = categoryIdsByItem.get(item.id) ?? [item.categoryId];
      const categoryNames = ids
        .map((id) => categoryNameById.get(id))
        .filter((name): name is string => Boolean(name));
      const hasImage = hasImageById.get(item.id) === true;
      return {
        id: item.id,
        urlId: encodeUrlId(item.id),
        name: item.name,
        description: truncateDescription(item.description),
        // Browser lazy-loads each photo via this endpoint after list JSON arrives.
        imageUrl: hasImage ? lazyProductImageUrl(item.id) : null,
        hasImage,
        price: item.price,
        salePrice: item.salePrice,
        categoryId: item.categoryId,
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
        variations: item.variations,
        attributeGroups: [] as unknown[],
      };
    });

    const meta = buildPaginationMeta(safePage, pageSize, total);

    return NextResponse.json({
      data: {
        products,
        categories: includeCategories ? categories : undefined,
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
