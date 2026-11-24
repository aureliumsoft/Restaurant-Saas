import { db } from '@/lib/db';
import { loadSingleCategoryWithLinkedItems } from '@/lib/menu/menu-item-categories';
import {
  menuItemBrowseListSelect,
  menuItemPosCatalogSelect,
} from '@/lib/menu/menu-item-list-select';
import { MENU_ITEM_CATEGORY_LINK_DATE_ORDER } from '@/lib/menu/product-order';
import {
  mapBrowseListItem,
  resolveCategoryImageUrl,
  restaurantMenuItemImageUrl,
} from '@/lib/menu/menu-item-image-utils';
import { publicRestaurantImageUrls } from '@/lib/stored-image-response';
import type { PosCustomizeIndex } from '@/lib/menu/assemble-pos-customize';
import {
  RESTAURANT_SERVICE_CHARGE_DB_SELECT,
  parseRestaurantServiceCharges,
  withServiceChargesPayload,
} from '@/lib/restaurant-service-charge';
import { RESTAURANT_DINE_IN_PAYMENT_DB_SELECT } from '@/lib/restaurant-dine-in-payment';
import {
  parseRestaurantFulfillmentSettings,
  RESTAURANT_FULFILLMENT_SETTINGS_DB_SELECT,
} from '@/lib/restaurant-fulfillment-settings';

export type { PosCustomizeIndex } from '@/lib/menu/assemble-pos-customize';

async function loadCategoryIdsByItemIds(menuItemIds: string[]) {
  const map = new Map<string, string[]>();
  if (menuItemIds.length === 0) return map;

  const links = await db.menuItemCategory.findMany({
    where: { menuItemId: { in: menuItemIds } },
    orderBy: { sortOrder: 'asc' },
    select: { menuItemId: true, categoryId: true },
  });
  for (const link of links) {
    const list = map.get(link.menuItemId) ?? [];
    list.push(link.categoryId);
    map.set(link.menuItemId, list);
  }
  return map;
}

function mapMenuItemWithCategoryIds<
  T extends { id: string; categoryId: string },
>(item: T, categoryIdsByItem: Map<string, string[]>) {
  const categoryIds = categoryIdsByItem.get(item.id) ?? [item.categoryId];
  return {
    ...item,
    categoryIds,
  };
}

function stampBrowseImages<T extends { id: string; imageUrl?: string | null }>(
  items: T[]
) {
  return items.map((item) =>
    mapBrowseListItem(item, { restaurantProxy: true })
  );
}

const restaurantMetaSelect = {
  id: true,
  name: true,
  slug: true,
  logoUrl: true,
  mainBannerUrl: true,
  menuBannerUrls: true,
  updatedAt: true,
  themePrimaryColor: true,
  ...RESTAURANT_SERVICE_CHARGE_DB_SELECT,
  ...RESTAURANT_DINE_IN_PAYMENT_DB_SELECT,
  ...RESTAURANT_FULFILLMENT_SETTINGS_DB_SELECT,
} as const;

/** POS menu: restaurant meta + category list (no items). */
export async function loadRestaurantMenuCategoriesMeta(
  restaurantId: string,
  _branchId?: string | null
) {
  const restaurantMeta = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: restaurantMetaSelect,
  });
  if (!restaurantMeta) return null;

  const categories = await db.menuCategory.findMany({
    where: {
      restaurantId,
      showInFront: true,
      OR: [
        { itemLinks: { some: { menuItem: { isActive: true } } } },
        { items: { some: { isActive: true } } },
      ],
    },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      showInFront: true,
      sortOrder: true,
      updatedAt: true,
      imageUrl: true,
    },
  });

  const menus = categories.map((c) => ({
    id: c.id,
    name: c.name,
    showInFront: c.showInFront,
    imageUrl: resolveCategoryImageUrl(c, { restaurantProxy: true }),
    items: [],
  }));

  const { slug: _slug, updatedAt, ...metaRest } = restaurantMeta;
  const logoUrls = publicRestaurantImageUrls(restaurantMeta.slug, {
    logoUrl: restaurantMeta.logoUrl,
    mainBannerUrl: restaurantMeta.mainBannerUrl,
    menuBannerUrls: restaurantMeta.menuBannerUrls,
    updatedAt,
  });

  return {
    ...withServiceChargesPayload({
      ...metaRest,
      logoUrl: logoUrls.logoUrl,
      serviceCharges: parseRestaurantServiceCharges(restaurantMeta),
      menus,
    }),
    fulfillmentSettings: parseRestaurantFulfillmentSettings(restaurantMeta),
  };
}

