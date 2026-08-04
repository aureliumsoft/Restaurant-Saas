import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  AttributeSelectionType,
  RecommendationMultipleMode,
  RecommendationSourceType,
} from '@prisma/client';

import { db } from '@/lib/db';
import {
  parseProductsCsvImport,
  type ColumnMapping,
} from '@/lib/menu/import-products-csv';
import { syncMenuItemCategoryLinks } from '@/lib/menu/menu-item-categories';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';
import {
  getRestaurantPlanFeatures,
  subscriptionPlanDeniedResponse,
} from '@/lib/subscription-plan-enforcement';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKeys: ['product', 'recommendations'],
    action: 'edit',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'CSV file is required' }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return NextResponse.json(
      { error: 'Only .csv files are supported (same format as Export CSV)' },
      { status: 400 }
    );
  }

  const skipDuplicates =
    String(form.get('skipDuplicates') ?? 'true').toLowerCase() !== 'false';

  let columnMapping: ColumnMapping | undefined;
  const mappingRaw = form.get('columnMapping');
  if (typeof mappingRaw === 'string' && mappingRaw.trim()) {
    try {
      columnMapping = JSON.parse(mappingRaw) as ColumnMapping;
    } catch {
      return NextResponse.json(
        { error: 'Invalid column mapping JSON' },
        { status: 400 }
      );
    }
  }

  const text = await file.text();
  const parsed = parseProductsCsvImport(text, { columnMapping });
  if (parsed.products.length === 0) {
    return NextResponse.json(
      {
        error: 'No importable product rows found',
        details: parsed.errors.slice(0, 20),
      },
      { status: 400 }
    );
  }

  const needsRecs = parsed.products.some(
    (p) => p.recommendations.length > 0 || p.personalizeGroups.length > 0
  );
  if (needsRecs) {
    const plan = await getRestaurantPlanFeatures(auth.restaurant.id);
    if (!plan.recommendations) {
      return subscriptionPlanDeniedResponse(
        'Product recommendations and personalize import'
      );
    }
  }

  const restaurantId = auth.restaurant.id;

  try {
    const result = await db.$transaction(
      async (tx) => {
        const existingProducts = await tx.menuItem.findMany({
          where: { restaurantId },
          select: { id: true, name: true },
        });
        const existingNameToId = new Map(
          existingProducts.map((p) => [p.name.trim().toLowerCase(), p.id])
        );

        // Categories
        const categories = await tx.menuCategory.findMany({
          where: { restaurantId },
          select: { id: true, name: true, sortOrder: true },
          orderBy: [{ sortOrder: 'desc' }, { createdAt: 'desc' }],
        });
        const categoryIdByName = new Map(
          categories.map((c) => [c.name.trim().toLowerCase(), c.id])
        );
        let nextCatSort =
          categories.length > 0
            ? Math.max(...categories.map((c) => c.sortOrder)) + 1
            : 0;

        const ensureCategory = async (name: string): Promise<string> => {
          const key = name.trim().toLowerCase();
          const hit = categoryIdByName.get(key);
          if (hit) return hit;
          const created = await tx.menuCategory.create({
            data: {
              name: name.trim(),
              restaurantId,
              sortOrder: nextCatSort++,
            },
            select: { id: true, name: true },
          });
          categoryIdByName.set(created.name.trim().toLowerCase(), created.id);
          return created.id;
        };

        // Restaurant-level variation templates
        const restaurantVariations = await tx.restaurantVariation.findMany({
          where: { restaurantId },
          select: { id: true, name: true, shortLabel: true, sortOrder: true },
        });
        const varByName = new Map(
          restaurantVariations.map((v) => [v.name.trim().toLowerCase(), v])
        );
        for (const v of restaurantVariations) {
          if (v.shortLabel?.trim()) {
            varByName.set(v.shortLabel.trim().toLowerCase(), v);
          }
        }
        let nextVarSort =
          (
            await tx.restaurantVariation.aggregate({
              where: { restaurantId },
              _max: { sortOrder: true },
            })
          )._max.sortOrder ?? 0;

        const ensureRestaurantVariation = async (
          label: string
        ): Promise<string> => {
          const key = label.trim().toLowerCase();
          const hit = varByName.get(key);
          if (hit) return hit.id;
          nextVarSort += 1;
          const created = await tx.restaurantVariation.create({
            data: {
              restaurantId,
              name: label.trim(),
              shortLabel: label.trim().slice(0, 8),
              sortOrder: nextVarSort,
            },
            select: { id: true, name: true, shortLabel: true, sortOrder: true },
          });
          varByName.set(created.name.trim().toLowerCase(), created);
          if (created.shortLabel) {
            varByName.set(created.shortLabel.trim().toLowerCase(), created);
          }
          return created.id;
        };

        let createdProducts = 0;
        let updatedProducts = 0;
        let skippedProducts = 0;
        let variationsCount = 0;
        let recommendationsCount = 0;
        let personalizeGroupsCount = 0;
        let personalizeOptionsCount = 0;
        let offersCount = 0;

        /** product name (lower) → menuItem id for newly created + existing */
        const nameToId = new Map(existingNameToId);
        const createdProductIds: string[] = [];

        for (const row of parsed.products) {
          const nameKey = row.name.trim().toLowerCase();
          const existingId = nameToId.get(nameKey);

          if (existingId && skipDuplicates) {
            skippedProducts += 1;
            continue;
          }

          const categoryNames =
            row.categoryNames.length > 0
              ? row.categoryNames
              : ['Uncategorized'];
          const categoryIds: string[] = [];
          for (const cn of categoryNames) {
            categoryIds.push(await ensureCategory(cn));
          }
          const primaryCategoryId = categoryIds[0]!;

          let productId: string;
          let isNew = false;

          if (existingId && !skipDuplicates) {
            await tx.menuItem.update({
              where: { id: existingId },
              data: {
                name: row.name.trim(),
                description: row.description,
                price: row.price,
                salePrice: row.salePrice,
                categoryId: primaryCategoryId,
              },
            });
            await syncMenuItemCategoryLinks(tx, existingId, categoryIds);
            productId = existingId;
            updatedProducts += 1;
          } else {
            const created = await tx.menuItem.create({
              data: {
                restaurantId,
                name: row.name.trim(),
                description: row.description,
                price: row.price,
                salePrice: row.salePrice,
                categoryId: primaryCategoryId,
              },
              select: { id: true, name: true },
            });
            await syncMenuItemCategoryLinks(tx, created.id, categoryIds);
            productId = created.id;
            nameToId.set(nameKey, created.id);
            createdProductIds.push(created.id);
            createdProducts += 1;
            isNew = true;
          }

          // Only attach related data for newly created products (avoid wipe/duplication on update)
          if (!isNew) continue;

          for (const v of row.variations) {
            let restaurantVariationId: string | null = null;
            if (v.catalogName) {
              restaurantVariationId = await ensureRestaurantVariation(
                v.catalogName
              );
            } else {
              restaurantVariationId = await ensureRestaurantVariation(v.title);
            }
            await tx.menuItemVariation.create({
              data: {
                menuItemId: productId,
                name: v.name,
                title: v.title,
                priceDelta: v.priceDelta,
                sortOrder: v.sortOrder,
                swatchHex: v.swatchHex,
                restaurantVariationId,
              },
            });
            variationsCount += 1;
          }

          // Recommendations
          for (const g of row.recommendations) {
            let linkedCategoryId: string | null = null;
            let linkedProductId: string | null = null;
            let defaultLinkedMenuItemId: string | null = null;
            let defaultLinkedRestaurantVariationId: string | null = null;

            if (g.sourceType === 'CATEGORY' && g.linkedCategoryName) {
              linkedCategoryId = await ensureCategory(g.linkedCategoryName);
            }
            if (g.sourceType === 'PRODUCT' && g.linkedProductName) {
              linkedProductId =
                nameToId.get(g.linkedProductName.trim().toLowerCase()) ?? null;
            }
            if (g.defaultLinkedMenuItemName) {
              defaultLinkedMenuItemId =
                nameToId.get(
                  g.defaultLinkedMenuItemName.trim().toLowerCase()
                ) ?? null;
            }
            if (g.defaultLinkedRestaurantVariationName) {
              defaultLinkedRestaurantVariationId =
                await ensureRestaurantVariation(
                  g.defaultLinkedRestaurantVariationName
                );
            }

            const selectionType =
              g.selectionType === 'MULTIPLE'
                ? AttributeSelectionType.MULTIPLE
                : AttributeSelectionType.SINGLE;
            const sourceType =
              g.sourceType === 'PRODUCT'
                ? RecommendationSourceType.PRODUCT
                : RecommendationSourceType.CATEGORY;
            const multipleMode =
              selectionType === AttributeSelectionType.MULTIPLE
                ? g.multipleMode === 'BOOLEAN' || g.multipleMode === 'CHECKBOX'
                  ? RecommendationMultipleMode.CHECKBOX
                  : RecommendationMultipleMode.QUANTITY
                : null;

            await tx.menuItemAttributeGroup.create({
              data: {
                menuItemId: productId,
                name: g.name,
                sortOrder: g.sortOrder,
                selectionType,
                required: g.required,
                sourceType,
                multipleMode,
                freeQuantity:
                  selectionType === AttributeSelectionType.MULTIPLE &&
                  multipleMode === RecommendationMultipleMode.QUANTITY
                    ? (g.freeQuantity ?? 0)
                    : null,
                minItems:
                  selectionType === AttributeSelectionType.MULTIPLE
                    ? (g.minItems ?? 0)
                    : 1,
                maxItems:
                  selectionType === AttributeSelectionType.MULTIPLE
                    ? (g.maxItems ?? 1)
                    : 1,
                linkedCategoryId:
                  sourceType === RecommendationSourceType.CATEGORY
                    ? linkedCategoryId
                    : null,
                linkedProductId:
                  sourceType === RecommendationSourceType.PRODUCT
                    ? linkedProductId
                    : null,
                defaultLinkedMenuItemId:
                  sourceType === RecommendationSourceType.CATEGORY
                    ? defaultLinkedMenuItemId
                    : null,
                defaultLinkedRestaurantVariationId:
                  sourceType === RecommendationSourceType.CATEGORY
                    ? defaultLinkedRestaurantVariationId
                    : null,
                includeDefaultLinkedVariationPrice:
                  g.includeDefaultLinkedVariationPrice,
                useVariationPricing: g.useVariationPricing,
                productCategoryIds: [],
              },
            });
            recommendationsCount += 1;
          }

          for (const g of row.personalizeGroups) {
            const group = await tx.menuItemPersonalizeGroup.create({
              data: {
                menuItemId: productId,
                parentName: g.parentName,
                maxItems: g.maxItems,
                sortOrder: g.sortOrder,
              },
              select: { id: true },
            });
            personalizeGroupsCount += 1;
            for (let i = 0; i < g.options.length; i++) {
              await tx.menuItemPersonalizeOption.create({
                data: {
                  groupId: group.id,
                  name: g.options[i]!,
                  sortOrder: i,
                },
              });
              personalizeOptionsCount += 1;
            }
          }
        }

        // Offers — only for newly created base products
        for (const row of parsed.products) {
          const baseId = nameToId.get(row.name.trim().toLowerCase());
          if (!baseId || !createdProductIds.includes(baseId)) continue;

          for (let i = 0; i < row.offerProductNames.length; i++) {
            const offeredName = row.offerProductNames[i]!.trim();
            const offeredId = nameToId.get(offeredName.toLowerCase());
            if (!offeredId || offeredId === baseId) continue;
            try {
              await tx.menuItemOffer.create({
                data: {
                  baseItemId: baseId,
                  offeredItemId: offeredId,
                  sortOrder: i,
                },
              });
              offersCount += 1;
            } catch {
              // skip unique / FK conflicts
            }
          }
        }

        return {
          products: parsed.products.length,
          createdProducts,
          updatedProducts,
          skippedProducts,
          variations: variationsCount,
          recommendations: recommendationsCount,
          offers: offersCount,
          personalizeGroups: personalizeGroupsCount,
          personalizeOptions: personalizeOptionsCount,
          warnings: parsed.errors.slice(0, 30),
        };
      },
      {
        maxWait: 20_000,
        timeout: 180_000,
      }
    );

    return NextResponse.json(
      {
        data: result,
        message: 'CSV import completed',
      },
      { status: 200 }
    );
  } catch (e) {
    console.error('Products CSV import failed:', e);
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : 'Could not import products from CSV',
      },
      { status: 500 }
    );
  }
}
