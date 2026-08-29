import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getRestaurantForOwnerRequest } from "@/lib/restaurant/ownerRestaurant";
import { getRestaurantPlanFeatures, subscriptionPlanDeniedResponse } from "@/lib/subscription-plan-enforcement";
import { resolveRouteParams } from '@/lib/resolve-route-id';

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ offerId: string }> }
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
    return subscriptionPlanDeniedResponse("Product recommendations and add-on offers");
  }

  const { offerId } = await resolveRouteParams(ctx.params, ['offerId']);

  const offer = await db.menuItemOffer.findFirst({
    where: { id: offerId },
    include: { baseItem: true },
  });

  if (!offer || offer.baseItem.restaurantId !== auth.restaurant.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.menuItemOffer.delete({ where: { id: offerId } });

  return NextResponse.json({ ok: true }, { status: 200 });
}

