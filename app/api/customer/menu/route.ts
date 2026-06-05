import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { applyProductRecommendationPools } from '@/lib/menu/apply-product-recommendation-pools';
import {
  buildCustomerMenuAttributeGroupsSelect,
  customerMenuItemCoreSelect,
} from '@/lib/menu/customer-menu-attribute-groups-select';
import {
  CUSTOMER_MENU_CATEGORY_WHERE,
  sanitizeCustomerMenuPayload,
} from '@/lib/menu/category-visibility';

function getSubdomainFromHost(hostname: string) {
  if (hostname.endsWith('.localhost')) {
    const sub = hostname.replace('.localhost', '');
    if (sub && sub !== 'www') return sub;
    return null;
  }

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (rootDomain && hostname.endsWith(`.${rootDomain}`)) {
    const sub = hostname.slice(0, -(`.${rootDomain}`.length));
    if (sub && sub !== 'www') return sub;
  }

  return null;
}

const menuCategorySelect = {
  id: true,
  name: true,
  items: {
      orderBy: { name: 'asc' as const },
      select: {
        ...customerMenuItemCoreSelect,
        categoryId: true,
        attributeGroups: buildCustomerMenuAttributeGroupsSelect(2),
        offersFromThis: {
          orderBy: { sortOrder: 'asc' as const },
          select: {
            id: true,
            sortOrder: true,
            offeredItem: {
              select: {
                id: true,
                name: true,
                description: true,
                imageUrl: true,
                price: true,
                salePrice: true,
              },
            },
          },
        },
      },
    },
} as const;

const customerMenusRelation = {
  where: CUSTOMER_MENU_CATEGORY_WHERE,
  orderBy: { name: 'asc' as const },
  select: menuCategorySelect,
} as const;

const allCategoriesForRecommendations = {
  orderBy: { name: 'asc' as const },
  select: {
    id: true,
    name: true,
    items: {
      orderBy: { name: 'asc' as const },
      select: {
        ...customerMenuItemCoreSelect,
        attributeGroups: buildCustomerMenuAttributeGroupsSelect(2),
      },
    },
  },
} as const;

async function enrichRestaurantMenuForCustomer<
  T extends { id: string; menus: unknown },
>(restaurant: T) {
  const allCategories = await db.menuCategory.findMany({
    where: { restaurantId: restaurant.id, items: { some: {} } },
    ...allCategoriesForRecommendations,
  });
  return sanitizeCustomerMenuPayload(
    applyProductRecommendationPools(
      restaurant as Parameters<typeof applyProductRecommendationPools>[0],
      allCategories
    )
  );
}

export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get('slug')?.trim();
    const fromQuery = req.nextUrl.searchParams.get('subdomain');
    const host = (req.headers.get('host') || '').split(':')[0];
    const fromHost = getSubdomainFromHost(host);

    if (slug) {
      const restaurant = await db.restaurant.findUnique({
        where: { slug },
        select: {
          id: true,
          name: true,
          logoUrl: true,
          mainBannerUrl: true,
          themePrimaryColor: true,
          subdomain: true,
          slug: true,
          menus: customerMenusRelation,
        },
      });
      if (!restaurant) {
        return NextResponse.json({ data: null }, { status: 200 });
      }
      return NextResponse.json(
        { data: await enrichRestaurantMenuForCustomer(restaurant) },
        { status: 200 }
      );
    }

    const subdomain = fromQuery || fromHost;

    if (!subdomain) {
      return NextResponse.json(
        { error: 'Missing subdomain or slug.' },
        { status: 400 }
      );
    }

    const restaurant = await db.restaurant.findUnique({
      where: { subdomain },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        mainBannerUrl: true,
        themePrimaryColor: true,
        subdomain: true,
        slug: true,
        menus: customerMenusRelation,
      },
    });

    if (!restaurant) {
      return NextResponse.json({ data: null }, { status: 200 });
    }
    return NextResponse.json(
      { data: await enrichRestaurantMenuForCustomer(restaurant) },
      { status: 200 }
    );
  } catch (error) {
    console.error('customer menu', error);
    return NextResponse.json(
      { error: 'Failed to load menu.' },
      { status: 500 }
    );
  }
}
