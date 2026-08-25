import { EventEmitter } from 'events';

const REALTIME_BROADCAST = 'foodluk-realtime';

const eventBus = new EventEmitter();
eventBus.setMaxListeners(64);

const originalEmit = eventBus.emit.bind(eventBus);

let broadcast: BroadcastChannel | null | undefined;

function getBroadcast(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  if (broadcast !== undefined) return broadcast;
  try {
    const channel = new BroadcastChannel(REALTIME_BROADCAST);
    channel.onmessage = (event: MessageEvent) => {
      const name = (event.data as { channel?: unknown } | null)?.channel;
      if (typeof name === 'string') {
        originalEmit(name);
      }
    };
    broadcast = channel;
  } catch {
    broadcast = null;
  }
  return broadcast;
}

eventBus.emit = ((event: string | symbol, ...args: unknown[]) => {
  const ok = originalEmit(event, ...args);
  if (typeof window === 'undefined' || typeof event !== 'string') {
    return ok;
  }
  try {
    getBroadcast()?.postMessage({ channel: event });
  } catch {
    /* ignore */
  }
  return ok;
}) as typeof eventBus.emit;

getBroadcast();

export default eventBus;
