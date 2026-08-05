import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requirePlatformAdmin } from '@/lib/auth/adminRequest';
import { db } from '@/lib/db';

const schema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1).max(500),
});

/** Bulk update FAQ sortOrder from drag-and-drop order. */
export async function POST(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if ('error' in auth) return auth.error;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { orderedIds } = parsed.data;
  const unique = new Set(orderedIds);
  if (unique.size !== orderedIds.length) {
    return NextResponse.json(
      { error: 'orderedIds must be unique' },
      { status: 400 }
    );
  }

  try {
    await db.$transaction(
      orderedIds.map((id, index) =>
        db.platformFaq.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );

    const items = await db.platformFaq.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return NextResponse.json({ data: items });
  } catch (e) {
    console.error('admin/faqs/reorder', e);
    return NextResponse.json(
      { error: 'Failed to reorder FAQs' },
      { status: 500 }
    );
  }
}
