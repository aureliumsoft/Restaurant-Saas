'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Eye, EyeOff, Loader2, X } from 'lucide-react';

import {
  useCustomerAccount,
  type CustomerAccountInfo,
} from '@/components/customer-app/customer-account-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { useRestaurantRegional } from '@/hooks/use-restaurant-regional';
import { buildCustomerLightSurfaceVars } from '@/lib/restaurant-theme';
import { cn } from '@/lib/utils';

type Step = 'email' | 'signup' | 'login' | 'account' | 'orders' | 'orderDetail';

type OrderListItem = {
  id: string;
  shortOrderId: string;
  status: string;
  total: number;
  createdAt: string;
  fulfillment: 'delivery' | 'pickUp';
  branchName: string | null;
  paymentStatus: string | null;
  itemPreview: string[];
  itemCount: number;
};

type OrderDetail = {
  id: string;
  shortOrderId: string;
  status: string;
  total: number;
  serviceChargeAmount: number;
  createdAt: string;
  fulfillment: 'delivery' | 'pickUp';
  customerComment: string | null;
  cutleryRequested: boolean;
  scheduleMode: string | null;
  scheduleSlot: string | null;
  branch: { id: string; name: string; address: string | null } | null;
  payments: Array<{
    id: string;
    status: string;
    method: string;
    amount: number;
  }>;
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    name: string;
    imageUrl: string | null;
    modifiers: Array<{
      id: string;
      name: string;
      unitPrice: number;
      quantity: number;
    }>;
  }>;
};

type CustomerAccountSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantSlug: string | null;
  themePrimaryColor?: string | null;
  account: CustomerAccountInfo | null;
  /** Which view to show when opening: account/auth or orders. */
  view?: 'account' | 'orders';
  onAuthSuccess: () => Promise<void> | void;
  onLogout: () => Promise<void> | void;
};

