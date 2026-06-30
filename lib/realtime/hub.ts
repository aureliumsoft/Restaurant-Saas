import type { RestaurantRealtimeEvent } from '@/lib/realtime/types';

type Subscriber = {
  restaurantId: string;
  branchId: string | null;
  userId: string;
  send: (chunk: string) => void;
  close: () => void;
};

declare global {
  // eslint-disable-next-line no-var
  var __restaurantRealtimeHub: RealtimeHub | undefined;
}

class RealtimeHub {
  private subscribers = new Set<Subscriber>();

  subscribe(subscriber: Subscriber) {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  publish(event: RestaurantRealtimeEvent) {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const sub of this.subscribers) {
      if (sub.restaurantId !== event.restaurantId) continue;
      if (
        event.branchId &&
        sub.branchId &&
        event.branchId !== sub.branchId
      ) {
        continue;
      }
      try {
        sub.send(payload);
      } catch {
        sub.close();
        this.subscribers.delete(sub);
      }
    }
  }

  subscriberCount(restaurantId?: string) {
    if (!restaurantId) return this.subscribers.size;
    let n = 0;
    for (const sub of this.subscribers) {
      if (sub.restaurantId === restaurantId) n += 1;
    }
    return n;
  }
}

export function getRealtimeHub(): RealtimeHub {
  if (!globalThis.__restaurantRealtimeHub) {
    globalThis.__restaurantRealtimeHub = new RealtimeHub();
  }
  return globalThis.__restaurantRealtimeHub;
}
