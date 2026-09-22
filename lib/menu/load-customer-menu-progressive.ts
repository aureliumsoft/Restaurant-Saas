import { db } from '@/lib/db';
import {
  buildCustomerProductDetailAttributeGroupsSelect,
  customerProductDetailGroupSelect,
  customerProductDetailOptionCardSelect,
  type CustomerMenuSelectMode,
} from '@/lib/menu/customer-menu-attribute-groups-select';
import {
  CUSTOMER_MENU_CATEGORY_WHERE,
  categoryHasProducts,
  categoryVisibleForBranch,
} from '@/lib/menu/category-visibility';
import {
  isPrismaSchemaDriftError,
} from '@/lib/menu/load-customer-menu';
import { loadSingleCategoryWithLinkedItems } from '@/lib/menu/menu-item-categories';
import {
  menuItemBrowseListSelect,
  menuItemBrowseListSelectLegacy,
} from '@/lib/menu/menu-item-list-select';
import {
  MENU_ITEM_CATEGORY_LINK_DATE_ORDER,
  MENU_ITEM_DATE_ORDER,
} from '@/lib/menu/product-order';
import {
  type AttributeGroupSource,
} from '@/lib/menu/map-attribute-group-items';
import {
  customerMenuItemImageUrl,
  imageMetaByMenuItemIds,
  mapBrowseListItem,
  stampBrowseVariationImages,
} from '@/lib/menu/menu-item-image-utils';
import { customerCategoryImageUrl, publicRestaurantImageUrls } from '@/lib/stored-image-response';
import {
  parseRestaurantServiceCharges,
  RESTAURANT_SERVICE_CHARGE_DB_SELECT,
  type RestaurantServiceChargeRow,
} from '@/lib/restaurant-service-charge';
import { personalizeGroupsSelectLite } from '@/lib/menu/personalize-groups-select';
import {
  isPrismaFulfillmentSettingsFieldError,
  parseRestaurantFulfillmentSettings,
  RESTAURANT_FULFILLMENT_SETTINGS_DB_SELECT,
  RESTAURANT_FULFILLMENT_SETTINGS_DB_SELECT_PRE_CHANNEL,
} from '@/lib/restaurant-fulfillment-settings';

const restaurantPublicSelectCore = {
  id: true,
  name: true,
  logoUrl: true,
  mainBannerUrl: true,
  themePrimaryColor: true,
  subdomain: true,
  slug: true,
  updatedAt: true,
  ...RESTAURANT_SERVICE_CHARGE_DB_SELECT,
} as const;

const restaurantPublicSelectBase = {
  ...restaurantPublicSelectCore,
  ...RESTAURANT_FULFILLMENT_SETTINGS_DB_SELECT_PRE_CHANNEL,
} as const;

const restaurantPublicSelect = {
  ...restaurantPublicSelectBase,
  ...RESTAURANT_FULFILLMENT_SETTINGS_DB_SELECT,
} as const;

function buildCustomerProductDetailItemSelect(mode: CustomerMenuSelectMode) {
  return {
            id: true,
            name: true,
            description: true,
            price: true,
            salePrice: true,
    updatedAt: true,
    categoryId: true,
    variations: customerProductDetailOptionCardSelect(mode).variations,
    attributeGroups: buildCustomerProductDetailAttributeGroupsSelect(mode),
    personalizeGroups: personalizeGroupsSelectLite,
  } as const;
}

async function findRestaurantPublic(
  where: { slug: string } | { subdomain: string }
) {
  try {
    return await db.restaurant.findUnique({
      where,
      select: restaurantPublicSelect,
    });
  } catch (error) {
    if (!isPrismaFulfillmentSettingsFieldError(error)) throw error;
    try {
      return await db.restaurant.findUnique({
        where,
        select: restaurantPublicSelectBase,
      });
    } catch (baseError) {
      if (!isPrismaFulfillmentSettingsFieldError(baseError)) throw baseError;
      return db.restaurant.findUnique({
        where,
        select: restaurantPublicSelectCore,
      });
    }
  }
}

