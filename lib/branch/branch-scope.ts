import type { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import { RESTAURANT_ROLE_SLUG } from '@/lib/restaurant-roles';

export type BranchOption = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
};

export type BranchScope = {
  restaurantId: string;
  /** Branches the user may view/switch to. */
  allowedBranchIds: string[];
  /** Currently active branch for filtering (null = no filter / legacy). */
  activeBranchId: string | null;
  canSwitchBranch: boolean;
  isOwnerOrAdmin: boolean;
  branches: BranchOption[];
};

export function branchCookieName(restaurantId: string) {
  return `rs_branch_${restaurantId}`;
}

export function readActiveBranchCookie(
  req: NextRequest,
  restaurantId: string
): string | null {
  const raw = req.cookies.get(branchCookieName(restaurantId))?.value?.trim();
  return raw && raw.length > 0 ? raw : null;
}

export async function userIsOwnerOrAdmin(
  userId: string,
  restaurantId: string
): Promise<boolean> {
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { ownerId: true },
  });
  if (!restaurant) return false;
  if (restaurant.ownerId === userId) return true;

  const employee = await db.employee.findUnique({
    where: { userId_restaurantId: { userId, restaurantId } },
    select: { role: { select: { slug: true } } },
  });
  return employee?.role.slug === RESTAURANT_ROLE_SLUG.ADMIN;
}

export async function getEmployeeAssignedBranchIds(
  userId: string,
  restaurantId: string
): Promise<string[]> {
  const employee = await db.employee.findUnique({
    where: { userId_restaurantId: { userId, restaurantId } },
    select: {
      branches: { select: { branchId: true } },
    },
  });
  return employee?.branches.map((b) => b.branchId) ?? [];
}

export async function resolveBranchScope(
  userId: string,
  restaurantId: string,
  activeBranchIdFromRequest: string | null
): Promise<BranchScope | null> {
  const branches = await db.branch.findMany({
    where: { restaurantId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, address: true, phone: true },
  });

  if (branches.length === 0) {
    return {
      restaurantId,
      allowedBranchIds: [],
      activeBranchId: null,
      canSwitchBranch: false,
      isOwnerOrAdmin: await userIsOwnerOrAdmin(userId, restaurantId),
      branches: [],
    };
  }

  const isOwnerOrAdmin = await userIsOwnerOrAdmin(userId, restaurantId);
  const assignedIds = await getEmployeeAssignedBranchIds(userId, restaurantId);

  const allowedBranchIds = isOwnerOrAdmin
    ? branches.map((b) => b.id)
    : assignedIds.filter((id) => branches.some((b) => b.id === id));

  /** Only owner/admin may switch branches in the dashboard header. */
  const canSwitchBranch = isOwnerOrAdmin && branches.length > 1;

  const preferredBranchId = isOwnerOrAdmin ? activeBranchIdFromRequest : null;

  let activeBranchId: string | null = null;
  if (
    preferredBranchId &&
    allowedBranchIds.includes(preferredBranchId)
  ) {
    activeBranchId = preferredBranchId;
  } else if (allowedBranchIds.length === 1) {
    activeBranchId = allowedBranchIds[0] ?? null;
  } else if (!isOwnerOrAdmin && allowedBranchIds.length > 0) {
    activeBranchId = allowedBranchIds[0] ?? null;
  } else if (isOwnerOrAdmin && allowedBranchIds.length > 0) {
    activeBranchId = allowedBranchIds[0] ?? null;
  }

  const visibleBranches = isOwnerOrAdmin
    ? branches
    : branches.filter((b) => allowedBranchIds.includes(b.id));

  return {
    restaurantId,
    allowedBranchIds,
    activeBranchId,
    canSwitchBranch,
    isOwnerOrAdmin,
    branches: visibleBranches,
  };
}

export async function getBranchScopeFromRequest(
  req: NextRequest,
  userId: string,
  restaurantId: string
): Promise<BranchScope | null> {
  const fromQuery = req.nextUrl.searchParams.get('branchId')?.trim() || null;
  const fromCookie = readActiveBranchCookie(req, restaurantId);
  const preferred = fromQuery || fromCookie;
  return resolveBranchScope(userId, restaurantId, preferred);
}

/** SQL filter for Order rows by active branch. */
export function orderBranchSql(branchId: string | null): Prisma.Sql {
  if (!branchId) return Prisma.empty;
  return Prisma.sql`AND o."branchId" = ${branchId}`;
}

export function orderBranchWhere(branchId: string | null) {
  if (!branchId) return {};
  return { branchId };
}

export function tableBranchWhere(branchId: string | null) {
  if (!branchId) return {};
  return { branchId };
}

export async function validateBranchForRestaurant(
  branchId: string,
  restaurantId: string
): Promise<boolean> {
  const row = await db.branch.findFirst({
    where: { id: branchId, restaurantId },
    select: { id: true },
  });
  return Boolean(row);
}

export async function syncEmployeeBranches(
  employeeId: string,
  branchIds: string[],
  restaurantId: string
) {
  const validIds = (
    await db.branch.findMany({
      where: { restaurantId, id: { in: branchIds } },
      select: { id: true },
    })
  ).map((b) => b.id);

  await db.employeeBranch.deleteMany({ where: { employeeId } });
  if (validIds.length > 0) {
    await db.employeeBranch.createMany({
      data: validIds.map((branchId) => ({ employeeId, branchId })),
      skipDuplicates: true,
    });
  }
}
