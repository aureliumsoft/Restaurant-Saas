import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  clearCustomerSessionCookie,
  destroyCustomerAccountSession,
} from '@/lib/customer-auth/session';

export async function POST(req: NextRequest) {
  try {
    await destroyCustomerAccountSession(req);
  } catch (error) {
    console.error('customer-auth logout', error);
  }
  const res = NextResponse.json({ data: { ok: true } });
  clearCustomerSessionCookie(res);
  return res;
}