async function resolveRestaurant(
  slug?: string | null,
  subdomain?: string | null
) {
  const s = slug?.trim();
  if (s) return findRestaurantPublic({ slug: s });
  const sub = subdomain?.trim();
  if (sub) return findRestaurantPublic({ subdomain: sub });
  return null;
}

async function resolveRestaurantId(
  slug?: string | null,
  subdomain?: string | null
): Promise<string | null> {
  const s = slug?.trim();
  if (s) {
    const row = await db.restaurant.findUnique({
      where: { slug: s },
      select: { id: true },
    });
    return row?.id ?? null;
  }
  const sub = subdomain?.trim();
  if (!sub) return null;
  const row = await db.restaurant.findUnique({
      where: { subdomain: sub },
    select: { id: true },
    });
  return row?.id ?? null;
}

async function withMenuSelectMode<T>(
  fn: (mode: CustomerMenuSelectMode) => Promise<T>
): Promise<T> {
  const modes: CustomerMenuSelectMode[] = ['full', 'legacy'];
  for (const mode of modes) {
    try {
      return await fn(mode);
    } catch (error) {
      if (!isPrismaSchemaDriftError(error) || mode === 'legacy') {
        throw error;
      }
      console.warn(
        'customer menu progressive: schema drift, retrying legacy select',
        error
      );
    }
  }
  throw new Error('Failed to load customer menu');
}

type BrowseDealLink = {
  dealItem?: {
    id: string;
    imageUrl?: string | null;
    hasImage?: boolean;
  };
};

function dealsFromBrowseItem(item: object): BrowseDealLink[] {
  const deals = (item as { dealsFromThis?: BrowseDealLink[] }).dealsFromThis;
  return Array.isArray(deals) ? deals : [];
}

function restaurantMetaPayload<
  T extends { id: string; slug: string; updatedAt?: Date | string | number | null } & RestaurantServiceChargeRow & {
    logoUrl?: string | null;
    mainBannerUrl?: string | null;
    deliveryEnabled?: boolean;
    dineInEnabled?: boolean;
    cardPaymentsEnabled?: boolean;
  },
>(restaurant: T) {
  return {
    ...restaurant,
    ...publicRestaurantImageUrls(restaurant.slug, restaurant),
    serviceCharges: parseRestaurantServiceCharges(restaurant),
    fulfillmentSettings: parseRestaurantFulfillmentSettings(restaurant),
  };
}

/** Restaurant branding + category list (no items). */
export async function loadCustomerMenuCategoriesMeta(options: {
  slug?: string | null;
  subdomain?: string | null;
  branchId: string;
}) {
  return withMenuSelectMode(async () => {
    const restaurant = await resolveRestaurant(options.slug, options.subdomain);
    if (!restaurant) return null;
    const branch = await db.branch.findFirst({
      where: { id: options.branchId, restaurantId: restaurant.id },
      select: { id: true },
    });
    if (!branch) return null;

    // Category WHERE already requires products — skip joining every item id.
    const categories = await db.menuCategory.findMany({
      where: {
        restaurantId: restaurant.id,
        ...CUSTOMER_MENU_CATEGORY_WHERE,
        ...categoryVisibleForBranch(options.branchId),
      },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, sortOrder: true, imageUrl: true, updatedAt: true },
    });

    const menus = categories.map((c) => ({
      id: c.id,
      name: c.name,
      imageUrl: c.imageUrl
        ? customerCategoryImageUrl(c.id, {
            slug: options.slug,
            subdomain: options.subdomain,
            updatedAt: c.updatedAt,
          })
        : null,
      items: [],
    }));

    return {
      ...restaurantMetaPayload(restaurant),
      menus,
    };
  });
}

