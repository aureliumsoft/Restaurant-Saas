'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type CustomerAccountInfo = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  restaurantId: string;
  restaurantSlug: string;
};

type CustomerSheetView = 'account' | 'orders';

type CustomerAccountContextValue = {
  restaurantSlug: string | null;
  themePrimaryColor: string | null;
  setRestaurantContext: (opts: {
    restaurantSlug?: string | null;
    themePrimaryColor?: string | null;
  }) => void;
  account: CustomerAccountInfo | null;
  loading: boolean;
  refreshSession: () => Promise<void>;
  sheetOpen: boolean;
  sheetView: CustomerSheetView;
  openAccountSheet: (opts?: {
    restaurantSlug?: string | null;
    view?: CustomerSheetView;
  }) => void;
  closeAccountSheet: () => void;
  setSheetOpen: (open: boolean) => void;
  logout: () => Promise<void>;
};

const CustomerAccountContext =
  createContext<CustomerAccountContextValue | null>(null);

export function CustomerAccountProvider({ children }: { children: ReactNode }) {
  const [restaurantSlug, setRestaurantSlug] = useState<string | null>(null);
  const [themePrimaryColor, setThemePrimaryColor] = useState<string | null>(
    null
  );
  const [account, setAccount] = useState<CustomerAccountInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetView, setSheetView] = useState<CustomerSheetView>('account');

  const setRestaurantContext = useCallback(
    (opts: {
      restaurantSlug?: string | null;
      themePrimaryColor?: string | null;
    }) => {
      if (opts.restaurantSlug !== undefined) {
        const slug = opts.restaurantSlug?.trim() || null;
        setRestaurantSlug(slug);
      }
      if (opts.themePrimaryColor !== undefined) {
        setThemePrimaryColor(opts.themePrimaryColor ?? null);
      }
    },
    []
  );

  const refreshSession = useCallback(async () => {
    if (!restaurantSlug) {
      setAccount(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/customer-auth/session?restaurantSlug=${encodeURIComponent(restaurantSlug)}`,
        { cache: 'no-store' }
      );
      const json = (await res.json().catch(() => ({}))) as {
        data?: { account?: CustomerAccountInfo | null };
      };
      setAccount(json?.data?.account ?? null);
    } catch {
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, [restaurantSlug]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const openAccountSheet = useCallback(
    (opts?: {
      restaurantSlug?: string | null;
      view?: CustomerSheetView;
    }) => {
      const slug = opts?.restaurantSlug?.trim();
      if (slug) setRestaurantSlug(slug);
      setSheetView(opts?.view ?? 'account');
      setSheetOpen(true);
    },
    []
  );

  const closeAccountSheet = useCallback(() => setSheetOpen(false), []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/customer-auth/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    setAccount(null);
    setSheetOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      restaurantSlug,
      themePrimaryColor,
      setRestaurantContext,
      account,
      loading,
      refreshSession,
      sheetOpen,
      sheetView,
      openAccountSheet,
      closeAccountSheet,
      setSheetOpen,
      logout,
    }),
    [
      restaurantSlug,
      themePrimaryColor,
      setRestaurantContext,
      account,
      loading,
      refreshSession,
      sheetOpen,
      sheetView,
      openAccountSheet,
      closeAccountSheet,
      logout,
    ]
  );

  return (
    <CustomerAccountContext.Provider value={value}>
      {children}
    </CustomerAccountContext.Provider>
  );
}

export function useCustomerAccount() {
  const ctx = useContext(CustomerAccountContext);
  if (!ctx) {
    throw new Error(
      'useCustomerAccount must be used within CustomerAccountProvider'
    );
  }
  return ctx;
}

/** Safe hook when provider may be missing (order pages outside shell). */
export function useCustomerAccountOptional() {
  return useContext(CustomerAccountContext);
}
