import type { PrismaClient } from '@prisma/client';

import { CUSTOMER_USER_MODULES } from '../constant/customerRoleModules';
import { DASHBOARD_MODULES, PERMISSION_ACTIONS } from '../constant/dashboardModules';
import { PLATFORM_ADMIN_MODULES } from '../constant/platformModules';

/** Slugs for global roles (`restaurantId` = null). Must stay stable for migrations & lookups. */
export const SEED_GLOBAL_ROLE_SLUG = {
  /** SaaS platform admin — all /admin/* modules. */
  PLATFORM_ADMIN: 'platform_admin',
  /** Restaurant owner template — full restaurant dashboard (employees, orders, records, all modules). */
  OWNER: 'seed_owner',
  /** End-customer / storefront — browse menu & place orders. */
  CUSTOMER_USER: 'customer_user',
} as const;

function tokensForModules(
  modules: readonly { moduleKey: string }[]
): string[] {
  const tokens: string[] = [];
  for (const m of modules) {
    for (const a of PERMISSION_ACTIONS) {
      tokens.push(`${m.moduleKey}:${a}`);
    }
  }
  return tokens;
}

export function allPlatformAdminPermissionNames(): string[] {
  return tokensForModules(PLATFORM_ADMIN_MODULES);
}

/** All restaurant dashboard tokens (every module × access, edit, delete). */
export function allRestaurantOwnerPermissionNames(): string[] {
  return tokensForModules(DASHBOARD_MODULES);
}

export function allCustomerUserPermissionNames(): string[] {
  return tokensForModules(CUSTOMER_USER_MODULES);
}

/**
 * DB must allow NULL `Role.restaurantId` for platform-wide roles.
 * Applies the same change as migration `20260404180000_ensure_role_restaurant_id_nullable`
 * so `npx prisma db seed` works even if migrations were not deployed yet.
 */
async function ensureRoleRestaurantIdNullable(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "Role" ALTER COLUMN "restaurantId" DROP NOT NULL'
  );
}

async function upsertGlobalRole(
  prisma: PrismaClient,
  slug: string,
  name: string,
  permissionNames: string[]
) {
  const existing = await prisma.role.findFirst({
    where: { restaurantId: null, slug },
  });

  if (existing) {
    await prisma.permission.deleteMany({ where: { roleId: existing.id } });
    if (permissionNames.length > 0) {
      await prisma.permission.createMany({
        data: permissionNames.map((n) => ({ name: n, roleId: existing.id })),
      });
    }
    await prisma.role.update({
      where: { id: existing.id },
      data: { name },
    });
    console.log(`[seed] Updated global role "${name}" (${slug})`);
    return;
  }

  await prisma.role.create({
    data: {
      name,
      slug,
      restaurantId: null,
      permissions: {
        create: permissionNames.map((n) => ({ name: n })),
      },
    },
  });
  console.log(`[seed] Created global role "${name}" (${slug})`);
}

/** Platform roles used before invite acceptance / employee onboarding. */
async function refreshPendingSignupRoles(prisma: PrismaClient) {
  const ownerPerms = allRestaurantOwnerPermissionNames();

  await upsertGlobalRole(
    prisma,
    'pending_owner',
    'Pending Owner',
    ownerPerms
  );
  await upsertGlobalRole(
    prisma,
    'pending_worker',
    'Pending Worker',
    ownerPerms
  );
}

/**
 * Default global roles:
 * - Admin — SaaS platform (all admin_* modules)
 * - Owner — restaurant management (all dashboard modules)
 * - User — customer storefront (customer_* modules)
 */
export async function seedDefaultGlobalRoles(prisma: PrismaClient) {
  await ensureRoleRestaurantIdNullable(prisma);

  await upsertGlobalRole(
    prisma,
    SEED_GLOBAL_ROLE_SLUG.PLATFORM_ADMIN,
    'Admin',
    allPlatformAdminPermissionNames()
  );

  await upsertGlobalRole(
    prisma,
    SEED_GLOBAL_ROLE_SLUG.OWNER,
    'Owner',
    allRestaurantOwnerPermissionNames()
  );

  await upsertGlobalRole(
    prisma,
    SEED_GLOBAL_ROLE_SLUG.CUSTOMER_USER,
    'User',
    allCustomerUserPermissionNames()
  );

  await refreshPendingSignupRoles(prisma);

  const ownerPermCount = allRestaurantOwnerPermissionNames().length;
  console.log(
    `[seed] Global Owner (seed_owner) has ${ownerPermCount} permissions (all modules × access/edit/delete)`
  );
}
