/** Server-only public origin for metadata / sitemap. */
export function getBaseUrl(): string {
  const env =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (env) {
    const withProto = env.startsWith('http') ? env : `https://${env}`;
    return withProto.replace(/\/$/, '');
  }
  return 'http://localhost:3000';
}
