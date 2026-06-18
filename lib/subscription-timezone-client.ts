/** Browser-safe mirrors of subscription timezone env (NEXT_PUBLIC_*). */

const TZ_PATTERN = /^[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)*$/;

function resolveTimezone(
  raw: string | undefined,
  fallback: string
): string {
  const value = raw?.trim();
  if (value && TZ_PATTERN.test(value)) return value;
  return fallback;
}

export function getClientSubscriptionAdminTimezone(): string {
  return resolveTimezone(
    process.env.NEXT_PUBLIC_SUBSCRIPTION_ADMIN_TIMEZONE,
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Karachi'
  );
}

export function getClientPayPalBillingTimezone(): string {
  return resolveTimezone(
    process.env.NEXT_PUBLIC_PAYPAL_BILLING_TIMEZONE,
    'America/New_York'
  );
}

const DATETIME_LOCAL_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function partsFromIntl(date: Date, timeZone: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const lookup = Object.fromEntries(
    dtf
      .formatToParts(date)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value])
  );
  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
    second: Number(lookup.second ?? 0),
  };
}

function timezoneOffsetMs(atUtc: Date, timeZone: string): number {
  const parts = partsFromIntl(atUtc, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return asUtc - atUtc.getTime();
}

function zonedLocalToUtc(parts: ZonedParts, timeZone: string): Date {
  let utc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  for (let i = 0; i < 3; i++) {
    const offset = timezoneOffsetMs(new Date(utc), timeZone);
    utc =
      Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second
      ) - offset;
  }
  return new Date(utc);
}

export function utcToDatetimeLocalInTimezone(
  iso: string | null | undefined,
  timeZone: string
): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const p = partsFromIntl(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function parseDatetimeLocalInTimezone(
  value: string,
  timeZone: string
): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = DATETIME_LOCAL_RE.exec(trimmed);
  if (match) {
    const [, y, mo, d, h, mi, s] = match;
    return zonedLocalToUtc(
      {
        year: Number(y),
        month: Number(mo),
        day: Number(d),
        hour: Number(h),
        minute: Number(mi),
        second: s ? Number(s) : 0,
      },
      timeZone
    );
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatInTimezone(
  iso: string | null | undefined,
  timeZone: string
): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function mirrorWallClockToTimezone(
  periodEndUtc: Date,
  fromTimeZone: string,
  toTimeZone: string
): Date {
  const parts = partsFromIntl(periodEndUtc, fromTimeZone);
  return zonedLocalToUtc(parts, toTimeZone);
}

export function subscriptionDateInputToIso(
  value: string,
  adminTimeZone: string
): string | null {
  const parsed = parseDatetimeLocalInTimezone(value, adminTimeZone);
  return parsed ? parsed.toISOString() : null;
}
