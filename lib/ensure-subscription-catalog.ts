import { db } from '@/lib/db';
import { ensureMissingSubscriptionPlans } from '@/lib/subscription-catalog-defaults';

let pending: Promise<void> | null = null;

/** Makes sure Basic, Pro, and Custom have a price row, without rewriting saved prices. */
export function ensureSubscriptionCatalog(): Promise<void> {
  if (!pending) {
    pending = ensureMissingSubscriptionPlans(db)
      .then(() => undefined)
      .catch((error) => {
        pending = null;
        throw error;
      });
  }
  return pending;
}
