import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requirePlatformAdmin } from '@/lib/auth/adminRequest';
import {
  documentationHeadingWriteSchema,
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

  const parsed = documentationHeadingWriteSchema.partial().safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const existing = await db.documentationHeading.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const data: {
      name?: string;
      slug?: string;
      sortOrder?: number;
      status?: string;
    } = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder;
    if (parsed.data.status !== undefined) data.status = parsed.data.status;
    if (parsed.data.slug !== undefined) {
      data.slug = parsed.data.slug;
    } else if (parsed.data.name !== undefined) {
      data.slug = slugifyDocLabel(parsed.data.name);
    }

    const item = await db.documentationHeading.update({ where: { id }, data });
    return NextResponse.json({ data: item });
  } catch (e) {
    console.error('admin/documentation-headings/[id] PATCH', e);
    return NextResponse.json(
      { error: 'Failed to update heading' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requirePlatformAdmin(req);
  if ('error' in auth) return auth.error;

  const { id } = await resolveRouteParams(ctx.params, ['id']);
  try {
    await db.documentationHeading.delete({ where: { id } });
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    console.error('admin/documentation-headings/[id] DELETE', e);
    return NextResponse.json(
      { error: 'Failed to delete heading' },
      { status: 500 }
    );
  }
}
