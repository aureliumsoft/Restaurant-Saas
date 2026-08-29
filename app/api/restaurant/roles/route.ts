import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import { normalizeDashboardPermissions } from '@/lib/dashboard-permissions';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import { getRestaurantPlanFeatures, subscriptionPlanDeniedResponse } from '@/lib/subscription-plan-enforcement';
import { withUrlIds } from '@/lib/with-url-id';

const createSchema = z.object({
  name: z.string().min(1).max(80).trim(),
  permissions: z.array(z.string()).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await getRestaurantIdForRequest(req, {
    moduleKey: 'settings',
    action: 'access',
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const roles = await db.role.findMany({
    where: { restaurantId: auth.restaurantId },
    include: { permissions: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({
    roles: withUrlIds(
      roles.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        permissions: r.permissions.map((p) => p.name),
      }))
    ),
  });
}

export async function POST(req: NextRequest) {
  const auth = await getRestaurantIdForRequest(req, {
    moduleKey: 'settings',
    action: 'edit',
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const planFeatures = await getRestaurantPlanFeatures(auth.restaurantId);
  if (!planFeatures.roleBasedSettings) {
    return subscriptionPlanDeniedResponse("Custom roles and permission presets");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const permissionNames = normalizeDashboardPermissions(
    parsed.data.permissions ?? []
  );

  const role = await db.role.create({
    data: {
      name: parsed.data.name,
      restaurantId: auth.restaurantId,
      permissions: {
        create: permissionNames.map((name) => ({ name })),
      },
    },
    include: { permissions: { select: { name: true } } },
  });

  return NextResponse.json(
    {
      role: {
        id: role.id,
        name: role.name,
        slug: role.slug,
        permissions: role.permissions.map((p) => p.name),
      },
    },
    { status: 201 }
  );
}
