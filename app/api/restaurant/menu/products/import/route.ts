import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { parseProductsExcelImport } from '@/lib/menu/import-products-excel';
import { syncMenuItemCategoryLinks } from '@/lib/menu/menu-item-categories';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';
import {
  getRestaurantPlanFeatures,
  subscriptionPlanDeniedResponse,
} from '@/lib/subscription-plan-enforcement';

export const runtime = 'nodejs';

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

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
    return NextResponse.json({ error: 'Excel file is required' }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return NextResponse.json(
      { error: 'Only .xlsx files are supported' },
      { status: 400 }
    );
  }

  const plan = await getRestaurantPlanFeatures(auth.restaurant.id);
  if (!plan.recommendations) {
    return subscriptionPlanDeniedResponse(
      'Product recommendations and personalize import'
    );
  }

  try {
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseProductsExcelImport(fileBuffer);
    if (parsed.errors.length > 0) {
      return NextResponse.json(
        {
          error: 'Import file has invalid rows',
          details: parsed.errors.slice(0, 30),
        },
        { status: 400 }
      );
    }
    if (parsed.products.length === 0) {
      return NextResponse.json(
        { error: 'Products sheet has no valid rows' },
        { status: 400 }
      );
    }

    const productIds = parsed.products.map((p) => p.id);

    const existingById = await db.menuItem.findMany({
      where: { id: { in: productIds } },
      select: { id: true, restaurantId: true },
    });
    const foreignOwned = existingById.filter(
      (row) => row.restaurantId !== auth.restaurant.id
    );
    if (foreignOwned.length > 0) {
      return NextResponse.json(
        { error: 'Some product ids belong to another restaurant' },
        { status: 400 }
      );
    }

    const linkedProductIds = unique(
      [
        ...parsed.recommendations
          .map((r) => r.linkedProductId)
          .filter((v): v is string => Boolean(v)),
        ...parsed.recommendations
          .map((r) => r.defaultLinkedMenuItemId)
          .filter((v): v is string => Boolean(v)),
        ...parsed.offers.map((o) => o.offeredProductId),
      ].filter((id) => !productIds.includes(id))
    );
    if (linkedProductIds.length > 0) {
      const linkedProducts = await db.menuItem.count({
        where: { id: { in: linkedProductIds }, restaurantId: auth.restaurant.id },
      });
      if (linkedProducts !== linkedProductIds.length) {
        return NextResponse.json(
          { error: 'Import references linked products outside this restaurant' },
          { status: 400 }
        );
      }
    }

    const result = await db.$transaction(async (tx) => {
      // Resolve category ids from file. If an id is missing in this restaurant,
      // fall back to category name and auto-create when needed.
      const existingCategories = await tx.menuCategory.findMany({
        where: { restaurantId: auth.restaurant.id },
        select: { id: true, name: true, sortOrder: true },
        orderBy: [{ sortOrder: 'desc' }, { createdAt: 'desc' }],
      });
      const categoryById = new Map(existingCategories.map((c) => [c.id, c]));
      const categoryIdByName = new Map(
        existingCategories.map((c) => [c.name.trim().toLowerCase(), c.id])
      );
      const resolvedCategoryIdByInputId = new Map<string, string>();
      let nextSortOrder =
        existingCategories.length > 0
          ? Math.max(...existingCategories.map((c) => c.sortOrder)) + 1
          : 0;

      const ensureCategoryId = async ({
        categoryId,
        categoryName,
      }: {
        categoryId: string | null | undefined;
        categoryName: string | null | undefined;
      }): Promise<string> => {
        if (categoryId && resolvedCategoryIdByInputId.has(categoryId)) {
          return resolvedCategoryIdByInputId.get(categoryId)!;
        }
        if (categoryId && categoryById.has(categoryId)) {
          resolvedCategoryIdByInputId.set(categoryId, categoryId);
          return categoryId;
        }
        if (categoryId && !categoryById.has(categoryId)) {
          const safeName = categoryName?.trim() || `Imported Category ${categoryId.slice(0, 8)}`;
          const existingId = categoryIdByName.get(safeName.toLowerCase());
          if (existingId) {
            resolvedCategoryIdByInputId.set(categoryId, existingId);
            return existingId;
          }
          const created = await tx.menuCategory.create({
            data: {
              id: categoryId,
              name: safeName,
              restaurantId: auth.restaurant.id,
              sortOrder: nextSortOrder++,
            },
            select: { id: true, name: true, sortOrder: true },
          });
          categoryById.set(created.id, created);
          categoryIdByName.set(created.name.trim().toLowerCase(), created.id);
          resolvedCategoryIdByInputId.set(categoryId, created.id);
          return created.id;
        }
        const safeName = categoryName?.trim() || '';
        if (!safeName) {
          throw new Error(
            'Import references category ids not found in this restaurant and no category name fallback was provided'
          );
        }
        const existingId = categoryIdByName.get(safeName.toLowerCase());
        if (existingId) return existingId;
        const created = await tx.menuCategory.create({
          data: {
            name: safeName,
            restaurantId: auth.restaurant.id,
            sortOrder: nextSortOrder++,
          },
          select: { id: true, name: true, sortOrder: true },
        });
        categoryById.set(created.id, created);
        categoryIdByName.set(created.name.trim().toLowerCase(), created.id);
        return created.id;
      };

      for (const row of parsed.products) {
        row.primaryCategoryId = await ensureCategoryId({
          categoryId: row.primaryCategoryId,
          categoryName: row.primaryCategoryName,
        });
      }
      for (const row of parsed.categoryLinks) {
        row.categoryId = await ensureCategoryId({
          categoryId: row.categoryId,
          categoryName: row.categoryName,
        });
      }
      for (const row of parsed.recommendations) {
        if (row.sourceType === 'CATEGORY') {
          row.linkedCategoryId = await ensureCategoryId({
            categoryId: row.linkedCategoryId,
            categoryName: row.linkedCategoryName,
          });
        }
        const nextProductCategoryIds: string[] = [];
        for (const categoryId of row.productCategoryIds) {
          const resolvedCategoryId = await ensureCategoryId({
            categoryId,
            categoryName: null,
          });
          nextProductCategoryIds.push(resolvedCategoryId);
        }
        row.productCategoryIds = nextProductCategoryIds;
      }

      // Ensure all referenced restaurant variation ids exist for this restaurant.
      // If a variation id from Excel does not exist here, create it with the same id.
      const allRestaurantVariationIds = unique(
        [
          ...parsed.variations.map((v) => v.restaurantVariationId),
          ...parsed.recommendations.map(
            (r) => r.defaultLinkedRestaurantVariationId
          ),
        ].filter((v): v is string => Boolean(v))
      );
      if (allRestaurantVariationIds.length > 0) {
        const existingRestaurantVariations = await tx.restaurantVariation.findMany({
          where: {
            id: { in: allRestaurantVariationIds },
            restaurantId: auth.restaurant.id,
          },
          select: { id: true },
        });
        const existingVariationIds = new Set(
          existingRestaurantVariations.map((row) => row.id)
        );
        const restaurantVariationNames = new Set(
          (
            await tx.restaurantVariation.findMany({
              where: { restaurantId: auth.restaurant.id },
              select: { name: true },
            })
          ).map((row) => row.name.toLowerCase())
        );
        let nextVariationSortOrder =
          (
            await tx.restaurantVariation.aggregate({
              where: { restaurantId: auth.restaurant.id },
              _max: { sortOrder: true },
            })
          )._max.sortOrder ?? 0;

        for (const variationId of allRestaurantVariationIds) {
          if (existingVariationIds.has(variationId)) continue;
          nextVariationSortOrder += 1;
          const baseName = `Imported Variation ${variationId.slice(0, 8)}`;
          let safeName = baseName;
          let suffix = 2;
          while (restaurantVariationNames.has(safeName.toLowerCase())) {
            safeName = `${baseName} ${suffix}`;
            suffix += 1;
          }
          await tx.restaurantVariation.create({
            data: {
              id: variationId,
              restaurantId: auth.restaurant.id,
              name: safeName,
              shortLabel: null,
              sortOrder: nextVariationSortOrder,
            },
          });
          restaurantVariationNames.add(safeName.toLowerCase());
          existingVariationIds.add(variationId);
        }
      }

      let createdProducts = 0;
      let updatedProducts = 0;

      for (const row of parsed.products) {
        const exists = existingById.find((v) => v.id === row.id);
        if (exists) updatedProducts += 1;
        else createdProducts += 1;
        await tx.menuItem.upsert({
          where: { id: row.id },
          update: {
            name: row.name,
            description: row.description,
            imageKey: row.imageKey,
            imageUrl: row.imageUrl,
            price: row.price,
            salePrice: row.salePrice,
            categoryId: row.primaryCategoryId!,
          },
          create: {
            id: row.id,
            restaurantId: auth.restaurant.id,
            name: row.name,
            description: row.description,
            imageKey: row.imageKey,
            imageUrl: row.imageUrl,
            price: row.price,
            salePrice: row.salePrice,
            categoryId: row.primaryCategoryId!,
          },
        });
      }

      await tx.menuItemVariation.deleteMany({
        where: { menuItemId: { in: productIds } },
      });
      await tx.menuItemAttributeGroup.deleteMany({
        where: { menuItemId: { in: productIds } },
      });
      await tx.menuItemOffer.deleteMany({
        where: { baseItemId: { in: productIds } },
      });
      await tx.menuItemPersonalizeGroup.deleteMany({
        where: { menuItemId: { in: productIds } },
      });

      for (const productId of productIds) {
        const links = parsed.categoryLinks
          .filter((row) => row.productId === productId)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const linkIds = unique(
          links
            .map((l) => l.categoryId)
            .filter((v): v is string => Boolean(v))
        );
        const primary =
          parsed.products.find((p) => p.id === productId)?.primaryCategoryId ?? null;
        const finalCategoryIds = unique(
          [...linkIds, ...(primary ? [primary] : [])].filter(Boolean)
        );
        if (finalCategoryIds.length === 0) {
          throw new Error(`No category found for product ${productId}`);
        }
        const primaryCategoryId = await syncMenuItemCategoryLinks(
          tx,
          productId,
          finalCategoryIds
        );
        await tx.menuItem.update({
          where: { id: productId },
          data: { categoryId: primaryCategoryId },
        });
      }

      if (parsed.variations.length > 0) {
        await tx.menuItemVariation.createMany({
          data: parsed.variations
            .filter((row) => productIds.includes(row.productId))
            .map((row) => ({
              id: row.id,
              menuItemId: row.productId,
              name: row.name,
              title: row.title,
              imageKey: row.imageKey,
              imageUrl: row.imageUrl,
              swatchHex: row.swatchHex,
              sortOrder: row.sortOrder,
              priceDelta: row.priceDelta,
              restaurantVariationId: row.restaurantVariationId,
            })),
        });
      }

      const groupIdSet = new Set<string>();
      for (const row of parsed.recommendations) {
        if (!productIds.includes(row.productId)) continue;
        groupIdSet.add(row.id);
        await tx.menuItemAttributeGroup.create({
          data: {
            id: row.id,
            menuItemId: row.productId,
            name: row.groupName,
            sortOrder: row.sortOrder,
            selectionType: row.selectionType,
            required: row.required,
            sourceType: row.sourceType,
            multipleMode: row.selectionType === 'MULTIPLE' ? row.multipleMode : null,
            freeQuantity:
              row.selectionType === 'MULTIPLE' &&
              row.multipleMode === 'QUANTITY'
                ? (row.freeQuantity ?? 0)
                : null,
            minItems:
              row.selectionType === 'MULTIPLE' ? (row.minItems ?? 0) : 1,
            maxItems:
              row.selectionType === 'MULTIPLE' ? (row.maxItems ?? 1) : 1,
            linkedCategoryId:
              row.sourceType === 'CATEGORY' ? row.linkedCategoryId : null,
            linkedProductId:
              row.sourceType === 'PRODUCT' ? row.linkedProductId : null,
            defaultLinkedMenuItemId:
              row.sourceType === 'CATEGORY' ? row.defaultLinkedMenuItemId : null,
            defaultLinkedRestaurantVariationId:
              row.sourceType === 'CATEGORY'
                ? row.defaultLinkedRestaurantVariationId
                : null,
            includeDefaultLinkedVariationPrice:
              row.sourceType === 'CATEGORY'
                ? row.includeDefaultLinkedVariationPrice
                : true,
            productCategoryIds:
              row.sourceType === 'PRODUCT' ? row.productCategoryIds : [],
            useVariationPricing: row.useVariationPricing,
          },
        });
      }

      if (parsed.recommendationLimits.length > 0) {
        await tx.menuItemAttributeGroupVariationLimit.createMany({
          data: parsed.recommendationLimits
            .filter((row) => groupIdSet.has(row.groupId))
            .map((row) => ({
              id: row.id,
              groupId: row.groupId,
              variationId: row.variationId,
              minItems: row.minItems,
              maxItems: row.maxItems,
            })),
        });
      }

      if (parsed.offers.length > 0) {
        await tx.menuItemOffer.createMany({
          data: parsed.offers
            .filter((row) => productIds.includes(row.baseProductId))
            .map((row) => ({
              id: row.id,
              baseItemId: row.baseProductId,
              offeredItemId: row.offeredProductId,
              sortOrder: row.sortOrder,
            })),
        });
      }

      const personalizeGroupMap = new Set<string>();
      for (const row of parsed.personalizeGroups) {
        if (!productIds.includes(row.productId)) continue;
        personalizeGroupMap.add(row.id);
        await tx.menuItemPersonalizeGroup.create({
          data: {
            id: row.id,
            menuItemId: row.productId,
            parentName: row.parentName,
            maxItems: row.maxItems,
            sortOrder: row.sortOrder,
          },
        });
      }

      if (parsed.personalizeOptions.length > 0) {
        await tx.menuItemPersonalizeOption.createMany({
          data: parsed.personalizeOptions
            .filter((row) => personalizeGroupMap.has(row.groupId))
            .map((row) => ({
              id: row.id,
              groupId: row.groupId,
              name: row.name,
              sortOrder: row.sortOrder,
              imageUrl: row.imageUrl,
            })),
        });
      }

      // Optional photo override sheet (applied last).
      for (const row of parsed.photos) {
        if (!productIds.includes(row.productId)) continue;
        if (row.sourceType === 'product') {
          await tx.menuItem.updateMany({
            where: { id: row.entityId, restaurantId: auth.restaurant.id },
            data: { imageKey: row.imageKey, imageUrl: row.imageUrl },
          });
        } else if (row.sourceType === 'variation') {
          await tx.menuItemVariation.updateMany({
            where: {
              id: row.entityId,
              menuItem: { restaurantId: auth.restaurant.id },
            },
            data: { imageKey: row.imageKey, imageUrl: row.imageUrl },
          });
        } else if (row.sourceType === 'personalize_option') {
          await tx.menuItemPersonalizeOption.updateMany({
            where: {
              id: row.entityId,
              group: { menuItem: { restaurantId: auth.restaurant.id } },
            },
            data: { imageUrl: row.imageUrl },
          });
        }
      }

      return {
        createdProducts,
        updatedProducts,
        products: parsed.products.length,
        variations: parsed.variations.length,
        recommendations: parsed.recommendations.length,
        recommendationLimits: parsed.recommendationLimits.length,
        offers: parsed.offers.length,
        personalizeGroups: parsed.personalizeGroups.length,
        personalizeOptions: parsed.personalizeOptions.length,
        photos: parsed.photos.length,
      };
    }, {
      // Import can run many sequential writes; prevent interactive tx auto-close.
      maxWait: 20_000,
      timeout: 180_000,
    });

    return NextResponse.json(
      {
        data: result,
        message: 'Products imported successfully',
      },
      { status: 200 }
    );
  } catch (e) {
    console.error('Products Excel import failed:', e);
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : 'Could not import products from Excel',
      },
      { status: 500 }
    );
  }
}
