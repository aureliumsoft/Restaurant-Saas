import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import {
  buildProductsCsv,
  type ProductCsvExportItem,
} from '@/lib/menu/export-products-csv';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';

export const runtime = 'nodejs';

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

/** Product values only — no images, no binary fields. */
const exportSelect = {
  name: true,
  description: true,
  price: true,
  salePrice: true,
  category: { select: { name: true } },
  categoryLinks: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      sortOrder: true,
      category: { select: { name: true } },
    },
  },
  variations: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      name: true,
      title: true,
      priceDelta: true,
      sortOrder: true,
      swatchHex: true,
      restaurantVariation: {
        select: { name: true, shortLabel: true },
      },
    },
  },
  attributeGroups: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      name: true,
      sortOrder: true,
      selectionType: true,
      required: true,
      sourceType: true,
      multipleMode: true,
      freeQuantity: true,
      minItems: true,
      maxItems: true,
      categoryDiscountPercent: true,
      categoryExtraCostPercent: true,
      includeDefaultLinkedVariationPrice: true,
      useVariationPricing: true,
      productCategoryIds: true,
      linkedCategory: { select: { name: true } },
      linkedProduct: { select: { name: true } },
      defaultLinkedMenuItem: { select: { name: true } },
      defaultLinkedRestaurantVariation: {
        select: { name: true, shortLabel: true },
      },
      variationLimits: {
        select: {
          minItems: true,
          maxItems: true,
          variation: { select: { name: true, title: true } },
        },
      },
    },
  },
  offersFromThis: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      sortOrder: true,
      offeredItem: { select: { name: true } },
    },
  },
  personalizeGroups: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      parentName: true,
      maxItems: true,
      sortOrder: true,
      options: {
        orderBy: { sortOrder: 'asc' as const },
        select: {
          name: true,
          sortOrder: true,
        },
      },
    },
  },
} satisfies Prisma.MenuItemSelect;

export async function GET(req: NextRequest) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKeys: ['product', 'pos', 'recommendations'],
    action: 'access',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const search = req.nextUrl.searchParams.get('search')?.trim() || '';
  const categoryIds = parseCategoryIds(req.nextUrl.searchParams);

  const andParts: Prisma.MenuItemWhereInput[] = [
    { restaurantId: auth.restaurant.id },
  ];
  const searchPart = searchWhere(search);
  if (searchPart) andParts.push(searchPart);
  const categoryPart = categoryFilterWhere(categoryIds);
  if (categoryPart) andParts.push(categoryPart);

  try {
    const products = await db.menuItem.findMany({
      where: { AND: andParts },
      orderBy: [{ name: 'asc' }],
      select: exportSelect,
    });

    const categoryIdSet = new Set<string>();
    for (const p of products) {
      for (const g of p.attributeGroups) {
        for (const id of g.productCategoryIds ?? []) {
          if (id) categoryIdSet.add(id);
        }
      }
    }
    const categoryNameById = new Map<string, string>();
    if (categoryIdSet.size > 0) {
      const cats = await db.menuCategory.findMany({
        where: {
          restaurantId: auth.restaurant.id,
          id: { in: [...categoryIdSet] },
        },
        select: { id: true, name: true },
      });
      for (const c of cats) {
        categoryNameById.set(c.id, c.name);
      }
    }

    const exportRows: ProductCsvExportItem[] = products.map((p) => ({
      ...p,
      ingredientRecipes: [],
      attributeGroups: p.attributeGroups.map((g) => ({
        ...g,
        productCategoryNames: (g.productCategoryIds ?? [])
          .map((id) => categoryNameById.get(id))
          .filter((n): n is string => Boolean(n && n.trim())),
      })),
    }));

    const csv = buildProductsCsv(exportRows);
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `products-export-${stamp}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('Products CSV export failed:', e);
    return NextResponse.json(
      { error: 'Could not export products to CSV.' },
      { status: 500 }
    );
  }
}
