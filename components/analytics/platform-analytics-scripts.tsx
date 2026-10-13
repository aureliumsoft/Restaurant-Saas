import Script from 'next/script';

import { shouldLoadMarketingAnalytics } from '@/lib/analytics/marketing-path';

/**
 * Server-rendered GA4 / GTM snippets so the tags appear in the initial HTML
 * (required for Google Analytics “Test your website” detection).
 */
export function PlatformAnalyticsScripts({
  pathname,
  gaMeasurementId,
  gtmContainerId,
}: {
  pathname: string;
  gaMeasurementId: string;
  gtmContainerId: string;
}) {
  if (!shouldLoadMarketingAnalytics(pathname)) return null;

  // Prefer direct GA4 when a Measurement ID is set (Google tag detection / Admin SEO).
  // Use GTM only when GA4 is empty to avoid double-counting the same property.
  if (gaMeasurementId) {
    return (
      <>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
          strategy="afterInteractive"
        />
        <Script id="platform-ga4" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gaMeasurementId}', { send_page_view: true });
          `}
        </Script>
      </>
    );
  }

  if (!gtmContainerId) return null;

  return (
    <Script id="platform-gtm" strategy="afterInteractive">
      {`
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','${gtmContainerId}');
      `}
    </Script>
  );
}