/** Items for a single storefront category (fast browse list — no recommendation pool). */
export async function loadCustomerMenuCategoryItems(options: {
  slug?: string | null;
  subdomain?: string | null;
  categoryId: string;
  branchId: string;
  page?: number;
  limit?: number;
}) {
  return withMenuSelectMode(async (mode) => {
    const restaurant = await resolveRestaurant(options.slug, options.subdomain);
    if (!restaurant) return null;
    const branch = await db.branch.findFirst({
      where: { id: options.branchId, restaurantId: restaurant.id },
      select: { id: true },
    });
    if (!branch) return null;

    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(48, Math.max(1, options.limit ?? 24));
    const skip = (page - 1) * limit;

    const category = await loadSingleCategoryWithLinkedItems({
      restaurantId: restaurant.id,
      categoryId: options.categoryId,
      categorySelect: {
        id: true,
        name: true,
        sortOrder: true,
        imageUrl: true,
      },
      itemSelect:
        mode === 'full'
          ? menuItemBrowseListSelect
          : menuItemBrowseListSelectLegacy,
      categoryWhere: {
        ...CUSTOMER_MENU_CATEGORY_WHERE,
        ...categoryVisibleForBranch(options.branchId),
      },
      pagination: { skip, take: limit },
    });
    if (!category) return null;

    const itemIds = category.items.map((item) => item.id);
    const dealItemIds = category.items.flatMap((item) =>
      dealsFromBrowseItem(item)
        .map((d) => d.dealItem?.id)
        .filter((id): id is string => Boolean(id))
    );
    const allItemIds = Array.from(new Set([...itemIds, ...dealItemIds]));
    const imageMeta = await imageMetaByMenuItemIds(allItemIds);
    const imageQuery = {
      slug: options.slug,
      subdomain: options.subdomain,
    };

    const items = await stampBrowseVariationImages(
      category.items.map((item) => {
        const meta = imageMeta.get(item.id);
        const hasImage = meta?.hasImage ?? false;
        const mapped = mapBrowseListItem(
          item,
          hasImage,
          hasImage
            ? customerMenuItemImageUrl(item.id, {
                ...imageQuery,
                updatedAt: meta?.updatedAt,
              })
            : null
        );
        const deals = dealsFromBrowseItem(mapped);
        if (deals.length > 0) {
          (mapped as unknown as { dealsFromThis: BrowseDealLink[] }).dealsFromThis =
            deals.map((deal) => {
            const did = deal.dealItem?.id;
            if (!did || !deal.dealItem) return deal;
            const dealMeta = imageMeta.get(did);
            const hasDealImg = dealMeta?.hasImage ?? false;
            return {
              ...deal,
              dealItem: {
                ...deal.dealItem,
                hasImage: hasDealImg,
                imageUrl: hasDealImg
                  ? customerMenuItemImageUrl(did, {
                      ...imageQuery,
                      updatedAt: dealMeta?.updatedAt,
                    })
                  : null,
              },
            };
          });
        }
        return mapped;
      }),
      imageQuery
    );

    return {
      categoryId: category.id,
      items,
      page,
      limit,
      total: category.itemTotal,
      hasMore: category.hasMore,
    };
  });
}

const PRODUCT_DETAIL_OPTION_TAKE = 40;
const PRODUCT_DETAIL_CACHE_TTL_MS = 60_000;

type CachedProductDetail = {
  expiresAt: number;
  data: unknown;
};

const productDetailCache = new Map<string, CachedProductDetail>();

function productDetailCacheKey(options: {
  slug?: string | null;
  subdomain?: string | null;
  itemId: string;
}) {
  return `${options.slug?.trim() ?? ''}|${options.subdomain?.trim() ?? ''}|${options.itemId}`;
}

type DetailGroup = AttributeGroupSource & {
  name?: string | null;
  menuItemId?: string;
  linkedCategoryId?: string | null;
  linkedProductId?: string | null;
  linkedProduct?: (AttributeGroupSource['linkedProduct'] & {
    attributeGroups?: DetailGroup[] | null;
  }) | null;
};

function collectLinkedCategoryIdsFromGroups(
  groups: DetailGroup[] | null | undefined
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const visit = (list: DetailGroup[] | null | undefined) => {
    for (const group of list ?? []) {
      const categoryId =
        group.linkedCategoryId || group.linkedCategory?.id || '';
      if (categoryId && !seen.has(categoryId)) {
        seen.add(categoryId);
        ids.push(categoryId);
      }
      visit(group.linkedProduct?.attributeGroups ?? undefined);
    }
  };
  visit(groups);
  return ids;
}

