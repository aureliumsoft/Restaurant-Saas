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
  /** Show the rest dialog for this many seconds at the end (default 15). */
  warnSeconds?: number;
  onTimeout: () => void;
};

/**
 * After `idleMs` without interaction, call onTimeout.
 * The last `warnSeconds` show the rest dialog. Touches do not dismiss it;
 * only `stay` keeps the order.
 */
export function useKioskIdleHome({
  enabled,
  idleMs = 60_000,
  warnSeconds = 15,
  onTimeout,
}: UseKioskIdleHomeOptions): {
  secondsLeft: number | null;
  stay: () => void;
  leave: () => void;
} {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;
  const lastActivityRef = useRef(Date.now());
  const firedRef = useRef(false);
  const warningRef = useRef(false);

  const stay = useCallback(() => {
    lastActivityRef.current = Date.now();
    firedRef.current = false;
    warningRef.current = false;
    setSecondsLeft(null);
  }, []);

  const leave = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    warningRef.current = false;
    setSecondsLeft(null);
    onTimeoutRef.current();
  }, []);

  useEffect(() => {
    if (!enabled) {
      warningRef.current = false;
      setSecondsLeft(null);
      firedRef.current = false;
      lastActivityRef.current = Date.now();
      return;
    }

    warningRef.current = false;
    lastActivityRef.current = Date.now();
    firedRef.current = false;

    const onActivity = () => {
      if (warningRef.current) return;
      stay();
    };
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }

    const warnMs = Math.min(idleMs, Math.max(0, warnSeconds) * 1000);
    const tick = window.setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current;
      if (idleFor < idleMs - warnMs) {
        warningRef.current = false;
        setSecondsLeft((prev) => (prev == null ? prev : null));
        return;
      }
      const remainingMs = Math.max(0, idleMs - idleFor);
      const remainingSec = Math.max(1, Math.ceil(remainingMs / 1000));
      if (remainingMs <= 0) {
        warningRef.current = false;
        setSecondsLeft(null);
        if (!firedRef.current) {
          firedRef.current = true;
          onTimeoutRef.current();
        }
        return;
      }
      warningRef.current = true;
      setSecondsLeft(remainingSec);
    }, 200);

    return () => {
      window.clearInterval(tick);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
    };
  }, [stay, enabled, idleMs, warnSeconds]);

  return { secondsLeft, stay, leave };
}
