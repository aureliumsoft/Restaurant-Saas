import { NextResponse } from 'next/server';

import { db } from '@/lib/db';

/** Public published documentation modules for /documentation. */
export async function GET() {
  try {
    const items = await db.documentationModule.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        shortDescription: true,
        contentHtml: true,
        sortOrder: true,
      },
    });
    return NextResponse.json({ data: items });
  } catch (e) {
    console.error('documentation GET', e);
    return NextResponse.json(
      { error: 'Failed to load documentation' },
      { status: 500 }
    );
  }
}
