import { getRealtimeHub } from '@/lib/realtime/hub';
import type { RestaurantRealtimeEventType } from '@/lib/realtime/types';

const ORDER_LIFECYCLE_TYPES: RestaurantRealtimeEventType[] = [
  'kds.tickets',
  'kds.manager',
  'order_display',
  'kiosk.pending_cash',
  'pos.recent_orders',
  'pos.completed_orders',
  'sales.orders',
  'dashboard.analytics',
  'inventory.stock',
];

export function publishRestaurantRealtime(
  type: RestaurantRealtimeEventType,
  params: { restaurantId: string; branchId?: string | null }
) {
  try {
    getRealtimeHub().publish({
      type,
      restaurantId: params.restaurantId,
      branchId: params.branchId ?? null,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('publishRestaurantRealtime', type, e);
  }
}

/** Broadcast operational channels after a major order lifecycle change. */
export function publishOrderLifecycleUpdate(params: {
  restaurantId: string;
  branchId?: string | null;
  /** Skip channels that are irrelevant for this mutation (reduces refresh storms). */
  exclude?: RestaurantRealtimeEventType[];
}) {
  const skip = new Set(params.exclude ?? []);
  for (const type of ORDER_LIFECYCLE_TYPES) {
    if (skip.has(type)) continue;
    publishRestaurantRealtime(type, params);
  }
}

/** Branch-scoped stock refresh (pass branch when known). */
export function publishInventoryStockUpdate(
  restaurantId: string,
  branchId?: string | null
) {
  publishRestaurantRealtime('inventory.stock', {
    restaurantId,
    branchId: branchId ?? null,
  });
}

export function publishConfigUpdate(
  type: Extract<
    RestaurantRealtimeEventType,
    | 'config.branding'
    | 'config.regional'
    | 'config.menu'
    | 'config.service_charges'
  >,
  restaurantId: string
) {
  publishRestaurantRealtime(type, { restaurantId });
}
