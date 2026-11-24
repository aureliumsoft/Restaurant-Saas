import { db } from '@/lib/db';
import { resolveBranchTimeZone } from '@/lib/branch-timezone';

/** Timezone for a branch, falling back to the restaurant country. */
export async function loadResolvedBranchTimeZone(
  restaurantId: string,
  branchId?: string | null
): Promise<string> {
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { countryCode: true },
  });
  const branch = branchId
    ? await db.branch.findFirst({
        where: { id: branchId, restaurantId },
        select: { timeZone: true },
      })
    : await db.branch.findFirst({
        where: { restaurantId, isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { timeZone: true },
      });
  return resolveBranchTimeZone(branch?.timeZone, restaurant?.countryCode);
}