function collectLinkedProductIdsFromGroups(
  groups: DetailGroup[] | null | undefined
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const visit = (list: DetailGroup[] | null | undefined) => {
    for (const group of list ?? []) {
      const productId = group.linkedProductId || group.linkedProduct?.id || '';
      if (productId && !seen.has(productId)) {
        seen.add(productId);
        ids.push(productId);
      }
      visit(group.linkedProduct?.attributeGroups ?? undefined);
    }
  };
  visit(groups);
  return ids;
}

function pushUniqueItem(
  itemsByCategory: Map<string, Array<Record<string, unknown>>>,
  seenByCategory: Map<string, Set<string>>,
  categoryId: string,
  itemId: string,
  item: Record<string, unknown>
) {
  const seen = seenByCategory.get(categoryId) ?? new Set<string>();
  if (seen.has(itemId)) return;
  seen.add(itemId);
  seenByCategory.set(categoryId, seen);
  const items = itemsByCategory.get(categoryId) ?? [];
  if (items.length >= PRODUCT_DETAIL_OPTION_TAKE) return;
  items.push(item);
  itemsByCategory.set(categoryId, items);
}

async function loadOptionCardsByCategoryIds(
  restaurantId: string,
  categoryIds: string[],
  mode: CustomerMenuSelectMode
) {
  const itemsByCategory = new Map<string, Array<Record<string, unknown>>>();
  if (categoryIds.length === 0) return itemsByCategory;

  const optionSelect = customerProductDetailOptionCardSelect(mode);
  const seenByCategory = new Map<string, Set<string>>();

  const [links, legacyItems] = await Promise.all([
    db.menuItemCategory.findMany({
      where: {
        categoryId: { in: categoryIds },
        menuItem: { restaurantId },
      },
      orderBy: [...MENU_ITEM_CATEGORY_LINK_DATE_ORDER],
      select: {
        categoryId: true,
        menuItemId: true,
        menuItem: { select: optionSelect },
      },
    }),
    db.menuItem.findMany({
      where: {
        restaurantId,
        categoryId: { in: categoryIds },
      },
      orderBy: [...MENU_ITEM_DATE_ORDER],
      select: {
        ...optionSelect,
        categoryId: true,
      },
    }),
  ]);

  for (const link of links) {
    pushUniqueItem(
      itemsByCategory,
      seenByCategory,
      link.categoryId,
      link.menuItemId,
      link.menuItem as Record<string, unknown>
    );
  }
  for (const item of legacyItems) {
    pushUniqueItem(
      itemsByCategory,
      seenByCategory,
      item.categoryId,
      item.id,
      item as Record<string, unknown>
    );
  }
  return itemsByCategory;
}

async function loadAttributeGroupsByMenuItemIds(
  menuItemIds: string[],
  mode: CustomerMenuSelectMode
) {
  const groupsByProductId = new Map<string, DetailGroup[]>();
  if (menuItemIds.length === 0) return groupsByProductId;

  const rows = await db.menuItemAttributeGroup.findMany({
    where: { menuItemId: { in: menuItemIds } },
    orderBy: { sortOrder: 'asc' },
    select: {
      menuItemId: true,
      ...customerProductDetailGroupSelect(mode),
    },
  });

  for (const row of rows) {
    const { menuItemId, ...group } = row as DetailGroup & { menuItemId: string };
    const list = groupsByProductId.get(menuItemId) ?? [];
    list.push(group);
    groupsByProductId.set(menuItemId, list);
  }
  return groupsByProductId;
}

function attachNestedProductGroups(
  groups: DetailGroup[] | null | undefined,
  groupsByProductId: Map<string, DetailGroup[]>,
  depth = 0
): DetailGroup[] {
  if (depth > 1) return groups ?? [];
  return (groups ?? []).map((group) => {
    const productId = group.linkedProduct?.id;
    if (!productId || !group.linkedProduct) return group;
    const nested = groupsByProductId.get(productId) ?? [];
    return {
      ...group,
      linkedProduct: {
        ...group.linkedProduct,
        attributeGroups: attachNestedProductGroups(
          nested,
          groupsByProductId,
          depth + 1
        ),
      },
    };
  });
}

