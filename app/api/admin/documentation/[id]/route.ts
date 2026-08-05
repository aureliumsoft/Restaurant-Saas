import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requirePlatformAdmin } from '@/lib/auth/adminRequest';
import {
  documentationModuleWriteSchema,
  sanitizeDocHtml,
} from '@/lib/documentation/module';
import { db } from '@/lib/db';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requirePlatformAdmin(req);
  if ('error' in auth) return auth.error;

  const { id } = await ctx.params;
  try {
    const item = await db.documentationModule.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ data: item });
  } catch (e) {
    console.error('admin/documentation/[id] GET', e);
    return NextResponse.json({ error: 'Failed to load module' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requirePlatformAdmin(req);
  if ('error' in auth) return auth.error;

  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = documentationModuleWriteSchema.partial().safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const existing = await db.documentationModule.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const data: {
      name?: string;
      shortDescription?: string;
      contentHtml?: string;
      sortOrder?: number;
      status?: string;
    } = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.shortDescription !== undefined) {
      data.shortDescription = parsed.data.shortDescription;
    }
    if (parsed.data.contentHtml !== undefined) {
      data.contentHtml = sanitizeDocHtml(parsed.data.contentHtml);
    }
    if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder;
    if (parsed.data.status !== undefined) data.status = parsed.data.status;

    const item = await db.documentationModule.update({ where: { id }, data });
    return NextResponse.json({ data: item });
  } catch (e) {
    console.error('admin/documentation/[id] PATCH', e);
    return NextResponse.json(
      { error: 'Failed to update module' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requirePlatformAdmin(req);
  if ('error' in auth) return auth.error;

  const { id } = await ctx.params;
  try {
    await db.documentationModule.delete({ where: { id } });
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    console.error('admin/documentation/[id] DELETE', e);
    return NextResponse.json(
      { error: 'Failed to delete module' },
      { status: 500 }
    );
  }
}
