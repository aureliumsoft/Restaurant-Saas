import axios from 'axios';

export function extractApiErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { error?: unknown } | undefined;
    const err = body?.error;
    if (typeof err === 'string' && err.trim()) return err;
    if (err && typeof err === 'object') {
      const flat = err as {
        formErrors?: string[];
        fieldErrors?: Record<string, string[] | undefined>;
      };
      const fieldMsg = Object.values(flat.fieldErrors ?? {})
        .flat()
        .find((m): m is string => typeof m === 'string' && m.length > 0);
      if (fieldMsg) return fieldMsg;
      if (flat.formErrors?.[0]) return flat.formErrors[0];
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export function extractApiErrorFromBody(
  body: unknown,
  fallback: string
): string {
  if (!body || typeof body !== 'object') return fallback;
  const err = (body as { error?: unknown }).error;
  if (typeof err === 'string' && err.trim()) return err;
  return fallback;
}
