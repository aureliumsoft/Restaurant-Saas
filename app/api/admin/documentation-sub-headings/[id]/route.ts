import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requirePlatformAdmin } from '@/lib/auth/adminRequest';
import {
  documentationSubHeadingWriteSchema,
  slugifyDocLabel,
} from '@/lib/documentation/module';
import { db } from '@/lib/db';
import { resolveRouteParams } from '@/lib/resolve-route-id';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requirePlatformAdmin(req);
  if ('error' in auth) return auth.error;

  const { id } = await resolveRouteParams(ctx.params, ['id']);
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = documentationSubHeadingWriteSchema.partial().safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const existing = await db.documentationSubHeading.findUnique({
      where: { id },
      select: { id: true, headingId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (parsed.data.headingId) {
      const heading = await db.documentationHeading.findUnique({
        where: { id: parsed.data.headingId },
        select: { id: true },
      });
      if (!heading) {
        return NextResponse.json({ error: 'Heading not found' }, { status: 404 });
      }
    }

    const data: {
      headingId?: string;
      name?: string;
      slug?: string;
      sortOrder?: number;
      status?: string;
    } = {};
    if (parsed.data.headingId !== undefined) data.headingId = parsed.data.headingId;
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder;
    if (parsed.data.status !== undefined) data.status = parsed.data.status;
    if (parsed.data.slug !== undefined) {
      data.slug = parsed.data.slug;
    } else if (parsed.data.name !== undefined) {
      data.slug = slugifyDocLabel(parsed.data.name);
    }

    const item = await db.documentationSubHeading.update({
      where: { id },
      data,
      include: {
        heading: { select: { id: true, name: true, slug: true } },
      },
    });
    return NextResponse.json({ data: item });
  } catch (e) {
    console.error('admin/documentation-sub-headings/[id] PATCH', e);
    return NextResponse.json(
      { error: 'Failed to update sub heading' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requirePlatformAdmin(req);
  if ('error' in auth) return auth.error;

  const { id } = await resolveRouteParams(ctx.params, ['id']);
  try {
    await db.documentationSubHeading.delete({ where: { id } });
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    console.error('admin/documentation-sub-headings/[id] DELETE', e);
    return NextResponse.json(
      { error: 'Failed to delete sub heading' },
      { status: 500 }
    );
  }
}
