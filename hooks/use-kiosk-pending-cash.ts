'use client';

import { useCallback, useRef } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import axios from 'axios';

import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { queryKeys } from '@/lib/query/keys';

export type KioskPendingOrderRow = {
  id: string;
  urlId?: string;
  shortOrderId: string;
  ticketNumber: number | null;
  total: number;
  status: string;
  tableLabel: string | null;
  createdAt: string;
  customerName: string | null;
  paymentMethod: string;
  paymentAmount: number;
  paymentStatus: string;
  itemCount: number;
};

async function fetchKioskPendingCash(
  branchId: string | null
): Promise<KioskPendingOrderRow[]> {
  const res = await axios.get<{ data: KioskPendingOrderRow[] }>(
    '/api/restaurant/kiosk-order/pending-cash',
    { params: branchId ? { branchId } : undefined }
  );
  return res.data.data ?? [];
}

/** Cached pending cash kiosk orders — badge count + sheet list, refreshed via SSE. */
export function useKioskPendingCash(branchId: string | null) {
  const key = branchId ? queryKeys.kioskPendingCash(branchId) : null;
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading, isValidating, mutate } = useSWR(
    key,
    () => fetchKioskPendingCash(branchId),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 2_000,
      keepPreviousData: true,
    }
  );

  /** Drop one order from cache immediately (pay / cancel). */
  const removeOrder = useCallback(
    (orderId: string) => {
      void mutate(
        (current) => (current ?? []).filter((o) => o.id !== orderId),
        { revalidate: false }
      );
    },
    [mutate]
  );

  /** Reconcile with server after a short delay — does not block UI. */
  const confirmInBackground = useCallback(() => {
    if (!key) return;
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(() => {
      confirmTimerRef.current = null;
      void mutate(
        async () => fetchKioskPendingCash(branchId),
        { revalidate: false }
      );
    }, 800);
  }, [key, branchId, mutate]);

  const refresh = useCallback(() => {
    void mutate(async () => fetchKioskPendingCash(branchId), {
      revalidate: false,
    });
  }, [branchId, mutate]);

  useRealtimeRefresh(
    'refreshKioskOrders',
    () => {
      if (document.hidden) return;
      refresh();
    },
    { runOnMount: false }
  );

  return {
    orders: data ?? [],
    count: data?.length ?? 0,
    loading: Boolean(key) && isLoading && data === undefined,
    validating: isValidating,
    removeOrder,
    confirmInBackground,
    refresh,
    mutate,
  };
}

export function revalidateKioskPendingCash(branchId: string | null) {
  if (!branchId) return;
  void globalMutate(queryKeys.kioskPendingCash(branchId));
}

export function removeKioskPendingCashOrder(
  branchId: string | null,
  orderId: string
) {
  if (!branchId) return;
  void globalMutate<KioskPendingOrderRow[]>(
    queryKeys.kioskPendingCash(branchId),
    (current) => (current ?? []).filter((o) => o.id !== orderId),
    { revalidate: false }
  );
}
