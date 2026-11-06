import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requirePlatformAdmin } from '@/lib/auth/adminRequest';
import { migrateRestaurantBase64ImagesToSupabase } from '@/lib/migrate-base64-images-to-supabase';
import { resolveRouteId } from '@/lib/resolve-route-id';

export const runtime = 'nodejs';
/** Large restaurants may take several minutes. */
export const maxDuration = 300;

type RouteContext = { params: Promise<{ restaurantId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requirePlatformAdmin(req);
  if ('error' in auth) return auth.error;

  const restaurantId = resolveRouteId((await context.params).restaurantId);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  let dryRun = false;
  try {
    const body = (await req.json().catch(() => null)) as {
      dryRun?: boolean;
    } | null;
    dryRun = Boolean(body?.dryRun);
  } catch {
    dryRun = false;
  }

  try {
    const result = await migrateRestaurantBase64ImagesToSupabase({
      restaurantId,
      dryRun,
    });
    return NextResponse.json({ data: result });
  } catch (e) {
    console.error('migrate-images failed', e);
    const message = e instanceof Error ? e.message : 'Migration failed';
    const status = /not found/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
