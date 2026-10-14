import { db } from '@/lib/db';
import {
  getRestaurantEntitlements,
  isPaidModule,
} from '@/lib/entitlements/resolve';
import type { ModuleKey } from '@/lib/entitlements/types';

/** Load restaurant by public slug and whether a module is Paid on their plan. */
export async function getPublicModuleGate(
  slug: string,
  moduleKey: ModuleKey
): Promise<{
  restaurantName: string | null;
  restaurantId: string | null;
  paid: boolean;
  found: boolean;
}> {
  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!restaurant) {
    return {
      restaurantName: null,
      restaurantId: null,
      paid: false,
      found: false,
    };
  }
  const entitlements = await getRestaurantEntitlements(restaurant.id);
  return {
    restaurantName: restaurant.name,
    restaurantId: restaurant.id,
    paid: isPaidModule(entitlements, moduleKey),
    found: true,
  };
}
