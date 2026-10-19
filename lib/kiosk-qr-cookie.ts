/** Cookie so table-QR dine-in survives Google OAuth when the URL query is stripped. */
export const KIOSK_TABLE_QR_COOKIE = 'foodluk_kiosk_table_qr';

export type KioskTableQrCookiePayload = {
  slug: string;
  branchId: string;
  tableId: string;
  mobile: boolean;
};

export function serializeKioskTableQrCookie(
  payload: KioskTableQrCookiePayload
): string {
  return encodeURIComponent(
    JSON.stringify({
      slug: payload.slug.trim(),
      branchId: payload.branchId.trim(),
      tableId: payload.tableId.trim(),
      mobile: payload.mobile !== false,
    })
  );
}

export function parseKioskTableQrCookie(
  raw: string | null | undefined
): KioskTableQrCookiePayload | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw.trim())) as Partial<
      KioskTableQrCookiePayload
    >;
    if (
      !parsed.slug?.trim() ||
      !parsed.branchId?.trim() ||
      !parsed.tableId?.trim()
    ) {
      return null;
    }
    return {
      slug: parsed.slug.trim(),
      branchId: parsed.branchId.trim(),
      tableId: parsed.tableId.trim(),
      mobile: parsed.mobile !== false,
    };
  } catch {
    return null;
  }
}

/** Client-only: mark this browser as mid table-QR dine-in for the branch. */
export function setKioskTableQrCookie(payload: KioskTableQrCookiePayload) {
  if (typeof document === 'undefined') return;
  const value = serializeKioskTableQrCookie(payload);
  const maxAge = 60 * 60 * 6; // 6h
  document.cookie = `${KIOSK_TABLE_QR_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export function clearKioskTableQrCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${KIOSK_TABLE_QR_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function readKioskTableQrCookieFromDocument(): KioskTableQrCookiePayload | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${KIOSK_TABLE_QR_COOKIE}=`));
  if (!match) return null;
  return parseKioskTableQrCookie(match.slice(KIOSK_TABLE_QR_COOKIE.length + 1));
}

export function kioskTableQrCookieMatches(
  cookie: KioskTableQrCookiePayload | null,
  slug: string,
  branchId: string
): boolean {
  if (!cookie) return false;
  const slugOk = cookie.slug === slug;
  const branchOk =
    cookie.branchId === branchId ||
    cookie.branchId === decodeURIComponent(branchId);
  return slugOk && branchOk && Boolean(cookie.tableId);
}
