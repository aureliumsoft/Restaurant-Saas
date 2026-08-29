import { urlSegment } from '@/lib/url-segment';

/** Base path for a branch-specific kiosk install. */
export function kioskBasePath(
  slug: string,
  branchId: string,
  branchUrlId?: string | null
) {
  return `/kiosk/${encodeURIComponent(slug)}/${encodeURIComponent(urlSegment(branchId, branchUrlId))}`;
}

export function kioskSuccessPath(
  slug: string,
  branchId: string,
  branchUrlId?: string | null
) {
  return `${kioskBasePath(slug, branchId, branchUrlId)}/success`;
}

export function kioskCartStorageKey(slug: string, branchId: string) {
  return `kiosk-cart-${slug}-${branchId}`;
}

export function kioskCheckoutDraftKey(slug: string, branchId: string) {
  return `kiosk-checkout-draft-${slug}-${branchId}`;
}

export type KioskTableLinkOptions = {
  /** When true, optimizes kiosk for phone scans (default). When false, fixed-terminal layout. */
  mobile?: boolean;
};

/** Table QR / deep-link: opens branch kiosk in dine-in mode for a specific table. */
export function kioskTableDeepLink(
  slug: string,
  branchId: string,
  tableId: string,
  opts?: KioskTableLinkOptions & {
    branchUrlId?: string | null;
    tableUrlId?: string | null;
  }
): string {
  const params = new URLSearchParams({
    Method: 'dineIn',
    tableID: urlSegment(tableId, opts?.tableUrlId),
    Mobile: opts?.mobile === false ? 'false' : 'true',
  });
  return `${kioskBasePath(slug, branchId, opts?.branchUrlId)}?${params.toString()}`;
}

export function kioskTableAbsoluteUrl(
  origin: string,
  slug: string,
  branchId: string,
  tableId: string,
  opts?: KioskTableLinkOptions & {
    branchUrlId?: string | null;
    tableUrlId?: string | null;
  }
): string {
  const path = kioskTableDeepLink(slug, branchId, tableId, opts);
  const base = origin.replace(/\/$/, '');
  return `${base}${path}`;
}

export type ParsedKioskDeepLink = {
  mobile: boolean | null;
  method: 'dine_in' | 'take_away' | null;
  tableId: string | null;
};

function parseBooleanParam(raw: string | null | undefined): boolean | null {
  if (raw == null || raw === '') return null;
  const v = raw.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return null;
}

function normalizeMethod(raw: string | null | undefined): ParsedKioskDeepLink['method'] {
  if (!raw?.trim()) return null;
  const v = raw.trim().toLowerCase().replace(/-/g, '_');
  if (v === 'dinein' || v === 'dine_in') return 'dine_in';
  if (v === 'takeaway' || v === 'take_away') return 'take_away';
  return null;
}

/** Read kiosk deep-link params from URL (supports Mobile / Method / tableID spellings). */
export function parseKioskDeepLinkParams(
  searchParams: URLSearchParams | { get(name: string): string | null }
): ParsedKioskDeepLink {
  const get = (name: string) => searchParams.get(name);
  const mobile =
    parseBooleanParam(get('Mobile')) ??
    parseBooleanParam(get('mobile'));
  const method = normalizeMethod(get('Method') ?? get('method'));
  const tableId =
    get('tableID')?.trim() ||
    get('tableId')?.trim() ||
    get('table_id')?.trim() ||
    null;
  return { mobile, method, tableId };
}
