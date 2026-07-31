/** Shared IndexedDB for offline POS / KDS / order-display. */

export const OFFLINE_DB_NAME = 'restaurant-saas-offline';
export const OFFLINE_DB_VERSION = 2;

export const OFFLINE_STORE = {
  outbox: 'orderOutbox',
  cache: 'kvCache',
  localTickets: 'localTickets',
} as const;

export function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('IDB open failed'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OFFLINE_STORE.outbox)) {
        db.createObjectStore(OFFLINE_STORE.outbox, {
          keyPath: 'idempotencyKey',
        });
      }
      if (!db.objectStoreNames.contains(OFFLINE_STORE.cache)) {
        db.createObjectStore(OFFLINE_STORE.cache, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(OFFLINE_STORE.localTickets)) {
        db.createObjectStore(OFFLINE_STORE.localTickets, { keyPath: 'id' });
      }
    };
  });
}

export function notifyOfflineChanged(detail?: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('offline-outbox-changed', { detail })
  );
  try {
    const bc = new BroadcastChannel('foodluk-offline-sync');
    bc.postMessage({ type: 'changed', detail: detail ?? null });
    bc.close();
  } catch {
    /* BroadcastChannel optional */
  }
}

export function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function isLikelyNetworkFailure(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as { name?: string; message?: string };
  if (err.name === 'TypeError') {
    const msg = String(err.message ?? '');
    if (
      msg.includes('fetch') ||
      msg.includes('network') ||
      msg.includes('Failed to fetch')
    ) {
      return true;
    }
  }
  return false;
}
