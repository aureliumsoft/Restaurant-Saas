/** Seeded demo store for the marketing “View Demo” link (`/web-app/{slug}`). */
export const DEMO_RESTAURANT_SLUG = 'restaurant' as const;

/** Shared demo login used on the demo request page and admin reply emails. */
export const DEMO_OWNER_EMAIL =
  process.env.NEXT_PUBLIC_DEMO_OWNER_EMAIL?.trim() ||
  'demo-store-owner@local.dev';

export const DEMO_OWNER_PASSWORD =
  process.env.NEXT_PUBLIC_DEMO_OWNER_PASSWORD?.trim() || '123456789';
