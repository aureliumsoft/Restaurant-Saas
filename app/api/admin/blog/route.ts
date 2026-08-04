import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requirePlatformAdmin } from '@/lib/auth/adminRequest';
import { blogPostWriteSchema } from '@/lib/blog/blog';
import { mapBlogWritePayload, resolveSlugForWrite } from '@/lib/blog/blog-service';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if ('error' in auth) return auth.error;

  try {
    const posts = await db.blogPost.findMany({
      orderBy: [{ updatedAt: 'desc' }],
      select: {
        id: true,
        title: true,
        slug: true,
        imageUrl: true,
        shortDescription: true,
        status: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ data: posts });
  } catch (e) {
    console.error('admin/blog GET', e);
    return NextResponse.json({ error: 'Failed to load posts' }, { status: 500 });
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

  const parsed = blogPostWriteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const slug = await resolveSlugForWrite(parsed.data);
    const data = mapBlogWritePayload(parsed.data, slug, null);
    const post = await db.blogPost.create({ data });
    return NextResponse.json({ data: post }, { status: 201 });
  } catch (e) {
    console.error('admin/blog POST', e);
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
}