function collectCategoryOptionItemIds(
  groups: DetailGroup[] | null | undefined
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const visit = (list: DetailGroup[] | null | undefined) => {
    for (const group of list ?? []) {
      for (const item of group.linkedCategory?.items ?? []) {
        if (item?.id && !seen.has(item.id)) {
          seen.add(item.id);
          ids.push(item.id);
        }
      }
      visit(group.linkedProduct?.attributeGroups ?? undefined);
    }
  };
  visit(groups);
  return ids;
}

function attachNestedGroupsToCategoryItems(
  groups: DetailGroup[] | null | undefined,
  groupsByItemId: Map<string, DetailGroup[]>,
  itemsByCategory: Map<string, Array<Record<string, unknown>>>
): DetailGroup[] {
  return (groups ?? []).map((group) => {
    const linkedCategory = group.linkedCategory
      ? {
          ...group.linkedCategory,
          items: (group.linkedCategory.items ?? []).map((item) => {
            const nested = groupsByItemId.get(item.id) ?? [];
            if (nested.length === 0) return item;
            return {
              ...item,
              attributeGroups: attachCategoryItemsToGroups(
                nested,
                itemsByCategory
              ),
            };
          }),
        }
      : group.linkedCategory;
    const linkedProduct = group.linkedProduct
      ? {
          ...group.linkedProduct,
          attributeGroups: attachNestedGroupsToCategoryItems(
            group.linkedProduct.attributeGroups ?? [],
            groupsByItemId,
            itemsByCategory
          ),
        }
      : group.linkedProduct;
    return { ...group, linkedCategory, linkedProduct };
  });
}

function attachCategoryItemsToGroups(
  groups: DetailGroup[] | null | undefined,
  itemsByCategory: Map<string, Array<Record<string, unknown>>>
): DetailGroup[] {
  return (groups ?? []).map((group) => {
    const categoryId = group.linkedCategoryId || group.linkedCategory?.id || '';
    const items = categoryId ? itemsByCategory.get(categoryId) ?? [] : [];
    const linkedProduct = group.linkedProduct
      ? {
          ...group.linkedProduct,
          attributeGroups: attachCategoryItemsToGroups(
            group.linkedProduct.attributeGroups ?? [],
            itemsByCategory
          ),
        }
      : group.linkedProduct;
    const linkedCategory = categoryId
      ? {
          ...(group.linkedCategory ?? {}),
          id: group.linkedCategory?.id ?? categoryId,
          name: group.linkedCategory?.name ?? group.name ?? '',
          items: items as NonNullable<
            AttributeGroupSource['linkedCategory']
          >['items'],
        }
      : group.linkedCategory;
    return {
      ...group,
      linkedProduct,
      linkedCategory,
    };
  });
}

