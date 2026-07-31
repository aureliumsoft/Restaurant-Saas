import { getAppSession } from '@/lib/auth/app-session';
import { db } from '@/lib/db';
import { evaluateSubscriptionAccess } from '@/lib/subscription-access';

/**
 * Server-side gate for restaurant dashboard routes.
 * Returns whether the signed-in user's restaurant subscription still allows access.
 */
export async function getDashboardSubscriptionAccess(): Promise<{
  authenticated: boolean;
  allowed: boolean;
}> {
  const session = await getAppSession();
  const email =
    typeof session?.user?.email === 'string' ? session.user.email.trim() : '';
  if (!email) {
    return { authenticated: false, allowed: false };
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) {
    return { authenticated: true, allowed: false };
  }

  const restaurant = await db.restaurant.findFirst({
    where: {
      OR: [{ ownerId: user.id }, { employees: { some: { userId: user.id } } }],
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!restaurant) {
    return { authenticated: true, allowed: false };
  }

  const subscription = await db.restaurantSubscription.findUnique({
    where: { restaurantId: restaurant.id },
    select: {
      status: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
    },
  });

  const access = evaluateSubscriptionAccess(subscription);
  return { authenticated: true, allowed: access.allowed };
}
