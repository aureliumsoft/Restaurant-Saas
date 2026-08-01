'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';

import { shouldLoadMarketingAnalytics } from '@/lib/analytics/marketing-path';

/** Direct GA4 Google tag (gtag.js). Prefer GTM when both are configured. */
export function PlatformGoogleAnalytics({
  measurementId,
}: {
  measurementId: string;
}) {
  const pathname = usePathname();
  if (!measurementId || !shouldLoadMarketingAnalytics(pathname)) return null;

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
