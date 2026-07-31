import { notifyOfflineChanged } from '@/lib/offline/db';
import {
  listOrderOutbox,
  removeOrderOutboxKey,
  type OutboxRecord,
} from '@/lib/offline/outbox';
import {
  findLocalTicket,
  removeLocalTicketsForOrder,
} from '@/lib/offline/local-tickets';
import { parsePlacedOrderPayload } from '@/lib/offline/submit-order';

export type FlushOutboxResult = {
  synced: number;
  /** True when server rejected due to missing/expired session — keep outbox. */
  authRequired: boolean;
  remaining: number;
};

function isRetriableStatus(status: number): boolean {
  if (status === 429 || status === 408) return true;
  return status >= 500;
}

function isAuthFailure(status: number): boolean {
  return status === 401 || status === 403;
}

async function requestJson(
  method: 'POST' | 'PATCH',
  url: string,
  body: string,
  idempotencyKey: string
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body,
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

function parseKitchenTicketId(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null;
  const root = json as Record<string, unknown>;
  const data =
    root.data && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : null;
  if (data && typeof data.id === 'string') return data.id;
  if (typeof root.id === 'string') return root.id;
  return null;
}

/**
 * Create kitchen ticket after POS sync. If the offline ticket was already
 * completed/canceled on KDS, apply that final status so it does not reappear.
 */
async function flushKitchenFollowUp(
  item: OutboxRecord,
  cloudOrderId: string
): Promise<void> {
  if (!item.followUp) return;

  const local = item.localOrderId
    ? await findLocalTicket(item.localOrderId)
    : null;
  const desiredStatus =
    local?.status === 'completed' || local?.status === 'canceled'
      ? local.status
      : null;

  const body = item.followUp.bodyTemplate.replaceAll(
    '{{orderId}}',
    cloudOrderId
  );
  const followKey = `${item.idempotencyKey}-kds`;
  const { ok, status, json } = await requestJson(
    'POST',
    item.followUp.url,
    body,
    followKey
  );

  if (!ok && status !== 201 && status !== 200) {
    if (isAuthFailure(status)) {
      throw new Error('AUTH_REQUIRED');
    }
    if (isRetriableStatus(status)) {
      throw new Error(`follow-up retry ${status}`);
    }
    return;
  }

  if (!desiredStatus) return;

  const ticketId = parseKitchenTicketId(json);
  if (!ticketId) return;

  const patchKey = `${item.idempotencyKey}-kds-${desiredStatus}`;
  const patched = await requestJson(
    'PATCH',
    `/api/restaurant/kds/tickets/${encodeURIComponent(ticketId)}`,
    JSON.stringify({ status: desiredStatus }),
    patchKey
  );
  if (isAuthFailure(patched.status)) {
    throw new Error('AUTH_REQUIRED');
  }
  if (
    !patched.ok &&
    patched.status !== 200 &&
    isRetriableStatus(patched.status)
  ) {
    throw new Error(`status follow-up retry ${patched.status}`);
  }
}

/**
 * POST/PATCH each queued mutation with the same idempotency key used when enqueueing.
 * Never deletes outbox rows on 401/403 — those must wait until the user signs in again.
 */
export async function flushOrderOutbox(): Promise<FlushOutboxResult> {
  if (typeof window === 'undefined' || !navigator.onLine) {
    const remaining = typeof window === 'undefined' ? 0 : (await listOrderOutbox()).length;
    return { synced: 0, authRequired: false, remaining };
  }

  let synced = 0;
  let authRequired = false;
  const pending = await listOrderOutbox();

  // Orders first, then kitchen creates, then status patches.
  const kindRank = (kind: OutboxRecord['kind']) => {
    if (kind === 'kds_status') return 2;
    if (kind === 'kds_ticket') return 1;
    return 0;
  };
  const ordered = [...pending].sort((a, b) => {
    const rk = kindRank(a.kind) - kindRank(b.kind);
    if (rk !== 0) return rk;
    return a.createdAt - b.createdAt;
  });

  for (const item of ordered) {
    try {
      const method = item.method ?? 'POST';
      const { ok, status, json } = await requestJson(
        method,
        item.url,
        item.body,
        item.idempotencyKey
      );

      if (isAuthFailure(status)) {
        authRequired = true;
        // Keep all remaining outbox rows — session must be restored first.
        break;
      }

      if (ok || status === 201 || (method === 'PATCH' && status === 200)) {
        if (
          item.kind === 'pos_order' ||
          item.kind === 'customer_order' ||
          item.kind === 'kiosk_order'
        ) {
          const placed = parsePlacedOrderPayload(json);
          if (placed) {
            try {
              await flushKitchenFollowUp(item, placed.orderId);
            } catch (e) {
              if (e instanceof Error && e.message === 'AUTH_REQUIRED') {
                authRequired = true;
                break;
              }
              throw e;
            }
            if (item.localOrderId) {
              await removeLocalTicketsForOrder(item.localOrderId);
            }
          }
        }
        if (item.kind === 'kds_ticket' && item.localOrderId) {
          const local = await findLocalTicket(item.localOrderId);
          const desired =
            local?.status === 'completed' || local?.status === 'canceled'
              ? local.status
              : null;
          const ticketId = parseKitchenTicketId(json);
          if (desired && ticketId) {
            const patched = await requestJson(
              'PATCH',
              `/api/restaurant/kds/tickets/${encodeURIComponent(ticketId)}`,
              JSON.stringify({ status: desired }),
              `${item.idempotencyKey}-${desired}`
            );
            if (isAuthFailure(patched.status)) {
              authRequired = true;
              break;
            }
          }
          await removeLocalTicketsForOrder(item.localOrderId);
        }
        await removeOrderOutboxKey(item.idempotencyKey);
        synced += 1;
        continue;
      }

      // Keep retriable failures; drop only permanent non-auth client errors (e.g. 400).
      if (isRetriableStatus(status)) {
        break;
      }
      // 400/404/etc. — drop poison messages so the queue can progress.
      await removeOrderOutboxKey(item.idempotencyKey);
    } catch (e) {
      if (e instanceof Error && e.message === 'AUTH_REQUIRED') {
        authRequired = true;
      }
      break;
    }
  }

  const remaining = (await listOrderOutbox()).length;
  if (synced > 0 || authRequired) {
    notifyOfflineChanged(authRequired ? 'auth-required' : 'flushed');
  }
  return { synced, authRequired, remaining };
}
