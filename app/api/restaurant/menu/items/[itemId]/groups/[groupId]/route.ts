import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { loadRestaurantMenuProductDetailGroup } from '@/lib/menu/load-customer-menu-progressive';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';
import { resolveRouteParams } from '@/lib/resolve-route-id';

type RouteContext = {
  params: Promise<{ itemId: string; groupId: string }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const auth = await getRestaurantForOwnerRequest(req, {
      moduleKeys: ['product', 'pos', 'recommendations'],
      action: 'access',
    });
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { itemId, groupId } = await resolveRouteParams(context.params, [
      'itemId',
      'groupId',
    ]);
    const trimmedItem = itemId?.trim();
    const trimmedGroup = groupId?.trim();
    if (!trimmedItem || !trimmedGroup) {
      return NextResponse.json(
        { error: 'Missing product or group id.' },
        { status: 400 }
      );
    }

    const data = await loadRestaurantMenuProductDetailGroup({
      restaurantId: auth.restaurant.id,
      itemId: trimmedItem,
      groupId: trimmedGroup,
    });

    if (!data) {
      return NextResponse.json({ error: 'Group not found.' }, { status: 404 });
    }

    return NextResponse.json(
      { data },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    console.error('restaurant menu product detail group', error);
    return NextResponse.json(
      { error: 'Failed to load group.' },
      { status: 500 }
    );
  }
}
