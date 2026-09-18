import { unstable_cache } from 'next/cache';

import { db } from '@/lib/db';
import { normalizeThemePrimaryColor } from '@/lib/restaurant-theme';

export const RESTAURANT_THEME_CACHE_TAG = 'restaurant-theme';

const getCachedRestaurantThemePrimary = unstable_cache(
  async (slug: string) => {
    try {
      const restaurant = await db.restaurant.findUnique({
        where: { slug },
        select: { themePrimaryColor: true },
      });
      return normalizeThemePrimaryColor(restaurant?.themePrimaryColor);
    } catch {
      return null;
    }
  },
  ['restaurant-theme-primary'],
  { revalidate: 60, tags: [RESTAURANT_THEME_CACHE_TAG] }
);

export async function loadRestaurantThemePrimary(
  slug?: string | null
): Promise<string | null> {
  const key = slug?.trim();
  if (!key) return null;
  return getCachedRestaurantThemePrimary(key);
}
