const TZ_PATTERN = /^[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)*$/;

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

function resolveTimezone(
  raw: string | undefined,
  fallback: string
): string {
  const value = raw?.trim();
  if (value && TZ_PATTERN.test(value)) return value;
  return fallback;
}

/** IANA timezone for admin subscription dates (input + display). */
export function getSubscriptionAdminTimezone(): string {
  return resolveTimezone(
    process.env.SUBSCRIPTION_ADMIN_TIMEZONE,
    'Asia/Karachi'
  );
}

/** IANA timezone used for PayPal billing schedule display/sync. */
export function getPayPalBillingTimezone(): string {
  return resolveTimezone(
    process.env.PAYPAL_BILLING_TIMEZONE,
    'America/New_York'
  );
}

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

/** Wall-clock local time in `timeZone` → UTC instant. */
export function zonedLocalToUtc(
  parts: ZonedParts,
  timeZone: string
): Date {
  let utc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second ?? 0
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
        parts.second ?? 0
      ) - offset;
  }
  return new Date(utc);
}

export function parseDatetimeLocalInTimezone(
  value: string | null | undefined,
  timeZone: string
): Date | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
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

export function utcToDatetimeLocalInTimezone(
  iso: string | Date | null | undefined,
  timeZone: string
): string {
  if (!iso) return '';
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const p = partsFromIntl(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function formatInTimezone(
  iso: string | Date | null | undefined,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!iso) return '—';
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}

/**
 * Same calendar date and clock time in PayPal's region (e.g. 9:00 AM PKT input
 * → 9:00 AM America/New_York on the same Y-M-D), not the same UTC instant.
 */
export function mirrorWallClockToTimezone(
  periodEndUtc: Date,
  fromTimeZone: string,
  toTimeZone: string
): Date {
  const parts = partsFromIntl(periodEndUtc, fromTimeZone);
  return zonedLocalToUtc(parts, toTimeZone);
}

/** Parse admin datetime-local or ISO; naive strings use admin timezone. */
export function parseSubscriptionDateInput(
  value: string | null | undefined
): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/[zZ]$/.test(trimmed) || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return parseDatetimeLocalInTimezone(trimmed, getSubscriptionAdminTimezone());
}
