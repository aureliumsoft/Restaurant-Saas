import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { loadCustomerMenuCategoriesMeta } from '@/lib/menu/load-customer-menu-progressive';
import { resolveCustomerMenuQuery } from '@/lib/menu/resolve-customer-menu-query';

export async function GET(req: NextRequest) {
  try {
    const resolved = resolveCustomerMenuQuery(req);
    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    const data = await loadCustomerMenuCategoriesMeta(resolved);

    return NextResponse.json({ data: data ?? null }, { status: 200 });
  } catch (error) {
    console.error('customer menu categories', error);
    return NextResponse.json(
      { error: 'Failed to load menu categories.' },
      { status: 500 }
    );
  }
}
