import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  branchCookieName,
  resolveBranchScope,
} from '@/lib/branch/branch-scope';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';

const bodySchema = z.object({
  branchId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const auth = await getRestaurantIdForRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const scope = await resolveBranchScope(
    auth.userId,
    auth.restaurantId,
    parsed.data.branchId
  );
  if (!scope) {
    return NextResponse.json({ error: 'Branch scope unavailable' }, { status: 500 });
  }
  if (!scope.isOwnerOrAdmin) {
    return NextResponse.json(
      { error: 'Only admins can switch branches.' },
      { status: 403 }
    );
  }
  if (!scope.allowedBranchIds.includes(parsed.data.branchId)) {
    return NextResponse.json(
      { error: 'You do not have access to this branch.' },
      { status: 403 }
    );
  }

  const res = NextResponse.json({
    ok: true,
    activeBranchId: parsed.data.branchId,
  });
  res.cookies.set(branchCookieName(auth.restaurantId), parsed.data.branchId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
