import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requirePlatformAdmin } from '@/lib/auth/adminRequest';
import { blogPostWriteSchema } from '@/lib/blog/blog';
import { mapBlogWritePayload, resolveSlugForWrite } from '@/lib/blog/blog-service';
import { db } from '@/lib/db';
import { resolveRouteParams } from '@/lib/resolve-route-id';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requirePlatformAdmin(req);
  if ('error' in auth) return auth.error;

  const { id } = await resolveRouteParams(ctx.params, ['id']);
  try {
    const post = await db.blogPost.findUnique({ where: { id } });
    if (!post) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ data: post });
  } catch (e) {
    console.error('admin/blog/[id] GET', e);
    return NextResponse.json({ error: 'Failed to load post' }, { status: 500 });
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

  const parsed = blogPostWriteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const existing = await db.blogPost.findUnique({
      where: { id },
      select: { id: true, publishedAt: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const slug = await resolveSlugForWrite(parsed.data, id);
    const data = mapBlogWritePayload(parsed.data, slug, existing.publishedAt);
    const post = await db.blogPost.update({ where: { id }, data });
    return NextResponse.json({ data: post });
  } catch (e) {
    console.error('admin/blog/[id] PATCH', e);
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requirePlatformAdmin(req);
  if ('error' in auth) return auth.error;

  const { id } = await resolveRouteParams(ctx.params, ['id']);
  try {
    await db.blogPost.delete({ where: { id } });
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    console.error('admin/blog/[id] DELETE', e);
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }
}
