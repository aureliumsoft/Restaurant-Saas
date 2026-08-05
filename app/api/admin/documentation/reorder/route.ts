import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requirePlatformAdmin } from '@/lib/auth/adminRequest';
import { db } from '@/lib/db';

const schema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1).max(500),
});

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
  if (new Set(orderedIds).size !== orderedIds.length) {
    return NextResponse.json(
      { error: 'orderedIds must be unique' },
      { status: 400 }
    );
  }

  try {
    await db.$transaction(
      orderedIds.map((id, index) =>
        db.documentationModule.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );

    const items = await db.documentationModule.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return NextResponse.json({ data: items });
  } catch (e) {
    console.error('admin/documentation/reorder', e);
    return NextResponse.json(
      { error: 'Failed to reorder modules' },
      { status: 500 }
    );
  }
}
