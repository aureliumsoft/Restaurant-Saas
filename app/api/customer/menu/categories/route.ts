import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { loadCustomerMenuCategoriesMeta } from '@/lib/menu/load-customer-menu-progressive';
import { resolveCustomerMenuQuery } from '@/lib/menu/resolve-customer-menu-query';

const MENU_CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
};

export async function GET(req: NextRequest) {
  try {
    const resolved = resolveCustomerMenuQuery(req);
    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    const data = await loadCustomerMenuCategoriesMeta(resolved);

    return NextResponse.json(
      { data: data ?? null },
      { status: 200, headers: MENU_CACHE_HEADERS }
    );
  } catch (error) {
    console.error('customer menu categories', error);
    return NextResponse.json(
      { error: 'Failed to load menu categories.' },
      { status: 500 }
    );
  }
}
