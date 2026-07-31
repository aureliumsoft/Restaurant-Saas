'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { toast } from 'react-toastify';

import { flushOrderOutbox } from '@/lib/offline/flush-outbox';
import { countOrderOutbox } from '@/lib/offline/outbox';

export function OfflineBootstrap() {
  const { status: sessionStatus } = useSession();
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [authRequired, setAuthRequired] = useState(false);
  const flushingRef = useRef(false);
  const wasAuthenticatedRef = useRef(false);

  useEffect(() => {
    setOnline(typeof navigator !== 'undefined' && navigator.onLine);
  }, []);

  const refreshPending = useCallback(async () => {
    try {
      setPending(await countOrderOutbox());
    } catch {
      setPending(0);
    }
  }, []);

  const runFlush = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (flushingRef.current) return;

    // POS/KDS outbox needs a signed-in restaurant session.
    if (sessionStatus !== 'authenticated') {
      const count = await countOrderOutbox().catch(() => 0);
      if (count > 0) setAuthRequired(true);
      await refreshPending();
      return;
    }

    flushingRef.current = true;
    try {
      const result = await flushOrderOutbox();
      setAuthRequired(result.authRequired);
      await refreshPending();
      if (result.synced > 0) {
        toast.success(
          result.synced === 1
            ? 'Synced 1 pending offline order/ticket.'
            : `Synced ${result.synced} pending offline orders/tickets.`
        );
      }
      if (result.authRequired && result.remaining > 0) {
        toast.warn(
          'Sign in again to upload pending offline orders.'
        );
      }
    } finally {
      flushingRef.current = false;
    }
  }, [refreshPending, sessionStatus]);

  useEffect(() => {
    void refreshPending();
  }, [refreshPending]);

  useEffect(() => {
    const onBox = () => void refreshPending();
    window.addEventListener('offline-outbox-changed', onBox);
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('foodluk-offline-sync');
      bc.onmessage = () => void refreshPending();
    } catch {
      /* optional */
    }
    return () => {
      window.removeEventListener('offline-outbox-changed', onBox);
      bc?.close();
    };
  }, [refreshPending]);

  // Flush when connectivity returns.
  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      void runFlush();
    };
    const onOffline = () => setOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      void runFlush();
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [runFlush]);

  // Flush again right after login (session restored).
  useEffect(() => {
    const authenticated = sessionStatus === 'authenticated';
    if (authenticated && !wasAuthenticatedRef.current) {
      void runFlush();
    }
    wasAuthenticatedRef.current = authenticated;
  }, [sessionStatus, runFlush]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  if (online && pending === 0 && !authRequired) return null;

  const needsLogin = authRequired || (pending > 0 && sessionStatus !== 'authenticated');

  return (
    <div
      role="status"
      className="pointer-events-auto fixed bottom-3 left-1/2 z-[10000] max-w-[min(100vw-1.5rem,32rem)] -translate-x-1/2 rounded-lg border border-border bg-card px-4 py-2 text-center text-sm text-foreground shadow-lg"
    >
      {!online && (
        <span className="font-medium text-amber-600 dark:text-amber-400">
          Offline mode — POS / KDS / display use local data.
        </span>
      )}
      {!online && pending > 0 && (
        <span className="mx-1 text-muted-foreground">·</span>
      )}
      {pending > 0 && !needsLogin && (
        <span className="text-muted-foreground">
          {pending} pending sync item{pending === 1 ? '' : 's'} will upload when
          online.
        </span>
      )}
      {needsLogin && pending > 0 && (
        <span className="text-amber-700 dark:text-amber-300">
          {pending} offline order{pending === 1 ? '' : 's'} saved on this
          device.{' '}
          <Link href="/login" className="font-semibold underline">
            Sign in
          </Link>{' '}
          to upload them to the restaurant database.
        </span>
      )}
    </div>
  );
}
