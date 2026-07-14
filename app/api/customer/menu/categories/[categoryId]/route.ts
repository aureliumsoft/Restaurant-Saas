import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { loadCustomerMenuCategoryItems } from '@/lib/menu/load-customer-menu-progressive';
import { resolveCustomerMenuQuery } from '@/lib/menu/resolve-customer-menu-query';

type RouteContext = { params: Promise<{ categoryId: string }> };

const MENU_CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { categoryId } = await context.params;
    const trimmed = categoryId?.trim();
    if (!trimmed) {
      return NextResponse.json({ error: 'Missing category id.' }, { status: 400 });
    }

    const resolved = resolveCustomerMenuQuery(req);
    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    const data = await loadCustomerMenuCategoryItems({
      ...resolved,
      categoryId: trimmed,
    });

    if (!data) {
      return NextResponse.json({ error: 'Category not found.' }, { status: 404 });
    }

    return NextResponse.json(
      { data },
      { status: 200, headers: MENU_CACHE_HEADERS }
    );
  } catch (error) {
    console.error('customer menu category items', error);
    return NextResponse.json(
      { error: 'Failed to load category products.' },
      { status: 500 }
    );
  }
}
