import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';

function getSubdomainFromHost(hostname: string) {
  if (hostname.endsWith('.localhost')) {
    const sub = hostname.replace('.localhost', '');
    if (sub && sub !== 'www') return sub;
    return null;
  }
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (rootDomain && hostname.endsWith(`.${rootDomain}`)) {
    const sub = hostname.slice(0, -(`.${rootDomain}`.length));
    if (sub && sub !== 'www') return sub;
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get('slug')?.trim();
    const fromQuery = req.nextUrl.searchParams.get('subdomain');
    const host = (req.headers.get('host') || '').split(':')[0];
    const fromHost = getSubdomainFromHost(host);

    const where = slug
      ? { slug }
      : fromQuery || fromHost
        ? { subdomain: fromQuery || fromHost || '' }
        : null;

    if (!where) {
      return NextResponse.json(
        { error: 'Missing subdomain or slug.' },
        { status: 400 }
      );
    }

    const restaurant = await db.restaurant.findUnique({
      where,
      select: {
        id: true,
        branches: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            openingHours: true,
            slotDurationMinutes: true,
          },
        },
      },
    });

    return NextResponse.json({ data: restaurant?.branches ?? [] }, { status: 200 });
  } catch (error) {
    console.error('customer branches', error);
    return NextResponse.json(
      { error: 'Failed to load branches.' },
      { status: 500 }
    );
  }
}
