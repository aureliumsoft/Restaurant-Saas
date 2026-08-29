import type { OrderInfo } from '@/components/order/order-types';
import {
  extractOrderIdFromOrderPath,
  writeOrderContext,
} from '@/lib/order-context-storage';

function pick(
  sp: Record<string, string | string[] | undefined>,
  key: string
): string {
  const v = sp[key];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

/** Query keys that carry order context (stripped from URLs once stored). */
export const ORDER_CONTEXT_QUERY_KEYS = [
  'mode',
  'storeId',
  'storeName',
  'storeAddress',
  'address',
  'apartment',
  'gateCode',
  'addressName',
  'customerPhone',
  'restaurantSlug',
  'restaurantName',
  'slug',
] as const;

/** Payment / success params kept on the URL. */
export const ORDER_FLOW_PRESERVED_QUERY_KEYS = [
  'session_id',
  'token',
  'orderId',
  'ticket',
  'ticketNumber',
  'restaurantSlug',
  'slug',
] as const;

export function orderInfoHasContext(info: OrderInfo | undefined): boolean {
  if (!info) return false;
  return Boolean(
    info.restaurantSlug?.trim() ||
      info.storeId?.trim() ||
      info.restaurantName?.trim() ||
      info.storeName?.trim() ||
      info.storeAddress?.trim() ||
      info.address?.trim() ||
      info.apartment?.trim() ||
      info.gateCode?.trim() ||
      info.addressName?.trim() ||
      info.customerPhone?.trim()
  );
}

export function mergeOrderInfo(
  mode: 'delivery' | 'pickUp',
  ...sources: (OrderInfo | null | undefined)[]
): OrderInfo {
  const merged: OrderInfo = { mode };

  const assign = (src: OrderInfo) => {
    if (src.restaurantSlug?.trim()) {
      merged.restaurantSlug = src.restaurantSlug.trim();
    }
    if (src.restaurantName?.trim()) {
      merged.restaurantName = src.restaurantName.trim();
    }
    if (src.storeId?.trim()) merged.storeId = src.storeId.trim();
    if (src.storeName?.trim()) merged.storeName = src.storeName.trim();
    if (src.storeAddress?.trim()) merged.storeAddress = src.storeAddress.trim();
    if (src.address?.trim()) merged.address = src.address.trim();
    if (src.apartment?.trim()) merged.apartment = src.apartment.trim();
    if (src.gateCode?.trim()) merged.gateCode = src.gateCode.trim();
    if (src.addressName?.trim()) merged.addressName = src.addressName.trim();
    if (src.customerPhone?.trim()) {
      merged.customerPhone = src.customerPhone.trim();
    }
  };

  for (const src of sources) {
    if (!src) continue;
    assign(src);
  }

  return merged;
}

/** Server: build `OrderInfo` from URL query (supports `restaurantSlug` or `slug`). */
export function orderInfoFromSearchParams(
  sp: Record<string, string | string[] | undefined>,
  mode: 'delivery' | 'pickUp'
): OrderInfo {
  const slug =
    pick(sp, 'restaurantSlug').trim() || pick(sp, 'slug').trim() || undefined;
  const info: OrderInfo = { mode };

  const restaurantName = pick(sp, 'restaurantName').trim();
  const storeName = pick(sp, 'storeName').trim();
  const storeId = pick(sp, 'storeId').trim();
  const storeAddress = pick(sp, 'storeAddress').trim();
  const address = pick(sp, 'address').trim();
  const apartment = pick(sp, 'apartment').trim();
  const gateCode = pick(sp, 'gateCode').trim();
  const addressName = pick(sp, 'addressName').trim();
  const customerPhone = pick(sp, 'customerPhone').trim();

  if (restaurantName) info.restaurantName = restaurantName;
  else if (storeName) info.restaurantName = storeName;
  if (storeId) info.storeId = storeId;
  if (storeName) info.storeName = storeName;
  if (storeAddress) info.storeAddress = storeAddress;
  if (address) info.address = address;
  if (apartment) info.apartment = apartment;
  if (gateCode) info.gateCode = gateCode;
  if (addressName) info.addressName = addressName;
  if (customerPhone) info.customerPhone = customerPhone;
  if (slug) info.restaurantSlug = slug;

  return info;
}

export function orderFlowPreservedQueryString(searchParams: {
  get(name: string): string | null;
}): string {
  const preserved = new URLSearchParams();
  for (const key of ORDER_FLOW_PRESERVED_QUERY_KEYS) {
    const value = searchParams.get(key);
    if (value) preserved.set(key, value);
  }
  return preserved.toString();
}

/** Client navigation: persist context in sessionStorage; URL stays short. */
export function orderPathWithQuery(
  pathname: string,
  orderInfo: OrderInfo | undefined
): string {
  const orderId = extractOrderIdFromOrderPath(pathname);
  if (orderId && orderInfo && orderInfoHasContext(orderInfo)) {
    writeOrderContext(orderId, orderInfo);
  }
  return pathname;
}
