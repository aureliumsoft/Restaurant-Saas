import type { StaffBootstrapResponse } from '@/types/staff-bootstrap';
import { STAFF_BOOTSTRAP_KEY } from '@/types/staff-bootstrap';

const BOOTSTRAP_SESSION_CACHE_KEY = 'staff-bootstrap-cache-v1';
const BOOTSTRAP_CACHE_TTL_MS = 120_000;

type BootstrapCacheEnvelope = {
  at: number;
  email: string;
  response: StaffBootstrapResponse;
};

export function readStaffBootstrapSessionCache(
  email: string | null | undefined
): StaffBootstrapResponse | undefined {
  if (typeof window === 'undefined' || !email) return undefined;
  try {
    const raw = sessionStorage.getItem(BOOTSTRAP_SESSION_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as BootstrapCacheEnvelope;
    if (parsed.email !== email) return undefined;
    if (Date.now() - parsed.at > BOOTSTRAP_CACHE_TTL_MS) return undefined;
    if (!parsed.response?.data) return undefined;
    return parsed.response;
  } catch {
    return undefined;
  }
}

export function writeStaffBootstrapSessionCache(
  email: string | null | undefined,
  response: StaffBootstrapResponse
) {
  if (typeof window === 'undefined' || !email || !response?.data) return;
  try {
    const envelope: BootstrapCacheEnvelope = {
      at: Date.now(),
      email,
      response,
    };
    sessionStorage.setItem(BOOTSTRAP_SESSION_CACHE_KEY, JSON.stringify(envelope));
  } catch {
    /* ignore quota */
  }
}

export function clearStaffBootstrapSessionCache() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(BOOTSTRAP_SESSION_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

export async function fetchStaffBootstrap(
  email?: string | null
): Promise<StaffBootstrapResponse> {
  const res = await fetch(STAFF_BOOTSTRAP_KEY, { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      typeof body?.error === 'string'
        ? body.error
        : `Bootstrap failed (${res.status})`;
    throw new Error(message);
  }
  const json = (await res.json()) as StaffBootstrapResponse;
  writeStaffBootstrapSessionCache(email, json);
  return json;
}
