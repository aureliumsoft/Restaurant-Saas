export type BranchOpeningHour = {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
};

export type BranchOpeningHours = BranchOpeningHour[];

export type OrderTimeSlot = {
  label: string;
  startAt: string;
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function createDefaultOpeningHours(): BranchOpeningHours {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isOpen: true,
    openTime: '09:00',
    closeTime: '23:00',
  }));
}

export function normalizeTimeValue(value: string | undefined | null): string {
  if (typeof value !== 'string') return '09:00';
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return '09:00';
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return '09:00';
  const safeHours = Math.min(23, Math.max(0, hours));
  const safeMinutes = Math.min(59, Math.max(0, minutes));
  return `${String(safeHours).padStart(2, '0')}:${String(safeMinutes).padStart(2, '0')}`;
}

function coerceIsOpen(value: unknown): boolean {
  return value === true || value === 1 || value === 'true' || value === '1';
}

export function normalizeOpeningHours(
  openingHours: unknown
): BranchOpeningHours {
  const defaults = createDefaultOpeningHours();
  const rows = Array.isArray(openingHours)
    ? openingHours
    : typeof openingHours === 'string'
      ? (() => {
          try {
            const parsed = JSON.parse(openingHours) as unknown;
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : [];

  if (rows.length === 0) return defaults;

  const closedWeek: BranchOpeningHours = Array.from(
    { length: 7 },
    (_, dayOfWeek) => ({
      dayOfWeek,
      isOpen: false,
      openTime: '09:00',
      closeTime: '23:00',
    })
  );
  const merged = new Map<number, BranchOpeningHour>();
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue;
    const entry = raw as Record<string, unknown>;
    const dayOfWeek = Number(entry.dayOfWeek);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) continue;
    merged.set(dayOfWeek, {
      dayOfWeek,
      isOpen: coerceIsOpen(entry.isOpen),
      openTime: normalizeTimeValue(
        typeof entry.openTime === 'string' ? entry.openTime : null
      ),
      closeTime: normalizeTimeValue(
        typeof entry.closeTime === 'string' ? entry.closeTime : null
      ),
    });
  }

  return closedWeek.map((entry) => merged.get(entry.dayOfWeek) ?? entry);
}

function parseTimeToMinutes(value: string | undefined | null): number {
  const normalized = normalizeTimeValue(value);
  const [hours, minutes] = normalized.split(':').map(Number);
  return hours * 60 + minutes;
}

function getBranchOpeningHour(
  branchHours: BranchOpeningHours | null | undefined,
  dayIndex: number
): BranchOpeningHour | null {
  const hours = Array.isArray(branchHours) ? branchHours : [];
  const match = hours.find((entry) => Number(entry?.dayOfWeek) === dayIndex);
  if (!match) return null;
  return {
    dayOfWeek: dayIndex,
    isOpen: coerceIsOpen(match.isOpen),
    openTime: normalizeTimeValue(match.openTime),
    closeTime: normalizeTimeValue(match.closeTime),
  };
}

function timezoneOffsetMs(atUtc: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(atUtc);
  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    num('year'),
    num('month') - 1,
    num('day'),
    num('hour'),
    num('minute'),
    num('second')
  );
  return asUtc - atUtc.getTime();
}

function zonedWallToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  return new Date(utc - timezoneOffsetMs(new Date(utc), timeZone));
}

function getZonedParts(now: Date, timeZone?: string | null) {
  if (!timeZone) {
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      dayOfWeek: now.getDay(),
      hours: now.getHours(),
      minutes: now.getMinutes(),
    };
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  let hours = Number(get('hour') || 0);
  if (hours === 24) hours = 0;
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    dayOfWeek: WEEKDAY_INDEX[get('weekday')] ?? 0,
    hours,
    minutes: Number(get('minute') || 0),
  };
}

function addCivilDays(
  year: number,
  month: number,
  day: number,
  days: number
): { year: number; month: number; day: number } {
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function formatSlotTime(date: Date, timeZone?: string | null): string {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...(timeZone ? { timeZone } : {}),
  });
}

