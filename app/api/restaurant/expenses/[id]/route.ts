import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { expenseManualPatchSchema } from '@/lib/expenses/validation';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';
import { resolveRouteParams } from '@/lib/resolve-route-id';

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: 'expenses',
    action: 'edit',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await resolveRouteParams(ctx.params, ['id']);

  const existing = await db.expense.findFirst({
    where: { id, restaurantId: auth.restaurant.id },
    select: { id: true, type: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (existing.type !== 'MANUAL') {
    return NextResponse.json(
      { error: 'Only manual expenses can be edited.' },
      { status: 400 }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = expenseManualPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await db.expense.update({
    where: { id },
    data: {
      ...(parsed.data.title !== undefined
        ? { title: parsed.data.title.trim() }
        : {}),
      ...(parsed.data.amount !== undefined ? { amount: parsed.data.amount } : {}),
      ...(parsed.data.notes !== undefined
        ? { notes: parsed.data.notes?.trim() || null }
        : {}),
      ...(parsed.data.occurredAt !== undefined
        ? { occurredAt: parsed.data.occurredAt }
        : {}),
    },
    select: {
      id: true,
      type: true,
      title: true,
      amount: true,
      notes: true,
      occurredAt: true,
      quantity: true,
      branchId: true,
      ingredientId: true,
      createdAt: true,
      ingredient: { select: { id: true, name: true, unit: true } },
      branch: { select: { id: true, name: true } },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return NextResponse.json({
    data: {
      ...updated,
      occurredAt: updated.occurredAt.toISOString(),
      createdAt: updated.createdAt.toISOString(),
    },
  });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: 'expenses',
    action: 'delete',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await resolveRouteParams(ctx.params, ['id']);

  const existing = await db.expense.findFirst({
    where: { id, restaurantId: auth.restaurant.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await db.expense.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
