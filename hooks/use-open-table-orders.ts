'use client';

import { useCallback, useRef } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import axios from 'axios';

import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { queryKeys } from '@/lib/query/keys';
import type { OpenTableCard, OpenTableOrderRow } from '@/lib/table-open-orders';

export type { OpenTableCard, OpenTableOrderRow };

async function fetchOpenTableCards(
  branchId: string | null
): Promise<OpenTableCard[]> {
  const res = await axios.get<{ data: OpenTableCard[] }>(
    '/api/restaurant/table-orders/open',
    { params: branchId ? { branchId } : undefined }
  );
  return res.data.data ?? [];
}

/** Open table tabs (pending payment), badge + sheet, SSE refresh. */
export function useOpenTableOrders(branchId: string | null) {
  const key = branchId ? queryKeys.tableOpenOrders(branchId) : null;
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading, isValidating, mutate } = useSWR(
    key,
    () => fetchOpenTableCards(branchId),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 2_000,
      keepPreviousData: true,
    }
  );

  const removeTable = useCallback(
    (diningTableId: string) => {
      void mutate(
        (current) =>
          (current ?? []).filter((c) => c.diningTableId !== diningTableId),
        { revalidate: false }
      );
    },
    [mutate]
  );

  const confirmInBackground = useCallback(() => {
    if (!key) return;
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(() => {
      confirmTimerRef.current = null;
      void mutate(async () => fetchOpenTableCards(branchId), {
        revalidate: false,
      });
    }, 800);
  }, [key, branchId, mutate]);

  const refresh = useCallback(() => {
    void mutate(async () => fetchOpenTableCards(branchId), {
      revalidate: false,
    });
  }, [branchId, mutate]);

  useRealtimeRefresh(
    'refreshTableOrders',
    () => {
      if (document.hidden) return;
      refresh();
    },
    { runOnMount: false }
  );

  // Also refresh on kiosk/sales broadcasts so multi-source tabs stay in sync
  useRealtimeRefresh(
    'refreshKioskOrders',
    () => {
      if (document.hidden) return;
      refresh();
    },
    { runOnMount: false }
  );

  const cards = data ?? [];
  const orderCount = cards.reduce((s, c) => s + c.orderCount, 0);

  return {
    cards,
    tableCount: cards.length,
    orderCount,
    loading: Boolean(key) && isLoading && data === undefined,
    validating: isValidating,
    removeTable,
    confirmInBackground,
    refresh,
    mutate,
  };
}

export function revalidateOpenTableOrders(branchId: string | null) {
  if (!branchId) return;
  void globalMutate(queryKeys.tableOpenOrders(branchId));
}