export function CustomerAccountSheet({
  open,
  onOpenChange,
  restaurantSlug,
  themePrimaryColor,
  account,
  view = 'account',
  onAuthSuccess,
  onLogout,
}: CustomerAccountSheetProps) {
  const { t } = useTranslation();
  const { formatMoney } = useRestaurantRegional(restaurantSlug ?? undefined);
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersLoadingMore, setOrdersLoadingMore] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [ordersNextCursor, setOrdersNextCursor] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const sheetStyle = useMemo(
    () => buildCustomerLightSurfaceVars(themePrimaryColor) as CSSProperties,
    [themePrimaryColor]
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setBusy(false);
    setPassword('');
    setShowPassword(false);
    setOrderDetail(null);
    if (account) {
      setStep(view === 'orders' ? 'orders' : 'account');
      setEmail(account.email);
      setName(account.name);
      setPhone(account.phone ?? '');
    } else {
      setStep('email');
      setName('');
      setPhone('');
    }
  }, [open, account, view]);

  // Load first page of orders whenever the orders step becomes active.
  useEffect(() => {
    if (!open || step !== 'orders' || !account || !restaurantSlug) return;

    let cancelled = false;
    setOrdersLoading(true);
    setOrdersError(null);
    setOrdersNextCursor(null);

    void (async () => {
      try {
        const res = await fetch(
          `/api/customer/me/orders?restaurantSlug=${encodeURIComponent(restaurantSlug)}&limit=20`,
          { cache: 'no-store' }
        );
        const json = (await res.json().catch(() => ({}))) as {
          data?: { orders?: OrderListItem[]; nextCursor?: string | null };
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setOrdersError(json.error || t('customerAuthGenericError'));
          setOrders([]);
          return;
        }
        setOrders(json.data?.orders ?? []);
        setOrdersNextCursor(json.data?.nextCursor ?? null);
      } catch {
        if (!cancelled) setOrdersError(t('customerAuthGenericError'));
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, step, account, restaurantSlug, t]);

  const loadMoreOrders = async () => {
    if (!restaurantSlug || !ordersNextCursor || ordersLoadingMore) return;
    setOrdersLoadingMore(true);
    try {
      const res = await fetch(
        `/api/customer/me/orders?restaurantSlug=${encodeURIComponent(restaurantSlug)}&limit=20&cursor=${encodeURIComponent(ordersNextCursor)}`,
        { cache: 'no-store' }
      );
      const json = (await res.json().catch(() => ({}))) as {
        data?: { orders?: OrderListItem[]; nextCursor?: string | null };
      };
      if (!res.ok) return;
      setOrders((prev) => [...prev, ...(json.data?.orders ?? [])]);
      setOrdersNextCursor(json.data?.nextCursor ?? null);
    } finally {
      setOrdersLoadingMore(false);
    }
  };

  const openOrderDetail = async (orderId: string) => {
    if (!restaurantSlug) return;
    setStep('orderDetail');
    setDetailLoading(true);
    setOrderDetail(null);
    try {
      const res = await fetch(
        `/api/customer/me/orders/${encodeURIComponent(orderId)}?restaurantSlug=${encodeURIComponent(restaurantSlug)}`,
        { cache: 'no-store' }
      );
      const json = (await res.json().catch(() => ({}))) as {
        data?: { order?: OrderDetail };
      };
      setOrderDetail(res.ok ? (json.data?.order ?? null) : null);
    } catch {
      setOrderDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const resetToEmail = () => {
    setStep('email');
    setPassword('');
    setError(null);
  };

  const handleIdentify = async () => {
    if (!restaurantSlug) {
      setError(t('customerAuthRestaurantMissing'));
      return;
    }
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError(t('customerAuthEmailInvalid'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/customer-auth/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantSlug,
          email: trimmed,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { exists?: boolean; email?: string };
        error?: string;
      };
      if (!res.ok) {
        setError(json.error || t('customerAuthGenericError'));
        return;
      }
      setEmail(json.data?.email || trimmed);
      setStep(json.data?.exists ? 'login' : 'signup');
    } catch {
      setError(t('customerAuthGenericError'));
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async () => {
    if (!restaurantSlug) {
      setError(t('customerAuthRestaurantMissing'));
      return;
    }
    if (!name.trim()) {
      setError(t('customerAuthNameRequired'));
      return;
    }
    if (password.length < 8) {
      setError(t('customerAuthPasswordShort'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/customer-auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantSlug,
          email: email.trim(),
          name: name.trim(),
          phone: phone.trim() || null,
          password,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setError(json.error || t('customerAuthGenericError'));
        return;
      }
      await onAuthSuccess();
      if (view === 'orders') {
        setStep('orders');
      } else {
        setStep('account');
        onOpenChange(false);
      }
    } catch {
      setError(t('customerAuthGenericError'));
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = async () => {
    if (!restaurantSlug) {
      setError(t('customerAuthRestaurantMissing'));
      return;
    }
    if (!password) {
      setError(t('customerAuthPasswordRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/customer-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantSlug,
          email: email.trim(),
          password,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setError(json.error || t('customerAuthInvalidCredentials'));
        return;
      }
      await onAuthSuccess();
      if (view === 'orders') {
        setStep('orders');
      } else {
        setStep('account');
        onOpenChange(false);
      }
    } catch {
      setError(t('customerAuthGenericError'));
    } finally {
      setBusy(false);
    }
  };

  const title =
    step === 'login'
      ? t('customerAuthLoginTitle')
      : step === 'account'
        ? t('customerAuthAccountTitle')
        : step === 'orders'
          ? t('customerOrdersTitle')
          : step === 'orderDetail'
            ? t('customerOrderDetailTitle')
            : t('customerAuthCreateTitle');

  const showBack =
    step === 'signup' ||
    step === 'login' ||
    step === 'orders' ||
    step === 'orderDetail';

  const handleBack = () => {
    if (step === 'orderDetail') {
      setOrderDetail(null);
      setStep('orders');
      return;
    }
    if (step === 'orders') {
      setStep('account');
      return;
    }
    resetToEmail();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          'web-app-customer flex w-full flex-col gap-0 border-l border-[#e8e8ee] bg-white p-0 text-[#1f1235] sm:max-w-[440px]',
          '[&>button]:hidden'
        )}
        style={sheetStyle}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#ececf0] px-4 py-4">
          {showBack ? (
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#1f1235] transition hover:bg-[#f4f4f7]"
              onClick={handleBack}
              aria-label={t('back')}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <span className="h-9 w-9" />
          )}
          <SheetTitle className="flex-1 text-center text-sm font-bold uppercase tracking-wide text-[#1f1235]">
            {title}
          </SheetTitle>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#1f1235] transition hover:bg-[#f4f4f7]"
            onClick={() => onOpenChange(false)}
            aria-label={t('close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-6">
          {step === 'email' ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-primary">
                  {t('customerAuthEmailLabel')} *
                </Label>
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="johndoe@email.com"
                  className="h-12 rounded-xl border-0 bg-[#f2f2f5] px-4 text-[#1f1235] shadow-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleIdentify();
                  }}
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
              <Button
                type="button"
                variant="default"
                className="h-12 w-full rounded-xl text-base font-bold"
                disabled={busy}
                onClick={() => void handleIdentify()}
              >
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  t('customerAuthSignUpByEmail')
                )}
              </Button>
              <p className="text-center text-sm text-[#5b5670]">
                {t('customerAuthAlreadyHaveAccount')}{' '}
                <button
                  type="button"
                  className="font-semibold text-primary underline-offset-2 hover:underline"
                  onClick={() => {
                    setError(null);
                    setStep('login');
                  }}
                >
                  {t('storefrontLogin')}
                </button>
              </p>
            </div>
          ) : null}

          {step === 'signup' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-primary">
                  {t('customerAuthEmailLabel')} *
                </Label>
                <Input
                  type="email"
                  value={email}
                  readOnly
                  className="h-12 rounded-xl border-0 bg-[#f2f2f5] px-4 text-[#1f1235] opacity-90 shadow-none"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-primary">
                  {t('customerAuthNameLabel')} *
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className="h-12 rounded-xl border-0 bg-[#f2f2f5] px-4 text-[#1f1235] shadow-none focus-visible:ring-2 focus-visible:ring-primary/30"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-primary">
                  {t('customerAuthPhoneLabel')}
                </Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  placeholder={t('customerAuthPhoneOptional')}
                  className="h-12 rounded-xl border-0 bg-[#f2f2f5] px-4 text-[#1f1235] shadow-none focus-visible:ring-2 focus-visible:ring-primary/30"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-primary">
                  {t('customerAuthPasswordLabel')} *
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="h-12 rounded-xl border-0 bg-[#f2f2f5] px-4 pr-12 text-[#1f1235] shadow-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b6680]"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={t('customerAuthTogglePassword')}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
              <Button
                type="button"
                variant="default"
                className="h-12 w-full rounded-xl text-base font-bold"
                disabled={busy}
                onClick={() => void handleRegister()}
              >
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  t('customerAuthContinue')
                )}
              </Button>
            </div>
          ) : null}

          {step === 'login' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-primary">
                  {t('customerAuthEmailLabel')} *
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="h-12 rounded-xl border-0 bg-[#f2f2f5] px-4 text-[#1f1235] shadow-none focus-visible:ring-2 focus-visible:ring-primary/30"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-primary">
                  {t('customerAuthPasswordLabel')} *
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="h-12 rounded-xl border-0 bg-[#f2f2f5] px-4 pr-12 text-[#1f1235] shadow-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleLogin();
                    }}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b6680]"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={t('customerAuthTogglePassword')}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
              <Button
                type="button"
                variant="default"
                className="h-12 w-full rounded-xl text-base font-bold"
                disabled={busy}
                onClick={() => void handleLogin()}
              >
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  t('storefrontLogin')
                )}
              </Button>
              <p className="text-center text-sm text-[#5b5670]">
                {t('customerAuthNoAccount')}{' '}
                <button
                  type="button"
                  className="font-semibold text-primary underline-offset-2 hover:underline"
                  onClick={resetToEmail}
                >
                  {t('customerAuthCreateTitle')}
                </button>
              </p>
            </div>
          ) : null}

          {step === 'account' && account ? (
            <div className="space-y-5">
              <div className="rounded-2xl bg-[#f7f7fa] p-4">
                <p className="text-lg font-bold text-[#1f1235]">{account.name}</p>
                <p className="mt-1 text-sm text-[#5b5670]">{account.email}</p>
                {account.phone ? (
                  <p className="mt-1 text-sm text-[#5b5670]">{account.phone}</p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="default"
                className="h-12 w-full rounded-xl text-base font-bold"
                onClick={() => setStep('orders')}
              >
                {t('customerAuthMyOrders')}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-xl border-[#d9d9e2]"
                onClick={() => void onLogout()}
              >
                {t('customerAuthLogout')}
              </Button>
            </div>
          ) : null}

          {step === 'orders' ? (
            <div className="space-y-3">
              {ordersLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : ordersError ? (
                <p className="py-8 text-center text-sm text-destructive">
                  {ordersError}
                </p>
              ) : orders.length === 0 ? (
                <div className="space-y-2 py-10 text-center">
                  <p className="text-base font-semibold text-[#1f1235]">
                    {t('customerOrdersEmpty')}
                  </p>
                  <p className="text-sm text-[#5b5670]">
                    {t('customerOrdersEmptyHint')}
                  </p>
                </div>
              ) : (
                <>
                  {orders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl bg-[#f7f7fa] p-4 text-left transition hover:bg-[#efeff4]"
                    onClick={() => void openOrderDetail(order.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-[#1f1235]">
                          #{order.shortOrderId}
                        </p>
                        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold capitalize text-primary">
                          {order.status.toLowerCase().replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#5b5670]">
                        {new Date(order.createdAt).toLocaleString()}
                        {order.branchName ? ` · ${order.branchName}` : ''}
                      </p>
                      {order.itemPreview.length > 0 ? (
                        <p className="mt-1 truncate text-xs text-[#5b5670]">
                          {order.itemPreview.join(', ')}
                          {order.itemCount > order.itemPreview.length
                            ? ` +${order.itemCount - order.itemPreview.length}`
                            : ''}
                        </p>
                      ) : null}
                      <p className="mt-1 text-sm font-semibold text-[#1f1235]">
                        {formatMoney(order.total)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#8a86a0]" />
                  </button>
                  ))}
                  {ordersNextCursor ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full rounded-xl border-[#d9d9e2]"
                      disabled={ordersLoadingMore}
                      onClick={() => void loadMoreOrders()}
                    >
                      {ordersLoadingMore ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        t('customerOrdersLoadMore')
                      )}
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {step === 'orderDetail' ? (
            detailLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : !orderDetail ? (
              <p className="py-8 text-center text-sm text-[#5b5670]">
                {t('customerOrderNotFound')}
              </p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl bg-[#f7f7fa] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base font-bold text-[#1f1235]">
                      #{orderDetail.shortOrderId}
                    </p>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold capitalize text-primary">
                      {orderDetail.status.toLowerCase().replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#5b5670]">
                    {new Date(orderDetail.createdAt).toLocaleString()}
                  </p>
                  {orderDetail.branch ? (
                    <p className="mt-1 text-xs text-[#5b5670]">
                      {orderDetail.branch.name}
                      {orderDetail.branch.address
                        ? ` · ${orderDetail.branch.address}`
                        : ''}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-bold uppercase tracking-wide text-[#1f1235]">
                    {t('customerOrderItems')}
                  </p>
                  {orderDetail.items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl bg-[#f7f7fa] p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-[#1f1235]">
                          {item.quantity}× {item.name}
                        </p>
                        <p className="shrink-0 text-sm font-semibold text-[#1f1235]">
                          {formatMoney(item.unitPrice * item.quantity)}
                        </p>
                      </div>
                      {item.modifiers.length > 0 ? (
                        <ul className="mt-1 space-y-0.5">
                          {item.modifiers.map((mod) => (
                            <li
                              key={mod.id}
                              className="flex justify-between text-xs text-[#5b5670]"
                            >
                              <span>
                                {mod.quantity > 1 ? `${mod.quantity}× ` : ''}
                                {mod.name}
                              </span>
                              {mod.unitPrice ? (
                                <span>
                                  {formatMoney(mod.unitPrice * mod.quantity)}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>

                {orderDetail.payments.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-bold uppercase tracking-wide text-[#1f1235]">
                      {t('customerOrderPayment')}
                    </p>
                    {orderDetail.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between rounded-2xl bg-[#f7f7fa] p-3 text-sm"
                      >
                        <span className="capitalize text-[#5b5670]">
                          {payment.method.toLowerCase().replace(/_/g, ' ')} ·{' '}
                          {payment.status.toLowerCase().replace(/_/g, ' ')}
                        </span>
                        <span className="font-semibold text-[#1f1235]">
                          {formatMoney(payment.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="flex items-center justify-between rounded-2xl bg-[#1f1235] p-4 text-white">
                  <span className="text-sm font-semibold uppercase tracking-wide">
                    {t('total')}
                  </span>
                  <span className="text-base font-bold">
                    {formatMoney(orderDetail.total)}
                  </span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full rounded-xl border-[#d9d9e2]"
                  onClick={handleBack}
                >
                  {t('customerOrderBack')}
                </Button>
              </div>
            )
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Mounted once under the provider to bind open state. */
export function CustomerAccountSheetHost() {
  const {
    sheetOpen,
    setSheetOpen,
    restaurantSlug,
    themePrimaryColor,
    account,
    refreshSession,
    logout,
    sheetView,
  } = useCustomerAccount();

  return (
    <CustomerAccountSheet
      open={sheetOpen}
      onOpenChange={setSheetOpen}
      restaurantSlug={restaurantSlug}
      themePrimaryColor={themePrimaryColor}
      account={account}
      view={sheetView}
      onAuthSuccess={refreshSession}
      onLogout={logout}
    />
  );
}
