import { db } from '@/lib/db';
import { ensurePresetRolesAndOwnerEmployee } from '@/lib/restaurant-roles';

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

  // Locked until registration fee (Free) or a paid plan is activated.
  await db.restaurantSubscription.upsert({
    where: { restaurantId: restaurant.id },
    create: {
      restaurantId: restaurant.id,
      plan: 'FREE',
      status: 'CANCELED',
      trialEndsAt: null,
      currentPeriodEnd: null,
      autoRenew: true,
      registrationFeePaid: false,
    },
    update: {},
  });

  return restaurant;
}