/**
 * POS one-shot catalog: meta + every front category with browse items.
 * Single parallel DB round-trip; each product row loaded once.
 */
export async function loadRestaurantPosMenuCatalog(
  restaurantId: string,
  _branchId?: string | null
) {
  const frontCategoryWhere = {
    restaurantId,
    showInFront: true,
    OR: [
      { itemLinks: { some: { menuItem: { isActive: true } } } },
      { items: { some: { isActive: true } } },
    ],
  };

  const [restaurantMeta, categories, links, loadedItems] = await Promise.all([
    db.restaurant.findUnique({
      where: { id: restaurantId },
      select: restaurantMetaSelect,
    }),
    db.menuCategory.findMany({
      where: frontCategoryWhere,
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        showInFront: true,
        sortOrder: true,
        updatedAt: true,
        imageUrl: true,
      },
    }),
    db.menuItemCategory.findMany({
      where: {
        category: frontCategoryWhere,
        menuItem: { isActive: true },
      },
      orderBy: [...MENU_ITEM_CATEGORY_LINK_DATE_ORDER],
      select: { categoryId: true, menuItemId: true },
    }),
    db.menuItem.findMany({
      where: {
        restaurantId,
        isActive: true,
        OR: [
          {
            category: {
              showInFront: true,
            },
          },
          {
            categoryLinks: {
              some: {
                category: {
                  showInFront: true,
                },
              },
            },
          },
        ],
      },
      select: menuItemPosCatalogSelect,
    }),
  ]);
  if (!restaurantMeta) return null;

  const byId = new Map(loadedItems.map((item) => [item.id, item]));
  const orderedIdsByCategory = new Map<string, string[]>();
  const seenByCategory = new Map<string, Set<string>>();
  const categoryIdsByItem = new Map<string, string[]>();

  for (const category of categories) {
    orderedIdsByCategory.set(category.id, []);
    seenByCategory.set(category.id, new Set());
  }

  const pushItemToCategory = (categoryId: string, menuItemId: string) => {
    if (!byId.has(menuItemId)) return;
    const seen = seenByCategory.get(categoryId);
    const ordered = orderedIdsByCategory.get(categoryId);
    if (!seen || !ordered || seen.has(menuItemId)) return;
    seen.add(menuItemId);
    ordered.push(menuItemId);
    const list = categoryIdsByItem.get(menuItemId) ?? [];
    list.push(categoryId);
    categoryIdsByItem.set(menuItemId, list);
  };

  for (const link of links) {
    pushItemToCategory(link.categoryId, link.menuItemId);
  }

  // Legacy primary-category membership (items not only on join table).
  for (const item of loadedItems) {
    if (orderedIdsByCategory.has(item.categoryId)) {
      pushItemToCategory(item.categoryId, item.id);
    }
  }

  const menus = categories.map((category) => {
    const orderedIds = orderedIdsByCategory.get(category.id) ?? [];
    const items = orderedIds
      .map((id) => byId.get(id))
      .filter((item): item is (typeof loadedItems)[number] => Boolean(item));

    return {
      id: category.id,
      name: category.name,
      showInFront: category.showInFront,
      imageUrl: resolveCategoryImageUrl(category, { restaurantProxy: true }),
      items: stampBrowseImages(items).map((item) =>
        mapMenuItemWithCategoryIds(item, categoryIdsByItem)
      ),
    };
  });

  const { slug: _slug, updatedAt, ...metaRest } = restaurantMeta;
  const logoUrls = publicRestaurantImageUrls(restaurantMeta.slug, {
    logoUrl: restaurantMeta.logoUrl,
    mainBannerUrl: restaurantMeta.mainBannerUrl,
    menuBannerUrls: restaurantMeta.menuBannerUrls,
    updatedAt,
  });

  return {
    ...withServiceChargesPayload({
      ...metaRest,
      logoUrl: logoUrls.logoUrl,
      serviceCharges: parseRestaurantServiceCharges(restaurantMeta),
      menus,
    }),
    fulfillmentSettings: parseRestaurantFulfillmentSettings(restaurantMeta),
  };
}

