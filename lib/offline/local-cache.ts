import {
  OFFLINE_STORE,
  openOfflineDb,
} from '@/lib/offline/db';

type CacheRow = {
  key: string;
  value: string;
  updatedAt: number;
};

export async function setOfflineCache(
  key: string,
  value: unknown
): Promise<void> {
  const db = await openOfflineDb();
  const row: CacheRow = {
    key,
    value: JSON.stringify(value),
    updatedAt: Date.now(),
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE.cache, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('cache write failed'));
    tx.objectStore(OFFLINE_STORE.cache).put(row);
  });
  db.close();
}

export async function getOfflineCache<T>(key: string): Promise<T | null> {
  const db = await openOfflineDb();
  const row = await new Promise<CacheRow | undefined>((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE.cache, 'readonly');
    const req = tx.objectStore(OFFLINE_STORE.cache).get(key);
    req.onsuccess = () => resolve(req.result as CacheRow | undefined);
    req.onerror = () => reject(req.error ?? new Error('cache read failed'));
  });
  db.close();
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export const OFFLINE_CACHE_KEYS = {
  posMenu: 'pos-menu-v1',
  kdsTicketsMaking: 'kds-tickets-making-v1',
  orderDisplay: 'order-display-v1',
} as const;