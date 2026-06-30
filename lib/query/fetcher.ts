export async function jsonFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      typeof body?.error === 'string' ? body.error : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}
