/** Operational + config channels pushed over SSE. */
export type RestaurantRealtimeEventType =
  | 'kds.tickets'
  | 'kds.manager'
  | 'order_display'
  | 'kiosk.pending_cash'
  | 'pos.recent_orders'
  | 'pos.completed_orders'
  | 'sales.orders'
  | 'dashboard.analytics'
  | 'config.branding'
  | 'config.regional'
  | 'config.menu'
  | 'config.service_charges'
  | 'inventory.stock';

export type RestaurantRealtimeEvent = {
  type: RestaurantRealtimeEventType;
  restaurantId: string;
  branchId?: string | null;
  at: string;
};

/** Client event-bus channel names (backward compatible with existing emits). */
export const REALTIME_CLIENT_CHANNELS: Record<
  RestaurantRealtimeEventType,
  string
> = {
  'kds.tickets': 'realtime:kds.tickets',
  'kds.manager': 'realtime:kds.manager',
  'order_display': 'realtime:order_display',
  'kiosk.pending_cash': 'refreshKioskOrders',
  'pos.recent_orders': 'refreshRecentOrders',
  'pos.completed_orders': 'refreshCompletedOrders',
  'sales.orders': 'refreshSalesOrders',
  'dashboard.analytics': 'realtime:dashboard.analytics',
  'config.branding': 'fetchStoreData',
  'config.regional': 'realtime:config.regional',
  'config.menu': 'realtime:config.menu',
  'config.service_charges': 'realtime:config.service_charges',
  'inventory.stock': 'realtime:inventory.stock',
};

/** Slow fallback poll when SSE is disconnected (ms). */
export const REALTIME_FALLBACK_POLL_MS = 60_000;
