import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { attributeGroupInclude } from '@/lib/menu/attribute-group-include';
import { RECOMMENDATION_SOURCE_CATEGORY_WHERE } from '@/lib/menu/category-visibility';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';
import {
  getRestaurantPlanFeatures,
  subscriptionPlanDeniedResponse,
} from '@/lib/subscription-plan-enforcement';
import { recommendationGroupBodySchema } from '@/lib/validation/recommendation-group';
import { resolveRouteParams } from '@/lib/resolve-route-id';

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ groupId: string }> }
) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: 'recommendations',
    action: 'edit',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const planFeatures = await getRestaurantPlanFeatures(auth.restaurant.id);
  if (!planFeatures.recommendations) {
    return subscriptionPlanDeniedResponse(
      'Recommendation groups (add-on categories)'
    );
  }

  const { groupId } = await resolveRouteParams(ctx.params, ['groupId']);

  const group = await db.menuItemAttributeGroup.findFirst({
    where: { id: groupId },
    include: {
      menuItem: {
        include: { variations: { select: { id: true } } },
      },
    },
  });
  if (!group || group.menuItem.restaurantId !== auth.restaurant.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = recommendationGroupBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const isMultiple = data.selectionType === 'MULTIPLE';
  const itemId = group.menuItemId;
  const item = group.menuItem;

  if (data.sourceType === 'CATEGORY') {
    const linked = await db.menuCategory.findFirst({
      where: {
        id: data.linkedCategoryId!,
        restaurantId: auth.restaurant.id,
        ...RECOMMENDATION_SOURCE_CATEGORY_WHERE,
      },
    });
    if (!linked) {
      return NextResponse.json(
        {
          error:
            'Linked category must belong to your restaurant and contain at least one product.',
        },
        { status: 400 }
      );
    }
    const itemCategoryIds = await db.menuItemCategory.findMany({
      where: { menuItemId: itemId },
      select: { categoryId: true },
    });
    if (itemCategoryIds.some((row) => row.categoryId === linked.id)) {
      return NextResponse.json(
        {
          error:
            "Choose a different category than the product's own category for add-ons.",
        },
        { status: 400 }
      );
    }

    const duplicate = await db.menuItemAttributeGroup.findFirst({
      where: {
        menuItemId: itemId,
        linkedCategoryId: data.linkedCategoryId!,
        NOT: { id: groupId },
      },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: 'This category is already assigned as a recommendation.' },
        { status: 400 }
      );
    }

    if (data.defaultLinkedMenuItemId) {
      const defaultItem = await db.menuItemCategory.findFirst({
        where: {
          menuItemId: data.defaultLinkedMenuItemId,
          categoryId: data.linkedCategoryId!,
          menuItem: { restaurantId: auth.restaurant.id },
        },
        select: { menuItemId: true },
      });
      if (!defaultItem) {
        return NextResponse.json(
          {
            error:
              'Default item must be a product in the selected recommendation category.',
          },
          { status: 400 }
        );
      }
    }

    if (data.defaultLinkedRestaurantVariationId) {
      const variation = await db.restaurantVariation.findFirst({
        where: {
          id: data.defaultLinkedRestaurantVariationId,
          restaurantId: auth.restaurant.id,
        },
        select: { id: true },
      });
      if (!variation) {
        return NextResponse.json(
          { error: 'Default variation must belong to your restaurant.' },
          { status: 400 }
        );
      }
    }
  } else {
    const linkedProduct = await db.menuItem.findFirst({
      where: {
        id: data.linkedProductId!,
        restaurantId: auth.restaurant.id,
      },
    });
    if (!linkedProduct) {
      return NextResponse.json(
        { error: 'Linked product not found' },
        { status: 400 }
      );
    }
    if (linkedProduct.id === itemId) {
      return NextResponse.json(
        { error: 'Cannot recommend the same product as itself.' },
        { status: 400 }
      );
    }

    const duplicate = await db.menuItemAttributeGroup.findFirst({
      where: {
        menuItemId: itemId,
        linkedProductId: data.linkedProductId!,
        NOT: { id: groupId },
      },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: 'This product is already assigned as a recommendation.' },
        { status: 400 }
      );
    }

    const categoryCount = await db.menuCategory.count({
      where: {
        id: { in: data.productCategoryIds ?? [] },
        restaurantId: auth.restaurant.id,
        items: { some: {} },
      },
    });
    if (categoryCount !== (data.productCategoryIds?.length ?? 0)) {
      return NextResponse.json(
        { error: 'Each selected category must exist and have products.' },
        { status: 400 }
      );
    }
  }

  if (data.variationLimits?.length) {
    const variationIds = new Set(item.variations.map((v) => v.id));
    for (const row of data.variationLimits) {
      if (!variationIds.has(row.variationId)) {
        return NextResponse.json(
          { error: 'Variation limits must belong to this product.' },
          { status: 400 }
        );
      }
    }
  }

  const updated = await db.$transaction(async (tx) => {
    await tx.menuItemAttributeGroupVariationLimit.deleteMany({
      where: { groupId },
    });

    return tx.menuItemAttributeGroup.update({
      where: { id: groupId },
      data: {
        name: data.name.trim(),
        sourceType: data.sourceType,
        selectionType: data.selectionType,
        required: data.required ?? false,
        useVariationPricing: data.useVariationPricing ?? false,
        sortOrder: data.sortOrder ?? group.sortOrder,
        ...(data.sourceType === 'CATEGORY'
          ? {
              linkedCategoryId: data.linkedCategoryId!,
              defaultLinkedMenuItemId: data.defaultLinkedMenuItemId ?? null,
              defaultLinkedRestaurantVariationId:
                data.defaultLinkedRestaurantVariationId ?? null,
              includeDefaultLinkedVariationPrice:
                data.defaultLinkedRestaurantVariationId != null
                  ? (data.includeDefaultLinkedVariationPrice ?? true)
                  : true,
              categoryDiscountPercent: data.categoryDiscountPercent ?? null,
              categoryExtraCostPercent: data.categoryExtraCostPercent ?? null,
              productOverrides: data.productOverrides ?? {},
              productCategoryIds: [],
              linkedProductId: null,
            }
          : {
              linkedProductId: data.linkedProductId!,
              productCategoryIds: data.productCategoryIds ?? [],
              linkedCategoryId: null,
              defaultLinkedMenuItemId: null,
              defaultLinkedRestaurantVariationId: null,
              includeDefaultLinkedVariationPrice: true,
              categoryDiscountPercent: null,
              categoryExtraCostPercent: null,
              productOverrides: {},
            }),
        ...(isMultiple
          ? {
              multipleMode: data.multipleMode!,
              freeQuantity:
                data.multipleMode === 'QUANTITY'
                  ? data.freeQuantity === undefined
                    ? 0
                    : data.freeQuantity
                  : null,
              minItems: data.variationLimits?.length ? null : data.minItems!,
              maxItems: data.variationLimits?.length ? null : data.maxItems!,
              variationLimits: data.variationLimits?.length
                ? {
                    create: data.variationLimits.map((row) => ({
                      variationId: row.variationId,
                      minItems: row.minItems,
                      maxItems: row.maxItems,
                    })),
                  }
                : undefined,
            }
          : {
              minItems: 1,
              maxItems: 1,
              multipleMode: null,
              freeQuantity: null,
            }),
      },
      include: attributeGroupInclude,
    });
  });

  return NextResponse.json({ data: updated }, { status: 200 });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ groupId: string }> }
) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: 'recommendations',
    action: 'delete',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const planFeatures = await getRestaurantPlanFeatures(auth.restaurant.id);
  if (!planFeatures.recommendations) {
    return subscriptionPlanDeniedResponse('Recommendation groups (add-on categories)');
  }

  const { groupId } = await resolveRouteParams(ctx.params, ['groupId']);

  const group = await db.menuItemAttributeGroup.findFirst({
    where: { id: groupId },
    include: { menuItem: true },
  });
  if (!group || group.menuItem.restaurantId !== auth.restaurant.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await db.menuItemAttributeGroup.delete({ where: { id: groupId } });
  return NextResponse.json({ ok: true }, { status: 200 });
}
