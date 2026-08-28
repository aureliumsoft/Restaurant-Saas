import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { estimateDataUrlBytes, isAcceptedImageValue } from "@/lib/image-data-url";
import {
  getMenuItemCategoryIds,
  syncMenuItemCategoryLinks,
  validateMenuItemCategoryIds,
} from "@/lib/menu/menu-item-categories";
import { getRestaurantForOwnerRequest } from "@/lib/restaurant/ownerRestaurant";
import { syncMenuItemIngredients } from "@/lib/inventory/sync-recipe";
import { recipeRowSchema } from "@/lib/inventory/validation";
import {
  buildCustomerMenuAttributeGroupsSelect,
  customerMenuItemCoreSelect,
  customerMenuLinkedItemCoreSelect,
} from "@/lib/menu/customer-menu-attribute-groups-select";
import { personalizeGroupsSelect } from "@/lib/menu/personalize-groups-select";
import {
  restaurantMenuItemImageUrl,
} from "@/lib/menu/menu-item-image-utils";

const detailSelect = {
  ...customerMenuItemCoreSelect,
  categoryId: true,
  createdAt: true,
  updatedAt: true,
  attributeGroups: buildCustomerMenuAttributeGroupsSelect(2),
  personalizeGroups: personalizeGroupsSelect,
  offersFromThis: {
    orderBy: { sortOrder: "asc" as const },
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
  ingredientRecipes: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      quantity: true,
      menuItemVariationId: true,
      ingredientId: true,
      ingredient: {
        select: { id: true, name: true, unit: true, quantity: true, isMajor: true },
      },
      variation: {
        select: { id: true, restaurantVariationId: true, name: true },
      },
    },
  },
} as const;

/** POS customize: shallow nests for fast first paint (nested sheets hydrate on demand). */
const liteDetailSelect = {
  ...customerMenuLinkedItemCoreSelect,
  categoryId: true,
  createdAt: true,
  updatedAt: true,
  attributeGroups: buildCustomerMenuAttributeGroupsSelect(1),
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
          price: true,
          salePrice: true,
        },
      },
    },
  },
} as const;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ itemId: string }> }
) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKeys: ["product", "pos", "recommendations"],
    action: "access",
  });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { itemId } = await ctx.params;
  const lite = req.nextUrl.searchParams.get("lite") === "1";
  const item = await db.menuItem.findFirst({
    where: { id: itemId, restaurantId: auth.restaurant.id },
    select: lite ? liteDetailSelect : detailSelect,
  });
  if (!item) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  if (lite) {
    // Skip extra category/image round-trips — POS uses lazy /image URLs and categoryId.
    return NextResponse.json(
      {
        data: {
          ...item,
          hasImage: true,
          imageUrl: restaurantMenuItemImageUrl(itemId),
          categoryIds: [item.categoryId],
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
          offersFromThis: (item.offersFromThis ?? []).map((row) => {
            const oid = row.offeredItem?.id;
            if (!oid || !row.offeredItem) return row;
            return {
              ...row,
              offeredItem: {
                ...row.offeredItem,
                hasImage: true,
                imageUrl: restaurantMenuItemImageUrl(oid),
              },
            };
          }),
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
        },
      }
    );
  }

  const categoryIds = await getMenuItemCategoryIds(itemId);

  return NextResponse.json(
    {
      data: {
        ...item,
        categoryIds:
          categoryIds.length > 0 ? categoryIds : [item.categoryId],
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      },
    },
    { status: 200 }
  );
}

const patchSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional().nullable(),
    categoryId: z.string().uuid().optional(),
    categoryIds: z.array(z.string().uuid()).min(1).optional(),
    imageUrl: z.string().max(2_800_000).optional().nullable().or(z.literal("")),
    price: z.number().positive().optional(),
    salePrice: z.number().positive().optional().nullable(),
    variations: z
      .array(
        z.object({
          name: z.string().min(1).max(120),
          restaurantVariationId: z.string().uuid().optional().nullable(),
          imageUrl: z.string().max(2_800_000).optional().nullable().or(z.literal("")),
          swatchHex: z
            .string()
            .regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/)
            .optional()
            .nullable()
            .or(z.literal("")),
          priceDelta: z.number().finite().optional(),
        })
      )
      .max(50)
      .optional(),
    ingredients: z.array(recipeRowSchema).max(200).optional(),
  })
  .superRefine((val, ctx) => {
    const check = (label: string, v: string | null | undefined, path: (string | number)[]) => {
      if (!v || !v.trim()) return;
      if (!isAcceptedImageValue(v)) {
        ctx.addIssue({
          code: "custom",
          message: `${label} must be an http/https URL or base64 image`,
          path,
        });
        return;
      }
      if (v.startsWith("data:image/") && estimateDataUrlBytes(v) > 2 * 1024 * 1024) {
        ctx.addIssue({
          code: "custom",
          message: `${label} base64 image must be <= 2MB`,
          path,
        });
      }
    };
    check("Image", val.imageUrl, ["imageUrl"]);
    (val.variations ?? []).forEach((v, i) => check("Variation image", v.imageUrl, ["variations", i, "imageUrl"]));
  });

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ itemId: string }> }
) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: "product",
    action: "edit",
  });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { itemId } = await ctx.params;

  const existing = await db.menuItem.findFirst({
    where: { id: itemId, restaurantId: auth.restaurant.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
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

  const requestedCategoryIds =
    parsed.data.categoryIds ??
    (parsed.data.categoryId ? [parsed.data.categoryId] : null);
  let categoryIds: string[] | null = null;
  if (requestedCategoryIds) {
    categoryIds = await validateMenuItemCategoryIds(
      db,
      auth.restaurant.id,
      requestedCategoryIds
    );
    if (!categoryIds) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
  }

  const imageUrl =
    parsed.data.imageUrl !== undefined
      ? parsed.data.imageUrl && parsed.data.imageUrl.length > 0
        ? parsed.data.imageUrl
        : null
      : undefined;

  const description =
    parsed.data.description !== undefined
      ? parsed.data.description && parsed.data.description.length > 0
        ? parsed.data.description
        : null
      : undefined;

  const salePrice =
    parsed.data.salePrice !== undefined
      ? parsed.data.salePrice != null && parsed.data.salePrice > 0
        ? parsed.data.salePrice
        : null
      : undefined;
  const variations =
    parsed.data.variations !== undefined
      ? parsed.data.variations
          .map((v, idx) => ({
            name: v.name.trim(),
            title: v.name.trim(),
            restaurantVariationId: v.restaurantVariationId ?? null,
            imageUrl: v.imageUrl && v.imageUrl.length > 0 ? v.imageUrl : null,
            swatchHex: v.swatchHex && v.swatchHex.length > 0 ? v.swatchHex : null,
            priceDelta: Number.isFinite(v.priceDelta ?? 0) ? Number(v.priceDelta ?? 0) : 0,
            sortOrder: idx,
          }))
          .filter((v) => v.name.length > 0)
      : undefined;

  try {
    const updated = await db.$transaction(async (tx) => {
      const primaryCategoryId = categoryIds?.[0];
      const item = await tx.menuItem.update({
        where: { id: itemId },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(primaryCategoryId !== undefined ? { categoryId: primaryCategoryId } : {}),
          ...(imageUrl !== undefined ? { imageUrl } : {}),
          ...(parsed.data.price !== undefined ? { price: parsed.data.price } : {}),
          ...(salePrice !== undefined ? { salePrice } : {}),
          ...(variations !== undefined
            ? {
                variations: {
                  deleteMany: {},
                  ...(variations.length > 0 ? { create: variations } : {}),
                },
              }
            : {}),
        },
        include: {
          variations: { orderBy: { sortOrder: "asc" } },
        },
      });

      if (categoryIds) {
        await syncMenuItemCategoryLinks(tx, itemId, categoryIds);
      }

      if (parsed.data.ingredients !== undefined) {
        await syncMenuItemIngredients(tx, {
          restaurantId: auth.restaurant.id,
          menuItemId: itemId,
          variations: item.variations.map((v) => ({
            id: v.id,
            restaurantVariationId: v.restaurantVariationId,
          })),
          recipes: parsed.data.ingredients,
        });
      }

      return item;
    });

    const resolvedCategoryIds =
      categoryIds ?? (await getMenuItemCategoryIds(itemId));

    return NextResponse.json(
      { data: { ...updated, categoryIds: resolvedCategoryIds } },
      { status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (
      msg.includes('ingredient') ||
      msg.includes('variation') ||
      msg.includes('Duplicate')
    ) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ itemId: string }> }
) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: "product",
    action: "delete",
  });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { itemId } = await ctx.params;

  const existing = await db.menuItem.findFirst({
    where: { id: itemId, restaurantId: auth.restaurant.id },
    select: { id: true, name: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "OrderItem"
      SET "productName" = ${existing.name}
      WHERE "menuItemId" = ${itemId}
        AND ("productName" IS NULL OR "productName" = '')
    `;
    await tx.menuItem.delete({ where: { id: itemId } });
  });
  return NextResponse.json({ ok: true }, { status: 200 });
}
