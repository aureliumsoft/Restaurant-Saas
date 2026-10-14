import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requirePlatformAdmin } from '@/lib/auth/adminRequest';
import { applyCustomPlanDecision } from '@/lib/custom-plan-request-admin';
import { db } from '@/lib/db';
import { resolveRouteParams } from '@/lib/resolve-route-id';

const patchSchema = z.object({
  action: z.enum(['accept', 'reject']),
  restaurantId: z.string().trim().min(1).max(64).optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ requestId: string }> }
) {
  const auth = await requirePlatformAdmin(req);
  if ('error' in auth) return auth.error;

  const { requestId } = await resolveRouteParams(ctx.params, ['requestId']);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.restaurantId) {
    const exists = await db.restaurant.findUnique({
      where: { id: parsed.data.restaurantId },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      );
    }
  }

  const reviewerId =
    typeof auth.session?.user?.id === 'string' ? auth.session.user.id : null;

  const result = await applyCustomPlanDecision({
    requestId,
    action: parsed.data.action,
    reviewedByUserId: reviewerId,
    restaurantIdOverride: parsed.data.restaurantId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 400 }
    );
  }

  return NextResponse.json({
    data: {
      id: requestId,
      status: result.status,
      plan: result.plan,
      restaurantId: result.restaurantId,
    },
  });
}
