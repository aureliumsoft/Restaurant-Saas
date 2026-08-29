/**
 * Client helper: encrypt an id for URLs via the server (key never exposed).
 */
export async function encodeUrlIdClient(id: string): Promise<string> {
  const trimmed = id.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('e1_')) return trimmed;

  try {
    const res = await fetch('/api/url-id/encode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: trimmed }),
    });
    const json = (await res.json().catch(() => null)) as {
      encoded?: string;
    } | null;
    if (res.ok && typeof json?.encoded === 'string' && json.encoded.trim()) {
      return json.encoded.trim();
    }
  } catch {
    // fall through
  }
  return trimmed;
}

export async function encodeUrlIdsClient(ids: string[]): Promise<string[]> {
  const trimmed = ids.map((id) => id.trim()).filter(Boolean);
  if (trimmed.length === 0) return [];

  try {
    const res = await fetch('/api/url-id/encode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: trimmed }),
    });
    const json = (await res.json().catch(() => null)) as {
      encoded?: string[];
    } | null;
    if (res.ok && Array.isArray(json?.encoded) && json.encoded.length === trimmed.length) {
      return json.encoded;
    }
  } catch {
    // fall through
  }
  return trimmed;
}
