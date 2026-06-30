'use client';

import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';

/**
 * Session is hydrated from the server in root layout so the client does not
 * immediately call GET /api/auth/session on every navigation.
 *
 * - refetchOnWindowFocus: off (avoids bursts when alt-tabbing)
 * - refetchInterval: 10 min background check only (login/logout still instant)
 */
const SESSION_REFETCH_INTERVAL_SEC = 10 * 60;

export function AuthSessionProvider({
  session,
  children,
}: {
  session?: Session | null;
  children: React.ReactNode;
}) {
  return (
    <SessionProvider
      session={session}
      refetchOnWindowFocus={false}
      refetchInterval={SESSION_REFETCH_INTERVAL_SEC}
    >
      {children}
    </SessionProvider>
  );
}
