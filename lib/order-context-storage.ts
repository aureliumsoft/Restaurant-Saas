import type { OrderInfo } from '@/components/order/order-types';

const STORAGE_PREFIX = 'order-context-';

export function orderContextStorageKey(orderId: string): string {
  return `${STORAGE_PREFIX}${orderId.trim()}`;
}

export function writeOrderContext(orderId: string, info: OrderInfo): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      orderContextStorageKey(orderId),
      JSON.stringify(info)
    );
  } catch {
    // ignore quota / private mode
  }
}

export function readOrderContext(orderId: string): OrderInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(orderContextStorageKey(orderId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OrderInfo;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function clearOrderContext(orderId: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(orderContextStorageKey(orderId));
  } catch {
    // ignore
  }
}

/** Extract flow id from `/order/{delivery|pickUp}/{id}` paths. */
export function extractOrderIdFromOrderPath(pathname: string): string | null {
  const match = pathname.match(
    /^\/order\/(?:delivery|pickUp|pickup)\/([^/]+)/i
  );
  return match?.[1]?.trim() || null;
}
