'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';

import { shouldLoadMarketingAnalytics } from '@/lib/analytics/marketing-path';

/**
 * Official Google Tag Manager install snippet (Web container).
 * @see https://developers.google.com/tag-platform/tag-manager/web
 */
export function PlatformGoogleTagManager({
  containerId,
}: {
  containerId: string;
}) {
  const pathname = usePathname();
  if (!containerId || !shouldLoadMarketingAnalytics(pathname)) return null;

  return (
    <Script id="platform-gtm" strategy="afterInteractive">
      {`
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','${containerId}');
      `}
    </Script>
  );
}

/** Noscript iframe — place immediately inside `<body>`. */
export function PlatformGoogleTagManagerNoscript({
  containerId,
}: {
  containerId: string;
}) {
  if (!containerId) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${containerId}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}
