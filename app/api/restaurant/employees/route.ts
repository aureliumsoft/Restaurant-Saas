import { randomBytes } from 'crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  buildRestaurantInviteAcceptUrl,
  sendEmployeeInviteEmail,
  sendNewEmployeeLoginReadyEmail,
} from '@/lib/email/employee-invite';
import { hashPassword, isStrongPassword } from '@/lib/auth/password';
import { db } from '@/lib/db';
import { GLOBAL_ROLE_SLUG, getGlobalRoleIdBySlug } from '@/lib/global-roles';
import { syncEmployeeBranches } from '@/lib/branch/branch-scope';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import {
  buildPaginationMeta,
  parsePaginationParams,
} from '@/lib/pagination';
import { RESTAURANT_ROLE_SLUG } from '@/lib/restaurant-roles';
import { getRestaurantPlanFeatures, subscriptionPlanDeniedResponse } from '@/lib/subscription-plan-enforcement';

const postSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(120).trim().optional(),
  roleId: z.string().uuid(),
  branchIds: z.array(z.string().uuid()).optional().default([]),
  /** Set when creating a brand-new user; ignored when inviting an existing account. */
  password: z.string().min(8).max(200).optional(),
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function newInviteToken() {
  return randomBytes(32).toString('base64url');
}

async function assertAssignableRestaurantRole(
  restaurantId: string,
  roleId: string
) {
  const role = await db.role.findFirst({
    where: { id: roleId, restaurantId },
    select: { id: true, slug: true },
  });
  if (!role) {
    return { ok: false as const, error: 'Role not found for this restaurant.' };
  }
  if (role.slug === RESTAURANT_ROLE_SLUG.OWNER) {
    return {
      ok: false as const,
      error: 'The Owner role cannot be assigned through invites.',
    };
  }
  return { ok: true as const, role };
}

export async function GET(req: NextRequest) {
  const auth = await getRestaurantIdForRequest(req, {
    moduleKey: 'settings',
    action: 'access',
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const restaurant = await db.restaurant.findUnique({
    where: { id: auth.restaurantId },
    select: { id: true, name: true, ownerId: true },
  });
  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found.' }, { status: 404 });
  }

  const now = new Date();
  const wantsPagination = req.nextUrl.searchParams.get('page') != null;
  const employeeInclude = {
    user: { select: { id: true, name: true, email: true } },
    role: { select: { id: true, name: true, slug: true } },
    branches: { select: { branchId: true } },
  } as const;

  const pendingInvites = await db.employeeInvite.findMany({
    where: {
      restaurantId: auth.restaurantId,
      status: 'PENDING',
      expiresAt: { gt: now },
    },
    include: { role: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  if (!wantsPagination) {
    const employees = await db.employee.findMany({
      where: { restaurantId: auth.restaurantId },
      include: employeeInclude,
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      restaurantName: restaurant.name,
      employees: employees.map((e) => ({
        id: e.id,
        userId: e.user.id,
        name: e.user.name,
        email: e.user.email,
        role: {
          id: e.role.id,
          name: e.role.name,
          slug: e.role.slug,
        },
        isOwner: e.userId === restaurant.ownerId,
        branchIds: e.branches.map((b) => b.branchId),
      })),
      pendingInvites: pendingInvites.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: { id: inv.role.id, name: inv.role.name },
        branchIds: inv.branchIds ?? [],
        expiresAt: inv.expiresAt.toISOString(),
      })),
    });
  }

  const { page, pageSize, skip, take } = parsePaginationParams(
    req.nextUrl.searchParams,
    { defaultPageSize: 20 }
  );
  const where = { restaurantId: auth.restaurantId };
  const [total, employees] = await Promise.all([
    db.employee.count({ where }),
    db.employee.findMany({
      where,
      include: employeeInclude,
      orderBy: { createdAt: 'asc' },
      skip,
      take,
    }),
  ]);

  return NextResponse.json({
    restaurantName: restaurant.name,
    employees: employees.map((e) => ({
      id: e.id,
      userId: e.user.id,
      name: e.user.name,
      email: e.user.email,
      role: {
        id: e.role.id,
        name: e.role.name,
        slug: e.role.slug,
      },
      isOwner: e.userId === restaurant.ownerId,
      branchIds: e.branches.map((b) => b.branchId),
    })),
    pendingInvites: pendingInvites.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: { id: inv.role.id, name: inv.role.name },
      branchIds: inv.branchIds ?? [],
      expiresAt: inv.expiresAt.toISOString(),
    })),
    pagination: buildPaginationMeta(page, pageSize, total),
  });
}