/** POS menu: items for one category (fast browse list). */
export async function loadRestaurantMenuCategoryItems(
  restaurantId: string,
  categoryId: string
) {
  const category = await loadSingleCategoryWithLinkedItems({
    restaurantId,
    categoryId,
    categorySelect: {
      id: true,
      name: true,
      showInFront: true,
      sortOrder: true,
    },
    itemSelect: menuItemBrowseListSelect,
    sellableOnly: true,
  });
  if (!category || category.showInFront === false) return null;

  const itemIds = category.items.map((item) => item.id);
  const categoryIdsByItem = await loadCategoryIdsByItemIds(itemIds);

  const itemsWithCategoryIds = stampBrowseImages(category.items).map((item) =>
    mapMenuItemWithCategoryIds(item, categoryIdsByItem)
  );

  return {
    categoryId: category.id,
    items: itemsWithCategoryIds,
  };
}

const POS_INDEX_MS = 10 * 60 * 1000;
const posIndexCache = new Map<string, { at: number; data: PosCustomizeIndex }>();

export function clearPosCustomizeIndexCache() {
  posIndexCache.clear();
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (row): row is Record<string, unknown> =>
      Boolean(row) && typeof row === 'object'
  );
}

function stampIndexImage(row: Record<string, unknown>) {
  const id = typeof row.id === 'string' ? row.id : '';
  if (id && row.hasImage === true && !row.imageUrl) {
    row.imageUrl = restaurantMenuItemImageUrl(id);
  }
  const variations = asRecordArray(row.variations);
  for (const variation of variations) {
    if (id && variation.hasImage === true && !variation.imageUrl) {
      variation.imageUrl = restaurantMenuItemImageUrl(id);
    }
  }
}

/**
 * Recommendation lists keyed by category, and group rules keyed by dish.
 * A tap joins these in memory instead of querying each dish again.
 */
