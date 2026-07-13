export type BranchOpeningHour = {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
};

export type BranchOpeningHours = BranchOpeningHour[];

export type SlotDurationMinutes = 15 | 30 | 60;

export const SLOT_DURATION_OPTIONS: SlotDurationMinutes[] = [15, 30, 60];
export const DEFAULT_SLOT_DURATION_MINUTES: SlotDurationMinutes = 30;

export type OrderTimeSlot = {
  label: string;
  startAt: string;
};

export type GenerateOrderTimeSlotsOptions = {
  /** Slot length in minutes (15 | 30 | 60). Default 30. */
  intervalMinutes?: number;
  /**
   * How many calendar days ahead to scan.
   * Default 1 = today only (closed today → no slots).
   */
  maxDaysAhead?: number;
  /** Override "now" (useful for tests). */
  now?: Date;
};

export function normalizeSlotDurationMinutes(
  value: unknown
): SlotDurationMinutes {
  const n = typeof value === 'number' ? value : Number(value);
  if (n === 15 || n === 30 || n === 60) return n;
  return DEFAULT_SLOT_DURATION_MINUTES;
}

function formatSlotTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function normalizeTimeValue(value: string | undefined | null): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  const trimmed = value.trim();
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [hours, minutes] = trimmed.split(':').map((part) => Number(part));
    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      const safeHours = Math.min(23, Math.max(0, hours));
      const safeMinutes = Math.min(59, Math.max(0, minutes));
      return `${String(safeHours).padStart(2, '0')}:${String(safeMinutes).padStart(2, '0')}`;
    }
  }
  return '';
}

