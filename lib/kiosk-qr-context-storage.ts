export type KioskQrContext = {
  fromTableQr: boolean;
  isMobileScan: boolean;
  tableId: string;
  fulfillment: 'dine_in';
};

function storageKey(slug: string, branchId: string) {
  return `kiosk-qr-ctx:${slug}:${branchId}`;
}

export function saveKioskQrContext(
  slug: string,
  branchId: string,
  ctx: KioskQrContext
) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(storageKey(slug, branchId), JSON.stringify(ctx));
  } catch {
    // ignore quota / private mode
  }
}

export function loadKioskQrContext(
  slug: string,
  branchId: string
): KioskQrContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(storageKey(slug, branchId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<KioskQrContext>;
    if (
      parsed.fromTableQr !== true ||
      !parsed.tableId?.trim() ||
      parsed.fulfillment !== 'dine_in'
    ) {
      return null;
    }
    return {
      fromTableQr: true,
      isMobileScan: parsed.isMobileScan !== false,
      tableId: parsed.tableId.trim(),
      fulfillment: 'dine_in',
    };
  } catch {
    return null;
  }
}

export function clearKioskQrContext(slug: string, branchId: string) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(storageKey(slug, branchId));
  } catch {
    // ignore
  }
}
