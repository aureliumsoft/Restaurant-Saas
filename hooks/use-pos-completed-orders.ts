'use client';

import { useCallback } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import axios from 'axios';

import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { queryKeys } from '@/lib/query/keys';

export type PosCompletedOrderRow = {
  id: string;
  urlId?: string;
  shortOrderId: string;
  ticketNumber: number | null;
  total: number;
  status: string;
  sourceType?: 'POS' | 'KIOSK' | 'ONLINE' | string;
  createdAt: string;
  updatedAt: string;
  customerName: string | null;
  paymentMethod: string | null;
  paymentAmount: number | null;
  itemCount: number;
  fulfillmentHint?: 'delivery' | 'pickup';
};

type CompletedOrdersPayload = {
  orders: PosCompletedOrderRow[];
  total: number;
};

async function fetchCompletedOrders(
  branchId: string
): Promise<CompletedOrdersPayload> {
  const res = await axios.get<{
    data: PosCompletedOrderRow[];
    total?: number;
  }>('/api/restaurant/pos-order/completed', {
    params: {
      branchId,
      limit: 50,
      offset: 0,
    },
  });
  const orders = res.data.data ?? [];
  return {
    orders,
    total: res.data.total ?? orders.length,
  };
}

/** Cached completed orders — badge count + sheet list, refreshed via SSE. */
export function usePosCompletedOrders(branchId: string | null) {
  const key = branchId ? queryKeys.posCompletedOrders(branchId) : null;

  const { data, isLoading, isValidating, mutate } = useSWR(
    key,
    () => fetchCompletedOrders(branchId!),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 2_000,
      keepPreviousData: true,
    }
  );

  const removeOrder = useCallback(
    (orderId: string) => {
      void mutate(
        (current) =>
          current
            ? {
                orders: current.orders.filter((o) => o.id !== orderId),
                total: Math.max(0, current.total - 1),
              }
            : current,
        { revalidate: false }
      );
    },
    [mutate]
  );

  const refresh = useCallback(() => {
    if (!branchId) return;
    void mutate(async () => fetchCompletedOrders(branchId), {
      revalidate: false,
    });
  }, [branchId, mutate]);

  useRealtimeRefresh(
    ['refreshCompletedOrders', 'realtime:kds.tickets'],
    () => {
      if (document.hidden) return;
      refresh();
    },
    { runOnMount: false }
  );

  return {
    orders: data?.orders ?? [],
    count: data?.total ?? 0,
    loading: Boolean(key) && isLoading && data === undefined,
    refreshing: isValidating,
    refresh,
    removeOrder,
  };
}

export function revalidatePosCompletedOrders(branchId: string | null) {
  if (!branchId) return;
  void globalMutate(queryKeys.posCompletedOrders(branchId));
}
