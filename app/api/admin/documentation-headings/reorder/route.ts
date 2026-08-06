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
    const existing = await db.documentationHeading.findMany({
      select: { id: true },
    });
    const existingIds = new Set(existing.map((h) => h.id));
    if (
      orderedIds.length !== existingIds.size ||
      orderedIds.some((id) => !existingIds.has(id))
    ) {
      return NextResponse.json(
        { error: 'orderedIds must include all headings exactly once' },
        { status: 400 }
      );
    }

    await db.$transaction(
      orderedIds.map((id, index) =>
        db.documentationHeading.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );

    const items = await db.documentationHeading.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        subHeadings: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            _count: { select: { pages: true } },
          },
        },
        _count: { select: { subHeadings: true, pages: true } },
      },
    });
    return NextResponse.json({ data: items });
  } catch (e) {
    console.error('admin/documentation-headings/reorder', e);
    return NextResponse.json(
      { error: 'Failed to reorder headings' },
      { status: 500 }
    );
  }
}
