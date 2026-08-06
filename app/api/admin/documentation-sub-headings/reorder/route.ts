import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requirePlatformAdmin } from '@/lib/auth/adminRequest';
import { db } from '@/lib/db';

const schema = z.object({
  headingId: z.string().trim().min(1),
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

  const { headingId, orderedIds } = parsed.data;
  if (new Set(orderedIds).size !== orderedIds.length) {
    return NextResponse.json(
      { error: 'orderedIds must be unique' },
      { status: 400 }
    );
  }

  try {
    const heading = await db.documentationHeading.findUnique({
      where: { id: headingId },
      select: { id: true },
    });
    if (!heading) {
      return NextResponse.json({ error: 'Heading not found' }, { status: 404 });
    }

    const siblings = await db.documentationSubHeading.findMany({
      where: { headingId },
      select: { id: true },
    });
    const siblingIds = new Set(siblings.map((s) => s.id));
    if (
      orderedIds.length !== siblingIds.size ||
      orderedIds.some((id) => !siblingIds.has(id))
    ) {
      return NextResponse.json(
        {
          error:
            'orderedIds must include all sub headings under this heading exactly once',
        },
        { status: 400 }
      );
    }

    await db.$transaction(
      orderedIds.map((id, index) =>
        db.documentationSubHeading.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );

    const items = await db.documentationSubHeading.findMany({
      where: { headingId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        _count: { select: { pages: true } },
      },
    });
    return NextResponse.json({ data: items });
  } catch (e) {
    console.error('admin/documentation-sub-headings/reorder', e);
    return NextResponse.json(
      { error: 'Failed to reorder sub headings' },
      { status: 500 }
    );
  }
}