export async function loadRestaurantPosCustomizeIndex(
  restaurantId: string
): Promise<PosCustomizeIndex> {
  const hit = posIndexCache.get(restaurantId);
  if (hit && Date.now() - hit.at < POS_INDEX_MS) return hit.data;

  const [groupRows, optionRows, personalizeRows, productRows] = await Promise.all([
    db.$queryRaw<Array<{ group: Record<string, unknown> }>>`
      SELECT json_build_object(
        'menuItemId', g."menuItemId",
        'id', g.id,
        'name', g.name,
        'selectionType', g."selectionType",
        'sourceType', g."sourceType",
        'multipleMode', g."multipleMode",
        'freeQuantity', g."freeQuantity",
        'categoryDiscountPercent', g."categoryDiscountPercent",
        'categoryExtraCostPercent', g."categoryExtraCostPercent",
        'productOverrides', g."productOverrides",
        'required', g.required,
        'minItems', g."minItems",
        'maxItems', g."maxItems",
        'sortOrder', g."sortOrder",
        'productCategoryIds', g."productCategoryIds",
        'defaultLinkedMenuItemId', g."defaultLinkedMenuItemId",
        'defaultLinkedRestaurantVariationId', g."defaultLinkedRestaurantVariationId",
        'includeDefaultLinkedVariationPrice', g."includeDefaultLinkedVariationPrice",
        'useVariationPricing', g."useVariationPricing",
        'linkedCategoryId', g."linkedCategoryId",
        'linkedProductId', g."linkedProductId",
        'linkedCategoryName', c.name,
        'defaultLinkedRestaurantVariation', (
          SELECT json_build_object('id', drv.id, 'name', drv.name, 'shortLabel', drv."shortLabel")
          FROM "RestaurantVariation" drv
          WHERE drv.id = g."defaultLinkedRestaurantVariationId"
        ),
        'variationLimits', (
          SELECT coalesce(json_agg(json_build_object(
            'variationId', vl."variationId",
            'minItems', vl."minItems",
            'maxItems', vl."maxItems"
          )), '[]'::json)
          FROM "MenuItemAttributeGroupVariationLimit" vl
          WHERE vl."groupId" = g.id
        )
      ) AS group
      FROM "MenuItemAttributeGroup" g
      JOIN "MenuItem" i ON i.id = g."menuItemId"
      LEFT JOIN "MenuCategory" c ON c.id = g."linkedCategoryId"
      WHERE i."restaurantId" = ${restaurantId}
        AND i."isActive" = true
    `,
    db.$queryRaw<Array<{ categoryId: string; items: unknown }>>`
      SELECT c.id AS "categoryId",
        (
          SELECT coalesce(json_agg(card.item ORDER BY card.ord), '[]'::json)
          FROM (
            SELECT src.ord,
              json_build_object(
                'id', mi.id,
                'name', mi.name,
                'description', mi.description,
                'imageUrl', CASE WHEN left(coalesce(mi."imageUrl", ''), 4) = 'http' THEN mi."imageUrl" ELSE NULL END,
                'hasImage', (mi."imageUrl" IS NOT NULL AND btrim(mi."imageUrl") <> ''),
                'price', mi.price,
                'salePrice', mi."salePrice",
                'needsNestedSheet', (
                  EXISTS (SELECT 1 FROM "MenuItemAttributeGroup" ng WHERE ng."menuItemId" = mi.id)
                  OR EXISTS (SELECT 1 FROM "MenuItemPersonalizeGroup" np WHERE np."menuItemId" = mi.id)
                ),
                'variations', (
                  SELECT coalesce(json_agg(json_build_object(
                    'id', ov.id,
                    'name', ov.name,
                    'title', ov.title,
                    'swatchHex', ov."swatchHex",
                    'priceDelta', ov."priceDelta",
                    'sortOrder', ov."sortOrder",
                    'restaurantVariationId', ov."restaurantVariationId"
                  ) ORDER BY ov."sortOrder"), '[]'::json)
                  FROM "MenuItemVariation" ov
                  LEFT JOIN "RestaurantVariation" orv ON orv.id = ov."restaurantVariationId"
                  WHERE ov."menuItemId" = mi.id
                    AND (ov."restaurantVariationId" IS NULL OR orv."isActive" = true)
                )
              ) AS item
            FROM (
              SELECT ranked."menuItemId", ranked.ord
              FROM (
                SELECT link."menuItemId",
                  row_number() OVER (
                    ORDER BY link.legacy, link."sortOrder", link."createdAt", link.item_created
                  ) AS ord
                FROM (
                  SELECT l."menuItemId", l."sortOrder", l."createdAt", mi_link."createdAt" AS item_created, 0 AS legacy
                  FROM "MenuItemCategory" l
                  JOIN "MenuItem" mi_link ON mi_link.id = l."menuItemId" AND mi_link."isActive" = true
                  WHERE l."categoryId" = c.id
                  UNION ALL
                  SELECT mi_legacy.id, 0, mi_legacy."createdAt", mi_legacy."createdAt", 1
                  FROM "MenuItem" mi_legacy
                  WHERE mi_legacy."categoryId" = c.id
                    AND mi_legacy."restaurantId" = ${restaurantId}
                    AND mi_legacy."isActive" = true
                    AND NOT EXISTS (
                      SELECT 1 FROM "MenuItemCategory" l2
                      WHERE l2."categoryId" = c.id AND l2."menuItemId" = mi_legacy.id
                    )
                ) link
              ) ranked
              WHERE ranked.ord <= 40
            ) src
            JOIN "MenuItem" mi ON mi.id = src."menuItemId"
          ) card
        ) AS items
      FROM (
        SELECT DISTINCT g."linkedCategoryId" AS id
        FROM "MenuItemAttributeGroup" g
        JOIN "MenuItem" i ON i.id = g."menuItemId"
        WHERE i."restaurantId" = ${restaurantId}
          AND i."isActive" = true
          AND g."sourceType"::text = 'CATEGORY'
          AND g."linkedCategoryId" IS NOT NULL
      ) c
    `,
    db.$queryRaw<Array<{ menuItemId: string; groups: unknown }>>`
      SELECT i.id AS "menuItemId",
        coalesce(json_agg(json_build_object(
          'id', pg.id,
          'parentName', pg."parentName",
          'maxItems', pg."maxItems",
          'sortOrder', pg."sortOrder",
          'options', (
            SELECT coalesce(json_agg(json_build_object(
              'id', po.id,
              'name', po.name,
              'sortOrder', po."sortOrder"
            ) ORDER BY po."sortOrder"), '[]'::json)
            FROM "MenuItemPersonalizeOption" po
            WHERE po."groupId" = pg.id
          )
        ) ORDER BY pg."sortOrder"), '[]'::json) AS groups
      FROM "MenuItem" i
      JOIN "MenuItemPersonalizeGroup" pg ON pg."menuItemId" = i.id
      WHERE i."restaurantId" = ${restaurantId}
        AND i."isActive" = true
      GROUP BY i.id
    `,
    db.$queryRaw<Array<{ card: Record<string, unknown> }>>`
      SELECT json_build_object(
        'id', lp.id,
        'name', lp.name,
        'description', lp.description,
        'imageUrl', CASE WHEN left(coalesce(lp."imageUrl", ''), 4) = 'http' THEN lp."imageUrl" ELSE NULL END,
        'hasImage', (lp."imageUrl" IS NOT NULL AND btrim(lp."imageUrl") <> ''),
        'price', lp.price,
        'salePrice', lp."salePrice",
        'categoryId', lp."categoryId",
        'needsNestedSheet', (
          EXISTS (SELECT 1 FROM "MenuItemAttributeGroup" ng WHERE ng."menuItemId" = lp.id)
          OR EXISTS (SELECT 1 FROM "MenuItemPersonalizeGroup" np WHERE np."menuItemId" = lp.id)
        ),
        'variations', (
          SELECT coalesce(json_agg(json_build_object(
            'id', lv.id,
            'name', lv.name,
            'title', lv.title,
            'swatchHex', lv."swatchHex",
            'priceDelta', lv."priceDelta",
            'sortOrder', lv."sortOrder",
            'restaurantVariationId', lv."restaurantVariationId"
          ) ORDER BY lv."sortOrder"), '[]'::json)
          FROM "MenuItemVariation" lv
          LEFT JOIN "RestaurantVariation" lrv ON lrv.id = lv."restaurantVariationId"
          WHERE lv."menuItemId" = lp.id
            AND (lv."restaurantVariationId" IS NULL OR lrv."isActive" = true)
        )
      ) AS card
      FROM "MenuItem" lp
      WHERE lp."restaurantId" = ${restaurantId}
        AND lp.id IN (
          SELECT g."linkedProductId"
          FROM "MenuItemAttributeGroup" g
          JOIN "MenuItem" i ON i.id = g."menuItemId"
          WHERE i."restaurantId" = ${restaurantId}
            AND i."isActive" = true
            AND g."sourceType"::text = 'PRODUCT'
            AND g."linkedProductId" IS NOT NULL
        )
    `,
  ]);

  const groupsByItem: PosCustomizeIndex['groupsByItem'] = {};
  for (const row of groupRows) {
    const group = row.group;
    const itemId = typeof group.menuItemId === 'string' ? group.menuItemId : '';
    if (!itemId) continue;
    const list = groupsByItem[itemId] ?? [];
    list.push(group);
    groupsByItem[itemId] = list;
  }
  for (const list of Object.values(groupsByItem)) {
    list.sort(
      (a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)
    );
  }

  const optionsByCategory: PosCustomizeIndex['optionsByCategory'] = {};
  for (const row of optionRows) {
    const items = asRecordArray(row.items);
    for (const item of items) stampIndexImage(item);
    optionsByCategory[row.categoryId] = items;
  }

  const personalizeByItem: PosCustomizeIndex['personalizeByItem'] = {};
  for (const row of personalizeRows) {
    personalizeByItem[row.menuItemId] = asRecordArray(row.groups);
  }

  const productCards: PosCustomizeIndex['productCards'] = {};
  for (const row of productRows) {
    const card = row.card;
    const id = typeof card.id === 'string' ? card.id : '';
    if (!id) continue;
    stampIndexImage(card);
    productCards[id] = card;
  }

  const data: PosCustomizeIndex = {
    groupsByItem,
    optionsByCategory,
    personalizeByItem,
    productCards,
  };
  posIndexCache.set(restaurantId, { at: Date.now(), data });
  return data;
}
