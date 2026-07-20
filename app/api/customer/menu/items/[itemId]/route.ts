import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { loadCustomerMenuProductDetail } from '@/lib/menu/load-customer-menu-progressive';
import { resolveCustomerMenuQuery } from '@/lib/menu/resolve-customer-menu-query';

const MENU_CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
};

type RouteContext = { params: Promise<{ itemId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { itemId } = await context.params;
    const trimmed = itemId?.trim();
    if (!trimmed) {
      return NextResponse.json({ error: 'Missing product id.' }, { status: 400 });
    }

    const resolved = resolveCustomerMenuQuery(req);
    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    const data = await loadCustomerMenuProductDetail({
      ...resolved,
      itemId: trimmed,
    });

    if (!data) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }

    return NextResponse.json(
      { data },
      { status: 200, headers: MENU_CACHE_HEADERS }
    );
  } catch (error) {
    console.error('customer menu product detail', error);
    return NextResponse.json(
      { error: 'Failed to load product.' },
      { status: 500 }
    );
  }
}
