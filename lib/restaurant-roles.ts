import { DASHBOARD_MODULES, PERMISSION_ACTIONS } from '@/constant/dashboardModules';
import {
  normalizeDashboardPermissions,
  permissionName,
} from '@/lib/dashboard-permissions';
import { db } from '@/lib/db';

/** Preset slugs stored in `Role.slug` (per restaurant). */
export const RESTAURANT_ROLE_SLUG = {
  OWNER: 'owner',
  ADMIN: 'admin',
} as const;

export type RestaurantRoleSlug =
  (typeof RESTAURANT_ROLE_SLUG)[keyof typeof RESTAURANT_ROLE_SLUG];

/** All dashboard module permissions (access + edit + delete for each module). */
export function allRestaurantDashboardPermissionNames(): string[] {
  const tokens: string[] = [];
  for (const m of DASHBOARD_MODULES) {
    for (const a of PERMISSION_ACTIONS) {
      tokens.push(permissionName(m.moduleKey, a));
    }
  }
  return normalizeDashboardPermissions(tokens);
}

/**
 * Ensures preset "Owner" and "Admin" roles exist with full dashboard permissions,
 * and assigns the creating user to the Owner role via Employee.
 * Safe to call multiple times (idempotent).
 */
export async function ensurePresetRolesAndOwnerEmployee(
  restaurantId: string,
  ownerUserId: string
): Promise<void> {
  const full = allRestaurantDashboardPermissionNames();

  async function replacePermissions(roleId: string) {
    await db.permission.deleteMany({ where: { roleId } });
    if (full.length > 0) {
      await db.permission.createMany({
        data: full.map((name) => ({ name, roleId })),
      });
    }
  }

  let ownerRole = await db.role.findUnique({
    where: {
      restaurantId_slug: {
        restaurantId,
        slug: RESTAURANT_ROLE_SLUG.OWNER,
      },
    },
  });
  if (!ownerRole) {
    ownerRole = await db.role.create({
      data: {
        restaurantId,
        name: 'Owner',
        slug: RESTAURANT_ROLE_SLUG.OWNER,
        permissions: {
          create: full.map((name) => ({ name })),
        },
      },
    });
  } else {
    await replacePermissions(ownerRole.id);
  }

  const adminRole = await db.role.findUnique({
    where: {
      restaurantId_slug: {
        restaurantId,
        slug: RESTAURANT_ROLE_SLUG.ADMIN,
      },
    },
  });
  if (!adminRole) {
    await db.role.create({
      data: {
        restaurantId,
        name: 'Admin',
        slug: RESTAURANT_ROLE_SLUG.ADMIN,
        permissions: {
          create: full.map((name) => ({ name })),
        },
      },
    });
  } else {
    await replacePermissions(adminRole.id);
  }

  await db.employee.upsert({
    where: {
      userId_restaurantId: {
        userId: ownerUserId,
        restaurantId,
      },
    },
    create: {
      userId: ownerUserId,
      restaurantId,
      roleId: ownerRole.id,
    },
    update: {
      roleId: ownerRole.id,
    },
  });

  await db.user.update({
    where: { id: ownerUserId },
    data: { roleId: ownerRole.id },
  });
}

export async function getEffectiveDashboardPermissionNames(
  userId: string,
  restaurantId: string,
  knownOwnerId?: string | null
): Promise<string[]> {
  const full = allRestaurantDashboardPermissionNames();

  // Owner login is the common path. Skip the extra restaurant and employee reads.
  if (knownOwnerId != null && knownOwnerId === userId) {
    return full;
  }

  let ownerId = knownOwnerId ?? null;
  if (knownOwnerId === undefined) {
    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId },
      select: { ownerId: true },
    });
    if (!restaurant) return [];
    ownerId = restaurant.ownerId;
  }
  if (ownerId === userId) return full;

  const employee = await db.employee.findUnique({
    where: {
      userId_restaurantId: { userId, restaurantId },
    },
    include: {
      role: {
        select: {
          slug: true,
          permissions: { select: { name: true } },
        },
      },
    },
  });

  // Preset Owner role: same — all modules, including new ones added after the role was created.
  if (employee?.role.slug === RESTAURANT_ROLE_SLUG.OWNER) {
    return full;
  }

  if (employee) {
    return employee.role.permissions.map((p) => p.name);
  }

  return [];
}

/** Short-lived `orders:*` permission rows still grant Sales module access. */
const SALES_MODULE_ALIASES = ['sales', 'orders'] as const;

export function canAccessDashboardModule(
  permissionNames: string[],
  moduleKey: string
): boolean {
  const keys =
    moduleKey === 'sales' ? SALES_MODULE_ALIASES : [moduleKey];
  return keys.some(
    (key) =>
      permissionNames.includes(permissionName(key, 'access')) ||
      permissionNames.includes(permissionName(key, 'edit')) ||
      permissionNames.includes(permissionName(key, 'delete'))
  );
}
