import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { estimateDataUrlBytes, isAcceptedImageValue } from "@/lib/image-data-url";
import { getRestaurantForOwnerRequest } from "@/lib/restaurant/ownerRestaurant";

const patchSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional().nullable(),
    categoryId: z.string().uuid().optional(),
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

  if (parsed.data.categoryId) {
    const cat = await db.menuCategory.findFirst({
      where: { id: parsed.data.categoryId, restaurantId: auth.restaurant.id },
    });
    if (!cat) {
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

  const updated = await db.menuItem.update({
    where: { id: itemId },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(parsed.data.categoryId !== undefined ? { categoryId: parsed.data.categoryId } : {}),
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

  return NextResponse.json({ data: updated }, { status: 200 });
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
  });
  if (!existing) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  await db.menuItem.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true }, { status: 200 });
}
