/** True when PayPal API cannot be reached (offline, DNS, timeout). */
export function isPayPalNetworkError(error: unknown): boolean {
  if (!error) return false;

  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes('fetch failed') ||
    message.includes('ENOTFOUND') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ETIMEDOUT') ||
    message.includes('ENETUNREACH')
  ) {
    return true;
  }

  const cause = error instanceof Error ? error.cause : undefined;
  if (cause && typeof cause === 'object' && 'code' in cause) {
    const code = String((cause as { code?: string }).code ?? '');
    return (
      code === 'ENOTFOUND' ||
      code === 'ECONNREFUSED' ||
      code === 'ETIMEDOUT' ||
      code === 'ENETUNREACH'
    );
  }

  return false;
}
