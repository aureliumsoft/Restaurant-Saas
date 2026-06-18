import { db } from '@/lib/db';
import { ensurePresetRolesAndOwnerEmployee } from '@/lib/restaurant-roles';

const TRIAL_DAYS = 30;

export async function createRestaurantWithDefaults(opts: {
  name: string;
  subdomain: string;
  ownerUserId: string;
}) {
  const restaurant = await db.restaurant.create({
    data: {
      name: opts.name,
      slug: opts.subdomain,
      subdomain: opts.subdomain,
      ownerId: opts.ownerUserId,
    },
  });

  await ensurePresetRolesAndOwnerEmployee(restaurant.id, opts.ownerUserId);

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

  await db.restaurantSubscription.upsert({
    where: { restaurantId: restaurant.id },
    create: {
      restaurantId: restaurant.id,
      plan: 'STARTER',
      status: 'TRIAL',
      trialEndsAt,
      currentPeriodEnd: trialEndsAt,
      autoRenew: true,
    },
    update: {},
  });

  return restaurant;
}
