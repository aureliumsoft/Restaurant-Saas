'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';

/**
 * Operational / tenant surfaces — exclude so GA4 tracks the SaaS marketing
 * funnel (landing, pricing, auth) rather than POS/KDS/storefront noise.
 */
const SKIP_PREFIXES = [
  '/admin',
  '/pos',
  '/kds',
  '/kds-screen',
  '/order-display',
  '/web-app',
  '/kiosk',
  '/dashboard',
  '/sales',
  '/branched',
  '/tables',
  '/categories',
  '/variations',
  '/product',
  '/configurations',
  '/records',
  '/settings',
  '/invite',
  '/employees',
  '/roles',
] as const;

function shouldTrackPath(pathname: string | null): boolean {
  if (!pathname) return true;
  return !SKIP_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export function PlatformGoogleAnalytics({
  measurementId,
}: {
  measurementId: string;
}) {
  const pathname = usePathname();
  if (!measurementId || !shouldTrackPath(pathname)) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="platform-ga4" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}', { send_page_view: true });
        `}
      </Script>
    </>
  );
}
