import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getRestaurantForOwnerRequest } from "@/lib/restaurant/ownerRestaurant";
import { getRestaurantPlanFeatures, subscriptionPlanDeniedResponse } from "@/lib/subscription-plan-enforcement";
import { resolveRouteParams } from '@/lib/resolve-route-id';

const createDealSchema = z.object({
  dealItemId: z.string().uuid(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ itemId: string }> }
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
    return subscriptionPlanDeniedResponse("Product recommendations and add-on offers");
  }

  const { itemId } = await resolveRouteParams(ctx.params, ['itemId']);

  const baseItem = await db.menuItem.findFirst({
    where: { id: itemId, restaurantId: auth.restaurant.id },
  });
  if (!baseItem) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createDealSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const dealItem = await db.menuItem.findFirst({
    where: {
      id: parsed.data.dealItemId,
      restaurantId: auth.restaurant.id,
    },
  });
  if (!dealItem) {
    return NextResponse.json(
      { error: "Deal product must belong to your restaurant" },
      { status: 400 }
    );
  }

  if (dealItem.id === baseItem.id) {
    return NextResponse.json(
      { error: "Deal product must differ from the base product." },
      { status: 400 }
    );
  }

  const deal = await db.menuItemDeal.create({
    data: {
      baseItemId: baseItem.id,
      dealItemId: dealItem.id,
      sortOrder: parsed.data.sortOrder ?? 0,
    },
    include: {
      dealItem: {
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
  });

  return NextResponse.json({ data: deal }, { status: 201 });
}
