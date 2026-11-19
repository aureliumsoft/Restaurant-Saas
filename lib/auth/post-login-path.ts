import { isPlatformAdminSession } from '@/lib/auth/admin';

export type PostLoginUser = {
  email?: string | null;
  roleId?: string | null;
  roleName?: string | null;
  role?: string | null;
  isPlatformAdmin?: boolean;
};

/** Only same-origin paths. Anything else falls back to the restaurant dashboard. */
export function safeCallbackUrl(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
    return '/dashboard';
  }
  return raw;
}

/** Login routes must not be used as the final destination (avoids a redirect loop). */
export function isLoginCallback(url: string): boolean {
  return (
    url === '/login' ||
    url.startsWith('/login/') ||
    url.startsWith('/login?')
  );
}

/**
 * Platform admins go to SaaS admin. Customers go home.
 * Everyone else goes to the restaurant dashboard.
 * An explicit callback (for example from a protected page) wins.
 */
export function postLoginPath(
  user: PostLoginUser | undefined,
  hasExplicitCallback: boolean,
  callbackUrl: string
): string {
  if (hasExplicitCallback && !isLoginCallback(callbackUrl)) {
    return callbackUrl;
  }
  if (isPlatformAdminSession(user)) return '/admin/dashboard';
  const normalizedName = (user?.roleName ?? '').trim().toLowerCase();
  if (normalizedName === 'user') return '/';
  if (user?.role === 'USER') return '/';
  return '/dashboard';
}
