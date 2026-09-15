import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  AttributeSelectionType,
  Prisma,
  RecommendationMultipleMode,
  RecommendationSourceType,
} from '@prisma/client';

import { db } from '@/lib/db';
import {
  parseProductsCsvImport,
  type ColumnMapping,
} from '@/lib/menu/import-products-csv';
import { syncMenuItemCategoryLinks } from '@/lib/menu/menu-item-categories';
import { syncMenuItemIngredients } from '@/lib/inventory/sync-recipe';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';
import { publishInventoryStockUpdate } from '@/lib/realtime/publish';
import {
  getRestaurantPlanFeatures,
  subscriptionPlanDeniedResponse,
} from '@/lib/subscription-plan-enforcement';

export const runtime = 'nodejs';
/** Allow long CSV imports on platforms that honor this (Vercel Hobby max is 300s). */
export const maxDuration = 300;

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
  const productCount = parsed.products.length;
  /** Large catalogs (200+) exceed a single 180s interactive transaction. */
  const BATCH_SIZE = 15;
  const TX_OPTIONS = {
    maxWait: 60_000,
    timeout: 120_000,
  } as const;

  try {
    let createdProducts = 0;
    let updatedProducts = 0;
    let skippedProducts = 0;
    let variationsCount = 0;
    let recommendationsCount = 0;
    let personalizeGroupsCount = 0;
    let personalizeOptionsCount = 0;
    let offersCount = 0;
    let ingredientsCount = 0;
    let createdIngredients = 0;
    const extraWarnings: string[] = [];

    const existingProducts = await db.menuItem.findMany({
      where: { restaurantId },
      select: { id: true, name: true },
    });
    const nameToId = new Map(
      existingProducts.map((p) => [p.name.trim().toLowerCase(), p.id])
    );
    const createdProductIds: string[] = [];

    const categories = await db.menuCategory.findMany({
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

    const restaurantVariations = await db.restaurantVariation.findMany({
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
        await db.restaurantVariation.aggregate({
          where: { restaurantId },
          _max: { sortOrder: true },
        })
      )._max.sortOrder ?? 0;

    const ingredients = await db.ingredient.findMany({
      where: { restaurantId },
      select: { id: true, name: true, isActive: true },
    });
    const ingredientByName = new Map(
      ingredients.map((i) => [i.name.trim().toLowerCase(), i])
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runBatch = async (
      tx: any,
      batch: (typeof parsed.products)[number][]
    ) => {
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

        const ensureIngredient = async (
          name: string
        ): Promise<{ id: string; created: boolean }> => {
          const trimmed = name.trim();
          const key = trimmed.toLowerCase();
          const hit = ingredientByName.get(key);
          if (hit) {
            if (!hit.isActive) {
              await tx.ingredient.update({
                where: { id: hit.id },
                data: { isActive: true },
              });
              hit.isActive = true;
            }
            return { id: hit.id, created: false };
          }
          try {
            const created = await tx.ingredient.create({
              data: {
                restaurantId,
                name: trimmed,
                quantity: 0,
                unit: 'PCS',
                isMajor: false,
                isActive: true,
              },
              select: { id: true, name: true, isActive: true },
            });
            ingredientByName.set(created.name.trim().toLowerCase(), created);
            ingredientByName.set(key, created);
            return { id: created.id, created: true };
          } catch (e) {
            if (
              e instanceof Prisma.PrismaClientKnownRequestError &&
              e.code === 'P2002'
            ) {
              const existing = await tx.ingredient.findFirst({
                where: {
                  restaurantId,
                  name: { equals: trimmed, mode: 'insensitive' },
                },
                select: { id: true, name: true, isActive: true },
              });
              if (existing) {
                ingredientByName.set(existing.name.trim().toLowerCase(), existing);
                ingredientByName.set(key, existing);
                return { id: existing.id, created: false };
              }
            }
            throw e;
          }
        };

        const matchVariationTemplateId = (
          label: string | null,
          vars: Array<{
            restaurantVariationId: string | null;
            name: string;
            title: string;
            restaurantVariation: {
              name: string;
              shortLabel: string | null;
            } | null;
          }>
        ): string | null => {
          if (!label?.trim()) return null;
          const raw = label.trim().toLowerCase();
          const catalog = raw.match(/^(.*)\s+\[([^\]]+)\]\s*$/);
          const title = (catalog?.[1] ?? raw).trim();
          const short = (catalog?.[2] ?? '').trim();
          const keys = new Set([raw, title, short].filter(Boolean));
          for (const v of vars) {
            const names = [
              v.title,
              v.name,
              v.restaurantVariation?.name,
              v.restaurantVariation?.shortLabel,
            ]
              .map((n) => n?.trim().toLowerCase())
              .filter(Boolean);
            if (names.some((n) => keys.has(n!))) {
              return v.restaurantVariationId;
            }
          }
          return null;
        };

        const attachIngredients = async (
          productId: string,
          productName: string
        ) => {
          const row = parsed.products.find(
            (p) => p.name.trim().toLowerCase() === productName.trim().toLowerCase()
          );
          if (!row || row.ingredients.length === 0) return;

          const vars = await tx.menuItemVariation.findMany({
            where: { menuItemId: productId },
            select: {
              id: true,
              name: true,
              title: true,
              restaurantVariationId: true,
              restaurantVariation: {
                select: { name: true, shortLabel: true },
              },
            },
          });

          const recipes: Array<{
            ingredientId: string;
            quantity: number;
            restaurantVariationId?: string | null;
          }> = [];

          for (const line of row.ingredients) {
            if (!line.ingredientName.trim()) continue;
            const { id: ingredientId } = await ensureIngredient(
              line.ingredientName
            );
            let restaurantVariationId: string | null = null;
            if (vars.length > 0) {
              restaurantVariationId = matchVariationTemplateId(
                line.variationLabel,
                vars
              );
              if (!restaurantVariationId && vars.length === 1) {
                restaurantVariationId = vars[0]!.restaurantVariationId;
              }
              if (!restaurantVariationId) {
                extraWarnings.push(
                  `"${productName}": ingredient "${line.ingredientName}" needs a matching variation (skipped)`
                );
                continue;
              }
            } else if (line.variationLabel) {
              extraWarnings.push(
                `"${productName}": ingredient "${line.ingredientName}" has a variation label but the product has no variations (applied to product)`
              );
            }
            recipes.push({
              ingredientId,
              quantity: line.quantity,
              restaurantVariationId,
            });
          }

          if (recipes.length === 0) return;
          await syncMenuItemIngredients(tx, {
            restaurantId,
            menuItemId: productId,
            variations: vars.map((v: { id: string; restaurantVariationId: string }) => ({
              id: v.id,
              restaurantVariationId: v.restaurantVariationId,
            })),
            recipes,
          });
          ingredientsCount += recipes.length;
        };

        for (const row of batch) {
          const nameKey = row.name.trim().toLowerCase();
          const existingId = nameToId.get(nameKey);

          const categoryNames =
            row.categoryNames.length > 0
              ? row.categoryNames
              : existingId
                ? []
                : ['Uncategorized'];
          const csvCategoryIds: string[] = [];
          for (const cn of categoryNames) {
            csvCategoryIds.push(await ensureCategory(cn));
          }

          if (existingId && skipDuplicates) {
            if (csvCategoryIds.length > 0) {
              const existingLinks = await tx.menuItemCategory.findMany({
                where: { menuItemId: existingId },
                orderBy: { sortOrder: 'asc' },
                select: { categoryId: true },
              });
              const mergedIds = [
                ...existingLinks.map((l: { categoryId: string }) => l.categoryId),
              ];
              for (const id of csvCategoryIds) {
                if (!mergedIds.includes(id)) mergedIds.push(id);
              }
              const primaryCategoryId = mergedIds[0];
              if (primaryCategoryId) {
                await syncMenuItemCategoryLinks(tx, existingId, mergedIds);
                await tx.menuItem.update({
                  where: { id: existingId },
                  data: { categoryId: primaryCategoryId },
                });
              }
            }
            skippedProducts += 1;
            continue;
          }

          const primaryCategoryId =
            csvCategoryIds[0] ??
            (await ensureCategory('Uncategorized'));
          const categoryIds =
            csvCategoryIds.length > 0
              ? csvCategoryIds
              : [primaryCategoryId];

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

          if (!isNew) {
            if (row.ingredients.length > 0) {
              await attachIngredients(productId, row.name);
            }
            continue;
          }

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

          const productVariations = await tx.menuItemVariation.findMany({
            where: { menuItemId: productId },
            select: { id: true, name: true, title: true },
          });

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

            const productCategoryIds: string[] = [];
            if (sourceType === RecommendationSourceType.PRODUCT) {
              for (const catName of g.productCategoryNames ?? []) {
                const trimmed = catName.trim();
                if (!trimmed) continue;
                productCategoryIds.push(await ensureCategory(trimmed));
              }
              // Older CSVs omit productCategories — fall back to linked product's categories.
              if (productCategoryIds.length === 0 && linkedProductId) {
                const linked = await tx.menuItem.findFirst({
                  where: { id: linkedProductId, restaurantId },
                  select: {
                    categoryId: true,
                    categoryLinks: { select: { categoryId: true } },
                  },
                });
                if (linked) {
                  const ids = [
                    linked.categoryId,
                    ...linked.categoryLinks.map(
                      (l: { categoryId: string }) => l.categoryId
                    ),
                  ].filter(Boolean) as string[];
                  for (const id of ids) {
                    if (!productCategoryIds.includes(id)) {
                      productCategoryIds.push(id);
                    }
                  }
                }
              }
              if (productCategoryIds.length === 0 && g.linkedCategoryName) {
                productCategoryIds.push(
                  await ensureCategory(g.linkedCategoryName)
                );
              }
            }

            const matchedVariationLimits =
              selectionType === AttributeSelectionType.MULTIPLE
                ? (g.variationLimits ?? [])
                    .map((limit) => {
                      const key = limit.variationName.trim().toLowerCase();
                      const variation = productVariations.find((v: { title: string; name: string }) => {
                        const title = (v.title || '').trim().toLowerCase();
                        const name = (v.name || '').trim().toLowerCase();
                        return title === key || name === key;
                      });
                      if (!variation) return null;
                      return {
                        variationId: variation.id,
                        minItems: Math.max(0, limit.minItems),
                        maxItems: Math.max(
                          limit.minItems,
                          Math.max(0, limit.maxItems)
                        ),
                      };
                    })
                    .filter(
                      (
                        limitRow
                      ): limitRow is {
                        variationId: string;
                        minItems: number;
                        maxItems: number;
                      } => Boolean(limitRow)
                    )
                : [];

            const useVariationLimits = matchedVariationLimits.length > 0;
            let minItems: number | null;
            let maxItems: number | null;
            if (selectionType !== AttributeSelectionType.MULTIPLE) {
              minItems = 1;
              maxItems = 1;
            } else if (useVariationLimits) {
              minItems = null;
              maxItems = null;
            } else {
              minItems = g.minItems ?? 0;
              maxItems = Math.max(minItems, g.maxItems ?? Math.max(1, minItems));
            }

            const discount =
              sourceType === RecommendationSourceType.CATEGORY &&
              g.categoryDiscountPercent != null
                ? Math.min(100, Math.max(0, g.categoryDiscountPercent))
                : null;

            const extraCost =
              sourceType === RecommendationSourceType.CATEGORY &&
              g.categoryExtraCostPercent != null
                ? Math.min(500, Math.max(0, g.categoryExtraCostPercent))
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
                minItems,
                maxItems,
                categoryDiscountPercent: discount,
                categoryExtraCostPercent: extraCost,
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
                  sourceType === RecommendationSourceType.CATEGORY &&
                  defaultLinkedRestaurantVariationId != null
                    ? g.includeDefaultLinkedVariationPrice
                    : true,
                useVariationPricing: g.useVariationPricing,
                productCategoryIds:
                  sourceType === RecommendationSourceType.PRODUCT
                    ? productCategoryIds
                    : [],
                ...(useVariationLimits
                  ? {
                      variationLimits: {
                        create: matchedVariationLimits,
                      },
                    }
                  : {}),
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
          await attachIngredients(productId, row.name);
        }
    };

    // Pre-create ingredients once so product batches stay under the TX timeout.
    {
      const uniqueIngredientNames = new Set<string>();
      for (const row of parsed.products) {
        for (const line of row.ingredients) {
          const n = line.ingredientName.trim();
          if (n) uniqueIngredientNames.add(n);
        }
      }
      if (uniqueIngredientNames.size > 0) {
        await db.$transaction(
          async (tx) => {
            for (const ingredientName of uniqueIngredientNames) {
              const trimmed = ingredientName.trim();
              const key = trimmed.toLowerCase();
              const hit = ingredientByName.get(key);
              if (hit) {
                if (!hit.isActive) {
                  await tx.ingredient.update({
                    where: { id: hit.id },
                    data: { isActive: true },
                  });
                  hit.isActive = true;
                }
                continue;
              }
              try {
                const created = await tx.ingredient.create({
                  data: {
                    restaurantId,
                    name: trimmed,
                    quantity: 0,
                    unit: 'PCS',
                    isMajor: false,
                    isActive: true,
                  },
                  select: { id: true, name: true, isActive: true },
                });
                ingredientByName.set(created.name.trim().toLowerCase(), created);
                ingredientByName.set(key, created);
                createdIngredients += 1;
              } catch (e) {
                if (
                  e instanceof Prisma.PrismaClientKnownRequestError &&
                  e.code === 'P2002'
                ) {
                  const existing = await tx.ingredient.findFirst({
                    where: {
                      restaurantId,
                      name: { equals: trimmed, mode: 'insensitive' },
                    },
                    select: { id: true, name: true, isActive: true },
                  });
                  if (existing) {
                    ingredientByName.set(
                      existing.name.trim().toLowerCase(),
                      existing
                    );
                    ingredientByName.set(key, existing);
                  }
                } else {
                  throw e;
                }
              }
            }
          },
          TX_OPTIONS
        );
      }
    }

    for (let offset = 0; offset < productCount; offset += BATCH_SIZE) {
      const batch = parsed.products.slice(offset, offset + BATCH_SIZE);
      await db.$transaction(async (tx) => {
        await runBatch(tx, batch);
      }, TX_OPTIONS);
    }

    // Resolve recommendation product links after every product exists (same as offers).
    await db.$transaction(
      async (tx) => {
        for (const row of parsed.products) {
          const baseId = nameToId.get(row.name.trim().toLowerCase());
          if (!baseId || !createdProductIds.includes(baseId)) continue;
          if (row.recommendations.length === 0) continue;

          const groups = await tx.menuItemAttributeGroup.findMany({
            where: { menuItemId: baseId },
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              sortOrder: true,
              name: true,
              sourceType: true,
              linkedProductId: true,
              defaultLinkedMenuItemId: true,
              productCategoryIds: true,
            },
          });

          for (let i = 0; i < row.recommendations.length; i++) {
            const g = row.recommendations[i]!;
            const group =
              groups.find(
                (ag) =>
                  ag.sortOrder === g.sortOrder ||
                  ag.name.trim().toLowerCase() === g.name.trim().toLowerCase()
              ) ?? groups[i];
            if (!group) continue;

            const patch: {
              linkedProductId?: string | null;
              defaultLinkedMenuItemId?: string | null;
              productCategoryIds?: string[];
            } = {};

            if (
              g.sourceType === 'PRODUCT' &&
              g.linkedProductName &&
              !group.linkedProductId
            ) {
              const linkedId =
                nameToId.get(g.linkedProductName.trim().toLowerCase()) ?? null;
              if (linkedId) patch.linkedProductId = linkedId;
            }

            if (
              g.sourceType === 'CATEGORY' &&
              g.defaultLinkedMenuItemName &&
              !group.defaultLinkedMenuItemId
            ) {
              const defaultId =
                nameToId.get(
                  g.defaultLinkedMenuItemName.trim().toLowerCase()
                ) ?? null;
              if (defaultId) patch.defaultLinkedMenuItemId = defaultId;
            }

            if (
              g.sourceType === 'PRODUCT' &&
              (group.productCategoryIds?.length ?? 0) === 0
            ) {
              const linkedId =
                patch.linkedProductId ??
                group.linkedProductId ??
                (g.linkedProductName
                  ? nameToId.get(g.linkedProductName.trim().toLowerCase())
                  : null) ??
                null;
              if (linkedId) {
                const linked = await tx.menuItem.findFirst({
                  where: { id: linkedId, restaurantId },
                  select: {
                    categoryId: true,
                    categoryLinks: { select: { categoryId: true } },
                  },
                });
                if (linked) {
                  const ids = [
                    linked.categoryId,
                    ...linked.categoryLinks.map((l) => l.categoryId),
                  ].filter(Boolean) as string[];
                  if (ids.length > 0) patch.productCategoryIds = ids;
                }
              }
            }

            if (Object.keys(patch).length > 0) {
              await tx.menuItemAttributeGroup.update({
                where: { id: group.id },
                data: patch,
              });
            }
          }
        }
      },
      TX_OPTIONS
    );

    await db.$transaction(
      async (tx) => {
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
      },
      TX_OPTIONS
    );

    const result = {
      products: productCount,
      createdProducts,
      updatedProducts,
      skippedProducts,
      variations: variationsCount,
      recommendations: recommendationsCount,
      offers: offersCount,
      personalizeGroups: personalizeGroupsCount,
      personalizeOptions: personalizeOptionsCount,
      ingredients: ingredientsCount,
      createdIngredients,
      warnings: [...parsed.errors, ...extraWarnings].slice(0, 40),
      batches: Math.ceil(productCount / BATCH_SIZE),
    };

    if (result.createdIngredients > 0) {
      publishInventoryStockUpdate(auth.restaurant.id);
    }

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
