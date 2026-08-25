import { getOfflineCache, setOfflineCache } from '@/lib/offline/local-cache';

function utcDateKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

function seqKey(branchId: string | null | undefined): string {
  const branch = (branchId ?? '').trim() || 'main';
  return `ticket-seq:${branch}:${utcDateKey()}`;
}

function branchIdFromBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const id = (body as { branchId?: unknown }).branchId;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

/** Next daily ticket for this device/branch. Never reused on this machine. */
export async function allocateLocalTicketNumber(
  branchId?: string | null
): Promise<number> {
  const key = seqKey(branchId);
  const current = (await getOfflineCache<number>(key)) ?? 0;
  const next = Math.max(1, Math.floor(current) + 1);
  await setOfflineCache(key, next);
  return next;
}

/** After a successful cloud save, keep local sequence at/above that ticket. */
export async function rememberLocalTicketHighWater(
  branchId: string | null | undefined,
  ticketNumber: number | null | undefined
): Promise<void> {
  if (typeof ticketNumber !== 'number' || !Number.isFinite(ticketNumber)) {
    return;
  }
  const n = Math.floor(ticketNumber);
  if (n < 1) return;
  const key = seqKey(branchId);
  const current = (await getOfflineCache<number>(key)) ?? 0;
  if (n > current) await setOfflineCache(key, n);
}

export async function stampPosTicketNumber(body: unknown): Promise<{
  payload: unknown;
  ticketNumber: number;
}> {
  const existing =
    body && typeof body === 'object'
      ? (body as { ticketNumber?: unknown }).ticketNumber
      : undefined;
  if (typeof existing === 'number' && Number.isInteger(existing) && existing > 0) {
    await rememberLocalTicketHighWater(branchIdFromBody(body), existing);
    return { payload: body, ticketNumber: existing };
  }
  const ticketNumber = await allocateLocalTicketNumber(branchIdFromBody(body));
  const payload =
    body && typeof body === 'object'
      ? { ...(body as Record<string, unknown>), ticketNumber }
      : { ticketNumber };
  return { payload, ticketNumber };
}

export { branchIdFromBody };
