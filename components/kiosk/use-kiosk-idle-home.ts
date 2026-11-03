'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'pointerdown',
  'keydown',
  'touchstart',
  'wheel',
];

export type UseKioskIdleHomeOptions = {
  /** When false, timer is cleared and countdown hidden. */
  enabled: boolean;
  /** Total idle time before redirect (default 60s). */
  idleMs?: number;
  /** Show 5…1 for this many seconds at the end (default 5). */
  warnSeconds?: number;
  onTimeout: () => void;
};

/**
 * After `idleMs` without interaction, call onTimeout.
 * The last `warnSeconds` expose a visible countdown (5,4,3,2,1).
 */
export function useKioskIdleHome({
  enabled,
  idleMs = 60_000,
  warnSeconds = 5,
  onTimeout,
}: UseKioskIdleHomeOptions): { secondsLeft: number | null } {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;
  const lastActivityRef = useRef(Date.now());
  const firedRef = useRef(false);

  const bumpActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    firedRef.current = false;
    setSecondsLeft((prev) => (prev == null ? prev : null));
  }, []);

  useEffect(() => {
    if (!enabled) {
      setSecondsLeft(null);
      firedRef.current = false;
      lastActivityRef.current = Date.now();
      return;
    }

    lastActivityRef.current = Date.now();
    firedRef.current = false;

    const onActivity = () => {
      bumpActivity();
    };
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }

    const warnMs = Math.min(idleMs, Math.max(0, warnSeconds) * 1000);
    const tick = window.setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current;
      if (idleFor < idleMs - warnMs) {
        setSecondsLeft((prev) => (prev == null ? prev : null));
        return;
      }
      const remainingMs = Math.max(0, idleMs - idleFor);
      const remainingSec = Math.max(1, Math.ceil(remainingMs / 1000));
      if (remainingMs <= 0) {
        setSecondsLeft(null);
        if (!firedRef.current) {
          firedRef.current = true;
          onTimeoutRef.current();
        }
        return;
      }
      setSecondsLeft(remainingSec);
    }, 200);

    return () => {
      window.clearInterval(tick);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
    };
  }, [bumpActivity, enabled, idleMs, warnSeconds]);

  return { secondsLeft };
}
