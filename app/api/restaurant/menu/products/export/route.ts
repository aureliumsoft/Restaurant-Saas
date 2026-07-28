import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import {
  buildProductsExcelBuffer,
  type ProductExportItem,
} from '@/lib/menu/export-products-excel';
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

const exportInclude = {
  category: { select: { id: true, name: true } },
  categoryLinks: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      category: { select: { id: true, name: true } },
    },
  },
  variations: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      restaurantVariation: {
        select: { id: true, name: true, shortLabel: true },
      },
    },
  },
  attributeGroups: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      linkedCategory: { select: { id: true, name: true } },
      linkedProduct: { select: { id: true, name: true } },
      defaultLinkedMenuItem: { select: { id: true, name: true } },
      defaultLinkedRestaurantVariation: {
        select: { id: true, name: true, shortLabel: true },
      },
      variationLimits: {
        include: {
          variation: { select: { id: true, name: true, title: true } },
        },
      },
    },
  },
  offersFromThis: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      offeredItem: { select: { id: true, name: true } },
    },
  },
  personalizeGroups: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      options: { orderBy: { sortOrder: 'asc' as const } },
    },
  },
} satisfies Prisma.MenuItemInclude;

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
    const products = (await db.menuItem.findMany({
      where: { AND: andParts },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      include: exportInclude,
    })) as unknown as ProductExportItem[];

    const buffer = await buildProductsExcelBuffer(products);
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `products-export-${stamp}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('Products Excel export failed:', e);
    return NextResponse.json(
      { error: 'Could not export products to Excel.' },
      { status: 500 }
    );
  }
}
