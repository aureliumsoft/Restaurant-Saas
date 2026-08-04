import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';

const DEFAULT_LIMIT = 9;
const MAX_LIMIT = 30;

/** Public list of published blog posts (cursor = id of last item). */
export async function GET(req: NextRequest) {
  const limitRaw = Number(req.nextUrl.searchParams.get('limit') ?? DEFAULT_LIMIT);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT)
  );
  const cursor = req.nextUrl.searchParams.get('cursor')?.trim() || null;

  try {
    const posts = await db.blogPost.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      select: {
        id: true,
        title: true,
        slug: true,
        imageUrl: true,
        shortDescription: true,
        publishedAt: true,
      },
    });

    const hasMore = posts.length > limit;
    const page = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

    return NextResponse.json({
      data: {
        posts: page,
        nextCursor,
        hasMore,
      },
    });
  } catch (e) {
    console.error('blog GET', e);
    return NextResponse.json({ error: 'Failed to load posts' }, { status: 500 });
  }
}
