'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  Info,
  Menu,
  ShoppingBag,
  User,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { LanguageSwitcher } from '@/components/main/language-switcher';
import { useCustomerAccountOptional } from '@/components/customer-app/customer-account-context';
import { OrderTimePickerDialog } from '@/components/order/order-time-picker-dialog';
import { OrderStoreInfoSheet } from '@/components/order/order-store-info-sheet';
import { cn } from '@/lib/utils';
import { buildCustomerLightSurfaceVars } from '@/lib/restaurant-theme';
import {
  generateOrderTimeSlots,
  isBranchClosedToday,
  readOrderSchedule,
  writeOrderSchedule,
  type OrderSchedule,
} from '@/lib/order-time-slots';

export const ORDER_TOP_BAR_HEIGHT_PX = 72;
export const ORDER_INFO_ROW_HEIGHT_PX = 68;
export const ORDER_MENU_HEADER_HEIGHT_PX =
  ORDER_TOP_BAR_HEIGHT_PX + ORDER_INFO_ROW_HEIGHT_PX;
export const ORDER_CATEGORY_BAR_HEIGHT_PX = 72;
export const ORDER_SIDEBAR_WIDTH_PX = 320;
export const ORDER_PAGE_MAX_WIDTH_PX = 1280;
export const ORDER_TOP_OFFSET_PX =
  ORDER_MENU_HEADER_HEIGHT_PX + ORDER_CATEGORY_BAR_HEIGHT_PX;

const ORDER_ACCENT_GOLD = '#f5d76e';

export { ORDER_ACCENT_GOLD };

type OrderMenuHeaderProps = {
  orderId: string;
  restaurantName?: string | null;
  restaurantSlug?: string | null;
  logoUrl?: string | null;
  themePrimaryColor?: string | null;
  orderType: 'delivery' | 'pickUp';
  storeName?: string | null;
  storeAddress?: string | null;
  deliveryAddress?: string | null;
  backHref: string;
  className?: string;
  branchHours?: Array<{
    dayOfWeek: number;
    isOpen: boolean;
    openTime: string;
    closeTime: string;
  }> | null;
  slotDurationMinutes?: number;
};

