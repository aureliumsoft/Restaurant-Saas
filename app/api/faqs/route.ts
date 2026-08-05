import { NextResponse } from 'next/server';

import { db } from '@/lib/db';

/** Public list of published FAQs for the landing page. */
export async function GET() {
  try {
    const items = await db.platformFaq.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        question: true,
        answer: true,
        sortOrder: true,
      },
    });
    return NextResponse.json({ data: items });
  } catch (e) {
    console.error('faqs GET', e);
    return NextResponse.json({ error: 'Failed to load FAQs' }, { status: 500 });
  }
}
