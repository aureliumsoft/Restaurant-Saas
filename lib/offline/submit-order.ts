import {
  isBrowserOffline,
  isLikelyNetworkFailure,
} from '@/lib/offline/db';
import {
  enqueueOrderOutbox,
  offlineLocalOrderId,
  type OutboxKind,
  type OutboxFollowUp,
} from '@/lib/offline/outbox';

export type PlacedOrderPayload = {
  orderId: string;
  shortOrderId: string;
  restaurantId: string;
  ticketNumber: number | null;
};

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

async function postOrderJson(
  url: string,
  body: unknown,
  idempotencyKey: string
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

function parsePlaced(json: unknown): PlacedOrderPayload | null {
  if (!json || typeof json !== 'object') return null;
  const root = json as Record<string, unknown>;
  const nested =
    root.data && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : null;
  const d = nested ?? root;
  const orderId =
    typeof d.orderId === 'string'
      ? d.orderId
      : typeof d.id === 'string'
        ? d.id
        : null;
  const shortOrderId =
    typeof d.shortOrderId === 'string' ? d.shortOrderId : orderId;
  const restaurantId =
    typeof d.restaurantId === 'string' ? d.restaurantId : '';
  const tn = d.ticketNumber;
  const ticketNumber = typeof tn === 'number' ? tn : null;
  if (!orderId || !shortOrderId) return null;
  return {
    orderId,
    shortOrderId,
    restaurantId,
    ticketNumber,
  };
}

export type SubmitOrderSent = { status: 'sent'; data: PlacedOrderPayload };
export type SubmitOrderQueued = {
  status: 'queued';
  idempotencyKey: string;
  localOrderId: string;
};
export type SubmitOrderResult = SubmitOrderSent | SubmitOrderQueued;

export async function submitCustomerOrder(
  body: unknown
): Promise<SubmitOrderResult> {
  return submitOrderWithOutbox('/api/customer/orders', body, 'customer_order');
}

export async function submitKioskOrder(
  body: unknown
): Promise<SubmitOrderResult> {
  return submitOrderWithOutbox('/api/kiosk/orders', body, 'kiosk_order');
}

export async function submitPosOrder(
  body: unknown
): Promise<SubmitOrderResult> {
  return submitOrderWithOutbox('/api/restaurant/pos-order', body, 'pos_order');
}

export async function submitKdsTicket(
  body: { orderId: string; selectedMinutes: number },
  opts?: { linkedOutboxKey?: string }
): Promise<{ status: 'sent' } | { status: 'queued'; idempotencyKey: string }> {
  const idempotencyKey = newIdempotencyKey();
  const url = '/api/restaurant/kds/tickets';
  const serialized = JSON.stringify(body);

  if (isBrowserOffline()) {
    if (opts?.linkedOutboxKey) {
      const { updateOrderOutbox } = await import('@/lib/offline/outbox');
      const followUp: OutboxFollowUp = {
        kind: 'kds_ticket',
        url,
        bodyTemplate: JSON.stringify({
          orderId: '{{orderId}}',
          selectedMinutes: body.selectedMinutes,
        }),
      };
      await updateOrderOutbox(opts.linkedOutboxKey, { followUp });
      return { status: 'queued', idempotencyKey: opts.linkedOutboxKey };
    }
    await enqueueOrderOutbox({
      idempotencyKey,
      url,
      body: serialized,
      kind: 'kds_ticket',
      createdAt: Date.now(),
      localOrderId: body.orderId,
    });
    return { status: 'queued', idempotencyKey };
  }

  try {
    const { ok, status, json } = await postOrderJson(url, body, idempotencyKey);
    if (ok || status === 201) return { status: 'sent' };
    const apiError =
      json &&
      typeof json === 'object' &&
      typeof (json as { error?: unknown }).error === 'string'
        ? String((json as { error: string }).error)
        : null;
    throw new Error(apiError || `Kitchen ticket failed: ${status}`);
  } catch (e) {
    if (isBrowserOffline() || isLikelyNetworkFailure(e)) {
      if (opts?.linkedOutboxKey) {
        const { updateOrderOutbox } = await import('@/lib/offline/outbox');
        await updateOrderOutbox(opts.linkedOutboxKey, {
          followUp: {
            kind: 'kds_ticket',
            url,
            bodyTemplate: JSON.stringify({
              orderId: '{{orderId}}',
              selectedMinutes: body.selectedMinutes,
            }),
          },
        });
        return { status: 'queued', idempotencyKey: opts.linkedOutboxKey };
      }
      await enqueueOrderOutbox({
        idempotencyKey,
        url,
        body: serialized,
        kind: 'kds_ticket',
        createdAt: Date.now(),
        localOrderId: body.orderId,
      });
      return { status: 'queued', idempotencyKey };
    }
    throw e;
  }
}

async function submitOrderWithOutbox(
  url: string,
  body: unknown,
  kind: OutboxKind
): Promise<SubmitOrderResult> {
  const idempotencyKey = newIdempotencyKey();
  const localOrderId = offlineLocalOrderId(idempotencyKey);
  const serialized = JSON.stringify(body);

  if (isBrowserOffline()) {
    await enqueueOrderOutbox({
      idempotencyKey,
      url,
      body: serialized,
      kind,
      createdAt: Date.now(),
      localOrderId,
    });
    return { status: 'queued', idempotencyKey, localOrderId };
  }

  try {
    const { ok, status, json } = await postOrderJson(url, body, idempotencyKey);
    if (ok || status === 201) {
      const data = parsePlaced(json);
      if (data) return { status: 'sent', data };
      throw new Error('Invalid order response');
    }
    const err = new Error(`Order request failed: ${status}`) as Error & {
      status?: number;
      body?: unknown;
    };
    err.status = status;
    err.body = json;
    throw err;
  } catch (e) {
    if (isBrowserOffline() || isLikelyNetworkFailure(e)) {
      await enqueueOrderOutbox({
        idempotencyKey,
        url,
        body: serialized,
        kind,
        createdAt: Date.now(),
        localOrderId,
      });
      return { status: 'queued', idempotencyKey, localOrderId };
    }
    throw e;
  }
}

export { parsePlaced as parsePlacedOrderPayload };
