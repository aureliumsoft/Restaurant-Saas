import { headers } from 'next/headers';

/** Public origin for redirects (Stripe success/cancel URLs). */
export async function getRequestOrigin(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env) {
    return env.replace(/\/$/, '');
  }
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}