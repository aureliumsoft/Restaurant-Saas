/**
 * @deprecated Prefer server `PlatformAnalyticsScripts` in root layout.
 * Noscript iframe remains for GTM when container ID is set.
 */
export function PlatformGoogleTagManager(_props: { containerId: string }) {
  return null;
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
