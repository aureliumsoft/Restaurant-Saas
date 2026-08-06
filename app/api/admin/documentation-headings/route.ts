import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requirePlatformAdmin } from '@/lib/auth/adminRequest';
import {
  documentationHeadingWriteSchema,
  slugifyDocLabel,
} from '@/lib/documentation/module';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if ('error' in auth) return auth.error;

  try {
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
    console.error('admin/documentation-headings GET', e);
    return NextResponse.json(
      { error: 'Failed to load headings' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if ('error' in auth) return auth.error;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = documentationHeadingWriteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    let sortOrder = parsed.data.sortOrder;
    if (sortOrder === undefined) {
      const max = await db.documentationHeading.aggregate({
        _max: { sortOrder: true },
      });
      sortOrder = (max._max.sortOrder ?? -1) + 1;
    }

    const baseSlug = parsed.data.slug ?? slugifyDocLabel(parsed.data.name);
    let slug = baseSlug;
    for (let i = 0; i < 8; i++) {
      const clash = await db.documentationHeading.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!clash) break;
      slug = `${baseSlug}-${i + 2}`;
    }

    const item = await db.documentationHeading.create({
      data: {
        name: parsed.data.name,
        slug,
        sortOrder,
        status: parsed.data.status ?? 'PUBLISHED',
      },
    });
    return NextResponse.json({ data: item }, { status: 201 });
  } catch (e) {
    console.error('admin/documentation-headings POST', e);
    return NextResponse.json(
      { error: 'Failed to create heading' },
      { status: 500 }
    );
  }
}
