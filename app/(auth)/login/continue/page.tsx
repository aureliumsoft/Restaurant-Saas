import { redirect } from 'next/navigation';

import { getAppSession } from '@/lib/auth/app-session';
import { postLoginPath, safeCallbackUrl } from '@/lib/auth/post-login-path';

/**
 * Server redirect after Google sign-in.
 * The session cookie is already set, so this skips rendering the login form.
 */
export default async function LoginContinuePage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const session = await getAppSession();
  if (!session?.user) {
    redirect('/login');
  }

  const raw =
    typeof params.callbackUrl === 'string' ? params.callbackUrl : null;
  const callbackUrl = safeCallbackUrl(raw);
  const hasExplicitCallback = Boolean(raw);

  redirect(postLoginPath(session.user, hasExplicitCallback, callbackUrl));
}
