export type AccessResult = {
  allowed: boolean;
  reason:
    | 'ok'
    | 'no_subscription'
    | 'trial_expired'
    | 'subscription_expired'
    | 'inactive_status';
  warning: string | null;
};

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export function evaluateSubscriptionAccess(input: {
  status: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
} | null): AccessResult {
  if (!input) {
    return { allowed: false, reason: 'no_subscription', warning: null };
  }

  const now = Date.now();
  const status = String(input.status ?? '').toUpperCase();
  const trialEndsMs = input.trialEndsAt ? input.trialEndsAt.getTime() : null;
  const periodEndsMs = input.currentPeriodEnd ? input.currentPeriodEnd.getTime() : null;

  if (status === 'TRIAL') {
    if (trialEndsMs == null || trialEndsMs < now) {
      return { allowed: false, reason: 'trial_expired', warning: null };
    }
    const left = trialEndsMs - now;
    const warning =
      left <= THREE_DAYS_MS
        ? `Your trial ends in ${Math.max(0, Math.ceil(left / (24 * 60 * 60 * 1000)))} day(s).`
        : null;
    return { allowed: true, reason: 'ok', warning };
  }

  if (status === 'ACTIVE') {
    if (periodEndsMs != null && periodEndsMs < now) {
      return { allowed: false, reason: 'subscription_expired', warning: null };
    }
    const warning =
      periodEndsMs != null && periodEndsMs - now <= THREE_DAYS_MS
        ? `Your subscription expires in ${Math.max(0, Math.ceil((periodEndsMs - now) / (24 * 60 * 60 * 1000)))} day(s).`
        : null;
    return { allowed: true, reason: 'ok', warning };
  }

  return { allowed: false, reason: 'inactive_status', warning: null };
}

/** True while trial or paid period end is still in the future (for pricing / renew UI). */
export function isSubscriptionPeriodActive(input: {
  status: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
} | null): boolean {
  if (!input) return false;

  const now = Date.now();
  const status = String(input.status ?? '').toUpperCase();

  if (status === 'TRIAL') {
    return input.trialEndsAt != null && input.trialEndsAt.getTime() >= now;
  }

  if (input.currentPeriodEnd != null) {
    return input.currentPeriodEnd.getTime() >= now;
  }

  return status === 'ACTIVE';
}
