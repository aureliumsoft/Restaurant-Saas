import { db } from '@/lib/db';
import { GLOBAL_ROLE_SLUG } from '@/lib/global-roles';
import { allRestaurantDashboardPermissionNames } from '@/lib/restaurant-roles';

/**
 * Ensures platform signup roles exist (pending_owner / pending_worker).
 * Safe on production when `prisma db seed` was never run.
 */
export async function ensureGlobalSignupRolesExist(): Promise<void> {
  const permissions = allRestaurantDashboardPermissionNames();

  const specs = [
    { slug: GLOBAL_ROLE_SLUG.PENDING_OWNER, name: 'Pending Owner' },
    { slug: GLOBAL_ROLE_SLUG.PENDING_WORKER, name: 'Pending Worker' },
  ] as const;

  for (const spec of specs) {
    const existing = await db.role.findFirst({
      where: { restaurantId: null, slug: spec.slug },
      select: { id: true },
    });
    if (existing) continue;

    await db.role.create({
      data: {
        name: spec.name,
        slug: spec.slug,
        restaurantId: null,
        permissions: {
          create: permissions.map((name) => ({ name })),
        },
      },
    });
  }
}
