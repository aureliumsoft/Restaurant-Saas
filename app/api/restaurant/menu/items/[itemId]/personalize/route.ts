import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { personalizeGroupsSelect } from '@/lib/menu/personalize-groups-select';
import { syncMenuItemPersonalizeGroups } from '@/lib/menu/sync-personalize-groups';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';
import { syncPersonalizeGroupsSchema } from '@/lib/validation/personalize';
import { resolveRouteParams } from '@/lib/resolve-route-id';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ itemId: string }> }
) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: 'recommendations',
    action: 'access',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { itemId } = await resolveRouteParams(ctx.params, ['itemId']);
  const item = await db.menuItem.findFirst({
    where: { id: itemId, restaurantId: auth.restaurant.id },
    select: {
      id: true,
      personalizeGroups: personalizeGroupsSelect,
    },
  });
  if (!item) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  return NextResponse.json({ data: item.personalizeGroups }, { status: 200 });
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ itemId: string }> }
) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: 'recommendations',
    action: 'edit',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { itemId } = await resolveRouteParams(ctx.params, ['itemId']);
  const item = await db.menuItem.findFirst({
    where: { id: itemId, restaurantId: auth.restaurant.id },
    select: { id: true },
  });
  if (!item) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = syncPersonalizeGroupsSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await syncMenuItemPersonalizeGroups(db, itemId, parsed.data.groups);
    const groups = await db.menuItemPersonalizeGroup.findMany({
      where: { menuItemId: itemId },
      orderBy: personalizeGroupsSelect.orderBy,
      select: personalizeGroupsSelect.select,
    });
    return NextResponse.json({ data: groups }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to save personalize groups' },
      { status: 500 }
    );
  }
}
