import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAppSession } from '@/lib/auth/app-session';
import { syncEmployeeBranches } from '@/lib/branch/branch-scope';
import { db } from '@/lib/db';

const bodySchema = z.object({
  token: z.string().min(16),
});

export async function POST(req: NextRequest) {
  const session = await getAppSession();
  const userId =
    typeof session?.user?.id === 'string' && session.user.id.length > 0
      ? session.user.id
      : null;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const invite = await db.employeeInvite.findUnique({
    where: { token: parsed.data.token },
  });

  if (!invite || invite.status !== 'PENDING') {
    return NextResponse.json(
      { error: 'Invalid or already handled invitation.' },
      { status: 404 }
    );
  }

  if (invite.expiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { error: 'This invitation has expired.' },
      { status: 410 }
    );
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  if (!user?.email) {
    return NextResponse.json(
      { error: 'Your account has no email; cannot accept this invite.' },
      { status: 403 }
    );
  }

  if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return NextResponse.json(
      {
        error:
          'Sign in with the same email address the invitation was sent to.',
      },
      { status: 403 }
    );
  }

  const existing = await db.employee.findUnique({
    where: {
      userId_restaurantId: {
        userId: user.id,
        restaurantId: invite.restaurantId,
      },
    },
  });

  // When a user accepts *any* restaurant invite, they should only be a member of
  // that restaurant. We therefore revoke/decline membership/invites for all other restaurants.
  let employeeId: string | null = existing?.id ?? null;
  await db.$transaction(async (tx) => {
    if (existing) {
      await tx.employeeInvite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED' },
      });
    } else {
      const created = await tx.employee.create({
        data: {
          restaurantId: invite.restaurantId,
          userId: user.id,
          roleId: invite.roleId,
        },
      });
      employeeId = created.id;
      await tx.employeeInvite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED' },
      });
    }

    // Decline any other pending invites for the same email in other restaurants.
    await tx.employeeInvite.updateMany({
      where: {
        email: invite.email,
        status: 'PENDING',
        restaurantId: { not: invite.restaurantId },
      },
      data: { status: 'DECLINED' },
    });

    // Remove membership from all other restaurants.
    await tx.employee.deleteMany({
      where: {
        userId: user.id,
        restaurantId: { not: invite.restaurantId },
      },
    });
  });

  if (employeeId && invite.branchIds.length > 0) {
    await syncEmployeeBranches(
      employeeId,
      invite.branchIds,
      invite.restaurantId
    );
  }

  return NextResponse.json({
    ok: true,
    alreadyMember: Boolean(existing),
  });
}
