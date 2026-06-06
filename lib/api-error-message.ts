import axios from 'axios';

/** Prefer server `error` string (e.g. "Access Blocked") for toast messages. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const err = error.response?.data?.error;
    if (typeof err === 'string' && err.trim().length > 0) return err;
  }
  const wrapped = error as { response?: { data?: { error?: unknown } } };
  if (typeof wrapped.response?.data?.error === 'string') {
    return wrapped.response.data.error;
  }
  return fallback;
}
