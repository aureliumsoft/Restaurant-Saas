'use client';

import { useCallback, useRef } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import axios from 'axios';

import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { queryKeys } from '@/lib/query/keys';

export type PosWorkingOrderRow = {
  id: string;
  ticketNumber: number | null;
  shortOrderId: string | null;
  status: string;
  total: number;
  sourceType: string;
  tableLabel: string | null;
  address: string | null;
  cutleryRequested: boolean;
  customerComment: string | null;
  orderScheduleMode: string | null;
  orderScheduleSlot: string | null;
  orderScheduleAt: string | null;
  createdAt: string;
  customer: { name: string | null; phone: string | null } | null;
  items: Array<{
    id: string;
    quantity: number;
    price: number;
    productName: string | null;
    menuItem: { name: string } | null;
    modifiers: Array<{ name: string; quantity: number; unitPrice: number }>;
  }>;
  paymentStatus: string | null;
  paymentMethod: string | null;
  paymentAmount: number | null;
};

async function fetchWorkingOrders(
  branchId?: string | null
): Promise<PosWorkingOrderRow[]> {
  const res = await axios.get<{ data: PosWorkingOrderRow[] }>(
    '/api/restaurant/pos-order/working-orders',
    { params: branchId ? { branchId } : undefined }
  );
  return res.data?.data ?? [];
}

/** Cached working orders — badge count + sheet list, deduplicated across POS with SSE refresh. */
export function usePosWorkingOrders(branchId?: string | null) {
  const key = queryKeys.posWorkingOrders(branchId);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading, isValidating, mutate } = useSWR(
    key,
    () => fetchWorkingOrders(branchId),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 0,
      keepPreviousData: true,
    }
  );

  /** Optimistically remove an order from cache immediately */
  const removeOrder = useCallback(
    (orderId: string) => {
      void mutate(
        (current) => (current ?? []).filter((o) => o.id !== orderId),
        { revalidate: false }
      );
    },
    [mutate]
  );

  /** Reconcile with server after a short debounce */
  const confirmInBackground = useCallback(() => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(() => {
      confirmTimerRef.current = null;
      void mutate(
        async () => fetchWorkingOrders(branchId),
        { revalidate: false }
      );
    }, 600);
  }, [branchId, mutate]);

  const refresh = useCallback(() => {
    void mutate(async () => fetchWorkingOrders(branchId), {
      revalidate: false,
    });
  }, [branchId, mutate]);

  useRealtimeRefresh(
    [
      'refreshWorkingOrders',
      'refreshRecentOrders',
      'refreshSalesOrders',
      'refreshKioskOrders',
      'realtime:kds.tickets',
      'realtime:order_display',
    ],
    () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      refresh();
    },
    { runOnMount: false }
  );

  return {
    orders: data ?? [],
    count: data?.length ?? 0,
    loading: isLoading && data === undefined,
    refreshing: isValidating,
    refresh,
    removeOrder,
    confirmInBackground,
    mutate,
  };
}

export function revalidatePosWorkingOrders(branchId?: string | null) {
  void globalMutate(queryKeys.posWorkingOrders(branchId));
  if (branchId) {
    void globalMutate(queryKeys.posWorkingOrders(null));
  }
}

export function removePosWorkingOrder(
  branchId: string | null | undefined,
  orderId: string
) {
  void globalMutate<PosWorkingOrderRow[]>(
    queryKeys.posWorkingOrders(branchId),
    (current) => (current ?? []).filter((o) => o.id !== orderId),
    { revalidate: false }
  );
  if (branchId) {
    void globalMutate<PosWorkingOrderRow[]>(
      queryKeys.posWorkingOrders(null),
      (current) => (current ?? []).filter((o) => o.id !== orderId),
      { revalidate: false }
    );
  }
}
