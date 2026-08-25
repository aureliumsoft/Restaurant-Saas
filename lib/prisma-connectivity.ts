export function isDatabaseUnreachableError(e: unknown): boolean {
  if (!e) return false;
  const code =
    typeof e === 'object' && e && 'code' in e
      ? String((e as { code?: unknown }).code ?? '')
      : '';
  if (
    code === 'P1001' ||
    code === 'P1002' ||
    code === 'P1017' ||
    code === 'P6008' ||
    code === 'P6004'
  ) {
    return true;
  }
  const name = e instanceof Error ? e.name : '';
  if (name === 'PrismaClientInitializationError') return true;
  const msg = e instanceof Error ? e.message : String(e);
  return (
    /can't reach database/i.test(msg) ||
    /timed out fetching a new connection/i.test(msg) ||
    /connection refused/i.test(msg) ||
    /econnrefused|etimedout|econnreset|enotfound/i.test(msg) ||
    /server has closed the connection/i.test(msg)
  );
}
