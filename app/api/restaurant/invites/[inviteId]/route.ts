import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import { resolveRouteParams } from '@/lib/resolve-route-id';

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ inviteId: string }> }
) {
  const auth = await getRestaurantIdForRequest(req, {
    moduleKey: 'settings',
    action: 'delete',
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { inviteId } = await resolveRouteParams(context.params, ['inviteId']);
  if (!inviteId) {
    return NextResponse.json({ error: 'Missing invite id' }, { status: 400 });
  }

  const invite = await db.employeeInvite.findFirst({
    where: {
      id: inviteId,
      restaurantId: auth.restaurantId,
      status: 'PENDING',
    },
  });
  if (!invite) {
    return NextResponse.json({ error: 'Invite not found.' }, { status: 404 });
  }

  await db.employeeInvite.delete({ where: { id: invite.id } });
  return NextResponse.json({ ok: true });
}
