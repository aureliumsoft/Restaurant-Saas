import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';

type Ctx = { params: Promise<{ slug: string }> };

/** Returns raw bilingual fields; clients resolve with UI language. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  try {
    const post = await db.blogPost.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: {
        id: true,
        title: true,
        slug: true,
        imageUrl: true,
        shortDescription: true,
        contentHtml: true,
        publishedAt: true,
      },
    });
    if (!post) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({
      data: {
        id: post.id,
        slug: post.slug,
        imageUrl: post.imageUrl,
        publishedAt: post.publishedAt,
        title: post.title,
        shortDescription: post.shortDescription,
        contentHtml: post.contentHtml,
      },
    });
  } catch (e) {
    console.error('blog/[slug] GET', e);
    return NextResponse.json({ error: 'Failed to load post' }, { status: 500 });
  }
}
