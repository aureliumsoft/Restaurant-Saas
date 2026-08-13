'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { mutate } from 'swr';

import { useBranchContext } from '@/hooks/use-branch-context';
import eventBus from '@/lib/even';
import { revalidateStaffBootstrap } from '@/hooks/use-staff-bootstrap-swr';
import { queryKeys } from '@/lib/query/keys';
import {
  REALTIME_CLIENT_CHANNELS,
  REALTIME_FALLBACK_POLL_MS,
  type RestaurantRealtimeEvent,
  type RestaurantRealtimeEventType,
} from '@/lib/realtime/types';
import { isCustomerAppRoute } from '@/lib/customer-storefront-paths';

function isStaffRealtimeRoute(pathname: string): boolean {
  const path = pathname.split('?')[0] ?? pathname;
  if (path.startsWith('/admin')) return false;
  if (path.startsWith('/login') || path.startsWith('/register')) return false;
  if (path === '/' || path.startsWith('/pricing')) return false;
  if (isCustomerAppRoute(path)) return false;
  if (path.startsWith('/kiosk') || path.startsWith('/invite')) {
    return false;
  }
  return true;
}

function invalidateConfigCaches(type: RestaurantRealtimeEventType) {
  void revalidateStaffBootstrap();
  switch (type) {
    case 'config.regional':
      void mutate(queryKeys.regional());
      break;
    case 'config.branding':
      void mutate(queryKeys.branding());
      break;
    default:
      break;
  }
}

function dispatchRealtimeEvent(event: RestaurantRealtimeEvent) {
  const channel = REALTIME_CLIENT_CHANNELS[event.type];
  if (channel) {
    eventBus.emit(channel);
  }
  invalidateConfigCaches(event.type);
}

/**
 * Subscribes to restaurant SSE and fans out to eventBus + SWR cache invalidation.
 * Operational screens listen via useRealtimeRefresh instead of polling.
 */
export function RestaurantRealtimeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? '';
  const { status } = useSession();
  const branchCtx = useBranchContext();
  const branchId = branchCtx.activeBranchId;
  const [connected, setConnected] = useState(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const staffRoute =
    status === 'authenticated' && isStaffRealtimeRoute(pathname);

  useEffect(() => {
    if (!staffRoute) {
      setConnected(false);
      return;
    }

    let es: EventSource | null = null;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      es?.close();

      const params = new URLSearchParams();
      if (branchId) params.set('branchId', branchId);
      const qs = params.toString();
      es = new EventSource(
        `/api/restaurant/realtime/stream${qs ? `?${qs}` : ''}`
      );

      es.onopen = () => {
        if (disposed) return;
        setConnected(true);
      };

      es.onmessage = (message) => {
        if (disposed) return;
        try {
          const parsed = JSON.parse(message.data) as
            | RestaurantRealtimeEvent
            | { type: 'connected' };
          if (parsed.type === 'connected') return;
          dispatchRealtimeEvent(parsed);
        } catch {
          // ignore malformed payloads
        }
      };

      es.onerror = () => {
        if (disposed) return;
        setConnected(false);
        es?.close();
        window.setTimeout(connect, 5_000);
      };
    };

    connect();

    return () => {
      disposed = true;
      setConnected(false);
      es?.close();
    };
  }, [staffRoute, branchId]);

  useEffect(() => {
    if (!staffRoute || connected) {
      if (fallbackTimerRef.current) {
        clearInterval(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      return;
    }

    const pulse = () => {
      if (document.hidden) return;
      eventBus.emit('realtime:fallback-sync');
    };

    fallbackTimerRef.current = setInterval(pulse, REALTIME_FALLBACK_POLL_MS);
    return () => {
      if (fallbackTimerRef.current) {
        clearInterval(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [staffRoute, connected]);

  return children;
}