export async function POST(req: NextRequest) {
  const auth = await getRestaurantIdForRequest(req, {
    moduleKey: 'settings',
    action: 'edit',
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const emailNorm = normalizeEmail(parsed.data.email);
  const roleCheck = await assertAssignableRestaurantRole(
    auth.restaurantId,
    parsed.data.roleId
  );
  if (!roleCheck.ok) {
    return NextResponse.json({ error: roleCheck.error }, { status: 400 });
  }

  const isAdminRole =
    roleCheck.role.slug === RESTAURANT_ROLE_SLUG.ADMIN ||
    roleCheck.role.slug === RESTAURANT_ROLE_SLUG.OWNER;
  if (!isAdminRole && (parsed.data.branchIds?.length ?? 0) === 0) {
    return NextResponse.json(
      { error: 'Select a branch for this team member.' },
      { status: 400 }
    );
  }

  const planFeatures = await getRestaurantPlanFeatures(auth.restaurantId);
  if (!planFeatures.roleBasedSettings) {
    if (roleCheck.role.slug !== RESTAURANT_ROLE_SLUG.ADMIN) {
      return subscriptionPlanDeniedResponse(
        'Inviting team members with custom roles'
      );
    }
  }

  const restaurant = await db.restaurant.findUnique({
    where: { id: auth.restaurantId },
    select: { name: true },
  });
  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found.' }, { status: 404 });
  }

  const existingUser = await db.user.findUnique({
    where: { email: emailNorm },
    select: { id: true },
  });

  if (existingUser) {
    const existingEmp = await db.employee.findUnique({
      where: {
        userId_restaurantId: {
          userId: existingUser.id,
          restaurantId: auth.restaurantId,
        },
      },
    });
    if (existingEmp) {
      return NextResponse.json(
        { error: 'This user is already part of this restaurant.' },
        { status: 409 }
      );
    }

    const duplicatePending = await db.employeeInvite.findFirst({
      where: {
        restaurantId: auth.restaurantId,
        email: emailNorm,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });
    if (duplicatePending) {
      return NextResponse.json(
        { error: 'An invitation for this email is already pending.' },
        { status: 409 }
      );
    }

    const token = newInviteToken();
    const inviteRow = await db.employeeInvite.create({
      data: {
        restaurantId: auth.restaurantId,
        email: emailNorm,
        roleId: parsed.data.roleId,
        branchIds: parsed.data.branchIds ?? [],
        token,
        invitedById: auth.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const acceptUrl = buildRestaurantInviteAcceptUrl(token);
    const emailResult = await sendEmployeeInviteEmail({
      to: emailNorm,
      acceptUrl,
      restaurantName: restaurant.name,
    });

    if (!emailResult.ok) {
      await db.employeeInvite.delete({ where: { id: inviteRow.id } });
      return NextResponse.json(
        {
          error: emailResult.error,
        },
        { status: 502 }
      );
    }

    if (emailResult.channel === 'none') {
      return NextResponse.json({
        ok: true,
        flow: 'invite_sent',
        emailDelivered: false,
        manualInviteUrl: acceptUrl,
        message:
          'Invite saved. Configure SMTP_* env vars and restart to send email, or copy the invite link to the user.',
      });
    }

    return NextResponse.json({
      ok: true,
      flow: 'invite_sent',
      emailDelivered: true,
      message:
        'User exists. An email was sent so they can accept the invitation.',
    });
  }

  const name = parsed.data.name?.trim();
  if (!name) {
    return NextResponse.json(
      {
        error:
          'Name is required when the email does not belong to an existing account.',
      },
      { status: 400 }
    );
  }

  const plainPassword = parsed.data.password;
  if (!plainPassword || !isStrongPassword(plainPassword)) {
    return NextResponse.json(
      {
        error:
          'Password is required for new accounts (at least 8 characters).',
      },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(plainPassword);

  const pendingWorkerId = await getGlobalRoleIdBySlug(
    GLOBAL_ROLE_SLUG.PENDING_WORKER
  );
  if (!pendingWorkerId) {
    return NextResponse.json(
      { error: 'Account roles are not configured (pending_worker). Run seed.' },
      { status: 503 }
    );
  }

  const local = emailNorm.split('@')[0]?.replace(/[^a-zA-Z0-9_]/g, '_') || 'user';
  let username = local.slice(0, 40);
  let n = 0;
  for (;;) {
    const taken = await db.user.findFirst({
      where: { username },
      select: { id: true },
    });
    if (!taken) break;
    n += 1;
    if (n > 100) {
      username = `u_${newInviteToken().slice(0, 16)}`;
      continue;
    }
    const suffix = `_${n}`;
    username = `${local.slice(0, Math.max(1, 40 - suffix.length))}${suffix}`;
  }

  let createdEmployeeId: string | null = null;
  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        username,
        email: emailNorm,
        password: passwordHash,
        emailVerified: new Date(),
        roleId: pendingWorkerId,
      },
    });
    const employee = await tx.employee.create({
      data: {
        restaurantId: auth.restaurantId,
        userId: user.id,
        roleId: parsed.data.roleId,
      },
    });
    createdEmployeeId = employee.id;
  });
  if (createdEmployeeId && (parsed.data.branchIds?.length ?? 0) > 0) {
    await syncEmployeeBranches(
      createdEmployeeId,
      parsed.data.branchIds ?? [],
      auth.restaurantId
    );
  }

  const welcomeResult = await sendNewEmployeeLoginReadyEmail({
    to: emailNorm,
    restaurantName: restaurant.name,
  });

  if (!welcomeResult.ok) {
    return NextResponse.json({
      ok: true,
      flow: 'user_created',
      emailDelivered: false,
      emailError: welcomeResult.error,
      message:
        'Account created. Welcome email failed—user can still sign in with the password you set. Check the dev server logs and SMTP_FROM_EMAIL.',
    });
  }

  if (welcomeResult.channel === 'none') {
    return NextResponse.json({
      ok: true,
      flow: 'user_created',
      emailDelivered: false,
      message:
        'Account created. Configure SMTP_* env vars to send welcome emails; user can sign in with the password you set.',
    });
  }

  return NextResponse.json({
    ok: true,
    flow: 'user_created',
    emailDelivered: true,
    message:
      'Account created. They can sign in with this email and the password you set.',
  });
}
