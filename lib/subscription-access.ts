export type AccessResult = {
  allowed: boolean;
  reason:
    | 'ok'
    | 'no_subscription'
    | 'trial_expired'
    | 'subscription_expired'
    | 'inactive_status'
    | 'registration_fee_required';
  warning: string | null;
};

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function periodWarning(
  endsMs: number | null,
  kind: 'trial' | 'subscription'
): string | null {
  if (endsMs == null) return null;
  const left = endsMs - Date.now();
  if (left > THREE_DAYS_MS) return null;
  const days = Math.max(0, Math.ceil(left / (24 * 60 * 60 * 1000)));
  return kind === 'trial'
    ? `Your trial ends in ${days} day(s).`
    : `Your subscription expires in ${days} day(s).`;
}

/**
 * Dashboard entry gate.
 * - Non-FREE plans: TRIAL/ACTIVE with valid period (unchanged).
 * - FREE plan: requires registrationFeePaid, then ACTIVE (no expiry) or valid TRIAL.
 */
export function evaluateSubscriptionAccess(input: {
  status: string;
  plan?: string | null;
  registrationFeePaid?: boolean | null;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
} | null): AccessResult {
  if (!input) {
    return { allowed: false, reason: 'no_subscription', warning: null };
  }

  const now = Date.now();
  const status = String(input.status ?? '').toUpperCase();
  const plan = String(input.plan ?? 'FREE').toUpperCase();
  const registrationFeePaid = Boolean(input.registrationFeePaid);
  const trialEndsMs = input.trialEndsAt ? input.trialEndsAt.getTime() : null;
  const periodEndsMs = input.currentPeriodEnd
    ? input.currentPeriodEnd.getTime()
    : null;

  // Paid / non-Free plans: existing period rules (registration fee not required).
  if (plan !== 'FREE') {
    if (status === 'TRIAL') {
      if (trialEndsMs == null || trialEndsMs < now) {
        return { allowed: false, reason: 'trial_expired', warning: null };
      }
      return {
        allowed: true,
        reason: 'ok',
        warning: periodWarning(trialEndsMs, 'trial'),
      };
    }

    if (status === 'ACTIVE') {
      if (periodEndsMs != null && periodEndsMs < now) {
        return { allowed: false, reason: 'subscription_expired', warning: null };
      }
      return {
        allowed: true,
        reason: 'ok',
        warning: periodWarning(periodEndsMs, 'subscription'),
      };
    }

    return { allowed: false, reason: 'inactive_status', warning: null };
  }

  // Free plan: one-time registration fee unlock.
  if (!registrationFeePaid) {
    return {
      allowed: false,
      reason: 'registration_fee_required',
      warning: null,
    };
  }

  if (status === 'TRIAL') {
    if (trialEndsMs == null || trialEndsMs < now) {
      return { allowed: false, reason: 'trial_expired', warning: null };
    }
    return {
      allowed: true,
      reason: 'ok',
      warning: periodWarning(trialEndsMs, 'trial'),
    };
  }

  if (status === 'ACTIVE') {
    // null period end = lifetime Free after registration fee.
    if (periodEndsMs != null && periodEndsMs < now) {
      return { allowed: false, reason: 'subscription_expired', warning: null };
    }
    return {
      allowed: true,
      reason: 'ok',
      warning: periodWarning(periodEndsMs, 'subscription'),
    };
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
