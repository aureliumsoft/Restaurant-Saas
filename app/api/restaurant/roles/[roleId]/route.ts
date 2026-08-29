import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import { normalizeDashboardPermissions } from '@/lib/dashboard-permissions';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import { RESTAURANT_ROLE_SLUG } from '@/lib/restaurant-roles';
import { getRestaurantPlanFeatures, subscriptionPlanDeniedResponse } from '@/lib/subscription-plan-enforcement';
import { resolveRouteParams } from '@/lib/resolve-route-id';

const patchSchema = z.object({
  name: z.string().min(1).max(80).trim().optional(),
  permissions: z.array(z.string()).optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ roleId: string }> }
) {
  const auth = await getRestaurantIdForRequest(req, {
    moduleKey: 'settings',
    action: 'edit',
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { roleId } = await resolveRouteParams(context.params, ['roleId']);
  if (!roleId) {
    return NextResponse.json({ error: 'Missing role id' }, { status: 400 });
  }

  const existing = await db.role.findFirst({
    where: { id: roleId, restaurantId: auth.restaurantId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Role not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const planFeatures = await getRestaurantPlanFeatures(auth.restaurantId);
  if (!planFeatures.roleBasedSettings && parsed.data.permissions !== undefined) {
    return subscriptionPlanDeniedResponse('Per-role dashboard permissions');
  }

  if (!parsed.data.name && parsed.data.permissions === undefined) {
    return NextResponse.json(
      { error: 'Nothing to update' },
      { status: 400 }
    );
  }

  const permissionNames =
    parsed.data.permissions !== undefined
      ? normalizeDashboardPermissions(parsed.data.permissions)
      : null;

  const updated = await db.$transaction(async (tx) => {
    if (permissionNames !== null) {
      await tx.permission.deleteMany({ where: { roleId } });
      if (permissionNames.length > 0) {
        await tx.permission.createMany({
          data: permissionNames.map((name) => ({ name, roleId })),
        });
      }
    }
    if (parsed.data.name !== undefined) {
      await tx.role.update({
        where: { id: roleId },
        data: { name: parsed.data.name },
      });
    }
    return tx.role.findFirst({
      where: { id: roleId },
      include: { permissions: { select: { name: true } } },
    });
  });

  if (!updated) {
    return NextResponse.json({ error: 'Role not found' }, { status: 404 });
  }

  return NextResponse.json({
    role: {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      permissions: updated.permissions.map((p) => p.name),
    },
  });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ roleId: string }> }
) {
  const auth = await getRestaurantIdForRequest(req, {
    moduleKey: 'settings',
    action: 'delete',
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { roleId } = await resolveRouteParams(context.params, ['roleId']);
  if (!roleId) {
    return NextResponse.json({ error: 'Missing role id' }, { status: 400 });
  }

  const existing = await db.role.findFirst({
    where: { id: roleId, restaurantId: auth.restaurantId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Role not found' }, { status: 404 });
  }

  if (
    existing.slug === RESTAURANT_ROLE_SLUG.OWNER ||
    existing.slug === RESTAURANT_ROLE_SLUG.ADMIN
  ) {
    return NextResponse.json(
      { error: 'Preset roles (Owner, Admin) cannot be deleted.' },
      { status: 403 }
    );
  }

  const assigned = await db.employee.count({ where: { roleId } });
  if (assigned > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete this role while ${assigned} employee(s) are assigned to it.`,
      },
      { status: 409 }
    );
  }

  await db.role.delete({ where: { id: roleId } });
  return NextResponse.json({ ok: true });
}
