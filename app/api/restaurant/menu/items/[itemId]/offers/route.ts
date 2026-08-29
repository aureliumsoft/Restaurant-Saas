import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getRestaurantForOwnerRequest } from "@/lib/restaurant/ownerRestaurant";
import { getRestaurantPlanFeatures, subscriptionPlanDeniedResponse } from "@/lib/subscription-plan-enforcement";
import { resolveRouteParams } from '@/lib/resolve-route-id';

const createOfferSchema = z.object({
  offeredItemId: z.string().uuid(),
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

  const parsed = createOfferSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const offeredItem = await db.menuItem.findFirst({
    where: {
      id: parsed.data.offeredItemId,
      restaurantId: auth.restaurant.id,
    },
  });
  if (!offeredItem) {
    return NextResponse.json(
      { error: "Offered product must belong to your restaurant" },
      { status: 400 }
    );
  }

  if (offeredItem.id === baseItem.id) {
    return NextResponse.json(
      { error: "Offered product must differ from the base product." },
      { status: 400 }
    );
  }

  const offer = await db.menuItemOffer.create({
    data: {
      baseItemId: baseItem.id,
      offeredItemId: offeredItem.id,
      sortOrder: parsed.data.sortOrder ?? 0,
    },
    include: {
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
  });

  return NextResponse.json({ data: offer }, { status: 201 });
}

