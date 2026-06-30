import { db } from '@/lib/db';
import {
  parseRestaurantServiceCharges,
  RESTAURANT_SERVICE_CHARGE_DB_SELECT,
  type RestaurantServiceChargeRow,
} from '@/lib/restaurant-service-charge';
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
  RECOMMENDATION_SOURCE_CATEGORY_WHERE,
  sanitizeCustomerMenuPayload,
} from '@/lib/menu/category-visibility';
import { loadRestaurantMenuCategories } from '@/lib/menu/load-restaurant-menu-categories';
import { personalizeGroupsSelect } from '@/lib/menu/personalize-groups-select';

export function isPrismaSchemaDriftError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: string }).code;
  return code === 'P2021' || code === 'P2022';
}

function buildCustomerMenuItemSelect(mode: CustomerMenuSelectMode) {
  const itemCore =
    mode === 'full'
      ? customerMenuItemCoreSelect
      : customerMenuItemCoreSelectLegacy;
  const buildGroups =
    mode === 'full'
      ? buildCustomerMenuAttributeGroupsSelect
      : buildCustomerMenuAttributeGroupsSelectLegacy;

  return {
    ...itemCore,
    categoryId: true,
    attributeGroups: buildGroups(2),
    personalizeGroups: personalizeGroupsSelect,
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
}

function buildRecommendationPoolItemSelect(mode: CustomerMenuSelectMode) {
  const itemCore =
    mode === 'full'
      ? customerMenuItemCoreSelect
      : customerMenuItemCoreSelectLegacy;
  const buildGroups =
    mode === 'full'
      ? buildCustomerMenuAttributeGroupsSelect
      : buildCustomerMenuAttributeGroupsSelectLegacy;

  return {
    ...itemCore,
    attributeGroups: buildGroups(2),
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
  ...RESTAURANT_SERVICE_CHARGE_DB_SELECT,
} as const;

async function enrichRestaurantMenuForCustomer<
  T extends { id: string; menus: unknown } & RestaurantServiceChargeRow,
>(restaurant: T, mode: CustomerMenuSelectMode) {
  const allCategories = await loadRestaurantMenuCategories({
    restaurantId: restaurant.id,
    categorySelect: { id: true, name: true, sortOrder: true },
    itemSelect: buildRecommendationPoolItemSelect(mode),
    categoryWhere: RECOMMENDATION_SOURCE_CATEGORY_WHERE,
  });
  return {
    ...sanitizeCustomerMenuPayload(
      applyProductRecommendationPools(
        restaurant as Parameters<typeof applyProductRecommendationPools>[0],
        allCategories
      )
    ),
    serviceCharges: parseRestaurantServiceCharges(restaurant),
  };
}

async function loadBySlugWithMode(slug: string, mode: CustomerMenuSelectMode) {
  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: restaurantPublicSelect,
  });
  if (!restaurant) return null;

  const menus = await loadRestaurantMenuCategories({
    restaurantId: restaurant.id,
    categorySelect: { id: true, name: true, sortOrder: true, imageUrl: true },
    itemSelect: buildCustomerMenuItemSelect(mode),
    categoryWhere: CUSTOMER_MENU_CATEGORY_WHERE,
  });

  return enrichRestaurantMenuForCustomer({ ...restaurant, menus }, mode);
}

async function loadBySubdomainWithMode(
  subdomain: string,
  mode: CustomerMenuSelectMode
) {
  const restaurant = await db.restaurant.findUnique({
    where: { subdomain },
    select: restaurantPublicSelect,
  });
  if (!restaurant) return null;

  const menus = await loadRestaurantMenuCategories({
    restaurantId: restaurant.id,
    categorySelect: { id: true, name: true, sortOrder: true, imageUrl: true },
    itemSelect: buildCustomerMenuItemSelect(mode),
    categoryWhere: CUSTOMER_MENU_CATEGORY_WHERE,
  });

  return enrichRestaurantMenuForCustomer({ ...restaurant, menus }, mode);
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
