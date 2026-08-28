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

function rebuildCard(
  diningTableId: string,
  tableLabel: string,
  orders: OpenTableOrderRow[]
): OpenTableCard {
  const unpaid = orders.filter((o) => {
    const s = String(o.paymentStatus ?? '').toLowerCase();
    return s === 'pending' || s === 'pedding';
  });
  return {
    diningTableId,
    tableLabel,
    orderCount: orders.length,
    totalDue: unpaid.reduce((s, o) => s + (Number(o.total) || 0), 0),
    unpaidCount: unpaid.length,
    kitchenPendingCount: orders.filter((o) => !o.kitchenSent).length,
    kitchenSentCount: orders.filter((o) => o.kitchenSent).length,
    sources: [...new Set(orders.map((o) => o.sourceType).filter(Boolean))],
    orders,
  };
}

function mergeOrderIntoCards(
  current: OpenTableCard[] | undefined,
  diningTableId: string,
  tableLabel: string,
  order: OpenTableOrderRow
): OpenTableCard[] {
  const cards = current ? [...current] : [];
  const idx = cards.findIndex((c) => c.diningTableId === diningTableId);
  if (idx < 0) {
    cards.push(rebuildCard(diningTableId, tableLabel, [order]));
    return cards;
  }
  const existing = cards[idx];
  const orderIdx = existing.orders.findIndex((o) => o.id === order.id);
  const nextOrders =
    orderIdx >= 0
      ? existing.orders.map((o, i) =>
          i === orderIdx ? { ...o, ...order } : o
        )
      : [...existing.orders, order];
  cards[idx] = rebuildCard(
    diningTableId,
    tableLabel || existing.tableLabel,
    nextOrders
  );
  return cards;
}

/** Open table tabs (unpaid and/or not in kitchen), badge + sheet, SSE refresh. */
export function useOpenTableOrders(branchId: string | null) {
  const key = branchId ? queryKeys.tableOpenOrders(branchId) : null;
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading, isValidating, mutate } = useSWR(
    key,
    () => fetchOpenTableCards(branchId),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5_000,
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
    }, 1_200);
  }, [key, branchId, mutate]);

  const refresh = useCallback(async () => {
    return mutate(async () => fetchOpenTableCards(branchId), {
      revalidate: false,
    });
  }, [branchId, mutate]);

  const scheduleRefresh = useCallback(() => {
    if (document.hidden) return;
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      void refresh();
    }, 1_000);
  }, [refresh]);

  useRealtimeRefresh('refreshTableOrders', scheduleRefresh, {
    runOnMount: false,
  });

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

/** Instant UI update after place / kitchen — no network round-trip. */
export function upsertOptimisticOpenTableOrder(
  branchId: string | null,
  params: {
    diningTableId: string;
    tableLabel: string;
    order: OpenTableOrderRow;
  }
) {
  if (!branchId || !params.diningTableId) return;
  void globalMutate(
    queryKeys.tableOpenOrders(branchId),
    (current: OpenTableCard[] | undefined) =>
      mergeOrderIntoCards(
        current,
        params.diningTableId,
        params.tableLabel,
        params.order
      ),
    { revalidate: false }
  );
}

/** Mark an existing open-table ticket as sent to kitchen (by order id). */
export function markOpenTableOrderKitchenSent(
  branchId: string | null,
  orderId: string
) {
  if (!branchId || !orderId) return;
  void globalMutate(
    queryKeys.tableOpenOrders(branchId),
    (current: OpenTableCard[] | undefined) => {
      if (!current?.length) return current;
      return current.map((card) => {
        const orderIdx = card.orders.findIndex((o) => o.id === orderId);
        if (orderIdx < 0) return card;
        const nextOrders = card.orders.map((o, i) =>
          i === orderIdx
            ? {
                ...o,
                kitchenSent: true,
                kitchenStatus: 'making',
                status: 'making',
              }
            : o
        );
        return rebuildCard(card.diningTableId, card.tableLabel, nextOrders);
      });
    },
    { revalidate: false }
  );
}

/** Soft sync after optimistic write (deduped across callers). */
export function revalidateOpenTableOrders(
  branchId: string | null,
  delayMs = 0
) {
  if (!branchId) return;
  const key = queryKeys.tableOpenOrders(branchId);
  if (delayMs <= 0) {
    void globalMutate(key);
    return;
  }
  window.setTimeout(() => {
    void globalMutate(key);
  }, delayMs);
}