async function loadCustomerMenuProductDetailUncached(options: {
  slug?: string | null;
  subdomain?: string | null;
  itemId: string;
}) {
  return withMenuSelectMode(async (mode) => {
    const restaurantId = await resolveRestaurantId(
      options.slug,
      options.subdomain
    );
    if (!restaurantId) return null;

    const item = await db.menuItem.findFirst({
      where: {
        id: options.itemId,
        restaurantId,
      },
      select: buildCustomerProductDetailItemSelect(mode),
    });
    if (!item) return null;

    const rawGroups = (item as { attributeGroups?: DetailGroup[] })
      .attributeGroups;
    const parentProductIds = collectLinkedProductIdsFromGroups(rawGroups);
    const parentCategoryIds = collectLinkedCategoryIdsFromGroups(rawGroups);

    const [nestedByProduct, parentItemsByCategory] = await Promise.all([
      loadAttributeGroupsByMenuItemIds(parentProductIds, mode),
      loadOptionCardsByCategoryIds(restaurantId, parentCategoryIds, mode),
    ]);

    const deeperProductIds = collectLinkedProductIdsFromGroups(
      [...nestedByProduct.values()].flat()
    ).filter((id) => !parentProductIds.includes(id));
    if (deeperProductIds.length > 0) {
      const deeper = await loadAttributeGroupsByMenuItemIds(
        deeperProductIds,
        mode
      );
      for (const [id, groups] of deeper) {
        nestedByProduct.set(id, groups);
      }
    }

    const groupsWithNested = attachNestedProductGroups(
      rawGroups,
      nestedByProduct
    );
    const allCategoryIds = collectLinkedCategoryIdsFromGroups(groupsWithNested);
    const extraCategoryIds = allCategoryIds.filter(
      (id) => !parentCategoryIds.includes(id)
    );
    const extraItemsByCategory =
      extraCategoryIds.length > 0
        ? await loadOptionCardsByCategoryIds(
            restaurantId,
            extraCategoryIds,
            mode
          )
        : new Map<string, Array<Record<string, unknown>>>();

    const itemsByCategory = new Map(parentItemsByCategory);
    for (const [categoryId, items] of extraItemsByCategory) {
      itemsByCategory.set(categoryId, items);
    }

    let hydratedGroups = attachCategoryItemsToGroups(
      groupsWithNested,
      itemsByCategory
    ).filter((group) => {
      if (group.sourceType === 'PRODUCT') return group.linkedProduct != null;
      return categoryHasProducts(group.linkedCategory ?? undefined);
    });

    const optionItemIds = collectCategoryOptionItemIds(hydratedGroups);
    if (optionItemIds.length > 0) {
      const optionNestedGroups = await loadAttributeGroupsByMenuItemIds(
        optionItemIds,
        mode
      );
      const nestedGroupList = [...optionNestedGroups.values()].flat();
      const nestedCategoryIds = collectLinkedCategoryIdsFromGroups(
        nestedGroupList
      ).filter((id) => !itemsByCategory.has(id));
      const nestedProductIds = collectLinkedProductIdsFromGroups(
        nestedGroupList
      ).filter((id) => !nestedByProduct.has(id));

      const [nestedItemsByCategory, nestedProductGroups] = await Promise.all([
        nestedCategoryIds.length > 0
          ? loadOptionCardsByCategoryIds(
              restaurantId,
              nestedCategoryIds,
              mode
            )
          : Promise.resolve(
              new Map<string, Array<Record<string, unknown>>>()
            ),
        nestedProductIds.length > 0
          ? loadAttributeGroupsByMenuItemIds(nestedProductIds, mode)
          : Promise.resolve(new Map<string, DetailGroup[]>()),
      ]);

      for (const [categoryId, items] of nestedItemsByCategory) {
        itemsByCategory.set(categoryId, items);
      }
      for (const [id, groups] of nestedProductGroups) {
        nestedByProduct.set(id, groups);
      }

      const optionNestedWithProducts = new Map<string, DetailGroup[]>();
      for (const [itemId, groups] of optionNestedGroups) {
        optionNestedWithProducts.set(
          itemId,
          attachNestedProductGroups(groups, nestedByProduct)
        );
      }

      hydratedGroups = attachNestedGroupsToCategoryItems(
        hydratedGroups,
        optionNestedWithProducts,
        itemsByCategory
      );
    }

    const imageUrl = customerMenuItemImageUrl(item.id, {
      slug: options.slug,
      subdomain: options.subdomain,
      updatedAt: item.updatedAt,
    });

    return {
      ...item,
      hasImage: true,
      imageUrl,
      attributeGroups: hydratedGroups,
      categoryIds: [item.categoryId],
    };
  });
}

/** Customize sheet: slim group metadata, then one batched option-card query. */
export async function loadCustomerMenuProductDetail(options: {
  slug?: string | null;
  subdomain?: string | null;
  itemId: string;
}) {
  const key = productDetailCacheKey(options);
  const cached = productDetailCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as Awaited<
      ReturnType<typeof loadCustomerMenuProductDetailUncached>
    >;
  }

  const data = await loadCustomerMenuProductDetailUncached(options);
  if (data) {
    productDetailCache.set(key, {
      expiresAt: Date.now() + PRODUCT_DETAIL_CACHE_TTL_MS,
      data,
    });
  }
  return data;
}

