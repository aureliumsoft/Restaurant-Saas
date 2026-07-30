import { GLOBAL_ROLE_SLUG } from '@/lib/global-roles';

export type AccountRoleForLegacy = {
  slug: string | null;
  name: string;
  restaurantId: string | null;
} | null;

/** JWT/session legacy string derived from `User.accountRole` (Role row). */
export function legacyRoleFromAccountRole(
  role: AccountRoleForLegacy
): 'ADMIN' | 'OWNER' | 'WORKER' | 'USER' | 'UNKNOW' {
  if (!role) return 'UNKNOW';
  const { slug, name, restaurantId } = role;

  if (slug === GLOBAL_ROLE_SLUG.PLATFORM_ADMIN) return 'ADMIN';

  if (
    slug === GLOBAL_ROLE_SLUG.PENDING_OWNER ||
    slug === 'owner' ||
    (name === 'Owner' && restaurantId === null)
  ) {
    return 'OWNER';
  }

  if (
    slug === GLOBAL_ROLE_SLUG.PENDING_WORKER ||
    (name === 'Worker' && restaurantId === null)
  ) {
    return 'WORKER';
  }

  if (
    slug === GLOBAL_ROLE_SLUG.CUSTOMER_USER ||
    (name === 'User' && restaurantId === null)
  ) {
    return 'USER';
  }

  if (slug === 'admin') return 'WORKER';

  // Custom restaurant roles (non-preset names/slugs)
  return 'WORKER';
}
