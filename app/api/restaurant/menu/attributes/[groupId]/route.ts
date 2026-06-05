import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { attributeGroupInclude } from "@/lib/menu/attribute-group-include";
import { RECOMMENDATION_SOURCE_CATEGORY_WHERE } from "@/lib/menu/category-visibility";
import { getRestaurantForOwnerRequest } from "@/lib/restaurant/ownerRestaurant";
import { getRestaurantPlanFeatures, subscriptionPlanDeniedResponse } from "@/lib/subscription-plan-enforcement";

const patchSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    selectionType: z.enum(["SINGLE", "MULTIPLE"]).optional(),
    required: z.boolean().optional(),
    linkedCategoryId: z.string().uuid().optional(),
    defaultLinkedMenuItemId: z.string().uuid().nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
    minItems: z.number().int().min(0).nullable().optional(),
    maxItems: z.number().int().min(1).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.selectionType === "MULTIPLE") {
      if (data.minItems === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "minItems is required when setting selection type to MULTIPLE",
          path: ["minItems"],
        });
      }
      if (data.maxItems === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "maxItems is required when setting selection type to MULTIPLE",
          path: ["maxItems"],
        });
      }
    }
    if (
      data.minItems != null &&
      data.maxItems != null &&
      data.maxItems < data.minItems
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "maxItems must be greater than or equal to minItems",
        path: ["maxItems"],
      });
    }
  });

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ groupId: string }> }
) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: "recommendations",
    action: "edit",
  });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const planFeatures = await getRestaurantPlanFeatures(auth.restaurant.id);
  if (!planFeatures.recommendations) {
    return subscriptionPlanDeniedResponse("Recommendation groups (add-on categories)");
  }

  const { groupId } = await ctx.params;

  const group = await db.menuItemAttributeGroup.findFirst({
    where: { id: groupId },
    include: { menuItem: true },
  });
  if (!group || group.menuItem.restaurantId !== auth.restaurant.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.linkedCategoryId) {
    const linked = await db.menuCategory.findFirst({
      where: {
        id: parsed.data.linkedCategoryId,
        restaurantId: auth.restaurant.id,
        ...RECOMMENDATION_SOURCE_CATEGORY_WHERE,
      },
    });
    if (!linked) {
      return NextResponse.json(
        {
          error:
            "Linked category must belong to your restaurant and contain at least one product.",
        },
        { status: 400 }
      );
    }
    if (linked.id === group.menuItem.categoryId) {
      return NextResponse.json(
        { error: "Add-on category must differ from the product category." },
        { status: 400 }
      );
    }
  }

  const categoryIdForDefault =
    parsed.data.linkedCategoryId ?? group.linkedCategoryId;
  if (parsed.data.defaultLinkedMenuItemId !== undefined) {
    if (parsed.data.defaultLinkedMenuItemId === null) {
      return NextResponse.json(
        { error: "Category recommendations require a default item." },
        { status: 400 }
      );
    }
    if (!categoryIdForDefault) {
      return NextResponse.json(
        { error: "Link a category before setting a default item." },
        { status: 400 }
      );
    }
    const defaultItem = await db.menuItem.findFirst({
      where: {
        id: parsed.data.defaultLinkedMenuItemId,
        categoryId: categoryIdForDefault,
        restaurantId: auth.restaurant.id,
      },
      select: { id: true },
    });
    if (!defaultItem) {
      return NextResponse.json(
        {
          error:
            "Default item must be a product in the linked recommendation category.",
        },
        { status: 400 }
      );
    }
  }

  const nextSelectionType = parsed.data.selectionType ?? group.selectionType;
  const clearMinMax =
    parsed.data.selectionType === "SINGLE" ||
    (parsed.data.selectionType === undefined &&
      nextSelectionType === "SINGLE" &&
      parsed.data.minItems === undefined &&
      parsed.data.maxItems === undefined);

  const updated = await db.menuItemAttributeGroup.update({
    where: { id: groupId },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.selectionType !== undefined ? { selectionType: parsed.data.selectionType } : {}),
      ...(parsed.data.required !== undefined ? { required: parsed.data.required } : {}),
      ...(parsed.data.linkedCategoryId !== undefined
        ? { linkedCategoryId: parsed.data.linkedCategoryId }
        : {}),
      ...(parsed.data.defaultLinkedMenuItemId !== undefined
        ? { defaultLinkedMenuItemId: parsed.data.defaultLinkedMenuItemId }
        : {}),
      ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
      ...(parsed.data.minItems !== undefined ? { minItems: parsed.data.minItems } : {}),
      ...(parsed.data.maxItems !== undefined ? { maxItems: parsed.data.maxItems } : {}),
      ...(clearMinMax ? { minItems: null, maxItems: null } : {}),
    },
    include: attributeGroupInclude,
  });

  return NextResponse.json({ data: updated }, { status: 200 });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ groupId: string }> }
) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: "recommendations",
    action: "delete",
  });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const planFeatures = await getRestaurantPlanFeatures(auth.restaurant.id);
  if (!planFeatures.recommendations) {
    return subscriptionPlanDeniedResponse("Recommendation groups (add-on categories)");
  }

  const { groupId } = await ctx.params;

  const group = await db.menuItemAttributeGroup.findFirst({
    where: { id: groupId },
    include: { menuItem: true },
  });
  if (!group || group.menuItem.restaurantId !== auth.restaurant.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.menuItemAttributeGroup.delete({ where: { id: groupId } });
  return NextResponse.json({ ok: true }, { status: 200 });
}
