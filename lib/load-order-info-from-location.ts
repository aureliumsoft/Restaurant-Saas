import type { OrderInfo } from '@/components/order/order-types';
import { db } from '@/lib/db';
import {
  mergeOrderInfo,
  orderInfoFromSearchParams,
} from '@/lib/order-search-params';
import { resolveRouteId } from '@/lib/resolve-route-id';

/** Resolve pickup/delivery location from the encoded branch id in the order URL. */
export async function loadOrderInfoFromLocationId(
  locationToken: string,
  mode: 'delivery' | 'pickUp'
): Promise<OrderInfo | null> {
  const id = resolveRouteId(locationToken);
  if (!id) return null;

  try {
    const branch = await db.branch.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        address: true,
        restaurant: { select: { name: true, slug: true } },
      },
    });
    if (!branch) return null;

    return {
      mode,
      storeId: branch.id,
      storeName: branch.name,
      storeAddress: branch.address ?? '',
      restaurantName: branch.restaurant.name,
      restaurantSlug: branch.restaurant.slug,
    };
  } catch {
    return null;
  }
}

export async function resolveInitialOrderInfo(
  locationToken: string,
  searchParams: Record<string, string | string[] | undefined>,
  mode: 'delivery' | 'pickUp'
): Promise<OrderInfo> {
  const fromQuery = orderInfoFromSearchParams(searchParams, mode);
  const fromLocation = await loadOrderInfoFromLocationId(locationToken, mode);
  return mergeOrderInfo(mode, fromLocation, fromQuery);
}
