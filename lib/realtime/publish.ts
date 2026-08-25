import { getRealtimeHub } from '@/lib/realtime/hub';
import type { RestaurantRealtimeEventType } from '@/lib/realtime/types';

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

/** Broadcast all operational channels after a major order lifecycle change. */
export function publishOrderLifecycleUpdate(params: {
  restaurantId: string;
  branchId?: string | null;
}) {
  const types: RestaurantRealtimeEventType[] = [
    'kds.tickets',
    'kds.manager',
    'order_display',
    'kiosk.pending_cash',
    'pos.recent_orders',
    'sales.orders',
    'dashboard.analytics',
    'inventory.stock',
  ];
  for (const type of types) {
    publishRestaurantRealtime(type, params);
  }
  publishInventoryStockUpdate(params.restaurantId);
}

/** Restaurant-wide stock (not branch-scoped). */
export function publishInventoryStockUpdate(restaurantId: string) {
  publishRestaurantRealtime('inventory.stock', {
    restaurantId,
    branchId: null,
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
