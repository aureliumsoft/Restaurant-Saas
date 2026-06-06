import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { applyProductRecommendationPools } from '@/lib/menu/apply-product-recommendation-pools';
import {
  buildCustomerMenuAttributeGroupsSelect,
  customerMenuItemCoreSelect,
} from '@/lib/menu/customer-menu-attribute-groups-select';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';

const menuItemSelect = {
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
} as const;

const allCategoriesForPoolsSelect = {
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

export async function GET(req: NextRequest) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKeys: ['product', 'pos'],
    action: 'access',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const restaurant = await db.restaurant.findUnique({
      where: { id: auth.restaurant.id },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        themePrimaryColor: true,
        menus: {
          orderBy: { name: 'asc' as const },
          select: {
            id: true,
            name: true,
            showInFront: true,
            items: {
              orderBy: { updatedAt: 'desc' as const },
              select: menuItemSelect,
            },
          },
        },
      },
    });

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    const allCategories = await db.menuCategory.findMany({
      where: { restaurantId: auth.restaurant.id, items: { some: {} } },
      ...allCategoriesForPoolsSelect,
    });

    const enriched = applyProductRecommendationPools(restaurant, allCategories);

    return NextResponse.json({ data: enriched }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load menu' }, { status: 500 });
  }
}
