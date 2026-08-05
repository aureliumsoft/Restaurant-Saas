import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requirePlatformAdmin } from '@/lib/auth/adminRequest';
import { faqWriteSchema } from '@/lib/faq/faq';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if ('error' in auth) return auth.error;

  try {
    const items = await db.platformFaq.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return NextResponse.json({ data: items });
  } catch (e) {
    console.error('admin/faqs GET', e);
    return NextResponse.json({ error: 'Failed to load FAQs' }, { status: 500 });
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

  const parsed = faqWriteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    let sortOrder = parsed.data.sortOrder;
    if (sortOrder === undefined) {
      const max = await db.platformFaq.aggregate({ _max: { sortOrder: true } });
      sortOrder = (max._max.sortOrder ?? -1) + 1;
    }

    const item = await db.platformFaq.create({
      data: {
        question: parsed.data.question,
        answer: parsed.data.answer,
        sortOrder,
        status: parsed.data.status ?? 'PUBLISHED',
      },
    });
    return NextResponse.json({ data: item }, { status: 201 });
  } catch (e) {
    console.error('admin/faqs POST', e);
    return NextResponse.json({ error: 'Failed to create FAQ' }, { status: 500 });
  }
}
