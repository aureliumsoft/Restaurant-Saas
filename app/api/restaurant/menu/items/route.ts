import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { estimateDataUrlBytes, isAcceptedImageValue } from "@/lib/image-data-url";
import {
  syncMenuItemCategoryLinks,
  validateMenuItemCategoryIds,
} from "@/lib/menu/menu-item-categories";
import { syncMenuItemIngredients } from "@/lib/inventory/sync-recipe";
import { recipeRowSchema } from "@/lib/inventory/validation";
import { getRestaurantForOwnerRequest } from "@/lib/restaurant/ownerRestaurant";

const createSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(200),
    description: z.string().max(2000).optional().nullable(),
    categoryId: z.string().uuid().optional(),
    categoryIds: z.array(z.string().uuid()).min(1).optional(),
    imageUrl: z.string().max(2_800_000).optional().nullable().or(z.literal("")),
    price: z.number().positive(),
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

    const categoryIds =
      val.categoryIds ?? (val.categoryId ? [val.categoryId] : []);
    if (categoryIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Select at least one category",
        path: ["categoryIds"],
      });
    }
  });

export async function POST(req: NextRequest) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: "product",
    action: "edit",
  });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const requestedCategoryIds =
    parsed.data.categoryIds ??
    (parsed.data.categoryId ? [parsed.data.categoryId] : []);
  const categoryIds = await validateMenuItemCategoryIds(
    db,
    auth.restaurant.id,
    requestedCategoryIds
  );
  if (!categoryIds) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const imageUrl =
    parsed.data.imageUrl && parsed.data.imageUrl.length > 0 ? parsed.data.imageUrl : null;
  const description =
    parsed.data.description && parsed.data.description.length > 0
      ? parsed.data.description
      : null;
  const salePrice =
    parsed.data.salePrice != null && parsed.data.salePrice > 0
      ? parsed.data.salePrice
      : null;
  const variations = (parsed.data.variations ?? [])
    .map((v, idx) => ({
      name: v.name.trim(),
      title: v.name.trim(),
      restaurantVariationId: v.restaurantVariationId ?? null,
      imageUrl: v.imageUrl && v.imageUrl.length > 0 ? v.imageUrl : null,
      swatchHex: v.swatchHex && v.swatchHex.length > 0 ? v.swatchHex : null,
      priceDelta: Number.isFinite(v.priceDelta ?? 0) ? Number(v.priceDelta ?? 0) : 0,
      sortOrder: idx,
    }))
    .filter((v) => v.name.length > 0);

  try {
    const item = await db.$transaction(async (tx) => {
      const primaryCategoryId = categoryIds[0];
      const created = await tx.menuItem.create({
        data: {
          name: parsed.data.name.trim(),
          description,
          imageUrl,
          price: parsed.data.price,
          salePrice,
          categoryId: primaryCategoryId,
          restaurantId: auth.restaurant.id,
          variations:
            variations.length > 0
              ? {
                  create: variations,
                }
              : undefined,
        },
        include: {
          variations: { orderBy: { sortOrder: "asc" } },
        },
      });
      await syncMenuItemCategoryLinks(tx, created.id, categoryIds);
      await syncMenuItemIngredients(tx, {
        restaurantId: auth.restaurant.id,
        menuItemId: created.id,
        variations: created.variations.map((v) => ({
          id: v.id,
          restaurantVariationId: v.restaurantVariationId,
        })),
        recipes: parsed.data.ingredients ?? [],
      });
      return created;
    });
    return NextResponse.json(
      { data: { ...item, categoryIds } },
      { status: 201 }
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
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