function isWithinOpeningWindow(
  currentMinutes: number,
  openMinutes: number,
  closeMinutes: number
): boolean {
  if (closeMinutes > openMinutes) {
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  }
  return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
}

export function isBranchOpenNow(
  branchHours: BranchOpeningHours | null | undefined,
  now = new Date(),
  timeZone?: string | null
): boolean {
  if (!Array.isArray(branchHours) || branchHours.length === 0) return true;

  const zoned = getZonedParts(now, timeZone);
  const openingHour = getBranchOpeningHour(branchHours, zoned.dayOfWeek);
  if (!openingHour?.isOpen) return false;

  const currentMinutes = zoned.hours * 60 + zoned.minutes;
  return isWithinOpeningWindow(
    currentMinutes,
    parseTimeToMinutes(openingHour.openTime),
    parseTimeToMinutes(openingHour.closeTime)
  );
}

export type NextBranchOpen = {
  dayOffset: number;
  dayOfWeek: number;
  time: string;
};

/** Next opening clock time in the restaurant timezone, or null if already open / no hours. */
export function getNextBranchOpenAt(
  branchHours: BranchOpeningHours | null | undefined,
  now = new Date(),
  timeZone?: string | null
): NextBranchOpen | null {
  const hours = Array.isArray(branchHours) ? branchHours : [];
  if (hours.length === 0) return null;
  if (isBranchOpenNow(hours, now, timeZone)) return null;

  const zonedNow = getZonedParts(now, timeZone);
  const currentMinutes = zonedNow.hours * 60 + zonedNow.minutes;

  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const civil = addCivilDays(
      zonedNow.year,
      zonedNow.month,
      zonedNow.day,
      dayOffset
    );
    const noon = timeZone
      ? zonedWallToUtc(civil.year, civil.month, civil.day, 12, 0, timeZone)
      : new Date(civil.year, civil.month - 1, civil.day, 12, 0, 0);
    const dayOfWeek = getZonedParts(noon, timeZone).dayOfWeek;
    const openingHour = getBranchOpeningHour(hours, dayOfWeek);
    if (!openingHour?.isOpen) continue;

    const openMinutes = parseTimeToMinutes(openingHour.openTime);
    const closeMinutes = parseTimeToMinutes(openingHour.closeTime);

    if (dayOffset === 0) {
      const alreadyOpen = isWithinOpeningWindow(
        currentMinutes,
        openMinutes,
        closeMinutes
      );
      if (alreadyOpen) return null;
      if (closeMinutes > openMinutes) {
        if (currentMinutes < openMinutes) {
          return { dayOffset: 0, dayOfWeek, time: openingHour.openTime };
        }
        continue;
      }
      if (currentMinutes < openMinutes) {
        return { dayOffset: 0, dayOfWeek, time: openingHour.openTime };
      }
      continue;
    }

    return { dayOffset, dayOfWeek, time: openingHour.openTime };
  }

  return null;
}

export function getBranchCloseTimeToday(
  branchHours: BranchOpeningHours | null | undefined,
  now = new Date(),
  timeZone?: string | null
): string | null {
  if (!Array.isArray(branchHours) || branchHours.length === 0) return null;

  const zoned = getZonedParts(now, timeZone);
  const openingHour = getBranchOpeningHour(branchHours, zoned.dayOfWeek);
  return openingHour?.isOpen ? openingHour.closeTime : null;
}

