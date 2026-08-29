import { NextResponse } from 'next/server';

import { loadPublicDocModuleById } from '@/lib/documentation/public';
import { resolveRouteParams } from '@/lib/resolve-route-id';

type Ctx = { params: Promise<{ id: string }> };

/** Public detail for a published documentation module (Read more dialog). */
export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await resolveRouteParams(ctx.params, ['id']);
    if (!id?.trim()) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }
    const item = await loadPublicDocModuleById(id);
    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ data: item });
  } catch (e) {
    console.error('documentation/[id] GET', e);
    return NextResponse.json(
      { error: 'Failed to load documentation' },
      { status: 500 }
    );
  }
}
