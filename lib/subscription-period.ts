export const SUBSCRIPTION_PERIOD_DAYS = 30;

export function addSubscriptionPeriodDays(
  from: Date,
  days = SUBSCRIPTION_PERIOD_DAYS
): Date {
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return next;
}

/** Platform period end is admin-controlled until PayPal renews. */
export function hasActiveAdminPeriodLock(
  sub: {
    adminPeriodEndAt: Date | null;
    currentPeriodEnd: Date | null;
  } | null
): boolean {
  if (!sub?.adminPeriodEndAt) return false;
  const endMs = sub.currentPeriodEnd?.getTime() ?? sub.adminPeriodEndAt.getTime();
  return endMs >= Date.now();
}

export function resolveRenewalPeriodEnd(
  paypalNextBilling: Date | null,
  previousEnd: Date | null,
  days = SUBSCRIPTION_PERIOD_DAYS
): Date {
  const now = Date.now();
  const base = new Date(Math.max(previousEnd?.getTime() ?? now, now));
  const platformEnd = addSubscriptionPeriodDays(base, days);
  if (paypalNextBilling && paypalNextBilling.getTime() > platformEnd.getTime()) {
    return paypalNextBilling;
  }
  return platformEnd;
}

/** Apply PayPal next billing only when it extends access beyond the locked admin date. */
export function shouldApplyPayPalPeriodOnRefresh(
  sub: {
    adminPeriodEndAt: Date | null;
    currentPeriodEnd: Date | null;
    autoRenew: boolean;
  } | null,
  paypalNextBilling: Date | null
): boolean {
  if (!sub?.autoRenew || !paypalNextBilling) return false;
  if (!hasActiveAdminPeriodLock(sub)) return true;
  const platformEndMs = sub.currentPeriodEnd?.getTime() ?? 0;
  return paypalNextBilling.getTime() > platformEndMs;
}

export function isPeriodExpired(currentPeriodEnd: Date | null): boolean {
  return (
    currentPeriodEnd != null && currentPeriodEnd.getTime() < Date.now()
  );
}
