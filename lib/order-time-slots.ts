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

function formatSlotTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function normalizeTimeValue(value: string | undefined | null): string {
  if (typeof value !== 'string') return '09:00';
  const trimmed = value.trim();
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [hours, minutes] = trimmed.split(':').map((part) => Number(part));
    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      const safeHours = Math.min(23, Math.max(0, hours));
      const safeMinutes = Math.min(59, Math.max(0, minutes));
      return `${String(safeHours).padStart(2, '0')}:${String(safeMinutes).padStart(2, '0')}`;
    }
  }
  return '09:00';
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
  const match = hours.find((entry) => entry.dayOfWeek === dayIndex);
  if (!match) return null;
  return {
    dayOfWeek: match.dayOfWeek,
    isOpen: match.isOpen === true,
    openTime: normalizeTimeValue(match.openTime),
    closeTime: normalizeTimeValue(match.closeTime),
  };
}

export function isBranchOpenNow(
  branchHours: BranchOpeningHours | null | undefined,
  now = new Date()
): boolean {
  if (!Array.isArray(branchHours) || branchHours.length === 0) return true;

  const openingHour = getBranchOpeningHour(branchHours, now.getDay());
  if (!openingHour?.isOpen) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = parseTimeToMinutes(openingHour.openTime);
  const closeMinutes = parseTimeToMinutes(openingHour.closeTime);

  if (closeMinutes > openMinutes) {
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  }

  return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
}

export function getBranchCloseTimeToday(
  branchHours: BranchOpeningHours | null | undefined,
  now = new Date()
): string | null {
  if (!Array.isArray(branchHours) || branchHours.length === 0) return null;

  const openingHour = getBranchOpeningHour(branchHours, now.getDay());
  return openingHour?.isOpen ? openingHour.closeTime : null;
}

/** Next N 30-minute pickup/delivery windows from now, respecting branch hours when available. */
export function generateOrderTimeSlots(
  branchHours: BranchOpeningHours | null | undefined = null,
  count = 10,
  intervalMinutes = 30
): OrderTimeSlot[] {
  const now = new Date();
  const intervalMs = intervalMinutes * 60 * 1000;

  if (!Array.isArray(branchHours) || branchHours.length === 0) {
    const start = new Date(Math.ceil(now.getTime() / intervalMs) * intervalMs);
    const slots: OrderTimeSlot[] = [];
    for (let i = 0; i < count; i++) {
      const slotStart = new Date(start.getTime() + i * intervalMs);
      const slotEnd = new Date(slotStart.getTime() + intervalMs);
      slots.push({
        label: `${formatSlotTime(slotStart)} – ${formatSlotTime(slotEnd)}`,
        startAt: slotStart.toISOString(),
      });
    }
    return slots;
  }

  const slots: OrderTimeSlot[] = [];
  const dateCursor = new Date(now);
  dateCursor.setHours(0, 0, 0, 0);
  const maxDaysAhead = 14;

  for (let dayOffset = 0; dayOffset < maxDaysAhead && slots.length < count; dayOffset += 1) {
    const candidateDay = new Date(dateCursor);
    candidateDay.setDate(dateCursor.getDate() + dayOffset);

    const openingHour = getBranchOpeningHour(branchHours, candidateDay.getDay());
    if (!openingHour?.isOpen) continue;

    const openMinutes = parseTimeToMinutes(openingHour.openTime);
    const closeMinutes = parseTimeToMinutes(openingHour.closeTime);
    if (closeMinutes <= openMinutes) continue;

    let startMinutes = openMinutes;
    if (dayOffset === 0) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const nextBoundary = Math.ceil((currentMinutes + 1) / intervalMinutes) * intervalMinutes;
      startMinutes = Math.max(openMinutes, nextBoundary);
    }

    const dayStart = new Date(candidateDay);
    while (startMinutes + intervalMinutes <= closeMinutes && slots.length < count) {
      const slotStart = new Date(dayStart);
      slotStart.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + intervalMs);
      if (slotStart.getTime() >= now.getTime() - 1000) {
        slots.push({
          label: `${formatSlotTime(slotStart)} – ${formatSlotTime(slotEnd)}`,
          startAt: slotStart.toISOString(),
        });
      }
      startMinutes += intervalMinutes;
    }
  }

  if (slots.length === 0) {
    const fallbackStart = new Date(Math.ceil(now.getTime() / intervalMs) * intervalMs);
    for (let i = 0; i < count; i++) {
      const slotStart = new Date(fallbackStart.getTime() + i * intervalMs);
      const slotEnd = new Date(slotStart.getTime() + intervalMs);
      slots.push({
        label: `${formatSlotTime(slotStart)} – ${formatSlotTime(slotEnd)}`,
        startAt: slotStart.toISOString(),
      });
    }
  }

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
