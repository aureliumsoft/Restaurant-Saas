import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requirePlatformAdmin } from '@/lib/auth/adminRequest';
import {
  documentationSubHeadingWriteSchema,
  slugifyDocLabel,
} from '@/lib/documentation/module';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if ('error' in auth) return auth.error;

  const headingId = req.nextUrl.searchParams.get('headingId')?.trim() || undefined;

  try {
    const items = await db.documentationSubHeading.findMany({
      where: headingId ? { headingId } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        heading: { select: { id: true, name: true, slug: true } },
        _count: { select: { pages: true } },
      },
    });
    return NextResponse.json({ data: items });
  } catch (e) {
    console.error('admin/documentation-sub-headings GET', e);
    return NextResponse.json(
      { error: 'Failed to load sub headings' },
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

  const parsed = documentationSubHeadingWriteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const heading = await db.documentationHeading.findUnique({
      where: { id: parsed.data.headingId },
      select: { id: true },
    });
    if (!heading) {
      return NextResponse.json({ error: 'Heading not found' }, { status: 404 });
    }

    let sortOrder = parsed.data.sortOrder;
    if (sortOrder === undefined) {
      const max = await db.documentationSubHeading.aggregate({
        where: { headingId: parsed.data.headingId },
        _max: { sortOrder: true },
      });
      sortOrder = (max._max.sortOrder ?? -1) + 1;
    }

    const baseSlug = parsed.data.slug ?? slugifyDocLabel(parsed.data.name);
    let slug = baseSlug;
    for (let i = 0; i < 8; i++) {
      const clash = await db.documentationSubHeading.findFirst({
        where: { headingId: parsed.data.headingId, slug },
        select: { id: true },
      });
      if (!clash) break;
      slug = `${baseSlug}-${i + 2}`;
    }

    const item = await db.documentationSubHeading.create({
      data: {
        headingId: parsed.data.headingId,
        name: parsed.data.name,
        slug,
        sortOrder,
        status: parsed.data.status ?? 'PUBLISHED',
      },
      include: {
        heading: { select: { id: true, name: true, slug: true } },
      },
    });
    return NextResponse.json({ data: item }, { status: 201 });
  } catch (e) {
    console.error('admin/documentation-sub-headings POST', e);
    return NextResponse.json(
      { error: 'Failed to create sub heading' },
      { status: 500 }
    );
  }
}