export function OrderMenuHeader({
  orderId,
  restaurantName,
  restaurantSlug,
  logoUrl,
  themePrimaryColor,
  orderType,
  storeName,
  storeAddress,
  deliveryAddress,
  backHref,
  className,
  branchHours,
  slotDurationMinutes = 30,
}: OrderMenuHeaderProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const customerAccount = useCustomerAccountOptional();
  const openAccountSheet = customerAccount?.openAccountSheet;
  const setRestaurantContext = customerAccount?.setRestaurantContext;
  const accountName = customerAccount?.account?.name?.trim();
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const [methodChangeOpen, setMethodChangeOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [storeInfoOpen, setStoreInfoOpen] = useState(false);
  const timeSlots = useMemo(
    () =>
      generateOrderTimeSlots(branchHours, {
        intervalMinutes: slotDurationMinutes,
      }),
    [branchHours, slotDurationMinutes]
  );
  const branchClosed =
    isBranchClosedToday(branchHours) || timeSlots.length === 0;
  const [schedule, setSchedule] = useState<OrderSchedule>({
    mode: 'asap',
    slot: '',
  });

  useEffect(() => {
    if (branchClosed) {
      setSchedule({ mode: 'asap', slot: '' });
      return;
    }
    const saved = readOrderSchedule(orderId);
    if (saved) {
      const stillValid =
        !saved.slotDateTime ||
        timeSlots.some((slot) => slot.startAt === saved.slotDateTime);
      if (saved.mode === 'later' && !stillValid) {
        const next = {
          mode: 'later' as const,
          slot: timeSlots[0]?.label ?? '',
          slotDateTime: timeSlots[0]?.startAt,
        };
        setSchedule(next);
        writeOrderSchedule(orderId, next);
        return;
      }
      setSchedule(saved);
      return;
    }
    setSchedule({
      mode: 'asap',
      slot: timeSlots[0]?.label ?? '',
      slotDateTime: timeSlots[0]?.startAt,
    });
  }, [orderId, timeSlots, branchClosed]);

  const handleSaveSchedule = (next: OrderSchedule) => {
    setSchedule(next);
    writeOrderSchedule(orderId, next);
  };

  const schedulePrimaryLabel = branchClosed
    ? t('branchClosed')
    : schedule.mode === 'asap'
      ? t('orderAsap')
      : t('orderForLater');
  const scheduleSecondaryLabel = branchClosed
    ? t('branchClosedHint')
    : schedule.mode === 'asap'
      ? timeSlots[0]?.label || t('orderTimeRangePlaceholder')
      : schedule.slot || timeSlots[0]?.label || t('orderTimeRangePlaceholder');

  useEffect(() => {
    if (!setRestaurantContext) return;
    setRestaurantContext({
      restaurantSlug: restaurantSlug ?? null,
      themePrimaryColor: themePrimaryColor ?? null,
    });
  }, [setRestaurantContext, restaurantSlug, themePrimaryColor]);

  const handleConfirmOrderMethodChange = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`cart-${orderId}`);
    }
    setMethodChangeOpen(false);
    router.push(backHref);
  };

  const openLogin = () => {
    openAccountSheet?.({
      restaurantSlug: restaurantSlug ?? null,
    });
  };

  const openMyOrders = () => {
    openAccountSheet?.({
      restaurantSlug: restaurantSlug ?? null,
      view: 'orders',
    });
  };

  const brandLabel = restaurantName?.trim() || 'Restaurant';
  const loginLabel = accountName || t('storefrontLogin');
  const locationLine =
    orderType === 'delivery'
      ? deliveryAddress?.trim() || storeAddress?.trim() || ''
      : storeAddress?.trim() || '';

  const branchLabel = [brandLabel, storeName?.trim()]
    .filter(Boolean)
    .join(' - ');

  const normalizedLogoUrl =
    logoUrl && logoUrl.trim().length > 0 ? logoUrl.trim() : null;

  const menuSheetStyle = useMemo(
    () => buildCustomerLightSurfaceVars(themePrimaryColor) as CSSProperties,
    [themePrimaryColor]
  );

  const menuSheet = (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center text-[#f5d76e] transition hover:text-white sm:hidden"
          aria-label={t('storefrontMenu')}
        >
          <Menu className="h-6 w-6" strokeWidth={1.5} />
        </button>
      </SheetTrigger>
      <SheetTrigger asChild>
        <Button
          size="sm"
          className="hidden h-9 rounded-lg border-0 bg-white px-3 text-xs font-bold uppercase tracking-wide text-[#1a1033] shadow-none hover:bg-white/90 sm:inline-flex"
        >
          <Menu className="mr-1.5 h-4 w-4" />
          {t('storefrontMenu')}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[min(100vw-2rem,320px)] border-border bg-background text-foreground"
        style={menuSheetStyle}
      >
        <SheetHeader>
          <SheetTitle>{brandLabel}</SheetTitle>
        </SheetHeader>
        <nav className="mt-6 flex flex-col gap-1">
          <SheetClose asChild>
            <Link
              href={backHref}
              className="flex items-center gap-2 rounded-lg px-2 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" />
              {t('orderBack')}
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <button
              type="button"
              onClick={openLogin}
              className="flex items-center gap-2 rounded-lg px-2 py-3 text-left text-sm font-medium text-foreground transition hover:bg-muted lg:hidden"
            >
              <User className="h-4 w-4" />
              {loginLabel}
            </button>
          </SheetClose>
          {customerAccount ? (
            <SheetClose asChild>
              <button
                type="button"
                onClick={openMyOrders}
                className="flex items-center gap-2 rounded-lg px-2 py-3 text-left text-sm font-medium text-foreground transition hover:bg-muted"
              >
                <CalendarDays className="h-4 w-4" />
                {t('customerAuthMyOrders')}
              </button>
            </SheetClose>
          ) : null}
        </nav>
        <div className="mt-6 border-t border-border pt-5">
          <p className="mb-3 text-sm font-medium text-foreground">
            {t('language')}
          </p>
          <LanguageSwitcher variant="toggle" tone="default" />
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 bg-primary text-primary-foreground',
        className
      )}
    >
      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6">
        <div className="flex h-[72px] items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center justify-start">
            <Link
              href={backHref}
              className="inline-flex min-w-0 items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:text-white/90"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/10">
                <ChevronLeft className="h-5 w-5" strokeWidth={2} />
              </span>
              <span className="hidden sm:inline">{t('orderBack')}</span>
            </Link>
          </div>

          <div className="flex shrink-0 items-center justify-center px-1">
            {normalizedLogoUrl && !logoLoadFailed ? (
              <img
                key={normalizedLogoUrl}
                src={normalizedLogoUrl}
                alt={brandLabel}
                className="h-9 max-w-[min(220px,46vw)] object-contain sm:h-10"
                onError={() => setLogoLoadFailed(true)}
              />
            ) : (
              <span
                className="max-w-[min(220px,70vw)] truncate text-center text-sm font-bold uppercase tracking-wide sm:text-base"
                style={{ color: ORDER_ACCENT_GOLD }}
              >
                {brandLabel}
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={openLogin}
              className="inline-flex h-10 w-10 items-center justify-center sm:hidden"
              style={{ color: ORDER_ACCENT_GOLD }}
              aria-label={loginLabel}
            >
              <User className="h-5 w-5" strokeWidth={1.75} />
            </button>

            <button
              type="button"
              onClick={openLogin}
              className="hidden items-center gap-1.5 text-sm font-medium transition hover:opacity-90 sm:inline-flex"
              style={{ color: ORDER_ACCENT_GOLD }}
            >
              <User className="h-4 w-4" strokeWidth={1.75} />
              {loginLabel}
            </button>

            {menuSheet}
          </div>
        </div>
      </div>

      <div className="border-t border-white/20 bg-primary">
        <div
          className="mx-auto flex w-full max-w-[1280px] flex-row items-stretch divide-x divide-white/25 px-4 sm:px-6"
          style={{ minHeight: ORDER_INFO_ROW_HEIGHT_PX }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2.5 py-3 sm:gap-3">
            <ShoppingBag
              className="h-4 w-4 shrink-0 text-white sm:h-5 sm:w-5"
              strokeWidth={1.75}
            />
            <div className="min-w-0">
              <button
                type="button"
                className="inline-flex max-w-full items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white sm:text-xs"
                onClick={() => setMethodChangeOpen(true)}
              >
                <span className="truncate">
                  {orderType === 'delivery'
                    ? t('delivery')
                    : t('orderPickUpLabel')}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white" />
              </button>
              {locationLine ? (
                <p
                  className="mt-1 truncate text-[10px] font-medium sm:text-xs"
                  style={{ color: ORDER_ACCENT_GOLD }}
                >
                  {locationLine}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 items-center px-3 py-3 sm:px-4">
            <div className="min-w-0">
              {branchClosed ? (
                <>
                  <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-white sm:text-xs">
                    {schedulePrimaryLabel}
                  </p>
                  <p
                    className="mt-1 truncate text-[10px] font-medium sm:text-xs"
                    style={{ color: ORDER_ACCENT_GOLD }}
                  >
                    {scheduleSecondaryLabel}
                  </p>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="inline-flex max-w-full items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white sm:text-xs"
                    onClick={() => setTimePickerOpen(true)}
                  >
                    <span className="truncate">{schedulePrimaryLabel}</span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white" />
                  </button>
                  <p
                    className="mt-1 truncate text-[10px] font-medium sm:text-xs"
                    style={{ color: ORDER_ACCENT_GOLD }}
                  >
                    {scheduleSecondaryLabel}
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 items-center px-3 py-3 sm:px-4">
            <div className="min-w-0">
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-white sm:text-xs">
                {branchLabel}
              </p>
              <button
                type="button"
                className="mt-1 truncate text-left text-[10px] font-medium underline underline-offset-2 sm:text-xs"
                style={{ color: ORDER_ACCENT_GOLD }}
                onClick={() => setStoreInfoOpen(true)}
              >
                {t('orderMoreInfo')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={methodChangeOpen} onOpenChange={setMethodChangeOpen}>
        <AlertDialogContent className="max-w-[min(100vw-2rem,400px)] gap-0 rounded-2xl border-0 p-6 shadow-xl">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-primary text-primary">
              <AlertCircle className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <AlertDialogTitle className="text-left text-lg font-bold text-primary">
                {t('orderMethodChangeTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-2 text-left text-sm leading-relaxed text-primary">
                {t('orderMethodChangeMessage')}
              </AlertDialogDescription>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <AlertDialogAction
              onClick={handleConfirmOrderMethodChange}
              className="h-11 w-full rounded-xl border-0 bg-[#f5d76e] text-sm font-bold text-primary hover:bg-[#f5d76e]/90"
            >
              {t('orderMethodChangeConfirm')}
            </AlertDialogAction>
            <AlertDialogCancel className="mt-0 h-11 w-full rounded-xl border-0 bg-[#f4f4f6] text-sm font-bold text-[#1f1f2e] hover:bg-[#ececf0]">
              {t('cancel')}
            </AlertDialogCancel>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <OrderTimePickerDialog
        open={timePickerOpen && !branchClosed}
        onOpenChange={setTimePickerOpen}
        schedule={schedule}
        onSave={handleSaveSchedule}
        branchHours={branchHours}
        slotDurationMinutes={slotDurationMinutes}
      />

      <OrderStoreInfoSheet
        open={storeInfoOpen}
        onOpenChange={setStoreInfoOpen}
        locationTitle={branchLabel}
        address={storeAddress?.trim() || ''}
        branchHours={branchHours}
      />
    </header>
  );
}

export function OrderCartPanelHeader() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 bg-primary px-4 py-3.5 text-primary-foreground">
      <h2 className="text-base font-bold">{t('yourCart')}</h2>
      <Info className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
    </div>
  );
}

type OrderCartPanelProps = {
  isEmpty: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function OrderCartPanel({ isEmpty, children, footer }: OrderCartPanelProps) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-t-xl border border-[#e8eaef] bg-white shadow-[0_1px_4px_rgba(15,23,42,0.08)]">
      <OrderCartPanelHeader />
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col bg-white',
          isEmpty
            ? 'items-center justify-center px-6 py-14'
            : 'overflow-y-auto px-4 py-3'
        )}
      >
        {children}
      </div>
      {footer ? (
        <div className="shrink-0 border-t border-[#ececf0] bg-white p-3 shadow-[0_-4px_12px_rgba(15,23,42,0.06)]">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

type OrderCartCheckoutButtonProps = {
  itemCount: number;
  total: number;
  formattedTotal?: string;
  label: string;
  onClick: () => void;
};

export function OrderCartCheckoutButton({
  itemCount,
  total,
  formattedTotal,
  label,
  onClick,
}: OrderCartCheckoutButtonProps) {
  const totalLabel =
    formattedTotal ??
    (Number.isFinite(total) ? total.toFixed(2) : '0.00');
  return (
    <Button
      variant="default"
      onClick={onClick}
      className="flex h-12 w-full items-center gap-2 rounded-xl px-3 transition"
    >
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
        <ShoppingBag className="h-5 w-5" strokeWidth={2.25} aria-hidden />
      </span>
      <span className="flex-1 text-center text-sm font-bold">{label}</span>
      <span className="shrink-0 text-sm font-bold">{totalLabel}</span>
    </Button>
  );
}
