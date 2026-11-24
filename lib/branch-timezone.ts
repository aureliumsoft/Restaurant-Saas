import { timezoneForRestaurantCountry } from '@/lib/restaurant-regional';

export const BRANCH_TIMEZONE_OPTIONS = [
  { id: 'Asia/Karachi', label: 'Pakistan (Karachi)' },
  { id: 'Europe/Madrid', label: 'Spain (Madrid)' },
  { id: 'Europe/London', label: 'United Kingdom (London)' },
  { id: 'Europe/Paris', label: 'Central Europe (Paris)' },
  { id: 'Europe/Dublin', label: 'Ireland (Dublin)' },
  { id: 'America/New_York', label: 'US Eastern (New York)' },
  { id: 'America/Chicago', label: 'US Central (Chicago)' },
  { id: 'America/Los_Angeles', label: 'US Pacific (Los Angeles)' },
  { id: 'Asia/Dubai', label: 'United Arab Emirates (Dubai)' },
  { id: 'Asia/Kolkata', label: 'India (Kolkata)' },
  { id: 'Asia/Riyadh', label: 'Saudi Arabia (Riyadh)' },
  { id: 'Asia/Singapore', label: 'Singapore' },
  { id: 'Australia/Sydney', label: 'Australia (Sydney)' },
  { id: 'UTC', label: 'UTC' },
] as const;

export function isValidIanaTimeZone(value: string | null | undefined): boolean {
  const zone = value?.trim();
  if (!zone) return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** Saved branch zone, or the restaurant country zone when none is saved yet. */
export function resolveBranchTimeZone(
  stored: string | null | undefined,
  countryCode?: string | null
): string {
  const zone = stored?.trim();
  if (zone && isValidIanaTimeZone(zone)) return zone;
  return timezoneForRestaurantCountry(countryCode);
}

export function branchTimeZoneLabel(timeZone: string | null | undefined): string {
  const zone = timeZone?.trim();
  return (
    BRANCH_TIMEZONE_OPTIONS.find((option) => option.id === zone)?.label ??
    zone ??
    ''
  );
}

export function formatBranchDateTime(
  value: Date | string | number,
  timeZone?: string | null,
  locale?: string
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const zone = timeZone?.trim();
  return date.toLocaleString(locale, {
    ...(zone && isValidIanaTimeZone(zone) ? { timeZone: zone } : {}),
  });
}

export function formatBranchTime(
  value: Date | string | number,
  timeZone?: string | null,
  locale?: string
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const zone = timeZone?.trim();
  return date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    ...(zone && isValidIanaTimeZone(zone) ? { timeZone: zone } : {}),
  });
}
