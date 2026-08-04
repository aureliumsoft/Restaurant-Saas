'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Warns on tab close/reload, browser back, in-app link clicks (e.g. admin sidebar),
 * and offers a confirm flow before leaving with unsaved data.
 */
export function useUnsavedChangesGuard(
  isDirty: boolean,
  options?: { message?: string }
) {
  const router = useRouter();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const allowLeaveRef = useRef(false);
  const historyTrapPushedRef = useRef(false);
  const backNavigationRef = useRef(false);
  const isDirtyRef = useRef(isDirty);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  /** Re-arm the guard after the user edits again. */
  useEffect(() => {
    if (isDirty) {
      allowLeaveRef.current = false;
    }
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty || allowLeaveRef.current) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty || allowLeaveRef.current) {
      historyTrapPushedRef.current = false;
      return;
    }

    if (!historyTrapPushedRef.current) {
      window.history.pushState(
        { __unsavedGuard: true },
        '',
        window.location.href
      );
      historyTrapPushedRef.current = true;
    }

    const onPopState = () => {
      if (allowLeaveRef.current) return;

      backNavigationRef.current = true;
      pendingActionRef.current = () => {
        allowLeaveRef.current = true;
        historyTrapPushedRef.current = false;
        window.history.back();
      };
      setLeaveOpen(true);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isDirty]);

  /** Intercept internal <a href> clicks (sidebar, header, etc.). */
  useEffect(() => {
    if (!isDirty) return;

    const onDocumentClick = (e: MouseEvent) => {
      if (!isDirtyRef.current || allowLeaveRef.current) return;
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-unsaved-ignore]')) return;

      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.hasAttribute('download')) return;
      if (anchor.target && anchor.target !== '_self') return;

      const rawHref = anchor.getAttribute('href');
      if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:')) {
        return;
      }

      let url: URL;
      try {
        url = new URL(rawHref, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      const samePath =
        url.pathname === window.location.pathname &&
        url.search === window.location.search;
      if (samePath) return;

      e.preventDefault();
      e.stopPropagation();

      const next = `${url.pathname}${url.search}${url.hash}`;
      backNavigationRef.current = false;
      pendingActionRef.current = () => {
        allowLeaveRef.current = true;
        historyTrapPushedRef.current = false;
        router.push(next);
      };
      setLeaveOpen(true);
    };

    document.addEventListener('click', onDocumentClick, true);
    return () => document.removeEventListener('click', onDocumentClick, true);
  }, [isDirty, router]);

  const requestLeave = useCallback(
    (action: () => void) => {
      if (allowLeaveRef.current || !isDirty) {
        action();
        return;
      }
      backNavigationRef.current = false;
      pendingActionRef.current = action;
      setLeaveOpen(true);
    },
    [isDirty]
  );

  const confirmLeave = useCallback(() => {
    setLeaveOpen(false);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    backNavigationRef.current = false;
    allowLeaveRef.current = true;
    historyTrapPushedRef.current = false;
    action?.();
  }, []);

  const cancelLeave = useCallback(() => {
    setLeaveOpen(false);
    pendingActionRef.current = null;

    if (backNavigationRef.current && isDirty && !allowLeaveRef.current) {
      backNavigationRef.current = false;
      window.history.pushState(
        { __unsavedGuard: true },
        '',
        window.location.href
      );
      historyTrapPushedRef.current = true;
    } else {
      backNavigationRef.current = false;
    }
  }, [isDirty]);

  /** Allow one navigation while still dirty (e.g. after save then redirect). */
  const allowNextNavigation = useCallback(() => {
    allowLeaveRef.current = true;
    historyTrapPushedRef.current = false;
    backNavigationRef.current = false;
  }, []);

  return {
    leaveOpen,
    leaveMessage:
      options?.message ??
      'You have unsaved changes. Leave this page without saving?',
    requestLeave,
    confirmLeave,
    cancelLeave,
    allowNextNavigation,
  };
}
