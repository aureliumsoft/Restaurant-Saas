import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  applyFinalViewReorder,
  finalViewReorderSchema,
  loadFinalViewCatalog,
} from '@/lib/menu/final-view';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';

export async function GET(req: NextRequest) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKeys: ['final-view', 'categories', 'product'],
    action: 'access',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const categories = await loadFinalViewCatalog(auth.restaurant.id);
    return NextResponse.json({ data: { categories } });
  } catch (e) {
    console.error('final-view GET', e);
    return NextResponse.json(
      { error: 'Failed to load Final View catalog' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKeys: ['final-view'],
    action: 'edit',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = finalViewReorderSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await applyFinalViewReorder(
      auth.restaurant.id,
      parsed.data
    );
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    console.error('final-view POST', e);
    return NextResponse.json(
      { error: 'Failed to save Final View order' },
      { status: 500 }
    );
  }
}
