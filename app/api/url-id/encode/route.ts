import { NextResponse } from 'next/server';
import { z } from 'zod';

import { encodeUrlId, encodeUrlIds } from '@/lib/url-id';

export const runtime = 'nodejs';

const bodySchema = z.union([
  z.object({ id: z.string().min(1).max(500) }),
  z.object({ ids: z.array(z.string().min(1).max(500)).min(1).max(50) }),
]);

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    if ('id' in parsed.data) {
      return NextResponse.json({ encoded: encodeUrlId(parsed.data.id) });
    }
    return NextResponse.json({ encoded: encodeUrlIds(parsed.data.ids) });
  } catch (e) {
    console.error('url-id encode', e);
    return NextResponse.json(
      { error: 'Could not encode id.' },
      { status: 500 }
    );
  }
}
