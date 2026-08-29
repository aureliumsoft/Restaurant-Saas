import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requirePlatformAdmin } from '@/lib/auth/adminRequest';
import {
  documentationModuleInclude,
  documentationModuleWriteSchema,
  resolveDocumentationLinks,
  sanitizeDocHtml,
} from '@/lib/documentation/module';
import { db } from '@/lib/db';
import { resolveRouteParams } from '@/lib/resolve-route-id';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requirePlatformAdmin(req);
  if ('error' in auth) return auth.error;

  const { id } = await resolveRouteParams(ctx.params, ['id']);
  try {
    const item = await db.documentationModule.findUnique({
      where: { id },
      include: documentationModuleInclude,
    });
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

  const { id } = await resolveRouteParams(ctx.params, ['id']);

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
      select: { id: true, headingId: true, subHeadingId: true },
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
      headingId?: string | null;
      subHeadingId?: string | null;
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

    if (
      parsed.data.headingId !== undefined ||
      parsed.data.subHeadingId !== undefined ||
      parsed.data.subHeadingName !== undefined
    ) {
      const link = await resolveDocumentationLinks({
        headingId:
          parsed.data.headingId !== undefined
            ? parsed.data.headingId
            : existing.headingId,
        subHeadingId:
          parsed.data.subHeadingName !== undefined
            ? undefined
            : parsed.data.subHeadingId !== undefined
              ? parsed.data.subHeadingId
              : existing.subHeadingId,
        subHeadingName: parsed.data.subHeadingName,
      });
      if (!link.ok) {
        return NextResponse.json({ error: link.error }, { status: link.status });
      }
      if (!link.headingId) {
        return NextResponse.json(
          { error: 'Heading is required' },
          { status: 400 }
        );
      }
      data.headingId = link.headingId;
      data.subHeadingId = link.subHeadingId;
    }

    const item = await db.documentationModule.update({
      where: { id },
      data,
      include: documentationModuleInclude,
    });
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

  const { id } = await resolveRouteParams(ctx.params, ['id']);
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
