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
    const resolved = resolveOrderInfo(
      orderId,
      orderType,
      initialOrderInfo,
      orderInfoHasContext(fromUrl) ? fromUrl : undefined
    );

    if (orderInfoHasContext(resolved)) {
      writeOrderContext(orderId, resolved);
    }
    setOrderInfo(resolved);

    const hasContextInUrl = ORDER_CONTEXT_QUERY_KEYS.some((key) =>
      searchParams.has(key)
    );
    if (!hasContextInUrl || !pathname) return;

    const preserved = orderFlowPreservedQueryString(searchParams);
    router.replace(preserved ? `${pathname}?${preserved}` : pathname);
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
