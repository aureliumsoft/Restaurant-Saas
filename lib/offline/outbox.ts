import {
  notifyOfflineChanged,
  OFFLINE_STORE,
  openOfflineDb,
} from '@/lib/offline/db';

export type OutboxKind =
  | 'customer_order'
  | 'kiosk_order'
  | 'pos_order'
  | 'kds_ticket'
  | 'kds_status';

export type OutboxFollowUp = {
  kind: 'kds_ticket';
  url: string;
  /** JSON body; `{{orderId}}` replaced with synced cloud order id. */
  bodyTemplate: string;
};

export type OutboxRecord = {
  idempotencyKey: string;
  url: string;
  body: string;
  kind: OutboxKind;
  createdAt: number;
  method?: 'POST' | 'PATCH';
  followUp?: OutboxFollowUp | null;
  /** Temp local id used while queued (`offline-…`). */
  localOrderId?: string | null;
};

export async function enqueueOrderOutbox(record: OutboxRecord): Promise<void> {
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE.outbox, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('enqueue failed'));
    tx.objectStore(OFFLINE_STORE.outbox).put(record);
  });
  db.close();
  notifyOfflineChanged('outbox');
}

export async function updateOrderOutbox(
  idempotencyKey: string,
  patch: Partial<OutboxRecord>
): Promise<OutboxRecord | null> {
  const db = await openOfflineDb();
  const updated = await new Promise<OutboxRecord | null>((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE.outbox, 'readwrite');
    const store = tx.objectStore(OFFLINE_STORE.outbox);
    const getReq = store.get(idempotencyKey);
    getReq.onsuccess = () => {
      const existing = getReq.result as OutboxRecord | undefined;
      if (!existing) {
        resolve(null);
        return;
      }
      const next = { ...existing, ...patch, idempotencyKey };
      store.put(next);
      resolve(next);
    };
    getReq.onerror = () => reject(getReq.error ?? new Error('update failed'));
  });
  db.close();
  if (updated) notifyOfflineChanged('outbox');
  return updated;
}

export async function listOrderOutbox(): Promise<OutboxRecord[]> {
  const db = await openOfflineDb();
  const rows = await new Promise<OutboxRecord[]>((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE.outbox, 'readonly');
    const req = tx.objectStore(OFFLINE_STORE.outbox).getAll();
    req.onsuccess = () => resolve((req.result as OutboxRecord[]) ?? []);
    req.onerror = () => reject(req.error ?? new Error('list failed'));
  });
  db.close();
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeOrderOutboxKey(
  idempotencyKey: string
): Promise<void> {
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE.outbox, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('remove failed'));
    tx.objectStore(OFFLINE_STORE.outbox).delete(idempotencyKey);
  });
  db.close();
  notifyOfflineChanged('outbox');
}

export async function countOrderOutbox(): Promise<number> {
  const list = await listOrderOutbox();
  return list.length;
}

export function offlineLocalOrderId(idempotencyKey: string): string {
  return `offline-${idempotencyKey}`;
}

export function isOfflineLocalOrderId(id: string): boolean {
  return id.startsWith('offline-');
}
