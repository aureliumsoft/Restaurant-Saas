import { db } from '@/lib/db';

/** Platform-wide roles (`Role.restaurantId` is null). */
export const GLOBAL_ROLE_SLUG = {
  PLATFORM_ADMIN: 'platform_admin',
  PENDING_OWNER: 'pending_owner',
  PENDING_WORKER: 'pending_worker',
  CUSTOMER_USER: 'customer_user',
} as const;

/** Global roles offered on `/register` (pending until onboarding or invite). */
export const REGISTER_ROLE_SLUG = {
  OWNER: 'pending_owner',
  WORKER: 'pending_worker',
} as const;

export async function getGlobalRoleIdBySlug(
  slug: string
): Promise<string | null> {
  const r = await db.role.findFirst({
    where: { restaurantId: null, slug },
    select: { id: true },
  });
  return r?.id ?? null;
}
