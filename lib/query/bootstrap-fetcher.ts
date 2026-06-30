import type { StaffBootstrapResponse } from '@/types/staff-bootstrap';
import { STAFF_BOOTSTRAP_KEY } from '@/types/staff-bootstrap';

export async function fetchStaffBootstrap(): Promise<StaffBootstrapResponse> {
  const res = await fetch(STAFF_BOOTSTRAP_KEY, { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      typeof body?.error === 'string' ? body.error : `Bootstrap failed (${res.status})`;
    throw new Error(message);
  }
  return res.json() as Promise<StaffBootstrapResponse>;
}
