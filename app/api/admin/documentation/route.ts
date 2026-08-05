import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requirePlatformAdmin } from '@/lib/auth/adminRequest';
import {
  documentationModuleWriteSchema,
  sanitizeDocHtml,
} from '@/lib/documentation/module';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if ('error' in auth) return auth.error;

  try {
    const items = await db.documentationModule.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return NextResponse.json({ data: items });
  } catch (e) {
    console.error('admin/documentation GET', e);
    return NextResponse.json(
      { error: 'Failed to load documentation modules' },
      { status: 500 }
    );
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

  const parsed = documentationModuleWriteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    let sortOrder = parsed.data.sortOrder;
    if (sortOrder === undefined) {
      const max = await db.documentationModule.aggregate({
        _max: { sortOrder: true },
      });
      sortOrder = (max._max.sortOrder ?? -1) + 1;
    }

    const item = await db.documentationModule.create({
      data: {
        name: parsed.data.name,
        shortDescription: parsed.data.shortDescription,
        contentHtml: sanitizeDocHtml(parsed.data.contentHtml),
        sortOrder,
        status: parsed.data.status ?? 'PUBLISHED',
      },
    });
    return NextResponse.json({ data: item }, { status: 201 });
  } catch (e) {
    console.error('admin/documentation POST', e);
    return NextResponse.json(
      { error: 'Failed to create module' },
      { status: 500 }
    );
  }
}
