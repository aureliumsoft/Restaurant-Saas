function formatSlotTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Next N fifteen-minute pickup/delivery windows from now. */
export function generateOrderTimeSlots(
  count = 10,
  intervalMinutes = 15
): string[] {
  const now = new Date();
  const intervalMs = intervalMinutes * 60 * 1000;
  let start = new Date(Math.ceil(now.getTime() / intervalMs) * intervalMs);

  const slots: string[] = [];
  for (let i = 0; i < count; i++) {
    const end = new Date(start.getTime() + intervalMs);
    slots.push(`${formatSlotTime(start)} – ${formatSlotTime(end)}`);
    start = end;
  }
  return slots;
}

export type OrderScheduleMode = 'asap' | 'later';

export type OrderSchedule = {
  mode: OrderScheduleMode;
  slot: string;
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
    };
  } catch {
    return null;
  }
}

export function writeOrderSchedule(orderId: string, schedule: OrderSchedule) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`order-schedule-${orderId}`, JSON.stringify(schedule));
}
