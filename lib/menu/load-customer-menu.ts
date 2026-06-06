import { db } from '@/lib/db';
import { applyProductRecommendationPools } from '@/lib/menu/apply-product-recommendation-pools';
import {
  buildCustomerMenuAttributeGroupsSelect,
  buildCustomerMenuAttributeGroupsSelectLegacy,
  customerMenuItemCoreSelect,
  customerMenuItemCoreSelectLegacy,
  type CustomerMenuSelectMode,
} from '@/lib/menu/customer-menu-attribute-groups-select';
import {
  CUSTOMER_MENU_CATEGORY_WHERE,
  sanitizeCustomerMenuPayload,
} from '@/lib/menu/category-visibility';

export function isPrismaSchemaDriftError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: string }).code;
  return code === 'P2021' || code === 'P2022';
}

function buildMenuCategorySelect(mode: CustomerMenuSelectMode) {
  const itemCore =
    mode === 'full'
      ? customerMenuItemCoreSelect
      : customerMenuItemCoreSelectLegacy;
  const buildGroups =
    mode === 'full'
      ? buildCustomerMenuAttributeGroupsSelect
      : buildCustomerMenuAttributeGroupsSelectLegacy;

  return {
    id: true,
    name: true,
    items: {
      orderBy: { name: 'asc' as const },
      select: {
        ...itemCore,
        categoryId: true,
        attributeGroups: buildGroups(2),
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
}

function buildAllCategoriesForRecommendations(mode: CustomerMenuSelectMode) {
  const itemCore =
    mode === 'full'
      ? customerMenuItemCoreSelect
      : customerMenuItemCoreSelectLegacy;
  const buildGroups =
    mode === 'full'
      ? buildCustomerMenuAttributeGroupsSelect
      : buildCustomerMenuAttributeGroupsSelectLegacy;

  return {
    orderBy: { name: 'asc' as const },
    select: {
      id: true,
      name: true,
      items: {
        orderBy: { name: 'asc' as const },
        select: {
          ...itemCore,
          attributeGroups: buildGroups(2),
        },
      },
    },
  } as const;
}

const restaurantPublicSelect = {
  id: true,
  name: true,
  logoUrl: true,
  mainBannerUrl: true,
  themePrimaryColor: true,
  subdomain: true,
  slug: true,
} as const;

async function enrichRestaurantMenuForCustomer<
  T extends { id: string; menus: unknown },
>(restaurant: T, mode: CustomerMenuSelectMode) {
  const allCategories = await db.menuCategory.findMany({
    where: { restaurantId: restaurant.id, items: { some: {} } },
    ...buildAllCategoriesForRecommendations(mode),
  });
  return sanitizeCustomerMenuPayload(
    applyProductRecommendationPools(
      restaurant as Parameters<typeof applyProductRecommendationPools>[0],
      allCategories
    )
  );
}

async function loadBySlugWithMode(slug: string, mode: CustomerMenuSelectMode) {
  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: {
      ...restaurantPublicSelect,
      menus: {
        where: CUSTOMER_MENU_CATEGORY_WHERE,
        orderBy: { name: 'asc' as const },
        select: buildMenuCategorySelect(mode),
      },
    },
  });
  if (!restaurant) return null;
  return enrichRestaurantMenuForCustomer(restaurant, mode);
}

async function loadBySubdomainWithMode(
  subdomain: string,
  mode: CustomerMenuSelectMode
) {
  const restaurant = await db.restaurant.findUnique({
    where: { subdomain },
    select: {
      ...restaurantPublicSelect,
      menus: {
        where: CUSTOMER_MENU_CATEGORY_WHERE,
        orderBy: { name: 'asc' as const },
        select: buildMenuCategorySelect(mode),
      },
    },
  });
  if (!restaurant) return null;
  return enrichRestaurantMenuForCustomer(restaurant, mode);
}

/** Load customer menu; retries with legacy Prisma select when production DB lags migrations. */
export async function loadCustomerMenuRestaurant(options: {
  slug?: string | null;
  subdomain?: string | null;
}) {
  const modes: CustomerMenuSelectMode[] = ['full', 'legacy'];
  const slug = options.slug?.trim();
  const subdomain = options.subdomain?.trim();

  for (const mode of modes) {
    try {
      if (slug) {
        return await loadBySlugWithMode(slug, mode);
      }
      if (subdomain) {
        return await loadBySubdomainWithMode(subdomain, mode);
      }
      return null;
    } catch (error) {
      if (!isPrismaSchemaDriftError(error) || mode === 'legacy') {
        throw error;
      }
      console.warn(
        'customer menu: schema drift detected, retrying with legacy select',
        error
      );
    }
  }

  return null;
}
