import { normalizeCartModifiers } from '@/lib/cart-normalize';

const MAX_STORED_IMAGE_URL_LENGTH = 512;

function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: string; code?: number; message?: string };
  return (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22 ||
    e.code === 1014 ||
    /quota/i.test(String(e.message ?? ''))
  );
}

/** Only keep short http(s) image URLs — drop base64 data URLs that blow storage. */
export function compactCartImageUrl(imageUrl: unknown): string | null {
  if (typeof imageUrl !== 'string') return null;
  const trimmed = imageUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) return null;
  if (trimmed.length > MAX_STORED_IMAGE_URL_LENGTH) return null;
  return trimmed;
}

/**
 * Slim cart lines for localStorage: IDs, prices, modifiers only.
 * Descriptions and large images are omitted so quota stays healthy.
 */
export function compactCartLinesForStorage(lines: unknown[]): unknown[] {
  if (!Array.isArray(lines)) return [];

  return lines
    .filter((row) => row && typeof row === 'object')
    .map((row) => {
      const line = row as Record<string, unknown>;
      const compact: Record<string, unknown> = {
        lineId: String(line.lineId ?? ''),
        menuItemId: String(line.menuItemId ?? ''),
        productName: String(line.productName ?? 'Item'),
        description: null,
        imageUrl: compactCartImageUrl(line.imageUrl),
        baseUnitPrice: Number(line.baseUnitPrice) || 0,
        quantity: Math.max(1, Math.floor(Number(line.quantity) || 1)),
        modifiers: normalizeCartModifiers(line.modifiers),
        modifiersSignature: String(line.modifiersSignature ?? ''),
      };

      if (line.variationId != null && line.variationId !== '') {
        compact.variationId = String(line.variationId);
      }
      if (typeof line.variationName === 'string' && line.variationName.trim()) {
        compact.variationName = line.variationName.trim();
      }
      if (
        line.variationPriceOverride != null &&
        Number.isFinite(Number(line.variationPriceOverride))
      ) {
        compact.variationPriceOverride = Number(line.variationPriceOverride);
      }
      if (
        line.variationPriceDelta != null &&
        Number.isFinite(Number(line.variationPriceDelta))
      ) {
        compact.variationPriceDelta = Number(line.variationPriceDelta);
      }
      if (
        typeof line.offeredProductName === 'string' &&
        line.offeredProductName.trim()
      ) {
        compact.offeredProductName = line.offeredProductName.trim();
      }

      return compact;
    })
    .filter((line) => Boolean(line.lineId) && Boolean(line.menuItemId));
}

/** Remove stale online (`cart-*`) and kiosk (`kiosk-cart-*`) entries except the active key. */
export function purgeOtherCartStorageKeys(keepKey: string): number {
  if (typeof window === 'undefined') return 0;
  let removed = 0;
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || key === keepKey) continue;
    if (key.startsWith('cart-') || key.startsWith('kiosk-cart-')) {
      toRemove.push(key);
    }
  }
  for (const key of toRemove) {
    try {
      localStorage.removeItem(key);
      removed += 1;
    } catch {
      /* ignore */
    }
  }
  return removed;
}

/**
 * Persist cart compactly. On QuotaExceededError, purge other cart keys and retry.
 * Never throws — product select must not crash the page.
 */
export function writeCartToLocalStorage(
  storageKey: string,
  lines: unknown[]
): { ok: boolean; purged: boolean } {
  if (typeof window === 'undefined') return { ok: false, purged: false };

  const payload = JSON.stringify(compactCartLinesForStorage(lines));

  try {
    localStorage.setItem(storageKey, payload);
    return { ok: true, purged: false };
  } catch (error) {
    if (!isQuotaExceededError(error)) {
      console.warn('cart storage write failed', error);
      return { ok: false, purged: false };
    }
  }

  // Storage full: clear other carts, then retry once.
  purgeOtherCartStorageKeys(storageKey);
  try {
    localStorage.setItem(storageKey, payload);
    return { ok: true, purged: true };
  } catch (error) {
    // Still too large — drop images from payload and try a minimal write.
    try {
      const minimal = compactCartLinesForStorage(lines).map((row) => {
        const line = { ...(row as Record<string, unknown>) };
        line.imageUrl = null;
        line.description = null;
        return line;
      });
      localStorage.setItem(storageKey, JSON.stringify(minimal));
      return { ok: true, purged: true };
    } catch (retryError) {
      console.warn('cart storage quota exceeded', retryError);
      return { ok: false, purged: true };
    }
  }
}

export function onlineCartStorageKey(orderId: string): string {
  return `cart-${orderId}`;
}
