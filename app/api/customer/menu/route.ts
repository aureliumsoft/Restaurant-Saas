import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { loadCustomerMenuRestaurant } from '@/lib/menu/load-customer-menu';

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
    const subdomain = fromQuery || fromHost;

    if (!slug && !subdomain) {
      return NextResponse.json(
        { error: 'Missing subdomain or slug.' },
        { status: 400 }
      );
    }

    const data = await loadCustomerMenuRestaurant({ slug, subdomain });

    return NextResponse.json({ data: data ?? null }, { status: 200 });
  } catch (error) {
    console.error('customer menu', error);
    return NextResponse.json(
      { error: 'Failed to load menu.' },
      { status: 500 }
    );
  }
}
