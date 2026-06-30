'use client';

import { useEffect, useRef } from 'react';

import eventBus from '@/lib/even';

/**
 * Subscribe to SSE-backed refresh channels.
 * Slow fallback sync runs only when SSE is disconnected (via realtime:fallback-sync).
 */
export function useRealtimeRefresh(
  channels: string | string[],
  refresh: () => void,
  options?: { runOnMount?: boolean }
) {
  const channelsRef = useRef(channels);
  channelsRef.current = channels;
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const runOnMount = options?.runOnMount ?? true;

  useEffect(() => {
    const handler = () => refreshRef.current();
    const list = Array.isArray(channelsRef.current)
      ? channelsRef.current
      : [channelsRef.current];

    for (const ch of list) {
      eventBus.on(ch, handler);
    }
    eventBus.on('realtime:fallback-sync', handler);
    window.addEventListener('branch-changed', handler);

    if (runOnMount) {
      refreshRef.current();
    }

    return () => {
      for (const ch of list) {
        eventBus.removeListener(ch, handler);
      }
      eventBus.removeListener('realtime:fallback-sync', handler);
      window.removeEventListener('branch-changed', handler);
    };
  }, [runOnMount, Array.isArray(channels) ? channels.join('\0') : channels]);
}
