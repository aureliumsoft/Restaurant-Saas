import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { loadCustomerMenuProductDetailGroup } from '@/lib/menu/load-customer-menu-progressive';
import { resolveCustomerMenuQuery } from '@/lib/menu/resolve-customer-menu-query';
import { resolveRouteParams } from '@/lib/resolve-route-id';

const MENU_CACHE_HEADERS = {
  'Cache-Control': 'private, no-store',
};

type RouteContext = {
  params: Promise<{ itemId: string; groupId: string }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
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

    const resolved = resolveCustomerMenuQuery(req);
    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    const data = await loadCustomerMenuProductDetailGroup({
      ...resolved,
      itemId: trimmedItem,
      groupId: trimmedGroup,
    });

    if (!data) {
      return NextResponse.json({ error: 'Group not found.' }, { status: 404 });
    }

    return NextResponse.json(
      { data },
      { status: 200, headers: MENU_CACHE_HEADERS }
    );
  } catch (error) {
    console.error('customer menu product detail group', error);
    return NextResponse.json(
      { error: 'Failed to load group.' },
      { status: 500 }
    );
  }
}
