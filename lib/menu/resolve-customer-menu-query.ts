import type { NextRequest } from 'next/server';

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

export function resolveCustomerMenuQuery(
  req: NextRequest
): { slug?: string; subdomain?: string } | { error: string } {
  const slug = req.nextUrl.searchParams.get('slug')?.trim();
  const fromQuery = req.nextUrl.searchParams.get('subdomain');
  const host = (req.headers.get('host') || '').split(':')[0];
  const fromHost = getSubdomainFromHost(host);
  const subdomain = fromQuery || fromHost;

  if (!slug && !subdomain) {
    return { error: 'Missing subdomain or slug.' };
  }

  return {
    ...(slug ? { slug } : {}),
    ...(subdomain ? { subdomain } : {}),
  };
}
