import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requirePlatformAdmin } from '@/lib/auth/adminRequest';
import { faqWriteSchema } from '@/lib/faq/faq';
import { db } from '@/lib/db';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requirePlatformAdmin(req);
  if ('error' in auth) return auth.error;

  const { id } = await ctx.params;
  try {
    const item = await db.platformFaq.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ data: item });
  } catch (e) {
    console.error('admin/faqs/[id] GET', e);
    return NextResponse.json({ error: 'Failed to load FAQ' }, { status: 500 });
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

  const parsed = faqWriteSchema.partial().safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const existing = await db.platformFaq.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const data: {
      question?: string;
      answer?: string;
      sortOrder?: number;
      status?: string;
    } = {};
    if (parsed.data.question !== undefined) data.question = parsed.data.question;
    if (parsed.data.answer !== undefined) data.answer = parsed.data.answer;
    if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder;
    if (parsed.data.status !== undefined) data.status = parsed.data.status;

    const item = await db.platformFaq.update({ where: { id }, data });
    return NextResponse.json({ data: item });
  } catch (e) {
    console.error('admin/faqs/[id] PATCH', e);
    return NextResponse.json({ error: 'Failed to update FAQ' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requirePlatformAdmin(req);
  if ('error' in auth) return auth.error;

  const { id } = await ctx.params;
  try {
    await db.platformFaq.delete({ where: { id } });
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    console.error('admin/faqs/[id] DELETE', e);
    return NextResponse.json({ error: 'Failed to delete FAQ' }, { status: 500 });
  }
}