function parseTimeToMinutes(value: string | undefined | null): number | null {
  const normalized = normalizeTimeValue(value);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Index hours by weekday once for O(1) lookups. */
function indexOpeningHours(
  branchHours: BranchOpeningHours
): Map<number, BranchOpeningHour> {
  const byDay = new Map<number, BranchOpeningHour>();
  for (const entry of branchHours) {
    if (typeof entry?.dayOfWeek !== 'number') continue;
    byDay.set(entry.dayOfWeek, {
      dayOfWeek: entry.dayOfWeek,
      isOpen: entry.isOpen === true,
      openTime: normalizeTimeValue(entry.openTime) || '09:00',
      closeTime: normalizeTimeValue(entry.closeTime) || '17:00',
    });
  }
  return byDay;
}

/**
 * True when the branch is open for today's weekday and the clock is still
 * before closing time (including before open — guests can still order for later).
 */
export function isBranchOpenNow(
  branchHours: BranchOpeningHours | null | undefined,
  now: Date = new Date()
): boolean {
  if (!Array.isArray(branchHours) || branchHours.length === 0) return false;
  const byDay = indexOpeningHours(branchHours);
  const today = byDay.get(now.getDay());
  if (!today?.isOpen) return false;

  const openMinutes = parseTimeToMinutes(today.openTime);
  const closeMinutes = parseTimeToMinutes(today.closeTime);
  if (openMinutes == null || closeMinutes == null) return false;
  if (closeMinutes <= openMinutes) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return currentMinutes < closeMinutes;
}

/** Branch marked closed for today's weekday (ignores clock time). */
export function isBranchClosedToday(
  branchHours: BranchOpeningHours | null | undefined,
  now: Date = new Date()
): boolean {
  if (!Array.isArray(branchHours) || branchHours.length === 0) return true;
  const byDay = indexOpeningHours(branchHours);
  const today = byDay.get(now.getDay());
  return !today?.isOpen;
}

/** Today's close time `HH:mm`, or null when closed / not configured. */
export function getBranchCloseTimeToday(
  branchHours: BranchOpeningHours | null | undefined,
  now: Date = new Date()
): string | null {
  if (!Array.isArray(branchHours) || branchHours.length === 0) return null;
  const byDay = indexOpeningHours(branchHours);
  const today = byDay.get(now.getDay());
  if (!today?.isOpen) return null;
  const close = normalizeTimeValue(today.closeTime);
  return close || null;
}

/**
 * Next interval boundary strictly after `now` (past slots never included).
 * Example (30m): 13:56 → 14:00; 14:00:00 → 14:30.
 */
function nextSlotStartMinutes(now: Date, intervalMinutes: number): number {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const seconds = now.getSeconds();
  const atExactBoundary =
    currentMinutes % intervalMinutes === 0 && seconds === 0;
  if (atExactBoundary) {
    return currentMinutes + intervalMinutes;
  }
  return Math.ceil((currentMinutes + 1) / intervalMinutes) * intervalMinutes;
}

function pushSlotsForDay(
  slots: OrderTimeSlot[],
  day: Date,
  closeMinutes: number,
  firstStartMinutes: number,
  intervalMinutes: number
): void {
  const intervalMs = intervalMinutes * 60 * 1000;
  let startMinutes = firstStartMinutes;
  while (startMinutes + intervalMinutes <= closeMinutes) {
    const slotStart = new Date(day);
    slotStart.setHours(
      Math.floor(startMinutes / 60),
      startMinutes % 60,
      0,
      0
    );
    const slotEnd = new Date(slotStart.getTime() + intervalMs);
    slots.push({
      label: `${formatSlotTime(slotStart)} – ${formatSlotTime(slotEnd)}`,
      startAt: slotStart.toISOString(),
    });
    startMinutes += intervalMinutes;
  }
}

/**
 * Build pickup/delivery slots from the next future boundary until branch close.
 * Interval comes from branch `slotDurationMinutes` (15 / 30 / 60).
 */
export function generateOrderTimeSlots(
  branchHours: BranchOpeningHours | null | undefined = null,
  options: GenerateOrderTimeSlotsOptions = {}
): OrderTimeSlot[] {
  const intervalMinutes = normalizeSlotDurationMinutes(
    options.intervalMinutes ?? DEFAULT_SLOT_DURATION_MINUTES
  );
  const maxDaysAhead = options.maxDaysAhead ?? 1;
  const now = options.now ?? new Date();

  if (!Array.isArray(branchHours) || branchHours.length === 0) {
    return [];
  }

  const byDay = indexOpeningHours(branchHours);
  const slots: OrderTimeSlot[] = [];
  const dayCursor = new Date(now);
  dayCursor.setHours(0, 0, 0, 0);

  for (let dayOffset = 0; dayOffset < maxDaysAhead; dayOffset += 1) {
    const day = new Date(dayCursor);
    day.setDate(dayCursor.getDate() + dayOffset);

    const openingHour = byDay.get(day.getDay());
    if (!openingHour?.isOpen) continue;

    const openMinutes = parseTimeToMinutes(openingHour.openTime);
    const closeMinutes = parseTimeToMinutes(openingHour.closeTime);
    if (openMinutes == null || closeMinutes == null) continue;
    if (closeMinutes <= openMinutes) continue;

    let firstStart = openMinutes;
    if (dayOffset === 0) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      if (currentMinutes < openMinutes) {
        firstStart = openMinutes;
      } else {
        firstStart = Math.max(
          openMinutes,
          nextSlotStartMinutes(now, intervalMinutes)
        );
      }
      if (firstStart + intervalMinutes > closeMinutes) {
        continue;
      }
    }

    pushSlotsForDay(slots, day, closeMinutes, firstStart, intervalMinutes);

    if (slots.length > 0) break;
  }

  return slots;
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
      slotDateTime:
        typeof parsed.slotDateTime === 'string'
          ? parsed.slotDateTime
          : undefined,
    };
  } catch {
    return null;
  }
}

export function writeOrderSchedule(orderId: string, schedule: OrderSchedule) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`order-schedule-${orderId}`, JSON.stringify(schedule));
}
