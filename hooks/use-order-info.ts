'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import type { OrderInfo } from '@/components/order/order-types';
import { readOrderContext, writeOrderContext } from '@/lib/order-context-storage';
import {
  mergeOrderInfo,
  orderFlowPreservedQueryString,
  orderInfoFromSearchParams,
  orderInfoHasContext,
  ORDER_CONTEXT_QUERY_KEYS,
} from '@/lib/order-search-params';
import { LAST_CUSTOMER_RESTAURANT_SLUG_KEY } from '@/lib/restaurant-theme-persist';

function resolveOrderInfo(
  orderId: string,
  orderType: 'delivery' | 'pickUp',
  initialOrderInfo?: OrderInfo,
  fromUrl?: OrderInfo
): OrderInfo {
  const fromStorage =
    typeof window !== 'undefined' ? readOrderContext(orderId) : null;
  return mergeOrderInfo(
    orderType,
    fromStorage,
    initialOrderInfo,
    fromUrl
  );
}

async function fetchOrderInfoFromLocation(
  orderId: string,
  orderType: 'delivery' | 'pickUp'
): Promise<OrderInfo | null> {
  try {
    const res = await fetch(
      `/api/customer/order-location?id=${encodeURIComponent(orderId)}&mode=${encodeURIComponent(orderType)}`
    );
    const body = (await res.json().catch(() => ({}))) as {
      data?: OrderInfo | null;
    };
    return body.data && orderInfoHasContext(body.data) ? body.data : null;
  } catch {
    return null;
  }
}

async function fetchOrderInfoFromLastRestaurant(
  orderType: 'delivery' | 'pickUp'
): Promise<OrderInfo | null> {
  if (typeof window === 'undefined') return null;
  const slug = localStorage.getItem(LAST_CUSTOMER_RESTAURANT_SLUG_KEY)?.trim();
  if (!slug) return null;
  try {
    const [restaurantRes, branchesRes] = await Promise.all([
      fetch(`/api/customer/restaurant?slug=${encodeURIComponent(slug)}`),
      fetch(`/api/customer/branches?slug=${encodeURIComponent(slug)}`),
    ]);
    const restaurantJson = (await restaurantRes.json().catch(() => ({}))) as {
      data?: { name?: string; slug?: string } | null;
    };
    const branchesJson = (await branchesRes.json().catch(() => ({}))) as {
      data?: Array<{ id?: string; name?: string; address?: string | null }>;
    };
    const branch = branchesJson.data?.[0];
    if (!branch?.id) return null;
    return {
      mode: orderType,
      restaurantSlug: restaurantJson.data?.slug || slug,
      restaurantName: restaurantJson.data?.name || '',
      storeId: branch.id,
      storeName: branch.name || '',
      storeAddress: branch.address || '',
    };
  } catch {
    return null;
  }
}

export function useOrderInfo(
  orderId: string,
  orderType: 'delivery' | 'pickUp',
  initialOrderInfo?: OrderInfo
): OrderInfo {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const fromUrl = useMemo(() => {
    const record: Record<string, string | string[] | undefined> = {};
    searchParams.forEach((value, key) => {
      record[key] = value;
    });
    return orderInfoFromSearchParams(record, orderType);
  }, [searchParams, orderType]);

  const [orderInfo, setOrderInfo] = useState<OrderInfo>(() =>
    resolveOrderInfo(orderId, orderType, initialOrderInfo)
  );

  useEffect(() => {
    let cancelled = false;

    const resolved = resolveOrderInfo(
      orderId,
      orderType,
      initialOrderInfo,
      orderInfoHasContext(fromUrl) ? fromUrl : undefined
    );

    const apply = (next: OrderInfo) => {
      if (cancelled) return;
      if (orderInfoHasContext(next)) {
        writeOrderContext(orderId, next);
      }
      setOrderInfo(next);

      const hasContextInUrl = ORDER_CONTEXT_QUERY_KEYS.some((key) =>
        searchParams.has(key)
      );
      if (!hasContextInUrl || !pathname) return;

      const preserved = orderFlowPreservedQueryString(searchParams);
      router.replace(preserved ? `${pathname}?${preserved}` : pathname);
    };

    if (orderInfoHasContext(resolved)) {
      apply(resolved);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const fromLocation = await fetchOrderInfoFromLocation(orderId, orderType);
      if (cancelled) return;
      if (fromLocation) {
        apply(mergeOrderInfo(orderType, resolved, fromLocation));
        return;
      }
      const fromLast = await fetchOrderInfoFromLastRestaurant(orderType);
      if (cancelled) return;
      if (fromLast) {
        apply(mergeOrderInfo(orderType, resolved, fromLast));
        return;
      }
      apply(resolved);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    orderId,
    orderType,
    fromUrl,
    initialOrderInfo,
    pathname,
    router,
    searchParams,
  ]);

  return orderInfo;
}
