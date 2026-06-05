import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getRestaurantForOwnerRequest } from "@/lib/restaurant/ownerRestaurant";
import { menuCategoryPatchSchema } from "@/lib/validation/menu";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ categoryId: string }> }
) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: "categories",
    action: "edit",
  });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { categoryId } = await ctx.params;

  const existing = await db.menuCategory.findFirst({
    where: { id: categoryId, restaurantId: auth.restaurant.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = menuCategoryPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await db.menuCategory.update({
    where: { id: categoryId },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.showInFront !== undefined
        ? { showInFront: parsed.data.showInFront }
        : {}),
    },
  });

  return NextResponse.json({ data: updated }, { status: 200 });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ categoryId: string }> }
) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: "categories",
    action: "delete",
  });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { categoryId } = await ctx.params;

  const existing = await db.menuCategory.findFirst({
    where: { id: categoryId, restaurantId: auth.restaurant.id },
    include: { _count: { select: { items: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  if (existing._count.items > 0) {
    return NextResponse.json(
      { error: "Remove or move products from this category before deleting it." },
      { status: 400 }
    );
  }

  const used = await db.menuItemAttributeGroup.count({
    where: { linkedCategoryId: categoryId },
  });
  if (used > 0) {
    return NextResponse.json(
      {
        error:
          "This category is used as an add-on source on one or more products. Remove those recommendation rules first.",
      },
      { status: 400 }
    );
  }

  await db.menuCategory.delete({ where: { id: categoryId } });
  return NextResponse.json({ ok: true }, { status: 200 });
}
