import {
  notifyOfflineChanged,
  OFFLINE_STORE,
  openOfflineDb,
} from '@/lib/offline/db';

/** Optimistic kitchen / display ticket while POS order is still in the outbox. */
export type LocalOfflineTicket = {
  id: string;
  orderId: string;
  shortOrderId: string;
  ticketNumber: number | null;
  status: 'making' | 'completed' | 'canceled';
  startedAt: string;
  selectedMinutes: number;
  items: Array<{ id: string; productName: string; quantity: number }>;
  source: 'pos_offline';
  createdAt: number;
};

export async function upsertLocalTicket(
  ticket: LocalOfflineTicket
): Promise<void> {
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE.localTickets, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('local ticket write failed'));
    tx.objectStore(OFFLINE_STORE.localTickets).put(ticket);
  });
  db.close();
  notifyOfflineChanged('localTickets');
}

export async function listLocalTickets(): Promise<LocalOfflineTicket[]> {
  const db = await openOfflineDb();
  const rows = await new Promise<LocalOfflineTicket[]>((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE.localTickets, 'readonly');
    const req = tx.objectStore(OFFLINE_STORE.localTickets).getAll();
    req.onsuccess = () =>
      resolve((req.result as LocalOfflineTicket[]) ?? []);
    req.onerror = () => reject(req.error ?? new Error('local ticket list failed'));
  });
  db.close();
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function listLocalMakingTickets(): Promise<LocalOfflineTicket[]> {
  const all = await listLocalTickets();
  return all.filter((t) => t.status === 'making');
}

export async function listLocalCompletedTickets(): Promise<LocalOfflineTicket[]> {
  const all = await listLocalTickets();
  return all
    .filter((t) => t.status === 'completed')
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function findLocalTicket(
  ticketOrOrderId: string
): Promise<LocalOfflineTicket | null> {
  const all = await listLocalTickets();
  return (
    all.find(
      (t) =>
        t.id === ticketOrOrderId ||
        t.orderId === ticketOrOrderId ||
        t.id === `local-ticket-${ticketOrOrderId}`
    ) ?? null
  );
}

export async function updateLocalTicketStatus(
  id: string,
  status: LocalOfflineTicket['status']
): Promise<boolean> {
  const existing = await findLocalTicket(id);
  if (!existing) return false;

  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE.localTickets, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error('local ticket update failed'));
    tx.objectStore(OFFLINE_STORE.localTickets).put({ ...existing, status });
  });
  db.close();
  notifyOfflineChanged('localTickets');
  return true;
}

export async function removeLocalTicket(id: string): Promise<void> {
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE.localTickets, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('local ticket remove failed'));
    tx.objectStore(OFFLINE_STORE.localTickets).delete(id);
  });
  db.close();
  notifyOfflineChanged('localTickets');
}

export async function removeLocalTicketsForOrder(
  orderId: string
): Promise<void> {
  const all = await listLocalTickets();
  const matches = all.filter(
    (t) =>
      t.orderId === orderId ||
      t.id === orderId ||
      t.id === `local-ticket-${orderId}`
  );
  for (const t of matches) {
    await removeLocalTicket(t.id);
  }
}
