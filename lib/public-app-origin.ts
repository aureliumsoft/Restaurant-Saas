/** Client-safe app origin (uses env or current window). */
export function getPublicAppOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env) return env.replace(/\/$/, '');
  return 'http://localhost:3000';
}