/** Next N 30-minute pickup/delivery windows from now, respecting branch hours when available. */
export function generateOrderTimeSlots(
  branchHours: BranchOpeningHours | null | undefined = null,
  count = 10,
  intervalMinutes = 30,
  timeZone?: string | null
): OrderTimeSlot[] {
  const now = new Date();
  const intervalMs = intervalMinutes * 60 * 1000;
  const zonedNow = getZonedParts(now, timeZone);

  const pushFallback = () => {
    const start = new Date(Math.ceil(now.getTime() / intervalMs) * intervalMs);
    const slots: OrderTimeSlot[] = [];
    for (let i = 0; i < count; i++) {
      const slotStart = new Date(start.getTime() + i * intervalMs);
      const slotEnd = new Date(slotStart.getTime() + intervalMs);
      slots.push({
        label: `${formatSlotTime(slotStart, timeZone)} – ${formatSlotTime(slotEnd, timeZone)}`,
        startAt: slotStart.toISOString(),
      });
    }
    return slots;
  };

  if (!Array.isArray(branchHours) || branchHours.length === 0) {
    return pushFallback();
  }

  const slots: OrderTimeSlot[] = [];
  const maxDaysAhead = 14;

  for (let dayOffset = 0; dayOffset < maxDaysAhead && slots.length < count; dayOffset += 1) {
    const civil = addCivilDays(zonedNow.year, zonedNow.month, zonedNow.day, dayOffset);
    const noon = timeZone
      ? zonedWallToUtc(civil.year, civil.month, civil.day, 12, 0, timeZone)
      : new Date(civil.year, civil.month - 1, civil.day, 12, 0, 0);
    const dayOfWeek = getZonedParts(noon, timeZone).dayOfWeek;
    const openingHour = getBranchOpeningHour(branchHours, dayOfWeek);
    if (!openingHour?.isOpen) continue;

    const openMinutes = parseTimeToMinutes(openingHour.openTime);
    const closeMinutes = parseTimeToMinutes(openingHour.closeTime);
    const lastMinutes =
      closeMinutes > openMinutes ? closeMinutes : closeMinutes + 24 * 60;
    if (lastMinutes - openMinutes < intervalMinutes) continue;

    let startMinutes = openMinutes;
    if (dayOffset === 0) {
      const currentMinutes = zonedNow.hours * 60 + zonedNow.minutes;
      const nextBoundary =
        Math.ceil((currentMinutes + 1) / intervalMinutes) * intervalMinutes;
      startMinutes = Math.max(openMinutes, nextBoundary);
    }

    while (startMinutes + intervalMinutes <= lastMinutes && slots.length < count) {
      const dayAdd = Math.floor(startMinutes / (24 * 60));
      const minutesOfDay = startMinutes % (24 * 60);
      const slotCivil = addCivilDays(civil.year, civil.month, civil.day, dayAdd);
      const hour = Math.floor(minutesOfDay / 60);
      const minute = minutesOfDay % 60;
      const slotStart = timeZone
        ? zonedWallToUtc(
            slotCivil.year,
            slotCivil.month,
            slotCivil.day,
            hour,
            minute,
            timeZone
          )
        : new Date(slotCivil.year, slotCivil.month - 1, slotCivil.day, hour, minute, 0);
      if (slotStart.getTime() >= now.getTime() - 1000) {
        const slotEnd = new Date(slotStart.getTime() + intervalMs);
        slots.push({
          label: `${formatSlotTime(slotStart, timeZone)} – ${formatSlotTime(slotEnd, timeZone)}`,
          startAt: slotStart.toISOString(),
        });
      }
      startMinutes += intervalMinutes;
    }
  }

  if (slots.length === 0) return pushFallback();
  return slots.slice(0, count);
}

export type OrderScheduleMode = 'asap' | 'later';

export type OrderSchedule = {
  mode: OrderScheduleMode;
  slot: string;
  slotDateTime?: string;
};

export function readOrderSchedule(orderId: string): OrderSchedule | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`order-schedule-${orderId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OrderSchedule>;
    if (parsed.mode !== 'asap' && parsed.mode !== 'later') return null;
    return {
      mode: parsed.mode,
      slot: typeof parsed.slot === 'string' ? parsed.slot : '',
      slotDateTime: typeof parsed.slotDateTime === 'string' ? parsed.slotDateTime : undefined,
    };
  } catch {
    return null;
  }
}

export function writeOrderSchedule(orderId: string, schedule: OrderSchedule) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`order-schedule-${orderId}`, JSON.stringify(schedule));
}
